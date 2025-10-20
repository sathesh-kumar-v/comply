from typing import Any, Dict, List, Optional, Union
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, conlist

from app.ai.calendar_ai import (
    suggest_event_title,
    summarize_calendar_window,
    optimize_schedule,
    extract_action_items,
)

router = APIRouter(prefix="/calendar/ai", tags=["calendar-ai"])


# --------- Schemas (router-local) ---------

class EventIn(BaseModel):
    id: Optional[Union[str, int]] = None
    title: str
    type: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    department_ids: Optional[List[int]] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    all_day: Optional[bool] = None
    start_at: str
    end_at: Optional[str] = None
    reminders: Optional[List[int]] = None


class SuggestTitleIn(BaseModel):
    description: str = Field(..., min_length=2)
    event_type: Optional[str] = None
    departments: Optional[List[str]] = None
    priority: Optional[str] = None


class SuggestTitleOut(BaseModel):
    title: str


class SummarizeIn(BaseModel):
    tz: Optional[str] = "UTC"
    window_label: Optional[str] = None
    events: conlist(EventIn, min_length=0)  # type: ignore


class SummarizeOut(BaseModel):
    summary: str


class OptimizeConstraints(BaseModel):
    working_hours: Optional[Dict[str, str]] = Field(
        default=None,
        description="e.g., {'start':'09:00','end':'17:00'} local-time"
    )
    avoid_days: Optional[List[int]] = Field(
        default=None,
        description="Weekday numbers to avoid (0=Mon..6=Sun)"
    )
    max_daily_meetings: Optional[int] = 5
    buffer_minutes: Optional[int] = 15


class OptimizeIn(BaseModel):
    constraints: OptimizeConstraints
    events: conlist(EventIn, min_length=0)  # type: ignore


class OptimizeMove(BaseModel):
    id: Optional[str] = None
    reason: Optional[str] = None
    new_start_at: Optional[str] = None
    new_end_at: Optional[str] = None


class OptimizeOut(BaseModel):
    moves: List[OptimizeMove] = []
    notes: List[str] = []
    raw: Optional[str] = None


class ActionItemsIn(BaseModel):
    description: str = Field(..., min_length=2)


class ActionItemsOut(BaseModel):
    items: List[str]


# --------- Endpoints ---------

@router.post("/suggest-title", response_model=SuggestTitleOut)
def api_suggest_title(payload: SuggestTitleIn) -> SuggestTitleOut:
    try:
        title = suggest_event_title(
            description=payload.description,
            event_type=payload.event_type,
            department_names=payload.departments,
            priority=payload.priority,
        )
        return SuggestTitleOut(title=title)
    except RuntimeError as e:
        # Typically missing OPENAI_API_KEY
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/summarize", response_model=SummarizeOut)
def api_summarize(payload: SummarizeIn) -> SummarizeOut:
    try:
        # Convert to plain dicts for the service function
        events = [e.model_dump() for e in payload.events]
        summary = summarize_calendar_window(
            events=events,
            tz=payload.tz or "UTC",
            window_label=payload.window_label,
        )
        return SummarizeOut(summary=summary)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/optimize", response_model=OptimizeOut)
def api_optimize(payload: OptimizeIn) -> OptimizeOut:
    try:
        result = optimize_schedule(
            constraints=payload.constraints.model_dump(),
            events=[e.model_dump() for e in payload.events],
        )
        # Shape into the response model
        moves = [OptimizeMove(**m) for m in result.get("moves", [])]
        notes = [str(n) for n in result.get("notes", [])]
        return OptimizeOut(moves=moves, notes=notes, raw=result.get("raw"))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/action-items", response_model=ActionItemsOut)
def api_action_items(payload: ActionItemsIn) -> ActionItemsOut:
    try:
        items = extract_action_items(payload.description)
        return ActionItemsOut(items=items)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
