export type AuditStatus = "Scheduled" | "In Progress" | "Completed"

export interface AuditSummary {
  id: string
  title: string
  audit_type: string
  departments: string[]
  status: AuditStatus
  risk_level: "Low" | "Medium" | "High" | "Critical" | string
  start_date: string
  end_date: string
  estimated_duration_hours: number
  lead_auditor: string
  progress: number
  audit_team: string[]
}

export interface DashboardInsights {
  scheduling_priority: string
  resource_hotspots: string[]
  duration_trend_hours: number
  notes: string[]
}

export interface PlanningDashboardResponse {
  audits: AuditSummary[]
  ai_insights: DashboardInsights
  legend: Record<string, string>
}

export interface TemplatesResponse {
  templates: string[]
}

export interface NotificationSettings {
  audit_announcement: boolean
  daily_reminders: boolean
  progress_updates: boolean
  completion_notifications: boolean
}

export interface NotificationTemplates {
  announcement_email?: string
  daily_reminder_email?: string
  completion_email?: string
}

export interface ChecklistQuestion {
  id?: string
  text: string
  type: string
  evidence_required: boolean
  scoring_weight?: number | null
  risk_impact?: string
  guidance_notes?: string
}

export interface ChecklistSection {
  id?: string
  title: string
  description?: string
  weight?: number | null
  required: boolean
  questions: ChecklistQuestion[]
}

export interface AuditCreatePayload {
  title: string
  audit_type: string
  departments: string[]
  risk_level: string
  start_date: string
  end_date: string
  audit_scope: string
  audit_objective: string
  compliance_frameworks: string[]
  lead_auditor: string
  audit_team: string[]
  auditee_contacts: string[]
  meeting_room?: string
  special_requirements?: string
  notification_settings: NotificationSettings
  notification_templates: NotificationTemplates
  checklist_sections: ChecklistSection[]
}

export interface BasicInfoAiResponse {
  suggested_scope: string
  suggested_objective: string
  suggested_frameworks: string[]
  predicted_risk_level: string
  notes: string[]
  raw?: string
}

export interface ScheduleAiResponse {
  estimated_duration_hours: number
  team_recommendations: string[]
  resource_conflicts: string[]
  meeting_room_suggestion: string
  timeline_notes: string[]
  raw?: string
}

export interface ChecklistAiResponse {
  sections: ChecklistSection[]
  risk_alignment_notes: string[]
  raw?: string
}

export interface CommunicationAiResponse {
  announcement_email: string
  daily_reminder_email: string
  completion_email: string
  distribution_insights: string[]
  raw?: string
}

export interface ReviewAiResponse {
  readiness_summary: string
  success_probability: number
  launch_recommendation: string
  follow_up_actions: string[]
  raw?: string
}
