"""
FastAPI Router for PeakSense What-If Simulation Endpoint.

POST /api/simulate
"""

from fastapi import APIRouter, HTTPException

from app.schemas.simulation import SimulationRequest, SimulationResponse
from app.services.forecasting import DateUnavailableError
from app.services.simulation import SimulationService

router = APIRouter(prefix="/api", tags=["simulation"])


@router.post("/simulate", response_model=SimulationResponse)
def simulate(req: SimulationRequest) -> SimulationResponse:
    """
    Run a demand-response what-if simulation for the given locality.

    Returns an estimated scenario peak after applying the requested
    demand-response interventions to the real forecast baseline.

    **IMPORTANT DISCLAIMER**: This is a scenario simulator, not a
    physical power-grid model. Results are estimated demand-side effects
    using transparent documented coefficients applied to the forecast baseline.
    They do NOT represent measured grid outcomes.

    The baseline peak is fetched from the same ForecastEngine used by
    GET /api/forecast — there is no second model or duplicate prediction.

    Simulation is fully deterministic: identical inputs at the same
    wall-clock time produce identical outputs.
    """
    service = SimulationService.get_instance()
    try:
        return service.simulate(req)
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail=f"Locality '{req.locality_id}' not found"
        )
    except DateUnavailableError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Simulation error: {str(e)}"
        )
