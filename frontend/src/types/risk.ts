export interface RiskCountryMapEntry {
  code: string
  name: string
  score: number
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' | 'No Data'
  trend: 'Improving' | 'Stable' | 'Deteriorating'
  confidence: 'Low' | 'Medium' | 'High'
  nextAssessment?: string
}

export interface RiskSummary {
  totalCountries: number
  highRiskCountries: number
  recentRiskChanges: number
  nextAssessmentDue?: string
}

export interface RiskDashboardData {
  generatedAt: string
  filters: {
    riskType: string
    dataSource: string
  }
  summary: RiskSummary
  map: {
    countries: RiskCountryMapEntry[]
    legend: Array<{ label: string; min: number; max: number; color: string }>
  }
  aiInsights: {
    trendHighlights: Array<{ country: string; trend: string; predictedChange: number; alerts: string[] }>
    regionalClusters: Record<string, { average_score: number; high_risk_ratio: number; improving_ratio: number }>
    watchlist: Array<{
      country: string
      riskLevel: string
      confidence: string
      signals: Record<string, number>
    }>
  }
  countryDetails: Array<{
    id: number
    countryCode: string
    countryName: string
    overallScore: number
    riskLevel: string
    trend: string
    confidence: string
    impactLevel?: string
    probabilityLevel?: string
    evidence?: string
    comments?: string
    nextAssessmentDue?: string
    updateSource: string
    lastUpdated?: string
    aiAlerts: string[]
    supportingSignals: Record<string, number>
    attachments: Array<Record<string, unknown>>
    recentChange?: number
    categories: Array<{
      id: number
      name: string
      score: number
      weight?: number
      aiSuggestion?: number
      volatility?: number
      trend?: string | null
    }>
  }>
}

export interface RiskAssessmentListItem {
  id: number
  title: string
  assessmentType: string
  status: string
  startDate: string
  endDate: string
  nextAssessmentDue?: string
  totalCountries: number
  highRiskCountries: number
  assignedAssessor: string
}

export interface RiskAssessmentCountryDetail {
  id: number
  countryCode: string
  countryName: string
  overallScore: number
  riskLevel: string
  trend: string
  confidence: string
  impactLevel?: string
  probabilityLevel?: string
  evidence?: string
  comments?: string
  nextAssessmentDue?: string
  updateSource: string
  lastUpdated?: string
  aiAlerts: string[]
  supportingSignals: Record<string, number>
  attachments: Array<Record<string, unknown>>
  recentChange?: number
  categories: Array<{
    id: number
    name: string
    score: number
    weight?: number
    aiSuggestion?: number
    volatility?: number
    trend?: string | null
  }>
}

export interface RiskAssessmentDetail {
  id: number
  title: string
  assessmentType: string
  framework?: string
  scoringScale: string
  updateFrequency: string
  dataSource: string
  startDate: string
  endDate: string
  assignedAssessor: string
  reviewTeam: string[]
  status: string
  categories: Array<{ key: string; label: string; weight: number }>
  impactLevels: Record<string, string>
  probabilityLevels: Record<string, string>
  aiRecommendations: Record<string, unknown>
  nextAssessmentDue?: string
  externalDataSources: Array<{ name: string; lastUpdated?: string }>
  countries: RiskAssessmentCountryDetail[]
}
