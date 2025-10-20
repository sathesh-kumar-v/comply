from __future__ import annotations
from pydantic import BaseModel, EmailStr, field_validator, Field, conint, AnyUrl
from typing import Optional, List, Union, Dict, Any, Literal
from datetime import datetime, date
from models import (
    UserRole,
    DocumentStatus,
    DocumentType,
    AccessLevel,
    QuestionType,
    QuestionnaireStatus,
    QuestionnaireType,
    RiskLevel,
    FMEAType,
    FMEAStatus,
    ActionStatus,
)
from enum import Enum



# User schemas
class UserBase(BaseModel):
    """Base user information"""
    email: EmailStr
    username: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "email": "john.doe@company.com",
                    "username": "johndoe",
                    "first_name": "John",
                    "last_name": "Doe",
                    "phone": "+1-555-123-4567",
                    "department": "IT Security",
                    "position": "Compliance Officer"
                }
            ]
        }
    }

class UserCreate(UserBase):
    """User creation schema with password and role - Extended for compliance wizard"""
    password: str
    role: UserRole = UserRole.EMPLOYEE
    
    # Professional Information
    employee_id: Optional[str] = None
    
    # Compliance Role & Permissions
    areas_of_responsibility: List[str] = []
    
    # Additional Settings
    timezone: str = "UTC"
    notifications_email: bool = True
    notifications_sms: bool = False
    
    @field_validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v
    
    @field_validator('areas_of_responsibility')
    def validate_areas(cls, v):
        valid_areas = [
            'Document Management',
            'Risk Assessment', 
            'Audit Management',
            'Incident Management',
            'Policy Management',
            'Training & Certification',
            'Regulatory Compliance',
            'Quality Management'
        ]
        for area in v:
            if area not in valid_areas:
                raise ValueError(f'Invalid area of responsibility: {area}')
        return v
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "email": "jane.smith@company.com",
                    "username": "janesmith",
                    "first_name": "Jane",
                    "last_name": "Smith",
                    "password": "securePassword123",
                    "phone": "+1-555-987-6543",
                    "department": "Finance",
                    "position": "Auditor",
                    "role": "auditor",
                    "employee_id": "EMP001",
                    "areas_of_responsibility": ["Audit Management", "Risk Assessment"],
                    "timezone": "UTC",
                    "notifications_email": True,
                    "notifications_sms": False
                }
            ]
        }
    }

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: int
    role: UserRole
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True

# Authentication schemas
class UserLogin(BaseModel):
    """User login credentials"""
    username: str
    password: str
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "username": "johndoe",
                    "password": "mySecretPassword123"
                }
            ]
        }
    }

class Token(BaseModel):
    """JWT token response with user information"""
    access_token: str
    token_type: str
    expires_in: int
    user: UserResponse
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "token_type": "bearer",
                    "expires_in": 86400,
                    "user": {
                        "id": 1,
                        "email": "john.doe@company.com",
                        "username": "johndoe",
                        "first_name": "John",
                        "last_name": "Doe",
                        "role": "employee",
                        "is_active": True,
                        "is_verified": False,
                        "created_at": "2024-01-01T00:00:00",
                        "department": "IT Security",
                        "position": "Compliance Officer"
                    }
                }
            ]
        }
    }

class TokenData(BaseModel):
    username: Optional[str] = None

# Permission schemas
class PermissionBase(BaseModel):
    name: str
    description: Optional[str] = None
    module: str
    action: str

class PermissionCreate(PermissionBase):
    pass

class PermissionResponse(PermissionBase):
    id: int
    
    class Config:
        from_attributes = True


# Document Management Schemas

class DocumentBase(BaseModel):
    title: str
    description: Optional[str] = None
    document_type: DocumentType
    access_level: AccessLevel = AccessLevel.INTERNAL
    category: Optional[str] = None
    subcategory: Optional[str] = None
    keywords: Optional[List[str]] = []
    tags: Optional[List[str]] = []
    compliance_framework: Optional[str] = None
    retention_period_months: Optional[int] = None
    review_frequency_months: Optional[int] = None
    expires_at: Optional[datetime] = None

