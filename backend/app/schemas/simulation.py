"""
Pydantic Schemas for PeakSense Demand-Response What-If Simulation API.

IMPORTANT DISCLAIMER:
This is a DEMAND-RESPONSE SCENARIO SIMULATOR, not a physical power-grid simulator.
Simulated values represent estimated demand-side response effects applied to a
forecast baseline. They do NOT represent actual measured grid outcomes, physical
load-flow calculations, or validated distribution network behaviour.

All intervention coefficients are documented transparent assumptions.
"""

from typing import List, Literal, Optional
from pydantic import BaseModel, Field, model_validator

from app.schemas.forecast import RiskLevel


# ─── Request ──────────────────────────────────────────────────────────────────

class SimulationRequest(BaseModel):
    """
    Demand-response simulation request.

    All intervention values are fractions (0.0 – 1.0) representing the
    activation level of each measure, not percentage points of demand reduction.
    The backend applies transparent coefficients (documented in SimulationService)
    to convert activation levels to estimated demand reductions.
    """

    locality_id: str = Field(
        description="Locality slug identifier, e.g. 'andheri'"
    )
    horizon: Literal["15min", "1h", "24h"] = Field(
        default="1h",
        description="Forecast horizon whose peak is used as the simulation baseline"
    )
    date: Optional[str] = Field(
        default=None,
        description=(
            "Calendar date (YYYY-MM-DD, Asia/Kolkata) whose forecast is used as the "
            "simulation baseline. Defaults to today's backend reference date if omitted."
        ),
    )
    cooling_shift: float = Field(
        default=0.0,
        ge=0.0,
        le=0.5,
        description=(
            "Cooling load shifting activation level (0.0 – 0.5). "
            "0.5 means 50% of flexible cooling load is shifted outside the peak window. "
            "Maximum activation is capped at 0.5 (50%)."
        )
    )
    commercial_shift: float = Field(
        default=0.0,
        ge=0.0,
        le=0.5,
        description=(
            "Commercial demand shifting activation level (0.0 – 0.5). "
            "0.5 means 50% of flexible commercial load is shifted. "
            "Maximum activation is capped at 0.5 (50%)."
        )
    )
    flexible_load: float = Field(
        default=0.0,
        ge=0.0,
        le=0.5,
        description=(
            "Flexible load rescheduling activation level (0.0 – 0.5). "
            "0.5 means 50% of schedulable loads are moved outside the peak window. "
            "Maximum activation is capped at 0.5 (50%)."
        )
    )
    solar_utilization: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description=(
            "Rooftop solar utilization activation level (0.0 – 1.0). "
            "1.0 means 100% of the locality's installed solar_capacity_mw is dispatched. "
            "Actual offset is capped by the locality's solar_capacity_mw."
        )
    )

    @model_validator(mode="after")
    def check_at_least_valid(self) -> "SimulationRequest":
        # All fields are already validated by ge/le constraints.
        # This validator exists as a hook for future cross-field rules.
        return self


# ─── Response ─────────────────────────────────────────────────────────────────

class InterventionEffect(BaseModel):
    """Contribution of one demand-response intervention to peak reduction."""

    key: str = Field(description="Intervention identifier matching SimulationRequest field name")
    label: str = Field(description="Human-readable intervention label")
    activation_level: float = Field(description="Input activation level (0.0 – 1.0)")
    estimated_reduction_mw: float = Field(
        description=(
            "Estimated peak demand reduction in MW. "
            "This is a scenario estimate, not a validated grid measurement."
        )
    )


