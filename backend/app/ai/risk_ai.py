from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from statistics import mean
from typing import Dict, Iterable, List, Optional, Tuple


RISK_LEVEL_BANDS: List[Tuple[int, int, str]] = [
    (0, 25, "Low"),
    (26, 50, "Medium"),
    (51, 75, "High"),
    (76, 100, "Critical"),
]


EXTERNAL_INDICATORS: Dict[str, Dict[str, float]] = {
    "DE": {
        "political_stability": 0.78,
        "economic_outlook": 0.74,
        "regulatory_index": 0.86,
        "corruption_index": 0.88,
        "infrastructure": 0.82,
        "currency_stability": 0.76,
        "trade_relations": 0.84,
        "security": 0.81,
        "news_sentiment": 0.68,
        "volatility": 0.22,
    },
    "BR": {
        "political_stability": 0.42,
        "economic_outlook": 0.51,
        "regulatory_index": 0.49,
        "corruption_index": 0.41,
        "infrastructure": 0.44,
        "currency_stability": 0.35,
        "trade_relations": 0.47,
        "security": 0.38,
        "news_sentiment": 0.32,
        "volatility": 0.61,
    },
    "SG": {
        "political_stability": 0.91,
        "economic_outlook": 0.88,
        "regulatory_index": 0.93,
        "corruption_index": 0.94,
        "infrastructure": 0.9,
        "currency_stability": 0.87,
        "trade_relations": 0.9,
        "security": 0.89,
        "news_sentiment": 0.74,
        "volatility": 0.18,
    },
    "ZA": {
        "political_stability": 0.38,
        "economic_outlook": 0.46,
        "regulatory_index": 0.44,
        "corruption_index": 0.37,
        "infrastructure": 0.41,
        "currency_stability": 0.29,
        "trade_relations": 0.45,
        "security": 0.33,
        "news_sentiment": 0.36,
        "volatility": 0.67,
    },
    "US": {
        "political_stability": 0.61,
        "economic_outlook": 0.69,
        "regulatory_index": 0.73,
        "corruption_index": 0.7,
        "infrastructure": 0.66,
        "currency_stability": 0.71,
        "trade_relations": 0.6,
        "security": 0.64,
        "news_sentiment": 0.58,
        "volatility": 0.34,
    },
    "CN": {
        "political_stability": 0.55,
        "economic_outlook": 0.62,
        "regulatory_index": 0.49,
        "corruption_index": 0.45,
        "infrastructure": 0.7,
        "currency_stability": 0.57,
        "trade_relations": 0.52,
        "security": 0.59,
        "news_sentiment": 0.4,
        "volatility": 0.46,
    },
    "AU": {
        "political_stability": 0.83,
        "economic_outlook": 0.76,
        "regulatory_index": 0.82,
        "corruption_index": 0.86,
        "infrastructure": 0.79,
        "currency_stability": 0.74,
        "trade_relations": 0.77,
        "security": 0.81,
        "news_sentiment": 0.71,
        "volatility": 0.21,
    },
    "IN": {
        "political_stability": 0.48,
        "economic_outlook": 0.63,
        "regulatory_index": 0.52,
        "corruption_index": 0.49,
        "infrastructure": 0.46,
        "currency_stability": 0.44,
        "trade_relations": 0.58,
        "security": 0.4,
        "news_sentiment": 0.51,
        "volatility": 0.55,
    },
    "GB": {
        "political_stability": 0.7,
        "economic_outlook": 0.6,
        "regulatory_index": 0.8,
        "corruption_index": 0.82,
        "infrastructure": 0.71,
        "currency_stability": 0.68,
        "trade_relations": 0.65,
        "security": 0.69,
        "news_sentiment": 0.5,
        "volatility": 0.28,
    },
}


REGIONAL_MAP: Dict[str, str] = {
    "DE": "Europe",
    "BR": "South America",
    "SG": "Asia Pacific",
    "ZA": "Africa",
    "US": "North America",
    "CN": "Asia",
    "AU": "Oceania",
    "IN": "Asia",
    "GB": "Europe",
}


@dataclass
class CategoryInsight:
    name: str
    score: float
    weight: float
    ai_suggestion: float
    volatility: float


@dataclass
class CountryIntelligence:
    country_code: str
    overall_score: float
    risk_level: str
    trend: str
    confidence: str
    predicted_change: float
    supporting_signals: Dict[str, float]
    category_insights: List[CategoryInsight]
    ai_alerts: List[str]
    next_assessment: date


def _determine_risk_level(score: float) -> str:
    bounded = max(0, min(100, round(score)))
    for lower, upper, label in RISK_LEVEL_BANDS:
        if lower <= bounded <= upper:
            return label
    return "No Data"


