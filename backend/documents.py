from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, desc, asc, func
from typing import List, Optional
import os
import shutil
import hashlib
import json
import mimetypes
from datetime import datetime, timedelta
import uuid

from database import get_db
from auth import get_current_user, require_role
from models import (
    User, UserRole, Document, DocumentVersion, DocumentAccess, 
    DocumentAuditLog, DocumentCategory, DocumentReview, DocumentStatus, 
    DocumentType, AccessLevel, Department, Site, Country
)
from schemas import (
    DocumentCreate, DocumentUpdate, DocumentResponse, DocumentListResponse,
    DocumentSearchRequest, DocumentSearchResponse, DocumentVersionResponse,
    DocumentAccessRequest, DocumentAccessResponse, DocumentAuditLogResponse,
    DocumentCategoryCreate, DocumentCategoryResponse, DocumentReviewCreate,
    DocumentReviewUpdate, DocumentReviewResponse, DocumentUploadResponse,
    DocumentStats
)

router = APIRouter()

# Configuration
UPLOAD_DIR = "uploads/documents"
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_EXTENSIONS = {
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.rtf', '.csv', '.jpg', '.jpeg', '.png', '.gif',
    '.zip', '.rar', '.7z', '.mp4', '.avi', '.mov'
}

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

def log_document_action(db: Session, document_id: int, user: User, action: str, 
                       details: dict = None, request: Request = None):
    """Log document action for audit trail"""
    audit_log = DocumentAuditLog(
        document_id=document_id,
        user_id=user.id,
        action=action,
        details=json.dumps(details) if details else None,
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get("user-agent") if request else None
    )
    db.add(audit_log)
    db.commit()

def check_document_access(db: Session, document: Document, user: User, permission: str) -> bool:
    """Check if user has specific permission for document"""
    
    # Admin has all permissions
    if user.role == UserRole.ADMIN:
        return True
    
    # Check if user is document owner
    if document.created_by_id == user.id:
        return True
    
    # Get user's company through department -> site -> country -> company chain
    if user.department_id:
        user_department = db.query(Department).filter(Department.id == user.department_id).first()
        if user_department and user_department.site_id:
            user_site = db.query(Site).filter(Site.id == user_department.site_id).first()
            if user_site and user_site.country_id:
                user_country = db.query(Country).filter(Country.id == user_site.country_id).first()
                if user_country:
                    user_company_id = user_country.company_id
                    
                    # Get document creator's company
                    doc_creator = db.query(User).filter(User.id == document.created_by_id).first()
                    if doc_creator and doc_creator.department_id:
                        doc_department = db.query(Department).filter(Department.id == doc_creator.department_id).first()
                        if doc_department and doc_department.site_id:
                            doc_site = db.query(Site).filter(Site.id == doc_department.site_id).first()
                            if doc_site and doc_site.country_id:
                                doc_country = db.query(Country).filter(Country.id == doc_site.country_id).first()
                                if doc_country:
                                    doc_company_id = doc_country.company_id
                                    
                                    # Only allow access if users are from same company
                                    if user_company_id != doc_company_id:
                                        return False
    
    # Check document access rules
    access_rule = db.query(DocumentAccess).filter(
        DocumentAccess.document_id == document.id,
        or_(
            DocumentAccess.user_id == user.id,
            DocumentAccess.role == user.role,
            DocumentAccess.department_id == user.department_id
        )
    ).first()
    
    if access_rule:
        if permission == 'read' and access_rule.can_read:
            return True
        elif permission == 'download' and access_rule.can_download:
            return True
        elif permission == 'edit' and access_rule.can_edit:
            return True
        elif permission == 'delete' and access_rule.can_delete:
            return True
    
    # Default access based on document access level and role hierarchy
    if document.access_level == AccessLevel.PUBLIC:
        return permission in ['read', 'download']
    elif document.access_level == AccessLevel.INTERNAL:
        role_permissions = {
            UserRole.MANAGER: ['read', 'download', 'edit'],
            UserRole.AUDITOR: ['read', 'download'],
            UserRole.EMPLOYEE: ['read', 'download'],
            UserRole.VIEWER: ['read']
        }
        return permission in role_permissions.get(user.role, [])
    
    return False

def calculate_file_hash(file_path: str) -> str:
    """Calculate SHA-256 hash of file"""
    hash_sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()

