from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, desc, func
from typing import List, Optional, Dict
import json
import uuid
from datetime import datetime

from database import get_db
from auth import get_current_user, require_role
from models import (
    User,
    UserRole,
    Questionnaire,
    Question,
    QuestionnaireResponse,
    Answer,
    QuestionnaireAnalytics,
    QuestionType,
    QuestionnaireStatus,
    QuestionnaireType,
    RiskLevel,
    AccessLevel,
    Department,
    Site,
    Country,
)
from schemas import (
    QuestionnaireCreate, QuestionnaireUpdate, QuestionnaireResponse as QuestionnaireResponseSchema,
    QuestionnaireResponseCreate, QuestionnaireResponseDetail, QuestionnaireStats,
    QuestionResponse,
    AnswerResponse,
    QuestionSuggestionRequest,
    QuestionSuggestionResponse,
    QuestionSuggestion,
    QuestionQualityRequest,
    QuestionQualityResponse,
    BiasFlag,
    QuestionnaireAIAnalysis,
    ResponseAIInsights,
    AnswerOptionRequest,
    AnswerOptionResponse,
)

router = APIRouter()

QUESTION_SUGGESTION_LIBRARY = {
    QuestionnaireType.ASSESSMENT: [
        {
            "suggestion": "Which compliance controls are most challenging to maintain this quarter?",
            "rationale": "Identifies operational pain points for targeted remediation plans.",
            "question_type": QuestionType.TEXTAREA,
            "answer_guidance": ["Control references", "Observed challenges", "Support needed"],
        },
        {
            "suggestion": "Rate the effectiveness of current mitigation strategies for high-risk findings.",
            "rationale": "Provides quantitative scoring for mitigation maturity.",
            "question_type": QuestionType.RATING,
            "answer_guidance": ["1 = Ineffective", "5 = Optimized"],
        },
    ],
    QuestionnaireType.SURVEY: [
        {
            "suggestion": "How confident are you in reporting potential compliance issues?",
            "rationale": "Captures employee trust and awareness levels.",
            "question_type": QuestionType.SINGLE_CHOICE,
            "answer_guidance": ["Very confident", "Somewhat confident", "Unsure", "Not confident"],
        },
        {
            "suggestion": "Select the resources you rely on most for compliance guidance.",
            "rationale": "Highlights effective enablement channels.",
            "question_type": QuestionType.MULTIPLE_CHOICE,
            "answer_guidance": ["Policy portal", "Training", "Manager", "Help desk"],
        },
    ],
    QuestionnaireType.CHECKLIST: [
        {
            "suggestion": "Confirm completion of required vendor due diligence documentation.",
            "rationale": "Ensures essential checklist items are captured in audits.",
            "question_type": QuestionType.YES_NO,
            "answer_guidance": ["Yes", "No", "Not applicable"],
        },
        {
            "suggestion": "Upload the signed approval evidence for policy exceptions.",
            "rationale": "Collects artefacts linked to checklist verification.",
            "question_type": QuestionType.FILE_UPLOAD,
            "answer_guidance": ["Attach signed PDF or image"],
        },
    ],
    QuestionnaireType.EVALUATION: [
        {
            "suggestion": "Evaluate the residual risk level after implemented controls.",
            "rationale": "Provides data for automated scoring models.",
            "question_type": QuestionType.RATING,
            "answer_guidance": ["1 = Very Low", "5 = Very High"],
        },
        {
            "suggestion": "Provide evidence links supporting your evaluation score.",
            "rationale": "Improves auditability of evaluation outcomes.",
            "question_type": QuestionType.TEXT,
            "answer_guidance": ["Link to documentation", "Summary of evidence"],
        },
    ],
}

POTENTIAL_BIAS_TERMS = {
    "always": "Absolutes can pressure respondents and bias answers.",
    "never": "Absolute phrasing may lead to defensive responses.",
    "should": "Suggests a preferred answer and introduces bias.",
    "must": "Strong directive that can reduce honest feedback.",
    "obviously": "Implies judgement and can alienate respondents.",
}


