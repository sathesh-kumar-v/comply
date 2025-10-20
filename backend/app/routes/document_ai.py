from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.ai.document_ai import (
    analyse_document_metadata,
    autocomplete_compliance_text,
    check_compliance_grammar,
    create_numbered_outline,
    detect_duplicate_documents,
    estimate_completion_timeline,
    plan_natural_language_search,
    predict_workflow_progress,
    recommend_documents,
    suggest_document_templates,
    suggest_reviewers,
)
from auth import get_current_user
from database import get_db
from models import (
    AccessLevel,
    Document,
    DocumentAuditLog,
    DocumentCategory,
    DocumentReview,
    DocumentStatus,
    DocumentType,
    User,
    UserRole,
)
from pydantic import ValidationError

from schemas import (
    DocumentAICompletionRequest,
    DocumentAICompletionResponse,
    DocumentAICategorizeRequest,
    DocumentAICategorizeResponse,
    DocumentAIDuplicateRequest,
    DocumentAIDuplicateResponse,
    DocumentAIDuplicateMatch,
    DocumentAIGrammarRequest,
    DocumentAIGrammarResponse,
    DocumentAINumberingRequest,
    DocumentAINumberingResponse,
    DocumentAIRecommendation,
    DocumentAIRecommendationResponse,
    DocumentAIReviewer,
    DocumentAISearchRequest,
    DocumentAISearchResponse,
    DocumentAISearchPlan,
    DocumentAITemplateResponse,
    DocumentAIWorkflowAssignRequest,
    DocumentAIWorkflowAssignResponse,
    DocumentAIWorkflowProgressRequest,
    DocumentAIWorkflowProgressResponse,
    DocumentAIWorkflowTimelineRequest,
    DocumentAIWorkflowTimelineResponse,
    DocumentListResponse,
)


router = APIRouter(prefix="/documents/ai", tags=["documents-ai"])
logger = logging.getLogger(__name__)


def _map_strings_to_enum(values: List[str], enum_cls) -> List[Any]:  # type: ignore[no-untyped-def]
    mapped = []
    for value in values:
        if value is None:
            continue
        try:
            mapped.append(enum_cls(value))
        except ValueError:
            try:
                mapped.append(enum_cls(value.upper()))
            except Exception:
                continue
    return mapped


def _serialize_document(doc: Document) -> Dict[str, Any]:
    return {
        "id": doc.id,
        "title": doc.title,
        "document_type": doc.document_type.value if isinstance(doc.document_type, DocumentType) else str(doc.document_type),
        "status": doc.status.value if isinstance(doc.status, DocumentStatus) else str(doc.status),
        "access_level": doc.access_level.value if isinstance(doc.access_level, AccessLevel) else str(doc.access_level),
        "category": doc.category,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "created_by_id": doc.created_by_id,
    }


