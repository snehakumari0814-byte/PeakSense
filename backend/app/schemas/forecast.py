"""
Pydantic Schemas for PeakSense Forecasting & Peak Detection APIs.
"""

from typing import List, Literal, Optional, Dict
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict


DataMode = Literal["historical", "current", "future"]


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ForecastHorizon(str, Enum):
    FIFTEEN_MIN = "15min"
    ONE_HOUR = "1h"
    TWENTY_FOUR_HOUR = "24h"


class ForecastValues(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    fifteen_min_mw: float = Field(..., alias="15min_mw", description="Projected demand 15 minutes ahead in MW")
    one_hour_mw: float = Field(..., alias="1hour_mw", description="Projected demand 1 hour ahead in MW")
    twenty_four_hour_peak_mw: float = Field(..., alias="24hour_peak_mw", description="Projected maximum peak demand over next 24 hours in MW")


class PeakAnalysis(BaseModel):
    peak_mw: float = Field(description="Maximum forecasted demand in MW within the horizon")
    peak_time: str = Field(description="Time or timestamp of the projected peak (e.g. '19:15' or ISO string)")
    threshold_mw: float = Field(description="Locality peak threshold limit in MW")
    risk: RiskLevel = Field(description="Deterministic peak risk category (LOW, MEDIUM, HIGH, CRITICAL)")
    probability: Optional[float] = Field(None, description="Statistical probability of exceeding threshold (0.0 - 1.0)")
    exceedance_mw: Optional[float] = Field(None, description="Amount by which peak exceeds threshold in MW")
    peak_window: Optional[str] = Field(None, description="Estimated time window of peak strain, e.g. '18:30 - 21:00'")


class ForecastResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    locality_id: str = Field(description="Locality slug identifier, e.g. 'andheri'")
    locality_name: str = Field(description="Display name of the locality")
    current_demand_mw: float = Field(description="Current baseline demand in MW")
    date: str = Field(description="Calendar date (YYYY-MM-DD, Asia/Kolkata) this forecast was generated for")
    data_mode: DataMode = Field(
        description=(
            "How this forecast was produced: 'historical' = genuine backtest using real "
            "stored features for a past date; 'current' = live autoregressive forecast for "
            "today; 'future' = autoregressive extrapolation for a date ahead of today"
        )
    )
    forecast: ForecastValues = Field(description="Multi-horizon demand forecasts in MW")
    peak: PeakAnalysis = Field(description="Deterministic peak risk analysis")
    confidence: float = Field(description="Statistical model confidence score (0.0 - 1.0)")
    is_demo_fallback: bool = Field(default=False, description="Flag indicating if demo fallback logic was used")


class ForecastPoint(BaseModel):
    timestamp: str = Field(description="ISO 8601 formatted timestamp with timezone offset")
    actual_mw: Optional[float] = Field(None, description="Historical actual demand measurement if available in MW")
    predicted_mw: float = Field(description="Model predicted demand in MW")
    lower_bound_mw: Optional[float] = Field(None, description="90% prediction interval lower bound in MW")
    upper_bound_mw: Optional[float] = Field(None, description="90% prediction interval upper bound in MW")


class ForecastSeriesResponse(BaseModel):
    locality_id: str = Field(description="Locality slug identifier")
    horizon: str = Field(description="Forecast horizon requested ('15min', '1h', '24h')")
    unit: str = Field(default="MW", description="Measurement unit")
    date: str = Field(description="Calendar date (YYYY-MM-DD, Asia/Kolkata) this series was generated for")
    data_mode: DataMode = Field(
        description="How this series was produced: 'historical', 'current', or 'future' (see ForecastResponse.data_mode)"
    )
    points: List[ForecastPoint] = Field(description="Chronological forecast time-series points")
    is_demo_fallback: bool = Field(default=False, description="Flag indicating if demo fallback was used")


class DateRange(BaseModel):
    start: str = Field(description="Range start date (YYYY-MM-DD, inclusive)")
    end: str = Field(description="Range end date (YYYY-MM-DD, inclusive)")


class ForecastAvailabilityResponse(BaseModel):
    """
    Genuine, data-derived date availability for GET /api/forecast and
    GET /api/forecast/series. A date is servable if it falls in
    historical_range (real backtest) OR forecastable_range (live/future
    autoregressive forecast) — dates strictly between the two ranges are a
    real gap in the underlying dataset and are NOT available.
    """

    reference_date: str = Field(description="Backend's current calendar date (YYYY-MM-DD, Asia/Kolkata)")
    historical_range: Optional[DateRange] = Field(
        None, description="Inclusive range of real historical dates available for genuine backtesting"
    )
    forecastable_range: DateRange = Field(
        description="Inclusive range from today through the maximum supported future forecast date"
    )
    min_date: str = Field(description="Earliest genuinely supported date across both ranges")
    max_date: str = Field(description="Latest genuinely supported date across both ranges")


class ModelHorizonMetrics(BaseModel):
    mae: float = Field(description="Mean Absolute Error in MW")
    rmse: float = Field(description="Root Mean Squared Error in MW")
    mape: float = Field(description="Mean Absolute Percentage Error in %")


class ModelMetricsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    fifteen_min: ModelHorizonMetrics = Field(..., alias="15min")
    one_hour: ModelHorizonMetrics = Field(..., alias="1hour")
    twenty_four_hour: ModelHorizonMetrics = Field(..., alias="24hour")