@router.post("/upload", 
             response_model=DocumentUploadResponse,
             summary="Upload Document",
             description="Upload a new document with metadata")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    document_type: DocumentType = Form(...),
    access_level: AccessLevel = Form(AccessLevel.INTERNAL),
    status: Optional[DocumentStatus] = Form(DocumentStatus.DRAFT),
    category: Optional[str] = Form(None),
    subcategory: Optional[str] = Form(None),
    keywords: Optional[str] = Form(None),  # JSON string
    tags: Optional[str] = Form(None),      # JSON string
    compliance_framework: Optional[str] = Form(None),
    retention_period_months: Optional[int] = Form(None),
    review_frequency_months: Optional[int] = Form(None),
    expires_at: Optional[str] = Form(None),  # ISO date string
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if user has permission to upload documents
    if current_user.role == UserRole.VIEWER:
        raise HTTPException(
            status_code=403, 
            detail="Viewers do not have permission to upload documents. Please contact your administrator."
        )
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {file_extension} not allowed")
    
    # Check file size
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)     # Reset to beginning
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Calculate file hash
    file_hash = calculate_file_hash(file_path)
    
    # Parse optional fields
    parsed_keywords = json.loads(keywords) if keywords else []
    parsed_tags = json.loads(tags) if tags else []
    parsed_expires_at = datetime.fromisoformat(expires_at) if expires_at else None
    
    # Create document record
    document = Document(
        title=title,
        description=description,
        document_type=document_type,
        status=status,
        access_level=access_level,
        filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=mimetypes.guess_type(file.filename)[0] or 'application/octet-stream',
        file_hash=file_hash,
        keywords=json.dumps(parsed_keywords),
        category=category,
        subcategory=subcategory,
        tags=json.dumps(parsed_tags),
        compliance_framework=compliance_framework,
        retention_period_months=retention_period_months,
        review_frequency_months=review_frequency_months,
        expires_at=parsed_expires_at,
        created_by_id=current_user.id,
        next_review_date=datetime.utcnow() + timedelta(days=review_frequency_months * 30) if review_frequency_months else None
    )
    
    db.add(document)
    db.commit()
    db.refresh(document)
    
    try:
        # Log action
        log_document_action(db, document.id, current_user, "CREATE", 
                           {"filename": file.filename, "file_size": file_size}, request)
        
        # Create response with proper serialization
        return DocumentUploadResponse(
            message="Document uploaded successfully",
            document=DocumentResponse.model_validate(document)
        )
    except Exception as e:
        print(f"Error in upload response: {e}")
        # If there's an error, refresh the document object and try again
        db.refresh(document)
        try:
            return DocumentUploadResponse(
                message="Document uploaded successfully", 
                document=DocumentResponse.model_validate(document)
            )
        except Exception as retry_error:
            print(f"Retry error: {retry_error}")
            # If all else fails, raise an HTTPException with proper CORS headers
            raise HTTPException(
                status_code=500,
                detail="Document uploaded but failed to generate response. Please refresh the page."
            )

@router.get("/search", 
           response_model=DocumentSearchResponse,
           summary="Search Documents",
           description="Search and filter documents with pagination")
