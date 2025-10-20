from __future__ import annotations
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Enum, Float, Index, Date, JSON, Table
from sqlalchemy.orm import relationship, declarative_base
from database import Base
from datetime import datetime
import enum
from typing import Optional
from enum import Enum as PyEnum

# Base = declarative_base()

# try:
#     from models import Base  # type: ignore
# except Exception:
#     from database import Base  # type: ignore


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    MANAGER = "manager"
    AUDITOR = "auditor"
    EMPLOYEE = "employee"
    VIEWER = "viewer"

# Enhanced permission levels as requested
class PermissionLevel(str, enum.Enum):
    VIEW_ONLY = "view_only"
    LINK_ACCESS = "link_access" 
    EDIT_ACCESS = "edit_access"
    ADMIN_ACCESS = "admin_access"
    SUPER_ADMIN = "super_admin"

class AccessLevel(str, enum.Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"

# Organizational Hierarchy Models

class Group(Base):
    __tablename__ = "groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    code = Column(String(20), nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    companies = relationship("Company", back_populates="group")
    created_by = relationship("User", back_populates="created_groups")

class Company(Base):
    __tablename__ = "companies"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    legal_name = Column(String(200), nullable=True)
    code = Column(String(20), nullable=False)
    registration_number = Column(String(50), nullable=True)
    tax_id = Column(String(50), nullable=True)
    
    # Parent relationship
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    
    # Company details
    address = Column(Text, nullable=True)
    website = Column(String(200), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    industry = Column(String(100), nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    group = relationship("Group", back_populates="companies")
    countries = relationship("Country", back_populates="company")
    created_by = relationship("User", back_populates="created_companies")

class Country(Base):
    __tablename__ = "countries"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(3), nullable=False)  # ISO country code
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    
    # Country details
    timezone = Column(String(50), default="UTC")
    currency = Column(String(3), nullable=True)  # ISO currency code
    language = Column(String(10), default="en", nullable=False)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships  
    company = relationship("Company", back_populates="countries")
    sites = relationship("Site", back_populates="country")
    created_by = relationship("User", back_populates="created_countries")

class Site(Base):
    __tablename__ = "sites"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(20), nullable=False)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=False)
    
    # Site details
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state_province = Column(String(100), nullable=True) 
    postal_code = Column(String(20), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    
    # Site type and capacity
    site_type = Column(String(50), nullable=True)  # office, warehouse, factory, etc.
    capacity = Column(Integer, nullable=True)  # max employees/users
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    country = relationship("Country", back_populates="sites")
    departments = relationship("Department", back_populates="site")
    created_by = relationship("User", back_populates="created_sites")

class Department(Base):
    __tablename__ = "departments"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(20), nullable=False)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False)
    parent_department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    
    # Department details
    description = Column(Text, nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    budget = Column(Float, nullable=True)
    cost_center = Column(String(50), nullable=True)
    
    # Confidentiality settings for sensitive departments
    is_confidential = Column(Boolean, default=False)
    access_level = Column(Enum(AccessLevel), default=AccessLevel.INTERNAL)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    site = relationship("Site", back_populates="departments")
    parent_department = relationship("Department", remote_side=[id])
    child_departments = relationship("Department", remote_side=[parent_department_id], overlaps="parent_department")
    manager = relationship("User", foreign_keys=[manager_id], back_populates="managed_departments")
    users = relationship("User", foreign_keys="User.department_id", back_populates="user_department")
    created_by = relationship("User", foreign_keys=[created_by_id], back_populates="created_departments")

# Device and MFA Models

class UserDevice(Base):
    __tablename__ = "user_devices"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    device_name = Column(String(200), nullable=False)
    device_type = Column(String(50), nullable=False)  # mobile, desktop, tablet
    device_id = Column(String(255), nullable=False, unique=True)  # unique device fingerprint
    device_os = Column(String(100), nullable=True)
    browser = Column(String(100), nullable=True)
    
    # Device verification
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String(255), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    
    # Device status
    is_trusted = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="devices")

