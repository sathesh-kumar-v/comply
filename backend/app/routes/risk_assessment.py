from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session

from database import get_db
from models import (
    ConfidenceLevelEnum,
    CountryRiskCategoryScore,
    CountryRiskProfile,
    DataSourceType,
    RiskAssessment,
    RiskAssessmentStatus,
    RiskTrendEnum,
    UpdateSourceEnum,
)
from app.ai.risk_ai import RiskIntelligenceEngine


router = APIRouter(prefix="/api/risk-assessment", tags=["risk-assessment"])


DEFAULT_CATEGORIES: List[Dict[str, Any]] = [
    {"key": "political_stability", "label": "Political Stability", "weight": 20},
    {"key": "economic_outlook", "label": "Economic Indicators", "weight": 20},
    {"key": "regulatory_index", "label": "Regulatory Environment", "weight": 15},
    {"key": "corruption_index", "label": "Corruption Index", "weight": 10},
    {"key": "infrastructure", "label": "Infrastructure Quality", "weight": 10},
    {"key": "currency_stability", "label": "Currency Stability", "weight": 10},
    {"key": "trade_relations", "label": "Trade Relations", "weight": 10},
    {"key": "security", "label": "Security Environment", "weight": 5},
]


DEFAULT_IMPACT_LEVELS = {
    "Low": "Minimal disruption, manageable within routine operations",
    "Medium": "Noticeable disruption requiring departmental coordination",
    "High": "Significant disruption with executive oversight",
    "Critical": "Severe disruption threatening strategic objectives",
}


DEFAULT_PROBABILITY_LEVELS = {
    "Rare": "Unlikely to occur (<10%)",
    "Possible": "May occur occasionally (10-40%)",
    "Likely": "Expected periodically (40-70%)",
    "Almost Certain": "Anticipated frequently (>70%)",
}


DEFAULT_COUNTRIES = [
    {"code": "DE", "name": "Germany"},
    {"code": "BR", "name": "Brazil"},
    {"code": "SG", "name": "Singapore"},
    {"code": "ZA", "name": "South Africa"},
    {"code": "US", "name": "United States"},
    {"code": "GB", "name": "United Kingdom"},
    {"code": "CN", "name": "China"},
]


class RiskCategoryConfig(BaseModel):
    key: str
    label: str
    weight: float = Field(ge=0, le=100)


class CountrySelection(BaseModel):
    code: str = Field(..., min_length=2, max_length=3)
    name: str


class AssessmentCreatePayload(BaseModel):
    title: str
    assessment_type: str = Field(..., alias="assessmentType")
    countries: List[CountrySelection]
    framework: Optional[str] = None
    scoring_scale: str = Field("1-100", alias="scoringScale")
    assessment_period_start: date = Field(..., alias="assessmentPeriodStart")
    assessment_period_end: date = Field(..., alias="assessmentPeriodEnd")
    update_frequency: str = Field(..., alias="updateFrequency")
    assigned_assessor: str = Field(..., alias="assignedAssessor")
    review_team: List[str] = Field(default_factory=list, alias="reviewTeam")
    categories: List[RiskCategoryConfig] = Field(default_factory=list)
    impact_levels: Dict[str, str] = Field(default_factory=dict, alias="impactLevels")
    probability_levels: Dict[str, str] = Field(default_factory=dict, alias="probabilityLevels")
    data_source: DataSourceType = Field(DataSourceType.COMBINED, alias="dataSource")
    initial_scores: Optional[Dict[str, Dict[str, float]]] = Field(default=None, alias="initialScores")

    @validator("countries")
    def _require_countries(cls, value: List[CountrySelection]) -> List[CountrySelection]:
        if not value:
            raise ValueError("At least one country must be selected for the assessment")
        return value


class CategoryScorePayload(BaseModel):
    name: str
    score: float
    trend: Optional[RiskTrendEnum] = None


class CountryUpdatePayload(BaseModel):
    country_code: str = Field(..., alias="countryCode")
    country_name: Optional[str] = Field(None, alias="countryName")
    overall_score: Optional[float] = Field(None, alias="overallScore")
    trend: Optional[RiskTrendEnum] = None
    confidence: Optional[ConfidenceLevelEnum] = None
    evidence: Optional[str] = None
    comments: Optional[str] = None
    impact_level: Optional[str] = Field(None, alias="impactLevel")
    probability_level: Optional[str] = Field(None, alias="probabilityLevel")
    update_source: UpdateSourceEnum = Field(UpdateSourceEnum.MANUAL, alias="updateSource")
    categories: List[CategoryScorePayload] = Field(default_factory=list)
    attachments: List[Dict[str, Any]] = Field(default_factory=list)
    ai_refresh: bool = Field(False, alias="aiRefresh")


