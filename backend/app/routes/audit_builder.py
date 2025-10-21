from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from threading import Lock
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, validator

from app.ai.audit_ai import (
    generate_basic_info_suggestions,
    generate_checklist_suggestions,
    generate_communication_suggestions,
    generate_dashboard_insights,
    generate_launch_review,
    generate_schedule_suggestions,
)

router = APIRouter(prefix="/api/audit-builder", tags=["audit-builder"])


class NotificationSettings(BaseModel):
    audit_announcement: bool = True
    daily_reminders: bool = False
    progress_updates: bool = True
    completion_notifications: bool = True


class NotificationTemplates(BaseModel):
    announcement_email: Optional[str] = None
    daily_reminder_email: Optional[str] = None
    completion_email: Optional[str] = None


class ChecklistQuestionIn(BaseModel):
    text: str
    type: str
    evidence_required: bool = False
    scoring_weight: Optional[int] = None
    risk_impact: Optional[str] = None
    guidance_notes: Optional[str] = None


class ChecklistSectionIn(BaseModel):
    title: str
    description: Optional[str] = None
    weight: Optional[int] = None
    required: bool = False
    questions: List[ChecklistQuestionIn] = Field(default_factory=list)


class ChecklistQuestion(ChecklistQuestionIn):
    id: str


class ChecklistSection(ChecklistSectionIn):
    id: str
    questions: List[ChecklistQuestion] = Field(default_factory=list)


class ResourceAllocation(BaseModel):
    role: str
    owner: str
    hours: int


