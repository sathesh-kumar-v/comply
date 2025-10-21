import { api } from "./api"
import {
  IncidentDashboardResponse,
  IncidentDetail,
  IncidentFormPayload,
  IncidentIntakeAssessmentResponse,
  IncidentListResponse,
  IncidentMetadataResponse,
  IncidentRecord,
} from "@/types/incidents"

export async function fetchIncidentDashboard(): Promise<IncidentDashboardResponse> {
  return api<IncidentDashboardResponse>("/api/incidents/dashboard")
}

export async function fetchIncidentMetadata(): Promise<IncidentMetadataResponse> {
  return api<IncidentMetadataResponse>("/api/incidents/metadata")
}

export async function fetchIncidentList(): Promise<IncidentListResponse> {
  return api<IncidentListResponse>("/api/incidents")
}

export async function submitIncident(payload: IncidentFormPayload): Promise<IncidentRecord> {
  return api<IncidentRecord>("/api/incidents", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function fetchIncidentDetail(incidentId: number): Promise<IncidentDetail> {
  return api<IncidentDetail>(`/api/incidents/${incidentId}`)
}

export async function uploadIncidentAttachment(
  incidentId: number,
  file: File,
  description?: string,
): Promise<Record<string, unknown>> {
  const form = new FormData()
  form.append("file", file)
  if (description) {
    form.append("description", description)
  }
  return api(`/api/incidents/${incidentId}/attachments`, {
    method: "POST",
    body: form,
  })
}

export async function addIncidentActivity(
  incidentId: number,
  payload: {
    activityType: string
    timestamp?: string
    description?: string
    findings?: string
    investigatorId?: number
    followUpRequired?: boolean
  },
): Promise<Record<string, unknown>> {
  return api(`/api/incidents/${incidentId}/activities`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function saveIncidentRootCause(
  incidentId: number,
  payload: Record<string, unknown>,
): Promise<IncidentDetail> {
  return api<IncidentDetail>(`/api/incidents/${incidentId}/root-cause`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function requestIncidentIntakeInsights(
  payload: {
    title: string
    incidentType: string
    detailedDescription: string
    department: string
    severity: string
  },
): Promise<IncidentIntakeAssessmentResponse> {
  return api<IncidentIntakeAssessmentResponse>("/api/incidents/ai/intake", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
