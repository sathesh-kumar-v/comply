"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Eye,
  Download,
  Users,
  Calendar,
  BarChart3,
  PieChart
} from 'lucide-react'

interface DocumentStatsData {
  total_documents: number
  by_type: Record<string, number>
  by_status: Record<string, number>
  by_access_level: Record<string, number>
  documents_needing_review: number
  expired_documents: number
  recent_uploads: number
}

interface DocumentStatsProps {
  detailed?: boolean
}

export function DocumentStats({ detailed = false }: DocumentStatsProps) {
  const [stats, setStats] = useState<DocumentStatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        console.error('No authentication token found')
        return
      }
      
      const response = await fetch(`${API_BASE_URL}/api/documents/stats/overview`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        console.error('Failed to fetch document stats')
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-20"></div>
                <div className="h-8 bg-muted rounded w-16"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Unable to load statistics</p>
        </CardContent>
      </Card>
    )
  }

  const formatLabel = (key: string) => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'published': return 'bg-green-100 text-green-800'
      case 'approved': return 'bg-blue-100 text-blue-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'under_review': case 'under review': return 'bg-yellow-100 text-yellow-800'
      case 'expired': return 'bg-red-100 text-red-800'
      case 'archived': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'policy': return 'bg-blue-100 text-blue-800'
      case 'procedure': return 'bg-green-100 text-green-800'
      case 'form': return 'bg-yellow-100 text-yellow-800'
      case 'report': return 'bg-purple-100 text-purple-800'
      case 'manual': return 'bg-indigo-100 text-indigo-800'
      case 'certificate': return 'bg-pink-100 text-pink-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getAccessLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'public': return 'bg-green-100 text-green-800'
      case 'internal': return 'bg-blue-100 text-blue-800'
      case 'confidential': return 'bg-orange-100 text-orange-800'
      case 'restricted': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Documents</p>
                <p className="text-xl sm:text-3xl font-bold">{stats.total_documents}</p>
              </div>
              <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Need Review</p>
                <p className="text-xl sm:text-3xl font-bold text-amber-600">{stats.documents_needing_review}</p>
              </div>
              <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Expired</p>
                <p className="text-xl sm:text-3xl font-bold text-red-600">{stats.expired_documents}</p>
              </div>
              <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Recent Uploads</p>
                <p className="text-xl sm:text-3xl font-bold text-green-600">{stats.recent_uploads}</p>
                <p className="text-xs text-muted-foreground">Last 7 days</p>
              </div>
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      {detailed && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* By Document Type */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                By Document Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(stats.by_type).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <Badge className={getTypeColor(type)} variant="secondary">
                      {formatLabel(type)}
                    </Badge>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* By Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                By Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(stats.by_status).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <Badge className={getStatusColor(status)} variant="secondary">
                      {formatLabel(status)}
                    </Badge>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* By Access Level */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                By Access Level
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(stats.by_access_level).map(([level, count]) => (
                  <div key={level} className="flex items-center justify-between">
                    <Badge className={getAccessLevelColor(level)} variant="secondary">
                      {formatLabel(level)}
                    </Badge>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Items (if not detailed view) */}
      {!detailed && (stats.documents_needing_review > 0 || stats.expired_documents > 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-amber-700">
              {stats.documents_needing_review > 0 && (
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{stats.documents_needing_review} documents need review</span>
                </p>
              )}
              {stats.expired_documents > 0 && (
                <p className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{stats.expired_documents} documents have expired</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}