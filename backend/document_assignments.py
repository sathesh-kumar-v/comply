from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from database import get_db
from auth import get_current_user
from models import (
    User, UserRole, PermissionLevel, Document, DocumentAssignment, DocumentSchedule,
    CrossDepartmentTag, Department, DocumentAccess, DocumentAuditLog
)
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import json

router = APIRouter()

# Pydantic models for document assignments

class DocumentAssignmentCreate(BaseModel):
    document_id: int
    assigned_to_user_id: Optional[int] = None
    assigned_to_department_id: Optional[int] = None
    assigned_to_role: Optional[UserRole] = None
    assignment_type: str = Field(..., pattern="^(REVIEW|APPROVE|UPDATE|READ)$")
    priority: str = Field(default="MEDIUM", pattern="^(HIGH|MEDIUM|LOW)$")
    title: str = Field(..., max_length=500)
    description: Optional[str] = None
    instructions: Optional[str] = None
    due_date: Optional[datetime] = None

class DocumentAssignmentResponse(BaseModel):
    id: int
    document_id: int
    assigned_to_user_id: Optional[int]
    assigned_to_department_id: Optional[int]
    assigned_to_role: Optional[UserRole]
    assignment_type: str
    priority: str
    status: str
    title: str
    description: Optional[str]
    instructions: Optional[str]
    assigned_at: datetime
    due_date: Optional[datetime]
    completed_at: Optional[datetime]
    
    # Related data
    document_title: Optional[str] = None
    assigned_by_name: Optional[str] = None
    assigned_to_user_name: Optional[str] = None
    assigned_to_department_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class DocumentScheduleCreate(BaseModel):
    document_id: int
    release_date: Optional[datetime] = None
    effective_date: Optional[datetime] = None
    retirement_date: Optional[datetime] = None
    readiness_status: str = Field(default="DRAFT", pattern="^(DRAFT|READY|SCHEDULED|PUBLISHED|RETIRED)$")
    readiness_notes: Optional[str] = None
    responsible_department_id: Optional[int] = None
    responsible_user_id: Optional[int] = None

class DocumentScheduleResponse(BaseModel):
    id: int
    document_id: int
    release_date: Optional[datetime]
    effective_date: Optional[datetime]
    retirement_date: Optional[datetime]
    readiness_status: str
    readiness_notes: Optional[str]
    responsible_department_id: Optional[int]
    responsible_user_id: Optional[int]
    created_at: datetime
    
    # Related data
    document_title: Optional[str] = None
    responsible_department_name: Optional[str] = None
    responsible_user_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class CrossDepartmentTagCreate(BaseModel):
    document_id: int
    department_id: int
    tag_type: str = Field(..., max_length=50)
    access_level: PermissionLevel = PermissionLevel.VIEW_ONLY
    notes: Optional[str] = None

class CrossDepartmentTagResponse(BaseModel):
    id: int
    document_id: int
    department_id: int
    tag_type: str
    access_level: PermissionLevel
    notes: Optional[str]
    tagged_at: datetime
    
    # Related data
    document_title: Optional[str] = None
    department_name: Optional[str] = None
    tagged_by_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class AssignmentUpdateRequest(BaseModel):
    status: Optional[str] = Field(None, pattern="^(PENDING|IN_PROGRESS|COMPLETED|OVERDUE)$")
    priority: Optional[str] = Field(None, pattern="^(HIGH|MEDIUM|LOW)$")
    due_date: Optional[datetime] = None
    notes: Optional[str] = None