def _generate_answer_options(question_text: str, desired_count: int, questionnaire_type: Optional[QuestionnaireType]) -> List[str]:
    base_options: List[str] = []
    lowered = question_text.lower()

    if any(keyword in lowered for keyword in ["confidence", "familiar"]):
        base_options = [
            "Very high",
            "High",
            "Moderate",
            "Low",
            "Very low",
        ]
    elif "frequency" in lowered or "often" in lowered:
        base_options = [
            "Always",
            "Frequently",
            "Sometimes",
            "Rarely",
            "Never",
        ]
    elif any(keyword in lowered for keyword in ["satisfaction", "satisfied"]):
        base_options = [
            "Very satisfied",
            "Satisfied",
            "Neutral",
            "Dissatisfied",
            "Very dissatisfied",
        ]
    elif questionnaire_type == QuestionnaireType.CHECKLIST:
        base_options = [
            "Completed",
            "In progress",
            "Not started",
            "Not applicable",
        ]
    elif questionnaire_type == QuestionnaireType.ASSESSMENT:
        base_options = [
            "Optimised",
            "Managed",
            "Defined",
            "Initial",
            "Non-compliant",
        ]
    else:
        base_options = [
            "Strongly agree",
            "Agree",
            "Neutral",
            "Disagree",
            "Strongly disagree",
        ]

    unique_options: List[str] = []
    for option in base_options:
        if option not in unique_options:
            unique_options.append(option)
        if len(unique_options) >= desired_count:
            break

    while len(unique_options) < desired_count:
        unique_options.append(f"Option {len(unique_options) + 1}")

    return unique_options


def _score_question_text(question_text: str) -> tuple[int, int, List[Dict[str, str]], List[str]]:
    """Return clarity score, complexity score, bias flags, and improvement tips."""

    clean_text = question_text.strip()
    words = clean_text.split()
    word_count = len(words)

    clarity = 70
    if clean_text.endswith("?"):
        clarity += 10
    if word_count <= 18:
        clarity += 10
    if word_count > 28:
        clarity -= min(20, (word_count - 28) * 2)
    clarity = max(30, min(100, clarity))

    complexity = 50 + min(30, max(0, word_count - 10))
    if word_count < 8:
        complexity -= 10
    complexity = max(20, min(100, complexity))

    bias_flags: List[Dict[str, str]] = []
    lower_text = clean_text.lower()
    for phrase, reason in POTENTIAL_BIAS_TERMS.items():
        if phrase in lower_text:
            bias_flags.append(
                {
                    "phrase": phrase,
                    "reason": reason,
                    "suggestion": "Rephrase using neutral wording (e.g., 'how frequently' or 'to what extent').",
                }
            )

    improvements: List[str] = []
    if not clean_text.endswith("?"):
        improvements.append("End the question with a question mark to emphasise inquiry over instruction.")
    if word_count < 6:
        improvements.append("Add more context so respondents clearly understand what information is needed.")
    if word_count > 25:
        improvements.append("Consider shortening the question or splitting it to reduce cognitive load.")
    if not bias_flags and clarity > 85:
        improvements.append("This question is well structured. Consider adding optional guidance text if needed.")

    return clarity, complexity, bias_flags, improvements


def _calculate_questionnaire_score(questionnaire: Questionnaire) -> QuestionnaireAIAnalysis:
    question_count = len(questionnaire.questions)
    required_questions = sum(1 for q in questionnaire.questions if q.is_required)
    weighted_score = sum((q.scoring_weight or 1.0) for q in questionnaire.questions)
    high_risk_questions = [q for q in questionnaire.questions if q.risk_level in {RiskLevel.HIGH, RiskLevel.CRITICAL}]

    required_ratio = required_questions / question_count if question_count else 0
    weighted_avg = weighted_score / question_count if question_count else 0

    base_score = 60
    base_score += int(required_ratio * 20)
    base_score += int(min(15, weighted_avg * 3))
    if high_risk_questions:
        base_score -= min(20, len(high_risk_questions) * 5)
    base_score = max(30, min(95, base_score))

    strengths: List[str] = []
    risks: List[str] = []
    recommendations: List[str] = []

    if required_ratio >= 0.7:
        strengths.append("Strong coverage of mandatory questions ensures consistent data quality.")
    else:
        recommendations.append("Increase the number of required questions to secure critical responses.")

    if weighted_avg >= 1.5:
        strengths.append("Scoring weights are configured for advanced analytics.")
    else:
        recommendations.append("Assign scoring weights to prioritise high-impact questions.")

    if high_risk_questions:
        risks.append(
            f"{len(high_risk_questions)} questions are marked high or critical risk—plan targeted follow-up actions."
        )
        recommendations.append("Add mitigation guidance or follow-up tasks for high-risk answers.")
    else:
        strengths.append("No high-risk questions detected—response load is well balanced.")

    if questionnaire.randomize_questions:
        strengths.append("Randomised questions help reduce ordering bias in responses.")

    return QuestionnaireAIAnalysis(
        questionnaire_id=questionnaire.id,
        overall_score=base_score,
        strength_summary=strengths,
        risk_summary=risks,
        recommendations=recommendations,
    )