class MFAMethod(Base):
    __tablename__ = "mfa_methods"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    method_type = Column(String(20), nullable=False)  # sms, email, totp, backup_codes
    is_primary = Column(Boolean, default=False)
    is_enabled = Column(Boolean, default=True)
    
    # Method-specific data (encrypted)
    secret_key = Column(String(255), nullable=True)  # For TOTP
    phone_number = Column(String(20), nullable=True)  # For SMS
    email_address = Column(String(255), nullable=True)  # For Email
    backup_codes = Column(Text, nullable=True)  # JSON array of backup codes
    
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="mfa_methods")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.EMPLOYEE, nullable=False)
    permission_level = Column(Enum(PermissionLevel), default=PermissionLevel.VIEW_ONLY, nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    
    # Organizational hierarchy relationships
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    reporting_manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Profile information
    phone = Column(String(20), nullable=True)
    position = Column(String(100), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    # Professional Information (from wizard)
    employee_id = Column(String(50), nullable=True)
    
    # Compliance Role & Permissions (from wizard)
    areas_of_responsibility = Column(Text, nullable=True)  # JSON array as text
    
    # Security and MFA
    mfa_enabled = Column(Boolean, default=False)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    
    # Additional Settings (from wizard)
    timezone = Column(String(50), default="America/New_York")
    notifications_email = Column(Boolean, default=True)
    notifications_sms = Column(Boolean, default=False)
    
    # Relationships
    user_department = relationship("Department", foreign_keys=[department_id], back_populates="users")
    reporting_manager = relationship("User", remote_side=[id])
    direct_reports = relationship("User", remote_side=[reporting_manager_id], overlaps="reporting_manager")
    devices = relationship("UserDevice", back_populates="user")
    mfa_methods = relationship("MFAMethod", back_populates="user")
    
    # Organization creation relationships
    created_groups = relationship("Group", back_populates="created_by")
    created_companies = relationship("Company", back_populates="created_by")
    created_countries = relationship("Country", back_populates="created_by")
    created_sites = relationship("Site", back_populates="created_by")
    created_departments = relationship("Department", foreign_keys="Department.created_by_id", back_populates="created_by")
    managed_departments = relationship("Department", foreign_keys="Department.manager_id", back_populates="manager")

class Permission(Base):
    __tablename__ = "permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    module = Column(String(50), nullable=False)  # document, audit, incident, etc.
    action = Column(String(50), nullable=False)  # create, read, update, delete

class RolePermission(Base):
    __tablename__ = "role_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    role = Column(Enum(UserRole), nullable=False)
    permission_level = Column(Enum(PermissionLevel), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.id"), nullable=False)
    
    permission = relationship("Permission")

class PermissionLevelAccess(Base):
    __tablename__ = "permission_level_access"
    
    id = Column(Integer, primary_key=True, index=True)
    permission_level = Column(Enum(PermissionLevel), nullable=False, index=True)
    module = Column(String(50), nullable=False)
    action = Column(String(50), nullable=False)
    allowed = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)


# Document Management Models

class DocumentStatus(str, enum.Enum):
    DRAFT = "draft"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    EXPIRED = "expired"


class DocumentType(str, enum.Enum):
    POLICY = "policy"
    PROCEDURE = "procedure"
    FORM = "form"
    TEMPLATE = "template"
    REPORT = "report"
    MANUAL = "manual"
    CERTIFICATE = "certificate"
    REGULATION = "regulation"
    AUDIT_REPORT = "audit_report"
    RISK_ASSESSMENT = "risk_assessment"
    INCIDENT_REPORT = "incident_report"
    TRAINING_MATERIAL = "training_material"
    OTHER = "other"


class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False, index=True)
    description = Column(Text, nullable=True)
    document_type = Column(Enum(DocumentType), nullable=False, index=True)
    status = Column(Enum(DocumentStatus), default=DocumentStatus.DRAFT, index=True)
    access_level = Column(Enum(AccessLevel), default=AccessLevel.INTERNAL, index=True)
    
    # File information
    filename = Column(String(255), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Integer, nullable=False)  # Size in bytes
    mime_type = Column(String(100), nullable=False)
    file_hash = Column(String(64), nullable=False)  # SHA-256 hash for integrity
    
    # Metadata
    keywords = Column(Text, nullable=True)  # JSON array of keywords
    category = Column(String(100), nullable=True, index=True)
    subcategory = Column(String(100), nullable=True)
    tags = Column(Text, nullable=True)  # JSON array of tags
    
    # Relationships
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    modified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    
    # Version control
    version = Column(String(20), default="1.0", nullable=False)
    is_current_version = Column(Boolean, default=True, index=True)
    parent_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    
    # Compliance specific
    compliance_framework = Column(String(100), nullable=True)  # ISO, SOX, GDPR, etc.
    retention_period_months = Column(Integer, nullable=True)
    review_frequency_months = Column(Integer, nullable=True)
    next_review_date = Column(DateTime, nullable=True, index=True)
    
    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id])
    modified_by = relationship("User", foreign_keys=[modified_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    parent_document = relationship("Document", remote_side=[id])
    child_documents = relationship("Document", remote_side=[parent_document_id], overlaps="parent_document")
    
    # Search optimization
    __table_args__ = (
        Index('idx_document_search', 'title', 'category', 'document_type'),
        Index('idx_document_dates', 'created_at', 'expires_at', 'next_review_date'),
    )


class DocumentVersion(Base):
    __tablename__ = "document_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    version = Column(String(20), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_hash = Column(String(64), nullable=False)
    
    # Change tracking
    change_summary = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    document = relationship("Document", back_populates="versions")
    created_by = relationship("User")


# Add back_populates to Document model
Document.versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")


class DocumentAccess(Base):
    __tablename__ = "document_access"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    role = Column(Enum(UserRole), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    permission_level = Column(Enum(PermissionLevel), nullable=True)
    
    # Permissions
    can_read = Column(Boolean, default=True)
    can_download = Column(Boolean, default=False)
    can_edit = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)
    can_approve = Column(Boolean, default=False)
    
    granted_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    granted_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    
    # Relationships
    document = relationship("Document")
    user = relationship("User", foreign_keys=[user_id])
    department = relationship("Department")
    granted_by = relationship("User", foreign_keys=[granted_by_id])


class DocumentAuditLog(Base):
    __tablename__ = "document_audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    action = Column(String(50), nullable=False, index=True)  # CREATE, READ, UPDATE, DELETE, DOWNLOAD, APPROVE
    details = Column(Text, nullable=True)  # JSON with additional details
    ip_address = Column(String(45), nullable=True)  # Support IPv6
    user_agent = Column(String(500), nullable=True)
    
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    document = relationship("Document")
    user = relationship("User")


class DocumentCategory(Base):
    __tablename__ = "document_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    parent_id = Column(Integer, ForeignKey("document_categories.id"), nullable=True)
    color = Column(String(7), nullable=True)  # Hex color code
    icon = Column(String(50), nullable=True)  # Icon name/class
    
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    parent = relationship("DocumentCategory", remote_side=[id])
    children = relationship("DocumentCategory", remote_side=[parent_id], overlaps="parent")
    created_by = relationship("User")


class DocumentReview(Base):
    __tablename__ = "document_reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    status = Column(String(20), nullable=False)  # PENDING, APPROVED, REJECTED, CHANGES_REQUESTED
    comments = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    # Review assignment
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=True)
    
    # Relationships
    document = relationship("Document")
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])