class DocumentCreate(DocumentBase):
    pass

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    document_type: Optional[DocumentType] = None
    status: Optional[DocumentStatus] = None
    access_level: Optional[AccessLevel] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    keywords: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    compliance_framework: Optional[str] = None
    retention_period_months: Optional[int] = None
    review_frequency_months: Optional[int] = None
    expires_at: Optional[datetime] = None

class DocumentResponse(DocumentBase):
    id: int
    status: DocumentStatus
    filename: str
    file_size: int
    mime_type: str
    version: str
    is_current_version: bool
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    approved_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    next_review_date: Optional[datetime] = None
    linked_questionnaires: Optional[List[Dict[str, Any]]] = None
    
    # Related data
    created_by: Optional["UserResponse"] = None
    modified_by: Optional["UserResponse"] = None
    approved_by: Optional["UserResponse"] = None
    
    @field_validator('keywords', 'tags', mode='before')
    @classmethod
    def parse_json_lists(cls, v):
        """Convert JSON strings to lists for keywords and tags"""
        if isinstance(v, str):
            try:
                import json
                return json.loads(v) if v else []
            except (json.JSONDecodeError, TypeError):
                return []
        return v if isinstance(v, list) else []
    
    class Config:
        from_attributes = True

class DocumentListResponse(BaseModel):
    id: int
    title: str
    document_type: DocumentType
    status: DocumentStatus
    access_level: AccessLevel
    category: Optional[str] = None
    filename: str
    file_size: int
    version: str
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    next_review_date: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class DocumentSearchRequest(BaseModel):
    query: Optional[str] = None
    document_type: Optional[DocumentType] = None
    status: Optional[DocumentStatus] = None
    access_level: Optional[AccessLevel] = None
    category: Optional[str] = None
    created_by: Optional[int] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    tags: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    compliance_framework: Optional[str] = None
    expires_before: Optional[datetime] = None
    needs_review: Optional[bool] = None
    
    # Pagination
    page: int = 1
    size: int = 20
    sort_by: str = "created_at"
    sort_order: str = "desc"  # "asc" or "desc"

class DocumentSearchResponse(BaseModel):
    documents: List[DocumentListResponse]
    total_count: int
    page: int
    size: int
    total_pages: int

class DocumentVersionResponse(BaseModel):
    id: int
    version: str
    filename: str
    file_size: int
    file_hash: str
    change_summary: Optional[str] = None
    created_by_id: int
    created_at: datetime
    
    created_by: Optional["UserResponse"] = None
    
    class Config:
        from_attributes = True

class DocumentAccessRequest(BaseModel):
    user_id: Optional[int] = None
    role: Optional[UserRole] = None
    department: Optional[str] = None
    can_read: bool = True
    can_download: bool = False
    can_edit: bool = False
    can_delete: bool = False
    can_approve: bool = False
    expires_at: Optional[datetime] = None

class DocumentAccessResponse(BaseModel):
    id: int
    document_id: int
    user_id: Optional[int] = None
    role: Optional[UserRole] = None
    department: Optional[str] = None
    can_read: bool
    can_download: bool
    can_edit: bool
    can_delete: bool
    can_approve: bool
    granted_by_id: int
    granted_at: datetime
    expires_at: Optional[datetime] = None
    
    user: Optional["UserResponse"] = None
    granted_by: Optional["UserResponse"] = None
    
    class Config:
        from_attributes = True

class DocumentAuditLogResponse(BaseModel):
    id: int
    document_id: int
    user_id: int
    action: str
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime
    
    user: Optional["UserResponse"] = None
    
    class Config:
        from_attributes = True

class DocumentCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None
    color: Optional[str] = None
    icon: Optional[str] = None

class DocumentCategoryCreate(DocumentCategoryBase):
    pass

class DocumentCategoryResponse(DocumentCategoryBase):
    id: int
    created_at: datetime
    created_by_id: int
    
    created_by: Optional["UserResponse"] = None
    children: Optional[List["DocumentCategoryResponse"]] = []
    
    class Config:
        from_attributes = True

class DocumentReviewBase(BaseModel):
    comments: Optional[str] = None
    due_date: Optional[datetime] = None

class DocumentReviewCreate(DocumentReviewBase):
    reviewer_id: int

class DocumentReviewUpdate(BaseModel):
    status: str  # PENDING, APPROVED, REJECTED, CHANGES_REQUESTED
    comments: Optional[str] = None