class RiskIntelligenceEngine:
    """Provides deterministic, explainable risk scoring used across API endpoints."""

    def __init__(self, scoring_scale: str = "1-100") -> None:
        self.scoring_scale = scoring_scale

    @staticmethod
    def _scale_to_hundred(score: float, scale: str) -> float:
        mapping = {
            "1-5": 20,
            "1-10": 10,
            "1-100": 1,
        }
        if scale.lower() == "custom":
            return max(0, min(100, score))
        multiplier = mapping.get(scale, 1)
        return max(0, min(100, score * multiplier))

    def _resolve_indicators(self, country_code: str) -> Dict[str, float]:
        baseline = {
            "political_stability": 0.55,
            "economic_outlook": 0.58,
            "regulatory_index": 0.6,
            "corruption_index": 0.55,
            "infrastructure": 0.57,
            "currency_stability": 0.53,
            "trade_relations": 0.56,
            "security": 0.54,
            "news_sentiment": 0.5,
            "volatility": 0.4,
        }
        country_code = country_code.upper()
        return {**baseline, **EXTERNAL_INDICATORS.get(country_code, {})}

    def _confidence_from_volatility(self, volatility: float) -> str:
        if volatility <= 0.25:
            return "High"
        if volatility <= 0.45:
            return "Medium"
        return "Low"

    def _trend_from_sentiment(self, sentiment: float, volatility: float) -> str:
        if sentiment >= 0.65 and volatility <= 0.35:
            return "Improving"
        if sentiment <= 0.35 and volatility >= 0.5:
            return "Deteriorating"
        return "Stable"

    def _alerts_from_signals(self, signals: Dict[str, float]) -> List[str]:
        alerts: List[str] = []
        if signals["volatility"] >= 0.55:
            alerts.append("Market volatility exceeds internal threshold – monitor liquidity controls")
        if signals["news_sentiment"] <= 0.3:
            alerts.append("Negative media coverage detected – initiate communications review")
        if signals["political_stability"] <= 0.4:
            alerts.append("Political stability flagged – escalate to geopolitical task force")
        if signals["regulatory_index"] <= 0.45:
            alerts.append("Regulatory environment weakening – schedule compliance audit")
        return alerts

    def score_country(
        self,
        country_code: str,
        categories: Iterable[Tuple[str, float]],
        weights: Dict[str, float],
        scale: Optional[str] = None,
        assessment_end: Optional[date] = None,
    ) -> CountryIntelligence:
        scale = scale or self.scoring_scale
        signals = self._resolve_indicators(country_code)
        normalized_categories: List[CategoryInsight] = []

        for category_name, raw_score in categories:
            weight = weights.get(category_name, 0) / 100 if weights else 0
            normalized_score = self._scale_to_hundred(raw_score, scale)
            ai_suggestion = (signals.get(category_name, 0.55) * 100)
            volatility = signals.get("volatility", 0.4)
            normalized_categories.append(
                CategoryInsight(
                    name=category_name,
                    score=normalized_score,
                    weight=weight,
                    ai_suggestion=round(ai_suggestion, 1),
                    volatility=round(volatility * 100, 1),
                )
            )

        weighted_scores = [insight.score * insight.weight for insight in normalized_categories if insight.weight]
        overall_score = sum(weighted_scores) if weighted_scores else mean(
            [insight.score for insight in normalized_categories] or [self._scale_to_hundred(3, "1-5")]
        )
        overall_score = round(overall_score, 1)
        risk_level = _determine_risk_level(overall_score)
        trend = self._trend_from_sentiment(signals["news_sentiment"], signals["volatility"])
        confidence = self._confidence_from_volatility(signals["volatility"])
        predicted_change = round((signals["news_sentiment"] - 0.5) * 20, 2)
        alerts = self._alerts_from_signals(signals)

        next_assessment = assessment_end or (datetime.utcnow().date())
        if trend == "Deteriorating":
            next_assessment = datetime.utcnow().date()

        return CountryIntelligence(
            country_code=country_code,
            overall_score=overall_score,
            risk_level=risk_level,
            trend=trend,
            confidence=confidence,
            predicted_change=predicted_change,
            supporting_signals={k: round(v, 3) for k, v in signals.items()},
            category_insights=normalized_categories,
            ai_alerts=alerts,
            next_assessment=next_assessment,
        )

    def generate_regional_clusters(self, profiles: Iterable[CountryIntelligence]) -> Dict[str, Dict[str, float]]:
        clusters: Dict[str, List[CountryIntelligence]] = {}
        for profile in profiles:
            region = REGIONAL_MAP.get(profile.country_code.upper(), "Global")
            clusters.setdefault(region, []).append(profile)

        aggregated: Dict[str, Dict[str, float]] = {}
        for region, items in clusters.items():
            aggregated[region] = {
                "average_score": round(mean([item.overall_score for item in items]), 1),
                "high_risk_ratio": round(
                    sum(1 for item in items if item.risk_level in {"High", "Critical"}) / max(len(items), 1),
                    2,
                ),
                "improving_ratio": round(
                    sum(1 for item in items if item.trend == "Improving") / max(len(items), 1),
                    2,
                ),
            }
        return aggregated

    def build_ai_dashboard(self, profiles: Iterable[CountryIntelligence]) -> Dict[str, object]:
        profiles = list(profiles)
        return {
            "trendHighlights": [
                {
                    "country": profile.country_code,
                    "trend": profile.trend,
                    "predictedChange": profile.predicted_change,
                    "alerts": profile.ai_alerts,
                }
                for profile in profiles
            ],
            "regionalClusters": self.generate_regional_clusters(profiles),
            "watchlist": [
                {
                    "country": profile.country_code,
                    "riskLevel": profile.risk_level,
                    "confidence": profile.confidence,
                    "signals": profile.supporting_signals,
                }
                for profile in profiles
                if profile.risk_level in {"High", "Critical"} or profile.ai_alerts
            ],
        }


__all__ = [
    "CategoryInsight",
    "CountryIntelligence",
    "RiskIntelligenceEngine",
    "RISK_LEVEL_BANDS",
]