# Document Assignment Models

class DocumentAssignment(Base):
    __tablename__ = "document_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_to_department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    assigned_to_role = Column(Enum(UserRole), nullable=True)
    
    assignment_type = Column(String(20), nullable=False)  # REVIEW, APPROVE, UPDATE, READ
    priority = Column(String(10), default="MEDIUM")  # HIGH, MEDIUM, LOW
    status = Column(String(20), default="PENDING")  # PENDING, IN_PROGRESS, COMPLETED, OVERDUE
    
    # Assignment details
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    
    # Scheduling
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    document = relationship("Document")
    assigned_to_user = relationship("User", foreign_keys=[assigned_to_user_id])
    assigned_to_department = relationship("Department")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])

class DocumentSchedule(Base):
    __tablename__ = "document_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    
    # Scheduling information
    release_date = Column(DateTime, nullable=True)
    effective_date = Column(DateTime, nullable=True)
    retirement_date = Column(DateTime, nullable=True)
    
    # Status tracking
    readiness_status = Column(String(20), default="DRAFT")  # DRAFT, READY, SCHEDULED, PUBLISHED, RETIRED
    readiness_notes = Column(Text, nullable=True)
    
    # Responsible parties
    responsible_department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    responsible_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    document = relationship("Document")
    responsible_department = relationship("Department")
    responsible_user = relationship("User", foreign_keys=[responsible_user_id])
    created_by = relationship("User", foreign_keys=[created_by_id])