class DocumentReviewResponse(DocumentReviewBase):
    id: int
    document_id: int
    reviewer_id: int
    status: str
    reviewed_at: Optional[datetime] = None
    assigned_by_id: int
    assigned_at: datetime
    
    reviewer: Optional["UserResponse"] = None
    assigned_by: Optional["UserResponse"] = None
    
    class Config:
        from_attributes = True

class DocumentUploadResponse(BaseModel):
    message: str
    document: DocumentResponse

class DocumentStats(BaseModel):
    total_documents: int
    by_type: dict
    by_status: dict
    by_access_level: dict
    documents_needing_review: int
    expired_documents: int
    recent_uploads: int


# --- Document AI Schemas ---


class DocumentAICategorizeRequest(BaseModel):
    title: str
    description: Optional[str] = None
    document_type: Optional[DocumentType] = None
    department: Optional[str] = None
    existing_tags: Optional[List[str]] = None
    existing_keywords: Optional[List[str]] = None
    text_preview: Optional[str] = None


class DocumentAICategorizeResponse(BaseModel):
    category: Optional[str] = None
    secondary_categories: List[str] = []
    tags: List[str] = []
    keywords: List[str] = []
    summary: Optional[str] = None
    confidence: Optional[float] = None
    notes: List[str] = []
    raw: Optional[str] = None


class DocumentAISearchPlan(BaseModel):
    refined_query: Optional[str] = None
    keywords: List[str] = []
    document_types: List[str] = []
    statuses: List[str] = []
    access_levels: List[str] = []
    priority: Optional[str] = None
    reasoning: Optional[str] = None
    raw: Optional[str] = None


class DocumentAISearchRequest(BaseModel):
    query: str
    page: int = 1
    size: int = 20


class DocumentAISearchResponse(BaseModel):
    plan: DocumentAISearchPlan
    results: List[DocumentListResponse]
    total_count: int
    total_pages: int


class DocumentAIDuplicateMatch(BaseModel):
    id: int
    title: str
    similarity: float
    reasoning: Optional[str] = None


class DocumentAIDuplicateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    document_type: Optional[DocumentType] = None
    file_hash: Optional[str] = None
    keywords: Optional[List[str]] = None
    tags: Optional[List[str]] = None


class DocumentAIDuplicateResponse(BaseModel):
    has_exact_match: bool = False
    duplicates: List[DocumentAIDuplicateMatch] = []
    notes: List[str] = []
    raw: Optional[str] = None


class DocumentAIRecommendation(BaseModel):
    id: int
    title: str
    reason: Optional[str] = None
    priority: Optional[str] = None


class DocumentAIRecommendationResponse(BaseModel):
    recommendations: List[DocumentAIRecommendation] = []
    documents: List[DocumentListResponse] = []
    summary: Optional[str] = None
    raw: Optional[str] = None


class DocumentAICompletionRequest(BaseModel):
    context: str
    focus: Optional[str] = None


class DocumentAICompletionResponse(BaseModel):
    completion: str
    reasoning: Optional[str] = None
    tips: List[str] = []
    raw: Optional[str] = None


class DocumentAITemplateSuggestion(BaseModel):
    name: str
    description: Optional[str] = None
    when_to_use: Optional[str] = None


class DocumentAITemplateResponse(BaseModel):
    templates: List[DocumentAITemplateSuggestion] = []
    sections: List[str] = []
    notes: List[str] = []
    raw: Optional[str] = None


class DocumentAIGrammarIssue(BaseModel):
    issue: str
    severity: Optional[str] = None
    suggestion: Optional[str] = None


class DocumentAIGrammarRequest(BaseModel):
    content: str
    jurisdiction: Optional[str] = None


class DocumentAIGrammarResponse(BaseModel):
    score: Optional[float] = None
    issues: List[DocumentAIGrammarIssue] = []
    summary: Optional[str] = None
    raw: Optional[str] = None


class DocumentAINumberingRequest(BaseModel):
    outline: List[str]
    cross_reference_hints: Optional[List[str]] = None


class DocumentAINumberedSection(BaseModel):
    number: str
    heading: str


class DocumentAINumberingResponse(BaseModel):
    numbered_sections: List[DocumentAINumberedSection] = []
    cross_references: List[str] = []
    notes: List[str] = []
    raw: Optional[str] = None