# Utility functions
def check_document_access(db: Session, current_user: User, document_id: int, required_permission: str = "read"):
    """Check if user has access to document with required permission"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if user is the creator or has explicit access
    if document.created_by_id == current_user.id:
        return document
    
    # TODO: Check explicit access permissions when DocumentAccess table is fixed
    # For now, skip access check
    
    # Check role-based permissions
    if current_user.permission_level in [PermissionLevel.ADMIN_ACCESS, PermissionLevel.SUPER_ADMIN]:
        return document
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Insufficient permissions to {required_permission} this document"
    )

def log_document_action(db: Session, document_id: int, user_id: int, action: str, details: Dict = None):
    """Log document actions for audit trail"""
    audit_log = DocumentAuditLog(
        document_id=document_id,
        user_id=user_id,
        action=action,
        details=json.dumps(details) if details else None
    )
    db.add(audit_log)

# Document Assignment endpoints

@router.post("/assignments", response_model=DocumentAssignmentResponse, summary="Create Document Assignment")
async def create_document_assignment(
    assignment: DocumentAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new document assignment"""
    
    # Check document access
    document = check_document_access(db, current_user, assignment.document_id, "edit")
    
    # Validate assignment target
    if not any([assignment.assigned_to_user_id, assignment.assigned_to_department_id, assignment.assigned_to_role]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must specify at least one assignment target (user, department, or role)"
        )
    
    # Validate assigned user if specified
    if assignment.assigned_to_user_id:
        assigned_user = db.query(User).filter(
            User.id == assignment.assigned_to_user_id,
            User.is_active == True
        ).first()
        if not assigned_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assigned user not found"
            )
    
    # Validate assigned department if specified
    if assignment.assigned_to_department_id:
        assigned_dept = db.query(Department).filter(
            Department.id == assignment.assigned_to_department_id,
            Department.is_active == True
        ).first()
        if not assigned_dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assigned department not found"
            )
        
        # Check access to confidential departments
        if assigned_dept.is_confidential and current_user.permission_level not in [PermissionLevel.SUPER_ADMIN, PermissionLevel.ADMIN_ACCESS]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot assign to confidential department"
            )
    
    # Create assignment
    db_assignment = DocumentAssignment(
        document_id=assignment.document_id,
        assigned_to_user_id=assignment.assigned_to_user_id,
        assigned_to_department_id=assignment.assigned_to_department_id,
        assigned_to_role=assignment.assigned_to_role,
        assignment_type=assignment.assignment_type,
        priority=assignment.priority,
        title=assignment.title,
        description=assignment.description,
        instructions=assignment.instructions,
        due_date=assignment.due_date,
        assigned_by_id=current_user.id
    )
    
    db.add(db_assignment)
    db.commit()
    db.refresh(db_assignment)
    
    # Log the assignment
    log_document_action(
        db, assignment.document_id, current_user.id, "ASSIGN",
        {"assignment_id": db_assignment.id, "assignment_type": assignment.assignment_type}
    )
    
    # Add related data for response
    db_assignment.document_title = document.title
    db_assignment.assigned_by_name = f"{current_user.first_name} {current_user.last_name}"
    
    if assignment.assigned_to_user_id:
        assigned_user = db.query(User).filter(User.id == assignment.assigned_to_user_id).first()
        if assigned_user:
            db_assignment.assigned_to_user_name = f"{assigned_user.first_name} {assigned_user.last_name}"
    
    if assignment.assigned_to_department_id:
        assigned_dept = db.query(Department).filter(Department.id == assignment.assigned_to_department_id).first()
        if assigned_dept:
            db_assignment.assigned_to_department_name = assigned_dept.name
    
    return db_assignment