class ScenarioSeriesPoint(BaseModel):
    """
    One time-series point in the scenario chart.

    baseline_mw: the forecast-series predicted value for this point.
    simulated_mw: baseline_mw × (1 - reductionFraction), clamped to ≥0.
    threshold_mw: locality threshold repeated per-point for easy chart rendering.

    The reduction fraction is total_reduction_mw / baseline_peak_mw, so the
    maximum simulated_mw across all points equals scenario_peak_mw (to 1 d.p.).
    """

    timestamp: str = Field(description="ISO 8601 timestamp of this forecast point")
    time: str = Field(description="HH:MM display time for chart axis")
    baseline_mw: float = Field(description="Baseline forecast demand at this point (MW)")
    simulated_mw: float = Field(
        description="Estimated demand after interventions at this point (MW)"
    )
    threshold_mw: float = Field(
        description="Locality peak threshold for chart reference line (MW)"
    )


class SimulationResponse(BaseModel):
    """
    Demand-response simulation result.

    IMPORTANT: All scenario values are ESTIMATES computed by applying
    documented demand-response coefficients to the forecast baseline.
    They do NOT represent actual measured grid outcomes.

    The baseline peak comes from the same ForecastEngine used by GET /api/forecast.
    Risk levels use the same analyze_peak() thresholds used throughout PeakSense.

    scenario_series is generated on the backend so the frontend can render the
    chart without any independent calculation. The maximum simulated_mw across
    all scenario_series points equals scenario_peak_mw (to 1 d.p. rounding).
    """

    locality_id: str = Field(description="Locality slug identifier")
    locality_name: str = Field(description="Locality display name")
    horizon: str = Field(description="Forecast horizon used for baseline")
    date: str = Field(description="Calendar date (YYYY-MM-DD, Asia/Kolkata) the baseline forecast was generated for")

    # Baseline (from real ForecastEngine)
    baseline_peak_mw: float = Field(description="Forecast baseline peak demand in MW")
    baseline_peak_time: str = Field(description="Time of forecast baseline peak (HH:MM)")
    baseline_risk: RiskLevel = Field(description="Risk level at baseline demand")
    threshold_mw: float = Field(description="Locality peak capacity threshold in MW")

    # Scenario (after interventions)
    scenario_peak_mw: float = Field(description="Estimated peak demand after interventions in MW")
    scenario_peak_time: str = Field(
        description=(
            "Estimated time of scenario peak (HH:MM). "
            "This simulator does not model temporal load-shifting; "
            "peak timing remains as the baseline forecast."
        )
    )
    scenario_risk: RiskLevel = Field(description="Risk level at scenario demand (same thresholds as baseline)")
    peak_avoided: bool = Field(
        description="True if scenario_peak_mw < threshold_mw (threshold not crossed)"
    )
    exceedance_mw: float = Field(
        description="Amount by which scenario peak exceeds threshold (0.0 if peak_avoided)"
    )

    # Reduction summary
    reduction_mw: float = Field(description="Total estimated demand reduction in MW")
    reduction_pct: float = Field(description="Reduction as percentage of baseline peak")

    # Per-intervention breakdown (backend-generated, no frontend recalculation)
    interventions: List[InterventionEffect] = Field(
        description="Per-intervention estimated reduction breakdown"
    )

    # Scenario chart time series (backend-generated)
    scenario_series: List[ScenarioSeriesPoint] = Field(
        description=(
            "Per-point scenario chart data. baseline_mw comes from the real "
            "forecast series; simulated_mw = baseline_mw × (1 - reduction_fraction). "
            "max(simulated_mw) == scenario_peak_mw (±0.1 MW rounding)."
        )
    )

    # Inputs echoed back
    inputs: SimulationRequest = Field(description="Echo of the simulation request inputs")

    # Metadata
    simulation_method: str = Field(
        default=(
            "demand_response_coefficient_model: "
            "linear activation × coefficient × baseline_peak for cooling/commercial/flexible; "
            "activation × solar_capacity_mw for solar; "
            "scenario_series: baseline_mw × (1 - total_reduction_mw / baseline_peak_mw)"
        ),
        description="Simulation method and assumptions summary"
    )
    is_demo_fallback: bool = Field(
        default=False,
        description="Always False for a successful backend simulation"
    )
