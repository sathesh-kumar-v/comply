"""AI helper functions for the document management module."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from openai import OpenAI


def _prime_env() -> None:
    """Load `.env` files so the OpenAI client can pick up credentials."""

    current_path = Path(__file__).resolve()
    for parent in current_path.parents:
        env_path = parent / ".env"
        if env_path.exists():
            load_dotenv(env_path, override=False)

    if not os.getenv("OPENAI_API_KEY"):
        load_dotenv(override=False)


_prime_env()

_client: Optional[OpenAI] = None
_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set. Please configure it before using AI features.")
        _client = OpenAI(api_key=api_key)
    return _client


def _complete(
    system: str,
    user: str,
    *,
    temperature: float = 0.2,
    max_tokens: int = 600,
) -> str:
    client = _get_client()
    response = client.chat.completions.create(
        model=_model,
        temperature=temperature,
        max_tokens=max_tokens,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    return (response.choices[0].message.content or "").strip()


def _complete_json(
    system: str,
    user: str,
    *,
    temperature: float = 0.2,
    max_tokens: int = 800,
) -> Dict[str, Any]:
    """Ask the model for JSON and normalise the response."""

    raw = _complete(system, user, temperature=temperature, max_tokens=max_tokens)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Attempt to recover JSON blocks from the text response.
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                data = json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                data = {"raw": raw}
        else:
            data = {"raw": raw}

    if not isinstance(data, dict):
        return {"raw": raw}
    if "raw" not in data:
        data["raw"] = raw
    return data


def analyse_document_metadata(
    *,
    title: str,
    description: Optional[str] = None,
    file_name: Optional[str] = None,
    existing_tags: Optional[List[str]] = None,
    existing_keywords: Optional[List[str]] = None,
    available_categories: Optional[List[str]] = None,
    text_preview: Optional[str] = None,
) -> Dict[str, Any]:
    """Suggest categories, tags and keywords for a document."""

    system = (
        "You are an assistant that classifies compliance documents. "
        "Return JSON with keys: category (string), secondary_categories (list), "
        "tags (list), keywords (list), summary (string), confidence (0-1 float), "
        "notes (list)."
    )
    payload: Dict[str, Any] = {
        "title": title,
        "description": description,
        "file_name": file_name,
        "existing_tags": existing_tags or [],
        "existing_keywords": existing_keywords or [],
        "available_categories": available_categories or [],
        "text_preview": text_preview,
    }
    user = json.dumps(payload, ensure_ascii=False)
    data = _complete_json(system, user, max_tokens=700)
    return data


def plan_natural_language_search(
    query: str,
    *,
    library_snapshot: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Translate a natural language query into structured filters."""

    system = (
        "You translate natural language document search queries into filters. "
        "Return JSON with keys: refined_query (string), keywords (list of strings), "
        "document_types (list of strings), statuses (list), access_levels (list), "
        "priority (optional), reasoning (string)."
    )
    payload = {"query": query, "library": library_snapshot or []}
    user = json.dumps(payload, ensure_ascii=False)
    return _complete_json(system, user)


def detect_duplicate_documents(
    *,
    candidate: Dict[str, Any],
    existing: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Compare a candidate document with existing metadata and flag duplicates."""

    system = (
        "You identify potential duplicate or superseded compliance documents. "
        "Given one candidate and many existing records, return JSON with keys: "
        "duplicates (list of {id, title, similarity, reasoning}), has_exact_match (bool), "
        "notes (list)."
    )
    payload = {"candidate": candidate, "existing": existing}
    user = json.dumps(payload, ensure_ascii=False)
    return _complete_json(system, user)


def recommend_documents(
    *,
    user_profile: Dict[str, Any],
    recent_documents: List[Dict[str, Any]],
    available_documents: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Recommend relevant documents based on user context."""

    system = (
        "You recommend compliance documents tailored to a user's activity. "
        "Return JSON with keys: recommendations (list of {id, title, reason, priority}), "
        "summary (string)."
    )
    payload = {
        "user": user_profile,
        "recent": recent_documents,
        "library": available_documents,
    }
    user = json.dumps(payload, ensure_ascii=False)
    return _complete_json(system, user)


def autocomplete_compliance_text(
    *, context: str, focus: Optional[str] = None
) -> Dict[str, Any]:
    """Generate auto-completion text for compliance documents."""

    system = (
        "You write concise, regulation-aware completions for compliance documents. "
        "Return JSON with keys: completion (string), reasoning (string), tips (list)."
    )
    payload = {"context": context, "focus": focus}
    user = json.dumps(payload, ensure_ascii=False)
    return _complete_json(system, user)


def suggest_document_templates(
    *, document_type: str, department: Optional[str] = None, tags: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Suggest templates and reusable sections."""

    system = (
        "You recommend template sections for compliance documents. "
        "Return JSON with keys: templates (list of {name, description, when_to_use}), "
        "sections (list of strings), notes (list)."
    )
    payload = {"document_type": document_type, "department": department, "tags": tags or []}
    user = json.dumps(payload, ensure_ascii=False)
    return _complete_json(system, user)


def check_compliance_grammar(
    *, content: str, jurisdiction: Optional[str] = None
) -> Dict[str, Any]:
    """Provide grammar and compliance language feedback."""

    system = (
        "You review compliance documents for grammar and regulatory tone. "
        "Return JSON with keys: score (0-100), issues (list of {issue, severity, suggestion}), "
        "summary (string)."
    )
    payload = {"content": content, "jurisdiction": jurisdiction}
    user = json.dumps(payload, ensure_ascii=False)
    return _complete_json(system, user, max_tokens=900)


def create_numbered_outline(
    *, outline: List[str], cross_reference_hints: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Generate section numbering and suggested cross references."""

    system = (
        "You turn unordered headings into a numbered compliance outline. "
        "Return JSON with keys: numbered_sections (list of {number, heading}), "
        "cross_references (list of strings), notes (list)."
    )
    payload = {"outline": outline, "cross_reference_hints": cross_reference_hints or []}
    user = json.dumps(payload, ensure_ascii=False)
    return _complete_json(system, user)


def suggest_reviewers(
    *,
    document: Dict[str, Any],
    reviewers: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Recommend reviewers based on expertise and workload."""

    system = (
        "You assign reviewers for controlled documents. "
        "Return JSON with keys: recommended (list of {id, name, reason}), backup (list), notes (list)."
    )
    payload = {"document": document, "candidates": reviewers}
    user = json.dumps(payload, ensure_ascii=False)
    return _complete_json(system, user)


def predict_workflow_progress(
    *, document: Dict[str, Any], history: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Predict the next workflow step and automation opportunities."""

    system = (
        "You analyse document approval workflows. "
        "Return JSON with keys: next_step (string), automation (list of strings), blockers (list), notes (list)."
    )
    payload = {"document": document, "history": history}
    user = json.dumps(payload, ensure_ascii=False)
    return _complete_json(system, user)


def estimate_completion_timeline(
    *, document: Dict[str, Any], history: List[Dict[str, Any]], sla_days: Optional[int] = None
) -> Dict[str, Any]:
    """Estimate when the workflow will complete."""

    system = (
        "You forecast completion timelines for document workflows. "
        "Return JSON with keys: estimated_completion (string), phase_estimates (list of {phase, days}), "
        "risk_level (string), confidence (0-1 float), notes (list)."
    )
    payload = {"document": document, "history": history, "sla_days": sla_days}
    user = json.dumps(payload, ensure_ascii=False)
    return _complete_json(system, user)


@dataclass(slots=True)
class DuplicateCandidate:
    id: int
    title: str
    match_reason: str
    similarity: float

