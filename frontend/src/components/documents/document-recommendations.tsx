"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'

interface DocumentSummary {
  id: number
  title: string
  document_type: string
  status: string
  access_level: string
  category?: string
  updated_at?: string
}

interface RecommendationEntry {
  id: number
  title: string
  reason?: string
  priority?: string
}

interface RecommendationResponse {
  recommendations?: RecommendationEntry[]
  documents?: DocumentSummary[]
  summary?: string | null
}

export function DocumentRecommendations() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationEntry[]>([])
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [summary, setSummary] = useState<string | null>(null)

  const fetchRecommendations = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    if (!token) {
      setError('Authentication required to load recommendations')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await api<RecommendationResponse>('/documents/ai/recommendations')
      setRecommendations(data.recommendations || [])
      setDocuments(data.documents || [])
      setSummary(data.summary ?? null)
    } catch (error) {
      console.error('Recommendation error:', error)
      setError(error instanceof Error ? error.message : 'Unable to load recommendations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getDocumentDetails = (id: number) => {
    return documents.find((doc) => doc.id === id)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-base sm:text-lg">AI Recommendations</CardTitle>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchRecommendations} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="sr-only">Refresh recommendations</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {summary && <p className="text-sm text-muted-foreground">{summary}</p>}

        {loading && !recommendations.length ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Generating personalised suggestions...
          </div>
        ) : null}

        {!loading && recommendations.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">No personalised suggestions yet. Upload or review more documents to train recommendations.</p>
        )}

        <div className="space-y-2">
          {recommendations.map((item) => {
            const doc = getDocumentDetails(item.id)
            return (
              <div key={item.id} className="rounded border p-3 bg-muted/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-sm sm:text-base">{item.title || doc?.title || 'Document'}</p>
                  <div className="flex items-center gap-2">
                    {doc?.document_type && <Badge variant="outline">{doc.document_type}</Badge>}
                    {doc?.status && <Badge variant="secondary">{doc.status}</Badge>}
                    {item.priority && <Badge className="capitalize">{item.priority}</Badge>}
                  </div>
                </div>
                {item.reason && <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>}
                {doc?.updated_at && (
                  <p className="text-[11px] text-muted-foreground mt-1">Last updated {new Date(doc.updated_at).toLocaleDateString()}</p>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