class DocumentAIReviewer(BaseModel):
    id: int
    name: str
    role: Optional[str] = None
    expertise: Optional[List[str]] = None
    workload: Optional[str] = None


class DocumentAIWorkflowAssignRequest(BaseModel):
    document_id: Optional[int] = None
    document_type: Optional[str] = None
    department: Optional[str] = None
    reviewer_ids: Optional[List[int]] = None


class DocumentAIWorkflowAssignResponse(BaseModel):
    recommended: List[DocumentAIReviewer] = []
    backup: List[DocumentAIReviewer] = []
    notes: List[str] = []
    raw: Optional[str] = None


class DocumentAIWorkflowProgressRequest(BaseModel):
    document_id: Optional[int] = None


class DocumentAIWorkflowProgressResponse(BaseModel):
    next_step: Optional[str] = None
    automation: List[str] = []
    blockers: List[str] = []
    notes: List[str] = []
    raw: Optional[str] = None


class DocumentAIWorkflowTimelineRequest(BaseModel):
    document_id: Optional[int] = None
    sla_days: Optional[int] = None


class DocumentAIWorkflowTimelineResponse(BaseModel):
    estimated_completion: Optional[str] = None
    phase_estimates: List[Dict[str, Any]] = []
    risk_level: Optional[str] = None
    confidence: Optional[float] = None
    notes: List[str] = []
    raw: Optional[str] = None

# Questionnaire Schemas

class QuestionBase(BaseModel):
    question_text: str
    question_type: QuestionType
    is_required: bool = False
    order_index: int
    options: Optional[List[str]] = None
    min_value: Optional[int] = None
    max_value: Optional[int] = None
    placeholder: Optional[str] = None
    help_text: Optional[str] = None
    validation_rules: Optional[Dict[str, Any]] = None
    scoring_weight: Optional[float] = None
    risk_level: Optional[RiskLevel] = None
    matrix_config: Optional[Dict[str, Any]] = None
    conditional_question_id: Optional[int] = None
    conditional_operator: Optional[str] = None
    conditional_value: Optional[str] = None
    show_if_condition_met: bool = True

class QuestionCreate(QuestionBase):
    pass

class QuestionResponse(QuestionBase):
    id: int
    questionnaire_id: int
    created_at: datetime
    ai_metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class QuestionnaireBase(BaseModel):
    title: str
    description: Optional[str] = None
    questionnaire_type: QuestionnaireType = QuestionnaireType.ASSESSMENT
    allow_anonymous: bool = False
    allow_multiple_responses: bool = False
    show_progress: bool = True
    randomize_questions: bool = False
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    access_level: AccessLevel = AccessLevel.INTERNAL
    target_roles: Optional[List[str]] = None
    target_departments: Optional[List[int]] = None
    linked_document_id: Optional[int] = None
    trigger_on_document_access: bool = False

class QuestionnaireCreate(QuestionnaireBase):
    questions: List[QuestionCreate] = []

class QuestionnaireUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[QuestionnaireStatus] = None
    questionnaire_type: Optional[QuestionnaireType] = None
    allow_anonymous: Optional[bool] = None
    allow_multiple_responses: Optional[bool] = None
    show_progress: Optional[bool] = None
    randomize_questions: Optional[bool] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    access_level: Optional[AccessLevel] = None
    target_roles: Optional[List[str]] = None
    target_departments: Optional[List[int]] = None

class QuestionnaireResponse(QuestionnaireBase):
    id: int
    status: QuestionnaireStatus
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    last_ai_run_at: Optional[datetime] = None
    questions: List[QuestionResponse] = []
    
    class Config:
        from_attributes = True

class AnswerCreate(BaseModel):
    question_id: int
    answer_text: Optional[str] = None
    answer_number: Optional[float] = None
    answer_date: Optional[datetime] = None
    answer_boolean: Optional[bool] = None
    selected_options: Optional[List[str]] = None

class AnswerResponse(AnswerCreate):
    id: int
    response_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class QuestionnaireResponseCreate(BaseModel):
    questionnaire_id: int
    answers: List[AnswerCreate]