def _generate_response_insights(questionnaire: Questionnaire, responses: List[QuestionnaireResponse]) -> ResponseAIInsights:
    total_responses = len(responses)
    completed = sum(1 for r in responses if r.is_complete)
    completion_rate = (completed / total_responses) if total_responses else 0

    average_time = None
    durations = [r.time_spent_seconds for r in responses if r.time_spent_seconds]
    if durations:
        average_time = int(sum(durations) / len(durations))

    anomalies: List[str] = []
    follow_up: List[str] = []
    highlights: List[Dict[str, str]] = []

    if completion_rate < 0.5 and total_responses:
        anomalies.append("Completion rate below 50%—consider simplifying questions or sending reminders.")
        follow_up.append("Trigger reminder emails for respondents who have not finished.")

    if durations and min(durations) < 30:
        anomalies.append("Some responses were completed in under 30 seconds, indicating potential low-quality input.")
        follow_up.append("Review fast submissions for accuracy or require mandatory comments.")

    text_answers = [
        (answer.question_id, answer.answer_text)
        for response in responses
        for answer in response.answers or []
        if answer.answer_text
    ]
    if text_answers:
        seen: Dict[str, int] = {}
        for _, text in text_answers:
            key = text.strip().lower()
            seen[key] = seen.get(key, 0) + 1
        dominant = max(seen.values())
        if dominant / max(1, len(text_answers)) > 0.6:
            anomalies.append("High similarity detected in free-text answers—possible duplicate or templated responses.")
            follow_up.append("Introduce variation prompts or require specific examples in text questions.")

    quality_score = 70
    quality_score += int(completion_rate * 20)
    if average_time and average_time >= 90:
        quality_score += 5
    quality_score -= len(anomalies) * 5
    quality_score = max(40, min(95, quality_score))

    highlights.append(
        {
            "label": "Completion rate",
            "value": f"{completion_rate * 100:.0f}%",
            "status": "success" if completion_rate >= 0.7 else "warning",
        }
    )

    highlights.append(
        {
            "label": "Average completion time",
            "value": f"{average_time or 0} seconds",
            "status": "info",
        }
    )

    return ResponseAIInsights(
        questionnaire_id=questionnaire.id,
        quality_score=quality_score,
        predicted_completion_time=average_time,
        anomalies=anomalies,
        follow_up_recommendations=follow_up,
        highlights=[ResponseInsight(**item) for item in highlights],
    )


def _hydrate_questionnaire_model(questionnaire: Questionnaire) -> Questionnaire:
    """Convert JSON/text fields to rich Python objects for schema validation."""

    if questionnaire.target_roles:
        try:
            questionnaire.target_roles = json.loads(questionnaire.target_roles)
        except (TypeError, ValueError):
            questionnaire.target_roles = []

    if questionnaire.target_departments:
        try:
            questionnaire.target_departments = json.loads(questionnaire.target_departments)
        except (TypeError, ValueError):
            questionnaire.target_departments = []

    for question in questionnaire.questions:
        if question.options and isinstance(question.options, str):
            try:
                question.options = json.loads(question.options)
            except (TypeError, ValueError):
                question.options = []

        if question.validation_rules and isinstance(question.validation_rules, str):
            try:
                question.validation_rules = json.loads(question.validation_rules)
            except (TypeError, ValueError):
                question.validation_rules = None

        if question.matrix_config and isinstance(question.matrix_config, str):
            try:
                question.matrix_config = json.loads(question.matrix_config)
            except (TypeError, ValueError):
                question.matrix_config = None

        if question.ai_metadata and isinstance(question.ai_metadata, str):
            try:
                question.ai_metadata = json.loads(question.ai_metadata)
            except (TypeError, ValueError):
                question.ai_metadata = None

    return questionnaire


