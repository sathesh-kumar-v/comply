# fmea_router.py
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from pydantic import BaseModel

from database import get_db
from models import (
    FMEA, FMEAItem, FMEATeamMember, FMEAAction,
    FMEAType, FMEAStatus, ActionStatus, User
)
from schemas import (
    FMEACreate, FMEAUpdate, FMEAOut,
    FMEAItemCreate, FMEAItemUpdate, FMEAItemOut,
    FMEATeamMemberCreate, FMEAActionCreate, FMEAActionUpdate, FMEAActionOut,
    FMEADashboardSummary
)

# Bring in your existing auth dependency(s)
# - get_current_user: returns the logged-in User object or similar
# - require_roles: optional role guard (Reader/Editor/Reviewer/Admin/Super Admin)
try:
    from auth import get_current_user, require_roles  # type: ignore
except Exception:
    # Fallback stubs if importing in isolation.
    def get_current_user():
        raise HTTPException(status_code=500, detail="auth.get_current_user not wired")

    def require_roles(*_roles):
        def _inner(user=Depends(get_current_user)):
            return user
        return _inner

router = APIRouter(prefix="/fmea", tags=["Failure Mode Error Analysis"])


# ===== Schemas =====


class FMEATeamUser(BaseModel):
    id: int
    full_name: str
    department: Optional[str] = None
    position: Optional[str] = None


# ===== Utils =====
def _csv_join(values: Optional[list[str]]) -> Optional[str]:
    if values is None:
        return None
    return ",".join([v.strip() for v in values if v.strip()])


def _csv_split(value: Optional[str]) -> Optional[list[str]]:
    if not value:
        return None
    return [v.strip() for v in value.split(",") if v.strip()]


def _calc_rpn(sev: int, occ: int, det: int) -> int:
    return int(sev) * int(occ) * int(det)


def _refresh_fmea_aggregates(db: Session, fmea: FMEA) -> None:
    # Highest RPN
    highest_rpn = db.query(func.max(FMEAItem.rpn)).filter(FMEAItem.fmea_id == fmea.id).scalar() or 0
    fmea.highest_rpn = highest_rpn
    # Actions count
    actions_count = db.query(func.count(FMEAAction.id)).filter(FMEAAction.fmea_id == fmea.id).scalar() or 0
    fmea.actions_count = int(actions_count)
    db.add(fmea)
    db.flush()


# ===== Reference Data =====


@router.get("/team-options", response_model=list[FMEATeamUser])
def list_team_options(
    db: Session = Depends(get_db),
    _=Depends(require_roles("Reader", "Editor", "Reviewer", "Admin", "Super Admin")),
) -> list[FMEATeamUser]:
    users = (
        db.query(User)
        .filter(User.is_active.is_(True))
        .order_by(User.first_name.asc(), User.last_name.asc())
        .all()
    )
    return [
        FMEATeamUser(
            id=user.id,
            full_name=f"{user.first_name} {user.last_name}",
            department=(user.user_department.name if user.user_department else None),
            position=user.position,
        )
        for user in users
    ]


