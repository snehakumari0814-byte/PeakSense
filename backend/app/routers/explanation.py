"""
FastAPI Router for PeakSense SHAP Explanation Endpoint.
"""

from fastapi import APIRouter, HTTPException, Query

from app.schemas.explanation import ExplanationResponse
from app.services.explanation import ExplanationEngine

router = APIRouter(prefix="/api", tags=["explanation"])

VALID_HORIZONS = {"15min", "15m", "1h", "1hour", "24h", "24hour"}


@router.get("/explanation", response_model=ExplanationResponse)
def get_explanation(
    locality_id: str = Query(..., description="Locality slug identifier, e.g. 'andheri'"),
    horizon: str = Query("24h", description="Forecast horizon ('15min', '1h', '24h')"),
    top_n: int = Query(8, ge=1, le=23, description="Number of top SHAP drivers to return"),
) -> ExplanationResponse:
    """
    Return SHAP TreeExplainer feature contributions for the peak-point
    forecast prediction for a given locality and horizon.

    The explanation corresponds directly to the XGBoost model prediction
    served by GET /api/forecast — same feature vector, same model output.

    SHAP values are in bulk Mumbai MW units (the model's native scale).
    They are labelled clearly in the response so that consumers can
    communicate honestly about the model's scope.

    Mathematical identity:
      prediction_mw ≈ base_value_mw + sum(driver.shap_value_mw)
    """
    if horizon.lower() not in VALID_HORIZONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid horizon '{horizon}'. Supported: '15min', '1h', '24h'",
        )

    engine = ExplanationEngine.get_instance()
    try:
        result = engine.get_explanation(
            locality_id=locality_id,
            horizon=horizon.lower(),
            top_n=top_n,
        )
        return result
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Locality '{locality_id}' not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explanation error: {str(e)}")
