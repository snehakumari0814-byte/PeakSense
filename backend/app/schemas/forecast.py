"""
Pydantic Schemas for PeakSense Forecasting & Peak Detection APIs.
"""

from typing import List, Optional, Dict
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict


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
    points: List[ForecastPoint] = Field(description="Chronological forecast time-series points")
    is_demo_fallback: bool = Field(default=False, description="Flag indicating if demo fallback was used")


class ModelHorizonMetrics(BaseModel):
    mae: float = Field(description="Mean Absolute Error in MW")
    rmse: float = Field(description="Root Mean Squared Error in MW")
    mape: float = Field(description="Mean Absolute Percentage Error in %")


class ModelMetricsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    fifteen_min: ModelHorizonMetrics = Field(..., alias="15min")
    one_hour: ModelHorizonMetrics = Field(..., alias="1hour")
    twenty_four_hour: ModelHorizonMetrics = Field(..., alias="24hour")

