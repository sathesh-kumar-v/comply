export type ActionPriority = 'Low' | 'Medium' | 'High' | 'Critical'
export type ActionStatus = 'Open' | 'In Progress' | 'Completed' | 'Closed' | 'Cancelled'
export type StepStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Delayed'

export interface CorrectiveActionSummaryMetric {
  value: number
  trend: number
  direction: 'up' | 'down' | 'flat'
}

export interface CorrectiveActionSummary {
  totalActions: CorrectiveActionSummaryMetric
  openActions: CorrectiveActionSummaryMetric
  overdueActions: CorrectiveActionSummaryMetric
  completedThisMonth: CorrectiveActionSummaryMetric
  effectivenessRating: CorrectiveActionSummaryMetric
}

export interface CorrectiveActionListEntry {
  id: string
  title: string
  type: string
  source?: string
  departments: string[]
  priority: ActionPriority
  impact: ActionPriority
  urgency: ActionPriority
  status: ActionStatus
  owner: string
  dueDate?: string | null
  progress: number
  effectivenessScore?: number
  priorityScore?: number
}

export interface StatusDistributionDatum {
  status: string
  count: number
}

export interface DepartmentDistributionDatum {
  department: string
  open: number
  inProgress: number
  completed: number
  overdue: number
}

export interface ActionTypeDistributionDatum {
  type: string
  count: number
}

export interface CompletionTrendDatum {
  period: string
  completed: number
  overdue: number
  forecast: number
}

export interface CorrectiveActionAnalytics {
  statusDistribution: StatusDistributionDatum[]
  actionsByDepartment: DepartmentDistributionDatum[]
  actionTypeDistribution: ActionTypeDistributionDatum[]
  completionTrend: CompletionTrendDatum[]
}

export interface PriorityListsResponse {
  highPriority: CorrectiveActionListEntry[]
  overdue: CorrectiveActionListEntry[]
  dueThisWeek: CorrectiveActionListEntry[]
  recentlyCompleted: CorrectiveActionListEntry[]
}

export interface EffectivenessInsight {
  actionId: string
  title: string
  score: number
  confidence: 'Low' | 'Medium' | 'High'
  drivers: string[]
}

export interface PriorityRankingInsight {
  actionId: string
  title: string
  priorityScore: number
  suggestedPriority: ActionPriority
  riskImpact: ActionPriority
  overdueDays: number
}

export interface ResourceRecommendationInsight {
  actionId: string
  title: string
  recommendations: string[]
}

export interface EscalationInsight {
  actionId: string
  title: string
  trigger: string
  escalationPath: string[]
}

export interface CorrectiveActionAIInsights {
  effectivenessScores: EffectivenessInsight[]
  priorityRanking: PriorityRankingInsight[]
  resourceRecommendations: ResourceRecommendationInsight[]
  escalationPaths: EscalationInsight[]
}

export interface CorrectiveActionDashboardResponse {
  summary: CorrectiveActionSummary
  analytics: CorrectiveActionAnalytics
  priorityLists: PriorityListsResponse
  actions: CorrectiveActionListEntry[]
  aiInsights: CorrectiveActionAIInsights
}

export interface ImplementationStepDetail {
  id: string
  stepNumber: number
  description: string
  responsiblePerson: string
  dueDate?: string | null
  status: StepStatus
  resourcesRequired?: string | null
  successCriteria?: string | null
  progressNotes?: string | null
  completionDate?: string | null
  evidence?: Array<{ name: string; url?: string }>
  issues?: string | null
}

export interface CommunicationLogEntry {
  id: string
  timestamp: string
  updateType: string
  user: string
  description: string
  attachments?: Array<{ name: string; url?: string }>
}

export interface SuccessMetricDetail {
  name: string
  targetValue: string
  actualValue?: string | null
  measurementMethod: string
  measurementDate?: string | null
}

export interface EffectivenessEvaluationDetail {
  evaluationDueDate: string
  evaluationMethod: string
  successMetrics: SuccessMetricDetail[]
  rating: string
  comments?: string | null
  furtherActionsRequired: boolean
  followUpActions?: string | null
}

export interface ActionAIIntelligence {
  effectivenessScore: number
  successProbability: number
  predictedCompletionDate?: string | null
  progressConfidence: number
  riskAlerts: string[]
  resourceRecommendations: string[]
  escalationPath: string[]
  automatedTracking: string
  riskAssessment: string
  effectivenessReview: string
  completionForecast: string
}

export interface CorrectiveActionDetail {
  id: string
  title: string
  status: ActionStatus
  type: string
  priority: ActionPriority
  impact: ActionPriority
  urgency: ActionPriority
  owner: string
  reviewTeam: string[]
  departments: string[]
  source?: string
  referenceId?: string
  progress: number
  dueDate?: string | null
  daysToDueDate?: number | null
  lastUpdated?: string | null
  problemStatement: string
  rootCause: string
  contributingFactors?: string | null
  impactAssessment: string
  currentControls?: string | null
  evidence: Array<{ name: string; url?: string; type?: string }>
  implementationSteps: ImplementationStepDetail[]
  communicationLog: CommunicationLogEntry[]
  effectivenessEvaluation: EffectivenessEvaluationDetail
  aiIntelligence: ActionAIIntelligence
}

export interface AiPlanStep {
  title: string
  description: string
  ownerRole: string
  suggestedDurationDays: number
  resources: string
  successCriteria: string
  dependencies?: string[]
}

export interface AiPlanTimelineMilestone {
  name: string
  targetDate: string
}

export interface AiPlanResponse {
  actionNarrative: string
  steps: AiPlanStep[]
  timeline: {
    overallDurationDays: number
    targetCompletionDate: string
    milestones: AiPlanTimelineMilestone[]
  }
  resourcePlan: {
    roles: string[]
    tools: string[]
    budgetEstimate: number
    notes: string
  }
  successProbability: number
  riskConsiderations: string[]
}