@router.get("/assignments", response_model=List[DocumentAssignmentResponse], summary="List Document Assignments")
async def list_document_assignments(
    document_id: Optional[int] = None,
    assigned_to_user_id: Optional[int] = None,
    assigned_to_department_id: Optional[int] = None,
    assignment_type: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List document assignments with filtering options"""
    
    query = db.query(DocumentAssignment)
    
    # Apply filters
    if document_id:
        query = query.filter(DocumentAssignment.document_id == document_id)
    
    if assigned_to_user_id:
        query = query.filter(DocumentAssignment.assigned_to_user_id == assigned_to_user_id)
    
    if assigned_to_department_id:
        query = query.filter(DocumentAssignment.assigned_to_department_id == assigned_to_department_id)
    
    if assignment_type:
        query = query.filter(DocumentAssignment.assignment_type == assignment_type)
    
    if status:
        query = query.filter(DocumentAssignment.status == status)
    
    if priority:
        query = query.filter(DocumentAssignment.priority == priority)
    
    # Filter by user's access (users can see their own assignments, admins can see all)
    if current_user.permission_level not in [PermissionLevel.SUPER_ADMIN, PermissionLevel.ADMIN_ACCESS]:
        query = query.filter(
            or_(
                DocumentAssignment.assigned_to_user_id == current_user.id,
                DocumentAssignment.assigned_to_department_id == current_user.department_id,
                DocumentAssignment.assigned_to_role == current_user.role,
                DocumentAssignment.assigned_by_id == current_user.id
            )
        )
    
    assignments = query.offset(skip).limit(limit).all()
    
    # Add related data
    for assignment in assignments:
        # Get document info
        document = db.query(Document).filter(Document.id == assignment.document_id).first()
        if document:
            assignment.document_title = document.title
        
        # Get assigned by info
        assigned_by = db.query(User).filter(User.id == assignment.assigned_by_id).first()
        if assigned_by:
            assignment.assigned_by_name = f"{assigned_by.first_name} {assigned_by.last_name}"
        
        # Get assigned to user info
        if assignment.assigned_to_user_id:
            assigned_user = db.query(User).filter(User.id == assignment.assigned_to_user_id).first()
            if assigned_user:
                assignment.assigned_to_user_name = f"{assigned_user.first_name} {assigned_user.last_name}"
        
        # Get assigned to department info
        if assignment.assigned_to_department_id:
            assigned_dept = db.query(Department).filter(Department.id == assignment.assigned_to_department_id).first()
            if assigned_dept:
                assignment.assigned_to_department_name = assigned_dept.name
    
    return assignments

@router.get("/assignments/my", response_model=List[DocumentAssignmentResponse], summary="Get My Assignments")
async def get_my_assignments(
    assignment_type: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    overdue_only: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get assignments for the current user"""
    
    query = db.query(DocumentAssignment).filter(
        or_(
            DocumentAssignment.assigned_to_user_id == current_user.id,
            DocumentAssignment.assigned_to_department_id == current_user.department_id,
            DocumentAssignment.assigned_to_role == current_user.role
        )
    )
    
    # Apply filters
    if assignment_type:
        query = query.filter(DocumentAssignment.assignment_type == assignment_type)
    
    if status:
        query = query.filter(DocumentAssignment.status == status)
    
    if priority:
        query = query.filter(DocumentAssignment.priority == priority)
    
    if overdue_only:
        query = query.filter(
            and_(
                DocumentAssignment.due_date < datetime.utcnow(),
                DocumentAssignment.status != "COMPLETED"
            )
        )
    
    assignments = query.order_by(DocumentAssignment.due_date.asc()).offset(skip).limit(limit).all()
    
    # Add related data (same as list_document_assignments)
    for assignment in assignments:
        document = db.query(Document).filter(Document.id == assignment.document_id).first()
        if document:
            assignment.document_title = document.title
        
        assigned_by = db.query(User).filter(User.id == assignment.assigned_by_id).first()
        if assigned_by:
            assignment.assigned_by_name = f"{assigned_by.first_name} {assigned_by.last_name}"
    
    return assignments

@router.put("/assignments/{assignment_id}", response_model=DocumentAssignmentResponse, summary="Update Assignment")
async def update_assignment(
    assignment_id: int,
    update_data: AssignmentUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an assignment status or details"""
    
    assignment = db.query(DocumentAssignment).filter(DocumentAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Check permissions (assigned user, assigned department member, or admin can update)
    can_update = False
    if assignment.assigned_to_user_id == current_user.id:
        can_update = True
    elif assignment.assigned_to_department_id == current_user.department_id:
        can_update = True
    elif assignment.assigned_to_role == current_user.role:
        can_update = True
    elif current_user.permission_level in [PermissionLevel.ADMIN_ACCESS, PermissionLevel.SUPER_ADMIN]:
        can_update = True
    elif assignment.assigned_by_id == current_user.id:
        can_update = True
    
    if not can_update:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this assignment"
        )
    
    # Update fields
    if update_data.status:
        assignment.status = update_data.status
        if update_data.status == "COMPLETED":
            assignment.completed_at = datetime.utcnow()
    
    if update_data.priority:
        assignment.priority = update_data.priority
    
    if update_data.due_date is not None:
        assignment.due_date = update_data.due_date
    
    db.commit()
    db.refresh(assignment)
    
    # Log the update
    log_document_action(
        db, assignment.document_id, current_user.id, "ASSIGNMENT_UPDATE",
        {"assignment_id": assignment_id, "updates": update_data.dict(exclude_unset=True)}
    )
    
    # Add related data
    document = db.query(Document).filter(Document.id == assignment.document_id).first()
    if document:
        assignment.document_title = document.title
    
    return assignment

# Document Scheduling endpoints

@router.post("/schedules", response_model=DocumentScheduleResponse, summary="Create Document Schedule")
async def create_document_schedule(
    schedule: DocumentScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a document release/retirement schedule"""
    
    # Check document access
    document = check_document_access(db, current_user, schedule.document_id, "edit")
    
    # Check if schedule already exists
    existing_schedule = db.query(DocumentSchedule).filter(
        DocumentSchedule.document_id == schedule.document_id
    ).first()
    
    if existing_schedule:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document schedule already exists"
        )
    
    # Validate responsible user/department
    if schedule.responsible_user_id:
        responsible_user = db.query(User).filter(
            User.id == schedule.responsible_user_id,
            User.is_active == True
        ).first()
        if not responsible_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Responsible user not found"
            )
    
    if schedule.responsible_department_id:
        responsible_dept = db.query(Department).filter(
            Department.id == schedule.responsible_department_id,
            Department.is_active == True
        ).first()
        if not responsible_dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Responsible department not found"
            )
    
    # Create schedule
    db_schedule = DocumentSchedule(
        document_id=schedule.document_id,
        release_date=schedule.release_date,
        effective_date=schedule.effective_date,
        retirement_date=schedule.retirement_date,
        readiness_status=schedule.readiness_status,
        readiness_notes=schedule.readiness_notes,
        responsible_department_id=schedule.responsible_department_id,
        responsible_user_id=schedule.responsible_user_id,
        created_by_id=current_user.id
    )
    
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    
    # Log the scheduling
    log_document_action(
        db, schedule.document_id, current_user.id, "SCHEDULE_CREATE",
        {"schedule_id": db_schedule.id, "readiness_status": schedule.readiness_status}
    )
    
    # Add related data
    db_schedule.document_title = document.title
    
    return db_schedule

