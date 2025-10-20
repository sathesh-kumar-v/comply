// const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://comply-x.onrender.com'
import { api } from "./api";

export interface DocumentStats {
  total_documents: number
  by_type: Record<string, number>
  by_status: Record<string, number>
  by_access_level: Record<string, number>
  documents_needing_review: number
  expired_documents: number
  recent_uploads: number
}

export interface AssignmentStats {
  total_assignments: number
  pending: number
  completed: number
  overdue: number
}

export interface DepartmentAssignmentStats {
  department: string
  total: number
  completed: number
  pending: number
  completion_rate: number
}

export interface ComplianceStats {
  overall_score: number
  incidents_count: number
  users_count: number
}

export interface DashboardData {
  documents: DocumentStats
  assignments?: AssignmentStats
  departmentAssignments?: DepartmentAssignmentStats[]
  compliance?: ComplianceStats
}

/**
 * Get authentication token from localStorage
 */
// function getToken(): string | null {
//   if (typeof window === 'undefined') return null
//   return localStorage.getItem('auth_token')
// }

/**
 * Fetch document statistics from the backend
 */
export async function fetchDocumentStats(): Promise<DocumentStats> {
  // const token = getToken()
  // if (!token) {
  //   throw new Error('No authentication token found')
  // }

  // const response = await fetch(`${API_BASE_URL}/api/documents/stats/overview`, {
  //   headers: {
  //     'Authorization': `Bearer ${token}`,
  //     'Content-Type': 'application/json',
  //   },
  // })

  // if (!response.ok) {
  //   throw new Error(`Failed to fetch document stats: ${response.statusText}`)
  // }

  // return response.json()
  return api<DocumentStats>("/api/documents/stats/overview")
}

/**
 * Fetch assignment statistics
 */
export async function fetchAssignmentStats(): Promise<AssignmentStats> {
  // const token = getToken()
  // if (!token) {
  //   throw new Error('No authentication token found')
  // }

  try {
    // const response = await fetch(`${API_BASE_URL}/api/document-assignments/assignments/stats`, {
    //   headers: {
    //     'Authorization': `Bearer ${token}`,
    //     'Content-Type': 'application/json',
    //   },
    // })

    // if (response.ok) {
    //   const data = await response.json()
    //   return {
    //     total_assignments: data.total_assignments || 0,
    //     pending: data.pending_assignments || 0,
    //     completed: data.completed_assignments || 0,
    //     overdue: data.overdue_assignments || 0,
    //   }
    const data = await api<any>(
      "/api/document-assignments/assignments/stats"
    )
    return {
      total_assignments: data.total_assignments || 0,
      pending: data.pending_assignments || 0,
      completed: data.completed_assignments || 0,
      overdue: data.overdue_assignments || 0,
    }
  } catch (error) {
    console.log('Assignment stats not available, using fallback data')
  }

  // Fallback to empty data if endpoint not available
  return {
    total_assignments: 0,
    pending: 0,
    completed: 0,
    overdue: 0,
  }
}

/**
 * Fetch department assignment statistics
 */
export async function fetchDepartmentAssignmentStats(): Promise<DepartmentAssignmentStats[]> {
  // const token = getToken()
  // if (!token) {
  //   throw new Error('No authentication token found')
  // }

  try {
    // const response = await fetch(`${API_BASE_URL}/api/document-assignments/assignments/stats/departments`, {
    //   headers: {
    //     'Authorization': `Bearer ${token}`,
    //     'Content-Type': 'application/json',
    //   },
    // })

    // if (response.ok) {
    //   const data = await response.json()
    //   return data.departments || []
    // }
    const data = await api<{ departments?: DepartmentAssignmentStats[] }>(
      "/api/document-assignments/assignments/stats/departments"
    )
    return data.departments || []
  } catch (error) {
    console.log('Department assignment stats not available')
  }

  // Return empty array if endpoint not available
  return []
}

/**
 * Fetch all dashboard data
 */
export async function fetchDashboardData(): Promise<DashboardData> {
  const [documents, assignments, departmentAssignments] = await Promise.all([
    fetchDocumentStats(),
    fetchAssignmentStats(),
    fetchDepartmentAssignmentStats()
  ])
  
  // Calculate basic compliance metrics based on documents
  const totalDocs = documents.total_documents
  const publishedDocs = documents.by_status['published'] || 0
  const expiredDocs = documents.expired_documents
  const needsReview = documents.documents_needing_review
  
  // Calculate compliance score: published docs are good, expired/needs review are bad
  let complianceScore = 0
  if (totalDocs > 0) {
    const goodDocs = publishedDocs
    const badDocs = expiredDocs + needsReview
    complianceScore = Math.max(0, Math.min(100, ((goodDocs / totalDocs) * 100) - (badDocs * 5)))
  }

  const compliance: ComplianceStats = {
    overall_score: Math.round(complianceScore),
    incidents_count: expiredDocs + needsReview, // Use expired + needs review as incident count
    users_count: 0, // TODO: Add user count endpoint
  }

  return {
    documents,
    assignments,
    departmentAssignments,
    compliance,
  }
}

/**
 * Transform document status data for chart display
 */
export function transformDocumentStatusForChart(byStatus: Record<string, number>) {
  const colorMap: Record<string, string> = {
    'published': '#22c55e',
    'under_review': '#f59e0b',
    'draft': '#6b7280',
    'expired': '#ef4444',
    'approved': '#3b82f6',
    'archived': '#8b5cf6',
  }

  return Object.entries(byStatus).map(([status, count]) => ({
    name: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: count,
    color: colorMap[status] || '#6b7280',
  }))
}

/**
 * Calculate document trends
 */
export function calculateDocumentTrends(current: DocumentStats, previous?: DocumentStats) {
  if (!previous) {
    return {
      totalChange: '+' + current.total_documents,
      totalTrend: 'up' as const,
      reviewChange: '+' + current.documents_needing_review,
      reviewTrend: current.documents_needing_review > 0 ? 'up' as const : 'neutral' as const,
      expiredChange: current.expired_documents > 0 ? '+' + current.expired_documents : '0',
      expiredTrend: current.expired_documents > 0 ? 'up' as const : 'neutral' as const,
    }
  }

  const totalChange = current.total_documents - previous.total_documents
  const reviewChange = current.documents_needing_review - previous.documents_needing_review
  const expiredChange = current.expired_documents - previous.expired_documents

  return {
    totalChange: totalChange >= 0 ? `+${totalChange}` : `${totalChange}`,
    totalTrend: totalChange > 0 ? 'up' as const : totalChange < 0 ? 'down' as const : 'neutral' as const,
    reviewChange: reviewChange >= 0 ? `+${reviewChange}` : `${reviewChange}`,
    reviewTrend: reviewChange > 0 ? 'up' as const : reviewChange < 0 ? 'down' as const : 'neutral' as const,
    expiredChange: expiredChange >= 0 ? `+${expiredChange}` : `${expiredChange}`,
    expiredTrend: expiredChange > 0 ? 'up' as const : expiredChange < 0 ? 'down' as const : 'neutral' as const,
  }
}