def _engine_for_assessment(assessment: RiskAssessment) -> RiskIntelligenceEngine:
    return RiskIntelligenceEngine(scoring_scale=assessment.scoring_scale)


def _serialize_category(category: CountryRiskCategoryScore) -> Dict[str, Any]:
    return {
        "id": category.id,
        "name": category.name,
        "score": category.score,
        "weight": category.weight,
        "aiSuggestion": category.ai_suggestion,
        "volatility": category.volatility,
        "trend": category.trend.value if category.trend else None,
    }


def _serialize_profile(profile: CountryRiskProfile) -> Dict[str, Any]:
    return {
        "id": profile.id,
        "countryCode": profile.country_code,
        "countryName": profile.country_name,
        "overallScore": profile.overall_score,
        "riskLevel": profile.risk_level,
        "trend": profile.trend.value,
        "confidence": profile.confidence.value,
        "impactLevel": profile.impact_level,
        "probabilityLevel": profile.probability_level,
        "evidence": profile.evidence,
        "comments": profile.comments,
        "nextAssessmentDue": profile.next_assessment_due,
        "updateSource": profile.update_source.value,
        "lastUpdated": profile.last_updated,
        "aiAlerts": profile.ai_alerts or [],
        "supportingSignals": profile.supporting_signals or {},
        "attachments": profile.attachments or [],
        "recentChange": profile.recent_change,
        "categories": [_serialize_category(category) for category in profile.categories],
    }


def _serialize_assessment(assessment: RiskAssessment) -> Dict[str, Any]:
    return {
        "id": assessment.id,
        "title": assessment.title,
        "assessmentType": assessment.assessment_type,
        "framework": assessment.framework,
        "scoringScale": assessment.scoring_scale,
        "updateFrequency": assessment.update_frequency,
        "dataSource": assessment.data_source.value,
        "startDate": assessment.start_date,
        "endDate": assessment.end_date,
        "assignedAssessor": assessment.assigned_assessor,
        "reviewTeam": assessment.review_team or [],
        "status": assessment.status.value,
        "categories": assessment.categories_config,
        "impactLevels": assessment.impact_levels or {},
        "probabilityLevels": assessment.probability_levels or {},
        "aiRecommendations": assessment.ai_recommendations or {},
        "nextAssessmentDue": assessment.next_assessment_due,
        "externalDataSources": assessment.external_data_sources or [],
        "countries": [_serialize_profile(profile) for profile in assessment.countries],
    }


def _ensure_seed_data(session: Session) -> RiskAssessment:
    existing = session.query(RiskAssessment).order_by(RiskAssessment.created_at.desc()).first()
    if existing:
        return existing

    engine = RiskIntelligenceEngine()
    assessment = RiskAssessment(
        title="Global Political & Economic Heatmap",
        assessment_type="Comprehensive Risk Assessment",
        framework="ISO 31000 Risk Management",
        scoring_scale="1-100",
        update_frequency="Quarterly",
        data_source=DataSourceType.COMBINED,
        start_date=datetime.utcnow().date() - timedelta(days=45),
        end_date=datetime.utcnow().date() + timedelta(days=45),
        assigned_assessor="Global Risk Office",
        review_team=["Regulatory Intelligence", "Finance Control", "Security Operations"],
        status=RiskAssessmentStatus.IN_PROGRESS,
        categories_config=DEFAULT_CATEGORIES,
        impact_levels=DEFAULT_IMPACT_LEVELS,
        probability_levels=DEFAULT_PROBABILITY_LEVELS,
        next_assessment_due=datetime.utcnow().date() + timedelta(days=30),
        external_data_sources=[
            {"name": "World Bank Indicators", "lastUpdated": datetime.utcnow() - timedelta(hours=6)},
            {"name": "IMF Country Reports", "lastUpdated": datetime.utcnow() - timedelta(days=1)},
            {"name": "Transparency International", "lastUpdated": datetime.utcnow() - timedelta(days=3)},
        ],
    )
    session.add(assessment)
    session.flush()

    for country in DEFAULT_COUNTRIES:
        intelligence = engine.score_country(
            country_code=country["code"],
            categories=[(cfg["key"], 3.5) for cfg in DEFAULT_CATEGORIES],
            weights={cfg["key"]: cfg["weight"] for cfg in DEFAULT_CATEGORIES},
            scale="1-5",
            assessment_end=assessment.end_date,
        )
        profile = CountryRiskProfile(
            assessment_id=assessment.id,
            country_code=country["code"],
            country_name=country["name"],
            overall_score=intelligence.overall_score,
            risk_level=intelligence.risk_level,
            trend=RiskTrendEnum(intelligence.trend),
            confidence=ConfidenceLevelEnum(intelligence.confidence),
            impact_level="High" if intelligence.risk_level in {"High", "Critical"} else "Medium",
            probability_level="Likely" if intelligence.trend == "Deteriorating" else "Possible",
            evidence="Seeded dataset using AI intelligence model",
            update_source=UpdateSourceEnum.AI,
            next_assessment_due=intelligence.next_assessment,
            ai_alerts=intelligence.ai_alerts,
            supporting_signals=intelligence.supporting_signals,
            recent_change=intelligence.predicted_change,
        )
        session.add(profile)
        session.flush()

        for category in intelligence.category_insights:
            session.add(
                CountryRiskCategoryScore(
                    country_id=profile.id,
                    name=category.name,
                    score=category.score,
                    weight=category.weight,
                    ai_suggestion=category.ai_suggestion,
                    volatility=category.volatility,
                    trend=RiskTrendEnum(intelligence.trend),
                )
            )

    assessment.ai_recommendations = engine.build_ai_dashboard(
        [engine.score_country(country["code"], [(cfg["key"], 3.5) for cfg in DEFAULT_CATEGORIES], {cfg["key"]: cfg["weight"] for cfg in DEFAULT_CATEGORIES}, "1-5", assessment.end_date) for country in DEFAULT_COUNTRIES]
    )
    session.commit()
    session.refresh(assessment)
    return assessment