# Cross-Department Tagging endpoints

@router.post("/cross-department-tags", response_model=CrossDepartmentTagResponse, summary="Create Cross-Department Tag")
async def create_cross_department_tag(
    tag: CrossDepartmentTagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tag a document for cross-department access"""
    
    # Check document access
    document = check_document_access(db, current_user, tag.document_id, "edit")
    
    # Validate department
    department = db.query(Department).filter(
        Department.id == tag.department_id,
        Department.is_active == True
    ).first()
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
    
    # Check access to confidential departments
    if department.is_confidential and current_user.permission_level not in [PermissionLevel.SUPER_ADMIN, PermissionLevel.ADMIN_ACCESS]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot tag confidential department"
        )
    
    # Check if tag already exists
    existing_tag = db.query(CrossDepartmentTag).filter(
        CrossDepartmentTag.document_id == tag.document_id,
        CrossDepartmentTag.department_id == tag.department_id
    ).first()
    
    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is already tagged for this department"
        )
    
    # Create tag
    db_tag = CrossDepartmentTag(
        document_id=tag.document_id,
        department_id=tag.department_id,
        tag_type=tag.tag_type,
        access_level=tag.access_level,
        notes=tag.notes,
        tagged_by_id=current_user.id
    )
    
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    
    # Create corresponding document access record
    doc_access = DocumentAccess(
        document_id=tag.document_id,
        department_id=tag.department_id,
        permission_level=tag.access_level,
        can_read=True,
        can_download=(tag.access_level in [PermissionLevel.EDIT_ACCESS, PermissionLevel.ADMIN_ACCESS]),
        can_edit=(tag.access_level in [PermissionLevel.EDIT_ACCESS, PermissionLevel.ADMIN_ACCESS]),
        granted_by_id=current_user.id
    )
    db.add(doc_access)
    db.commit()
    
    # Log the tagging
    log_document_action(
        db, tag.document_id, current_user.id, "CROSS_DEPT_TAG",
        {"tag_id": db_tag.id, "department_id": tag.department_id, "tag_type": tag.tag_type}
    )
    
    # Add related data
    db_tag.document_title = document.title
    db_tag.department_name = department.name
    db_tag.tagged_by_name = f"{current_user.first_name} {current_user.last_name}"
    
    return db_tag

@router.get("/cross-department-tags", response_model=List[CrossDepartmentTagResponse], summary="List Cross-Department Tags")
async def list_cross_department_tags(
    document_id: Optional[int] = None,
    department_id: Optional[int] = None,
    tag_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List cross-department tags with filtering"""
    
    query = db.query(CrossDepartmentTag)
    
    # Apply filters
    if document_id:
        query = query.filter(CrossDepartmentTag.document_id == document_id)
    
    if department_id:
        query = query.filter(CrossDepartmentTag.department_id == department_id)
    
    if tag_type:
        query = query.filter(CrossDepartmentTag.tag_type == tag_type)
    
    # Filter by user's department access if not admin
    if current_user.permission_level not in [PermissionLevel.SUPER_ADMIN, PermissionLevel.ADMIN_ACCESS]:
        query = query.filter(CrossDepartmentTag.department_id == current_user.department_id)
    
    tags = query.offset(skip).limit(limit).all()
    
    # Add related data
    for tag in tags:
        document = db.query(Document).filter(Document.id == tag.document_id).first()
        if document:
            tag.document_title = document.title
        
        department = db.query(Department).filter(Department.id == tag.department_id).first()
        if department:
            tag.department_name = department.name
        
        tagged_by = db.query(User).filter(User.id == tag.tagged_by_id).first()
        if tagged_by:
            tag.tagged_by_name = f"{tagged_by.first_name} {tagged_by.last_name}"
    
    return tags

@router.get("/assignments/stats", summary="Get Assignment Statistics")
async def get_assignment_statistics(
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get assignment statistics for dashboard"""
    
    # Build base query
    query = db.query(DocumentAssignment)
    
    # Filter by department if specified and user has access
    if department_id:
        if current_user.permission_level not in [PermissionLevel.SUPER_ADMIN, PermissionLevel.ADMIN_ACCESS]:
            if current_user.department_id != department_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot view other department statistics"
                )
        query = query.filter(DocumentAssignment.assigned_to_department_id == department_id)
    elif current_user.permission_level not in [PermissionLevel.SUPER_ADMIN, PermissionLevel.ADMIN_ACCESS]:
        # Non-admin users see only their department's stats
        query = query.filter(DocumentAssignment.assigned_to_department_id == current_user.department_id)
    
    # Calculate statistics
    total_assignments = query.count()
    pending_assignments = query.filter(DocumentAssignment.status == "PENDING").count()
    in_progress_assignments = query.filter(DocumentAssignment.status == "IN_PROGRESS").count()
    completed_assignments = query.filter(DocumentAssignment.status == "COMPLETED").count()
    overdue_assignments = query.filter(
        and_(
            DocumentAssignment.due_date < datetime.utcnow(),
            DocumentAssignment.status != "COMPLETED"
        )
    ).count()
    
    # High priority assignments
    high_priority_assignments = query.filter(
        and_(
            DocumentAssignment.priority == "HIGH",
            DocumentAssignment.status != "COMPLETED"
        )
    ).count()
    
    return {
        "total_assignments": total_assignments,
        "pending_assignments": pending_assignments,
        "in_progress_assignments": in_progress_assignments,
        "completed_assignments": completed_assignments,
        "overdue_assignments": overdue_assignments,
        "high_priority_assignments": high_priority_assignments,
        "completion_rate": (completed_assignments / total_assignments * 100) if total_assignments > 0 else 0
    }

@router.get("/assignments/stats/departments", summary="Get Assignment Statistics by Department")
async def get_department_assignment_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get assignment statistics broken down by department for dashboard charts"""
    
    # Build query to get department stats
    from sqlalchemy import text
    
    query = text("""
        SELECT 
            d.name as department,
            COUNT(*) as total,
            SUM(CASE WHEN da.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN da.status IN ('PENDING', 'IN_PROGRESS') THEN 1 ELSE 0 END) as pending
        FROM departments d 
        JOIN document_assignments da ON d.id = da.assigned_to_department_id
        GROUP BY d.id, d.name
        ORDER BY d.name
    """)
    
    result = db.execute(query).fetchall()
    
    department_stats = []
    for row in result:
        department_stats.append({
            "department": row.department,
            "total": row.total,
            "completed": row.completed,
            "pending": row.pending,
            "completion_rate": (row.completed / row.total * 100) if row.total > 0 else 0
        })
    
    return {
        "departments": department_stats,
        "total_departments": len(department_stats)
    }