def _fallback_document_recommendations(
    *, current_user: User, recent_docs: List[Document], accessible_docs: List[Document]
) -> Dict[str, Any]:
    """Generate deterministic recommendations when the AI provider is unavailable."""

    recent_ids = {doc.id for doc in recent_docs}
    recent_categories = {doc.category for doc in recent_docs if doc.category}
    recent_types = {doc.document_type for doc in recent_docs if doc.document_type}

    scored: List[tuple[float, Dict[str, Any], Document]] = []

    def _normalise_datetime(value: Optional[datetime]) -> datetime:
        if value is None:
            return datetime.min
        if value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    for doc in accessible_docs:
        if doc.id in recent_ids:
            continue

        score = 1.0  # Base score to keep overall ordering deterministic
        reasons: List[str] = []

        if doc.category and doc.category in recent_categories:
            score += 3
            reasons.append(f"Matches your recent {doc.category} documents")

        if doc.document_type and doc.document_type in recent_types:
            score += 2
            doc_type_value = (
                doc.document_type.value if isinstance(doc.document_type, DocumentType) else str(doc.document_type)
            )
            reasons.append(f"Similar {doc_type_value.replace('_', ' ')} content")

        if doc.updated_at:
            updated_at = _normalise_datetime(doc.updated_at)
            age_days = (datetime.utcnow() - updated_at).days
            recency_bonus = max(0, 45 - age_days) / 15
            if recency_bonus > 0:
                score += recency_bonus
            if age_days <= 30:
                reasons.append("Recently updated")

        if doc.status == DocumentStatus.PUBLISHED:
            score += 1
            reasons.append("Published and ready to use")
        elif doc.status == DocumentStatus.UNDER_REVIEW:
            score += 0.5
            reasons.append("Currently under review")

        if doc.created_by_id == current_user.id:
            score += 0.5
            reasons.append("Created by you")

        if not reasons:
            reasons.append("Popular document in your workspace")

        reason_text = "; ".join(dict.fromkeys(reasons))
        priority = "high" if score >= 6 else "medium" if score >= 3.5 else "low"

        scored.append(
            (
                score,
                {
                    "id": doc.id,
                    "title": doc.title,
                    "reason": reason_text,
                    "priority": priority,
                },
                doc,
            )
        )

    scored.sort(key=lambda item: (item[0], _normalise_datetime(item[2].updated_at)), reverse=True)
    top_results = scored[:5]

    recommendations = [entry[1] for entry in top_results]
    recommended_ids = [entry[2].id for entry in top_results]

    if recommendations:
        summary = (
            "Showing heuristic suggestions because AI recommendations are temporarily unavailable. "
            "These picks are based on recency and similarity to your recent documents."
        )
    else:
        summary = (
            "AI recommendations are temporarily unavailable and there are no recent documents to suggest yet."
        )

    raw_payload = json.dumps(
        {
            "source": "fallback",
            "matched_categories": sorted({cat for cat in recent_categories}),
            "matched_types": [
                value.value if isinstance(value, DocumentType) else str(value) for value in sorted(recent_types, key=str)
            ],
            "recommended_ids": recommended_ids,
        }
    )

    return {
        "recommendations": recommendations,
        "summary": summary,
        "raw": raw_payload,
    }


