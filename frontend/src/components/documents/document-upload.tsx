"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, 
  FileText, 
  Loader2, 
  X, 
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { StatusWorkflowHelp } from './status-workflow-help'

interface DuplicateMatch {
  id: number
  title: string
  similarity: number
  reasoning?: string
}

const uploadSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  document_type: z.string().min(1, 'Document type is required'),
  access_level: z.string().min(1, 'Access level is required'),
  status: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  keywords: z.string().optional(),
  tags: z.string().optional(),
  compliance_framework: z.string().optional(),
  retention_period_months: z.number().optional(),
  review_frequency_months: z.number().optional(),
  expires_at: z.string().optional(),
})

type UploadFormData = z.infer<typeof uploadSchema>

interface DocumentUploadProps {
  onUploadSuccess: () => void
}

export function DocumentUpload({ onUploadSuccess }: DocumentUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [aiCategory, setAiCategory] = useState<string | null>(null)
  const [aiTags, setAiTags] = useState<string[]>([])
  const [aiKeywords, setAiKeywords] = useState<string[]>([])
  const [aiNotes, setAiNotes] = useState<string[]>([])
  const [aiConfidence, setAiConfidence] = useState<number | null>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([])
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')

  const buildApiUrl = (path: string) => {
    if (!path.startsWith('/')) {
      return API_BASE_URL ? `${API_BASE_URL}/${path}` : `/${path}`
    }
    return API_BASE_URL ? `${API_BASE_URL}${path}` : path
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      access_level: 'internal',
      document_type: 'policy',
      status: 'draft'
    }
  })

  const documentTypes = [
    { value: 'policy', label: 'Policy' },
    { value: 'procedure', label: 'Procedure' },
    { value: 'form', label: 'Form' },
    { value: 'template', label: 'Template' },
    { value: 'report', label: 'Report' },
    { value: 'manual', label: 'Manual' },
    { value: 'certificate', label: 'Certificate' },
    { value: 'regulation', label: 'Regulation' },
    { value: 'audit_report', label: 'Audit Report' },
    { value: 'risk_assessment', label: 'Risk Assessment' },
    { value: 'incident_report', label: 'Incident Report' },
    { value: 'training_material', label: 'Training Material' },
    { value: 'other', label: 'Other' }
  ]

  const accessLevels = [
    { value: 'public', label: 'Public' },
    { value: 'internal', label: 'Internal' },
    { value: 'confidential', label: 'Confidential' },
    { value: 'restricted', label: 'Restricted' }
  ]

  const complianceFrameworks = [
    'ISO 27001',
    'SOX (Sarbanes-Oxley)',
    'GDPR',
    'HIPAA',
    'PCI DSS',
    'NIST',
    'COSO',
    'COBIT'
  ]

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setUploadStatus('idle')
      resetAISignals()
      // Auto-fill title with filename if title is empty
      if (!watch('title')) {
        setValue('title', file.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    const fileInput = document.getElementById('file-upload') as HTMLInputElement
    if (fileInput) fileInput.value = ''
    resetAISignals()
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const resetAISignals = () => {
    setAiCategory(null)
    setAiTags([])
    setAiKeywords([])
    setAiNotes([])
    setAiConfidence(null)
    setAiSummary(null)
    setDuplicateMatches([])
  }

  const computeFileHash = async (file: File) => {
    const buffer = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buffer)
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const readTextPreview = async (file: File) => {
    if (file.type.startsWith('text/') || file.type === 'application/json') {
      return new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          const content = typeof reader.result === 'string' ? reader.result : ''
          resolve(content.slice(0, 4000))
        }
        reader.onerror = () => resolve('')
        reader.readAsText(file)
      })
    }
    return ''
  }

  const handleRunAI = async () => {
    if (!selectedFile) {
      setErrorMessage('Select a document before running AI analysis')
      return
    }

    const token = localStorage.getItem('auth_token')
    if (!token) {
      setErrorMessage('No authentication token found. Please login again.')
      setUploadStatus('error')
      return
    }

    setAnalyzing(true)
    setErrorMessage('')

    try {
      const textPreview = await readTextPreview(selectedFile)

      const categorizeResponse = await fetch(buildApiUrl('/api/documents/ai/categorize'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: watch('title'),
          description: watch('description'),
          document_type: watch('document_type'),
          existing_tags: watch('tags') ? watch('tags')?.split(',').map(t => t.trim()).filter(Boolean) : undefined,
          existing_keywords: watch('keywords') ? watch('keywords')?.split(',').map(t => t.trim()).filter(Boolean) : undefined,
          text_preview: textPreview
        })
      })

      if (categorizeResponse.ok) {
        const data = await categorizeResponse.json()
        if (data.category && !watch('category')) {
          setValue('category', data.category)
        }
        if (data.tags?.length && !watch('tags')) {
          setValue('tags', data.tags.join(', '))
        }
        if (data.keywords?.length && !watch('keywords')) {
          setValue('keywords', data.keywords.join(', '))
        }
        setAiCategory(data.category || null)
        setAiTags(data.tags || [])
        setAiKeywords(data.keywords || [])
        setAiNotes(data.notes || [])
        setAiConfidence(typeof data.confidence === 'number' ? data.confidence : null)
        setAiSummary(data.summary || null)
      }

      const fileHash = await computeFileHash(selectedFile)
      const duplicateResponse = await fetch(buildApiUrl('/api/documents/ai/duplicates'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: watch('title'),
          description: watch('description'),
          document_type: watch('document_type'),
          file_hash: fileHash,
          keywords: watch('keywords') ? watch('keywords')?.split(',').map(k => k.trim()).filter(Boolean) : undefined,
          tags: watch('tags') ? watch('tags')?.split(',').map(k => k.trim()).filter(Boolean) : undefined
        })
      })

      if (duplicateResponse.ok) {
        const duplicateData = await duplicateResponse.json()
        setDuplicateMatches(duplicateData.duplicates || [])
        if (duplicateData.notes?.length) {
          setAiNotes(prev => [...new Set([...prev, ...duplicateData.notes])])
        }
      }
    } catch (error) {
      console.error('AI analysis error:', error)
      setErrorMessage('Unable to complete AI analysis. Please try again later.')
    } finally {
      setAnalyzing(false)
    }
  }

  const onSubmit = async (data: UploadFormData) => {
    if (!selectedFile) {
      setErrorMessage('Please select a file to upload')
      return
    }

    setUploading(true)
    setUploadStatus('idle')
    setErrorMessage('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('title', data.title)
      
      if (data.description) formData.append('description', data.description)
      formData.append('document_type', data.document_type)
      formData.append('access_level', data.access_level)
      if (data.status) formData.append('status', data.status)
      if (data.category) formData.append('category', data.category)
      if (data.subcategory) formData.append('subcategory', data.subcategory)
      
      // Handle keywords and tags as JSON arrays
      if (data.keywords) {
        const keywordsArray = data.keywords.split(',').map(k => k.trim()).filter(k => k)
        formData.append('keywords', JSON.stringify(keywordsArray))
      }
      
      if (data.tags) {
        const tagsArray = data.tags.split(',').map(t => t.trim()).filter(t => t)
        formData.append('tags', JSON.stringify(tagsArray))
      }
      
      if (data.compliance_framework) formData.append('compliance_framework', data.compliance_framework)
      if (data.retention_period_months) formData.append('retention_period_months', data.retention_period_months.toString())
      if (data.review_frequency_months) formData.append('review_frequency_months', data.review_frequency_months.toString())
      if (data.expires_at) formData.append('expires_at', data.expires_at)

      const token = localStorage.getItem('auth_token')
      if (!token) {
        setErrorMessage('No authentication token found. Please login again.')
        setUploadStatus('error')
        return
      }
      
      const response = await fetch(buildApiUrl('/api/documents/upload'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (response.ok) {
        setUploadStatus('success')
        reset()
        setSelectedFile(null)
        setTimeout(() => {
          onUploadSuccess()
        }, 1500)
      } else {
        const errorData = await response.json()
        setErrorMessage(errorData.detail || 'Upload failed')
        setUploadStatus('error')
      }
    } catch (error) {
      console.error('Upload error:', error)
      setErrorMessage('Upload failed due to network error')
      setUploadStatus('error')
    } finally {
      setUploading(false)
    }
  }

  if (uploadStatus === 'success') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              Upload Successful!
            </h3>
            <p className="text-green-600">
              Your document has been uploaded and is ready for review.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
      {/* File Upload Area */}
      <div className="space-y-4">
        <Label htmlFor="file-upload">Document File</Label>
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 sm:p-6">
          {!selectedFile ? (
            <div className="text-center">
              <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground mx-auto mb-3 sm:mb-4" />
              <div className="space-y-2">
                <Label htmlFor="file-upload" className="cursor-pointer block">
                  <span className="text-primary font-medium text-sm sm:text-base">Click to upload</span>
                  <span className="text-muted-foreground text-sm sm:text-base"> or drag and drop</span>
                </Label>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX (max 100MB)
                </p>
              </div>
              <Input
                id="file-upload"
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.csv,.jpg,.jpeg,.png,.gif,.zip,.rar,.7z,.mp4,.avi,.mov"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center space-x-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={removeFile}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Document Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            {...register('title')}
            placeholder="Document title"
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="document_type">Document Type *</Label>
          <Select onValueChange={(value) => setValue('document_type', value)} defaultValue="policy">
            <SelectTrigger>
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              {documentTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.document_type && (
            <p className="text-sm text-destructive">{errors.document_type.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Brief description of the document"
          rows={3}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Use AI to pre-fill categories, tags, and spot duplicates before uploading.
        </p>
        <Button type="button" variant="outline" onClick={handleRunAI} disabled={!selectedFile || analyzing}>
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analysing...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Run AI Assist
            </>
          )}
        </Button>
      </div>

      {(aiCategory || aiTags.length > 0 || aiKeywords.length > 0 || duplicateMatches.length > 0 || aiNotes.length > 0) && (
        <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/40 p-4 space-y-3">
          {aiCategory && (
            <div>
              <p className="text-sm font-medium">Suggested Category</p>
              <Badge variant="secondary">{aiCategory}</Badge>
            </div>
          )}
          {aiSummary && <p className="text-sm text-muted-foreground">{aiSummary}</p>}
          {aiConfidence !== null && (
            <p className="text-xs text-muted-foreground">AI confidence: {(aiConfidence * 100).toFixed(0)}%</p>
          )}
          {aiTags.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Suggested Tags</p>
              <div className="flex flex-wrap gap-2">
                {aiTags.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
          {aiKeywords.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Suggested Keywords</p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {aiKeywords.map((keyword) => (
                  <span key={keyword} className="rounded border px-2 py-0.5 bg-background">{keyword}</span>
                ))}
              </div>
            </div>
          )}
          {aiNotes.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">AI Notes</p>
              <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                {aiNotes.map((note, index) => (
                  <li key={`${note}-${index}`}>{note}</li>
                ))}
              </ul>
            </div>
          )}
          {duplicateMatches.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Potential duplicates detected
              </p>
              <ul className="space-y-2 text-sm">
                {duplicateMatches.map((match) => (
                  <li key={match.id} className="rounded border p-2 text-muted-foreground">
                    <div className="font-medium text-foreground">{match.title}</div>
                    <div className="text-xs">Similarity: {(match.similarity * 100).toFixed(0)}%</div>
                    {match.reasoning && <div className="text-xs mt-1">{match.reasoning}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="access_level">Access Level</Label>
          <Select onValueChange={(value) => setValue('access_level', value)} defaultValue="internal">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accessLevels.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Initial Status</Label>
          <Select onValueChange={(value) => setValue('status', value)} defaultValue="draft">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft (Requires Review)</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Draft is recommended for compliance workflow
            </p>
            <StatusWorkflowHelp />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            {...register('category')}
            placeholder="e.g., HR Policies"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subcategory">Subcategory</Label>
          <Input
            id="subcategory"
            {...register('subcategory')}
            placeholder="e.g., Employee Handbook"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="keywords">Keywords</Label>
          <Input
            id="keywords"
            {...register('keywords')}
            placeholder="Comma-separated keywords"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            {...register('tags')}
            placeholder="Comma-separated tags"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="compliance_framework">Compliance Framework</Label>
          <Select onValueChange={(value) => setValue('compliance_framework', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select framework (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {complianceFrameworks.map((framework) => (
                <SelectItem key={framework} value={framework}>
                  {framework}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="review_frequency_months">Review Frequency (months)</Label>
          <Input
            id="review_frequency_months"
            type="number"
            {...register('review_frequency_months', { valueAsNumber: true })}
            placeholder="e.g., 12"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="retention_period_months">Retention Period (months)</Label>
          <Input
            id="retention_period_months"
            type="number"
            {...register('retention_period_months', { valueAsNumber: true })}
            placeholder="e.g., 84"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expires_at">Expiration Date</Label>
          <Input
            id="expires_at"
            type="date"
            {...register('expires_at')}
          />
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-end gap-3">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => {
            reset()
            setSelectedFile(null)
            setUploadStatus('idle')
            setErrorMessage('')
          }}
          className="w-full sm:w-auto"
        >
          Clear
        </Button>
        <Button 
          type="submit" 
          disabled={uploading || !selectedFile}
          className="w-full sm:w-auto sm:min-w-[120px]"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </>
          )}
        </Button>
      </div>
    </form>
  )
}