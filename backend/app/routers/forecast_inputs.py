"""
PeakSense Forecast Model Inputs Router.

GET /api/forecast/inputs?locality_id={id}&horizon={horizon}

Returns the actual feature values used by the XGBoost model at the peak-point
prediction for the requested locality and horizon.

These are NOT externally measured real-time weather values. See the
ForecastInputsResponse disclaimer and per-feature source_note fields.
"""

from fastapi import APIRouter, HTTPException, Query

from app.schemas.forecast_inputs import ForecastInputsResponse
from app.services.explanation import ExplanationEngine

router = APIRouter(prefix="/api/forecast", tags=["forecast-inputs"])


@router.get(
    "/inputs",
    response_model=ForecastInputsResponse,
    summary="Get actual XGBoost model input feature values at the peak prediction point",
    description=(
        "Returns the real feature values supplied to the model during inference. "
        "Includes provenance (source/source_note) for each feature. "
        "Values are model-computed or historical — not external sensor readings."
    ),
)
async def get_forecast_inputs(
    locality_id: str = Query(..., description="Locality slug, e.g. 'andheri'"),
    horizon: str = Query(
        default="1h",
        description="Forecast horizon: '15min', '1h', or '24h'",
    ),
) -> ForecastInputsResponse:
    try:
        engine = ExplanationEngine.get_instance()
        return engine.get_forecast_inputs(locality_id=locality_id, horizon=horizon)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Forecast inputs failed: {exc}") from exc
