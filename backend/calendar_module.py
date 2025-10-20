from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional, Literal
from datetime import datetime, timezone

from database import get_db
from auth import get_current_user  # returns models.User
from models import (
    CalendarEvent, EventAttendee, EventReminder,
    EventStatusEnum, PriorityEnum, EventTypeEnum,
    Project, ProjectTask, TaskDependency,
    User, UserRole, ReminderMethodEnum
)
from schemas import (
    EventCreate, EventUpdate, EventOut, CalendarStats,
    ProjectCreate, ProjectUpdate, ProjectOut,
    TaskCreate, TaskUpdate, TaskOut
)

# Optional recurrence expansion:
from dateutil.rrule import rrulestr
from dateutil.tz import gettz

router = APIRouter(prefix="/calendar", tags=["calendar"])

# -----------------------
# Helper / Permissions
# -----------------------
def _can_manage_calendar(user: User) -> bool:
    # Adjust to your RBAC needs: Admin / Super Admin can manage,
    # Editors/Reviewers can create within their departments, etc.
    # return getattr(user, "role", None) in {UserRole.ADMIN, UserRole.SUPER_ADMIN}
    allowed_roles = {UserRole.ADMIN}
    super_admin = getattr(UserRole, "SUPER_ADMIN", None)
    if super_admin is not None:
        allowed_roles.add(super_admin)
    return getattr(user, "role", None) in allowed_roles

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)

def _parse_iso(dt: str) -> datetime:
    # Handle ...Z and offsets; robust without extra deps
    if dt.endswith("Z"):
        dt = dt.replace("Z", "+00:00")
    return datetime.fromisoformat(dt)