@router.post("/categorize", response_model=DocumentAICategorizeResponse)
def ai_categorize_document(
    payload: DocumentAICategorizeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentAICategorizeResponse:
    try:
        categories = [cat.name for cat in db.query(DocumentCategory).all()]
        analysis = analyse_document_metadata(
            title=payload.title,
            description=payload.description,
            file_name=payload.title,
            existing_tags=payload.existing_tags,
            existing_keywords=payload.existing_keywords,
            available_categories=categories,
            text_preview=payload.text_preview,
        )

        return DocumentAICategorizeResponse(
            category=analysis.get("category"),
            secondary_categories=[str(val) for val in analysis.get("secondary_categories", []) if val],
            tags=[str(tag) for tag in analysis.get("tags", []) if tag],
            keywords=[str(tag) for tag in analysis.get("keywords", []) if tag],
            summary=analysis.get("summary"),
            confidence=analysis.get("confidence"),
            notes=[str(note) for note in analysis.get("notes", []) if note],
            raw=analysis.get("raw"),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/search", response_model=DocumentAISearchResponse)
def ai_search_documents(
    payload: DocumentAISearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentAISearchResponse:
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query is required for AI search")

    try:
        snapshot_query = (
            db.query(Document)
            .filter(Document.is_current_version == True)
            .order_by(Document.updated_at.desc())
            .limit(25)
        )
        snapshot = [_serialize_document(doc) for doc in snapshot_query.all()]
        plan_raw = plan_natural_language_search(payload.query, library_snapshot=snapshot)

        plan = DocumentAISearchPlan(
            refined_query=plan_raw.get("refined_query"),
            keywords=[str(k) for k in plan_raw.get("keywords", []) if k],
            document_types=[str(v) for v in plan_raw.get("document_types", []) if v],
            statuses=[str(v) for v in plan_raw.get("statuses", []) if v],
            access_levels=[str(v) for v in plan_raw.get("access_levels", []) if v],
            priority=plan_raw.get("priority"),
            reasoning=plan_raw.get("reasoning"),
            raw=plan_raw.get("raw"),
        )

        query_builder = db.query(Document).filter(Document.is_current_version == True)

        # Access control similar to standard search
        if current_user.role != UserRole.ADMIN:
            allowed_roles = [UserRole.MANAGER, UserRole.AUDITOR, UserRole.EMPLOYEE]
            access_filter = or_(
                Document.created_by_id == current_user.id,
                Document.access_level == AccessLevel.PUBLIC,
                and_(
                    Document.access_level == AccessLevel.INTERNAL,
                    current_user.role in allowed_roles,
                ),
            )
            query_builder = query_builder.filter(access_filter)

        keywords = plan.keywords
        refined = plan.refined_query or payload.query

        if keywords:
            keyword_filters = [
                or_(
                    Document.title.ilike(f"%{kw}%"),
                    Document.description.ilike(f"%{kw}%"),
                    Document.keywords.ilike(f"%{kw}%"),
                )
                for kw in keywords
            ]
            query_builder = query_builder.filter(and_(*keyword_filters))
        else:
            query_builder = query_builder.filter(
                or_(
                    Document.title.ilike(f"%{refined}%"),
                    Document.description.ilike(f"%{refined}%"),
                    Document.keywords.ilike(f"%{refined}%"),
                )
            )

        doc_types = _map_strings_to_enum(plan.document_types, DocumentType)
        if doc_types:
            query_builder = query_builder.filter(Document.document_type.in_(doc_types))

        statuses = _map_strings_to_enum(plan.statuses, DocumentStatus)
        if statuses:
            query_builder = query_builder.filter(Document.status.in_(statuses))

        access_levels = _map_strings_to_enum(plan.access_levels, AccessLevel)
        if access_levels:
            query_builder = query_builder.filter(Document.access_level.in_(access_levels))

        total_count = query_builder.count()
        size = max(1, min(payload.size, 100))
        page = max(1, payload.page)
        offset = (page - 1) * size

        documents = (
            query_builder.order_by(Document.updated_at.desc()).offset(offset).limit(size).all()
        )

        total_pages = (total_count + size - 1) // size
        results = [DocumentListResponse.model_validate(doc) for doc in documents]

        return DocumentAISearchResponse(
            plan=plan,
            results=results,
            total_count=total_count,
            total_pages=total_pages,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/duplicates", response_model=DocumentAIDuplicateResponse)
def ai_detect_duplicates(
    payload: DocumentAIDuplicateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentAIDuplicateResponse:
    try:
        candidate = {
            "title": payload.title,
            "description": payload.description,
            "document_type": payload.document_type.value if payload.document_type else None,
            "file_hash": payload.file_hash,
            "keywords": payload.keywords or [],
            "tags": payload.tags or [],
        }

        existing_query = db.query(Document).filter(Document.is_current_version == True)

        potential_matches: List[Document] = []
        if payload.file_hash:
            potential_matches.extend(
                existing_query.filter(Document.file_hash == payload.file_hash).all()
            )

        potential_matches.extend(
            existing_query.filter(Document.title.ilike(f"%{payload.title}%")).limit(25).all()
        )

        unique_matches = {doc.id: doc for doc in potential_matches}.values()

        existing_payload = [_serialize_document(doc) for doc in unique_matches]

        analysis = detect_duplicate_documents(candidate=candidate, existing=list(existing_payload))

        duplicates: List[DocumentAIDuplicateMatch] = []
        exact_match = False

        for doc in unique_matches:
            if payload.file_hash and doc.file_hash == payload.file_hash:
                exact_match = True
                duplicates.append(
                    DocumentAIDuplicateMatch(
                        id=doc.id,
                        title=doc.title,
                        similarity=1.0,
                        reasoning="Exact file hash match",
                    )
                )

        for item in analysis.get("duplicates", []):
            doc_id = item.get("id")
            if not doc_id:
                continue
            title = item.get("title") or "Potential duplicate"
            similarity = float(item.get("similarity", 0))
            reasoning = item.get("reason") or item.get("reasoning")
            duplicates.append(
                DocumentAIDuplicateMatch(
                    id=int(doc_id),
                    title=title,
                    similarity=similarity,
                    reasoning=reasoning,
                )
            )

        # Deduplicate duplicates list by id keeping highest similarity
        deduped: Dict[int, DocumentAIDuplicateMatch] = {}
        for match in duplicates:
            if match.id not in deduped or deduped[match.id].similarity < match.similarity:
                deduped[match.id] = match

        return DocumentAIDuplicateResponse(
            has_exact_match=exact_match or bool(analysis.get("has_exact_match")),
            duplicates=list(deduped.values()),
            notes=[str(note) for note in analysis.get("notes", []) if note],
            raw=analysis.get("raw"),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/recommendations", response_model=DocumentAIRecommendationResponse)
def ai_recommend_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentAIRecommendationResponse:
    try:
        recent_docs = (
            db.query(Document)
            .filter(Document.created_by_id == current_user.id, Document.is_current_version == True)
            .order_by(Document.updated_at.desc())
            .limit(10)
            .all()
        )
        recent_payload = [_serialize_document(doc) for doc in recent_docs]

        accessible_docs = (
            db.query(Document)
            .filter(Document.is_current_version == True)
            .order_by(Document.updated_at.desc())
            .limit(75)
            .all()
        )
        accessible_payload = [_serialize_document(doc) for doc in accessible_docs]

        user_profile = {
            "id": current_user.id,
            "role": current_user.role.value if isinstance(current_user.role, UserRole) else str(current_user.role),
            "department_id": current_user.department_id,
        }

        try:
            analysis = recommend_documents(
                user_profile=user_profile,
                recent_documents=recent_payload,
                available_documents=accessible_payload,
            )
        except Exception as exc:  # noqa: BLE001 - broad to ensure graceful fallbacks
            logger.warning("Falling back to heuristic document recommendations: %s", exc)
            analysis = _fallback_document_recommendations(
                current_user=current_user,
                recent_docs=recent_docs,
                accessible_docs=accessible_docs,
            )

        if not isinstance(analysis, dict):
            logger.warning(
                "Unexpected recommendation payload type %s; substituting fallback structure",
                type(analysis).__name__,
            )
            analysis = {
                "recommendations": [],
                "summary": None,
                "raw": json.dumps(analysis, default=str),
            }

        recommendations: List[DocumentAIRecommendation] = []
        recommended_docs: Dict[int, Document] = {}

        for item in analysis.get("recommendations", []):
            try:
                doc_id = int(item.get("id"))
            except (TypeError, ValueError):
                continue
            reason = item.get("reason") or item.get("explanation")
            priority = item.get("priority")
            recommendations.append(
                DocumentAIRecommendation(id=doc_id, title=str(item.get("title", "")), reason=reason, priority=priority)
            )
            if doc_id in recommended_docs:
                continue
            doc_match = next((doc for doc in accessible_docs if doc.id == doc_id), None)
            if doc_match:
                recommended_docs[doc_id] = doc_match

        document_responses: List[DocumentListResponse] = []
        for doc in recommended_docs.values():
            try:
                document_responses.append(DocumentListResponse.model_validate(doc))
            except ValidationError:
                logger.warning("Skipping document %s due to validation error", getattr(doc, "id", "<unknown>"))

        return DocumentAIRecommendationResponse(
            recommendations=recommendations,
            documents=document_responses,
            summary=analysis.get("summary"),
            raw=analysis.get("raw"),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/editor/completion", response_model=DocumentAICompletionResponse)
def ai_editor_completion(
    payload: DocumentAICompletionRequest,
    current_user: User = Depends(get_current_user),
) -> DocumentAICompletionResponse:
    try:
        result = autocomplete_compliance_text(context=payload.context, focus=payload.focus)
        return DocumentAICompletionResponse(
            completion=result.get("completion", ""),
            reasoning=result.get("reasoning"),
            tips=[str(tip) for tip in result.get("tips", []) if tip],
            raw=result.get("raw"),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/editor/templates", response_model=DocumentAITemplateResponse)
def ai_editor_templates(
    document_type: str,
    department: Optional[str] = None,
    tags: Optional[List[str]] = None,
    current_user: User = Depends(get_current_user),
) -> DocumentAITemplateResponse:
    try:
        result = suggest_document_templates(document_type=document_type, department=department, tags=tags)
        templates = []
        for tpl in result.get("templates", []):
            templates.append(
                {
                    "name": tpl.get("name", "Unnamed template"),
                    "description": tpl.get("description"),
                    "when_to_use": tpl.get("when_to_use") or tpl.get("focus"),
                }
            )
        return DocumentAITemplateResponse(
            templates=templates,
            sections=[str(section) for section in result.get("sections", []) if section],
            notes=[str(note) for note in result.get("notes", []) if note],
            raw=result.get("raw"),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/editor/grammar", response_model=DocumentAIGrammarResponse)
def ai_editor_grammar(
    payload: DocumentAIGrammarRequest,
    current_user: User = Depends(get_current_user),
) -> DocumentAIGrammarResponse:
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Content is required for grammar review")

    try:
        result = check_compliance_grammar(content=payload.content, jurisdiction=payload.jurisdiction)
        issues = []
        for issue in result.get("issues", []):
            issues.append(
                {
                    "issue": issue.get("issue") or issue.get("message") or "",
                    "severity": issue.get("severity"),
                    "suggestion": issue.get("suggestion") or issue.get("recommendation"),
                }
            )
        return DocumentAIGrammarResponse(
            score=result.get("score"),
            issues=issues,
            summary=result.get("summary"),
            raw=result.get("raw"),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/editor/numbering", response_model=DocumentAINumberingResponse)
def ai_editor_numbering(
    payload: DocumentAINumberingRequest,
    current_user: User = Depends(get_current_user),
) -> DocumentAINumberingResponse:
    if not payload.outline:
        raise HTTPException(status_code=400, detail="Outline must contain at least one heading")

    try:
        result = create_numbered_outline(
            outline=payload.outline,
            cross_reference_hints=payload.cross_reference_hints,
        )

        sections = []
        for section in result.get("numbered_sections", []):
            sections.append(
                {
                    "number": section.get("number") or section.get("id") or "",
                    "heading": section.get("heading") or section.get("title") or "",
                }
            )

        return DocumentAINumberingResponse(
            numbered_sections=sections,
            cross_references=[str(ref) for ref in result.get("cross_references", []) if ref],
            notes=[str(note) for note in result.get("notes", []) if note],
            raw=result.get("raw"),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/workflow/assign", response_model=DocumentAIWorkflowAssignResponse)
def ai_workflow_assign(
    payload: DocumentAIWorkflowAssignRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentAIWorkflowAssignResponse:
    try:
        document_data: Dict[str, Any] = {}
        if payload.document_id:
            document = db.query(Document).filter(Document.id == payload.document_id).first()
            if not document:
                raise HTTPException(status_code=404, detail="Document not found")
            document_data = _serialize_document(document)
        else:
            document_data = {
                "document_type": payload.document_type,
                "department": payload.department,
            }

        reviewer_query = db.query(User)
        if payload.reviewer_ids:
            reviewer_query = reviewer_query.filter(User.id.in_(payload.reviewer_ids))
        else:
            reviewer_query = reviewer_query.filter(User.role.in_([UserRole.MANAGER, UserRole.AUDITOR, UserRole.EMPLOYEE]))

        reviewers = reviewer_query.limit(25).all()
        reviewer_payload = [
            {
                "id": reviewer.id,
                "name": f"{reviewer.first_name} {reviewer.last_name}".strip(),
                "role": reviewer.role.value if isinstance(reviewer.role, UserRole) else str(reviewer.role),
                "department_id": reviewer.department_id,
            }
            for reviewer in reviewers
        ]

        result = suggest_reviewers(document=document_data, reviewers=reviewer_payload)

        def _map_reviewer(item: Dict[str, Any]) -> DocumentAIReviewer:
            return DocumentAIReviewer(
                id=int(item.get("id")),
                name=str(item.get("name", "")),
                role=item.get("role"),
                expertise=item.get("expertise"),
                workload=item.get("workload"),
            )

        recommended = [_map_reviewer(item) for item in result.get("recommended", []) if item.get("id")]
        backup = [_map_reviewer(item) for item in result.get("backup", []) if item.get("id")]

        return DocumentAIWorkflowAssignResponse(
            recommended=recommended,
            backup=backup,
            notes=[str(note) for note in result.get("notes", []) if note],
            raw=result.get("raw"),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/workflow/progress", response_model=DocumentAIWorkflowProgressResponse)
def ai_workflow_progress(
    payload: DocumentAIWorkflowProgressRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentAIWorkflowProgressResponse:
    if not payload.document_id:
        raise HTTPException(status_code=400, detail="document_id is required for workflow progress analysis")

    document = db.query(Document).filter(Document.id == payload.document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        audits = (
            db.query(DocumentAuditLog)
            .filter(DocumentAuditLog.document_id == payload.document_id)
            .order_by(DocumentAuditLog.timestamp.asc())
            .limit(50)
            .all()
        )
        history = [
            {
                "action": audit.action,
                "timestamp": audit.timestamp.isoformat() if audit.timestamp else None,
                "user_id": audit.user_id,
            }
            for audit in audits
        ]

        result = predict_workflow_progress(document=_serialize_document(document), history=history)

        return DocumentAIWorkflowProgressResponse(
            next_step=result.get("next_step"),
            automation=[str(item) for item in result.get("automation", []) if item],
            blockers=[str(item) for item in result.get("blockers", []) if item],
            notes=[str(note) for note in result.get("notes", []) if note],
            raw=result.get("raw"),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/workflow/timeline", response_model=DocumentAIWorkflowTimelineResponse)
def ai_workflow_timeline(
    payload: DocumentAIWorkflowTimelineRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentAIWorkflowTimelineResponse:
    if not payload.document_id:
        raise HTTPException(status_code=400, detail="document_id is required for timeline estimation")

    document = db.query(Document).filter(Document.id == payload.document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        reviews = (
            db.query(DocumentReview)
            .filter(DocumentReview.document_id == payload.document_id)
            .order_by(DocumentReview.assigned_at.asc())
            .all()
        )
        history = [
            {
                "reviewer_id": review.reviewer_id,
                "status": review.status,
                "assigned_at": review.assigned_at.isoformat() if review.assigned_at else None,
                "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None,
            }
            for review in reviews
        ]

        result = estimate_completion_timeline(
            document=_serialize_document(document),
            history=history,
            sla_days=payload.sla_days,
        )

        return DocumentAIWorkflowTimelineResponse(
            estimated_completion=result.get("estimated_completion"),
            phase_estimates=result.get("phase_estimates", []),
            risk_level=result.get("risk_level"),
            confidence=result.get("confidence"),
            notes=[str(note) for note in result.get("notes", []) if note],
            raw=result.get("raw"),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

