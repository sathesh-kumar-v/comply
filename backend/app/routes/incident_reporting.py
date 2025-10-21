"""REST endpoints for the incident reporting module."""

from __future__ import annotations

import os
import uuid
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import (
    Incident,
    IncidentActivity,
    IncidentActivityType,
    IncidentAttachment,
    IncidentPriority,
    IncidentRootCauseFactor,
    IncidentSeverity,
    IncidentStatus,
    User,
)
from app.ai.incident_ai import IncidentIntelligenceEngine, IncidentSnapshot

router = APIRouter(prefix="/api/incidents", tags=["incidents"])

UPLOAD_DIR = os.path.join("uploads", "incidents")
MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024  # 50 MB
os.makedirs(UPLOAD_DIR, exist_ok=True)

INCIDENT_TYPES = [
    "Safety Incident",
    "Security Breach",
    "Compliance Violation",
    "Environmental Incident",
    "Quality Issue",
    "IT System Failure",
    "Process Failure",
    "Customer Complaint",
    "Other",
]

INCIDENT_CATEGORY_MAP: Dict[str, List[str]] = {
    "Safety Incident": [
        "Slips, Trips & Falls",
        "Equipment Hazard",
        "PPE Non-Compliance",
        "Unsafe Condition",
        "Other Safety",
    ],
    "Security Breach": [
        "Unauthorized Access",
        "Phishing",
        "Data Exfiltration",
        "Credential Compromise",
        "Other Security",
    ],
    "Compliance Violation": [
        "Regulatory Filing",
        "Policy Breach",
        "Training Non-Compliance",
        "Audit Finding",
        "Other Compliance",
    ],
    "Environmental Incident": [
        "Spill",
        "Air Emission",
        "Waste Management",
        "Wildlife Impact",
        "Other Environmental",
    ],
    "Quality Issue": [
        "Product Defect",
        "Supplier Non-Conformance",
        "Inspection Failure",
        "Customer Return",
        "Other Quality",
    ],
    "IT System Failure": [
        "Infrastructure",
        "Application",
        "Network",
        "Vendor Service",
        "Other IT",
    ],
    "Process Failure": [
        "Workflow Deviation",
        "Control Breakdown",
        "Documentation Gap",
        "Human Error",
        "Other Process",
    ],
    "Customer Complaint": [
        "Service Quality",
        "Product Quality",
        "Billing",
        "Support Experience",
        "Other Customer",
    ],
    "Other": ["General"],
}

SEVERITY_DETAILS: Dict[str, str] = {
    "Low": "Minor impact, no immediate action required",
    "Medium": "Moderate impact, action required within 24 hours",
    "High": "Significant impact, immediate action required",
    "Critical": "Major impact, emergency response required",
}

LOCATION_HIERARCHY = [
    {
        "label": "Global HQ",
        "value": "global_hq",
        "children": [
            {
                "label": "North Campus",
                "value": "north_campus",
                "children": [
                    {"label": "Building A", "value": "building_a"},
                    {"label": "Building B", "value": "building_b"},
                ],
            },
            {
                "label": "South Campus",
                "value": "south_campus",
                "children": [
                    {"label": "Manufacturing", "value": "manufacturing"},
                    {"label": "Distribution", "value": "distribution"},
                ],
            },
        ],
    },
    {
        "label": "Regional Offices",
        "value": "regional_offices",
        "children": [
            {
                "label": "EMEA",
                "value": "emea",
                "children": [
                    {"label": "Frankfurt", "value": "frankfurt"},
                    {"label": "Dubai", "value": "dubai"},
                ],
            },
            {
                "label": "APAC",
                "value": "apac",
                "children": [
                    {"label": "Singapore", "value": "singapore"},
                    {"label": "Sydney", "value": "sydney"},
                ],
            },
        ],
    },
]

ESCALATION_PLAYBOOK = {
    "Low": ["Department Manager"],
    "Medium": ["Department Manager", "Compliance Lead"],
    "High": ["Department Manager", "Compliance Director", "Executive Sponsor"],
    "Critical": [
        "Department Manager",
        "Compliance Director",
        "Executive Sponsor",
        "Crisis Response Team",
    ],
}

