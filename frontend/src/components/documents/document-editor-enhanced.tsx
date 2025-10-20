"use client"

import { useState, useEffect, useRef } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Save,
  Download,
  FileText,
  Eye,
  Edit,
  AlertTriangle,
  Loader2,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  FileUp,
  Code,
  Image,
  FileImage
} from 'lucide-react'
import { DocumentViewer } from './document-viewer'

const editSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  document_type: z.string().min(1, 'Document type is required'),
  access_level: z.string().min(1, 'Access level is required'),
  status: z.string().min(1, 'Status is required'),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  keywords: z.string().optional(),
  tags: z.string().optional(),
  compliance_framework: z.string().optional(),
  retention_period_months: z.number().optional(),
  review_frequency_months: z.number().optional(),
  expires_at: z.string().optional(),
})

type EditFormData = z.infer<typeof editSchema>

interface Document {
  id: number
  title: string
  description?: string
  document_type: string
  status: string
  access_level: string
  category?: string
  subcategory?: string
  keywords?: string
  tags?: string
  compliance_framework?: string
  retention_period_months?: number
  review_frequency_months?: number
  expires_at?: string
  filename: string
  file_size: number
  version: string
  created_by_id: number
  created_at: string
  updated_at: string
  next_review_date?: string
  mime_type?: string
}

interface DocumentEditorEnhancedProps {
  document: Document
  isOpen: boolean
  onClose: () => void
  onSave: (updatedDocument: Partial<Document>) => Promise<void>
  onDownload: () => void
}

