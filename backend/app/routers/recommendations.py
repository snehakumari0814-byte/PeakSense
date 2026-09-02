"""
FastAPI Router for PeakSense Recommendation Engine Endpoint.

GET /api/recommendations
"""

from fastapi import APIRouter, HTTPException, Query

from app.schemas.recommendations import RecommendationsResponse
from app.services.recommendations import RecommendationEngine

router = APIRouter(prefix="/api", tags=["recommendations"])

VALID_HORIZONS = {"15min", "15m", "1h", "1hour", "24h", "24hour"}


@router.get("/recommendations", response_model=RecommendationsResponse)
def get_recommendations(
    locality_id: str = Query(..., description="Locality slug identifier, e.g. 'andheri'"),
    horizon: str = Query("1h", description="Forecast horizon ('15min', '1h', '24h')"),
) -> RecommendationsResponse:
    """
    Return ranked, model-informed demand-response recommendations.

    Pipeline: real SHAP explanation (GET /api/explanation) -> deterministic
    category-to-intervention mapping -> real SimulationService test scenario
    -> rank by estimated MW impact. No separate model, no random values.
    """
    if horizon.lower() not in VALID_HORIZONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid horizon '{horizon}'. Supported horizons: '15min', '1h', '24h'",
        )

    engine = RecommendationEngine.get_instance()
    try:
        return engine.get_recommendations(locality_id=locality_id, horizon=horizon.lower())
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Locality '{locality_id}' not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation error: {str(e)}")