TARGET_RESOLUTION_DAYS = {
    "Low": 10,
    "Medium": 5,
    "High": 3,
    "Critical": 1,
}

PRIORITY_BY_SEVERITY = {
    "Low": IncidentPriority.LOW,
    "Medium": IncidentPriority.MEDIUM,
    "High": IncidentPriority.HIGH,
    "Critical": IncidentPriority.CRITICAL,
}

AI_ENGINE = IncidentIntelligenceEngine()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class EvidenceDescriptor(BaseModel):
    fileName: str
    description: Optional[str] = None


class IncidentCreateRequest(BaseModel):
    title: str = Field(..., max_length=200)
    incident_type: str = Field(..., alias="incidentType")
    incident_category: Optional[str] = Field(None, alias="incidentCategory")
    department: str
    location_path: List[str] = Field(..., min_length=1, alias="locationPath")
    occurred_at: datetime = Field(..., alias="occurredAt")
    severity: IncidentSeverity
    impact_assessment: str = Field(..., min_length=1, alias="impactAssessment")
    immediate_actions: Optional[str] = Field(None, alias="immediateActions")
    detailed_description: str = Field(..., min_length=100, alias="detailedDescription")
    what_happened: str = Field(..., min_length=1, alias="whatHappened")
    root_cause: Optional[str] = Field(None, alias="rootCause")
    contributing_factors: List[str] = Field(default_factory=list, alias="contributingFactors")
    people_involved: List[str] = Field(default_factory=list, alias="peopleInvolved")
    witnesses: List[str] = Field(default_factory=list)
    equipment_involved: Optional[str] = Field(None, alias="equipmentInvolved")
    immediate_notification: List[str] = Field(..., min_length=1, alias="immediateNotification")
    external_notifications: Dict[str, bool] = Field(
        default_factory=lambda: {
            "regulatoryBodies": False,
            "customers": False,
            "vendors": False,
        },
        alias="externalNotifications",
    )
    public_disclosure_required: bool = Field(False, alias="publicDisclosureRequired")
    attachments: List[EvidenceDescriptor] = Field(default_factory=list)

    @field_validator("incident_type")
    @classmethod
    def _validate_incident_type(cls, value: str) -> str:
        if value not in INCIDENT_TYPES:
            raise ValueError("Unsupported incident type")
        return value

    @field_validator("incident_category")
    @classmethod
    def _validate_category(cls, value: Optional[str], info) -> Optional[str]:
        if value is None:
            return value
        incident_type = info.data.get("incident_type")
        valid = INCIDENT_CATEGORY_MAP.get(incident_type, [])
        if value not in valid:
            raise ValueError("Category not valid for selected incident type")
        return value

    model_config = {"populate_by_name": True}


class IncidentUpdateRequest(BaseModel):
    status: Optional[IncidentStatus] = None
    severity: Optional[IncidentSeverity] = None
    department: Optional[str] = None
    incident_category: Optional[str] = Field(None, alias="incidentCategory")
    assigned_investigator_id: Optional[int] = Field(None, alias="assignedInvestigatorId")
    investigation_team: Optional[List[str]] = Field(None, alias="investigationTeam")
    target_resolution_date: Optional[date] = Field(None, alias="targetResolutionDate")
    public_disclosure_required: Optional[bool] = Field(None, alias="publicDisclosureRequired")

    model_config = {"populate_by_name": True}


class ActivityCreateRequest(BaseModel):
    timestamp: Optional[datetime] = None
    activity_type: IncidentActivityType = Field(..., alias="activityType")
    investigator_id: Optional[int] = Field(None, alias="investigatorId")
    description: Optional[str] = None
    findings: Optional[str] = None
    follow_up_required: bool = Field(False, alias="followUpRequired")

    model_config = {"populate_by_name": True}


class RootCauseFactorPayload(BaseModel):
    description: str
    category: str
    impact_level: IncidentSeverity = Field(..., alias="impactLevel")