class AuditPlan(BaseModel):
    id: str
    title: str
    audit_type: str
    departments: List[str]
    risk_level: str
    status: str
    start_date: date
    end_date: date
    estimated_duration_hours: int
    audit_scope: str
    audit_objective: str
    compliance_frameworks: List[str]
    lead_auditor: str
    audit_team: List[str]
    auditee_contacts: List[str]
    meeting_room: Optional[str] = None
    special_requirements: Optional[str] = None
    notification_settings: NotificationSettings
    notification_templates: NotificationTemplates
    checklist_sections: List[ChecklistSection]
    resource_plan: List[ResourceAllocation]
    progress: int = 0

    @validator("estimated_duration_hours")
    def validate_duration(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("estimated_duration_hours must be positive")
        return value


class AuditSummary(BaseModel):
    id: str
    title: str
    audit_type: str
    departments: List[str]
    status: str
    risk_level: str
    start_date: date
    end_date: date
    estimated_duration_hours: int
    lead_auditor: str
    progress: int
    audit_team: List[str]


class DashboardInsights(BaseModel):
    scheduling_priority: str
    resource_hotspots: List[str]
    duration_trend_hours: float
    notes: List[str]


class PlanningDashboardResponse(BaseModel):
    audits: List[AuditSummary]
    ai_insights: DashboardInsights
    legend: Dict[str, str]


class AuditCreatePayload(BaseModel):
    title: str
    audit_type: str
    departments: List[str]
    risk_level: str
    start_date: date
    end_date: date
    audit_scope: str
    audit_objective: str
    compliance_frameworks: List[str] = Field(default_factory=list)
    lead_auditor: str
    audit_team: List[str] = Field(default_factory=list)
    auditee_contacts: List[str] = Field(default_factory=list)
    meeting_room: Optional[str] = None
    special_requirements: Optional[str] = None
    notification_settings: NotificationSettings = Field(default_factory=NotificationSettings)
    notification_templates: NotificationTemplates = Field(default_factory=NotificationTemplates)
    checklist_sections: List[ChecklistSectionIn] = Field(default_factory=list)

    @validator("departments")
    def validate_departments(cls, value: List[str]) -> List[str]:
        if not value:
            raise ValueError("At least one department is required")
        return value

    @validator("end_date")
    def validate_dates(cls, value: date, values: Dict[str, date]) -> date:
        start_date: Optional[date] = values.get("start_date")
        if start_date and value < start_date:
            raise ValueError("end_date cannot be before start_date")
        return value


class CreateAuditResponse(BaseModel):
    audit: AuditPlan


class BasicInfoRequest(BaseModel):
    audit_type: str
    departments: List[str] = Field(default_factory=list)
    scope: Optional[str] = None
    objective: Optional[str] = None
    compliance_frameworks: List[str] = Field(default_factory=list)


class ScheduleRequest(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    team: List[str] = Field(default_factory=list)
    lead_auditor: Optional[str] = None
    departments: List[str] = Field(default_factory=list)
    risk_level: Optional[str] = None
    existing_duration_hours: Optional[int] = None


class ChecklistRequest(BaseModel):
    audit_type: str
    departments: List[str] = Field(default_factory=list)
    compliance_frameworks: List[str] = Field(default_factory=list)
    risk_level: Optional[str] = None


class CommunicationRequest(BaseModel):
    audit_title: str
    recipients: List[str] = Field(default_factory=list)
    include_daily_reminders: bool = False


class LaunchReviewRequest(BaseModel):
    audit_title: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    risk_level: Optional[str] = None
    team: List[str] = Field(default_factory=list)
    notifications_enabled: Dict[str, bool] = Field(default_factory=dict)
    duration_hours: Optional[int] = None


class TemplatesResponse(BaseModel):
    templates: List[str]


_STATUS_LEGEND: Dict[str, str] = {
    "Scheduled": "Emerald",
    "In Progress": "Amber",
    "Completed": "Slate",
}


_store_lock = Lock()
_audit_store: Dict[str, AuditPlan] = {}


def _bootstrap_audits() -> None:
    global _audit_store
    if _audit_store:
        return

    today = date.today()
    entries: List[AuditPlan] = []
    seed_data = [
        (
            "AUD-2025-001",
            "ISO 27001 Surveillance",
            "Compliance Audit",
            "Information Security",
            "High",
            today + timedelta(days=12),
            today + timedelta(days=16),
            "Alex Johnson",
            ["Sasha Lane", "Robin Clark"],
            ["Priya Shah", "Diego Ramos"],
            "Hybrid War Room",
        ),
        (
            "AUD-2025-002",
            "Global Payroll Controls",
            "Financial Audit",
            "Finance",
            "Medium",
            today + timedelta(days=32),
            today + timedelta(days=35),
            "Maria Rossi",
            ["Kevin Wu", "Lina Patel"],
            ["Tom Green", "Isabella Costa"],
            "Finance HQ 4F",
        ),
        (
            "AUD-2025-003",
            "Manufacturing Process Excellence",
            "Operational Audit",
            "Operations",
            "Medium",
            today + timedelta(days=5),
            today + timedelta(days=8),
            "James Barrett",
            ["Amelia Chen", "Noah Jenkins"],
            ["Carl Evans", "Fatima Idris"],
            "Austin Plant Conference",
        ),
    ]

    for audit_id, title, audit_type, department, risk, start, end, lead, team, auditees, room in seed_data:
        sections = [
            ChecklistSection(
                id=str(uuid.uuid4()),
                title="Planning & Governance",
                description="Confirm governance and planning discipline",
                weight=20,
                required=True,
                questions=[
                    ChecklistQuestion(
                        id=str(uuid.uuid4()),
                        text="Is there a documented charter for the process?",
                        type="Yes/No",
                        evidence_required=True,
                        risk_impact=risk,
                    )
                ],
            )
        ]
        plan = AuditPlan(
            id=audit_id,
            title=title,
            audit_type=audit_type,
            departments=[department],
            risk_level=risk,
            status="Scheduled" if start > today else "In Progress",
            start_date=start,
            end_date=end,
            estimated_duration_hours=max(int((end - start).total_seconds() // 3600) or 24, 16),
            audit_scope=f"Evaluate {department} key controls and supporting processes",
            audit_objective=f"Confirm {department} meets requirements for {audit_type}",
            compliance_frameworks=["ISO 27001"] if audit_type == "Compliance Audit" else ["Internal Standards"],
            lead_auditor=lead,
            audit_team=team,
            auditee_contacts=auditees,
            meeting_room=room,
            special_requirements="Video conferencing bridge" if room.startswith("Hybrid") else None,
            notification_settings=NotificationSettings(),
            notification_templates=NotificationTemplates(),
            checklist_sections=sections,
            resource_plan=[
                ResourceAllocation(role="Lead Auditor", owner=lead, hours=24),
                ResourceAllocation(role="Co-Auditor", owner=team[0], hours=20),
            ],
            progress=15 if start > today else 55,
        )
        entries.append(plan)

    with _store_lock:
        _audit_store = {entry.id: entry for entry in entries}


_bootstrap_audits()


@router.get("/dashboard", response_model=PlanningDashboardResponse)
def get_planning_dashboard() -> PlanningDashboardResponse:
    with _store_lock:
        audits = list(_audit_store.values())

    summaries = [
        AuditSummary(
            id=audit.id,
            title=audit.title,
            audit_type=audit.audit_type,
            departments=audit.departments,
            status=audit.status,
            risk_level=audit.risk_level,
            start_date=audit.start_date,
            end_date=audit.end_date,
            estimated_duration_hours=audit.estimated_duration_hours,
            lead_auditor=audit.lead_auditor,
            progress=audit.progress,
            audit_team=audit.audit_team,
        )
        for audit in audits
    ]

    ai_payload = [
        {
            "id": audit.id,
            "title": audit.title,
            "risk_level": audit.risk_level,
            "department": audit.departments[0] if audit.departments else None,
            "start_date": audit.start_date.isoformat(),
            "end_date": audit.end_date.isoformat(),
            "estimated_duration_hours": audit.estimated_duration_hours,
        }
        for audit in audits
    ]
    insights_data = generate_dashboard_insights(ai_payload)
    insights = DashboardInsights(**insights_data)

    return PlanningDashboardResponse(audits=summaries, ai_insights=insights, legend=_STATUS_LEGEND)


@router.post("/audits", response_model=CreateAuditResponse)
def create_audit(payload: AuditCreatePayload) -> CreateAuditResponse:
    estimated_duration = max(int((payload.end_date - payload.start_date).total_seconds() // 3600) or 24, 16)

    sections: List[ChecklistSection] = []
    for section in payload.checklist_sections:
        questions = [
            ChecklistQuestion(id=str(uuid.uuid4()), **question.model_dump())
            for question in section.questions
        ]
        sections.append(
            ChecklistSection(
                id=str(uuid.uuid4()),
                title=section.title,
                description=section.description,
                weight=section.weight,
                required=section.required,
                questions=questions,
            )
        )

    plan = AuditPlan(
        id=f"AUD-{payload.start_date.year}-{uuid.uuid4().hex[:4].upper()}",
        title=payload.title,
        audit_type=payload.audit_type,
        departments=payload.departments,
        risk_level=payload.risk_level,
        status="Scheduled",
        start_date=payload.start_date,
        end_date=payload.end_date,
        estimated_duration_hours=estimated_duration,
        audit_scope=payload.audit_scope,
        audit_objective=payload.audit_objective,
        compliance_frameworks=payload.compliance_frameworks,
        lead_auditor=payload.lead_auditor,
        audit_team=payload.audit_team,
        auditee_contacts=payload.auditee_contacts,
        meeting_room=payload.meeting_room,
        special_requirements=payload.special_requirements,
        notification_settings=payload.notification_settings,
        notification_templates=payload.notification_templates,
        checklist_sections=sections,
        resource_plan=[
            ResourceAllocation(role="Lead Auditor", owner=payload.lead_auditor, hours=estimated_duration // 2 or 16),
            ResourceAllocation(role="Audit Team", owner=(payload.audit_team[0] if payload.audit_team else payload.lead_auditor), hours=estimated_duration // 2 or 16),
        ],
        progress=0,
    )

    with _store_lock:
        _audit_store[plan.id] = plan

    return CreateAuditResponse(audit=plan)


@router.get("/templates", response_model=TemplatesResponse)
def list_templates() -> TemplatesResponse:
    return TemplatesResponse(
        templates=[
            "Internal Audit",
            "Compliance Audit",
            "Quality Audit",
            "Financial Audit",
            "IT Audit",
            "Risk Assessment Audit",
            "Custom Template",
        ]
    )


@router.post("/ai/basic-info")
def ai_basic_info(payload: BasicInfoRequest) -> Dict[str, object]:
    if not payload.audit_type:
        raise HTTPException(status_code=400, detail="audit_type is required")
    return generate_basic_info_suggestions(
        audit_type=payload.audit_type,
        department=payload.departments[0] if payload.departments else None,
        scope=payload.scope,
        objective=payload.objective,
        compliance_frameworks=payload.compliance_frameworks,
    )


@router.post("/ai/schedule")
def ai_schedule(payload: ScheduleRequest) -> Dict[str, object]:
    return generate_schedule_suggestions(
        start_date=payload.start_date,
        end_date=payload.end_date,
        team=payload.team,
        lead_auditor=payload.lead_auditor,
        department=payload.departments[0] if payload.departments else None,
        risk_level=payload.risk_level,
        existing_duration_hours=payload.existing_duration_hours,
    )


@router.post("/ai/checklist")
def ai_checklist(payload: ChecklistRequest) -> Dict[str, object]:
    return generate_checklist_suggestions(
        audit_type=payload.audit_type,
        department=payload.departments[0] if payload.departments else None,
        compliance_frameworks=payload.compliance_frameworks,
        risk_level=payload.risk_level,
    )


@router.post("/ai/communications")
def ai_communications(payload: CommunicationRequest) -> Dict[str, object]:
    return generate_communication_suggestions(
        audit_title=payload.audit_title,
        recipients=payload.recipients,
        include_daily_reminders=payload.include_daily_reminders,
    )


@router.post("/ai/review")
def ai_review(payload: LaunchReviewRequest) -> Dict[str, object]:
    return generate_launch_review(
        audit_title=payload.audit_title,
        start_date=payload.start_date,
        end_date=payload.end_date,
        risk_level=payload.risk_level,
        team=payload.team,
        notifications_enabled=payload.notifications_enabled,
        duration_hours=payload.duration_hours,
    )
