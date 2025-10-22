from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, validator

from app.ai.corrective_actions_ai import CorrectiveActionAIEngine, build_snapshots, PRIORITY_WEIGHTS, URGENCY_WEIGHTS

router = APIRouter(prefix="/api/corrective-actions", tags=["corrective-actions"])


class ImplementationStepPayload(BaseModel):
    step_description: str = Field(..., alias="stepDescription", max_length=1000)
    responsible_person: Optional[str] = Field(None, alias="responsiblePerson")
    due_date: Optional[date] = Field(None, alias="dueDate")
    resources_required: Optional[str] = Field(None, alias="resourcesRequired", max_length=1000)
    success_criteria: Optional[str] = Field(None, alias="successCriteria", max_length=1000)


class ActionCreatePayload(BaseModel):
    action_title: str = Field(..., alias="actionTitle", max_length=200)
    action_type: str = Field(..., alias="actionType", max_length=120)
    source_reference: str = Field(..., alias="sourceReference", max_length=120)
    reference_id: Optional[str] = Field(None, alias="referenceId", max_length=120)
    departments: List[str] = Field(..., min_items=1)
    priority: str = Field(..., pattern="^(Low|Medium|High|Critical)$")
    impact: str = Field(..., pattern="^(Low|Medium|High|Critical)$")
    urgency: str = Field(..., pattern="^(Low|Medium|High|Critical)$")
    problem_statement: str = Field(..., alias="problemStatement", max_length=1000)
    root_cause: str = Field(..., alias="rootCause", max_length=1000)
    contributing_factors: Optional[str] = Field(None, alias="contributingFactors", max_length=1000)
    impact_assessment: str = Field(..., alias="impactAssessment", max_length=1000)
    current_controls: Optional[str] = Field(None, alias="currentControls", max_length=1000)
    evidence: List[str] = Field(default_factory=list)
    action_plan_description: str = Field(..., alias="actionPlanDescription")
    implementation_steps: List[ImplementationStepPayload] = Field(default_factory=list, alias="implementationSteps")
    overall_due_date: date = Field(..., alias="overallDueDate")
    action_owner: str = Field(..., alias="actionOwner", max_length=120)
    review_team: List[str] = Field(default_factory=list, alias="reviewTeam")
    budget_required: Optional[float] = Field(None, alias="budgetRequired", ge=0)
    approval_required: bool = Field(False, alias="approvalRequired")
    approver: Optional[str] = Field(None, alias="approver", max_length=120)
    ai_assisted: bool = Field(False, alias="aiAssisted")
    predicted_success_probability: Optional[float] = Field(None, alias="predictedSuccessProbability")

    @validator("departments")
    def _require_departments(cls, value: List[str]) -> List[str]:
        cleaned = [item.strip() for item in value if item.strip()]
        if not cleaned:
            raise ValueError("At least one department must be selected")
        return cleaned

    @validator("approver")
    def _approver_required(cls, value: Optional[str], values: Dict[str, Any]) -> Optional[str]:
        if values.get("approval_required") and not (value and value.strip()):
            raise ValueError("Approver is required when approval is needed")
        return value


