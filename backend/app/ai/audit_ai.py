import json
import os
from datetime import datetime
from pathlib import Path
from statistics import mean
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from openai import OpenAI


def _prime_env() -> None:
    """Ensure environment variables from .env files are loaded."""

    current_path = Path(__file__).resolve()
    for parent in current_path.parents:
        env_path = parent / ".env"
        if env_path.exists():
            load_dotenv(env_path, override=False)

    if not os.getenv("OPENAI_API_KEY"):
        load_dotenv(override=False)


_prime_env()

_client: Optional[OpenAI] = None
_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set. Please configure it before using AI features.")
        _client = OpenAI(api_key=api_key)
    return _client


def _complete(system: str, user: str, *, temperature: float = 0.3, max_tokens: int = 900) -> str:
    client = _get_client()
    response = client.chat.completions.create(
        model=_model,
        temperature=temperature,
        max_tokens=max_tokens,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    return (response.choices[0].message.content or "").strip()


def _complete_json(system: str, payload: Dict[str, Any], *, temperature: float = 0.3, max_tokens: int = 900) -> Dict[str, Any]:
    raw = _complete(system, json.dumps(payload, ensure_ascii=False), temperature=temperature, max_tokens=max_tokens)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                data = json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                data = {"raw": raw}
        else:
            data = {"raw": raw}

    if not isinstance(data, dict):
        return {"raw": raw}
    if "raw" not in data:
        data["raw"] = raw
    return data


def _call_or_fallback(system: str, payload: Dict[str, Any], fallback: Dict[str, Any]) -> Dict[str, Any]:
    try:
        result = _complete_json(system, payload)
        return result
    except RuntimeError:
        return fallback
    except Exception:
        return fallback


def _infer_frameworks(audit_type: str) -> List[str]:
    mapping = {
        "Internal Audit": ["Internal Controls"],
        "Compliance Audit": ["ISO 27001", "SOC 2"],
        "Quality Management System Audit": ["ISO 9001"],
        "Financial Audit": ["IFRS", "SOX"],
        "IT/Security Audit": ["NIST CSF", "ISO 27001"],
        "Operational Audit": ["Lean", "Six Sigma"],
        "Environmental Audit": ["ISO 14001"],
        "Health & Safety Audit": ["ISO 45001"],
    }
    return mapping.get(audit_type, ["Internal Standards"])


def _infer_risk(audit_type: str, department: Optional[str]) -> str:
    critical_types = {"IT/Security Audit", "Compliance Audit", "Financial Audit"}
    if audit_type in critical_types:
        return "High"
    if department and department.lower() in {"information security", "finance", "legal"}:
        return "High"
    return "Medium"


def generate_basic_info_suggestions(
    *,
    audit_type: str,
    department: Optional[str] = None,
    scope: Optional[str] = None,
    objective: Optional[str] = None,
    compliance_frameworks: Optional[List[str]] = None,
) -> Dict[str, Any]:
    payload = {
        "audit_type": audit_type,
        "department": department,
        "existing_scope": scope,
        "existing_objective": objective,
        "existing_frameworks": compliance_frameworks or [],
    }

    fallback = {
        "suggested_scope": scope
        or f"Evaluate key processes within {department or 'the organisation'} to confirm control effectiveness",
        "suggested_objective": objective
        or f"Confirm that {department or 'the organisation'} meets obligations for the selected audit type",
        "suggested_frameworks": compliance_frameworks or _infer_frameworks(audit_type),
        "predicted_risk_level": _infer_risk(audit_type, department),
        "notes": [
            "Scope tailored from historical audits",
            "Objectives aligned with regulatory expectations",
        ],
    }

    system = (
        "You assist audit programme managers in preparing audit briefs. "
        "Return JSON with keys suggested_scope, suggested_objective, suggested_frameworks (list), "
        "predicted_risk_level, and notes (list of insights)."
    )
    return _call_or_fallback(system, payload, fallback)


def generate_schedule_suggestions(
    *,
    start_date: Optional[str],
    end_date: Optional[str],
    team: Optional[List[str]] = None,
    lead_auditor: Optional[str] = None,
    department: Optional[str] = None,
    risk_level: Optional[str] = None,
    existing_duration_hours: Optional[int] = None,
) -> Dict[str, Any]:
    payload = {
        "start_date": start_date,
        "end_date": end_date,
        "team": team or [],
        "lead_auditor": lead_auditor,
        "department": department,
        "risk_level": risk_level,
        "existing_duration_hours": existing_duration_hours,
    }

    fallback_duration = existing_duration_hours
    if fallback_duration is None and start_date and end_date:
        try:
            start = datetime.fromisoformat(start_date)
            end = datetime.fromisoformat(end_date)
            fallback_duration = max(int((end - start).total_seconds() // 3600) or 8, 8)
        except ValueError:
            fallback_duration = 24
    fallback_duration = fallback_duration or 24

    fallback = {
        "estimated_duration_hours": fallback_duration,
        "team_recommendations": team or [lead_auditor or "Lead Auditor", "Process Owner"],
        "resource_conflicts": [],
        "meeting_room_suggestion": "Large collaboration space",
        "timeline_notes": [
            "Include one-day buffer for evidence validation",
            "Schedule stakeholder close-out within 48 hours of fieldwork",
        ],
    }

    system = (
        "You optimise audit schedules. "
        "Return JSON with keys estimated_duration_hours (int), team_recommendations (list of strings), "
        "resource_conflicts (list of strings), meeting_room_suggestion (string), timeline_notes (list of strings)."
    )

    return _call_or_fallback(system, payload, fallback)


def generate_checklist_suggestions(
    *,
    audit_type: str,
    department: Optional[str] = None,
    compliance_frameworks: Optional[List[str]] = None,
    risk_level: Optional[str] = None,
) -> Dict[str, Any]:
    payload = {
        "audit_type": audit_type,
        "department": department,
        "frameworks": compliance_frameworks or [],
        "risk_level": risk_level,
    }

    fallback_sections: List[Dict[str, Any]] = [
        {
            "title": "Governance & Planning",
            "description": "Confirm governance structure, responsibilities and planning discipline",
            "weight": 20,
            "required": True,
            "questions": [
                {
                    "text": "Is there a documented governance charter covering this process?",
                    "type": "Yes/No",
                    "evidence_required": True,
                    "risk_impact": risk_level or "Medium",
                },
                {
                    "text": "How frequently are risk assessments updated for the department?",
                    "type": "Text",
                    "risk_impact": "High",
                },
            ],
        },
        {
            "title": "Control Effectiveness",
            "description": "Validate design and operating effectiveness of critical controls",
            "weight": 40,
            "required": True,
            "questions": [
                {
                    "text": "Select the statement that best describes control testing coverage",
                    "type": "Multiple Choice",
                    "evidence_required": True,
                    "risk_impact": "High",
                }
            ],
        },
        {
            "title": "Improvement Opportunities",
            "description": "Capture observations and maturity opportunities",
            "weight": 20,
            "required": False,
            "questions": [
                {
                    "text": "Rate the overall process maturity",
                    "type": "Rating",
                    "scoring_weight": 5,
                    "risk_impact": "Medium",
                }
            ],
        },
    ]

    fallback = {
        "sections": fallback_sections,
        "risk_alignment_notes": [
            "Questions emphasise control assurance for elevated risk areas",
            "Include evidence upload prompts for critical controls",
        ],
    }

    system = (
        "You design audit checklists. "
        "Return JSON with keys sections (list of section objects with title, description, weight, required, questions array) "
        "and risk_alignment_notes (list of strings). Questions should include text, type, optional scoring_weight, "
        "risk_impact, guidance_notes, evidence_required."
    )

    return _call_or_fallback(system, payload, fallback)


def generate_communication_suggestions(
    *,
    audit_title: str,
    recipients: Optional[List[str]] = None,
    include_daily_reminders: bool = False,
) -> Dict[str, Any]:
    payload = {
        "audit_title": audit_title,
        "recipients": recipients or [],
        "include_daily_reminders": include_daily_reminders,
    }

    fallback = {
        "announcement_email": (
            f"Subject: Kick-off for {audit_title}\n\n"
            "Hello team,\n\nWe are commencing the audit as scheduled. Please ensure key documents are available.\n"
            "Regards, Audit Lead"
        ),
        "daily_reminder_email": (
            "Subject: Daily Audit Update\n\n"
            "Hello all,\n\nHere is your reminder to update evidence trackers and respond to open requests.\n"
            "Thank you."
        ),
        "completion_email": (
            f"Subject: {audit_title} Completed\n\n"
            "Thank you for your collaboration. Findings and next steps will be shared shortly."
        ),
        "distribution_insights": [
            "Include department leadership on announcements",
            "Add process owners for daily reminders only",
        ],
    }

    system = (
        "You craft communication plans for audits. "
        "Return JSON with keys announcement_email, daily_reminder_email, completion_email, distribution_insights (list)."
    )

    return _call_or_fallback(system, payload, fallback)


def generate_launch_review(
    *,
    audit_title: str,
    start_date: Optional[str],
    end_date: Optional[str],
    risk_level: Optional[str],
    team: Optional[List[str]] = None,
    notifications_enabled: Optional[Dict[str, bool]] = None,
    duration_hours: Optional[int] = None,
) -> Dict[str, Any]:
    payload = {
        "audit_title": audit_title,
        "start_date": start_date,
        "end_date": end_date,
        "risk_level": risk_level,
        "team": team or [],
        "notifications_enabled": notifications_enabled or {},
        "duration_hours": duration_hours,
    }

    fallback_success = 0.78
    if risk_level in {"High", "Critical"}:
        fallback_success -= 0.08
    if team and len(team) >= 3:
        fallback_success += 0.05

    fallback = {
        "readiness_summary": (
            "Schedule is balanced with minor optimisation opportunities."
            " Ensure stakeholder briefings are confirmed before launch."
        ),
        "success_probability": round(max(min(fallback_success, 0.93), 0.55), 2),
        "launch_recommendation": "Launch Immediately" if fallback_success >= 0.8 else "Schedule for Later",
        "follow_up_actions": [
            "Validate evidence repository access for the team",
            "Confirm close-out meeting availability",
        ],
    }

    system = (
        "You review audit launch readiness. "
        "Return JSON with keys readiness_summary, success_probability (0-1 float), launch_recommendation, follow_up_actions (list)."
    )

    return _call_or_fallback(system, payload, fallback)


def generate_dashboard_insights(audits: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not audits:
        return {
            "scheduling_priority": "No scheduled audits",
            "resource_hotspots": [],
            "duration_trend_hours": 0,
            "notes": ["Create your first audit to unlock insights."],
        }

    high_risk = [a for a in audits if a.get("risk_level") in {"High", "Critical"}]
    upcoming = sorted(
        audits,
        key=lambda a: datetime.fromisoformat(a["start_date"]),
    )
    duration_values = [a.get("estimated_duration_hours") or 24 for a in audits]

    return {
        "scheduling_priority": high_risk[0]["title"] if high_risk else upcoming[0]["title"],
        "resource_hotspots": list({a.get("department") for a in high_risk if a.get("department")}),
        "duration_trend_hours": round(mean(duration_values), 1),
        "notes": [
            "Prioritise high-risk audits for early scheduling blocks" if high_risk else "Portfolio risk profile is balanced",
            "Average planned duration informs resourcing for upcoming engagements",
        ],
    }
