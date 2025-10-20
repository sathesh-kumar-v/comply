# calendar_api.py  — unified router for Calendar + Project Timeline
from __future__ import annotations

from typing import List, Optional, Literal
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import (
    CalendarEvent, EventAttendee, EventReminder,
    EventStatusEnum, PriorityEnum, EventTypeEnum,
    Project, ProjectTask, TaskDependency,
    User, ReminderMethodEnum
)

# If you later want auth, import and use get_current_user
# from auth import get_current_user

# This router mounts exactly where your frontend is calling:
#   http://localhost:8000/api/calendar/...
router = APIRouter(prefix="/api/calendar", tags=["calendar"])

# -----------------------
# Helpers
# -----------------------
def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_aware(dt: Optional[datetime]) -> Optional[datetime]:
    """Return a timezone-aware datetime, assuming UTC if tzinfo is missing."""
    if dt is None:
        return None
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def _parse_iso(dt: str) -> datetime:
    # Robustly handle trailing Z and offsets
    if dt.endswith("Z"):
        dt = dt[:-1] + "+00:00"
    return datetime.fromisoformat(dt)

def _coerce_enum(name: str, value: str):
    mapping = {
        "type": EventTypeEnum,
        "priority": PriorityEnum,
        "status": EventStatusEnum,
        "reminder_method": ReminderMethodEnum,
    }
    enum_cls = mapping[name]
    try:
        return enum_cls(value)
    except Exception:
        try:
            return enum_cls[value]
        except Exception:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid {name}: {value}. Allowed: {[e.value for e in enum_cls]}",
            )

# Optional recurrence expansion
from dateutil.rrule import rrulestr
from dateutil.tz import gettz

# -----------------------
# Pydantic: payloads from EventSheet (frontend)
# -----------------------
class AttendeeIn(BaseModel):
    email: Optional[str] = None
    user_id: Optional[int] = None
    required: bool = True

class ReminderIn(BaseModel):
    minutes_before: int
    method: str = "Email"
    custom_message: Optional[str] = None

class EventUpsertIn(BaseModel):
    id: Optional[str] = None
    title: str
    type: str
    description: Optional[str] = ""
    location: Optional[str] = ""
    department_ids: Optional[List[int]] = []
    priority: str
    status: str
    all_day: bool
    start_at: str
    end_at: str
    tz: Optional[str] = "UTC"
    attendees: Optional[List[AttendeeIn]] = []
    reminders: Optional[List[ReminderIn]] = []