class ActionPlanAIRequest(BaseModel):
    action_title: str = Field(..., alias="actionTitle", max_length=200)
    action_type: str = Field(..., alias="actionType", max_length=120)
    problem_statement: str = Field(..., alias="problemStatement", max_length=1000)
    root_cause: Optional[str] = Field(None, alias="rootCause", max_length=1000)
    impact: str = Field(..., max_length=40)
    urgency: str = Field(..., max_length=40)
    departments: List[str] = Field(default_factory=list)

    @validator("problem_statement")
    def _require_problem(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Problem statement is required for AI planning")
        return value


class ActionCreateResponse(BaseModel):
    action_id: str = Field(..., alias="actionId")
    status: str
    ai_assessment: Dict[str, Any] = Field(..., alias="aiAssessment")


TODAY = date.today()


def _dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _d(value: str) -> date:
    return date.fromisoformat(value)


ACTION_REGISTRY: Dict[str, Dict[str, Any]] = {}


def _seed_actions() -> None:
    global ACTION_REGISTRY
    ACTION_REGISTRY = {
        "CA-2025-001": {
            "id": "CA-2025-001",
            "title": "Stabilize supplier onboarding controls",
            "type": "Short-term Corrective Action",
            "source": "Audit Finding",
            "reference_id": "AUD-2025-014",
            "departments": ["Operations", "Quality Assurance"],
            "priority": "High",
            "impact": "High",
            "urgency": "Critical",
            "status": "In Progress",
            "owner": "Jordan Smith",
            "review_team": ["Quality Director", "Compliance Lead"],
            "due_date": _d("2025-03-18"),
            "completed_on": None,
            "created_on": _dt("2025-01-20T09:00:00"),
            "last_updated": _dt("2025-02-18T14:35:00"),
            "progress": 62,
            "problem_statement": "Supplier onboarding errors exceeded threshold causing compliance delays.",
            "root_cause": "Manual checklist gaps and inconsistent verification steps.",
            "contributing_factors": "Legacy documentation, limited cross-training, and unclear escalation path.",
            "impact_assessment": "Delayed vendor activation impacts revenue recognition and audit compliance.",
            "current_controls": "Manual review by procurement analyst with weekly supervisor spot checks.",
            "evidence": [
                {"name": "Audit_Observation.pdf", "type": "document"},
                {"name": "Vendor_Error_Log.xlsx", "type": "spreadsheet"},
            ],
            "action_plan": "<p>Implement standardized onboarding workflow with automated validation checks and escalation triggers.</p>",
            "implementation_steps": [
                {
                    "id": "CA-2025-001-step-1",
                    "stepNumber": 1,
                    "description": "Deploy interim containment checklist to stop data gaps.",
                    "responsiblePerson": "Jordan Smith",
                    "dueDate": _d("2025-02-10"),
                    "status": "Completed",
                    "resourcesRequired": "Containment taskforce, communication toolkit",
                    "successCriteria": "No new onboarding defects recorded",
                    "progressNotes": "Checklist distributed and validated with pilot team.",
                    "completionDate": _d("2025-02-09"),
                    "evidence": [{"name": "Containment_Signoff.pdf"}],
                },
                {
                    "id": "CA-2025-001-step-2",
                    "stepNumber": 2,
                    "description": "Automate verification against compliance reference data.",
                    "responsiblePerson": "Priya Patel",
                    "dueDate": _d("2025-03-05"),
                    "status": "In Progress",
                    "resourcesRequired": "IT integration support, service account",
                    "successCriteria": "System blocks incomplete submissions",
                    "progressNotes": "Integration testing 70% complete.",
                    "issues": "Awaiting security approvals for API access.",
                },
                {
                    "id": "CA-2025-001-step-3",
                    "stepNumber": 3,
                    "description": "Train procurement analysts on new workflow and escalation path.",
                    "responsiblePerson": "Alex Martinez",
                    "dueDate": _d("2025-03-15"),
                    "status": "Not Started",
                    "resourcesRequired": "Training deck, LMS updates",
                    "successCriteria": "100% analysts certified",
                },
            ],
            "communication_log": [
                {
                    "id": "CA-2025-001-log-1",
                    "timestamp": _dt("2025-02-14T10:20:00"),
                    "updateType": "Progress Update",
                    "user": "Jordan Smith",
                    "description": "Containment checklist deployed; defect rate dropped by 40% week-over-week.",
                    "attachments": [],
                },
                {
                    "id": "CA-2025-001-log-2",
                    "timestamp": _dt("2025-02-19T16:45:00"),
                    "updateType": "Issue Report",
                    "user": "Priya Patel",
                    "description": "API security review delaying automation go-live by 3 days.",
                    "attachments": [{"name": "SecurityException.msg"}],
                },
            ],
            "effectiveness_evaluation": {
                "evaluation_due_date": _d("2025-04-05"),
                "evaluation_method": "Metrics review",
                "success_metrics": [
                    {
                        "name": "Onboarding defect rate",
                        "targetValue": "≤ 1.5%",
                        "actualValue": "1.8%",
                        "measurementMethod": "Automated dashboard",
                        "measurementDate": _d("2025-02-15"),
                    },
                    {
                        "name": "Cycle time",
                        "targetValue": "5 days",
                        "actualValue": "6.5 days",
                        "measurementMethod": "Workflow analytics",
                        "measurementDate": _d("2025-02-18"),
                    },
                ],
                "rating": "Partially Effective",
                "comments": "Containment working; automation delay impacting metrics.",
                "further_actions_required": True,
                "follow_up_actions": "Escalate API approval and schedule refresher training for analysts.",
            },
            "ai_metadata": {
                "effectiveness_score": 0.74,
                "risk_score": 0.82,
                "priority_score": 0.88,
            },
            "open_issues": [
                {"id": "issue-2025-001", "description": "Automation API pending security review"}
            ],
        },
        "CA-2025-002": {
            "id": "CA-2025-002",
            "title": "Modernize access control audit trail",
            "type": "Long-term Corrective Action",
            "source": "Risk Assessment",
            "reference_id": "RSK-2025-032",
            "departments": ["IT Security", "Compliance"],
            "priority": "Critical",
            "impact": "Critical",
            "urgency": "High",
            "status": "Open",
            "owner": "Maria Chen",
            "review_team": ["CISO", "Internal Audit"],
            "due_date": _d("2025-05-30"),
            "completed_on": None,
            "created_on": _dt("2025-01-10T11:15:00"),
            "last_updated": _dt("2025-02-12T09:30:00"),
            "progress": 28,
            "problem_statement": "Legacy audit trail cannot meet regulatory evidence retention requirements.",
            "root_cause": "Fragmented logging architecture and manual reconciliation steps.",
            "contributing_factors": "Aging infrastructure and limited integration with IAM platform.",
            "impact_assessment": "High risk of non-compliance during regulatory inspections.",
            "current_controls": "Manual log exports reviewed monthly by compliance analyst.",
            "evidence": [{"name": "Risk_Assessment_Summary.pdf"}],
            "action_plan": "<p>Implement centralized immutable logging platform with automated reconciliation and alerting.</p>",
            "implementation_steps": [
                {
                    "id": "CA-2025-002-step-1",
                    "stepNumber": 1,
                    "description": "Design target-state logging architecture with IAM integration.",
                    "responsiblePerson": "Maria Chen",
                    "dueDate": _d("2025-03-01"),
                    "status": "In Progress",
                    "resourcesRequired": "Solutions architect, IAM analyst",
                    "successCriteria": "Design approved by security architecture board",
                    "progressNotes": "Architecture draft awaiting IAM input.",
                },
                {
                    "id": "CA-2025-002-step-2",
                    "stepNumber": 2,
                    "description": "Select tooling for immutable log storage and alerting.",
                    "responsiblePerson": "Rahul Iyer",
                    "dueDate": _d("2025-03-28"),
                    "status": "Not Started",
                    "resourcesRequired": "Vendor evaluation matrix, procurement support",
                    "successCriteria": "Tool selection signed off with budget",
                },
            ],
            "communication_log": [
                {
                    "id": "CA-2025-002-log-1",
                    "timestamp": _dt("2025-02-05T13:00:00"),
                    "updateType": "Review",
                    "user": "Internal Audit",
                    "description": "Confirmed scope aligns with regulatory commitments.",
                    "attachments": [],
                }
            ],
            "effectiveness_evaluation": {
                "evaluation_due_date": _d("2025-06-30"),
                "evaluation_method": "Audit",
                "success_metrics": [
                    {
                        "name": "Log immutability",
                        "targetValue": "100%",
                        "actualValue": None,
                        "measurementMethod": "Security validation",
                        "measurementDate": None,
                    },
                    {
                        "name": "Alert latency",
                        "targetValue": "< 5 min",
                        "actualValue": None,
                        "measurementMethod": "Monitoring report",
                        "measurementDate": None,
                    },
                ],
                "rating": "Not Rated",
                "comments": "Awaiting implementation",
                "further_actions_required": False,
                "follow_up_actions": None,
            },
            "ai_metadata": {
                "effectiveness_score": 0.62,
                "risk_score": 0.9,
                "priority_score": 0.94,
            },
            "open_issues": [],
        },
        "CA-2025-003": {
            "id": "CA-2025-003",
            "title": "Refresh compliance training library",
            "type": "Improvement Action",
            "source": "Management Review",
            "reference_id": "MR-2024-019",
            "departments": ["Compliance", "Human Resources"],
            "priority": "Medium",
            "impact": "Medium",
            "urgency": "Medium",
            "status": "Completed",
            "owner": "Alex Martinez",
            "review_team": ["Learning & Development", "Compliance"],
            "due_date": _d("2025-02-20"),
            "completed_on": _d("2025-02-12"),
            "created_on": _dt("2024-12-15T10:45:00"),
            "last_updated": _dt("2025-02-12T17:10:00"),
            "progress": 100,
            "problem_statement": "Training completion scores declining below target.",
            "root_cause": "Content outdated and not scenario-based.",
            "contributing_factors": "Limited localization and engagement.",
            "impact_assessment": "Employee readiness impacted; regulatory training obligations at risk.",
            "current_controls": "Annual content review with manual updates.",
            "evidence": [
                {"name": "Training_Completion_Report.pdf"},
                {"name": "Feedback_Survey_2024.xlsx"},
            ],
            "action_plan": "<p>Introduce modular micro-learning with quarterly refresh cadence and region-specific scenarios.</p>",
            "implementation_steps": [
                {
                    "id": "CA-2025-003-step-1",
                    "stepNumber": 1,
                    "description": "Audit existing course catalog and retire outdated modules.",
                    "responsiblePerson": "Alex Martinez",
                    "dueDate": _d("2025-01-10"),
                    "status": "Completed",
                    "resourcesRequired": "Course audit checklist",
                    "successCriteria": "Obsolete modules archived",
                    "completionDate": _d("2025-01-08"),
                },
                {
                    "id": "CA-2025-003-step-2",
                    "stepNumber": 2,
                    "description": "Design new scenario-based modules with localization.",
                    "responsiblePerson": "L&D Team",
                    "dueDate": _d("2025-01-30"),
                    "status": "Completed",
                    "completionDate": _d("2025-01-28"),
                    "successCriteria": "Regional leads approve localized content",
                },
                {
                    "id": "CA-2025-003-step-3",
                    "stepNumber": 3,
                    "description": "Launch communication campaign and track completion.",
                    "responsiblePerson": "Communications",
                    "dueDate": _d("2025-02-12"),
                    "status": "Completed",
                    "completionDate": _d("2025-02-12"),
                    "successCriteria": "Completion rates improved by 20%",
                },
            ],
            "communication_log": [
                {
                    "id": "CA-2025-003-log-1",
                    "timestamp": _dt("2025-01-29T09:15:00"),
                    "updateType": "Progress Update",
                    "user": "Alex Martinez",
                    "description": "Localized modules finalized; translation QA complete.",
                    "attachments": [],
                },
                {
                    "id": "CA-2025-003-log-2",
                    "timestamp": _dt("2025-02-12T12:05:00"),
                    "updateType": "Review",
                    "user": "Learning & Development",
                    "description": "Campaign launch achieved 92% completion within first week.",
                    "attachments": [],
                },
            ],
            "effectiveness_evaluation": {
                "evaluation_due_date": _d("2025-03-15"),
                "evaluation_method": "Survey",
                "success_metrics": [
                    {
                        "name": "Training completion",
                        "targetValue": "95%",
                        "actualValue": "96%",
                        "measurementMethod": "LMS report",
                        "measurementDate": _d("2025-02-12"),
                    },
                    {
                        "name": "Knowledge retention",
                        "targetValue": "80%",
                        "actualValue": "84%",
                        "measurementMethod": "Post-training assessment",
                        "measurementDate": _d("2025-02-10"),
                    },
                ],
                "rating": "Effective",
                "comments": "Engagement scores exceeded plan.",
                "further_actions_required": False,
                "follow_up_actions": None,
            },
            "ai_metadata": {
                "effectiveness_score": 0.9,
                "risk_score": 0.35,
                "priority_score": 0.52,
            },
            "open_issues": [],
        },
        "CA-2025-004": {
            "id": "CA-2025-004",
            "title": "Address recurring environmental audit findings",
            "type": "Short-term Corrective Action",
            "source": "Audit Finding",
            "reference_id": "ENV-2024-077",
            "departments": ["Facilities", "Operations"],
            "priority": "High",
            "impact": "Critical",
            "urgency": "High",
            "status": "In Progress",
            "owner": "Lena Ortiz",
            "review_team": ["EHS Director", "Operations VP"],
            "due_date": _d("2025-02-25"),
            "completed_on": None,
            "created_on": _dt("2024-12-05T08:40:00"),
            "last_updated": _dt("2025-02-20T08:10:00"),
            "progress": 48,
            "problem_statement": "Repeat findings around waste segregation and spill response readiness.",
            "root_cause": "Inconsistent supervisor oversight and outdated response kits.",
            "contributing_factors": "High turnover in frontline teams and inadequate refresher drills.",
            "impact_assessment": "Regulatory fines and operational disruption risk if non-compliance persists.",
            "current_controls": "Monthly site checks and quarterly drills.",
            "evidence": [{"name": "EHS_Audit_Report.pdf"}],
            "action_plan": "<p>Reinforce waste segregation standards, modernize response kits, and automate inspection reminders.</p>",
            "implementation_steps": [
                {
                    "id": "CA-2025-004-step-1",
                    "stepNumber": 1,
                    "description": "Replace outdated spill response kits across facilities.",
                    "responsiblePerson": "Lena Ortiz",
                    "dueDate": _d("2025-01-20"),
                    "status": "Completed",
                    "completionDate": _d("2025-01-18"),
                    "resourcesRequired": "Procurement budget, vendor coordination",
                },
                {
                    "id": "CA-2025-004-step-2",
                    "stepNumber": 2,
                    "description": "Launch targeted supervisor training on waste segregation checks.",
                    "responsiblePerson": "Training Team",
                    "dueDate": _d("2025-02-10"),
                    "status": "Delayed",
                    "resourcesRequired": "Training rooms, facilitator",
                    "issues": "Severe weather postponed two regional sessions.",
                },
                {
                    "id": "CA-2025-004-step-3",
                    "stepNumber": 3,
                    "description": "Implement digital inspection app with automated reminders.",
                    "responsiblePerson": "IT Operations",
                    "dueDate": _d("2025-02-28"),
                    "status": "In Progress",
                    "progressNotes": "Pilot underway at two facilities.",
                },
            ],
            "communication_log": [
                {
                    "id": "CA-2025-004-log-1",
                    "timestamp": _dt("2025-02-11T15:25:00"),
                    "updateType": "Timeline Change",
                    "user": "Training Team",
                    "description": "Training rescheduled to Feb 20 due to weather closures.",
                    "attachments": [{"name": "Training_Reschedule.pdf"}],
                },
                {
                    "id": "CA-2025-004-log-2",
                    "timestamp": _dt("2025-02-20T09:00:00"),
                    "updateType": "Issue Report",
                    "user": "Lena Ortiz",
                    "description": "Need temporary staff coverage to complete kit deployment.",
                    "attachments": [],
                },
            ],
            "effectiveness_evaluation": {
                "evaluation_due_date": _d("2025-04-01"),
                "evaluation_method": "Metrics review",
                "success_metrics": [
                    {
                        "name": "Inspection completion",
                        "targetValue": "100%",
                        "actualValue": "78%",
                        "measurementMethod": "Inspection app dashboard",
                        "measurementDate": _d("2025-02-19"),
                    },
                    {
                        "name": "Incident response time",
                        "targetValue": "< 4 min",
                        "actualValue": "5.5 min",
                        "measurementMethod": "Drill assessment",
                        "measurementDate": _d("2025-02-17"),
                    },
                ],
                "rating": "Partially Effective",
                "comments": "Weather disruptions slowed roll-out; corrective steps in place.",
                "further_actions_required": True,
                "follow_up_actions": "Add temporary coverage and extend training window.",
            },
            "ai_metadata": {
                "effectiveness_score": 0.58,
                "risk_score": 0.76,
                "priority_score": 0.81,
            },
            "open_issues": [
                {"id": "issue-2025-104", "description": "Supervisor training delayed"},
                {"id": "issue-2025-105", "description": "Temporary staffing gap"},
            ],
        },
        "CA-2025-005": {
            "id": "CA-2025-005",
            "title": "Improve customer escalation response workflow",
            "type": "Short-term Corrective Action",
            "source": "Customer Complaint",
            "reference_id": "CUST-2025-008",
            "departments": ["Customer Support", "Operations"],
            "priority": "Medium",
            "impact": "High",
            "urgency": "Medium",
            "status": "Completed",
            "owner": "Priya Patel",
            "review_team": ["Customer Success", "Compliance"],
            "due_date": _d("2025-01-25"),
            "completed_on": _d("2025-01-22"),
            "created_on": _dt("2024-11-28T14:05:00"),
            "last_updated": _dt("2025-01-22T18:00:00"),
            "progress": 100,
            "problem_statement": "Escalations lacked consistent root cause tracking leading to repeat issues.",
            "root_cause": "Manual routing and absence of feedback loop with operations.",
            "contributing_factors": "Disparate ticketing systems and limited analytics.",
            "impact_assessment": "Customer churn risk and compliance with service level obligations impacted.",
            "current_controls": "Weekly manual review by escalation manager.",
            "evidence": [{"name": "Escalation_Trend_Report.pdf"}],
            "action_plan": "<p>Create unified escalation playbook with analytics dashboard and automated routing.</p>",
            "implementation_steps": [
                {
                    "id": "CA-2025-005-step-1",
                    "stepNumber": 1,
                    "description": "Consolidate escalation intake channels into unified queue.",
                    "responsiblePerson": "Priya Patel",
                    "dueDate": _d("2024-12-20"),
                    "status": "Completed",
                    "completionDate": _d("2024-12-18"),
                },
                {
                    "id": "CA-2025-005-step-2",
                    "stepNumber": 2,
                    "description": "Implement analytics dashboard for root cause trending.",
                    "responsiblePerson": "Data Analytics",
                    "dueDate": _d("2025-01-10"),
                    "status": "Completed",
                    "completionDate": _d("2025-01-08"),
                },
                {
                    "id": "CA-2025-005-step-3",
                    "stepNumber": 3,
                    "description": "Train escalation managers on new workflow and metrics.",
                    "responsiblePerson": "Customer Success",
                    "dueDate": _d("2025-01-20"),
                    "status": "Completed",
                    "completionDate": _d("2025-01-19"),
                },
            ],
            "communication_log": [
                {
                    "id": "CA-2025-005-log-1",
                    "timestamp": _dt("2025-01-12T11:30:00"),
                    "updateType": "Progress Update",
                    "user": "Priya Patel",
                    "description": "Dashboard live; early alerts highlight backlog drivers.",
                    "attachments": [],
                }
            ],
            "effectiveness_evaluation": {
                "evaluation_due_date": _d("2025-02-28"),
                "evaluation_method": "Metrics review",
                "success_metrics": [
                    {
                        "name": "Escalation resolution time",
                        "targetValue": "< 24 hrs",
                        "actualValue": "18 hrs",
                        "measurementMethod": "Support analytics",
                        "measurementDate": _d("2025-01-25"),
                    },
                    {
                        "name": "Repeat escalations",
                        "targetValue": "< 5%",
                        "actualValue": "3%",
                        "measurementMethod": "Operations dashboard",
                        "measurementDate": _d("2025-01-24"),
                    },
                ],
                "rating": "Effective",
                "comments": "Workflow stabilized and reporting automated.",
                "further_actions_required": False,
                "follow_up_actions": None,
            },
            "ai_metadata": {
                "effectiveness_score": 0.88,
                "risk_score": 0.42,
                "priority_score": 0.6,
            },
            "open_issues": [],
        },
    }


_seed_actions()


BASELINE_METRICS = {
    "total_actions": 22,
    "open_actions": 11,
    "overdue_actions": 6,
    "completed_this_month": 5,
    "effectiveness_rating": 74.0,
}


COMPLETION_TREND = [
    {"period": "Oct", "completed": 6, "overdue": 3, "forecast": 7},
    {"period": "Nov", "completed": 5, "overdue": 4, "forecast": 6},
    {"period": "Dec", "completed": 7, "overdue": 3, "forecast": 8},
    {"period": "Jan", "completed": 8, "overdue": 2, "forecast": 7},
    {"period": "Feb", "completed": 9, "overdue": 2, "forecast": 9},
]


STATUS_ORDER = ["Open", "In Progress", "Completed", "Closed", "Cancelled", "Overdue"]


def _actions() -> List[Dict[str, Any]]:
    return list(ACTION_REGISTRY.values())


def _serialize_table_action(action: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": action["id"],
        "title": action["title"],
        "type": action["type"],
        "source": action.get("source"),
        "departments": action.get("departments", []),
        "priority": action.get("priority"),
        "impact": action.get("impact"),
        "urgency": action.get("urgency"),
        "status": action.get("status"),
        "owner": action.get("owner"),
        "dueDate": action.get("due_date"),
        "progress": action.get("progress", 0),
        "effectivenessScore": round(action.get("ai_metadata", {}).get("effectiveness_score", 0) * 100, 1),
        "priorityScore": round(action.get("ai_metadata", {}).get("priority_score", 0) * 100, 1),
    }


def _calculate_summary(actions: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = len(actions)
    open_actions = sum(1 for action in actions if action["status"] in {"Open", "In Progress"})
    overdue_actions = sum(
        1
        for action in actions
        if action.get("due_date")
        and action["status"] not in {"Completed", "Closed", "Cancelled"}
        and action["due_date"] < TODAY
    )
    completed_this_month = sum(
        1
        for action in actions
        if action["status"] == "Completed"
        and action.get("completed_on")
        and action["completed_on"].month == TODAY.month
        and action["completed_on"].year == TODAY.year
    )

    engine = CorrectiveActionAIEngine(reference_date=TODAY)
    snapshots = build_snapshots(actions)
    effectiveness_scores = engine.effectiveness_scores(snapshots)
    avg_effectiveness = (
        sum(item["score"] for item in effectiveness_scores) / len(effectiveness_scores)
        if effectiveness_scores
        else BASELINE_METRICS["effectiveness_rating"]
    )

    def _trend(current: float, baseline_key: str, invert: bool = False) -> Dict[str, Any]:
        baseline = BASELINE_METRICS[baseline_key]
        delta = round(current - baseline, 1)
        if abs(delta) < 0.1:
            direction = "flat"
        else:
            if invert:
                direction = "down" if delta < 0 else "up"
            else:
                direction = "up" if delta > 0 else "down"
        return {"value": current, "trend": delta, "direction": direction}

    return {
        "totalActions": _trend(total, "total_actions"),
        "openActions": _trend(open_actions, "open_actions"),
        "overdueActions": _trend(overdue_actions, "overdue_actions", invert=True),
        "completedThisMonth": _trend(completed_this_month, "completed_this_month"),
        "effectivenessRating": _trend(round(avg_effectiveness, 1), "effectiveness_rating"),
    }


def _build_status_distribution(actions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    counter: Counter[str] = Counter()
    for action in actions:
        status = action.get("status", "Open")
        counter[status] += 1
        if (
            action.get("due_date")
            and action["status"] not in {"Completed", "Closed", "Cancelled"}
            and action["due_date"] < TODAY
        ):
            counter["Overdue"] += 1
    results = [
        {"status": status, "count": counter.get(status, 0)}
        for status in STATUS_ORDER
        if counter.get(status)
    ]
    return results


def _build_department_distribution(actions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    department_map: Dict[str, Dict[str, int]] = defaultdict(lambda: {"open": 0, "inProgress": 0, "completed": 0, "overdue": 0})
    for action in actions:
        departments = action.get("departments", []) or ["Unassigned"]
        for department in departments:
            data = department_map[department]
            status = action.get("status")
            if status == "Completed":
                data["completed"] += 1
            elif status in {"Closed", "Cancelled"}:
                data["completed"] += 1
            elif status == "In Progress":
                data["inProgress"] += 1
            else:
                data["open"] += 1
            if (
                action.get("due_date")
                and action["status"] not in {"Completed", "Closed", "Cancelled"}
                and action["due_date"] < TODAY
            ):
                data["overdue"] += 1
    return [
        {
            "department": department,
            "open": counts["open"],
            "inProgress": counts["inProgress"],
            "completed": counts["completed"],
            "overdue": counts["overdue"],
        }
        for department, counts in sorted(department_map.items())
    ]


def _build_type_distribution(actions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    counter: Counter[str] = Counter(action.get("type", "Corrective Action") for action in actions)
    return [
        {"type": key, "count": counter[key]}
        for key in sorted(counter.keys())
    ]


def _priority_lists(actions: List[Dict[str, Any]]) -> Dict[str, Any]:
    high_priority = [
        action
        for action in actions
        if action.get("priority") in {"High", "Critical"}
    ]
    overdue = [
        action
        for action in actions
        if action.get("due_date")
        and action["status"] not in {"Completed", "Closed", "Cancelled"}
        and action["due_date"] < TODAY
    ]
    due_this_week = [
        action
        for action in actions
        if action.get("due_date")
        and 0 <= (action["due_date"] - TODAY).days <= 7
        and action["status"] not in {"Completed", "Closed", "Cancelled"}
    ]
    recently_completed = [
        action
        for action in actions
        if action.get("completed_on")
        and (TODAY - action["completed_on"]).days <= 30
    ]

    high_priority.sort(key=lambda item: item.get("ai_metadata", {}).get("priority_score", 0), reverse=True)
    overdue.sort(key=lambda item: item.get("due_date") or TODAY)
    due_this_week.sort(key=lambda item: item.get("due_date") or TODAY)
    recently_completed.sort(key=lambda item: item.get("completed_on"), reverse=True)

    def _serialize(actions_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [
            {
                **_serialize_table_action(action),
                "dueDate": action.get("due_date"),
                "completedOn": action.get("completed_on"),
            }
            for action in actions_list
        ]

    return {
        "highPriority": _serialize(high_priority),
        "overdue": _serialize(overdue),
        "dueThisWeek": _serialize(due_this_week),
        "recentlyCompleted": _serialize(recently_completed),
    }


@router.get("/dashboard")
def get_dashboard() -> Dict[str, Any]:
    actions = _actions()
    snapshots = build_snapshots(actions)
    engine = CorrectiveActionAIEngine(reference_date=TODAY)

    summary = _calculate_summary(actions)
    analytics = {
        "statusDistribution": _build_status_distribution(actions),
        "actionsByDepartment": _build_department_distribution(actions),
        "actionTypeDistribution": _build_type_distribution(actions),
        "completionTrend": COMPLETION_TREND,
    }

    ai_insights = {
        "effectivenessScores": engine.effectiveness_scores(snapshots),
        "priorityRanking": engine.rank_priorities(snapshots),
        "resourceRecommendations": engine.recommend_resources(snapshots),
        "escalationPaths": engine.suggest_escalations(snapshots),
    }

    return {
        "summary": summary,
        "analytics": analytics,
        "priorityLists": _priority_lists(actions),
        "actions": [_serialize_table_action(action) for action in actions],
        "aiInsights": ai_insights,
    }


@router.get("/actions/{action_id}")
def get_action_detail(action_id: str) -> Dict[str, Any]:
    action = ACTION_REGISTRY.get(action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Corrective action not found")

    engine = CorrectiveActionAIEngine(reference_date=TODAY)
    snapshot = build_snapshots([action])[0]
    ai_intelligence = engine.analyze_action(snapshot)

    overall_progress = _calculate_overall_progress(action)

    return {
        "id": action["id"],
        "title": action["title"],
        "status": action["status"],
        "type": action["type"],
        "priority": action["priority"],
        "impact": action["impact"],
        "urgency": action["urgency"],
        "owner": action["owner"],
        "reviewTeam": action.get("review_team", []),
        "departments": action.get("departments", []),
        "source": action.get("source"),
        "referenceId": action.get("reference_id"),
        "progress": overall_progress,
        "dueDate": action.get("due_date"),
        "daysToDueDate": _days_to_due(action.get("due_date")),
        "lastUpdated": action.get("last_updated"),
        "problemStatement": action.get("problem_statement"),
        "rootCause": action.get("root_cause"),
        "contributingFactors": action.get("contributing_factors"),
        "impactAssessment": action.get("impact_assessment"),
        "currentControls": action.get("current_controls"),
        "evidence": action.get("evidence", []),
        "implementationSteps": action.get("implementation_steps", []),
        "communicationLog": action.get("communication_log", []),
        "effectivenessEvaluation": action.get("effectiveness_evaluation"),
        "aiIntelligence": ai_intelligence,
    }


def _calculate_overall_progress(action: Dict[str, Any]) -> int:
    steps = action.get("implementation_steps", [])
    if not steps:
        return int(action.get("progress", 0))
    total = len(steps)
    score = 0.0
    for step in steps:
        status = step.get("status")
        if status == "Completed":
            score += 1
        elif status == "In Progress":
            score += 0.5
        elif status == "Delayed":
            score += 0.25
    return int(round((score / total) * 100))


def _days_to_due(due_date: Optional[date]) -> Optional[int]:
    if not due_date:
        return None
    return (due_date - TODAY).days


@router.post("/actions", response_model=ActionCreateResponse)
def create_action(payload: ActionCreatePayload) -> ActionCreateResponse:
    new_id = _generate_action_id()
    risk_score = _risk_score(payload.priority, payload.impact, payload.urgency)
    ai_metadata = {
        "effectiveness_score": (payload.predicted_success_probability or 68) / 100,
        "risk_score": risk_score,
        "priority_score": min(1.0, 0.35 + risk_score + (PRIORITY_WEIGHTS.get(payload.priority, 0.4) * 0.2)),
    }

    steps = []
    for index, step in enumerate(payload.implementation_steps, start=1):
        steps.append(
            {
                "id": f"{new_id}-step-{index}",
                "stepNumber": index,
                "description": step.step_description,
                "responsiblePerson": step.responsible_person or payload.action_owner,
                "dueDate": step.due_date,
                "status": "Not Started",
                "resourcesRequired": step.resources_required,
                "successCriteria": step.success_criteria,
                "progressNotes": None,
            }
        )

    action_record = {
        "id": new_id,
        "title": payload.action_title,
        "type": payload.action_type,
        "source": payload.source_reference,
        "reference_id": payload.reference_id,
        "departments": payload.departments,
        "priority": payload.priority,
        "impact": payload.impact,
        "urgency": payload.urgency,
        "status": "Open",
        "owner": payload.action_owner,
        "review_team": payload.review_team,
        "due_date": payload.overall_due_date,
        "completed_on": None,
        "created_on": datetime.utcnow(),
        "last_updated": datetime.utcnow(),
        "progress": 0,
        "problem_statement": payload.problem_statement,
        "root_cause": payload.root_cause,
        "contributing_factors": payload.contributing_factors,
        "impact_assessment": payload.impact_assessment,
        "current_controls": payload.current_controls,
        "evidence": [{"name": name} for name in payload.evidence],
        "action_plan": payload.action_plan_description,
        "implementation_steps": steps,
        "communication_log": [],
        "effectiveness_evaluation": {
            "evaluation_due_date": payload.overall_due_date + timedelta(days=30),
            "evaluation_method": "Metrics review",
            "success_metrics": [
                {
                    "name": "Primary success metric",
                    "targetValue": "Defined at kickoff",
                    "actualValue": None,
                    "measurementMethod": "To be confirmed",
                    "measurementDate": None,
                }
            ],
            "rating": "Not Rated",
            "comments": None,
            "further_actions_required": False,
            "follow_up_actions": None,
        },
        "ai_metadata": ai_metadata,
        "open_issues": [],
    }

    ACTION_REGISTRY[new_id] = action_record

    engine = CorrectiveActionAIEngine(reference_date=TODAY)
    ai_assessment = engine.analyze_action(build_snapshots([action_record])[0])

    return ActionCreateResponse(
        action_id=new_id,
        status="created",
        ai_assessment=ai_assessment,
    )


def _risk_score(priority: str, impact: str, urgency: str) -> float:
    priority_component = PRIORITY_WEIGHTS.get(priority, 0.4)
    impact_component = PRIORITY_WEIGHTS.get(impact, 0.4)
    urgency_component = URGENCY_WEIGHTS.get(urgency, 0.45)
    return min(1.0, 0.35 + 0.4 * priority_component + 0.2 * impact_component + 0.15 * urgency_component)


_ACTION_SEQUENCE = max(int(key.split("-")[-1]) for key in ACTION_REGISTRY.keys())


def _generate_action_id() -> str:
    global _ACTION_SEQUENCE
    _ACTION_SEQUENCE += 1
    return f"CA-{TODAY.year}-{_ACTION_SEQUENCE:03d}"


@router.post("/actions/ai/plan")
def generate_ai_plan(payload: ActionPlanAIRequest) -> Dict[str, Any]:
    engine = CorrectiveActionAIEngine(reference_date=TODAY)
    result = engine.generate_action_plan(
        {
            "actionTitle": payload.action_title,
            "actionType": payload.action_type,
            "problemStatement": payload.problem_statement,
            "rootCause": payload.root_cause,
            "impact": payload.impact,
            "urgency": payload.urgency,
            "departments": payload.departments,
        }
    )
    return result
