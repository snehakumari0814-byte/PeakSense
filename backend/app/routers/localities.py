from fastapi import APIRouter, HTTPException

from app.models import Locality
from app.seed_data import LOCALITIES, LOCALITIES_BY_ID

router = APIRouter(prefix="/api/localities", tags=["localities"])


@router.get("", response_model=list[Locality])
def list_localities() -> list[Locality]:
    """Return the prototype Mumbai locality list (DEMO/SEEDED data)."""
    return LOCALITIES


@router.get("/{locality_id}", response_model=Locality)
def get_locality(locality_id: str) -> Locality:
    """Return the full profile for one prototype locality (DEMO/SEEDED data)."""
    locality = LOCALITIES_BY_ID.get(locality_id)
    if locality is None:
        raise HTTPException(status_code=404, detail=f"Locality '{locality_id}' not found")
    return locality