# ===== FMEA CRUD =====
@router.post("", response_model=FMEAOut, status_code=status.HTTP_201_CREATED)
def create_fmea(payload: FMEACreate,
                db: Session = Depends(get_db),
                user=Depends(require_roles("Editor", "Reviewer", "Admin", "Super Admin"))):
    fmea = FMEA(
        title=payload.title,
        fmea_type=payload.fmea_type,
        process_or_product_name=payload.process_or_product_name,
        description=payload.description,
        departments_csv=_csv_join(payload.departments),
        team_lead_id=payload.team_lead_id,
        review_date=payload.review_date,
        standard=payload.standard,
        scope=payload.scope,
        assumptions=payload.assumptions,
        severity_min=payload.severity_min,
        severity_max=payload.severity_max,
        occurrence_min=payload.occurrence_min,
        occurrence_max=payload.occurrence_max,
        detection_min=payload.detection_min,
        detection_max=payload.detection_max,
        created_by_id=user.id
    )
    db.add(fmea)
    db.flush()

    # Team members
    for tm in payload.team_members:
        db.add(FMEATeamMember(fmea_id=fmea.id, user_id=tm.user_id, role=tm.role))

    db.commit()
    db.refresh(fmea)

    # Build response with members expanded
    out = FMEAOut(
        **{
            "id": fmea.id,
            "title": fmea.title,
            "fmea_type": fmea.fmea_type,
            "process_or_product_name": fmea.process_or_product_name,
            "description": fmea.description,
            "departments": _csv_split(fmea.departments_csv),
            "team_lead_id": fmea.team_lead_id,
            "review_date": fmea.review_date,
            "standard": fmea.standard,
            "scope": fmea.scope,
            "assumptions": fmea.assumptions,
            "severity_min": fmea.severity_min,
            "severity_max": fmea.severity_max,
            "occurrence_min": fmea.occurrence_min,
            "occurrence_max": fmea.occurrence_max,
            "detection_min": fmea.detection_min,
            "detection_max": fmea.detection_max,
            "status": fmea.status,
            "highest_rpn": fmea.highest_rpn,
            "actions_count": fmea.actions_count,
            "created_by_id": fmea.created_by_id,
            "created_at": fmea.created_at,
            "updated_at": fmea.updated_at,
            "team_members": [{"id": tm.id, "user_id": tm.user_id, "role": tm.role} for tm in fmea.team_members],
        }
    )
    return out


@router.get("", response_model=list[FMEAOut])
def list_fmeas(db: Session = Depends(get_db),
               _=Depends(require_roles("Reader", "Editor", "Reviewer", "Admin", "Super Admin")),
               q: Optional[str] = Query(None),
               fmea_type: Optional[FMEAType] = Query(None),
               status_: Optional[FMEAStatus] = Query(None),
               skip: int = 0, limit: int = 50):
    qry = db.query(FMEA)

    if q:
        q_like = f"%{q}%"
        qry = qry.filter(or_(
            FMEA.title.ilike(q_like),
            FMEA.process_or_product_name.ilike(q_like),
            FMEA.description.ilike(q_like),
            FMEA.scope.ilike(q_like),
            FMEA.assumptions.ilike(q_like),
        ))
    if fmea_type:
        qry = qry.filter(FMEA.fmea_type == fmea_type)
    if status_:
        qry = qry.filter(FMEA.status == status_)

    fmeas = qry.order_by(FMEA.updated_at.desc()).offset(skip).limit(limit).all()
    out = []
    for f in fmeas:
        out.append(FMEAOut(
            **{
                "id": f.id,
                "title": f.title,
                "fmea_type": f.fmea_type,
                "process_or_product_name": f.process_or_product_name,
                "description": f.description,
                "departments": _csv_split(f.departments_csv),
                "team_lead_id": f.team_lead_id,
                "review_date": f.review_date,
                "standard": f.standard,
                "scope": f.scope,
                "assumptions": f.assumptions,
                "severity_min": f.severity_min, "severity_max": f.severity_max,
                "occurrence_min": f.occurrence_min, "occurrence_max": f.occurrence_max,
                "detection_min": f.detection_min, "detection_max": f.detection_max,
                "status": f.status,
                "highest_rpn": f.highest_rpn,
                "actions_count": f.actions_count,
                "created_by_id": f.created_by_id,
                "created_at": f.created_at,
                "updated_at": f.updated_at,
                "team_members": [{"id": tm.id, "user_id": tm.user_id, "role": tm.role} for tm in f.team_members],
            }
        ))
    return out


@router.get("/{fmea_id}", response_model=FMEAOut)
def get_fmea(fmea_id: int,
             db: Session = Depends(get_db),
             _=Depends(require_roles("Reader", "Editor", "Reviewer", "Admin", "Super Admin"))):
    fmea = db.query(FMEA).filter_by(id=fmea_id).first()
    if not fmea:
        raise HTTPException(status_code=404, detail="FMEA not found")

    return FMEAOut(
        **{
            "id": fmea.id,
            "title": fmea.title,
            "fmea_type": fmea.fmea_type,
            "process_or_product_name": fmea.process_or_product_name,
            "description": fmea.description,
            "departments": _csv_split(fmea.departments_csv),
            "team_lead_id": fmea.team_lead_id,
            "review_date": fmea.review_date,
            "standard": fmea.standard,
            "scope": fmea.scope,
            "assumptions": fmea.assumptions,
            "severity_min": fmea.severity_min, "severity_max": fmea.severity_max,
            "occurrence_min": fmea.occurrence_min, "occurrence_max": fmea.occurrence_max,
            "detection_min": fmea.detection_min, "detection_max": fmea.detection_max,
            "status": fmea.status,
            "highest_rpn": fmea.highest_rpn,
            "actions_count": fmea.actions_count,
            "created_by_id": fmea.created_by_id,
            "created_at": fmea.created_at,
            "updated_at": fmea.updated_at,
            "team_members": [{"id": tm.id, "user_id": tm.user_id, "role": tm.role} for tm in fmea.team_members],
        }
    )