class RootCauseUpdateRequest(BaseModel):
    rca_method: str = Field(..., alias="rcaMethod")
    primary_root_cause: str = Field(..., min_length=1, alias="primaryRootCause")
    factors: List[RootCauseFactorPayload] = Field(default_factory=list)
    rca_diagram: Optional[Dict[str, Any]] = Field(None, alias="rcaDiagram")
    rca_evidence: Optional[List[EvidenceDescriptor]] = Field(None, alias="rcaEvidence")

    model_config = {"populate_by_name": True}


class IntakeAssessmentRequest(BaseModel):
    title: str
    incident_type: str = Field(..., alias="incidentType")
    detailed_description: str = Field(..., min_length=50, alias="detailedDescription")
    department: str
    severity: IncidentSeverity

    @field_validator("incident_type")
    @classmethod
    def _check_type(cls, value: str) -> str:
        if value not in INCIDENT_TYPES:
            raise ValueError("Unsupported incident type")
        return value

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _generate_reference_id(db: Session) -> str:
    year = datetime.utcnow().year
    year_start = datetime(year, 1, 1)
    count = (
        db.query(Incident)
        .filter(Incident.created_at >= year_start)
        .count()
    )
    return f"INC-{year}-{count + 1:03d}"


def _compute_target_resolution(severity: IncidentSeverity, occurred_at: datetime) -> date:
    days = TARGET_RESOLUTION_DAYS.get(severity.value, 5)
    return (occurred_at + timedelta(days=days)).date()


def _build_escalation_path(severity: IncidentSeverity, ai_path: Optional[List[str]]) -> List[str]:
    base = ESCALATION_PLAYBOOK.get(severity.value, ["Department Manager"])
    if not ai_path:
        return base
    merged = list(dict.fromkeys([*base, *ai_path]))
    return merged


def _incident_to_snapshot(incident: Incident) -> IncidentSnapshot:
    resolved_at = None
    if incident.actual_resolution_date:
        resolved_at = datetime.combine(incident.actual_resolution_date, datetime.min.time())
    resolution_hours = None
    if resolved_at:
        resolution_hours = round((resolved_at - incident.occurred_at).total_seconds() / 3600, 2)
    return IncidentSnapshot(
        reference_id=incident.reference_id,
        title=incident.title,
        incident_type=incident.incident_type,
        severity=incident.severity.value,
        department=incident.department,
        occurred_at=incident.occurred_at,
        resolved_at=resolved_at,
        resolution_hours=resolution_hours,
    )


def _serialize_incident(incident: Incident, *, include_relations: bool = False) -> Dict[str, Any]:
    data = {
        "id": incident.id,
        "referenceId": incident.reference_id,
        "title": incident.title,
        "incidentType": incident.incident_type,
        "incidentCategory": incident.incident_category,
        "department": incident.department,
        "locationPath": incident.location_path or [],
        "occurredAt": incident.occurred_at,
        "reportedAt": incident.reported_at,
        "severity": incident.severity.value,
        "status": incident.status.value,
        "priority": incident.priority.value,
        "impactAssessment": incident.impact_assessment,
        "immediateActions": incident.immediate_actions,
        "detailedDescription": incident.detailed_description,
        "whatHappened": incident.what_happened,
        "rootCause": incident.root_cause,
        "contributingFactors": incident.contributing_factors or [],
        "peopleInvolved": incident.people_involved or [],
        "witnesses": incident.witnesses or [],
        "equipmentInvolved": incident.equipment_involved,
        "immediateNotification": incident.immediate_notification or [],
        "escalationPath": incident.escalation_path or [],
        "externalNotifications": incident.external_notifications or {},
        "publicDisclosureRequired": incident.public_disclosure_required,
        "targetResolutionDate": incident.target_resolution_date,
        "actualResolutionDate": incident.actual_resolution_date,
        "aiSummary": incident.ai_summary or {},
        "overdue": (
            incident.target_resolution_date is not None
            and incident.status not in {IncidentStatus.RESOLVED, IncidentStatus.CLOSED}
            and incident.target_resolution_date < date.today()
        ),
        "createdAt": incident.created_at,
        "updatedAt": incident.updated_at,
    }

    if include_relations:
        data["attachments"] = [
            {
                "id": attachment.id,
                "fileName": attachment.file_name,
                "description": attachment.description,
                "uploadedAt": attachment.uploaded_at,
                "mimeType": attachment.mime_type,
                "fileSize": attachment.file_size,
            }
            for attachment in incident.attachments
        ]
        data["activities"] = [
            {
                "id": activity.id,
                "timestamp": activity.timestamp,
                "activityType": activity.activity_type.value,
                "description": activity.description,
                "findings": activity.findings,
                "followUpRequired": activity.follow_up_required,
            }
            for activity in incident.activities
        ]
        data["rootCause"] = {
            "rcaMethod": incident.rca_method,
            "primaryRootCause": incident.primary_root_cause,
            "factors": [
                {
                    "id": factor.id,
                    "description": factor.description,
                    "category": factor.category,
                    "impactLevel": factor.impact_level.value,
                }
                for factor in incident.root_cause_factors
            ],
            "rcaDiagram": incident.rca_diagram,
            "rcaEvidence": incident.rca_evidence or [],
        }
        data["aiInvestigation"] = incident.ai_investigation_insights or {}
    return data