class QuestionnaireResponseDetail(BaseModel):
    id: int
    questionnaire_id: int
    respondent_id: Optional[int] = None
    session_id: str
    is_complete: bool
    started_at: datetime
    completed_at: Optional[datetime] = None
    time_spent_seconds: Optional[int] = None
    answers: List[AnswerResponse] = []
    
    class Config:
        from_attributes = True

class QuestionnaireStats(BaseModel):
    total_responses: int
    completed_responses: int
    completion_rate: Optional[float] = None
    average_completion_time: Optional[int] = None
    unique_visitors: int
    bounce_rate: Optional[float] = None


# --- AI Assist Schemas ---


class QuestionSuggestionRequest(BaseModel):
    questionnaire_type: QuestionnaireType
    focus_area: Optional[str] = None
    keywords: Optional[List[str]] = None
    existing_questions: Optional[List[str]] = None


class QuestionSuggestion(BaseModel):
    suggestion: str
    rationale: str
    question_type: QuestionType
    answer_guidance: Optional[List[str]] = None


class QuestionSuggestionResponse(BaseModel):
    questionnaire_type: QuestionnaireType
    suggestions: List[QuestionSuggestion]


class QuestionQualityRequest(BaseModel):
    question_text: str
    question_type: QuestionType
    answer_options: Optional[List[str]] = None
    questionnaire_type: Optional[QuestionnaireType] = None


class BiasFlag(BaseModel):
    phrase: str
    reason: str
    suggestion: str


class QuestionQualityResponse(BaseModel):
    clarity_score: int
    complexity_score: int
    bias_flags: List[BiasFlag]
    improvements: List[str]


class QuestionnaireAIAnalysis(BaseModel):
    questionnaire_id: int
    overall_score: int
    strength_summary: List[str]
    risk_summary: List[str]
    recommendations: List[str]


class ResponseInsight(BaseModel):
    label: str
    value: str
    status: Literal["info", "warning", "success", "danger"] = "info"


class ResponseAIInsights(BaseModel):
    questionnaire_id: int
    quality_score: int
    predicted_completion_time: Optional[int] = None
    anomalies: List[str] = Field(default_factory=list)
    follow_up_recommendations: List[str] = Field(default_factory=list)
    highlights: List[ResponseInsight] = Field(default_factory=list)


class AnswerOptionRequest(BaseModel):
    question_text: str
    questionnaire_type: Optional[QuestionnaireType] = None
    desired_count: int = Field(default=4, ge=2, le=8)


class AnswerOptionResponse(BaseModel):
    options: List[str]

# Password Reset and MFA Schemas

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
    
    @field_validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v

class MFASetupRequest(BaseModel):
    password: str

class MFASetupResponse(BaseModel):
    secret: str
    qr_code: str
    backup_codes: List[str]

class MFAVerifyRequest(BaseModel):
    secret: str
    verification_code: str
    backup_codes: List[str]

class MFALoginRequest(BaseModel):
    username: str
    password: str
    mfa_code: str

class MFAStatusResponse(BaseModel):
    enabled: bool
    methods: List[str] = []




# ======== Team Members ========
class FMEATeamMemberCreate(BaseModel):
    user_id: int
    role: Optional[str] = None


class FMEATeamMemberOut(BaseModel):
    id: int
    user_id: int
    role: Optional[str]

    class Config:
        from_attributes = True


# ======== FMEA Core ========
class FMEABase(BaseModel):
    title: str = Field(..., max_length=200)
    fmea_type: FMEAType
    process_or_product_name: str = Field(..., max_length=200)
    description: Optional[str] = None
    departments: Optional[list[str]] = None  # stored as CSV server-side
    team_lead_id: int
    review_date: date
    standard: Optional[str] = Field(default=None, max_length=50)
    scope: str
    assumptions: Optional[str] = None

    # Scales (default 1-10)
    severity_min: conint(ge=1) = 1
    severity_max: conint(ge=1) = 10
    occurrence_min: conint(ge=1) = 1
    occurrence_max: conint(ge=1) = 10
    detection_min: conint(ge=1) = 1
    detection_max: conint(ge=1) = 10


class FMEACreate(FMEABase):
    team_members: list[FMEATeamMemberCreate]


