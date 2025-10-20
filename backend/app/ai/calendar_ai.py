import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from openai import OpenAI


def _prime_env() -> None:
    """Ensure `.env` files are loaded before we read OpenAI settings."""

    current_path = Path(__file__).resolve()
    for parent in current_path.parents:
        candidate = parent / ".env"
        if candidate.exists():
            load_dotenv(candidate, override=False)

    # Finally, fall back to the default search so local shells still work.
    if not os.getenv("OPENAI_API_KEY"):
        load_dotenv(override=False)


_prime_env()

# Configure client (env var: OPENAI_API_KEY)
_client: Optional[OpenAI] = None
_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not set. Please set it in your environment."
            )
        _client = OpenAI(api_key=api_key)
    return _client


def _complete(system: str, user: str, temperature: float = 0.2, max_tokens: int = 500) -> str:
    """
    Small helper to call the Chat Completions API with consistent defaults.
    """
    client = _get_client()
    resp = client.chat.completions.create(
        model=_model,
        temperature=temperature,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return (resp.choices[0].message.content or "").strip()


# ---------------------------
# AI FEATURES FOR CALENDAR
# ---------------------------

def suggest_event_title(
    description: str,
    event_type: Optional[str] = None,
    department_names: Optional[List[str]] = None,
    priority: Optional[str] = None,
) -> str:
    """
    Returns a short, action-oriented, capitalized event title (<= 80 chars).
    """
    sys = (
        "You are a helpful assistant that writes concise, professional calendar "
        "event titles for a compliance/GRC organization. Keep titles <= 80 chars."
    )
    parts = [f"Description:\n{description}"]
    if event_type:
        parts.append(f"Type: {event_type}")
    if department_names:
        parts.append(f"Departments: {', '.join(department_names)}")
    if priority:
        parts.append(f"Priority: {priority}")
    user = "\n\n".join(parts) + "\n\nReturn only the best title, no extra text."
    return _complete(sys, user, temperature=0.3, max_tokens=60)


def summarize_calendar_window(
    events: List[Dict[str, Any]],
    tz: str = "UTC",
    window_label: Optional[str] = None,
) -> str:
    """
    Summarizes a set of events (already filtered by time window).
    Each event dict is expected to include: title, start_at, end_at, status, type, priority.
    """
    sys = (
        "You are a compliance program assistant. Summarize events clearly for executives. "
        "Group by status, flag risks (overdue/critical), and keep it crisp."
    )
    if not events:
        return "No events scheduled for this window."

    # Make a compact, deterministic table for the model
    lines = []
    for ev in events:
        title = ev.get("title", "Untitled")
        start_at = ev.get("start_at") or ev.get("start") or ""
        end_at = ev.get("end_at") or ev.get("end") or ""
        status = ev.get("status", "Scheduled")
        etype = ev.get("type", "Other")
        priority = ev.get("priority", "Medium")
        try:
            sd = datetime.fromisoformat(start_at.replace("Z", "+00:00"))
            ed = datetime.fromisoformat(end_at.replace("Z", "+00:00")) if end_at else None
            when = sd.strftime("%Y-%m-%d %H:%M")
            if ed:
                when += f" → {ed.strftime('%Y-%m-%d %H:%M')}"
        except Exception:
            when = f"{start_at} → {end_at}"

        lines.append(f"- [{status}] ({priority}) {etype} | {title} | {when}")

    user = (
        (f"Time Window: {window_label}\n" if window_label else "")
        + f"Timezone: {tz}\n"
        + "Events:\n"
        + "\n".join(lines)
        + "\n\nWrite a concise summary (bullets + 1–2 risk notes)."
    )
    return _complete(sys, user, temperature=0.2, max_tokens=250)


def optimize_schedule(
    constraints: Dict[str, Any],
    events: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Accepts constraints (e.g., working_hours, avoid_days, max_daily_meetings, buffer_minutes)
    and a list of events. Returns an optimization proposal with concrete moves.
    """
    sys = (
        "You are a scheduling optimizer for a compliance calendar. "
        "Respect constraints and propose concrete, minimal changes. "
        "Output valid JSON with keys: 'moves' (list of {id, reason, new_start_at, new_end_at}) "
        "and 'notes' (list of strings). If nothing to change, moves can be empty."
    )

    # Keep the prompt strictly JSON-friendly to make parsing reliable
    import json

    user = (
        "Constraints (JSON):\n"
        + json.dumps(constraints, ensure_ascii=False)
        + "\n\nEvents (JSON):\n"
        + json.dumps(events, ensure_ascii=False)
        + "\n\nReturn JSON only."
    )
    raw = _complete(sys, user, temperature=0.2, max_tokens=800)

    # Best-effort to parse model JSON
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("Top-level JSON is not an object")
        # Normalize keys
        moves = data.get("moves") or []
        notes = data.get("notes") or []
        if not isinstance(moves, list):
            moves = []
        if not isinstance(notes, list):
            notes = []
        return {"moves": moves, "notes": notes, "raw": raw}
    except Exception:
        # Fallback: return raw text for debugging
        return {"moves": [], "notes": ["LLM returned non-JSON response"], "raw": raw}


def extract_action_items(description: str) -> List[str]:
    """
    Pulls actionable to-dos from a free-form event description.
    """
    sys = (
        "You extract action items from meeting/event descriptions. "
        "Return a bullet list of actionable tasks, each starting with a verb."
    )
    user = f"Text:\n{description}\n\nReturn 3-8 bullets. If none, return 'No clear action items.'"
    text = _complete(sys, user, temperature=0.3, max_tokens=180)
    items = [ln.strip("-• ").strip() for ln in text.splitlines() if ln.strip()]
    return items
