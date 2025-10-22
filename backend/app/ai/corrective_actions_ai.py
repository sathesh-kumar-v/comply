from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Sequence


@dataclass
class ActionSnapshot:
    """Lightweight representation of a corrective action for AI heuristics."""

    id: str
    title: str
    priority: str
    impact: str
    urgency: str
    status: str
    progress: float
    due_date: date | None
    completed_on: date | None
    departments: Sequence[str]
    last_updated: datetime | None
    effectiveness_score: float | None = None
    risk_score: float | None = None
    open_issues: int = 0


PRIORITY_WEIGHTS: Dict[str, float] = {
    "Critical": 1.0,
    "High": 0.85,
    "Medium": 0.55,
    "Low": 0.3,
}


URGENCY_WEIGHTS: Dict[str, float] = {
    "Critical": 1.0,
    "High": 0.8,
    "Medium": 0.55,
    "Low": 0.35,
}


STATUS_PROGRESS_DEFAULTS: Dict[str, float] = {
    "Open": 0.1,
    "In Progress": 0.45,
    "Completed": 1.0,
    "Closed": 1.0,
    "Cancelled": 0.0,
}


CONFIDENCE_THRESHOLDS = [0.65, 0.4]


class CorrectiveActionAIEngine:
    """Rule-based AI helper that generates predictive insights for corrective actions."""

    def __init__(self, reference_date: date | None = None) -> None:
        self.reference_date = reference_date or date.today()

    # ------------------------------------------------------------------
    # Aggregation helpers
    # ------------------------------------------------------------------
    def _normalize_progress(self, progress: float | None, status: str) -> float:
        if progress is None or progress <= 0:
            return STATUS_PROGRESS_DEFAULTS.get(status, 0.0)
        return max(0.0, min(progress, 1.0))

    def _overdue_days(self, action: ActionSnapshot) -> int:
        if not action.due_date:
            return 0
        delta = (self.reference_date - action.due_date).days
        return max(delta, 0)

    def _confidence_for_score(self, score: float) -> str:
        if score >= CONFIDENCE_THRESHOLDS[0]:
            return "High"
        if score >= CONFIDENCE_THRESHOLDS[1]:
            return "Medium"
        return "Low"

    # ------------------------------------------------------------------
    # Public scoring utilities
    # ------------------------------------------------------------------
    def effectiveness_scores(self, actions: Iterable[ActionSnapshot]) -> List[Dict[str, Any]]:
        insights: List[Dict[str, Any]] = []
        for action in actions:
            progress = self._normalize_progress(action.progress, action.status)
            overdue_days = self._overdue_days(action)
            risk_signal = action.risk_score if action.risk_score is not None else PRIORITY_WEIGHTS.get(action.priority, 0.4)

            baseline = 0.45 + 0.45 * progress
            penalty = 0.0
            if overdue_days:
                penalty += min(overdue_days / 120, 0.25)
            if action.open_issues:
                penalty += min(action.open_issues * 0.05, 0.2)
            if action.status in {"Closed", "Cancelled"}:
                baseline *= 0.7

            score = max(0.22, min(0.98, baseline - penalty + 0.08 * (1 - risk_signal)))
            insights.append(
                {
                    "actionId": action.id,
                    "title": action.title,
                    "score": round(score * 100, 1),
                    "confidence": self._confidence_for_score(score),
                    "drivers": self._effectiveness_drivers(action, progress, overdue_days),
                }
            )
        return insights

    def _effectiveness_drivers(self, action: ActionSnapshot, progress: float, overdue_days: int) -> List[str]:
        drivers: List[str] = []
        if overdue_days:
            drivers.append(f"Overdue by {overdue_days} day(s)")
        if progress >= 0.75:
            drivers.append("Implementation momentum is strong")
        elif progress <= 0.25:
            drivers.append("Low execution progress")
        if action.open_issues:
            drivers.append(f"{action.open_issues} outstanding issue(s) reported")
        if not drivers:
            drivers.append("On-track performance with balanced progress")
        return drivers

    def rank_priorities(self, actions: Iterable[ActionSnapshot]) -> List[Dict[str, Any]]:
        ranked: List[Dict[str, Any]] = []
        for action in actions:
            progress = self._normalize_progress(action.progress, action.status)
            overdue_days = self._overdue_days(action)

            priority_component = PRIORITY_WEIGHTS.get(action.priority, 0.4)
            impact_component = PRIORITY_WEIGHTS.get(action.impact, 0.4)
            urgency_component = URGENCY_WEIGHTS.get(action.urgency, 0.45)
            progress_gap = 1 - progress
            overdue_penalty = min(overdue_days / 60, 0.35)

            score = (
                0.32 * priority_component
                + 0.28 * impact_component
                + 0.2 * urgency_component
                + 0.15 * progress_gap
                + 0.05 * overdue_penalty
            )
            score = max(0.2, min(1.0, score + (action.risk_score or 0.0) * 0.15))
            ranked.append(
                {
                    "actionId": action.id,
                    "title": action.title,
                    "priorityScore": round(score * 100, 1),
                    "suggestedPriority": self._priority_level_for_score(score),
                    "riskImpact": action.priority,
                    "overdueDays": overdue_days,
                }
            )
        ranked.sort(key=lambda item: item["priorityScore"], reverse=True)
        return ranked

    def _priority_level_for_score(self, score: float) -> str:
        if score >= 0.82:
            return "Critical"
        if score >= 0.68:
            return "High"
        if score >= 0.48:
            return "Medium"
        return "Low"

    def recommend_resources(self, actions: Iterable[ActionSnapshot]) -> List[Dict[str, Any]]:
        recommendations: List[Dict[str, Any]] = []
        for action in actions:
            overdue_days = self._overdue_days(action)
            progress = self._normalize_progress(action.progress, action.status)

            res: List[str] = []
            if overdue_days > 0:
                res.append("Allocate surge support to recover overdue milestones")
            if progress < 0.4:
                res.append("Assign a senior owner to accelerate execution pace")
            if action.priority in {"Critical", "High"} and "Operations" in action.departments:
                res.append("Dedicated operational excellence lead recommended")
            if not res:
                res.append("Current resourcing level is adequate; monitor weekly")

            recommendations.append(
                {
                    "actionId": action.id,
                    "title": action.title,
                    "recommendations": res,
                }
            )
        return recommendations

    def suggest_escalations(self, actions: Iterable[ActionSnapshot]) -> List[Dict[str, Any]]:
        suggestions: List[Dict[str, Any]] = []
        for action in actions:
            overdue_days = self._overdue_days(action)
            progress = self._normalize_progress(action.progress, action.status)

            path: List[str] = []
            trigger: str
            if overdue_days >= 14 or action.priority == "Critical":
                path = ["Action Owner", "Department Head", "Chief Compliance Officer"]
                trigger = "High risk or extended overdue condition"
            elif overdue_days >= 7:
                path = ["Action Owner", "Risk Manager"]
                trigger = "Moderate overdue condition"
            elif progress < 0.25:
                path = ["Action Owner", "Program Management Office"]
                trigger = "Insufficient implementation progress"
            else:
                path = ["Action Owner"]
                trigger = "Standard monitoring"

            suggestions.append(
                {
                    "actionId": action.id,
                    "title": action.title,
                    "trigger": trigger,
                    "escalationPath": path,
                }
            )
        return suggestions

    # ------------------------------------------------------------------
    # Action level analytics
    # ------------------------------------------------------------------
    def analyze_action(self, action: ActionSnapshot) -> Dict[str, Any]:
        progress = self._normalize_progress(action.progress, action.status)
        overdue_days = self._overdue_days(action)
        risk_signal = action.risk_score if action.risk_score is not None else PRIORITY_WEIGHTS.get(action.priority, 0.5)
        trend_factor = 0.0
        if action.last_updated:
            days_since_update = (self.reference_date - action.last_updated.date()).days
            if days_since_update > 14:
                trend_factor -= 0.08
            elif days_since_update < 5:
                trend_factor += 0.05

        success_probability = max(0.18, min(0.97, 0.55 + 0.35 * progress - 0.25 * risk_signal - 0.02 * overdue_days + trend_factor))
        effectiveness_score = max(0.2, min(0.95, 0.5 + 0.3 * progress - 0.15 * risk_signal))
        progress_confidence = max(0.2, min(0.92, 0.4 + 0.35 * progress - 0.1 * overdue_days / 30))
        predicted_completion_date = self._predict_completion_date(action, progress)

        risk_alerts: List[str] = []
        if overdue_days > 0:
            risk_alerts.append(f"Action is overdue by {overdue_days} day(s)")
        if progress < 0.3:
            risk_alerts.append("Progress remains below 30% of plan")
        if action.priority in {"Critical", "High"} and success_probability < 0.7:
            risk_alerts.append("Escalate for executive visibility")
        if not risk_alerts:
            risk_alerts.append("Risk profile acceptable with current trajectory")

        return {
            "effectivenessScore": round(effectiveness_score * 100, 1),
            "successProbability": round(success_probability * 100, 1),
            "predictedCompletionDate": predicted_completion_date.isoformat() if predicted_completion_date else None,
            "progressConfidence": round(progress_confidence * 100, 1),
            "riskAlerts": risk_alerts,
            "resourceRecommendations": self.recommend_resources([action])[0]["recommendations"],
            "escalationPath": self.suggest_escalations([action])[0]["escalationPath"],
            "automatedTracking": self._automated_tracking_summary(action, overdue_days),
            "riskAssessment": self._risk_assessment_summary(action, overdue_days, success_probability),
            "effectivenessReview": self._effectiveness_summary(effectiveness_score),
            "completionForecast": self._completion_forecast_summary(predicted_completion_date, success_probability),
        }

    def _predict_completion_date(self, action: ActionSnapshot, progress: float) -> date | None:
        if action.status in {"Completed", "Closed"} and action.completed_on:
            return action.completed_on
        if not action.due_date:
            return None
        remaining = max(0.05, 1 - progress)
        estimated_days = int(remaining * 30)
        estimated_days += 5 if action.priority in {"Critical", "High"} else 2
        return action.due_date + timedelta(days=estimated_days // 2)

    def _automated_tracking_summary(self, action: ActionSnapshot, overdue_days: int) -> str:
        if overdue_days > 0:
            return "Automated alerts triggered for overdue milestones and pending evidence uploads"
        if action.open_issues:
            return "Digital evidence review flag raised for unresolved issues"
        return "Digital evidence ingestion confirms step completion cadence"

    def _risk_assessment_summary(self, action: ActionSnapshot, overdue_days: int, success_probability: float) -> str:
        if overdue_days >= 14:
            return "High risk: extended overdue period detected"
        if success_probability < 0.6:
            return "Moderate risk: completion probability below 60%"
        if action.priority in {"Critical", "High"}:
            return "Managed risk with elevated monitoring"
        return "Low risk profile based on current performance"

    def _effectiveness_summary(self, effectiveness_score: float) -> str:
        if effectiveness_score >= 0.8:
            return "Effectiveness trending high based on interim metrics"
        if effectiveness_score >= 0.6:
            return "Effectiveness moderate; validate metric definitions"
        return "Effectiveness is constrained; schedule a rapid impact review"

    def _completion_forecast_summary(self, predicted_completion: date | None, success_probability: float) -> str:
        if not predicted_completion:
            return "Completion forecast pending additional milestone data"
        formatted = predicted_completion.strftime("%d %b %Y")
        if success_probability >= 0.75:
            return f"Projected completion by {formatted} with strong confidence"
        if success_probability >= 0.6:
            return f"Projected completion around {formatted}; monitor constraints"
        return f"Completion likely slipping beyond {formatted}; escalate contingency plan"

    # ------------------------------------------------------------------
    # Action plan generation
    # ------------------------------------------------------------------
    def generate_action_plan(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        action_type = payload.get("actionType", "Immediate Action")
        urgency = payload.get("urgency", "Medium")
        impact = payload.get("impact", "Medium")
        baseline_duration = 45 if action_type == "Long-term Corrective Action" else 28
        if urgency in {"Critical", "High"}:
            baseline_duration -= 10
        if impact in {"Critical", "High"}:
            baseline_duration += 5
        baseline_duration = max(21, baseline_duration)

        start_date = self.reference_date + timedelta(days=1)
        target_completion = start_date + timedelta(days=baseline_duration)

        steps = self._plan_steps(action_type, urgency, impact)
        resource_plan = self._resource_plan(payload)
        success_probability = self._plan_success_probability(urgency, impact, action_type)

        return {
            "actionNarrative": self._plan_narrative(payload, baseline_duration),
            "steps": steps,
            "timeline": {
                "overallDurationDays": baseline_duration,
                "targetCompletionDate": target_completion.isoformat(),
                "milestones": self._plan_milestones(start_date, baseline_duration),
            },
            "resourcePlan": resource_plan,
            "successProbability": round(success_probability * 100, 1),
            "riskConsiderations": self._plan_risks(urgency, impact),
        }

    def _plan_steps(self, action_type: str, urgency: str, impact: str) -> List[Dict[str, Any]]:
        core_steps = [
            {
                "title": "Containment & Immediate Controls",
                "description": "Stabilize the issue and prevent recurrence while analysis proceeds.",
                "ownerRole": "Action Owner",
                "suggestedDurationDays": 5,
                "resources": "Front-line supervisors, quick reference guides",
                "successCriteria": "Containment measures verified with zero repeat incidents",
            },
            {
                "title": "Root Cause Analysis",
                "description": "Facilitate cross-functional session to confirm primary and contributing causes.",
                "ownerRole": "Quality Lead",
                "suggestedDurationDays": 7,
                "resources": "Facilitator, process maps, incident records",
                "successCriteria": "Approved RCA with validated contributing factors",
            },
            {
                "title": "Corrective Implementation",
                "description": "Deploy corrective and preventive changes with controlled rollout.",
                "ownerRole": "Department Manager",
                "suggestedDurationDays": 10,
                "resources": "Implementation team, change management toolkit",
                "successCriteria": "Process change deployed and training completed",
            },
            {
                "title": "Effectiveness Verification",
                "description": "Measure outcomes, collect evidence, and confirm sustainability.",
                "ownerRole": "Compliance Partner",
                "suggestedDurationDays": 6,
                "resources": "Audit checklist, performance dashboards",
                "successCriteria": "All success metrics met for two consecutive cycles",
            },
        ]

        if action_type in {"Long-term Corrective Action", "Improvement Action"}:
            core_steps.insert(
                2,
                {
                    "title": "Process Redesign",
                    "description": "Optimize the workflow and integrate systemic safeguards.",
                    "ownerRole": "Process Excellence",
                    "suggestedDurationDays": 12,
                    "resources": "Lean specialist, automation engineer",
                    "successCriteria": "Future-state design approved and resourced",
                },
            )

        if urgency == "Critical":
            core_steps[0]["suggestedDurationDays"] = 3
            core_steps[0]["resources"] = "Rapid response team, executive sponsor"

        if impact == "Critical":
            core_steps.append(
                {
                    "title": "Executive Readout",
                    "description": "Brief leadership on remediation impact and risk posture.",
                    "ownerRole": "Program Manager",
                    "suggestedDurationDays": 4,
                    "resources": "Executive summary pack, KPIs",
                    "successCriteria": "Leadership sign-off with risk acceptance documented",
                }
            )

        return core_steps

    def _plan_milestones(self, start_date: date, duration: int) -> List[Dict[str, Any]]:
        checkpoints = [
            {"name": "Containment Complete", "offset": 5},
            {"name": "Root Cause Validated", "offset": 12},
            {"name": "Implementation Complete", "offset": int(duration * 0.75)},
        ]
        return [
            {
                "name": item["name"],
                "targetDate": (start_date + timedelta(days=item["offset"])) .isoformat(),
            }
            for item in checkpoints
        ]

    def _resource_plan(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        departments = payload.get("departments", [])
        base_roles = ["Action Owner", "Process Engineer", "Quality Partner"]
        if any(dep for dep in departments if dep.lower().startswith("it")):
            base_roles.append("Security Architect")
        if "Operations" in departments:
            base_roles.append("Operations Excellence Coach")
        return {
            "roles": sorted(set(base_roles)),
            "tools": ["Root cause analysis toolkit", "Collaboration workspace", "Effectiveness scorecard"],
            "budgetEstimate": 18000 if payload.get("impact") in {"High", "Critical"} else 8500,
            "notes": "Budget accounts for training, technology enhancements, and validation activities.",
        }

    def _plan_success_probability(self, urgency: str, impact: str, action_type: str) -> float:
        base = 0.72
        if urgency == "Critical":
            base -= 0.08
        if impact == "Critical":
            base -= 0.05
        if action_type == "Immediate Action":
            base += 0.05
        if action_type == "Long-term Corrective Action":
            base -= 0.04
        return max(0.35, min(0.9, base))

    def _plan_risks(self, urgency: str, impact: str) -> List[str]:
        risks = ["Ensure evidence capture keeps pace with accelerated timeline"]
        if urgency in {"High", "Critical"}:
            risks.append("Resource contention likely; secure executive sponsorship")
        if impact in {"High", "Critical"}:
            risks.append("Validate downstream processes for unintended consequences")
        return risks

    def _plan_narrative(self, payload: Dict[str, Any], duration: int) -> str:
        title = payload.get("actionTitle", "Corrective Action")
        action_type = payload.get("actionType", "Corrective Action")
        urgency = payload.get("urgency", "Medium").lower()
        impact = payload.get("impact", "Medium").lower()
        return (
            f"<p><strong>{title}</strong> will be executed as a {action_type.lower()} with an expected {duration}-day horizon. "
            f"The plan prioritizes rapid containment, validated root cause analysis, and sustained effectiveness "
            f"verification while managing {urgency} urgency and {impact} impact considerations.</p>"
        )


def build_snapshots(raw_actions: Iterable[Dict[str, Any]]) -> List[ActionSnapshot]:
    snapshots: List[ActionSnapshot] = []
    for item in raw_actions:
        snapshots.append(
            ActionSnapshot(
                id=item["id"],
                title=item.get("title", ""),
                priority=item.get("priority", "Medium"),
                impact=item.get("impact", item.get("priority", "Medium")),
                urgency=item.get("urgency", "Medium"),
                status=item.get("status", "Open"),
                progress=(item.get("progress", 0) or 0) / 100,
                due_date=item.get("due_date"),
                completed_on=item.get("completed_on"),
                departments=item.get("departments", []),
                last_updated=item.get("last_updated"),
                effectiveness_score=(item.get("ai_metadata", {}).get("effectiveness_score")),
                risk_score=item.get("ai_metadata", {}).get("risk_score"),
                open_issues=len(item.get("open_issues", [])),
            )
        )
    return snapshots
