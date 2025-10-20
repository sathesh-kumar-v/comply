from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from openai import OpenAI


def _prime_env() -> None:
    """Load .env files (repo root first) before reading OpenAI settings."""
    current_path = Path(__file__).resolve()
    for parent in current_path.parents:
        candidate = parent / ".env"
        if candidate.exists():
            load_dotenv(candidate, override=False)

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
            raise RuntimeError(
                "OPENAI_API_KEY is not set. Please set it in your environment."
            )
        _client = OpenAI(api_key=api_key)
    return _client


def _complete(system: str, user: str, temperature: float = 0.2, max_tokens: int = 600) -> str:
    client = _get_client()
    response = client.chat.completions.create(
        model=_model,
        temperature=temperature,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return (response.choices[0].message.content or "").strip()


def _coerce_json(raw: str) -> Dict[str, Any]:
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {"raw": raw}


# ---------------------------
# AI FEATURES FOR FMEA MODULE
# ---------------------------

def suggest_templates(
    industry: str,
    process_type: str,
    description: Optional[str] = None,
    keywords: Optional[List[str]] = None,
) -> Dict[str, Any]:
    system_prompt = (
        "You are an FMEA program assistant. Suggest ready-to-use FMEA templates "
        "for compliance-driven organizations. Always respond with JSON."
    )
    payload = {
        "industry": industry,
        "process_type": process_type,
        "description": description,
        "keywords": keywords or [],
    }
    user_prompt = (
        "Context:\n"
        + json.dumps(payload, ensure_ascii=False)
        + "\n\nReturn JSON with keys: templates (list of {name, focus, description, recommended_controls})"
        " and notes (list of strings)."
    )
    raw = _complete(system_prompt, user_prompt, temperature=0.3, max_tokens=700)
    data = _coerce_json(raw)

    templates = []
    for tpl in data.get("templates", []):
        if not isinstance(tpl, dict):
            continue
        templates.append(
            {
                "name": str(tpl.get("name") or "Untitled Template"),
                "focus": str(tpl.get("focus") or process_type),
                "description": str(tpl.get("description") or ""),
                "recommended_controls": [
                    str(ctrl)
                    for ctrl in tpl.get("recommended_controls", [])
                    if isinstance(ctrl, str)
                ],
            }
        )

    return {
        "templates": templates,
        "notes": [str(n) for n in data.get("notes", []) if isinstance(n, str)],
        "raw": data.get("raw"),
    }


def generate_rpn_alerts(
    items: List[Dict[str, Any]],
    threshold: int,
) -> Dict[str, Any]:
    system_prompt = (
        "You are monitoring an FMEA program. Identify high-risk items using the provided RPN threshold. "
        "Respond in JSON with keys: alerts (list of strings) and summary (string)."
    )
    payload = {
        "threshold": threshold,
        "items": items,
    }
    user_prompt = (
        "Evaluate these FMEA worksheet items and highlight those exceeding the RPN threshold.\n"
        + json.dumps(payload, ensure_ascii=False)
        + "\nReturn JSON only."
    )
    raw = _complete(system_prompt, user_prompt, temperature=0.2, max_tokens=400)
    data = _coerce_json(raw)
    return {
        "threshold": threshold,
        "alerts": [str(a) for a in data.get("alerts", []) if isinstance(a, str)],
        "summary": str(data.get("summary") or ""),
        "raw": data.get("raw"),
    }


def predict_failure_modes(
    process_context: Dict[str, Any],
    historical_patterns: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    system_prompt = (
        "You are an FMEA domain expert. Suggest potential failure modes based on the provided process context "
        "and historical patterns. Return JSON with key 'failure_modes' (list of objects containing item_function, "
        "failure_mode, effects, causes, controls, severity, occurrence, detection) and 'notes'."
    )
    payload = {
        "process": process_context,
        "historical_patterns": historical_patterns or [],
    }
    user_prompt = (
        "Analyze this process and recommend failure modes to seed an FMEA worksheet.\n"
        + json.dumps(payload, ensure_ascii=False)
        + "\nReturn JSON only."
    )
    raw = _complete(system_prompt, user_prompt, temperature=0.35, max_tokens=750)
    data = _coerce_json(raw)
    modes = []
    for fm in data.get("failure_modes", []):
        if not isinstance(fm, dict):
            continue
        modes.append(
            {
                "item_function": str(fm.get("item_function") or ""),
                "failure_mode": str(fm.get("failure_mode") or ""),
                "effects": str(fm.get("effects") or ""),
                "causes": str(fm.get("causes") or ""),
                "controls": str(fm.get("controls") or ""),
                "severity": fm.get("severity"),
                "occurrence": fm.get("occurrence"),
                "detection": fm.get("detection"),
            }
        )
    return {
        "failure_modes": modes,
        "notes": [str(n) for n in data.get("notes", []) if isinstance(n, str)],
        "raw": data.get("raw"),
    }


def suggest_team_members(
    departments: List[str],
    required_skills: Optional[List[str]] = None,
    timeline: Optional[str] = None,
    existing_team: Optional[List[str]] = None,
) -> Dict[str, Any]:
    system_prompt = (
        "You are staffing an FMEA analysis. Recommend team composition with roles. "
        "Always answer in JSON with keys: recommended_leads (list of {name, reason}), "
        "recommended_members (list of {name, role, reason}) and notes (list of strings)."
    )
    payload = {
        "departments": departments,
        "required_skills": required_skills or [],
        "timeline": timeline,
        "existing_team": existing_team or [],
    }
    user_prompt = (
        "Suggest an FMEA core team.\n"
        + json.dumps(payload, ensure_ascii=False)
        + "\nReturn JSON only."
    )
    raw = _complete(system_prompt, user_prompt, temperature=0.3, max_tokens=600)
    data = _coerce_json(raw)

    def _norm_people(entries: Any, extra_keys: Optional[List[str]] = None) -> List[Dict[str, str]]:
        out: List[Dict[str, str]] = []
        if not isinstance(entries, list):
            return out
        extra_keys = extra_keys or []
        for item in entries:
            if not isinstance(item, dict):
                continue
            normalized = {"name": str(item.get("name") or "Candidate")}
            for key in ["role", "reason"] + extra_keys:
                value = item.get(key)
                if value is not None:
                    normalized[key] = str(value)
            out.append(normalized)
        return out

    return {
        "recommended_leads": _norm_people(data.get("recommended_leads")),
        "recommended_members": _norm_people(data.get("recommended_members")),
        "notes": [str(n) for n in data.get("notes", []) if isinstance(n, str)],
        "raw": data.get("raw"),
    }


def recommend_scales(
    industry: str,
    standard: Optional[str],
    risk_focus: Optional[str] = None,
) -> Dict[str, Any]:
    system_prompt = (
        "You are configuring FMEA rating scales. Provide labeled scales for Severity, Occurrence, and Detection "
        "with scores 1-10. Return JSON with keys severity_scale, occurrence_scale, detection_scale (each list of {score, label, description}) "
        "and notes (list of strings)."
    )
    payload = {
        "industry": industry,
        "standard": standard,
        "risk_focus": risk_focus,
    }
    user_prompt = (
        "Recommend calibrated rating scales for this FMEA.\n"
        + json.dumps(payload, ensure_ascii=False)
        + "\nReturn JSON only."
    )
    raw = _complete(system_prompt, user_prompt, temperature=0.25, max_tokens=800)
    data = _coerce_json(raw)

    def _norm_scale(entries: Any) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        if not isinstance(entries, list):
            return out
        for item in entries:
            if not isinstance(item, dict):
                continue
            try:
                score = int(item.get("score"))
            except Exception:
                continue
            out.append(
                {
                    "score": score,
                    "label": str(item.get("label") or f"Level {score}"),
                    "description": str(item.get("description") or ""),
                }
            )
        return sorted(out, key=lambda x: x["score"])

    return {
        "severity_scale": _norm_scale(data.get("severity_scale")),
        "occurrence_scale": _norm_scale(data.get("occurrence_scale")),
        "detection_scale": _norm_scale(data.get("detection_scale")),
        "notes": [str(n) for n in data.get("notes", []) if isinstance(n, str)],
        "raw": data.get("raw"),
    }


def draft_scope_outline(
    process_description: str,
    objectives: Optional[List[str]] = None,
    assumptions: Optional[List[str]] = None,
) -> Dict[str, Any]:
    system_prompt = (
        "You are drafting an FMEA charter. Provide a crisp scope statement, refined objectives, "
        "and key assumptions. Return JSON with keys scope (string), objectives (list of strings), assumptions (list of strings)."
    )
    payload = {
        "process_description": process_description,
        "objectives": objectives or [],
        "assumptions": assumptions or [],
    }
    user_prompt = (
        "Craft an FMEA scope outline.\n"
        + json.dumps(payload, ensure_ascii=False)
        + "\nReturn JSON only."
    )
    raw = _complete(system_prompt, user_prompt, temperature=0.25, max_tokens=500)
    data = _coerce_json(raw)
    return {
        "scope": str(data.get("scope") or ""),
        "objectives": [str(o) for o in data.get("objectives", []) if isinstance(o, str)],
        "assumptions": [str(a) for a in data.get("assumptions", []) if isinstance(a, str)],
        "raw": data.get("raw"),
    }


def analyze_cause_effect(
    items: List[Dict[str, Any]],
    focus: Optional[str] = None,
) -> Dict[str, Any]:
    system_prompt = (
        "You are reviewing an FMEA worksheet. Provide cause-and-effect insights and improvement suggestions. "
        "Return JSON with keys insights (list of strings) and recommended_controls (list of strings)."
    )
    payload = {
        "focus": focus,
        "items": items,
    }
    user_prompt = (
        "Analyze these FMEA entries for cause-effect relationships and control gaps.\n"
        + json.dumps(payload, ensure_ascii=False)
        + "\nReturn JSON only."
    )
    raw = _complete(system_prompt, user_prompt, temperature=0.2, max_tokens=600)
    data = _coerce_json(raw)
    return {
        "insights": [str(i) for i in data.get("insights", []) if isinstance(i, str)],
        "recommended_controls": [
            str(c) for c in data.get("recommended_controls", []) if isinstance(c, str)
        ],
        "raw": data.get("raw"),
    }


def evaluate_control_effectiveness(
    items: List[Dict[str, Any]],
) -> Dict[str, Any]:
    system_prompt = (
        "You are assessing FMEA controls. Score the effectiveness (High/Medium/Low) for each item and "
        "suggest upgrades. Return JSON with keys evaluations (list of {item_reference, effectiveness, recommendation}) and summary."
    )
    payload = {"items": items}
    user_prompt = (
        "Evaluate detection and prevention controls for each FMEA line.\n"
        + json.dumps(payload, ensure_ascii=False)
        + "\nReturn JSON only."
    )
    raw = _complete(system_prompt, user_prompt, temperature=0.25, max_tokens=700)
    data = _coerce_json(raw)
    evaluations = []
    for entry in data.get("evaluations", []):
        if not isinstance(entry, dict):
            continue
        evaluations.append(
            {
                "item_reference": str(entry.get("item_reference") or ""),
                "effectiveness": str(entry.get("effectiveness") or "Unknown"),
                "recommendation": str(entry.get("recommendation") or ""),
            }
        )
    return {
        "evaluations": evaluations,
        "summary": str(data.get("summary") or ""),
        "raw": data.get("raw"),
    }


def forecast_rpn(
    items: List[Dict[str, Any]],
    proposed_actions: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    system_prompt = (
        "You are modelling RPN impact. Estimate projected RPN after proposed actions. "
        "Return JSON with keys projections (list of {item_reference, current_rpn, projected_rpn, recommendation}) and summary."
    )
    payload = {
        "items": items,
        "proposed_actions": proposed_actions or [],
    }
    user_prompt = (
        "Model how the recommended actions will change RPN values.\n"
        + json.dumps(payload, ensure_ascii=False)
        + "\nReturn JSON only."
    )
    raw = _complete(system_prompt, user_prompt, temperature=0.25, max_tokens=700)
    data = _coerce_json(raw)
    projections = []
    for entry in data.get("projections", []):
        if not isinstance(entry, dict):
            continue
        projections.append(
            {
                "item_reference": str(entry.get("item_reference") or ""),
                "current_rpn": entry.get("current_rpn"),
                "projected_rpn": entry.get("projected_rpn"),
                "recommendation": str(entry.get("recommendation") or ""),
            }
        )
    return {
        "projections": projections,
        "summary": str(data.get("summary") or ""),
        "raw": data.get("raw"),
    }