def _hydrate_response_model(response: QuestionnaireResponse) -> QuestionnaireResponse:
    """Convert stored JSON strings in responses to Python objects."""

    if response.answers:
        for answer in response.answers:
            if answer.selected_options and isinstance(answer.selected_options, str):
                try:
                    answer.selected_options = json.loads(answer.selected_options)
                except (TypeError, ValueError):
                    answer.selected_options = []

    return response

def check_questionnaire_access(db: Session, questionnaire: Questionnaire, user: User, permission: str) -> bool:
    """Check if user has access to questionnaire based on company and role"""
    
    # Admin has all permissions
    if user.role == UserRole.ADMIN:
        return True
    
    # Check if user is questionnaire creator
    if questionnaire.created_by_id == user.id:
        return True
    
    # Check company-based access (same as documents)
    if user.department_id:
        user_department = db.query(Department).filter(Department.id == user.department_id).first()
        if user_department and user_department.site_id:
            user_site = db.query(Site).filter(Site.id == user_department.site_id).first()
            if user_site and user_site.country_id:
                user_country = db.query(Country).filter(Country.id == user_site.country_id).first()
                if user_country:
                    user_company_id = user_country.company_id
                    
                    # Get questionnaire creator's company
                    creator = db.query(User).filter(User.id == questionnaire.created_by_id).first()
                    if creator and creator.department_id:
                        creator_department = db.query(Department).filter(Department.id == creator.department_id).first()
                        if creator_department and creator_department.site_id:
                            creator_site = db.query(Site).filter(Site.id == creator_department.site_id).first()
                            if creator_site and creator_site.country_id:
                                creator_country = db.query(Country).filter(Country.id == creator_site.country_id).first()
                                if creator_country:
                                    creator_company_id = creator_country.company_id
                                    
                                    # Only allow access if users are from same company
                                    if user_company_id != creator_company_id:
                                        return False
    
    # Check target roles and departments
    if questionnaire.target_roles:
        target_roles = json.loads(questionnaire.target_roles)
        if user.role.value not in target_roles:
            return False
    
    if questionnaire.target_departments:
        target_departments = json.loads(questionnaire.target_departments)
        if user.department_id not in target_departments:
            return False
    
    # Check access level and permissions
    if questionnaire.access_level == AccessLevel.PUBLIC:
        return True
    elif questionnaire.access_level == AccessLevel.INTERNAL:
        return user.role in [UserRole.ADMIN, UserRole.MANAGER, UserRole.AUDITOR, UserRole.EMPLOYEE, UserRole.VIEWER]
    
    return False