# -----------------------
# Events
# -----------------------
@router.post("/events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not _can_manage_calendar(current_user):
        # Organizer can still create events they own; relax if needed
        pass

    if payload.end_at <= payload.start_at:
        raise HTTPException(status_code=400, detail="end_at must be after start_at")

    event = CalendarEvent(
        title=payload.title,
        type=EventTypeEnum(payload.type.value),
        description=payload.description,
        location=payload.location,
        virtual_meeting_link=str(payload.virtual_meeting_link) if payload.virtual_meeting_link else None,
        department_ids=payload.department_ids,
        equipment=payload.equipment,
        meeting_room=payload.meeting_room,
        catering_required=payload.catering_required,
        priority=PriorityEnum(payload.priority.value),
        status=EventStatusEnum(payload.status.value),
        all_day=payload.all_day,
        tz=payload.tz,
        start_at=payload.start_at,
        end_at=payload.end_at,
        rrule=payload.rrule,
        send_invitations=payload.send_invitations,
        organizer_id=current_user.id
    )
    db.add(event)
    db.flush()

    # Attendees
    if payload.attendees:
        for a in payload.attendees:
            if not a.user_id and not a.email:
                raise HTTPException(status_code=400, detail="Each attendee must have user_id or email")
            db.add(EventAttendee(
                event_id=event.id,
                user_id=a.user_id,
                email=a.email,
                required=a.required
            ))

    # Reminders
    if payload.reminders:
        for r in payload.reminders:
            if isinstance(r, int):
                minutes_before = r
                method_enum = ReminderMethodEnum.EMAIL
                custom_message = None
            elif isinstance(r, dict):
                if "minutes_before" not in r or "method" not in r:
                    raise HTTPException(status_code=422, detail="Invalid reminder format")
                try:
                    method_enum = ReminderMethodEnum(r["method"])
                except ValueError:
                    raise HTTPException(status_code=422, detail="Invalid reminder format")
                minutes_before = r["minutes_before"]
                custom_message = r.get("custom_message")
            elif hasattr(r, "minutes_before") and hasattr(r, "method"):
                try:
                    method_enum = ReminderMethodEnum(r.method.value)
                except ValueError:
                    raise HTTPException(status_code=422, detail="Invalid reminder format")
                minutes_before = r.minutes_before
                # method = r.method.value
                custom_message = r.custom_message
            else:
                raise HTTPException(status_code=422, detail="Invalid reminder format")

            db.add(EventReminder(
                event_id=event.id,
                # minutes_before=r.minutes_before,
                # method=r.method.value,
                # custom_message=r.custom_message
                minutes_before=minutes_before,
                method=method_enum,
                custom_message=custom_message
            ))
    db.commit()
    db.refresh(event)
    return event

@router.get("/events", response_model=List[EventOut])
def list_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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

    if mine:
        q = q.filter(CalendarEvent.organizer_id == current_user.id)

    if types:
        q = q.filter(CalendarEvent.type.in_(types))

    if departments:
        # JSON array contains any of provided ids (portable: do python-side filter after fetch)
        q = q.filter(CalendarEvent.department_ids.isnot(None))

    if priority:
        q = q.filter(CalendarEvent.priority.in_(priority))

    if start:
        q = q.filter(CalendarEvent.end_at >= start)
    if end:
        q = q.filter(CalendarEvent.start_at < end)

    events = q.order_by(CalendarEvent.start_at.asc()).all()

    # filter by departments (python-side to keep DB-agnostic JSON list)
    if departments:
        events = [e for e in events if e.department_ids and any(d in e.department_ids for d in departments)]

    # status bucketing
    now = _now_utc()
    def _in_status(e: CalendarEvent) -> bool:
        if status_filter == "All":
            return True
        if status_filter == "Upcoming":
            return e.start_at > now and e.status != EventStatusEnum.CANCELLED
        if status_filter == "In Progress":
            return e.start_at <= now <= e.end_at and e.status not in (EventStatusEnum.CANCELLED, EventStatusEnum.COMPLETED)
        if status_filter == "Completed":
            return e.status == EventStatusEnum.COMPLETED
        if status_filter == "Overdue":
            return e.end_at < now and e.status not in (EventStatusEnum.CANCELLED, EventStatusEnum.COMPLETED)
        return True

    events = [e for e in events if _in_status(e)]

    # Optional: expand recurrences to instances within [start, end)
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
                    # create ephemeral clone with shifted times
                    inst = CalendarEvent(
                        id=e.id,  # keep same id; instances are conceptual
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

    return events

@router.get("/events/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    e = db.query(CalendarEvent).filter_by(id=event_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    return e

@router.put("/events/{event_id}", response_model=EventOut)
def update_event(event_id: int, payload: EventUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    e = db.query(CalendarEvent).filter_by(id=event_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")

    if not _can_manage_calendar(current_user) and e.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not permitted")

    data = payload.dict(exclude_unset=True)
    # simple assign
    for field in [
        "title","description","location","virtual_meeting_link","department_ids","equipment",
        "meeting_room","catering_required","all_day","tz","start_at","end_at","rrule",
        "send_invitations"
    ]:
        if field in data:
            setattr(e, field, data[field])
    if "priority" in data and data["priority"] is not None:
        e.priority = PriorityEnum(data["priority"].value)
    if "status" in data and data["status"] is not None:
        e.status = EventStatusEnum(data["status"].value)
    if "type" in data and data["type"] is not None:
        e.type = EventTypeEnum(data["type"].value)

    # Replace attendees/reminders if provided
    if "attendees" in data and data["attendees"] is not None:
        db.query(EventAttendee).filter_by(event_id=e.id).delete()
        for a in data["attendees"]:
            db.add(EventAttendee(event_id=e.id, user_id=a.user_id, email=a.email, required=a.required))
    if "reminders" in data and data["reminders"] is not None:
        db.query(EventReminder).filter_by(event_id=e.id).delete()
        # for r in data["reminders"]:
        #     db.add(EventReminder(event_id=e.id, minutes_before=r.minutes_before, method=r.method.value, custom_message=r.custom_message))
        for r in payload.reminders or []:
            if isinstance(r, int):
                minutes_before = r
                method_enum = ReminderMethodEnum.EMAIL
                custom_message = None
            elif isinstance(r, dict):
                if "minutes_before" not in r or "method" not in r:
                    raise HTTPException(status_code=422, detail="Invalid reminder format")
                try:
                    method_enum = ReminderMethodEnum(r["method"])
                except ValueError:
                    raise HTTPException(status_code=422, detail="Invalid reminder method")
                minutes_before = r["minutes_before"]
                custom_message = r.get("custom_message")
            elif hasattr(r, "minutes_before") and hasattr(r, "method"):
                try:
                    method_enum = ReminderMethodEnum(r.method.value)
                except ValueError:
                    raise HTTPException(status_code=422, detail="Invalid reminder method")
                minutes_before = r.minutes_before
                custom_message = r.custom_message
            else:
                raise HTTPException(status_code=422, detail="Invalid reminder format")
            
            db.add(EventReminder(
                event_id=e.id,
                minutes_before=minutes_before,
                method=method_enum,
                custom_message=custom_message,
            ))

    db.commit()
    db.refresh(e)
    return e

@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: int, hard: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    e = db.query(CalendarEvent).filter_by(id=event_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")

    if not _can_manage_calendar(current_user) and e.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not permitted")

    if hard:
        db.delete(e)
    else:
        e.status = EventStatusEnum.CANCELLED
        e.cancelled_at = _now_utc()

    db.commit()
    return

@router.get("/stats", response_model=CalendarStats)
def calendar_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    mine: bool = False
):
    q = db.query(CalendarEvent)
    if mine:
        q = q.filter(CalendarEvent.organizer_id == current_user.id)
    events = q.all()
    now = _now_utc()
    upcoming = sum(1 for e in events if e.start_at > now and e.status != EventStatusEnum.CANCELLED)
    in_progress = sum(1 for e in events if e.start_at <= now <= e.end_at and e.status not in (EventStatusEnum.CANCELLED, EventStatusEnum.COMPLETED))
    completed = sum(1 for e in events if e.status == EventStatusEnum.COMPLETED)
    overdue = sum(1 for e in events if e.end_at < now and e.status not in (EventStatusEnum.CANCELLED, EventStatusEnum.COMPLETED))

    def _bucket(items, key):
        d = {}
        for it in items:
            k = getattr(it, key)
            d[str(k.value if hasattr(k, "value") else k)] = d.get(str(k.value if hasattr(k, "value") else k), 0) + 1
        return d

    return CalendarStats(
        total=len(events),
        upcoming=upcoming,
        in_progress=in_progress,
        completed=completed,
        overdue=overdue,
        by_type=_bucket(events, "type"),
        by_priority=_bucket(events, "priority"),
    )

# -----------------------
# Project Timeline / Gantt
# -----------------------
@router.post("/projects", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not _can_manage_calendar(current_user):
        raise HTTPException(status_code=403, detail="Not permitted")
    if payload.end_date <= payload.start_date:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    prj = Project(
        name=payload.name,
        description=payload.description,
        manager_id=payload.manager_id,
        status=payload.status.value,
        start_date=payload.start_date,
        end_date=payload.end_date
    )
    db.add(prj)
    db.commit()
    db.refresh(prj)
    return prj

@router.get("/projects", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Project)
    # Add filtering by manager/department/active if needed
    return q.order_by(Project.start_date.asc()).all()

@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prj = db.query(Project).filter_by(id=project_id).first()
    if not prj:
        raise HTTPException(status_code=404, detail="Project not found")
    return prj

@router.put("/projects/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prj = db.query(Project).filter_by(id=project_id).first()
    if not prj:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _can_manage_calendar(current_user):
        raise HTTPException(status_code=403, detail="Not permitted")

    data = payload.dict(exclude_unset=True)
    for field in ["name","description","manager_id","start_date","end_date"]:
        if field in data:
            setattr(prj, field, data[field])
    if "status" in data and data["status"] is not None:
        prj.status = data["status"].value

    db.commit()
    db.refresh(prj)
    return prj

@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prj = db.query(Project).filter_by(id=project_id).first()
    if not prj:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _can_manage_calendar(current_user):
        raise HTTPException(status_code=403, detail="Not permitted")
    db.delete(prj)
    db.commit()
    return

# ----- Tasks -----
@router.post("/projects/{project_id}/tasks", response_model=TaskOut, status_code=201)
def create_task(project_id: int, payload: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prj = db.query(Project).filter_by(id=project_id).first()
    if not prj:
        raise HTTPException(status_code=404, detail="Project not found")
    if not _can_manage_calendar(current_user) and prj.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not permitted")
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
        progress=payload.progress,
        priority=payload.priority.value
    )
    db.add(task)
    db.flush()

    if payload.dependencies:
        for dep in payload.dependencies:
            db.add(TaskDependency(predecessor_id=dep.predecessor_id, successor_id=task.id))

    db.commit()
    db.refresh(task)
    return task

@router.get("/projects/{project_id}/tasks", response_model=List[TaskOut])
def list_tasks(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prj = db.query(Project).filter_by(id=project_id).first()
    if not prj:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = db.query(ProjectTask).filter_by(project_id=project_id).order_by(ProjectTask.start_date.asc()).all()
    return tasks

@router.put("/projects/{project_id}/tasks/{task_id}", response_model=TaskOut)
def update_task(project_id: int, task_id: int, payload: TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(ProjectTask).filter_by(id=task_id, project_id=project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    prj = db.query(Project).filter_by(id=project_id).first()
    if not _can_manage_calendar(current_user) and prj.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not permitted")

    data = payload.dict(exclude_unset=True)
    for field in ["name","description","assigned_to_id","start_date","end_date","duration_hours","progress"]:
        if field in data:
            setattr(task, field, data[field])
    if "priority" in data and data["priority"] is not None:
        task.priority = data["priority"].value

    db.commit()
    db.refresh(task)
    return task

@router.delete("/projects/{project_id}/tasks/{task_id}", status_code=204)
def delete_task(project_id: int, task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(ProjectTask).filter_by(id=task_id, project_id=project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    prj = db.query(Project).filter_by(id=project_id).first()
    if not _can_manage_calendar(current_user) and prj.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not permitted")
    db.delete(task)
    db.commit()
    return