# -----------------------
# Events
# -----------------------
@router.get("/events")
def list_events(
    db: Session = Depends(get_db),
    # If you wire auth later: current_user: User = Depends(get_current_user),
    start: Optional[datetime] = Query(None, description="Filter: start range (inclusive)"),
    end: Optional[datetime] = Query(None, description="Filter: end range (exclusive)"),
    types: Optional[List[EventTypeEnum]] = Query(None),
    departments: Optional[List[int]] = Query(None),
    priority: Optional[List[PriorityEnum]] = Query(None),
    status_filter: Optional[Literal["All", "Upcoming", "In Progress", "Completed", "Overdue"]] = "All",
    mine: bool = False,
    expand_recurrence: bool = False,
):
    q = db.query(CalendarEvent)

    # If/when you add auth: filter organizer_id == current_user.id when mine=True
    if types:
        q = q.filter(CalendarEvent.type.in_(types))
    if priority:
        q = q.filter(CalendarEvent.priority.in_(priority))
    if start:
        q = q.filter(CalendarEvent.end_at >= start)
    if end:
        q = q.filter(CalendarEvent.start_at < end)

    events = q.order_by(CalendarEvent.start_at.asc()).all()

    # filter by departments (python-side; department_ids is JSON list)
    if departments:
        events = [e for e in events if e.department_ids and any(d in e.department_ids for d in departments)]

    # status bucketing
    now = _now_utc()

    def _in_status(e: CalendarEvent) -> bool:
        start_at = _ensure_aware(e.start_at)
        end_at = _ensure_aware(e.end_at)
        if status_filter == "All":
            return True
        if status_filter == "Upcoming":
            return bool(start_at and start_at > now and e.status != EventStatusEnum.CANCELLED)
        if status_filter == "In Progress":
            return bool(
                start_at
                and end_at
                and start_at <= now <= end_at
                and e.status not in (EventStatusEnum.CANCELLED, EventStatusEnum.COMPLETED)
            )
        if status_filter == "Completed":
            return e.status == EventStatusEnum.COMPLETED
        if status_filter == "Overdue":
            return bool(end_at and end_at < now and e.status not in (EventStatusEnum.CANCELLED, EventStatusEnum.COMPLETED))
        return True

    events = [e for e in events if _in_status(e)]

    # Optional: expand recurrences
    if expand_recurrence and (start or end):
        expanded: List[CalendarEvent] = []
        for e in events:
            if e.rrule:
                tz = gettz(e.tz) or gettz("UTC")
                base = e.start_at.astimezone(tz)
                rule = rrulestr(e.rrule, dtstart=base)
                range_start = (start or e.start_at).astimezone(tz)
                range_end = (end or e.end_at).astimezone(tz)
                for dt in rule.between(range_start, range_end, inc=True):
                    inst = CalendarEvent(
                        id=e.id,
                        title=e.title, type=e.type, description=e.description,
                        location=e.location, virtual_meeting_link=e.virtual_meeting_link,
                        department_ids=e.department_ids, equipment=e.equipment,
                        meeting_room=e.meeting_room, catering_required=e.catering_required,
                        priority=e.priority, status=e.status, all_day=e.all_day, tz=e.tz,
                        start_at=dt.astimezone(timezone.utc),
                        end_at=(dt + (e.end_at - e.start_at)).astimezone(timezone.utc),
                        rrule=e.rrule, send_invitations=e.send_invitations, organizer_id=e.organizer_id,
                        created_at=e.created_at, updated_at=e.updated_at, cancelled_at=e.cancelled_at
                    )
                    inst.attendees = e.attendees
                    inst.reminders = e.reminders
                    expanded.append(inst)
            else:
                expanded.append(e)
        events = expanded

    # Return a plain list (not {"items": [...]}) to match most clients
    def _to_dict(ev: CalendarEvent):
        return {
            "id": ev.id,
            "title": ev.title,
            "type": ev.type.value,
            "description": ev.description or "",
            "location": ev.location or "",
            "department_ids": ev.department_ids or [],
            "priority": ev.priority.value,
            "status": ev.status.value,
            "all_day": bool(ev.all_day),
            "start_at": ev.start_at.isoformat() if ev.start_at else None,
            "end_at": ev.end_at.isoformat() if ev.end_at else None,
            "time_zone": ev.tz,
            "attendees_required": [a.email for a in ev.attendees if a.required and a.email],
            "attendees_optional": [a.email for a in ev.attendees if not a.required and a.email],
            "reminders": [
                # EventSheet likes minutes array, but keep objects compatible too
                {"minutes_before": r.minutes_before, "method": r.method.value, "custom_message": r.custom_message}
                for r in ev.reminders
            ],
        }

    return [_to_dict(e) for e in events]

@router.post("/events", status_code=status.HTTP_201_CREATED)
def create_event(payload: EventUpsertIn, db: Session = Depends(get_db)):
    # If you add auth later, use the authenticated user; for bootstrap pick first user
    organizer = db.query(User).first()
    if organizer is None:
        raise HTTPException(400, "No users found. Run init_db to seed a user first.")

    start_dt = _parse_iso(payload.start_at)
    end_dt = _parse_iso(payload.end_at)
    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail="end_at must be after start_at")

    ev = CalendarEvent(
        title=payload.title.strip(),
        description=(payload.description or "").strip(),
        location=(payload.location or "").strip(),
        type=_coerce_enum("type", payload.type),
        priority=_coerce_enum("priority", payload.priority),
        status=_coerce_enum("status", payload.status),
        all_day=bool(payload.all_day),
        tz=payload.tz or "UTC",
        start_at=start_dt,
        end_at=end_dt,
        # legacy naive columns for compatibility (if present in your model)
        start=start_dt.replace(tzinfo=None),
        end=end_dt.replace(tzinfo=None),
        organizer_id=organizer.id,
        department_ids=payload.department_ids or [],
    )
    db.add(ev)
    db.flush()

    for a in (payload.attendees or []):
        db.add(EventAttendee(
            event_id=ev.id,
            user_id=a.user_id,
            email=a.email,
            required=bool(a.required),
        ))

    for r in (payload.reminders or []):
        db.add(EventReminder(
            event_id=ev.id,
            minutes_before=int(r.minutes_before),
            method=_coerce_enum("reminder_method", r.method),
            custom_message=r.custom_message,
        ))

    db.commit()
    return {"ok": True, "id": ev.id}