def _collect_intelligence(assessment: RiskAssessment) -> List[Dict[str, Any]]:
    engine = _engine_for_assessment(assessment)
    insights = []
    for profile in assessment.countries:
        categories = [(category.name, category.score) for category in profile.categories]
        weights = {cfg["key"]: cfg.get("weight", 0) for cfg in assessment.categories_config}
        intelligence = engine.score_country(
            country_code=profile.country_code,
            categories=categories,
            weights=weights,
            scale=assessment.scoring_scale,
            assessment_end=assessment.end_date,
        )
        insights.append({
            "model": intelligence,
            "profile": profile,
        })
    return insights


@router.get("/dashboard")
def dashboard(
    risk_type: str = Query("Overall", alias="riskType"),
    data_source: DataSourceType = Query(DataSourceType.COMBINED, alias="dataSource"),
    session: Session = Depends(get_db),
):
    assessment = _ensure_seed_data(session)
    insights = _collect_intelligence(assessment)
    engine = _engine_for_assessment(assessment)

    profiles = [item["profile"] for item in insights]
    models = [item["model"] for item in insights]

    total_countries = len(profiles)
    high_risk = sum(1 for profile in profiles if profile.risk_level in {"High", "Critical"})
    recent_window = datetime.utcnow() - timedelta(days=14)
    recent_changes = sum(1 for profile in profiles if profile.last_updated >= recent_window)
    upcoming = min((profile.next_assessment_due for profile in profiles if profile.next_assessment_due), default=None)

    return {
        "generatedAt": datetime.utcnow(),
        "filters": {"riskType": risk_type, "dataSource": data_source.value},
        "summary": {
            "totalCountries": total_countries,
            "highRiskCountries": high_risk,
            "recentRiskChanges": recent_changes,
            "nextAssessmentDue": upcoming,
        },
        "map": {
            "countries": [
                {
                    "code": profile.country_code,
                    "name": profile.country_name,
                    "score": profile.overall_score,
                    "riskLevel": profile.risk_level,
                    "trend": profile.trend.value,
                    "confidence": profile.confidence.value,
                    "nextAssessment": profile.next_assessment_due,
                }
                for profile in profiles
            ],
            "legend": [
                {"label": "Low", "min": 0, "max": 25, "color": "#34d399"},
                {"label": "Medium", "min": 26, "max": 50, "color": "#facc15"},
                {"label": "High", "min": 51, "max": 75, "color": "#fb923c"},
                {"label": "Critical", "min": 76, "max": 100, "color": "#f87171"},
            ],
        },
        "aiInsights": engine.build_ai_dashboard([item["model"] for item in insights]),
        "countryDetails": [_serialize_profile(profile) for profile in profiles],
        "riskType": risk_type,
        "dataSource": data_source.value,
    }