# Cross-Department Document Tagging

class CrossDepartmentTag(Base):
    __tablename__ = "cross_department_tags"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    
    tag_type = Column(String(50), nullable=False)  # SHARED, REFERENCE, COLLABORATIVE, etc.
    access_level = Column(Enum(PermissionLevel), default=PermissionLevel.VIEW_ONLY)
    
    tagged_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tagged_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)
    
    # Relationships
    document = relationship("Document")
    department = relationship("Department")
    tagged_by = relationship("User")

# Questionnaire Builder Models

class QuestionType(str, enum.Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    SINGLE_CHOICE = "single_choice"
    TEXT = "text"
    TEXTAREA = "textarea"
    RATING = "rating"
    YES_NO = "yes_no"
    DATE = "date"
    DATETIME = "datetime"
    NUMBER = "number"
    EMAIL = "email"
    FILE_UPLOAD = "file_upload"
    SIGNATURE = "signature"
    MATRIX = "matrix"


class QuestionnaireType(str, enum.Enum):
    ASSESSMENT = "assessment"
    SURVEY = "survey"
    CHECKLIST = "checklist"
    EVALUATION = "evaluation"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class QuestionnaireStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"
    ARCHIVED = "archived"

class Questionnaire(Base):
    __tablename__ = "questionnaires"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    questionnaire_type = Column(Enum(QuestionnaireType), default=QuestionnaireType.ASSESSMENT)
    status = Column(Enum(QuestionnaireStatus), default=QuestionnaireStatus.DRAFT)
    
    # Configuration
    allow_anonymous = Column(Boolean, default=False)
    allow_multiple_responses = Column(Boolean, default=False)
    show_progress = Column(Boolean, default=True)
    randomize_questions = Column(Boolean, default=False)
    
    # Scheduling
    starts_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)
    
    # Access control
    access_level = Column(Enum(AccessLevel), default=AccessLevel.INTERNAL)
    target_roles = Column(Text, nullable=True)  # JSON array of roles
    target_departments = Column(Text, nullable=True)  # JSON array of department IDs
    
    # Integration
    linked_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    trigger_on_document_access = Column(Boolean, default=False)
    
    # Metadata
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    created_by = relationship("User")
    linked_document = relationship("Document")
    questions = relationship("Question", back_populates="questionnaire", cascade="all, delete-orphan")
    responses = relationship("QuestionnaireResponse", back_populates="questionnaire")

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    questionnaire_id = Column(Integer, ForeignKey("questionnaires.id"), nullable=False)
    
    question_text = Column(Text, nullable=False)
    question_type = Column(Enum(QuestionType), nullable=False)
    is_required = Column(Boolean, default=False)
    order_index = Column(Integer, nullable=False)
    
    # Question configuration
    options = Column(Text, nullable=True)  # JSON array for multiple choice
    min_value = Column(Integer, nullable=True)  # For rating/number questions
    max_value = Column(Integer, nullable=True)  # For rating/number questions
    placeholder = Column(String(255), nullable=True)
    help_text = Column(Text, nullable=True)
    validation_rules = Column(Text, nullable=True)  # JSON definition of validation / logic
    scoring_weight = Column(Float, nullable=True)
    risk_level = Column(Enum(RiskLevel), nullable=True)
    ai_metadata = Column(Text, nullable=True)  # Cache for AI insights like suggestions/quality
    matrix_config = Column(Text, nullable=True)
    
    # Conditional logic
    conditional_question_id = Column(Integer, ForeignKey("questions.id"), nullable=True)
    conditional_operator = Column(String(20), nullable=True)  # equals, not_equals, contains, etc.
    conditional_value = Column(String(500), nullable=True)
    show_if_condition_met = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    questionnaire = relationship("Questionnaire", back_populates="questions")
    conditional_question = relationship("Question", remote_side=[id])
    answers = relationship("Answer", back_populates="question")

