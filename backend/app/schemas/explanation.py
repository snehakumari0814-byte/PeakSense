"""
Pydantic Schemas for PeakSense SHAP Explanation API.
"""

from typing import List, Literal
from pydantic import BaseModel, Field


class FeatureContribution(BaseModel):
    """A single SHAP feature contribution to the model prediction."""

    feature: str = Field(description="Raw feature name, e.g. 'lag_28'")
    label: str = Field(description="Human-readable feature label, e.g. '4-week lagged demand'")
    shap_value_mw: float = Field(
        description="SHAP contribution in MW (positive = pushes prediction up, negative = pushes down)"
    )
    direction: Literal["increase", "decrease"] = Field(
        description="Whether this feature pushes the prediction above or below the baseline"
    )
    feature_value: float = Field(
        description="Actual input value of this feature used for this prediction"
    )
    category: str = Field(
        description="Feature category: 'temporal', 'lag', 'rolling', 'weather', 'solar'"
    )


class ExplanationResponse(BaseModel):
    """
    SHAP-based explanation for a single locality forecast prediction.

    The prediction_mw is the model output for the peak point within the
    requested horizon. SHAP values decompose that prediction into additive
    feature contributions relative to the model's expected output (base_value_mw).

    Mathematical identity: prediction_mw ≈ base_value_mw + sum(shap_value_mw for all drivers)
    """

    locality_id: str = Field(description="Locality slug identifier")
    locality_name: str = Field(description="Display name of the locality")
    horizon: str = Field(description="Forecast horizon ('15min', '1h', '24h')")
    prediction_mw: float = Field(
        description="Model predicted bulk Mumbai demand (MW) for the peak point"
    )
    locality_prediction_mw: float = Field(
        description="Locality-scaled predicted peak demand in MW"
    )
    base_value_mw: float = Field(
        description="SHAP expected model output (average training prediction) in MW"
    )
    drivers: List[FeatureContribution] = Field(
        description="Top-N SHAP feature contributions, sorted by |shap_value_mw| descending"
    )
    summary: str = Field(
        description="Deterministic human-readable summary derived from SHAP drivers"
    )
    method: Literal["SHAP_TreeExplainer"] = Field(
        default="SHAP_TreeExplainer",
        description="Explanation method used"
    )
    is_demo_fallback: bool = Field(
        default=False,
        description="True if SHAP could not be computed and a fallback was used"
    )