async def search_documents(
    request: Request,
    query: Optional[str] = None,
    document_type: Optional[DocumentType] = None,
    status: Optional[DocumentStatus] = None,
    access_level: Optional[AccessLevel] = None,
    category: Optional[str] = None,
    created_by: Optional[int] = None,
    created_after: Optional[str] = None,
    created_before: Optional[str] = None,
    expires_before: Optional[str] = None,
    needs_review: Optional[bool] = None,
    page: int = 1,
    size: int = 20,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Build query
        db_query = db.query(Document).filter(Document.is_current_version == True)
        
        # Apply filters
        if query:
            db_query = db_query.filter(
                or_(
                    Document.title.ilike(f"%{query}%"),
                    Document.description.ilike(f"%{query}%"),
                    Document.keywords.ilike(f"%{query}%")
                )
            )
        
        if document_type:
            db_query = db_query.filter(Document.document_type == document_type)
        
        if status:
            db_query = db_query.filter(Document.status == status)
        
        if access_level:
            db_query = db_query.filter(Document.access_level == access_level)
        
        if category:
            db_query = db_query.filter(Document.category == category)
        
        if created_by:
            db_query = db_query.filter(Document.created_by_id == created_by)
        
        if created_after:
            try:
                db_query = db_query.filter(Document.created_at >= datetime.fromisoformat(created_after))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid created_after date format")
        
        if created_before:
            try:
                db_query = db_query.filter(Document.created_at <= datetime.fromisoformat(created_before))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid created_before date format")
        
        if expires_before:
            try:
                db_query = db_query.filter(
                    and_(
                        Document.expires_at.isnot(None),
                        Document.expires_at <= datetime.fromisoformat(expires_before)
                    )
                )
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid expires_before date format")
        
        if needs_review:
            db_query = db_query.filter(
                and_(
                    Document.next_review_date.isnot(None),
                    Document.next_review_date <= datetime.utcnow()
                )
            )
        
        # Apply access control filters
        if current_user.role != UserRole.ADMIN:
            # Filter based on access level and permissions
            access_filter = or_(
                Document.created_by_id == current_user.id,
                Document.access_level == AccessLevel.PUBLIC,
                and_(
                    Document.access_level == AccessLevel.INTERNAL,
                    current_user.role in [UserRole.MANAGER, UserRole.AUDITOR, UserRole.EMPLOYEE]
                )
            )
            db_query = db_query.filter(access_filter)
        
        # Count total results
        total_count = db_query.count()
        
        # Apply sorting - validate sort_by parameter
        valid_sort_columns = ['created_at', 'updated_at', 'title', 'document_type', 'status', 'category']
        if sort_by not in valid_sort_columns:
            sort_by = 'created_at'
            
        sort_column = getattr(Document, sort_by, Document.created_at)
        if sort_order == "desc":
            db_query = db_query.order_by(desc(sort_column))
        else:
            db_query = db_query.order_by(asc(sort_column))
        
        # Apply pagination
        offset = (page - 1) * size
        documents = db_query.offset(offset).limit(size).all()
        
        # Log search action - use None for document_id since this is a search operation
        # Note: We'll need to handle None document_id in the audit log or skip logging for searches
        try:
            # Skip logging search actions to avoid foreign key constraint issues
            # log_document_action(db, None, current_user, "SEARCH", 
            #                    {"query": query, "filters": {
            #                        "document_type": document_type,
            #                        "status": status,
            #                        "category": category
            #                    }}, request)
            pass
        except Exception as log_error:
            print(f"Failed to log search action: {log_error}")
            # Continue execution even if logging fails
        
        total_pages = (total_count + size - 1) // size
        
        return DocumentSearchResponse(
            documents=[DocumentListResponse.model_validate(doc) for doc in documents],
            total_count=total_count,
            page=page,
            size=size,
            total_pages=total_pages
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Search endpoint error: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error during document search: {str(e)}"
        )

@router.get("/{document_id}", 
           response_model=DocumentResponse,
           summary="Get Document",
           description="Get document details by ID")
async def get_document(
    document_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    document = db.query(Document).options(
        joinedload(Document.created_by),
        joinedload(Document.modified_by),
        joinedload(Document.approved_by)
    ).filter(Document.id == document_id).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check read permission
    if not check_document_access(db, document, current_user, "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions to view this document")
    
    # Log read action
    log_document_action(db, document.id, current_user, "READ", None, request)
    
    # Check for linked questionnaires that should be triggered
    from models import Questionnaire, QuestionnaireStatus
    linked_questionnaires = db.query(Questionnaire).filter(
        Questionnaire.linked_document_id == document.id,
        Questionnaire.trigger_on_document_access == True,
        Questionnaire.status == QuestionnaireStatus.ACTIVE
    ).all()
    
    response_data = DocumentResponse.model_validate(document).model_dump()
    if linked_questionnaires:
        response_data['linked_questionnaires'] = [
            {
                'id': q.id,
                'title': q.title,
                'description': q.description
            } for q in linked_questionnaires
        ]
    
    return response_data

@router.get("/{document_id}/download",
           summary="Download Document",
           description="Download document file")
async def download_document(
    document_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    document = db.query(Document).filter(Document.id == document_id).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check download permission
    if not check_document_access(db, document, current_user, "download"):
        raise HTTPException(status_code=403, detail="Insufficient permissions to download this document")
    
    # Check if file exists
    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
    
    # Log download action
    log_document_action(db, document.id, current_user, "DOWNLOAD", 
                       {"filename": document.filename}, request)
    
    return FileResponse(
        path=document.file_path,
        filename=document.filename,
        media_type=document.mime_type
    )

@router.put("/{document_id}",
           response_model=DocumentResponse,
           summary="Update Document",
           description="Update document metadata")
async def update_document(
    document_id: int,
    document_update: DocumentUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    document = db.query(Document).filter(Document.id == document_id).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check edit permission
    if current_user.role == UserRole.VIEWER:
        raise HTTPException(
            status_code=403, 
            detail="Viewers do not have permission to edit documents. Please contact your administrator."
        )
    if not check_document_access(db, document, current_user, "edit"):
        raise HTTPException(status_code=403, detail="Insufficient permissions to edit this document")
    
    # Update fields
    update_data = document_update.model_dump(exclude_unset=True)
    changes = {}
    
    for field, value in update_data.items():
        if hasattr(document, field):
            old_value = getattr(document, field)
            if field in ['keywords', 'tags'] and isinstance(value, list):
                value = json.dumps(value)
            setattr(document, field, value)
            changes[field] = {"old": old_value, "new": value}
    
    document.modified_by_id = current_user.id
    document.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(document)
    
    # Log update action
    log_document_action(db, document.id, current_user, "UPDATE", changes, request)
    
    return DocumentResponse.model_validate(document)

@router.delete("/{document_id}",
              summary="Delete Document",
              description="Delete document and its file")
async def delete_document(
    document_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    document = db.query(Document).filter(Document.id == document_id).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check delete permission
    if current_user.role == UserRole.VIEWER:
        raise HTTPException(
            status_code=403, 
            detail="Viewers do not have permission to delete documents. Please contact your administrator."
        )
    if not check_document_access(db, document, current_user, "delete"):
        raise HTTPException(status_code=403, detail="Insufficient permissions to delete this document")
    
    # Delete file from filesystem
    if os.path.exists(document.file_path):
        os.remove(document.file_path)
    
    # Log delete action before deleting
    log_document_action(db, document.id, current_user, "DELETE", 
                       {"filename": document.filename, "title": document.title}, request)
    
    # Delete from database
    db.delete(document)
    db.commit()
    
    return {"message": "Document deleted successfully"}

@router.get("/stats/overview",
           response_model=DocumentStats,
           summary="Get Document Statistics",
           description="Get overview statistics for documents")
async def get_document_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Build base query with access control
    base_query = db.query(Document).filter(Document.is_current_version == True)
    
    # Apply access control filters (same as search endpoint)
    if current_user.role != UserRole.ADMIN:
        access_filter = or_(
            Document.created_by_id == current_user.id,
            Document.access_level == AccessLevel.PUBLIC,
            and_(
                Document.access_level == AccessLevel.INTERNAL,
                current_user.role in [UserRole.MANAGER, UserRole.AUDITOR, UserRole.EMPLOYEE]
            )
        )
        base_query = base_query.filter(access_filter)
    
    # Total documents
    total_documents = base_query.count()
    
    # By type
    by_type = {}
    type_stats = base_query.with_entities(Document.document_type, func.count(Document.id)).group_by(Document.document_type).all()
    by_type = {doc_type.value: count for doc_type, count in type_stats}
    
    # By status
    by_status = {}
    status_stats = base_query.with_entities(Document.status, func.count(Document.id)).group_by(Document.status).all()
    by_status = {status.value: count for status, count in status_stats}
    
    # By access level
    by_access_level = {}
    access_stats = base_query.with_entities(Document.access_level, func.count(Document.id)).group_by(Document.access_level).all()
    by_access_level = {level.value: count for level, count in access_stats}
    
    # Documents needing review
    documents_needing_review = base_query.filter(
        and_(
            Document.next_review_date.isnot(None),
            Document.next_review_date <= datetime.utcnow()
        )
    ).count()
    
    # Expired documents
    expired_documents = base_query.filter(
        and_(
            Document.expires_at.isnot(None),
            Document.expires_at <= datetime.utcnow()
        )
    ).count()
    
    # Recent uploads (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_uploads = base_query.filter(Document.created_at >= week_ago).count()
    
    return DocumentStats(
        total_documents=total_documents,
        by_type=by_type,
        by_status=by_status,
        by_access_level=by_access_level,
        documents_needing_review=documents_needing_review,
        expired_documents=expired_documents,
        recent_uploads=recent_uploads
    )