class FMEAUpdate(BaseModel):
    title: Optional[str] = None
    fmea_type: Optional[FMEAType] = None
    process_or_product_name: Optional[str] = None
    description: Optional[str] = None
    departments: Optional[list[str]] = None
    team_lead_id: Optional[int] = None
    review_date: Optional[date] = None
    standard: Optional[str] = None
    scope: Optional[str] = None
    assumptions: Optional[str] = None
    status: Optional[FMEAStatus] = None
    # scale tweaks
    severity_min: Optional[int] = None
    severity_max: Optional[int] = None
    occurrence_min: Optional[int] = None
    occurrence_max: Optional[int] = None
    detection_min: Optional[int] = None
    detection_max: Optional[int] = None


class FMEAOut(FMEABase):
    id: int
    status: FMEAStatus
    highest_rpn: int
    actions_count: int
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    team_members: list[FMEATeamMemberOut]

    class Config:
        from_attributes = True


# ======== FMEA Items (Worksheet Rows) ========
class FMEAItemBase(BaseModel):
    item_function: str = Field(..., max_length=255)
    failure_mode: str = Field(..., max_length=255)
    effects: Optional[str] = None
    severity: conint(ge=1, le=10)
    causes: Optional[str] = None
    occurrence: conint(ge=1, le=10)
    current_controls: Optional[str] = None
    detection: conint(ge=1, le=10)
    recommended_actions: Optional[str] = None
    responsibility_user_id: Optional[int] = None
    target_date: Optional[date] = None
    actions_taken: Optional[str] = None
    status: Optional[Literal["Open", "In Progress", "Completed"]] = "Open"

    # Post-mitigation
    new_severity: Optional[int] = None
    new_occurrence: Optional[int] = None
    new_detection: Optional[int] = None


class FMEAItemCreate(FMEAItemBase):
    pass


class FMEAItemUpdate(BaseModel):
    item_function: Optional[str] = None
    failure_mode: Optional[str] = None
    effects: Optional[str] = None
    severity: Optional[int] = None
    causes: Optional[str] = None
    occurrence: Optional[int] = None
    current_controls: Optional[str] = None
    detection: Optional[int] = None
    recommended_actions: Optional[str] = None
    responsibility_user_id: Optional[int] = None
    target_date: Optional[date] = None
    actions_taken: Optional[str] = None
    status: Optional[Literal["Open", "In Progress", "Completed"]] = None
    new_severity: Optional[int] = None
    new_occurrence: Optional[int] = None
    new_detection: Optional[int] = None


class FMEAItemOut(FMEAItemBase):
    id: int
    rpn: int
    new_rpn: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ======== Actions ========
class FMEAActionBase(BaseModel):
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    owner_user_id: int
    status: ActionStatus = ActionStatus.OPEN
    due_date: Optional[date] = None
    item_id: Optional[int] = None


class FMEAActionCreate(FMEAActionBase):
    pass


class FMEAActionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    owner_user_id: Optional[int] = None
    status: Optional[ActionStatus] = None
    due_date: Optional[date] = None


class FMEAActionOut(FMEAActionBase):
    id: int

    class Config:
        from_attributes = True


# ======== Dashboard / Summaries ========
class FMEADashboardSummary(BaseModel):
    total_fmeas: int
    high_rpn_items: int
    completed_actions: int
    overdue_actions: int



# --- Calendar & Project Timeline Schemas ---

# Mirror the Enum values used in models
class EventType(str, Enum):
    AUDIT = "Audit"
    RISK_ASSESSMENT = "Risk Assessment"
    TRAINING = "Training Session"
    COMPLIANCE_REVIEW = "Compliance Review"
    DOCUMENT_REVIEW = "Document Review"
    INCIDENT_INVESTIGATION = "Incident Investigation"
    MEETING = "Meeting"
    DEADLINE = "Deadline"
    OTHER = "Other"

class Priority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

class EventStatus(str, Enum):
    SCHEDULED = "Scheduled"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"

class AttendeeStatus(str, Enum):
    INVITED = "Invited"
    ACCEPTED = "Accepted"
    DECLINED = "Declined"
    TENTATIVE = "Tentative"

class ReminderMethod(str, Enum):
    EMAIL = "Email"
    SMS = "SMS"
    PUSH = "Push"

class ProjectStatus(str, Enum):
    PLANNING = "Planning"
    ACTIVE = "Active"
    ON_HOLD = "On Hold"
    COMPLETED = "Completed"

