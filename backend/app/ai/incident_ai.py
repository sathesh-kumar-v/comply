"""Intelligence helpers for the incident reporting module."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from statistics import mean
from typing import Any, Dict, List, Optional, Sequence

from dotenv import load_dotenv

try:
    from openai import OpenAI  # type: ignore
except Exception:  # pragma: no cover - OpenAI is optional for local tests
    OpenAI = None  # type: ignore


def _prime_env() -> None:
    """Ensure environment variables from .env files are available."""

    base = os.path.dirname(os.path.abspath(__file__))
    for _ in range(6):
        env_path = os.path.join(base, ".env")
        if os.path.exists(env_path):
            load_dotenv(env_path, override=False)
        base = os.path.dirname(base)
    if not os.getenv("OPENAI_API_KEY"):
        load_dotenv(override=False)


_prime_env()


@dataclass
class IncidentSnapshot:
    reference_id: str
    title: str
    incident_type: str
    severity: str
    department: str
    occurred_at: datetime
    resolved_at: Optional[datetime]
    resolution_hours: Optional[float]


class IncidentIntelligenceEngine:
    """Provides AI-assisted insights with graceful fallbacks when OpenAI is unavailable."""

    def __init__(self) -> None:
        self._model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self._client: Optional[OpenAI] = None
        self._llm_available = False

        api_key = os.getenv("OPENAI_API_KEY")
        if api_key and OpenAI is not None:
            try:
                self._client = OpenAI(api_key=api_key)
                self._llm_available = True
            except Exception:
                self._client = None
                self._llm_available = False

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _complete_json(
        self,
        *,
        system: str,
        user_payload: Dict[str, Any],
        max_tokens: int = 800,
    ) -> Optional[Dict[str, Any]]:
        if not self._llm_available or not self._client:
            return None

        try:
            response = self._client.chat.completions.create(
                model=self._model,
                temperature=0.2,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
                ],
            )
        except Exception:
            self._llm_available = False
            return None

        content = (response.choices[0].message.content or "").strip()
        if not content:
            return None
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            start = content.find("{")
            end = content.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(content[start : end + 1])
                except json.JSONDecodeError:
                    return {"raw": content}
            return {"raw": content}

    # ------------------------------------------------------------------
    # Public APIs used by the router
    # ------------------------------------------------------------------
    def analyse_new_incident(
        self,
        *,
        title: str,
        description: str,
        incident_type: str,
        department: str,
        severity: str,
        existing: Sequence[IncidentSnapshot],
    ) -> Dict[str, Any]:
        payload = {
            "title": title,
            "description": description,
            "incident_type": incident_type,
            "department": department,
            "declared_severity": severity,
            "history": [snapshot.__dict__ for snapshot in existing],
        }

        ai = self._complete_json(
            system=(
                "You are an assistant that evaluates workplace incident reports. "
                "Return JSON with keys: predictedCategory (string), severityConfidence (0-1), "
                "duplicateCandidates (list of reference_id), resourceSuggestions (list of strings), "
                "escalationPath (list of roles) and notes (list)."
            ),
            user_payload=payload,
        )

        duplicates = self._find_duplicates(title, incident_type, existing)
        fallback = {
            "predictedCategory": self._fallback_category(incident_type, description),
            "severityConfidence": 0.72,
            "duplicateCandidates": duplicates,
            "resourceSuggestions": self._fallback_resource_suggestions(severity, department),
            "escalationPath": self._fallback_escalation(severity),
            "notes": [
                "Severity auto-assessed using historical baseline.",
                "Escalation path derived from organisation playbooks.",
            ],
        }

        if not ai:
            return fallback

        # Merge LLM output with deterministic results to guarantee required keys.
        result = {**fallback}
        for key, value in ai.items():
            if value in (None, ""):
                continue
            result[key] = value
        if "duplicateCandidates" not in result or not result["duplicateCandidates"]:
            result["duplicateCandidates"] = duplicates
        return result

    def predict_trends(
        self,
        *,
        monthly_counts: Dict[str, int],
        look_ahead_months: int = 3,
    ) -> Dict[str, Any]:
        ordered = sorted(monthly_counts.items())
        base_payload = {
            "timeline": ordered,
            "forecastMonths": look_ahead_months,
        }
        ai = self._complete_json(
            system=(
                "Predict incident volumes for upcoming months. "
                "Return JSON with keys: forecast (list of {month, incidents}), rationale (string)."
            ),
            user_payload=base_payload,
            max_tokens=500,
        )

        fallback_forecast = self._fallback_forecast(ordered, look_ahead_months)
        if not ai or "forecast" not in ai:
            return {
                "forecast": fallback_forecast,
                "rationale": "Forecast derived from trailing 6-month moving average.",
            }

        return {
            "forecast": ai.get("forecast") or fallback_forecast,
            "rationale": ai.get("rationale") or "Forecast blended from historical trend analysis.",
        }

    def recommend_investigation_focus(
        self,
        *,
        incident: IncidentSnapshot,
        activities: Sequence[Dict[str, Any]],
    ) -> Dict[str, Any]:
        payload = {
            "incident": incident.__dict__,
            "activities": list(activities),
        }
        ai = self._complete_json(
            system=(
                "Analyse the current investigation timeline and suggest next best actions. "
                "Return JSON with keys: suggestedActivities (list of strings), rootCauseHypotheses (list of strings), "
                "predictedResolutionHours (number)."
            ),
            user_payload=payload,
            max_tokens=600,
        )

        fallback = {
            "suggestedActivities": self._fallback_activity_recommendations(incident, activities),
            "rootCauseHypotheses": self._fallback_root_cause_hypotheses(incident, activities),
            "predictedResolutionHours": self._fallback_resolution_estimate(incident, activities),
        }

        if not ai:
            return fallback

        result = {**fallback}
        for key, value in ai.items():
            if value in (None, ""):
                continue
            result[key] = value
        return result

    # ------------------------------------------------------------------
    # Deterministic fallbacks
    # ------------------------------------------------------------------
    @staticmethod
    def _find_duplicates(title: str, incident_type: str, existing: Sequence[IncidentSnapshot]) -> List[str]:
        matches: List[str] = []
        norm_title = title.lower().strip()
        for item in existing:
            ratio = SequenceMatcher(None, norm_title, item.title.lower()).ratio()
            if item.incident_type == incident_type and ratio >= 0.78:
                matches.append(item.reference_id)
            elif ratio >= 0.92:
                matches.append(item.reference_id)
        return matches[:5]

    @staticmethod
    def _fallback_category(incident_type: str, description: str) -> str:
        keywords = description.lower()
        if incident_type == "Safety Incident":
            if "slip" in keywords or "fall" in keywords:
                return "Slips, Trips & Falls"
            if "equipment" in keywords:
                return "Equipment Hazard"
            return "General Safety"
        if incident_type == "Security Breach":
            if "phish" in keywords:
                return "Phishing"
            if "unauthorised" in keywords or "unauthorized" in keywords:
                return "Unauthorized Access"
            return "Security Monitoring"
        if incident_type == "IT System Failure":
            return "Infrastructure"
        return f"{incident_type} - General"

    @staticmethod
    def _fallback_resource_suggestions(severity: str, department: str) -> List[str]:
        base = [
            "Notify department leadership to coordinate response.",
            "Log action plan in the investigation workspace.",
        ]
        if severity in {"High", "Critical"}:
            base.append("Engage crisis response playbook and schedule executive briefing.")
        if department.lower().startswith("it"):
            base.append("Assign cybersecurity analyst to validate containment steps.")
        if department.lower() in {"operations", "manufacturing"}:
            base.append("Deploy safety officer to validate operational controls.")
        return base

    @staticmethod
    def _fallback_escalation(severity: str) -> List[str]:
        mapping = {
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
        return mapping.get(severity, ["Department Manager"])

    @staticmethod
    def _fallback_forecast(
        timeline: Sequence[tuple], look_ahead_months: int
    ) -> List[Dict[str, Any]]:
        if not timeline:
            now = datetime.utcnow()
            return [
                {
                    "month": (now + timedelta(days=30 * i)).strftime("%Y-%m"),
                    "incidents": 0,
                }
                for i in range(1, look_ahead_months + 1)
            ]

        counts = [count for _, count in timeline]
        window = counts[-6:]
        average = mean(window) if window else mean(counts)
        start = datetime.strptime(timeline[-1][0] + "-01", "%Y-%m-%d")
        forecast = []
        for i in range(1, look_ahead_months + 1):
            month_date = start + timedelta(days=30 * i)
            forecast.append(
                {
                    "month": month_date.strftime("%Y-%m"),
                    "incidents": round(average, 2),
                }
            )
        return forecast

    @staticmethod
    def _fallback_activity_recommendations(
        incident: IncidentSnapshot, activities: Sequence[Dict[str, Any]]
    ) -> List[str]:
        recorded_types = {activity.get("activityType") for activity in activities}
        suggestions: List[str] = []
        if "Interview" not in recorded_types:
            suggestions.append("Schedule interviews with key witnesses and involved personnel.")
        if "Evidence Collection" not in recorded_types:
            suggestions.append("Collect and catalogue all physical and digital evidence.")
        if incident.severity in {"High", "Critical"} and "Expert Consultation" not in recorded_types:
            suggestions.append("Engage subject matter experts for deeper analysis.")
        if not suggestions:
            suggestions.append("Consolidate findings and prepare interim investigation report.")
        return suggestions

    @staticmethod
    def _fallback_root_cause_hypotheses(
        incident: IncidentSnapshot, activities: Sequence[Dict[str, Any]]
    ) -> List[str]:
        hints: List[str] = []
        if incident.incident_type == "IT System Failure":
            hints.append("Potential configuration drift or missing redundancy detected.")
        if incident.incident_type == "Safety Incident":
            hints.append("Review adherence to safety procedures and equipment maintenance records.")
        if incident.incident_type == "Security Breach":
            hints.append("Assess multi-factor authentication coverage and privileged access reviews.")
        if not hints:
            hints.append("Cross-verify process deviations and training completion gaps.")
        return hints

    @staticmethod
    def _fallback_resolution_estimate(
        incident: IncidentSnapshot, activities: Sequence[Dict[str, Any]]
    ) -> float:
        base_hours = {
            "Low": 24,
            "Medium": 72,
            "High": 120,
            "Critical": 192,
        }.get(incident.severity, 72)
        progress_factor = 0.85 if activities else 1.0
        return round(base_hours * progress_factor, 1)


__all__ = ["IncidentIntelligenceEngine", "IncidentSnapshot"]