@router.put("/events/{event_id}")
def update_event(event_id: str, payload: EventUpsertIn, db: Session = Depends(get_db)):
    ev = db.query(CalendarEvent).get(int(event_id))
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    start_dt = _parse_iso(payload.start_at)
    end_dt = _parse_iso(payload.end_at)
    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail="end_at must be after start_at")

    ev.title = payload.title.strip()
    ev.description = (payload.description or "").strip()
    ev.location = (payload.location or "").strip()
    ev.type = _coerce_enum("type", payload.type)
    ev.priority = _coerce_enum("priority", payload.priority)
    ev.status = _coerce_enum("status", payload.status)
    ev.all_day = bool(payload.all_day)
    ev.tz = payload.tz or "UTC"
    ev.start_at = start_dt
    ev.end_at = end_dt
    ev.start = start_dt.replace(tzinfo=None)
    ev.end = end_dt.replace(tzinfo=None)
    ev.department_ids = payload.department_ids or []

    # Replace attendees & reminders
    ev.attendees.clear()
    ev.reminders.clear()
    db.flush()

    for a in (payload.attendees or []):
        db.add(EventAttendee(
            event_id=ev.id,
            user_id=a.user_id,
            email=a.email,
            required=bool(a.required),
        ))
    for r in (payload.reminders or []):
        db.add(EventReminder(
            event_id=ev.id,
            minutes_before=int(r.minutes_before),
            method=_coerce_enum("reminder_method", r.method),
            custom_message=r.custom_message,
        ))

    db.commit()
    return {"ok": True, "id": ev.id}

@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: str, db: Session = Depends(get_db)):
    ev = db.query(CalendarEvent).get(int(event_id))
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(ev)
    db.commit()
    return

# -----------------------
# Stats for right-hand panel
# -----------------------
@router.get("/stats")
def calendar_stats(db: Session = Depends(get_db), mine: bool = False):
    q = db.query(CalendarEvent)
    # If/when you add auth + mine: filter by organizer_id
    events = q.all()
    now = _now_utc()
    def _iter_start_end():
        for event in events:
            yield event, _ensure_aware(event.start_at), _ensure_aware(event.end_at)

    upcoming = sum(
        1
        for event, start_at, _ in _iter_start_end()
        if start_at and start_at > now and event.status != EventStatusEnum.CANCELLED
    )
    in_progress = sum(
        1
        for event, start_at, end_at in _iter_start_end()
        if (
            start_at
            and end_at
            and start_at <= now <= end_at
            and event.status not in (EventStatusEnum.CANCELLED, EventStatusEnum.COMPLETED)
        )
    )
    completed = sum(1 for e in events if e.status == EventStatusEnum.COMPLETED)
    overdue = sum(
        1
        for event, _, end_at in _iter_start_end()
        if end_at and end_at < now and event.status not in (EventStatusEnum.CANCELLED, EventStatusEnum.COMPLETED)
    )

    def _bucket(items, key):
        d = {}
        for it in items:
            k = getattr(it, key)
            label = k.value if hasattr(k, "value") else str(k)
            d[str(label)] = d.get(str(label), 0) + 1
        return d

    return {
        "total": len(events),
        "upcoming": upcoming,
        "in_progress": in_progress,
        "completed": completed,
        "overdue": overdue,
        "by_type": _bucket(events, "type"),
        "by_priority": _bucket(events, "priority"),
    }