@router.post("/", response_model=QuestionnaireResponseSchema)
async def create_questionnaire(
    questionnaire_data: QuestionnaireCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check permissions - only admins, managers can create questionnaires
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(
            status_code=403,
            detail="Only administrators and managers can create questionnaires"
        )
    
    # Create questionnaire
    questionnaire = Questionnaire(
        title=questionnaire_data.title,
        description=questionnaire_data.description,
        questionnaire_type=questionnaire_data.questionnaire_type,
        allow_anonymous=questionnaire_data.allow_anonymous,
        allow_multiple_responses=questionnaire_data.allow_multiple_responses,
        show_progress=questionnaire_data.show_progress,
        randomize_questions=questionnaire_data.randomize_questions,
        starts_at=questionnaire_data.starts_at,
        ends_at=questionnaire_data.ends_at,
        access_level=questionnaire_data.access_level,
        target_roles=json.dumps(questionnaire_data.target_roles) if questionnaire_data.target_roles else None,
        target_departments=json.dumps(questionnaire_data.target_departments) if questionnaire_data.target_departments else None,
        linked_document_id=questionnaire_data.linked_document_id,
        trigger_on_document_access=questionnaire_data.trigger_on_document_access,
        created_by_id=current_user.id
    )
    
    db.add(questionnaire)
    db.commit()
    db.refresh(questionnaire)
    
    # Create questions
    for question_data in questionnaire_data.questions:
        question = Question(
            questionnaire_id=questionnaire.id,
            question_text=question_data.question_text,
            question_type=question_data.question_type,
            is_required=question_data.is_required,
            order_index=question_data.order_index,
            options=json.dumps(question_data.options) if question_data.options else None,
            min_value=question_data.min_value,
            max_value=question_data.max_value,
            placeholder=question_data.placeholder,
            help_text=question_data.help_text,
            validation_rules=json.dumps(question_data.validation_rules) if question_data.validation_rules else None,
            scoring_weight=question_data.scoring_weight,
            risk_level=question_data.risk_level,
            matrix_config=json.dumps(question_data.matrix_config) if question_data.matrix_config else None,
            conditional_question_id=question_data.conditional_question_id,
            conditional_operator=question_data.conditional_operator,
            conditional_value=question_data.conditional_value,
            show_if_condition_met=question_data.show_if_condition_met
        )
        db.add(question)
    
    db.commit()
    
    # Reload with questions
    questionnaire = db.query(Questionnaire).options(
        joinedload(Questionnaire.questions)
    ).filter(Questionnaire.id == questionnaire.id).first()

    hydrated = _hydrate_questionnaire_model(questionnaire)

    return QuestionnaireResponseSchema.model_validate(hydrated)

@router.get("/", response_model=List[QuestionnaireResponseSchema])
async def list_questionnaires(
    status: Optional[QuestionnaireStatus] = None,
    page: int = 1,
    size: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Build query
    query = db.query(Questionnaire).options(joinedload(Questionnaire.questions))
    
    # Apply status filter
    if status:
        query = query.filter(Questionnaire.status == status)
    
    # Apply pagination
    offset = (page - 1) * size
    questionnaires = query.offset(offset).limit(size).all()
    
    # Filter by access permissions
    accessible_questionnaires = []
    for questionnaire in questionnaires:
        if check_questionnaire_access(db, questionnaire, current_user, "read"):
            accessible_questionnaires.append(questionnaire)
    
    hydrated = [_hydrate_questionnaire_model(q) for q in accessible_questionnaires]

    return [QuestionnaireResponseSchema.model_validate(q) for q in hydrated]

@router.get("/{questionnaire_id}", response_model=QuestionnaireResponseSchema)
async def get_questionnaire(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    questionnaire = db.query(Questionnaire).options(
        joinedload(Questionnaire.questions)
    ).filter(Questionnaire.id == questionnaire_id).first()
    
    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    
    if not check_questionnaire_access(db, questionnaire, current_user, "read"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    hydrated = _hydrate_questionnaire_model(questionnaire)

    return QuestionnaireResponseSchema.model_validate(hydrated)

@router.put("/{questionnaire_id}", response_model=QuestionnaireResponseSchema)
async def update_questionnaire(
    questionnaire_id: int,
    update_data: QuestionnaireUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    questionnaire = db.query(Questionnaire).filter(Questionnaire.id == questionnaire_id).first()
    
    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    
    if not check_questionnaire_access(db, questionnaire, current_user, "edit"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update fields
    update_fields = update_data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        if field in ['target_roles', 'target_departments'] and value is not None:
            value = json.dumps(value)
        setattr(questionnaire, field, value)
    
    questionnaire.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(questionnaire)

    hydrated = _hydrate_questionnaire_model(questionnaire)

    return QuestionnaireResponseSchema.model_validate(hydrated)

@router.post("/{questionnaire_id}/responses", response_model=QuestionnaireResponseDetail)
async def submit_response(
    questionnaire_id: int,
    response_data: QuestionnaireResponseCreate,
    request: Request,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    questionnaire = db.query(Questionnaire).filter(Questionnaire.id == questionnaire_id).first()
    
    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    
    # Check if questionnaire is active
    if questionnaire.status != QuestionnaireStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Questionnaire is not active")
    
    # Check time constraints
    now = datetime.utcnow()
    if questionnaire.starts_at and now < questionnaire.starts_at:
        raise HTTPException(status_code=400, detail="Questionnaire has not started yet")
    if questionnaire.ends_at and now > questionnaire.ends_at:
        raise HTTPException(status_code=400, detail="Questionnaire has ended")
    
    # Check if anonymous responses are allowed
    if not current_user and not questionnaire.allow_anonymous:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Check for existing responses if multiple responses not allowed
    if current_user and not questionnaire.allow_multiple_responses:
        existing = db.query(QuestionnaireResponse).filter(
            QuestionnaireResponse.questionnaire_id == questionnaire_id,
            QuestionnaireResponse.respondent_id == current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Multiple responses not allowed")
    
    # Create response
    session_id = str(uuid.uuid4())
    response = QuestionnaireResponse(
        questionnaire_id=questionnaire_id,
        respondent_id=current_user.id if current_user else None,
        session_id=session_id,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent"),
        is_complete=True,
        completed_at=datetime.utcnow()
    )
    
    db.add(response)
    db.commit()
    db.refresh(response)
    
    # Create answers
    for answer_data in response_data.answers:
        answer = Answer(
            question_id=answer_data.question_id,
            response_id=response.id,
            answer_text=answer_data.answer_text,
            answer_number=answer_data.answer_number,
            answer_date=answer_data.answer_date,
            answer_boolean=answer_data.answer_boolean,
            selected_options=json.dumps(answer_data.selected_options) if answer_data.selected_options else None
        )
        db.add(answer)
    
    db.commit()
    
    # Update analytics
    analytics = db.query(QuestionnaireAnalytics).filter(
        QuestionnaireAnalytics.questionnaire_id == questionnaire_id
    ).first()
    
    if not analytics:
        analytics = QuestionnaireAnalytics(questionnaire_id=questionnaire_id)
        db.add(analytics)
    
    analytics.total_responses += 1
    analytics.completed_responses += 1
    analytics.completion_rate = (analytics.completed_responses / analytics.total_responses) * 100
    db.commit()
    
    # Reload with answers
    response = db.query(QuestionnaireResponse).options(
        joinedload(QuestionnaireResponse.answers)
    ).filter(QuestionnaireResponse.id == response.id).first()

    hydrated_response = _hydrate_response_model(response)

    return QuestionnaireResponseDetail.model_validate(hydrated_response)

@router.get("/{questionnaire_id}/responses", response_model=List[QuestionnaireResponseDetail])
async def get_responses(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    questionnaire = db.query(Questionnaire).filter(Questionnaire.id == questionnaire_id).first()
    
    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    
    if not check_questionnaire_access(db, questionnaire, current_user, "read"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    responses = db.query(QuestionnaireResponse).options(
        joinedload(QuestionnaireResponse.answers)
    ).filter(QuestionnaireResponse.questionnaire_id == questionnaire_id).all()

    hydrated = [_hydrate_response_model(r) for r in responses]

    return [QuestionnaireResponseDetail.model_validate(r) for r in hydrated]

@router.get("/{questionnaire_id}/stats", response_model=QuestionnaireStats)
async def get_questionnaire_stats(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    questionnaire = db.query(Questionnaire).filter(Questionnaire.id == questionnaire_id).first()
    
    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    
    if not check_questionnaire_access(db, questionnaire, current_user, "read"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    analytics = db.query(QuestionnaireAnalytics).filter(
        QuestionnaireAnalytics.questionnaire_id == questionnaire_id
    ).first()
    
    if not analytics:
        return QuestionnaireStats(
            total_responses=0,
            completed_responses=0,
            completion_rate=0,
            average_completion_time=0,
            unique_visitors=0,
            bounce_rate=0
        )

    return QuestionnaireStats.model_validate(analytics)


@router.post("/ai/suggestions", response_model=QuestionSuggestionResponse)
async def get_intelligent_question_suggestions(
    payload: QuestionSuggestionRequest,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.AUDITOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions for AI suggestions")

    library = QUESTION_SUGGESTION_LIBRARY.get(payload.questionnaire_type, [])
    suggestions = []
    existing = {q.lower() for q in (payload.existing_questions or [])}

    for item in library:
        if item["suggestion"].lower() in existing:
            continue
        suggestions.append(item)

    if payload.focus_area:
        suggestions.append(
            {
                "suggestion": f"Describe how your team manages {payload.focus_area} risks today.",
                "rationale": "Adds contextual depth based on the selected focus area.",
                "question_type": QuestionType.TEXTAREA,
                "answer_guidance": ["Current process", "Tools used", "Pain points"],
            }
        )

    if payload.keywords:
        for keyword in payload.keywords:
            suggestions.append(
                {
                    "suggestion": f"Rate the maturity of {keyword} practices in your area.",
                    "rationale": "Links questionnaire to tracked compliance themes.",
                    "question_type": QuestionType.RATING,
                    "answer_guidance": ["1 = Not started", "5 = Optimised"],
                }
            )

    return QuestionSuggestionResponse(
        questionnaire_type=payload.questionnaire_type,
        suggestions=[QuestionSuggestion(**s) for s in suggestions[:6]],
    )


@router.post("/ai/question-quality", response_model=QuestionQualityResponse)
async def score_question_quality(
    payload: QuestionQualityRequest,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.AUDITOR, UserRole.EMPLOYEE]:
        raise HTTPException(status_code=403, detail="Insufficient permissions for AI review")

    clarity, complexity, bias_flags, improvements = _score_question_text(payload.question_text)

    # Encourage balanced options for choice questions
    if payload.question_type in (QuestionType.MULTIPLE_CHOICE, QuestionType.SINGLE_CHOICE):
        options = payload.answer_options or []
        if len(options) < 3:
            improvements.append("Add at least three answer options to capture a wider range of responses.")
        if any(opt.lower() in {"other", "n/a"} for opt in options):
            clarity = min(100, clarity + 5)

    return QuestionQualityResponse(
        clarity_score=clarity,
        complexity_score=complexity,
        bias_flags=[BiasFlag(**flag) for flag in bias_flags],
        improvements=improvements,
    )


@router.post("/ai/answer-options", response_model=AnswerOptionResponse)
async def generate_answer_options(
    payload: AnswerOptionRequest,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.AUDITOR, UserRole.EMPLOYEE]:
        raise HTTPException(status_code=403, detail="Insufficient permissions for AI answer generation")

    options = _generate_answer_options(payload.question_text, payload.desired_count, payload.questionnaire_type)

    return AnswerOptionResponse(options=options)


@router.get("/{questionnaire_id}/ai/analysis", response_model=QuestionnaireAIAnalysis)
async def automated_questionnaire_analysis(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    questionnaire = db.query(Questionnaire).options(joinedload(Questionnaire.questions)).filter(
        Questionnaire.id == questionnaire_id
    ).first()

    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")

    if not check_questionnaire_access(db, questionnaire, current_user, "read"):
        raise HTTPException(status_code=403, detail="Access denied")

    hydrated = _hydrate_questionnaire_model(questionnaire)

    analysis = _calculate_questionnaire_score(hydrated)

    return analysis


@router.get("/{questionnaire_id}/ai/response-insights", response_model=ResponseAIInsights)
async def automated_response_insights(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    questionnaire = db.query(Questionnaire).filter(Questionnaire.id == questionnaire_id).first()

    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")

    if not check_questionnaire_access(db, questionnaire, current_user, "read"):
        raise HTTPException(status_code=403, detail="Access denied")

    responses = (
        db.query(QuestionnaireResponse)
        .options(joinedload(QuestionnaireResponse.answers))
        .filter(QuestionnaireResponse.questionnaire_id == questionnaire_id)
        .all()
    )

    hydrated_questionnaire = _hydrate_questionnaire_model(questionnaire)
    hydrated_responses = [_hydrate_response_model(r) for r in responses]

    insights = _generate_response_insights(hydrated_questionnaire, hydrated_responses)

    return insights