@router.get("/assessments")
def list_assessments(session: Session = Depends(get_db)):
    _ensure_seed_data(session)
    assessments = (
        session.query(RiskAssessment)
        .order_by(RiskAssessment.created_at.desc())
        .all()
    )
    response = []
    for assessment in assessments:
        total = len(assessment.countries)
        high_risk = sum(1 for country in assessment.countries if country.risk_level in {"High", "Critical"})
        response.append(
            {
                "id": assessment.id,
                "title": assessment.title,
                "assessmentType": assessment.assessment_type,
                "status": assessment.status.value,
                "startDate": assessment.start_date,
                "endDate": assessment.end_date,
                "nextAssessmentDue": assessment.next_assessment_due,
                "totalCountries": total,
                "highRiskCountries": high_risk,
                "assignedAssessor": assessment.assigned_assessor,
            }
        )
    return response


@router.post("/assessments", status_code=201)
def create_assessment(payload: AssessmentCreatePayload, session: Session = Depends(get_db)):
    categories = payload.categories or [RiskCategoryConfig(**category) for category in DEFAULT_CATEGORIES]
    weights = {category.key: category.weight for category in categories}

    assessment = RiskAssessment(
        title=payload.title,
        assessment_type=payload.assessment_type,
        framework=payload.framework,
        scoring_scale=payload.scoring_scale,
        update_frequency=payload.update_frequency,
        data_source=payload.data_source,
        start_date=payload.assessment_period_start,
        end_date=payload.assessment_period_end,
        assigned_assessor=payload.assigned_assessor,
        review_team=payload.review_team,
        status=RiskAssessmentStatus.SCHEDULED,
        categories_config=[category.model_dump() for category in categories],
        impact_levels=payload.impact_levels or DEFAULT_IMPACT_LEVELS,
        probability_levels=payload.probability_levels or DEFAULT_PROBABILITY_LEVELS,
        next_assessment_due=payload.assessment_period_end,
        external_data_sources=[
            {"name": "World Bank Indicators", "lastUpdated": datetime.utcnow() - timedelta(hours=2)},
            {"name": "Local News Sources", "lastUpdated": datetime.utcnow() - timedelta(hours=1)},
        ],
    )
    session.add(assessment)
    session.flush()

    engine = _engine_for_assessment(assessment)
    intelligence_models = []

    for country in payload.countries:
        initial_scores = payload.initial_scores.get(country.code) if payload.initial_scores else None
        category_scores = []
        for category in categories:
            if initial_scores and category.key in initial_scores:
                base_score = initial_scores[category.key]
            else:
                base_score = 3.5 if payload.scoring_scale != "1-100" else 65
            category_scores.append((category.key, base_score))

        intelligence = engine.score_country(
            country_code=country.code,
            categories=category_scores,
            weights=weights,
            scale=payload.scoring_scale,
            assessment_end=assessment.end_date,
        )
        intelligence_models.append(intelligence)

        profile = CountryRiskProfile(
            assessment_id=assessment.id,
            country_code=country.code.upper(),
            country_name=country.name,
            overall_score=intelligence.overall_score,
            risk_level=intelligence.risk_level,
            trend=RiskTrendEnum(intelligence.trend),
            confidence=ConfidenceLevelEnum(intelligence.confidence),
            impact_level="High" if intelligence.risk_level in {"High", "Critical"} else "Medium",
            probability_level="Likely" if intelligence.trend == "Deteriorating" else "Possible",
            evidence="AI generated baseline using global indicators",
            update_source=UpdateSourceEnum.AI,
            next_assessment_due=intelligence.next_assessment,
            ai_alerts=intelligence.ai_alerts,
            supporting_signals=intelligence.supporting_signals,
            recent_change=intelligence.predicted_change,
        )
        session.add(profile)
        session.flush()

        for category, intelligence_category in zip(categories, intelligence.category_insights):
            session.add(
                CountryRiskCategoryScore(
                    country_id=profile.id,
                    name=category.key,
                    score=intelligence_category.score,
                    weight=intelligence_category.weight,
                    ai_suggestion=intelligence_category.ai_suggestion,
                    volatility=intelligence_category.volatility,
                    trend=RiskTrendEnum(intelligence.trend),
                )
            )

    assessment.ai_recommendations = engine.build_ai_dashboard(intelligence_models)
    session.commit()
    return {"id": assessment.id, "message": "Risk assessment created"}


