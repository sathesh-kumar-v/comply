from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.ai.fmea_ai import (
    analyze_cause_effect,
    draft_scope_outline,
    evaluate_control_effectiveness,
    forecast_rpn,
    generate_rpn_alerts,
    predict_failure_modes,
    recommend_scales,
    suggest_team_members,
    suggest_templates,
)

try:
    from auth import require_roles  # type: ignore
except Exception:  # pragma: no cover - fallback when router tested in isolation
    def require_roles(*_roles):
        def _inner():
            raise HTTPException(status_code=500, detail="Auth dependencies not configured")

        return _inner


router = APIRouter(prefix="/fmea/ai", tags=["fmea-ai"])


# --------- Schemas ---------


class TemplateSuggestion(BaseModel):
    name: str
    focus: str
    description: str
    recommended_controls: List[str] = []


class TemplateSuggestionsIn(BaseModel):
    industry: str = Field(..., min_length=2)
    process_type: str = Field(..., min_length=2)
    description: Optional[str] = None
    keywords: Optional[List[str]] = None


class TemplateSuggestionsOut(BaseModel):
    templates: List[TemplateSuggestion]
    notes: List[str] = []


class RPNAlertIn(BaseModel):
    threshold: int = Field(..., ge=1)
    items: List[Dict[str, Any]]


class RPNAlertOut(BaseModel):
    threshold: int
    alerts: List[str]
    summary: str = ""


class FailureModePredictIn(BaseModel):
    process: Dict[str, Any]
    historical_patterns: Optional[List[Dict[str, Any]]] = None


class FailureMode(BaseModel):
    item_function: str
    failure_mode: str
    effects: str
    causes: str
    controls: str
    severity: Optional[int] = None
    occurrence: Optional[int] = None
    detection: Optional[int] = None


class FailureModePredictOut(BaseModel):
    failure_modes: List[FailureMode]
    notes: List[str] = []


class TeamSuggestionIn(BaseModel):
    departments: List[str] = Field(default_factory=list)
    required_skills: Optional[List[str]] = None
    timeline: Optional[str] = None
    existing_team: Optional[List[str]] = None


class PersonSuggestion(BaseModel):
    name: str
    role: Optional[str] = None
    reason: Optional[str] = None


class TeamSuggestionOut(BaseModel):
    recommended_leads: List[PersonSuggestion] = []
    recommended_members: List[PersonSuggestion] = []
    notes: List[str] = []


class ScaleRecommendIn(BaseModel):
    industry: str
    standard: Optional[str] = None
    risk_focus: Optional[str] = None


class ScaleLevel(BaseModel):
    score: int
    label: str
    description: str


class ScaleRecommendOut(BaseModel):
    severity_scale: List[ScaleLevel]
    occurrence_scale: List[ScaleLevel]
    detection_scale: List[ScaleLevel]
    notes: List[str] = []


class ScopeAssistIn(BaseModel):
    process_description: str
    objectives: Optional[List[str]] = None
    assumptions: Optional[List[str]] = None


class ScopeAssistOut(BaseModel):
    scope: str
    objectives: List[str]
    assumptions: List[str]


class WorksheetItemsIn(BaseModel):
    items: List[Dict[str, Any]] = Field(default_factory=list)
    focus: Optional[str] = None


class CauseEffectOut(BaseModel):
    insights: List[str]
    recommended_controls: List[str]


class ControlEvaluation(BaseModel):
    item_reference: str
    effectiveness: str
    recommendation: str


class ControlEffectivenessOut(BaseModel):
    evaluations: List[ControlEvaluation]
    summary: str


class RPNForecastIn(BaseModel):
    items: List[Dict[str, Any]]
    proposed_actions: Optional[List[Dict[str, Any]]] = None


class RPNForecastEntry(BaseModel):
    item_reference: str
    current_rpn: Optional[int] = None
    projected_rpn: Optional[int] = None
    recommendation: str


class RPNForecastOut(BaseModel):
    projections: List[RPNForecastEntry]
    summary: str


# --------- Endpoints ---------


