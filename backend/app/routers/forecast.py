"""
FastAPI Router for PeakSense Forecast Endpoints.
"""

from typing import Optional, Dict
from fastapi import APIRouter, HTTPException, Query

from app.schemas.forecast import (
    ForecastAvailabilityResponse,
    ForecastResponse,
    ForecastSeriesResponse,
    ModelHorizonMetrics,
)
from app.services.forecasting import DateUnavailableError, ForecastEngine
from ml.evaluate import get_model_metrics


router = APIRouter(prefix="/api", tags=["forecast"])

VALID_HORIZONS = {"15min", "15m", "1h", "1hour", "24h", "24hour"}

DATE_QUERY_DESCRIPTION = (
    "Calendar date (YYYY-MM-DD, Asia/Kolkata) for which the forecast context is requested. "
    "Defaults to today's backend reference date if omitted. See GET /api/forecast/availability "
    "for the genuinely supported range."
)


@router.get("/forecast", response_model=ForecastResponse)
def get_forecast(
    locality_id: str = Query(..., description="Locality slug identifier, e.g. 'andheri'"),
    horizon: str = Query("24h", description="Forecast horizon ('15min', '1h', '24h')"),
    date: Optional[str] = Query(None, description=DATE_QUERY_DESCRIPTION),
) -> ForecastResponse:
    """
    Return locality demand forecast summary, multi-horizon benchmarks, and deterministic peak analysis.
    """
    if horizon.lower() not in VALID_HORIZONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid horizon '{horizon}'. Supported horizons: '15min', '1h', '24h'",
        )

    engine = ForecastEngine.get_instance()
    try:
        forecast = engine.get_forecast(locality_id=locality_id, horizon=horizon.lower(), date=date)
        return forecast
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Locality '{locality_id}' not found")
    except DateUnavailableError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {str(e)}")


@router.get("/forecast/series", response_model=ForecastSeriesResponse)
def get_forecast_series(
    locality_id: str = Query(..., description="Locality slug identifier, e.g. 'andheri'"),
    horizon: str = Query("24h", description="Forecast horizon ('15min', '1h', '24h')"),
    date: Optional[str] = Query(None, description=DATE_QUERY_DESCRIPTION),
) -> ForecastSeriesResponse:
    """
    Return detailed chronological forecast time-series points with 90% prediction intervals.
    """
    if horizon.lower() not in VALID_HORIZONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid horizon '{horizon}'. Supported horizons: '15min', '1h', '24h'",
        )

    engine = ForecastEngine.get_instance()
    try:
        series = engine.get_forecast_series(locality_id=locality_id, horizon=horizon.lower(), date=date)
        return series
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Locality '{locality_id}' not found")
    except DateUnavailableError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {str(e)}")


@router.get("/forecast/availability", response_model=ForecastAvailabilityResponse)
def get_forecast_availability() -> ForecastAvailabilityResponse:
    """
    Return the genuine, data-derived date range(s) this backend can produce
    real forecasts for — a historical backtest range and a live/future
    forecast range. Dates outside both ranges will return a clean error from
    GET /api/forecast and GET /api/forecast/series rather than fabricated data.
    """
    engine = ForecastEngine.get_instance()
    return ForecastAvailabilityResponse(**engine.get_availability())


@router.get("/model-metrics", response_model=Dict[str, ModelHorizonMetrics])
def get_metrics() -> Dict[str, ModelHorizonMetrics]:
    """
    Return calculated accuracy metrics (MAE, RMSE, MAPE) across forecast horizons (15-min, 1-hr, 24-hr).
    """
    try:
        raw_metrics = get_model_metrics()
        # Ensure proper dictionary mapping
        formatted = {}
        for h in ["15min", "1hour", "24hour"]:
            if h in raw_metrics:
                formatted[h] = ModelHorizonMetrics(
                    mae=raw_metrics[h]["mae"],
                    rmse=raw_metrics[h]["rmse"],
                    mape=raw_metrics[h]["mape"],
                )
            else:
                # Default safety fallback if key differs
                formatted[h] = ModelHorizonMetrics(mae=0.0, rmse=0.0, mape=0.0)
        return formatted
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving model metrics: {str(e)}")