@router.get("/assessments/{assessment_id}")
def get_assessment(assessment_id: int, session: Session = Depends(get_db)):
    assessment = session.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return _serialize_assessment(assessment)


@router.post("/assessments/{assessment_id}/countries")
def update_country(assessment_id: int, payload: CountryUpdatePayload, session: Session = Depends(get_db)):
    assessment = session.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    profile = (
        session.query(CountryRiskProfile)
        .filter(
            CountryRiskProfile.assessment_id == assessment_id,
            CountryRiskProfile.country_code == payload.country_code.upper(),
        )
        .first()
    )
    if not profile:
        profile = CountryRiskProfile(
            assessment_id=assessment_id,
            country_code=payload.country_code.upper(),
            country_name=payload.country_name or payload.country_code.upper(),
            overall_score=0,
            risk_level="Low",
            trend=RiskTrendEnum.STABLE,
            confidence=ConfidenceLevelEnum.MEDIUM,
        )
        session.add(profile)
        session.flush()

    profile.country_name = payload.country_name or profile.country_name
    profile.evidence = payload.evidence or profile.evidence
    profile.comments = payload.comments or profile.comments
    profile.impact_level = payload.impact_level or profile.impact_level
    profile.probability_level = payload.probability_level or profile.probability_level
    profile.update_source = payload.update_source
    profile.attachments = payload.attachments or profile.attachments
    profile.last_updated = datetime.utcnow()

    existing_categories = {category.name: category for category in profile.categories}
    for category_payload in payload.categories:
        category = existing_categories.get(category_payload.name)
        if not category:
            category = CountryRiskCategoryScore(
                country_id=profile.id,
                name=category_payload.name,
                weight=next(
                    (cfg.get("weight") for cfg in assessment.categories_config if cfg["key"] == category_payload.name),
                    0,
                )
                / 100,
            )
            session.add(category)
        category.score = category_payload.score
        category.trend = category_payload.trend or category.trend

    engine = _engine_for_assessment(assessment)
    weights = {cfg["key"]: cfg.get("weight", 0) for cfg in assessment.categories_config}
    intelligence = engine.score_country(
        country_code=profile.country_code,
        categories=[(category.name, category.score) for category in profile.categories],
        weights=weights,
        scale=assessment.scoring_scale,
        assessment_end=assessment.end_date,
    )

    profile.overall_score = intelligence.overall_score
    profile.risk_level = intelligence.risk_level
    profile.trend = RiskTrendEnum(intelligence.trend)
    profile.confidence = ConfidenceLevelEnum(intelligence.confidence)
    profile.next_assessment_due = intelligence.next_assessment
    profile.ai_alerts = intelligence.ai_alerts
    profile.supporting_signals = intelligence.supporting_signals
    profile.recent_change = intelligence.predicted_change

    assessment.ai_recommendations = engine.build_ai_dashboard(
        [
            engine.score_country(
                country.country_code,
                [(category.name, category.score) for category in country.categories],
                weights,
                assessment.scoring_scale,
                assessment.end_date,
            )
            for country in assessment.countries
        ]
    )
    session.commit()
    session.refresh(profile)
    return _serialize_profile(profile)


@router.post("/assessments/{assessment_id}/ai-refresh")
def ai_refresh(assessment_id: int, session: Session = Depends(get_db)):
    assessment = session.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    engine = _engine_for_assessment(assessment)
    weights = {cfg["key"]: cfg.get("weight", 0) for cfg in assessment.categories_config}
    models = []
    for profile in assessment.countries:
        intelligence = engine.score_country(
            country_code=profile.country_code,
            categories=[(category.name, category.score) for category in profile.categories],
            weights=weights,
            scale=assessment.scoring_scale,
            assessment_end=assessment.end_date,
        )
        profile.overall_score = intelligence.overall_score
        profile.risk_level = intelligence.risk_level
        profile.trend = RiskTrendEnum(intelligence.trend)
        profile.confidence = ConfidenceLevelEnum(intelligence.confidence)
        profile.next_assessment_due = intelligence.next_assessment
        profile.ai_alerts = intelligence.ai_alerts
        profile.supporting_signals = intelligence.supporting_signals
        profile.recent_change = intelligence.predicted_change
        models.append(intelligence)

    assessment.ai_recommendations = engine.build_ai_dashboard(models)
    session.commit()
    session.refresh(assessment)
    return {
        "updatedAt": datetime.utcnow(),
        "aiRecommendations": assessment.ai_recommendations,
        "countries": [_serialize_profile(profile) for profile in assessment.countries],
    }
