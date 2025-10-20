export type FMEAType =
  | 'Process FMEA (PFMEA)'
  | 'Design FMEA (DFMEA)'
  | 'System FMEA (SFMEA)'
  | 'Service FMEA'
  | 'Software FMEA'

export type FMEAStatus = 'Active' | 'Completed' | 'On Hold'

export type ActionStatus = 'Open' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled'

export interface FMEATeamMember {
  id: number
  user_id: number
  role?: string | null
}

export interface FMEARecord {
  id: number
  title: string
  fmea_type: FMEAType
  process_or_product_name: string
  description?: string | null
  departments?: string[] | null
  team_lead_id: number
  review_date: string
  standard?: string | null
  scope: string
  assumptions?: string | null
  severity_min: number
  severity_max: number
  occurrence_min: number
  occurrence_max: number
  detection_min: number
  detection_max: number
  status: FMEAStatus
  highest_rpn: number
  actions_count: number
  created_by_id: number
  created_at: string
  updated_at: string
  team_members: FMEATeamMember[]
}

export interface FMEADashboardSummary {
  total_fmeas: number
  high_rpn_items: number
  completed_actions: number
  overdue_actions: number
}

export interface FMEAItemRecord {
  id: number
  item_function: string
  failure_mode: string
  effects?: string | null
  severity: number
  causes?: string | null
  occurrence: number
  current_controls?: string | null
  detection: number
  rpn: number
  recommended_actions?: string | null
  responsibility_user_id?: number | null
  target_date?: string | null
  actions_taken?: string | null
  status: 'Open' | 'In Progress' | 'Completed'
  new_severity?: number | null
  new_occurrence?: number | null
  new_detection?: number | null
  new_rpn?: number | null
  created_at: string
  updated_at: string
}

export interface FMEAActionRecord {
  id: number
  title: string
  description?: string | null
  owner_user_id: number
  status: ActionStatus
  due_date?: string | null
  item_id?: number | null
}

export interface TeamOption {
  id: number
  full_name: string
  department?: string | null
  position?: string | null
}

export interface TemplateSuggestion {
  name: string
  focus: string
  description: string
  recommended_controls: string[]
}

export interface FMEAInitialValues {
  title?: string
  fmea_type?: FMEAType
  process_or_product_name?: string
  description?: string
  scope?: string
  assumptions?: string
  standard?: string
}

export interface TeamAIResponse {
  recommended_leads: { name: string; reason?: string | null }[]
  recommended_members: { name: string; role?: string | null; reason?: string | null }[]
  notes: string[]
}

export interface ScaleLevel {
  score: number
  label: string
  description: string
}

export interface ScaleAIResponse {
  severity_scale: ScaleLevel[]
  occurrence_scale: ScaleLevel[]
  detection_scale: ScaleLevel[]
  notes: string[]
}

export interface ScopeAIResponse {
  scope: string
  objectives: string[]
  assumptions: string[]
}

export interface FailureModeInsight {
  item_function: string
  failure_mode: string
  effects: string
  causes: string
  controls: string
  severity?: number
  occurrence?: number
  detection?: number
}

export interface RPNAlertInsight {
  threshold: number
  alerts: string[]
  summary: string
}

export interface CauseEffectInsight {
  insights: string[]
  recommended_controls: string[]
}

export interface ControlEffectivenessInsight {
  item_reference: string
  effectiveness: string
  recommendation: string
}

export interface RPNForecastInsight {
  item_reference: string
  current_rpn?: number | null
  projected_rpn?: number | null
  recommendation: string
}
