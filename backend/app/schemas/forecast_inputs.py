"""
Pydantic Schemas for PeakSense Forecast Model Inputs API.

IMPORTANT DISCLAIMER:
The feature values returned here are the ACTUAL values used by the XGBoost
model during inference for the peak-point prediction. They are NOT externally
measured real-time weather data.

Sources:
  temperature_c          — diurnal formula: 28 + 5×sin(π×(hour−6)/12) for daytime
  relative_humidity_pct  — fixed assumption: 78% (Mumbai monsoon season estimate)
  solar_irradiance_wm2   — diurnal formula: 700×sin(π×(hour−6)/12) for daytime
  lag_1_mw               — actual most-recent historical demand value (MW)
  hour / day_of_week etc — wall-clock calendar values at the peak-point step
  cooling_degree_index   — derived: max(0, temperature_c − 24.0)
  is_holiday             — fixed assumption: 0 (no holiday detection implemented)

These values ARE deterministic and ARE what the model actually received. They
are NOT external sensor readings. The UI must communicate this distinction.
"""

from typing import Literal
from pydantic import BaseModel, Field


class ForecastInputFeature(BaseModel):
    """A single model input feature with its value and provenance."""

    feature: str = Field(description="Raw feature name as used in the model")
    label: str = Field(description="Human-readable label")
    value: float = Field(description="Actual value supplied to the model for this feature")
    unit: str = Field(description="Unit string for display (e.g. '°C', '%', 'MW', '')")
    source: Literal[
        "historical_lag",    # actual historical demand from loaded CSV
        "model_computed",    # diurnal formula or derived value
        "fixed_assumption",  # constant assumed value (e.g. humidity=78, is_holiday=0)
        "calendar",          # wall-clock value (hour, day_of_week, etc.)
    ] = Field(description="Provenance of this feature value")
    source_note: str = Field(
        description="Short honest note about how this value was obtained"
    )


class ForecastInputsResponse(BaseModel):
    """
    Actual model input feature values for the peak-point prediction.

    These are the real values supplied to the XGBoost model during inference.
    They are NOT externally-measured sensor readings.
    See source/source_note per feature for provenance.
    """

    locality_id: str = Field(description="Locality slug identifier")
    locality_name: str = Field(description="Locality display name")
    horizon: str = Field(description="Forecast horizon used")
    date: str = Field(
        default="",
        description="Calendar date (YYYY-MM-DD, Asia/Kolkata) these input features correspond to",
    )
    peak_hour: int = Field(
        description="Hour (0–23) of the predicted peak step within the horizon"
    )
    features: list[ForecastInputFeature] = Field(
        description="Key model input features at the peak prediction step"
    )
    disclaimer: str = Field(
        default=(
            "Feature values are model-computed or historical — not real-time sensor data. "
            "Temperature and solar irradiance use diurnal approximation formulas. "
            "Humidity and holiday flag are fixed assumptions."
        ),
        description="Honest provenance disclaimer"
    )
    is_demo_fallback: bool = Field(
        default=False,
        description="True if the model was not available and fallback values were used"
    )