def _auto_assess_severity(description: str, declared: IncidentSeverity) -> Dict[str, Any]:
    text = description.lower()
    score = {
        IncidentSeverity.LOW: 1,
        IncidentSeverity.MEDIUM: 2,
        IncidentSeverity.HIGH: 3,
        IncidentSeverity.CRITICAL: 4,
    }[declared]
    if any(keyword in text for keyword in ["hospital", "injury", "evacuate", "breach"]):
        score = max(score, 3)
    if any(keyword in text for keyword in ["fire", "fatal", "data leak", "ransomware"]):
        score = 4
    suggested = {
        1: IncidentSeverity.LOW,
        2: IncidentSeverity.MEDIUM,
        3: IncidentSeverity.HIGH,
        4: IncidentSeverity.CRITICAL,
    }[score]
    confidence = 0.6 if score == 1 else 0.85 if score == 4 else 0.75
    return {
        "suggestedSeverity": suggested.value,
        "confidence": confidence,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/metadata")
def get_incident_metadata(
    current_user: User = Depends(get_current_user),
):
    return {
        "incidentTypes": INCIDENT_TYPES,
        "incidentCategories": INCIDENT_CATEGORY_MAP,
        "severityOptions": [
            {"value": key, "description": value} for key, value in SEVERITY_DETAILS.items()
        ],
        "locationHierarchy": LOCATION_HIERARCHY,
        "activityTypes": [activity.value for activity in IncidentActivityType],
        "rcaMethods": ["5 Whys", "Fishbone", "Fault Tree", "Apollo", "Custom"],
    }


@router.get("/dashboard")
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    incidents = (
        db.query(Incident)
        .order_by(Incident.created_at.desc())
        .all()
    )
    total = len(incidents)
    open_count = sum(
        1
        for incident in incidents
        if incident.status in {IncidentStatus.OPEN, IncidentStatus.UNDER_INVESTIGATION}
    )
    resolved_this_month = 0
    avg_resolution_hours: List[float] = []
    overdue = 0
    overdue_previous = 0

    now = datetime.utcnow()
    start_month = datetime(now.year, now.month, 1)
    current_month_key = start_month.strftime("%Y-%m")
    previous_month_key = (start_month - timedelta(days=1)).strftime("%Y-%m")

    monthly_trend: Dict[str, int] = defaultdict(int)
    resolved_counts: Dict[str, int] = defaultdict(int)
    category_counts: Counter[str] = Counter()
    severity_counts: Counter[str] = Counter()
    department_resolution: Dict[str, List[float]] = defaultdict(list)
    open_by_month: Dict[str, int] = defaultdict(int)
    resolution_by_month: Dict[str, List[float]] = defaultdict(list)

    for incident in incidents:
        month_key = incident.occurred_at.strftime("%Y-%m")
        monthly_trend[month_key] += 1
        severity_counts[incident.severity.value] += 1
        category_key = incident.incident_category or incident.incident_type
        category_counts[category_key] += 1

        if incident.status in {IncidentStatus.OPEN, IncidentStatus.UNDER_INVESTIGATION}:
            open_by_month[month_key] += 1

        if (
            incident.status in {IncidentStatus.RESOLVED, IncidentStatus.CLOSED}
            and incident.actual_resolution_date
        ):
            resolution_month_key = incident.actual_resolution_date.strftime("%Y-%m")
            resolved_counts[resolution_month_key] += 1
            duration = (
                datetime.combine(incident.actual_resolution_date, datetime.min.time())
                - incident.occurred_at
            ).total_seconds() / 3600
            resolution_by_month[resolution_month_key].append(duration)
            if incident.actual_resolution_date >= start_month.date():
                resolved_this_month += 1
            avg_resolution_hours.append(duration)
            department_resolution[incident.department].append(duration)
        elif (
            incident.target_resolution_date
            and incident.status not in {IncidentStatus.RESOLVED, IncidentStatus.CLOSED}
            and incident.target_resolution_date < date.today()
        ):
            overdue += 1
            if incident.target_resolution_date < start_month.date():
                overdue_previous += 1

    average_resolution = (
        round(sum(avg_resolution_hours) / len(avg_resolution_hours), 2)
        if avg_resolution_hours
        else 0.0
    )

    avg_resolution_current = (
        round(sum(resolution_by_month[current_month_key]) / len(resolution_by_month[current_month_key]), 2)
        if resolution_by_month[current_month_key]
        else average_resolution
    )
    avg_resolution_previous = (
        round(sum(resolution_by_month[previous_month_key]) / len(resolution_by_month[previous_month_key]), 2)
        if resolution_by_month[previous_month_key]
        else average_resolution
    )

    forecast = AI_ENGINE.predict_trends(monthly_counts=dict(monthly_trend))

    department_performance = [
        {
            "department": dept,
            "averageResolutionHours": round(sum(hours) / len(hours), 2),
        }
        for dept, hours in department_resolution.items()
    ]
    department_performance.sort(key=lambda item: item["averageResolutionHours"])

    return {
        "summary": {
            "totalIncidents": {
                "value": total,
                "trend": _calculate_trend(
                    monthly_trend.get(current_month_key, 0),
                    monthly_trend.get(previous_month_key, 0),
                ),
            },
            "openIncidents": {
                "value": open_count,
                "trend": _calculate_trend(
                    open_by_month.get(current_month_key, 0),
                    open_by_month.get(previous_month_key, 0),
                ),
            },
            "resolvedThisMonth": {
                "value": resolved_this_month,
                "trend": _calculate_trend(
                    resolved_counts.get(current_month_key, 0),
                    resolved_counts.get(previous_month_key, 0),
                ),
            },
            "averageResolutionHours": {
                "value": avg_resolution_current,
                "trend": _calculate_trend(
                    avg_resolution_current,
                    avg_resolution_previous,
                ),
            },
            "overdueIncidents": {
                "value": overdue,
                "trend": _calculate_trend(
                    overdue,
                    overdue_previous,
                ),
            },
        },
        "analytics": {
            "incidentTrend": [
                {
                    "month": month,
                    "incidents": monthly_trend[month],
                    "resolved": resolved_counts.get(month, 0),
                }
                for month in sorted(monthly_trend.keys())
            ],
            "incidentCategories": [
                {"category": name, "count": count}
                for name, count in category_counts.most_common()
            ],
            "severityDistribution": [
                {"severity": key, "count": value}
                for key, value in severity_counts.items()
            ],
            "departmentPerformance": department_performance,
        },
        "quickActions": [
            {"label": "Report Incident", "intent": "report", "tone": "destructive"},
            {"label": "My Incidents", "intent": "mine", "tone": "primary"},
            {"label": "Generate Report", "intent": "reporting", "tone": "success"},
            {"label": "Export Data", "intent": "export", "tone": "secondary"},
        ],
        "aiInsights": {
            "forecast": forecast,
            "severityOutlook": {
                "criticalShare": severity_counts.get("Critical", 0) / total if total else 0,
                "highShare": severity_counts.get("High", 0) / total if total else 0,
            },
            "recentCategorisations": [
                incident.ai_summary
                for incident in incidents[:3]
                if incident.ai_summary
            ],
        },
    }


@router.get("")
def list_incidents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    incidents = (
        db.query(Incident)
        .order_by(Incident.created_at.desc())
        .all()
    )
    return {
        "items": [
            _serialize_incident(incident)
            for incident in incidents
        ]
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_incident(
    payload: IncidentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing_snapshots = [
        _incident_to_snapshot(incident)
        for incident in db.query(Incident).limit(100).all()
    ]
    ai_summary = AI_ENGINE.analyse_new_incident(
        title=payload.title,
        description=payload.detailed_description,
        incident_type=payload.incident_type,
        department=payload.department,
        severity=payload.severity.value,
        existing=existing_snapshots,
    )

    reference_id = _generate_reference_id(db)
    escalation_path = _build_escalation_path(payload.severity, ai_summary.get("escalationPath"))
    target_date = _compute_target_resolution(payload.severity, payload.occurred_at)

    incident = Incident(
        reference_id=reference_id,
        title=payload.title,
        incident_type=payload.incident_type,
        incident_category=payload.incident_category or ai_summary.get("predictedCategory"),
        department=payload.department,
        location_path=payload.location_path,
        occurred_at=payload.occurred_at,
        severity=payload.severity,
        impact_assessment=payload.impact_assessment,
        immediate_actions=payload.immediate_actions,
        detailed_description=payload.detailed_description,
        what_happened=payload.what_happened,
        root_cause=payload.root_cause,
        contributing_factors=payload.contributing_factors,
        people_involved=payload.people_involved,
        witnesses=payload.witnesses,
        equipment_involved=payload.equipment_involved,
        immediate_notification=payload.immediate_notification,
        escalation_path=escalation_path,
        external_notifications=payload.external_notifications,
        public_disclosure_required=payload.public_disclosure_required,
        priority=PRIORITY_BY_SEVERITY[payload.severity.value],
        target_resolution_date=target_date,
        created_by_id=current_user.id,
        ai_summary=ai_summary,
    )

    db.add(incident)
    db.commit()
    db.refresh(incident)

    return _serialize_incident(incident)


@router.get("/{incident_id}")
def get_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _serialize_incident(incident, include_relations=True)


@router.put("/{incident_id}")
def update_incident(
    incident_id: int,
    payload: IncidentUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if payload.status is not None:
        incident.status = payload.status
        if payload.status in {IncidentStatus.RESOLVED, IncidentStatus.CLOSED} and not incident.actual_resolution_date:
            incident.actual_resolution_date = date.today()
    if payload.severity is not None:
        incident.severity = payload.severity
        incident.priority = PRIORITY_BY_SEVERITY[payload.severity.value]
        incident.target_resolution_date = _compute_target_resolution(payload.severity, incident.occurred_at)
    if payload.department is not None:
        incident.department = payload.department
    if payload.incident_category is not None:
        incident.incident_category = payload.incident_category
    if payload.assigned_investigator_id is not None:
        incident.assigned_investigator_id = payload.assigned_investigator_id
    if payload.investigation_team is not None:
        incident.investigation_team = payload.investigation_team
    if payload.target_resolution_date is not None:
        incident.target_resolution_date = payload.target_resolution_date
    if payload.public_disclosure_required is not None:
        incident.public_disclosure_required = payload.public_disclosure_required

    db.commit()
    db.refresh(incident)
    return _serialize_incident(incident, include_relations=True)


@router.post("/{incident_id}/activities", status_code=status.HTTP_201_CREATED)
def add_activity(
    incident_id: int,
    payload: ActivityCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    activity = IncidentActivity(
        incident_id=incident.id,
        timestamp=payload.timestamp or datetime.utcnow(),
        activity_type=payload.activity_type,
        investigator_id=payload.investigator_id,
        description=payload.description,
        findings=payload.findings,
        follow_up_required=payload.follow_up_required,
    )

    db.add(activity)
    db.commit()
    db.refresh(activity)

    return {
        "id": activity.id,
        "timestamp": activity.timestamp,
        "activityType": activity.activity_type.value,
        "description": activity.description,
        "findings": activity.findings,
        "followUpRequired": activity.follow_up_required,
    }


@router.post("/{incident_id}/attachments", status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    incident_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    contents = await file.read()
    if len(contents) > MAX_ATTACHMENT_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 50MB limit")

    stored_name = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, stored_name)
    with open(file_path, "wb") as handle:
        handle.write(contents)

    attachment = IncidentAttachment(
        incident_id=incident.id,
        file_name=file.filename,
        stored_name=stored_name,
        file_path=file_path,
        mime_type=file.content_type,
        file_size=len(contents),
        description=description,
        uploaded_by_id=current_user.id,
    )

    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return {
        "id": attachment.id,
        "fileName": attachment.file_name,
        "description": attachment.description,
        "uploadedAt": attachment.uploaded_at,
        "mimeType": attachment.mime_type,
        "fileSize": attachment.file_size,
    }


@router.post("/{incident_id}/root-cause")
def update_root_cause(
    incident_id: int,
    payload: RootCauseUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident.rca_method = payload.rca_method
    incident.primary_root_cause = payload.primary_root_cause
    incident.root_cause_factors = [
        IncidentRootCauseFactor(
            incident_id=incident.id,
            description=factor.description,
            category=factor.category,
            impact_level=factor.impact_level,
        )
        for factor in payload.factors
    ]
    incident.rca_diagram = payload.rca_diagram
    incident.rca_evidence = [evidence.model_dump() for evidence in payload.rca_evidence] if payload.rca_evidence else []

    snapshot = _incident_to_snapshot(incident)
    activities = [
        {
            "timestamp": activity.timestamp.isoformat(),
            "activityType": activity.activity_type.value,
            "followUpRequired": activity.follow_up_required,
        }
        for activity in incident.activities
    ]
    incident.ai_investigation_insights = AI_ENGINE.recommend_investigation_focus(
        incident=snapshot,
        activities=activities,
    )

    db.commit()
    db.refresh(incident)

    return _serialize_incident(incident, include_relations=True)


@router.get("/{incident_id}/investigation")
def get_investigation(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    snapshot = _incident_to_snapshot(incident)
    activities = [
        {
            "id": activity.id,
            "timestamp": activity.timestamp,
            "activityType": activity.activity_type.value,
            "description": activity.description,
            "findings": activity.findings,
            "followUpRequired": activity.follow_up_required,
        }
        for activity in incident.activities
    ]

    insights = incident.ai_investigation_insights or AI_ENGINE.recommend_investigation_focus(
        incident=snapshot,
        activities=[
            {
                "timestamp": activity["timestamp"].isoformat() if isinstance(activity["timestamp"], datetime) else activity["timestamp"],
                "activityType": activity["activityType"],
                "followUpRequired": activity["followUpRequired"],
            }
            for activity in activities
        ],
    )

    return {
        "incident": _serialize_incident(incident, include_relations=True),
        "timeline": activities,
        "ai": insights,
    }


@router.post("/ai/intake")
def ai_intake_assessment(
    payload: IntakeAssessmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = [
        _incident_to_snapshot(incident)
        for incident in db.query(Incident).limit(100).all()
    ]
    ai_summary = AI_ENGINE.analyse_new_incident(
        title=payload.title,
        description=payload.detailed_description,
        incident_type=payload.incident_type,
        department=payload.department,
        severity=payload.severity.value,
        existing=existing,
    )
    severity_assessment = _auto_assess_severity(payload.detailed_description, payload.severity)
    return {
        "severity": severity_assessment,
        "categorisation": ai_summary,
    }
def _calculate_trend(current: float, previous: float) -> Dict[str, Any]:
    """Return directional trend metadata for dashboard summaries."""

    direction: str
    if current > previous:
        direction = "up"
    elif current < previous:
        direction = "down"
    else:
        direction = "flat"

    if previous == 0:
        percentage = 100.0 if current > 0 else 0.0
    else:
        percentage = abs((current - previous) / previous) * 100

    return {"direction": direction, "percentage": round(percentage, 1)}