export function DocumentEditorEnhanced({ 
  document, 
  isOpen, 
  onClose, 
  onSave, 
  onDownload 
}: DocumentEditorEnhancedProps) {
  const [activeTab, setActiveTab] = useState('view')
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [reuploadStatus, setReuploadStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [inlineContent, setInlineContent] = useState('')
  const [isEditingContent, setIsEditingContent] = useState(false)
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
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

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' },
    { value: 'expired', label: 'Expired' }
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

  useEffect(() => {
    if (isOpen && document) {
      // Parse keywords and tags from JSON strings
      const keywordsStr = document.keywords ? 
        JSON.parse(document.keywords).join(', ') : ''
      const tagsStr = document.tags ? 
        JSON.parse(document.tags).join(', ') : ''
      
      reset({
        title: document.title,
        description: document.description,
        document_type: document.document_type,
        status: document.status,
        access_level: document.access_level,
        category: document.category,
        subcategory: document.subcategory,
        keywords: keywordsStr,
        tags: tagsStr,
        compliance_framework: document.compliance_framework,
        retention_period_months: document.retention_period_months,
        review_frequency_months: document.review_frequency_months,
        expires_at: document.expires_at ? document.expires_at.split('T')[0] : undefined
      })

      // Load inline content for editable formats
      if (isEditableFormat(document.mime_type)) {
        loadInlineContent()
      }
    }
  }, [isOpen, document, reset])

  const isEditableFormat = (mimeType?: string) => {
    if (!mimeType) return false
    return ['text/plain', 'text/html', 'application/json', 'text/css', 'text/javascript'].includes(mimeType) ||
           mimeType.startsWith('text/')
  }

  const loadInlineContent = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        console.error('No auth token found for loading inline content')
        return
      }

      console.log('Loading inline content for document:', document.id, 'from API:', API_BASE_URL)

      const response = await fetch(`${API_BASE_URL}/api/documents/${document.id}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      console.log('Inline content response:', response.status, response.statusText)

      if (response.ok) {
        const text = await response.text()
        console.log('Loaded inline content, length:', text.length)
        setInlineContent(text)
      } else {
        const errorText = await response.text()
        console.error('Failed to load inline content:', response.status, errorText)
      }
    } catch (error) {
      console.error('Error loading inline content:', error)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setReuploadStatus('idle')
    }
  }

  const handleReupload = async () => {
    if (!selectedFile) return

    try {
      setReuploadStatus('idle')
      const formData = new FormData()
      formData.append('file', selectedFile)

      const token = localStorage.getItem('auth_token')
      if (!token) throw new Error('No auth token')

      const response = await fetch(`${API_BASE_URL}/api/documents/${document.id}/reupload`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })

      if (response.ok) {
        setReuploadStatus('success')
        setSelectedFile(null)
        // Refresh the document viewer
        setTimeout(() => {
          window.location.reload() // Simple refresh for now
        }, 1000)
      } else {
        throw new Error('Upload failed')
      }
    } catch (error) {
      console.error('Reupload error:', error)
      setReuploadStatus('error')
    }
  }

  const handleSaveMetadata = async (data: EditFormData) => {
    setSaving(true)
    setError(null)
    
    try {
      // Convert comma-separated strings back to arrays
      const processedData = {
        ...data,
        keywords: data.keywords
          ? JSON.stringify(
              data.keywords.split(',').map(k => k.trim()).filter(k => k)
            )
          : undefined,
        tags: data.tags
          ? JSON.stringify(
              data.tags.split(',').map(t => t.trim()).filter(t => t)
            )
          : undefined,
        expires_at: data.expires_at ? new Date(data.expires_at).toISOString() : undefined
      }

      await onSave(processedData)
      setActiveTab('view')
    } catch (error) {
      console.error('Error saving document:', error)
      setError('Failed to save document changes')
    } finally {
      setSaving(false)
    }
  }

  const saveInlineContent = async () => {
    try {
      const formData = new FormData()
      formData.append('content', inlineContent)

      const token = localStorage.getItem('auth_token')
      if (!token) throw new Error('No auth token')

      const response = await fetch(`${API_BASE_URL}/api/documents/${document.id}/content`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })

      if (response.ok) {
        setIsEditingContent(false)
        // Show success message or refresh document info
        console.log('Content saved successfully')
      } else {
        throw new Error('Failed to save content')
      }
    } catch (error) {
      console.error('Error saving inline content:', error)
      setError('Failed to save document content')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>{document?.title}</span>
            </div>
          </DialogTitle>
          <DialogDescription>
            Edit document metadata, content, and file
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="view" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              View
            </TabsTrigger>
            <TabsTrigger value="metadata" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Edit Metadata
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Edit Content
            </TabsTrigger>
            <TabsTrigger value="file" className="flex items-center gap-2">
              <FileUp className="h-4 w-4" />
              Replace File
            </TabsTrigger>
          </TabsList>

          {/* View Tab */}
          <TabsContent value="view" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Document Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Document Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <Label className="text-muted-foreground">Title</Label>
                    <p className="font-medium">{document.title}</p>
                  </div>
                  <div className="text-sm">
                    <Label className="text-muted-foreground">Description</Label>
                    <p>{document.description || 'No description'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Type</Label>
                      <p>{document.document_type.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <p>{document.status.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Access Level</Label>
                      <p>{document.access_level}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Category</Label>
                      <p>{document.category || 'Uncategorized'}</p>
                    </div>
                  </div>
                  {document.compliance_framework && (
                    <div className="text-sm">
                      <Label className="text-muted-foreground">Compliance Framework</Label>
                      <p>{document.compliance_framework}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Document Viewer */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Document Content</span>
                      <Button variant="outline" size="sm" onClick={onDownload}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DocumentViewer 
                      documentId={document.id}
                      filename={document.filename}
                      mimeType={document.mime_type}
                      showDownload={false}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Metadata Edit Tab */}
          <TabsContent value="metadata" className="space-y-4">
            <form onSubmit={handleSubmit(handleSaveMetadata)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        {...register('description')}
                        placeholder="Document description"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Document Type *</Label>
                        <Select
                          value={watch('document_type')}
                          onValueChange={(value) => setValue('document_type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {documentTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Status *</Label>
                        <Select
                          value={watch('status')}
                          onValueChange={(value) => setValue('status', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Access Level *</Label>
                        <Select
                          value={watch('access_level')}
                          onValueChange={(value) => setValue('access_level', value)}
                        >
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
                        <Label htmlFor="category">Category</Label>
                        <Input
                          id="category"
                          {...register('category')}
                          placeholder="e.g., HR Policies"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Additional Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="subcategory">Subcategory</Label>
                      <Input
                        id="subcategory"
                        {...register('subcategory')}
                        placeholder="e.g., Employee Handbook"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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

                    <div className="space-y-2">
                      <Label>Compliance Framework</Label>
                      <Select
                        value={watch('compliance_framework')}
                        onValueChange={(value) => setValue('compliance_framework', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select framework (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {complianceFrameworks.map((framework) => (
                            <SelectItem key={framework} value={framework}>
                              {framework}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="review_frequency_months">Review Frequency (months)</Label>
                        <Input
                          id="review_frequency_months"
                          type="number"
                          {...register('review_frequency_months', { valueAsNumber: true })}
                          placeholder="e.g., 12"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="retention_period_months">Retention Period (months)</Label>
                        <Input
                          id="retention_period_months"
                          type="number"
                          {...register('retention_period_months', { valueAsNumber: true })}
                          placeholder="e.g., 84"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expires_at">Expiration Date</Label>
                      <Input
                        id="expires_at"
                        type="date"
                        {...register('expires_at')}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end space-x-4">
                <Button type="button" variant="outline" onClick={() => setActiveTab('view')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Content Edit Tab */}
          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Inline Content Editor</span>
                  {isEditableFormat(document.mime_type) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingContent(!isEditingContent)}
                    >
                      {isEditingContent ? 'Preview' : 'Edit'}
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditableFormat(document.mime_type) ? (
                  <div className="space-y-4">
                    {isEditingContent ? (
                      <div className="space-y-4">
                        <Textarea
                          value={inlineContent}
                          onChange={(e) => setInlineContent(e.target.value)}
                          rows={20}
                          className="font-mono text-sm"
                          placeholder="Edit document content..."
                        />
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            onClick={() => setIsEditingContent(false)}
                          >
                            Cancel
                          </Button>
                          <Button onClick={saveInlineContent}>
                            <Save className="h-4 w-4 mr-2" />
                            Save Content
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-96">
                        {inlineContent}
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileImage className="h-12 w-12 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Inline editing not supported</h3>
                    <p>This file format ({document.mime_type}) cannot be edited inline.</p>
                    <p>Use the "Replace File" tab to upload a new version.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* File Replace Tab */}
          <TabsContent value="file" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Replace Document File</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-800">Current File</p>
                      <p className="text-blue-600">
                        {document.filename} ({formatFileSize(document.file_size)})
                      </p>
                      <p className="text-blue-600 mt-1">
                        Uploading a new file will replace the current document but preserve all metadata and version history.
                      </p>
                    </div>
                  </div>
                </div>

                {/* File Upload Area */}
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                  {!selectedFile ? (
                    <div className="text-center">
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                      <div className="space-y-2">
                        <Label htmlFor="file-reupload" className="cursor-pointer block">
                          <span className="text-primary font-medium">Click to upload</span>
                          <span className="text-muted-foreground"> or drag and drop</span>
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX (max 100MB)
                        </p>
                      </div>
                      <Input
                        id="file-reupload"
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
                        onClick={() => setSelectedFile(null)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {selectedFile && (
                  <div className="flex justify-end">
                    <Button onClick={handleReupload}>
                      <FileUp className="h-4 w-4 mr-2" />
                      Replace File
                    </Button>
                  </div>
                )}

                {reuploadStatus === 'success' && (
                  <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <p className="text-sm text-green-600">File replaced successfully!</p>
                  </div>
                )}

                {reuploadStatus === 'error' && (
                  <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <p className="text-sm text-red-600">Failed to replace file. Please try again.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between items-center">
          <div className="flex-1">
            {error && (
              <p className="text-sm text-red-600 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-1" />
                {error}
              </p>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}