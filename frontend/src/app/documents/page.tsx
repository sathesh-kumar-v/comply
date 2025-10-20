"use client"

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { DocumentsList } from '@/components/documents/documents-list'
import { DocumentUpload } from '@/components/documents/document-upload'
import { DocumentSearch } from '@/components/documents/document-search'
import { DocumentStats } from '@/components/documents/document-stats'
import { DocumentRecommendations } from '@/components/documents/document-recommendations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FileText,
  Upload,
  Search,
  BarChart3,
  Filter,
  Plus,
  Sparkles
} from 'lucide-react'

interface Document {
  id: number
  title: string
  document_type: string
  status: string
  access_level: string
  category?: string
  filename: string
  file_size: number
  version: string
  created_by_id: number
  created_at: string
  updated_at: string
  next_review_date?: string
}

interface DocumentSearchParams {
  query?: string
  document_type?: string
  status?: string
  access_level?: string
  category?: string
  page?: number
  size?: number
  sort_by?: string
  sort_order?: string
}

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

interface AISearchState {
  plan: DocumentAISearchPlan | null
  query: string | null
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [searchParams, setSearchParams] = useState<DocumentSearchParams>({
    page: 1,
    size: 20,
    sort_by: 'created_at',
    sort_order: 'desc'
  })
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [aiSearchState, setAiSearchState] = useState<AISearchState>({ plan: null, query: null })
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://comply-x.onrender.com";

    if (!API_BASE_URL) {
      console.error("❌ NEXT_PUBLIC_API_URL is not defined. Please set it in your environment variables.");
    }
  const fetchDocuments = async (params: DocumentSearchParams = searchParams) => {
    try {
      setLoading(true)
      const queryString = new URLSearchParams()
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryString.append(key, value.toString())
        }
      })

      const token = localStorage.getItem('auth_token')
      if (!token) {
        console.error('No authentication token found')
        return
      }
      
      const response = await fetch(`${API_BASE_URL}/api/documents/search?${queryString}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents)
        setTotalCount(data.total_count)
        setTotalPages(data.total_pages)
        setAiSearchState({ plan: null, query: null })
      } else {
        console.error('Failed to fetch documents')
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (newSearchParams: DocumentSearchParams) => {
    const updatedParams = { ...searchParams, ...newSearchParams, page: 1 }
    setSearchParams(updatedParams)
    fetchDocuments(updatedParams)
  }

  const fetchAISearchPage = async (page: number) => {
    if (!aiSearchState.query) {
      return
    }

    try {
      setLoading(true)
      const token = localStorage.getItem('auth_token')
      if (!token) {
        console.error('No authentication token found')
        return
      }

      const response = await fetch(`${API_BASE_URL}/api/documents/ai/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: aiSearchState.query,
          page,
          size: searchParams.size ?? 20
        })
      })

      if (response.ok) {
        const data = await response.json()
        setDocuments(data.results)
        setTotalCount(data.total_count)
        setTotalPages(data.total_pages)
      } else {
        console.error('Failed to fetch AI search results')
      }
    } catch (error) {
      console.error('AI search pagination error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (page: number) => {
    const updatedParams = { ...searchParams, page }
    setSearchParams(updatedParams)
    if (aiSearchState.plan) {
      fetchAISearchPage(page)
    } else {
      fetchDocuments(updatedParams)
    }
  }

  const handleAISearchResult = (result: { plan: DocumentAISearchPlan; documents: Document[]; totalCount: number; totalPages: number; query: string }) => {
    setDocuments(result.documents)
    setTotalCount(result.totalCount)
    setTotalPages(result.totalPages)
    setLoading(false)
    setAiSearchState({ plan: result.plan, query: result.query })
    setSearchParams(prev => ({ ...prev, page: 1, query: result.query }))
  }

  const clearAISearch = () => {
    setAiSearchState({ plan: null, query: null })
    const resetParams = { ...searchParams, page: 1 }
    setSearchParams(resetParams)
    fetchDocuments(resetParams)
  }

  const handleUploadSuccess = () => {
    setShowUpload(false)
    fetchDocuments() // Refresh the list
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Document Management</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage and organize your compliance documents
            </p>
          </div>
          <Button 
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Upload Document
          </Button>
        </div>

        {/* Stats Overview */}
        <DocumentStats />

        <DocumentRecommendations />

        {/* Main Content */}
        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1">
            <TabsTrigger value="documents" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline sm:inline">Documents</span>
              <span className="xs:hidden sm:hidden">Docs</span>
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Search className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline sm:inline">Advanced Search</span>
              <span className="xs:hidden sm:hidden">Search</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline sm:inline">Upload</span>
              <span className="xs:hidden sm:hidden">Up</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline sm:inline">Analytics</span>
              <span className="xs:hidden sm:hidden">Stats</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <CardTitle className="text-lg sm:text-xl">All Documents</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{totalCount} documents</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {aiSearchState.plan && (
                  <div className="mb-4 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 p-4 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI search understanding
                      </div>
                      <Button variant="ghost" size="sm" onClick={clearAISearch}>
                        Reset
                      </Button>
                    </div>
                    {aiSearchState.plan.refined_query && (
                      <p className="text-sm text-muted-foreground">
                        Refined query: {aiSearchState.plan.refined_query}
                      </p>
                    )}
                    {aiSearchState.plan.reasoning && (
                      <p className="text-sm text-muted-foreground">{aiSearchState.plan.reasoning}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {aiSearchState.plan.keywords?.length > 0 && (
                        <span>Keywords: {aiSearchState.plan.keywords.join(', ')}</span>
                      )}
                      {aiSearchState.plan.document_types?.length > 0 && (
                        <span>Types: {aiSearchState.plan.document_types.join(', ')}</span>
                      )}
                      {aiSearchState.plan.statuses?.length > 0 && (
                        <span>Status focus: {aiSearchState.plan.statuses.join(', ')}</span>
                      )}
                      {aiSearchState.plan.access_levels?.length > 0 && (
                        <span>Access levels: {aiSearchState.plan.access_levels.join(', ')}</span>
                      )}
                    </div>
                  </div>
                )}
                {/* Quick Search */}
                <div className="mb-4">
                  <DocumentSearch
                    onSearch={handleSearch}
                    searchParams={searchParams}
                    onAISearch={handleAISearchResult}
                    onAIStart={() => setLoading(true)}
                    onAIEnd={() => setLoading(false)}
                  />
                </div>

                {/* Documents List */}
                <DocumentsList
                  documents={documents}
                  loading={loading}
                  onRefresh={() => fetchDocuments()}
                  currentPage={searchParams.page || 1}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Document Search</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentSearch 
                  onSearch={handleSearch}
                  searchParams={searchParams}
                  advanced={true}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload New Document</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentUpload onUploadSuccess={handleUploadSuccess} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Document Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentStats detailed={true} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Upload Modal/Dialog */}
        {showUpload && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <CardTitle className="text-lg sm:text-xl">Upload Document</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowUpload(false)}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <DocumentUpload onUploadSuccess={handleUploadSuccess} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}