@router.patch("/{fmea_id}", response_model=FMEAOut)
def update_fmea(fmea_id: int,
                payload: FMEAUpdate,
                db: Session = Depends(get_db),
                _=Depends(require_roles("Editor", "Reviewer", "Admin", "Super Admin"))):
    fmea = db.query(FMEA).filter_by(id=fmea_id).first()
    if not fmea:
        raise HTTPException(status_code=404, detail="FMEA not found")

    for field, value in payload.dict(exclude_unset=True).items():
        if field == "departments":
            fmea.departments_csv = _csv_join(value)
        else:
            setattr(fmea, field, value)

    db.add(fmea)
    db.commit()
    db.refresh(fmea)

    return get_fmea(fmea.id, db)


@router.delete("/{fmea_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fmea(fmea_id: int,
                db: Session = Depends(get_db),
                _=Depends(require_roles("Admin", "Super Admin"))):
    fmea = db.query(FMEA).filter_by(id=fmea_id).first()
    if not fmea:
        raise HTTPException(status_code=404, detail="FMEA not found")
    db.delete(fmea)
    db.commit()
    return


# ===== Worksheet Items =====
@router.get("/{fmea_id}/items", response_model=list[FMEAItemOut])
def list_items(fmea_id: int,
               db: Session = Depends(get_db),
               _=Depends(require_roles("Reader", "Editor", "Reviewer", "Admin", "Super Admin")),
               min_rpn: Optional[int] = Query(None),
               max_rpn: Optional[int] = Query(None),
               status_: Optional[str] = Query(None)):
    fmea = db.query(FMEA).filter_by(id=fmea_id).first()
    if not fmea:
        raise HTTPException(status_code=404, detail="FMEA not found")

    qry = db.query(FMEAItem).filter(FMEAItem.fmea_id == fmea_id)
    if min_rpn is not None:
        qry = qry.filter(FMEAItem.rpn >= min_rpn)
    if max_rpn is not None:
        qry = qry.filter(FMEAItem.rpn <= max_rpn)
    if status_:
        qry = qry.filter(FMEAItem.status == status_)

    items = qry.order_by(FMEAItem.rpn.desc(), FMEAItem.updated_at.desc()).all()
    return items


@router.post("/{fmea_id}/items", response_model=FMEAItemOut, status_code=status.HTTP_201_CREATED)
def add_item(fmea_id: int,
             payload: FMEAItemCreate,
             db: Session = Depends(get_db),
             _=Depends(require_roles("Editor", "Reviewer", "Admin", "Super Admin"))):
    fmea = db.query(FMEA).filter_by(id=fmea_id).first()
    if not fmea:
        raise HTTPException(status_code=404, detail="FMEA not found")

    # bounds check vs scales
    for val, low, high, name in [
        (payload.severity, fmea.severity_min, fmea.severity_max, "severity"),
        (payload.occurrence, fmea.occurrence_min, fmea.occurrence_max, "occurrence"),
        (payload.detection, fmea.detection_min, fmea.detection_max, "detection"),
    ]:
        if not (low <= val <= high):
            raise HTTPException(status_code=400, detail=f"{name} must be in range {low}-{high}")

    item = FMEAItem(
        fmea_id=fmea.id,
        item_function=payload.item_function,
        failure_mode=payload.failure_mode,
        effects=payload.effects,
        severity=payload.severity,
        causes=payload.causes,
        occurrence=payload.occurrence,
        current_controls=payload.current_controls,
        detection=payload.detection,
        rpn=_calc_rpn(payload.severity, payload.occurrence, payload.detection),
        recommended_actions=payload.recommended_actions,
        responsibility_user_id=payload.responsibility_user_id,
        target_date=payload.target_date,
        actions_taken=payload.actions_taken,
        status=payload.status or "Open",
        new_severity=payload.new_severity,
        new_occurrence=payload.new_occurrence,
        new_detection=payload.new_detection,
    )
    if item.new_severity and item.new_occurrence and item.new_detection:
        item.new_rpn = _calc_rpn(item.new_severity, item.new_occurrence, item.new_detection)

    db.add(item)
    db.flush()
    _refresh_fmea_aggregates(db, fmea)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{fmea_id}/items/{item_id}", response_model=FMEAItemOut)
