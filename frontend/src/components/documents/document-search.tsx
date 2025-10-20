"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Filter, X, Calendar, Sparkles, Loader2 } from 'lucide-react'

interface DocumentAISearchPlan {
  refined_query?: string
  keywords: string[]
  document_types: string[]
  statuses: string[]
  access_levels: string[]
  priority?: string
  reasoning?: string
  raw?: string
}

interface DocumentAISearchPayload {
  plan: DocumentAISearchPlan
  documents: any[]
  totalCount: number
  totalPages: number
  query: string
}

interface DocumentSearchParams {
  query?: string
  document_type?: string
  status?: string
  access_level?: string
  category?: string
  created_by?: number
  created_after?: string
  created_before?: string
  expires_before?: string
  needs_review?: boolean
  page?: number
  size?: number
  sort_by?: string
  sort_order?: string
}

interface DocumentSearchProps {
  onSearch: (params: DocumentSearchParams) => void
  searchParams: DocumentSearchParams
  advanced?: boolean
  onAISearch?: (result: DocumentAISearchPayload) => void
  onAIStart?: () => void
  onAIEnd?: () => void
}

export function DocumentSearch({ onSearch, searchParams, advanced = false, onAISearch, onAIStart, onAIEnd }: DocumentSearchProps) {
  const [localParams, setLocalParams] = useState<DocumentSearchParams>(searchParams)
  const [showAdvanced, setShowAdvanced] = useState(advanced)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

  const documentTypes = [
    { value: 'all', label: 'All Types' },
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
    { value: 'all', label: 'All Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' },
    { value: 'expired', label: 'Expired' }
  ]

  const accessLevels = [
    { value: 'all', label: 'All Access Levels' },
    { value: 'public', label: 'Public' },
    { value: 'internal', label: 'Internal' },
    { value: 'confidential', label: 'Confidential' },
    { value: 'restricted', label: 'Restricted' }
  ]

  const sortOptions = [
    { value: 'created_at', label: 'Date Created' },
    { value: 'updated_at', label: 'Date Modified' },
    { value: 'title', label: 'Title' },
    { value: 'document_type', label: 'Document Type' },
    { value: 'status', label: 'Status' },
    { value: 'file_size', label: 'File Size' }
  ]

  useEffect(() => {
    setLocalParams(searchParams)
  }, [searchParams])

  const handleParamChange = (key: string, value: string | boolean | undefined) => {
    // Convert 'all' values to undefined for filtering
    const processedValue = value === 'all' ? undefined : value
    setLocalParams(prev => ({ ...prev, [key]: processedValue }))
  }

  const handleSearch = () => {
    // Remove empty values and format dates
    const cleanParams = Object.entries(localParams).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        // Format date fields if they're date strings
        if ((key.includes('created_') || key.includes('expires_')) && typeof value === 'string' && value.includes('-')) {
          // Ensure the date is in ISO format
          try {
            const date = new Date(value)
            acc[key] = date.toISOString().split('T')[0]
          } catch (e) {
            acc[key] = value
          }
        } else {
          acc[key] = value
        }
      }
      return acc
    }, {} as any)

    onSearch(cleanParams)
    setAiError(null)
  }

  const handleReset = () => {
    const resetParams = {
      page: 1,
      size: 20,
      sort_by: 'created_at',
      sort_order: 'desc'
    }
    setLocalParams(resetParams)
    onSearch(resetParams)
    setAiError(null)
  }

  const hasActiveFilters = () => {
    return Object.keys(localParams).some(key => {
      if (['page', 'size', 'sort_by', 'sort_order'].includes(key)) return false
      return localParams[key as keyof DocumentSearchParams] !== undefined && 
             localParams[key as keyof DocumentSearchParams] !== null && 
             localParams[key as keyof DocumentSearchParams] !== ''
    })
  }

  const handleAISearch = async () => {
    if (!localParams.query) {
      setAiError('Enter a natural language query before running AI search')
      return
    }

    if (!onAISearch) {
      handleSearch()
      return
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    if (!token) {
      setAiError('Authentication required for AI search')
      return
    }

    setAiLoading(true)
    setAiError(null)
    onAIStart?.()

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/ai/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: localParams.query,
          page: localParams.page ?? 1,
          size: localParams.size ?? 20
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'AI search failed')
      }

      const data = await response.json()
      onAISearch({
        plan: data.plan,
        documents: data.results,
        totalCount: data.total_count,
        totalPages: data.total_pages,
        query: localParams.query || ''
      })
    } catch (error) {
      console.error('AI search error:', error)
      setAiError(error instanceof Error ? error.message : 'AI search unavailable')
    } finally {
      setAiLoading(false)
      onAIEnd?.()
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Quick Search */}
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search documents..."
              value={localParams.query || ''}
              onChange={(e) => handleParamChange('query', e.target.value)}
              className="pl-9"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters() && (
              <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                {Object.keys(localParams).filter(key =>
                  !['page', 'size', 'sort_by', 'sort_order'].includes(key) &&
                  localParams[key as keyof DocumentSearchParams] !== undefined &&
                  localParams[key as keyof DocumentSearchParams] !== null &&
                  localParams[key as keyof DocumentSearchParams] !== ''
                ).length}
              </span>
            )}
          </Button>

          <Button onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>

          <Button type="button" variant="secondary" onClick={handleAISearch} disabled={aiLoading}>
            {aiLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                AI Searching
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Ask AI
              </>
            )}
          </Button>
        </div>

        {aiError && (
          <p className="text-sm text-destructive">{aiError}</p>
        )}

        {/* Advanced Filters */}
        {(showAdvanced || advanced) && (
          <div className="space-y-4 border-t pt-4">
            {/* Filter Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select 
                  value={localParams.document_type || 'all'} 
                  onValueChange={(value) => handleParamChange('document_type', value)}
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
                <Label>Status</Label>
                <Select 
                  value={localParams.status || 'all'} 
                  onValueChange={(value) => handleParamChange('status', value)}
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

              <div className="space-y-2">
                <Label>Access Level</Label>
                <Select 
                  value={localParams.access_level || 'all'} 
                  onValueChange={(value) => handleParamChange('access_level', value)}
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
            </div>

            {/* Filter Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  placeholder="e.g., HR Policies"
                  value={localParams.category || ''}
                  onChange={(e) => handleParamChange('category', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Created After</Label>
                <Input
                  type="date"
                  value={localParams.created_after || ''}
                  onChange={(e) => handleParamChange('created_after', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Created Before</Label>
                <Input
                  type="date"
                  value={localParams.created_before || ''}
                  onChange={(e) => handleParamChange('created_before', e.target.value)}
                />
              </div>
            </div>

            {/* Filter Row 3 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Sort By</Label>
                <Select 
                  value={localParams.sort_by || 'created_at'} 
                  onValueChange={(value) => handleParamChange('sort_by', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Select 
                  value={localParams.sort_order || 'desc'} 
                  onValueChange={(value) => handleParamChange('sort_order', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Newest First</SelectItem>
                    <SelectItem value="asc">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Special Filters</Label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={localParams.needs_review || false}
                      onChange={(e) => handleParamChange('needs_review', e.target.checked || undefined)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Needs Review</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="flex items-center space-x-2">
                {hasActiveFilters() && (
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </div>
              
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setShowAdvanced(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSearch}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}