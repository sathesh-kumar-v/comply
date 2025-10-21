import { buildApiUrl } from "@/lib/api-url"
import type {
  AuditCreatePayload,
  BasicInfoAiResponse,
  ChecklistAiResponse,
  CommunicationAiResponse,
  PlanningDashboardResponse,
  ReviewAiResponse,
  ScheduleAiResponse,
  TemplatesResponse,
} from "@/types/audit-builder"

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
  }
  return (await response.json()) as T
}

export async function fetchPlanningDashboard(): Promise<PlanningDashboardResponse> {
  const response = await fetch(buildApiUrl("/api/audit-builder/dashboard"), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  })
  return handleResponse<PlanningDashboardResponse>(response)
}

export async function fetchAuditTemplates(): Promise<string[]> {
  const response = await fetch(buildApiUrl("/api/audit-builder/templates"), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  })
  const data = await handleResponse<TemplatesResponse>(response)
  return data.templates
}

export async function createAuditPlan(payload: AuditCreatePayload) {
  const response = await fetch(buildApiUrl("/api/audit-builder/audits"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return handleResponse<{ audit: unknown }>(response)
}

export async function aiSuggestBasicInfo(payload: {
  audit_type: string
  departments?: string[]
  scope?: string
  objective?: string
  compliance_frameworks?: string[]
}): Promise<BasicInfoAiResponse> {
  const response = await fetch(buildApiUrl("/api/audit-builder/ai/basic-info"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return handleResponse<BasicInfoAiResponse>(response)
}

export async function aiSuggestSchedule(payload: {
  start_date?: string
  end_date?: string
  team?: string[]
  lead_auditor?: string
  departments?: string[]
  risk_level?: string
  existing_duration_hours?: number
}): Promise<ScheduleAiResponse> {
  const response = await fetch(buildApiUrl("/api/audit-builder/ai/schedule"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return handleResponse<ScheduleAiResponse>(response)
}

export async function aiSuggestChecklist(payload: {
  audit_type: string
  departments?: string[]
  compliance_frameworks?: string[]
  risk_level?: string
}): Promise<ChecklistAiResponse> {
  const response = await fetch(buildApiUrl("/api/audit-builder/ai/checklist"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return handleResponse<ChecklistAiResponse>(response)
}

export async function aiSuggestCommunications(payload: {
  audit_title: string
  recipients?: string[]
  include_daily_reminders?: boolean
}): Promise<CommunicationAiResponse> {
  const response = await fetch(buildApiUrl("/api/audit-builder/ai/communications"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return handleResponse<CommunicationAiResponse>(response)
}

export async function aiReviewLaunch(payload: {
  audit_title: string
  start_date?: string
  end_date?: string
  risk_level?: string
  team?: string[]
  notifications_enabled?: Record<string, boolean>
  duration_hours?: number
}): Promise<ReviewAiResponse> {
  const response = await fetch(buildApiUrl("/api/audit-builder/ai/review"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return handleResponse<ReviewAiResponse>(response)
}
