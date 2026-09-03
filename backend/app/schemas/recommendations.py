"""
Pydantic Schemas for PeakSense Recommendation Engine API.

IMPORTANT: These recommendations are NOT produced directly by the XGBoost
model. They are a deterministic rule-based mapping from real SHAP
explanation drivers to demand-response intervention types, ranked by the
estimated MW impact of each intervention as computed by the real
SimulationService (the same engine behind POST /api/simulate).

Same locality + same forecast + same SHAP explanation + same test scenario
always produces the same ranked recommendations — no randomness.
"""

from typing import List
from pydantic import BaseModel, Field


class RecommendationItem(BaseModel):
    intervention: str = Field(
        description="Intervention key matching SimulationRequest field name "
        "(cooling_shift, commercial_shift, flexible_load, solar_utilization)"
    )
    title: str = Field(description="Human-readable intervention title")
    reason: str = Field(
        description="Why this intervention was selected — derived from real SHAP driver categories"
    )
    scenario_percentage: float = Field(
        description="Activation level (%) used for the test scenario that produced estimated_reduction_mw"
    )
    estimated_reduction_mw: float = Field(
        description=(
            "Estimated MW impact from the real simulation engine (SimulationService) "
            "at scenario_percentage activation. A scenario estimate, not a guaranteed reduction."
        )
    )
    rank: int = Field(description="1 = highest estimated scenario impact among candidates")


class RecommendationsResponse(BaseModel):
    """
    Model-informed, deterministic demand-response recommendations.

    Pipeline: GET /api/explanation (SHAP) -> category-to-intervention mapping
    -> SimulationService test scenario -> rank by estimated_reduction_mw.

    Uses the SAME ExplanationEngine and SimulationService singletons as
    GET /api/explanation and POST /api/simulate — no duplicate model or
    duplicate simulation logic.
    """

    locality_id: str = Field(description="Locality slug identifier")
    locality_name: str = Field(description="Locality display name")
    horizon: str = Field(description="Forecast horizon used")
    date: str = Field(description="Calendar date (YYYY-MM-DD, Asia/Kolkata) the underlying forecast was generated for")
    recommendations: List[RecommendationItem] = Field(
        description="Ranked candidate interventions, highest estimated impact first"
    )
    scenario_note: str = Field(
        default=(
            "Ranking derived from a fixed moderate test scenario (cooling 30% / "
            "commercial 20% / flexible 10% / solar 50%) run through the real simulation "
            "engine. This is a model-informed scenario, not a guaranteed or optimized reduction."
        ),
        description="Explanation of the test scenario used for ranking",
    )
    method: str = Field(
        default="shap_category_mapping+simulation_ranking",
        description="Recommendation method summary",
    )
    is_demo_fallback: bool = Field(
        default=False,
        description="True if SHAP explanation or simulation fell back to demo/heuristic logic",
    )
