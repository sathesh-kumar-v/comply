export type IncidentSeverity = "Low" | "Medium" | "High" | "Critical"
export type IncidentStatus = "Open" | "Under Investigation" | "Resolved" | "Closed"
export type IncidentPriority = "Low" | "Medium" | "High" | "Critical"

export type TrendDirection = "up" | "down" | "flat"

export interface SummaryTrend {
  direction: TrendDirection
  percentage: number
}

export interface SummaryMetric {
  value: number
  trend: SummaryTrend
}

export interface IncidentSummary {
  totalIncidents: SummaryMetric
  openIncidents: SummaryMetric
  resolvedThisMonth: SummaryMetric
  averageResolutionHours: SummaryMetric
  overdueIncidents: SummaryMetric
}

export interface IncidentTrendPoint {
  month: string
  incidents: number
  resolved: number
}

export interface IncidentCategorySlice {
  category: string
  count: number
}

export interface SeverityDistributionItem {
  severity: IncidentSeverity
  count: number
}

export interface DepartmentPerformanceItem {
  department: string
  averageResolutionHours: number
}

export interface IncidentAnalytics {
  incidentTrend: IncidentTrendPoint[]
  incidentCategories: IncidentCategorySlice[]
  severityDistribution: SeverityDistributionItem[]
  departmentPerformance: DepartmentPerformanceItem[]
}

export interface QuickActionDefinition {
  label: string
  intent: "report" | "mine" | "reporting" | "export"
  tone: "destructive" | "primary" | "success" | "secondary"
}

export interface IncidentForecastPoint {
  month: string
  incidents: number
}

export interface IncidentAIInsights {
  forecast: {
    forecast: IncidentForecastPoint[]
    rationale?: string
  }
  severityOutlook: {
    criticalShare: number
    highShare: number
  }
  recentCategorisations: Record<string, unknown>[]
}

export interface IncidentDashboardResponse {
  summary: IncidentSummary
  analytics: IncidentAnalytics
  quickActions: QuickActionDefinition[]
  aiInsights: IncidentAIInsights
}

export interface IncidentRecord {
  id: number
  referenceId: string
  title: string
  incidentType: string
  incidentCategory?: string | null
  department: string
  locationPath: string[]
  occurredAt: string
  reportedAt: string
  severity: IncidentSeverity
  status: IncidentStatus
  priority: IncidentPriority
  impactAssessment: string
  immediateActions?: string | null
  detailedDescription: string
  whatHappened: string
  rootCause?: string | null
  contributingFactors: string[]
  peopleInvolved: string[]
  witnesses: string[]
  equipmentInvolved?: string | null
  immediateNotification: string[]
  escalationPath: string[]
  externalNotifications: Record<string, boolean>
  publicDisclosureRequired: boolean
  targetResolutionDate?: string | null
  actualResolutionDate?: string | null
  aiSummary: Record<string, unknown>
  overdue: boolean
  createdAt: string
  updatedAt: string
}

export interface IncidentAttachmentRecord {
  id: number
  fileName: string
  description?: string | null
  uploadedAt: string
  mimeType?: string | null
  fileSize?: number | null
}

export interface IncidentActivityRecord {
  id: number
  timestamp: string
  activityType: string
  description?: string | null
  findings?: string | null
  followUpRequired: boolean
}

export interface IncidentRootCauseRecord {
  rcaMethod?: string | null
  primaryRootCause?: string | null
  factors: Array<{
    id: number
    description: string
    category: string
    impactLevel: IncidentSeverity
  }>
  rcaDiagram?: Record<string, unknown> | null
  rcaEvidence: Record<string, unknown>[]
}

export type IncidentDetail = Omit<IncidentRecord, "rootCause"> & {
  attachments: IncidentAttachmentRecord[]
  activities: IncidentActivityRecord[]
  // If detail might be missing, keep it nullable; otherwise drop `| null`.
  rootCause: IncidentRootCauseRecord | null
  aiInvestigation?: Record<string, unknown>
}

export interface IncidentListResponse {
  items: IncidentRecord[]
}

export interface IncidentIntakeAssessmentResponse {
  severity: {
    suggestedSeverity: IncidentSeverity
    confidence: number
  }
  categorisation: Record<string, unknown>
}

export interface IncidentFormPayload {
  title: string
  incidentType: string
  incidentCategory?: string | null
  department: string
  locationPath: string[]
  occurredAt: string
  severity: IncidentSeverity
  impactAssessment: string
  immediateActions?: string
  detailedDescription: string
  whatHappened: string
  rootCause?: string
  contributingFactors: string[]
  peopleInvolved: string[]
  witnesses: string[]
  equipmentInvolved?: string
  immediateNotification: string[]
  externalNotifications: Record<string, boolean>
  publicDisclosureRequired: boolean
}

export interface IncidentMetadataResponse {
  incidentTypes: string[]
  incidentCategories: Record<string, string[]>
  severityOptions: Array<{ value: IncidentSeverity; description: string }>
  locationHierarchy: Array<{
    label: string
    value: string
    children?: Array<{
      label: string
      value: string
      children?: Array<{ label: string; value: string }>
    }>
  }>
  activityTypes: string[]
  rcaMethods: string[]
  departments?: string[]
}