class QuestionnaireResponse(Base):
    __tablename__ = "questionnaire_responses"
    
    id = Column(Integer, primary_key=True, index=True)
    questionnaire_id = Column(Integer, ForeignKey("questionnaires.id"), nullable=False)
    respondent_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for anonymous
    
    # Response metadata
    session_id = Column(String(255), nullable=False, unique=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    
    # Completion tracking
    is_complete = Column(Boolean, default=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    time_spent_seconds = Column(Integer, nullable=True)
    
    # Relationships
    questionnaire = relationship("Questionnaire", back_populates="responses")
    respondent = relationship("User")
    answers = relationship("Answer", back_populates="response", cascade="all, delete-orphan")

class Answer(Base):
    __tablename__ = "answers"
    
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    response_id = Column(Integer, ForeignKey("questionnaire_responses.id"), nullable=False)
    
    # Answer data
    answer_text = Column(Text, nullable=True)
    answer_number = Column(Float, nullable=True)
    answer_date = Column(DateTime, nullable=True)
    answer_boolean = Column(Boolean, nullable=True)
    selected_options = Column(Text, nullable=True)  # JSON array for multiple choice
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    question = relationship("Question", back_populates="answers")
    response = relationship("QuestionnaireResponse", back_populates="answers")

class QuestionnaireAnalytics(Base):
    __tablename__ = "questionnaire_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    questionnaire_id = Column(Integer, ForeignKey("questionnaires.id"), nullable=False)
    
    # Response metrics
    total_responses = Column(Integer, default=0)
    completed_responses = Column(Integer, default=0)
    average_completion_time = Column(Integer, nullable=True)  # seconds
    completion_rate = Column(Float, nullable=True)  # percentage
    
    # Engagement metrics
    unique_visitors = Column(Integer, default=0)
    bounce_rate = Column(Float, nullable=True)  # percentage
    
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    questionnaire = relationship("Questionnaire")

# Password Reset Models

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    used_at = Column(DateTime, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # Relationships
    user = relationship("User")



# FMEA Models
class FMEAType(str, enum.Enum):
    PROCESS = "Process FMEA (PFMEA)"
    DESIGN = "Design FMEA (DFMEA)"
    SYSTEM = "System FMEA (SFMEA)"
    SERVICE = "Service FMEA"
    SOFTWARE = "Software FMEA"


class FMEAStatus(str, enum.Enum):
    ACTIVE = "Active"
    COMPLETED = "Completed"
    ON_HOLD = "On Hold"


class ActionStatus(str, enum.Enum):
    OPEN = "Open"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    OVERDUE = "Overdue"
    CANCELLED = "Cancelled"


class FMEA(Base):
    __tablename__ = "fmeas"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    fmea_type = Column(Enum(FMEAType), nullable=False)
    process_or_product_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    departments_csv = Column(Text, nullable=True)  # store names/ids as CSV; adapt to your Department model later
    team_lead_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    review_date = Column(Date, nullable=False)
    standard = Column(String(50), nullable=True)  # e.g. "AIAG-VDA", "IEC 60812", "Custom"
    scope = Column(Text, nullable=False)
    assumptions = Column(Text, nullable=True)

    # Rating scale configuration (configurable 1-10 scale; you can extend with label tables if needed)
    severity_min = Column(Integer, default=1)
    severity_max = Column(Integer, default=10)
    occurrence_min = Column(Integer, default=1)
    occurrence_max = Column(Integer, default=10)
    detection_min = Column(Integer, default=1)
    detection_max = Column(Integer, default=10)

    status = Column(Enum(FMEAStatus), default=FMEAStatus.ACTIVE, nullable=False)

    highest_rpn = Column(Integer, default=0)
    actions_count = Column(Integer, default=0)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    items = relationship("FMEAItem", back_populates="fmea", cascade="all, delete-orphan")
    actions = relationship("FMEAAction", back_populates="fmea", cascade="all, delete-orphan")
    team_members = relationship("FMEATeamMember", back_populates="fmea", cascade="all, delete-orphan")


class FMEATeamMember(Base):
    __tablename__ = "fmea_team_members"

    id = Column(Integer, primary_key=True)
    fmea_id = Column(Integer, ForeignKey("fmeas.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(100), nullable=True)  # optional: "Engineer", "QA", etc.

    fmea = relationship("FMEA", back_populates="team_members")


class FMEAItem(Base):
    __tablename__ = "fmea_items"

    id = Column(Integer, primary_key=True, index=True)
    fmea_id = Column(Integer, ForeignKey("fmeas.id", ondelete="CASCADE"), nullable=False)

    item_function = Column(String(255), nullable=False)
    failure_mode = Column(String(255), nullable=False)
    effects = Column(Text, nullable=True)
    severity = Column(Integer, nullable=False)
    causes = Column(Text, nullable=True)
    occurrence = Column(Integer, nullable=False)
    current_controls = Column(Text, nullable=True)
    detection = Column(Integer, nullable=False)

    rpn = Column(Integer, nullable=False)  # S * O * D

    recommended_actions = Column(Text, nullable=True)
    responsibility_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    target_date = Column(Date, nullable=True)
    actions_taken = Column(Text, nullable=True)

    # Post-mitigation values
    new_severity = Column(Integer, nullable=True)
    new_occurrence = Column(Integer, nullable=True)
    new_detection = Column(Integer, nullable=True)
    new_rpn = Column(Integer, nullable=True)

    status = Column(String(30), default="Open", nullable=False)  # Open, In Progress, Completed

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    fmea = relationship("FMEA", back_populates="items")


class FMEAAction(Base):
    __tablename__ = "fmea_actions"

    id = Column(Integer, primary_key=True)
    fmea_id = Column(Integer, ForeignKey("fmeas.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(Integer, ForeignKey("fmea_items.id", ondelete="SET NULL"), nullable=True)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(ActionStatus), default=ActionStatus.OPEN, nullable=False)
    due_date = Column(Date, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    fmea = relationship("FMEA", back_populates="actions")



# --- Calendar & Project Timeline Models ---

# If Base/User already exist in your models.py, import/reuse them:
# from .models import User  # ensure not circular; adapt import as needed

class EventTypeEnum(PyEnum):
    AUDIT = "Audit"
    RISK_ASSESSMENT = "Risk Assessment"
    TRAINING = "Training Session"
    COMPLIANCE_REVIEW = "Compliance Review"
    DOCUMENT_REVIEW = "Document Review"
    INCIDENT_INVESTIGATION = "Incident Investigation"
    MEETING = "Meeting"
    DEADLINE = "Deadline"
    OTHER = "Other"

class PriorityEnum(PyEnum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

class EventStatusEnum(PyEnum):
    SCHEDULED = "Scheduled"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"

class AttendeeStatusEnum(PyEnum):
    INVITED = "Invited"
    ACCEPTED = "Accepted"
    DECLINED = "Declined"
    TENTATIVE = "Tentative"

class ReminderMethodEnum(PyEnum):
    EMAIL = "Email"
    SMS = "SMS"
    PUSH = "Push"

class ProjectStatusEnum(PyEnum):
    PLANNING = "Planning"
    ACTIVE = "Active"
    ON_HOLD = "On Hold"
    COMPLETED = "Completed"

class TaskPriorityEnum(PyEnum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    start = Column(DateTime, nullable=False, index=True)
    end = Column(DateTime, nullable=False, index=True)
    type = Column(Enum(EventTypeEnum), nullable=False)
    description = Column(Text, nullable=True)

    location = Column(String(255), nullable=True)
    virtual_meeting_link = Column(String(512), nullable=True)

    priority = Column(Enum(PriorityEnum), nullable=False, default=PriorityEnum.MEDIUM)
    status = Column(Enum(EventStatusEnum), nullable=False, default=EventStatusEnum.SCHEDULED)

    organizer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    organizer = relationship("User", backref="organized_events")

    department_ids = Column(JSON, nullable=True)  # list[int] if you have Department model; keep simple & portable
    equipment = Column(JSON, nullable=True)       # list[str]
    meeting_room = Column(String(128), nullable=True)
    catering_required = Column(Boolean, default=False)

    all_day = Column(Boolean, default=False)
    tz = Column(String(64), nullable=False, default="UTC")
    start_at = Column(DateTime(timezone=True), nullable=False)
    end_at = Column(DateTime(timezone=True), nullable=False)

    # Recurrence: store RFC5545 RRULE (e.g. "FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20251231T235959Z")
    rrule = Column(String(512), nullable=True)

    # Reminder & invitation preferences
    send_invitations = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)

    attendees = relationship("EventAttendee", cascade="all, delete-orphan", back_populates="event")
    reminders = relationship("EventReminder", cascade="all, delete-orphan", back_populates="event")

class EventAttendee(Base):
    __tablename__ = "calendar_event_attendees"
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("calendar_events.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # internal users optional
    email = Column(String(255), nullable=True)  # for external attendees
    required = Column(Boolean, default=True)
    status = Column(Enum(AttendeeStatusEnum), default=AttendeeStatusEnum.INVITED, nullable=False)

    event = relationship("CalendarEvent", back_populates="attendees")
    user = relationship("User", backref="calendar_attendances")

class EventReminder(Base):
    __tablename__ = "calendar_event_reminders"
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("calendar_events.id", ondelete="CASCADE"), index=True)
    minutes_before = Column(Integer, nullable=False, default=30)
    method = Column(Enum(ReminderMethodEnum), nullable=False, default=ReminderMethodEnum.EMAIL)
    custom_message = Column(Text, nullable=True)

    event = relationship("CalendarEvent", back_populates="reminders")

# --- Project Timeline / Gantt ---

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(ProjectStatusEnum), default=ProjectStatusEnum.PLANNING, nullable=False)
    start_date = Column(DateTime(timezone=False), nullable=False)
    end_date = Column(DateTime(timezone=False), nullable=False)
    overall_progress = Column(Float, default=0.0)

    manager = relationship("User", backref="managed_projects")
    tasks = relationship("ProjectTask", cascade="all, delete-orphan", back_populates="project")

class ProjectTask(Base):
    __tablename__ = "project_tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    start_date = Column(DateTime(timezone=False), nullable=False)
    end_date = Column(DateTime(timezone=False), nullable=False)
    duration_hours = Column(Float, nullable=True)
    progress = Column(Float, default=0.0)
    priority = Column(Enum(TaskPriorityEnum), default=TaskPriorityEnum.MEDIUM, nullable=False)

    project = relationship("Project", back_populates="tasks")
    assigned_to = relationship("User", backref="assigned_tasks")

class TaskDependency(Base):
    __tablename__ = "task_dependencies"

    id = Column(Integer, primary_key=True)
    predecessor_id = Column(Integer, ForeignKey("project_tasks.id", ondelete="CASCADE"), index=True)
    successor_id = Column(Integer, ForeignKey("project_tasks.id", ondelete="CASCADE"), index=True)