def update_item(fmea_id: int, item_id: int,
                payload: FMEAItemUpdate,
                db: Session = Depends(get_db),
                _=Depends(require_roles("Editor", "Reviewer", "Admin", "Super Admin"))):
    fmea = db.query(FMEA).filter_by(id=fmea_id).first()
    if not fmea:
        raise HTTPException(status_code=404, detail="FMEA not found")

    item = db.query(FMEAItem).filter_by(id=item_id, fmea_id=fmea_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    data = payload.dict(exclude_unset=True)
    # assign basics
    for k, v in data.items():
        if k in {"severity", "occurrence", "detection"} and v is not None:
            # bounds check
            low = getattr(fmea, f"{k}_min")
            high = getattr(fmea, f"{k}_max")
            if not (low <= v <= high):
                raise HTTPException(status_code=400, detail=f"{k} must be in range {low}-{high}")
        setattr(item, k, v)

    # recalc RPN
    item.rpn = _calc_rpn(item.severity, item.occurrence, item.detection)
    # recalc new_rpn if post-mitigation numbers exist
    if item.new_severity and item.new_occurrence and item.new_detection:
        item.new_rpn = _calc_rpn(item.new_severity, item.new_occurrence, item.new_detection)
    else:
        item.new_rpn = None

    db.add(item)
    db.flush()
    _refresh_fmea_aggregates(db, fmea)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{fmea_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(fmea_id: int, item_id: int,
                db: Session = Depends(get_db),
                _=Depends(require_roles("Editor", "Reviewer", "Admin", "Super Admin"))):
    fmea = db.query(FMEA).filter_by(id=fmea_id).first()
    if not fmea:
        raise HTTPException(status_code=404, detail="FMEA not found")

    item = db.query(FMEAItem).filter_by(id=item_id, fmea_id=fmea_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.flush()
    _refresh_fmea_aggregates(db, fmea)
    db.commit()
    return


# ===== Actions =====
@router.get("/{fmea_id}/actions", response_model=list[FMEAActionOut])
def list_actions(fmea_id: int,
                 db: Session = Depends(get_db),
                 _=Depends(require_roles("Reader", "Editor", "Reviewer", "Admin", "Super Admin")),
                 status_: Optional[ActionStatus] = Query(None)):
    fmea = db.query(FMEA).filter_by(id=fmea_id).first()
    if not fmea:
        raise HTTPException(status_code=404, detail="FMEA not found")

    qry = db.query(FMEAAction).filter(FMEAAction.fmea_id == fmea_id)
    if status_:
        qry = qry.filter(FMEAAction.status == status_)
    actions = qry.order_by(FMEAAction.updated_at.desc()).all()
    return actions


@router.post("/{fmea_id}/actions", response_model=FMEAActionOut, status_code=status.HTTP_201_CREATED)
def add_action(fmea_id: int,
               payload: FMEAActionCreate,
               db: Session = Depends(get_db),
               _=Depends(require_roles("Editor", "Reviewer", "Admin", "Super Admin"))):
    fmea = db.query(FMEA).filter_by(id=fmea_id).first()
    if not fmea:
        raise HTTPException(status_code=404, detail="FMEA not found")

    if payload.item_id:
        item = db.query(FMEAItem).filter_by(id=payload.item_id, fmea_id=fmea_id).first()
        if not item:
            raise HTTPException(status_code=400, detail="item_id does not belong to this FMEA")

    action = FMEAAction(
        fmea_id=fmea_id,
        item_id=payload.item_id,
        title=payload.title,
        description=payload.description,
        owner_user_id=payload.owner_user_id,
        status=payload.status,
        due_date=payload.due_date
    )
    db.add(action)
    db.flush()
    _refresh_fmea_aggregates(db, fmea)
    db.commit()
    db.refresh(action)
    return action


@router.patch("/{fmea_id}/actions/{action_id}", response_model=FMEAActionOut)
def update_action(fmea_id: int, action_id: int,
                  payload: FMEAActionUpdate,
                  db: Session = Depends(get_db),
                  _=Depends(require_roles("Editor", "Reviewer", "Admin", "Super Admin"))):
    fmea = db.query(FMEA).filter_by(id=fmea_id).first()
    if not fmea:
        raise HTTPException(status_code=404, detail="FMEA not found")

    action = db.query(FMEAAction).filter_by(id=action_id, fmea_id=fmea_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    for k, v in payload.dict(exclude_unset=True).items():
        setattr(action, k, v)

    # set overdue automatically if due_date passed and not completed
    if action.status != ActionStatus.COMPLETED and action.due_date and action.due_date < date.today():
        action.status = ActionStatus.OVERDUE

    db.add(action)
    db.flush()
    _refresh_fmea_aggregates(db, fmea)
    db.commit()
    db.refresh(action)
    return action


@router.delete("/{fmea_id}/actions/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_action(fmea_id: int, action_id: int,
                  db: Session = Depends(get_db),
                  _=Depends(require_roles("Editor", "Reviewer", "Admin", "Super Admin"))):
    fmea = db.query(FMEA).filter_by(id=fmea_id).first()
    if not fmea:
        raise HTTPException(status_code=404, detail="FMEA not found")

    action = db.query(FMEAAction).filter_by(id=action_id, fmea_id=fmea_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    db.delete(action)
    db.flush()
    _refresh_fmea_aggregates(db, fmea)
    db.commit()
    return


# ===== Dashboard / Summary =====
@router.get("/dashboard/summary", response_model=FMEADashboardSummary)
def fmea_dashboard_summary(db: Session = Depends(get_db),
                           _=Depends(require_roles("Reader", "Editor", "Reviewer", "Admin", "Super Admin")),
                           high_rpn_threshold: int = 200):
    total_fmeas = db.query(func.count(FMEA.id)).scalar() or 0
    high_rpn_items = db.query(func.count(FMEAItem.id)).filter(FMEAItem.rpn >= high_rpn_threshold).scalar() or 0
    completed_actions = db.query(func.count(FMEAAction.id)).filter(FMEAAction.status == ActionStatus.COMPLETED).scalar() or 0
    overdue_actions = db.query(func.count(FMEAAction.id)).filter(FMEAAction.status == ActionStatus.OVERDUE).scalar() or 0

    return FMEADashboardSummary(
        total_fmeas=total_fmeas,
        high_rpn_items=high_rpn_items,
        completed_actions=completed_actions,
        overdue_actions=overdue_actions
    )


@router.get("/{fmea_id}/summary", response_model=FMEADashboardSummary)
def fmea_one_summary(fmea_id: int,
                     db: Session = Depends(get_db),
                     _=Depends(require_roles("Reader", "Editor", "Reviewer", "Admin", "Super Admin")),
                     high_rpn_threshold: int = 200):
    fmea = db.query(FMEA).filter_by(id=fmea_id).first()
    if not fmea:
        raise HTTPException(status_code=404, detail="FMEA not found")

    high_rpn_items = db.query(func.count(FMEAItem.id)).filter(
        FMEAItem.fmea_id == fmea_id, FMEAItem.rpn >= high_rpn_threshold
    ).scalar() or 0
    completed_actions = db.query(func.count(FMEAAction.id)).filter(
        FMEAAction.fmea_id == fmea_id, FMEAAction.status == ActionStatus.COMPLETED
    ).scalar() or 0
    overdue_actions = db.query(func.count(FMEAAction.id)).filter(
        FMEAAction.fmea_id == fmea_id, FMEAAction.status == ActionStatus.OVERDUE
    ).scalar() or 0

    return FMEADashboardSummary(
        total_fmeas=1,
        high_rpn_items=high_rpn_items,
        completed_actions=completed_actions,
        overdue_actions=overdue_actions
    )