@router.post("/template-suggestions", response_model=TemplateSuggestionsOut)
def api_template_suggestions(
    payload: TemplateSuggestionsIn,
    _=Depends(require_roles("Reader", "Editor", "Reviewer", "Admin", "Super Admin")),
) -> TemplateSuggestionsOut:
    try:
        data = suggest_templates(
            industry=payload.industry,
            process_type=payload.process_type,
            description=payload.description,
            keywords=payload.keywords,
        )
        return TemplateSuggestionsOut(
            templates=[TemplateSuggestion(**tpl) for tpl in data.get("templates", [])],
            notes=[str(note) for note in data.get("notes", [])],
        )
    except RuntimeError as exc:  # typically missing OPENAI_API_KEY
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/rpn-alerts", response_model=RPNAlertOut)
def api_rpn_alerts(
    payload: RPNAlertIn,
    _=Depends(require_roles("Reader", "Editor", "Reviewer", "Admin", "Super Admin")),
) -> RPNAlertOut:
    try:
        data = generate_rpn_alerts(items=payload.items, threshold=payload.threshold)
        return RPNAlertOut(
            threshold=data.get("threshold", payload.threshold),
            alerts=[str(a) for a in data.get("alerts", [])],
            summary=str(data.get("summary") or ""),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/failure-mode-predictions", response_model=FailureModePredictOut)
def api_failure_mode_predictions(
    payload: FailureModePredictIn,
    _=Depends(require_roles("Reader", "Editor", "Reviewer", "Admin", "Super Admin")),
) -> FailureModePredictOut:
    try:
        data = predict_failure_modes(
            process_context=payload.process,
            historical_patterns=payload.historical_patterns,
        )
        return FailureModePredictOut(
            failure_modes=[FailureMode(**fm) for fm in data.get("failure_modes", [])],
            notes=[str(n) for n in data.get("notes", [])],
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/team-suggestions", response_model=TeamSuggestionOut)
def api_team_suggestions(
    payload: TeamSuggestionIn,
    _=Depends(require_roles("Editor", "Reviewer", "Admin", "Super Admin")),
) -> TeamSuggestionOut:
    try:
        data = suggest_team_members(
            departments=payload.departments,
            required_skills=payload.required_skills,
            timeline=payload.timeline,
            existing_team=payload.existing_team,
        )
        return TeamSuggestionOut(
            recommended_leads=[PersonSuggestion(**lead) for lead in data.get("recommended_leads", [])],
            recommended_members=[
                PersonSuggestion(**member) for member in data.get("recommended_members", [])
            ],
            notes=[str(n) for n in data.get("notes", [])],
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/scale-recommendations", response_model=ScaleRecommendOut)
def api_scale_recommendations(
    payload: ScaleRecommendIn,
    _=Depends(require_roles("Editor", "Reviewer", "Admin", "Super Admin")),
) -> ScaleRecommendOut:
    try:
        data = recommend_scales(
            industry=payload.industry,
            standard=payload.standard,
            risk_focus=payload.risk_focus,
        )
        return ScaleRecommendOut(
            severity_scale=[ScaleLevel(**lvl) for lvl in data.get("severity_scale", [])],
            occurrence_scale=[ScaleLevel(**lvl) for lvl in data.get("occurrence_scale", [])],
            detection_scale=[ScaleLevel(**lvl) for lvl in data.get("detection_scale", [])],
            notes=[str(n) for n in data.get("notes", [])],
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/scope-assist", response_model=ScopeAssistOut)
def api_scope_assist(
    payload: ScopeAssistIn,
    _=Depends(require_roles("Editor", "Reviewer", "Admin", "Super Admin")),
) -> ScopeAssistOut:
    try:
        data = draft_scope_outline(
            process_description=payload.process_description,
            objectives=payload.objectives,
            assumptions=payload.assumptions,
        )
        return ScopeAssistOut(
            scope=str(data.get("scope") or ""),
            objectives=[str(o) for o in data.get("objectives", [])],
            assumptions=[str(a) for a in data.get("assumptions", [])],
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/cause-effect", response_model=CauseEffectOut)
def api_cause_effect(
    payload: WorksheetItemsIn,
    _=Depends(require_roles("Reader", "Editor", "Reviewer", "Admin", "Super Admin")),
) -> CauseEffectOut:
    try:
        data = analyze_cause_effect(items=payload.items, focus=payload.focus)
        return CauseEffectOut(
            insights=[str(i) for i in data.get("insights", [])],
            recommended_controls=[str(c) for c in data.get("recommended_controls", [])],
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/control-effectiveness", response_model=ControlEffectivenessOut)
def api_control_effectiveness(
    payload: WorksheetItemsIn,
    _=Depends(require_roles("Reader", "Editor", "Reviewer", "Admin", "Super Admin")),
) -> ControlEffectivenessOut:
    try:
        data = evaluate_control_effectiveness(items=payload.items)
        return ControlEffectivenessOut(
            evaluations=[ControlEvaluation(**ev) for ev in data.get("evaluations", [])],
            summary=str(data.get("summary") or ""),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/rpn-forecast", response_model=RPNForecastOut)
def api_rpn_forecast(
    payload: RPNForecastIn,
    _=Depends(require_roles("Reader", "Editor", "Reviewer", "Admin", "Super Admin")),
) -> RPNForecastOut:
    try:
        data = forecast_rpn(items=payload.items, proposed_actions=payload.proposed_actions)
        return RPNForecastOut(
            projections=[RPNForecastEntry(**entry) for entry in data.get("projections", [])],
            summary=str(data.get("summary") or ""),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
