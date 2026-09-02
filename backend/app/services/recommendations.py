"""
PeakSense Recommendation Engine.

Deterministically maps real SHAP explanation drivers (GET /api/explanation)
to demand-response intervention types, then tests each candidate
intervention through the real SimulationService (the same engine behind
POST /api/simulate) using a fixed moderate test scenario. Recommendations
are ranked by estimated MW impact.

IMPORTANT: This does NOT claim the XGBoost model directly recommends
interventions. It is a rule-based SHAP-category -> intervention mapping,
combined with the real simulation engine's estimated effect for that
intervention. No random values, no fabricated MW numbers — every
estimated_reduction_mw comes from SimulationService.simulate().

Deterministic: same locality + same forecast + same SHAP explanation +
same test scenario => same recommendations, every time.
"""

from typing import Dict, List, Tuple

from app.schemas.recommendations import RecommendationItem, RecommendationsResponse
from app.schemas.simulation import SimulationRequest
from app.seed_data import LOCALITIES_BY_ID
from app.services.explanation import ExplanationEngine
from app.services.simulation import SimulationService

# Fixed moderate test scenario — matches the frontend's existing "Peak
# Reduction Opportunity" default scenario, so recommendation MW figures
# agree exactly with that panel when the same scenario is used.
TEST_SCENARIO: Dict[str, float] = {
    "cooling_shift": 0.30,
    "commercial_shift": 0.20,
    "flexible_load": 0.10,
    "solar_utilization": 0.50,
}

INTERVENTION_TITLES: Dict[str, str] = {
    "cooling_shift": "Cooling load shifting",
    "commercial_shift": "Commercial demand response",
    "flexible_load": "Flexible load scheduling",
    "solar_utilization": "Solar utilization",
}

# Maps each intervention to the SHAP feature category it most directly addresses.
INTERVENTION_CATEGORY: Dict[str, Tuple[str, ...]] = {
    "cooling_shift": ("weather",),
    "flexible_load": ("lag", "rolling"),
    "commercial_shift": ("temporal",),
    "solar_utilization": ("solar",),
}

INTERVENTION_ORDER = ("cooling_shift", "commercial_shift", "flexible_load", "solar_utilization")


def _normalize_horizon(horizon: str) -> str:
    """Same normalisation rule as ExplanationEngine.get_explanation."""
    if horizon in ("15min", "15m"):
        return "15min"
    if horizon in ("1h", "1hour"):
        return "1h"
    return "24h"


def _build_reason(key: str, drivers: list) -> str:
    categories = INTERVENTION_CATEGORY[key]
    matches = [d for d in drivers if d.category in categories and d.direction == "increase"]
    if matches:
        top = max(matches, key=lambda d: abs(d.shap_value_mw))
        sign = "+" if top.shap_value_mw >= 0 else ""
        return f"Model driver '{top.label}' ({sign}{top.shap_value_mw:.1f} MW SHAP) is a top positive contributor."
    return "Standard demand-response candidate — no strongly-implicating SHAP driver in this category."


class RecommendationEngine:
    """Singleton wrapping ExplanationEngine + SimulationService — no separate model."""

    _instance: "RecommendationEngine | None" = None

    @classmethod
    def get_instance(cls) -> "RecommendationEngine":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_recommendations(self, locality_id: str, horizon: str = "1h") -> RecommendationsResponse:
        locality = LOCALITIES_BY_ID.get(locality_id)
        if locality is None:
            raise KeyError(f"Locality '{locality_id}' not found")

        norm_horizon = _normalize_horizon(horizon)

        explanation_engine = ExplanationEngine.get_instance()
        explanation = explanation_engine.get_explanation(
            locality_id=locality_id, horizon=norm_horizon, top_n=8
        )

        sim_service = SimulationService.get_instance()
        sim_request = SimulationRequest(
            locality_id=locality_id,
            horizon=norm_horizon,
            **TEST_SCENARIO,
        )
        simulation = sim_service.simulate(sim_request)
        sim_by_key = {i.key: i for i in simulation.interventions}

        candidates: List[dict] = []
        for key in INTERVENTION_ORDER:
            if key == "solar_utilization" and locality.solar_capacity_mw <= 0:
                continue
            effect = sim_by_key.get(key)
            reduction = effect.estimated_reduction_mw if effect else 0.0
            candidates.append(
                {
                    "intervention": key,
                    "title": INTERVENTION_TITLES[key],
                    "reason": _build_reason(key, explanation.drivers),
                    "scenario_percentage": round(TEST_SCENARIO[key] * 100, 0),
                    "estimated_reduction_mw": reduction,
                }
            )

        # Rank by estimated scenario impact (descending). Stable sort preserves
        # INTERVENTION_ORDER as the deterministic tie-breaker.
        candidates.sort(key=lambda c: c["estimated_reduction_mw"], reverse=True)
        recommendations = [RecommendationItem(rank=i + 1, **c) for i, c in enumerate(candidates)]

        return RecommendationsResponse(
            locality_id=locality.id,
            locality_name=locality.name,
            horizon=norm_horizon,
            recommendations=recommendations,
            is_demo_fallback=explanation.is_demo_fallback or simulation.is_demo_fallback,
        )
