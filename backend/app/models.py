from enum import Enum

from pydantic import BaseModel, Field


class DemandProfile(str, Enum):
    """Broad shape of a locality's daily demand curve. DEMO categorisation only."""

    RESIDENTIAL_EVENING_PEAK = "residential_evening_peak"
    COMMERCIAL_DAYTIME_PEAK = "commercial_daytime_peak"
    MIXED_DUAL_PEAK = "mixed_dual_peak"
    INDUSTRIAL_FLAT = "industrial_flat"


class Locality(BaseModel):
    """
    A prototype Mumbai locality zone used for the PeakSense hackathon demo.

    NOTE: These zones and all numeric fields are SEEDED/DEMO data for
    prototyping the Digital Twin. They are NOT official electricity-grid
    boundaries and NOT real utility measurements.
    """

    id: str = Field(description="Stable slug identifier, e.g. 'andheri'")
    name: str = Field(description="Display name of the locality")
    latitude: float = Field(description="Approximate DEMO latitude of the locality centroid")
    longitude: float = Field(description="Approximate DEMO longitude of the locality centroid")
    residential_share: float = Field(
        ge=0, le=1, description="DEMO share of demand attributed to residential load (0-1)"
    )
    commercial_share: float = Field(
        ge=0, le=1, description="DEMO share of demand attributed to commercial load (0-1)"
    )
    solar_capacity_mw: float = Field(
        ge=0, description="DEMO installed rooftop/local solar capacity in MW"
    )
    typical_peak_hour: int = Field(
        ge=0, le=23, description="DEMO hour of day (0-23) when demand typically peaks"
    )
    demand_profile: DemandProfile = Field(description="DEMO categorical demand curve shape")
    cooling_sensitivity: float = Field(
        ge=0, le=1, description="DEMO sensitivity of demand to ambient temperature/cooling load (0-1)"
    )
    current_demand_mw: float = Field(ge=0, description="DEMO current simulated demand in MW")
    peak_threshold_mw: float = Field(
        ge=0, description="DEMO threshold above which the locality is considered at peak risk"
    )