# -----------------------
# (Optional) Project/Tasks (kept if your UI uses them)
# -----------------------
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    manager_id: int
    start_date: datetime
    end_date: datetime
    status: Optional[str] = "Planning"

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    manager_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None

class TaskCreate(BaseModel):
    name: str
    description: Optional[str] = None
    assigned_to_id: Optional[int] = None
    start_date: datetime
    end_date: datetime
    duration_hours: Optional[float] = None
    progress: Optional[float] = 0.0
    priority: Optional[str] = "Medium"
    dependencies: Optional[List[dict]] = None  # [{"predecessor_id": int}]

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    assigned_to_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    duration_hours: Optional[float] = None
    progress: Optional[float] = None
    priority: Optional[str] = None

@router.post("/projects", status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    if payload.end_date <= payload.start_date:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    prj = Project(
        name=payload.name,
        description=payload.description,
        manager_id=payload.manager_id,
        status=payload.status or "Planning",
        start_date=payload.start_date,
        end_date=payload.end_date
    )
    db.add(prj)
    db.commit()
    db.refresh(prj)
    return prj

@router.get("/projects")
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.start_date.asc()).all()

@router.get("/projects/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db)):
    prj = db.query(Project).filter_by(id=project_id).first()
    if not prj:
        raise HTTPException(status_code=404, detail="Project not found")
    return prj

@router.put("/projects/{project_id}")
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    prj = db.query(Project).filter_by(id=project_id).first()
    if not prj:
        raise HTTPException(status_code=404, detail="Project not found")

    data = payload.dict(exclude_unset=True)
    for field in ["name", "description", "manager_id", "start_date", "end_date", "status"]:
        if field in data:
            setattr(prj, field, data[field])

    if prj.end_date and prj.start_date and prj.end_date <= prj.start_date:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    db.commit()
    db.refresh(prj)
    return prj

@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    prj = db.query(Project).filter_by(id=project_id).first()
    if not prj:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(prj)
    db.commit()
    return

@router.post("/projects/{project_id}/tasks", status_code=201)
def create_task(project_id: int, payload: TaskCreate, db: Session = Depends(get_db)):
    prj = db.query(Project).filter_by(id=project_id).first()
    if not prj:
        raise HTTPException(status_code=404, detail="Project not found")
    if payload.end_date <= payload.start_date:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    task = ProjectTask(
        project_id=project_id,
        name=payload.name,
        description=payload.description,
        assigned_to_id=payload.assigned_to_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        duration_hours=payload.duration_hours,
        progress=payload.progress or 0.0,
        priority=(payload.priority or "Medium"),
    )
    db.add(task)
    db.flush()

    if payload.dependencies:
        for dep in payload.dependencies:
            pred_id = dep.get("predecessor_id")
            if pred_id:
                db.add(TaskDependency(predecessor_id=pred_id, successor_id=task.id))

    db.commit()
    db.refresh(task)
    return task

@router.get("/projects/{project_id}/tasks")
def list_tasks(project_id: int, db: Session = Depends(get_db)):
    prj = db.query(Project).filter_by(id=project_id).first()
    if not prj:
        raise HTTPException(status_code=404, detail="Project not found")
    return db.query(ProjectTask).filter_by(project_id=project_id).order_by(ProjectTask.start_date.asc()).all()

@router.put("/projects/{project_id}/tasks/{task_id}")
def update_task(project_id: int, task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(ProjectTask).filter_by(id=task_id, project_id=project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    data = payload.dict(exclude_unset=True)
    for field in ["name","description","assigned_to_id","start_date","end_date","duration_hours","progress","priority"]:
        if field in data:
            setattr(task, field, data[field])

    if task.end_date and task.start_date and task.end_date <= task.start_date:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    db.commit()
    db.refresh(task)
    return task

@router.delete("/projects/{project_id}/tasks/{task_id}", status_code=204)
def delete_task(project_id: int, task_id: int, db: Session = Depends(get_db)):
    task = db.query(ProjectTask).filter_by(id=task_id, project_id=project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return