class TaskPriority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

# Reminders
class ReminderCreate(BaseModel):
    minutes_before: int = Field(ge=0, le=10080, default=30)  # up to 7 days
    method: ReminderMethod = ReminderMethod.EMAIL
    custom_message: Optional[str] = None

class ReminderOut(ReminderCreate):
    id: int

# Attendees
class AttendeeCreate(BaseModel):
    user_id: Optional[int] = None
    email: Optional[EmailStr] = None
    required: bool = True

class AttendeeOut(BaseModel):
    id: int
    user_id: Optional[int]
    email: Optional[EmailStr]
    required: bool
    status: AttendeeStatus

# Events
class EventBase(BaseModel):
    title: str
    type: EventType
    description: Optional[str] = None
    location: Optional[str] = None
    virtual_meeting_link: Optional[AnyUrl] = None
    department_ids: Optional[List[int]] = None
    equipment: Optional[List[str]] = None
    meeting_room: Optional[str] = None
    catering_required: bool = False
    priority: Priority = Priority.MEDIUM
    status: EventStatus = EventStatus.SCHEDULED
    all_day: bool = False
    tz: str = "UTC"
    start_at: datetime
    end_at: datetime
    rrule: Optional[str] = None
    send_invitations: bool = True

class EventCreate(EventBase):
    attendees: Optional[List[AttendeeCreate]] = None
    # reminders: Optional[List[ReminderCreate]] = None
    reminders: Optional[List[Union[int, ReminderCreate]]] = None

class EventUpdate(BaseModel):
    title: Optional[str]
    type: Optional[EventType]
    description: Optional[str]
    location: Optional[str]
    virtual_meeting_link: Optional[AnyUrl]
    department_ids: Optional[List[int]]
    equipment: Optional[List[str]]
    meeting_room: Optional[str]
    catering_required: Optional[bool]
    priority: Optional[Priority]
    status: Optional[EventStatus]
    all_day: Optional[bool]
    tz: Optional[str]
    start_at: Optional[datetime]
    end_at: Optional[datetime]
    rrule: Optional[str]
    send_invitations: Optional[bool]

    # full replace for attendees/reminders when provided
    attendees: Optional[List[AttendeeCreate]] = None
    # reminders: Optional[List[ReminderCreate]] = None
    reminders: Optional[List[Union[int, ReminderCreate]]] = None

class EventOut(EventBase):
    id: int
    title: str
    start: datetime
    end: datetime
    all_day: bool
    organizer_id: int
    status: str
    location: Optional[str] = None
    description: Optional[str] = None
    attendees: List[AttendeeOut] = []
    reminders: List[ReminderOut] = []
    created_at: datetime
    updated_at: datetime
    cancelled_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Dashboard stats (simple)
class CalendarStats(BaseModel):
    total: int
    upcoming: int
    in_progress: int
    completed: int
    overdue: int
    by_type: dict
    by_priority: dict

# --- Projects / Tasks ---
class TaskDependencyIn(BaseModel):
    predecessor_id: int

class TaskBase(BaseModel):
    name: str
    description: Optional[str] = None
    assigned_to_id: Optional[int] = None
    start_date: datetime
    end_date: datetime
    duration_hours: Optional[float] = None
    progress: float = 0.0
    priority: TaskPriority = TaskPriority.MEDIUM

class TaskCreate(TaskBase):
    dependencies: Optional[List[TaskDependencyIn]] = None

class TaskUpdate(BaseModel):
    name: Optional[str]
    description: Optional[str]
    assigned_to_id: Optional[int]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    duration_hours: Optional[float]
    progress: Optional[float]
    priority: Optional[TaskPriority]

class TaskOut(TaskBase):
    id: int
    project_id: int

    class Config:
        from_attributes = True

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    manager_id: int
    status: ProjectStatus = ProjectStatus.PLANNING
    start_date: datetime
    end_date: datetime

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str]
    description: Optional[str]
    manager_id: Optional[int]
    status: Optional[ProjectStatus]
    start_date: Optional[datetime]
    end_date: Optional[datetime]

class ProjectOut(ProjectBase):
    id: int
    overall_progress: float
    # tasks: List[TaskOut] = []  # optional if you want embedded
    class Config:
        from_attributes = True
