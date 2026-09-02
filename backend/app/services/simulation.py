"""
PeakSense Demand-Response What-If Simulation Service.

╔══════════════════════════════════════════════════════════════════════════════╗
║  DISCLAIMER — READ BEFORE MODIFYING                                         ║
║                                                                              ║
║  This is a DEMAND-RESPONSE SCENARIO SIMULATOR, not a physical power-grid    ║
║  simulator. It does NOT:                                                     ║
║    • Model power-flow equations or impedance-based load redistribution.     ║
║    • Simulate transformer loading, feeder constraints, or voltage profiles. ║
║    • Account for reactive power, power factor, or harmonic effects.         ║
║    • Produce validated engineering outcomes.                                 ║
║                                                                              ║
║  What it DOES do:                                                            ║
║    • Take the real forecast baseline from ForecastEngine (same source as    ║
║      GET /api/forecast — no second model, no second prediction).            ║
║    • Apply transparent, documented demand-response coefficients to produce   ║
║      an estimated demand reduction for each intervention.                    ║
║    • Apply the same analyze_peak() risk thresholds used everywhere else     ║
║      in PeakSense to the scenario peak.                                     ║
║    • Return deterministic results: same inputs → same outputs, always.      ║
╚══════════════════════════════════════════════════════════════════════════════╝

Intervention Coefficient Assumptions
──────────────────────────────────────
These coefficients represent what fraction of the baseline peak each
intervention can shave OFF AT MAXIMUM ACTIVATION (1.0). They are calibrated
to be plausible for a dense Indian urban locality but are NOT measured values.

  cooling_shift    × 0.24 × baseline_peak_mw
      Rationale: In a mixed residential-commercial area ~30–40°C ambient,
      cooling load (AC) is typically 20–30% of total demand. Shifting
      up to 50% of flexible cooling outside the peak window → up to 12%
      of total peak reduction. Coefficient 0.24 encodes the full-activation
      scenario (slider max 0.5 × coeff 0.24 × peak = 12% of peak).

  commercial_shift × 0.20 × baseline_peak_mw
      Rationale: Commercial loads (lighting, HVAC, process) are ~30–45% of
      total mixed-locality demand. Flexible commercial share that can shift
      is estimated at ~25%, giving up to ~10% peak reduction at full
      activation. Coefficient 0.20 encodes full-activation scenario.

  flexible_load    × 0.16 × baseline_peak_mw
      Rationale: EV charging, water heating, non-urgent industrial loads,
      and flexible residential loads. Estimated at ~15–20% of total demand,
      with ~50% re-schedulable, giving ~8% peak reduction. Coefficient 0.16.

  solar_utilization × solar_capacity_mw (from locality seed data)
      Rationale: Solar is dispatched at the locality's installed capacity
      (MW), independent of peak magnitude. At full activation (1.0), the
      full solar_capacity_mw is counted as a direct offset to peak demand.
      This is capped by the physical installed capacity, not a ratio of peak.

  Total achievable reduction with all interventions at maximum:
      Andheri (peak 289 MW, solar 4.2 MW):
        cooling:    0.5 × 0.24 × 289 = 34.7 MW
        commercial: 0.5 × 0.20 × 289 = 28.9 MW
        flexible:   0.5 × 0.16 × 289 = 23.1 MW
        solar:      1.0 × 4.2        =  4.2 MW
        Total: ~90.9 MW (~31% of peak)
"""

from typing import List

from app.seed_data import LOCALITIES_BY_ID
from app.schemas.simulation import (
    InterventionEffect,
    ScenarioSeriesPoint,
    SimulationRequest,
    SimulationResponse,
)
from app.schemas.forecast import RiskLevel
from app.services.forecasting import ForecastEngine


# ─── Intervention coefficients ─────────────────────────────────────────────────
# These match the frontend's INTERVENTION_COEFFICIENTS in src/lib/simulator.ts
# to ensure the backend and client-side fallback produce consistent results.

COOLING_SHIFT_COEFF = 0.24
COMMERCIAL_SHIFT_COEFF = 0.20
FLEXIBLE_LOAD_COEFF = 0.16
# Solar uses solar_capacity_mw directly — no coefficient multiplier


# ─── Risk calculation ──────────────────────────────────────────────────────────
# Must match the thresholds in app/services/peak_detection.py → analyze_peak()

def _risk_from_ratio(peak_mw: float, threshold_mw: float) -> RiskLevel:
    """
    Classify demand risk using the same thresholds as analyze_peak().
    CRITICAL: peak >= 1.05 × threshold
    HIGH:     peak >= 1.00 × threshold
    MEDIUM:   peak >= 0.90 × threshold
    LOW:      peak <  0.90 × threshold
    """
    if threshold_mw <= 0:
        return RiskLevel.LOW
    ratio = peak_mw / threshold_mw
    if ratio >= 1.05:
        return RiskLevel.CRITICAL
    if ratio >= 1.00:
        return RiskLevel.HIGH
    if ratio >= 0.90:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


def _round1(v: float) -> float:
    """Round to 1 decimal place."""
    return round(v, 1)


# ─── Simulation service ────────────────────────────────────────────────────────

class SimulationService:
    """
    Singleton demand-response simulation service.

    Uses the ForecastEngine (singleton) to obtain the baseline peak for
    the requested locality and horizon. No separate forecast request is made.
    """

    _instance = None

    @classmethod
    def get_instance(cls) -> "SimulationService":
        if cls._instance is None:
            cls._instance = SimulationService()
        return cls._instance

    def simulate(self, req: SimulationRequest) -> SimulationResponse:
        """
        Run a demand-response scenario simulation.

        Steps:
          1. Validate locality exists.
          2. Fetch baseline forecast summary from ForecastEngine.
          3. Fetch baseline forecast series from ForecastEngine.
          4. Compute per-intervention estimated reductions using documented coefficients.
          5. Compute scenario peak = max(0, baseline_peak - total_reduction).
          6. Compute per-point scenario series using the same reduction fraction.
             reduction_fraction = total_reduction_mw / baseline_peak_mw
             simulated_mw[i] = max(0, baseline_mw[i] × (1 - reduction_fraction))
             This guarantees: max(simulated_mw) == scenario_peak_mw (±0.1 rounding).
          7. Compute scenario risk using the same thresholds as analyze_peak().
          8. Return deterministic, fully documented response.
        """
        locality = LOCALITIES_BY_ID.get(req.locality_id)
        if locality is None:
            raise KeyError(f"Locality '{req.locality_id}' not found")

        # ── Step 1: Get real forecast baseline summary ─────────────────────
        engine = ForecastEngine.get_instance()
        forecast = engine.get_forecast(locality_id=req.locality_id, horizon=req.horizon)

        baseline_peak_mw = float(forecast.peak.peak_mw)
        baseline_peak_time = str(forecast.peak.peak_time)
        threshold_mw = float(forecast.peak.threshold_mw)
        baseline_risk = forecast.peak.risk

        # ── Step 2: Compute per-intervention reductions ─────────────────────
        cooling_reduction = _round1(
            req.cooling_shift * COOLING_SHIFT_COEFF * baseline_peak_mw
        )
        commercial_reduction = _round1(
            req.commercial_shift * COMMERCIAL_SHIFT_COEFF * baseline_peak_mw
        )
        flexible_reduction = _round1(
            req.flexible_load * FLEXIBLE_LOAD_COEFF * baseline_peak_mw
        )
        solar_reduction = _round1(
            req.solar_utilization * locality.solar_capacity_mw
        )

        interventions: List[InterventionEffect] = [
            InterventionEffect(
                key="cooling_shift",
                label="Cooling load shifting",
                activation_level=req.cooling_shift,
                estimated_reduction_mw=cooling_reduction,
            ),
            InterventionEffect(
                key="commercial_shift",
                label="Commercial demand shifting",
                activation_level=req.commercial_shift,
                estimated_reduction_mw=commercial_reduction,
            ),
            InterventionEffect(
                key="flexible_load",
                label="Flexible load rescheduling",
                activation_level=req.flexible_load,
                estimated_reduction_mw=flexible_reduction,
            ),
            InterventionEffect(
                key="solar_utilization",
                label="Rooftop solar utilization",
                activation_level=req.solar_utilization,
                estimated_reduction_mw=solar_reduction,
            ),
        ]

        # ── Step 3: Compute scenario peak ────────────────────────────────────
        total_reduction_mw = _round1(
            cooling_reduction + commercial_reduction + flexible_reduction + solar_reduction
        )
        scenario_peak_mw = _round1(max(0.0, baseline_peak_mw - total_reduction_mw))

        # ── Step 4: Compute reduction percentage ─────────────────────────────
        if baseline_peak_mw > 0:
            reduction_pct = _round1((total_reduction_mw / baseline_peak_mw) * 100.0)
        else:
            reduction_pct = 0.0

        # ── Step 5: Build scenario time-series (backend-generated) ───────────
        #
        # Method: proportional reduction applied uniformly to every point.
        #   reduction_fraction = total_reduction_mw / baseline_peak_mw
        #   simulated_mw[i]   = max(0, baseline_mw[i] × (1 − reduction_fraction))
        #
        # This ensures: max(simulated_mw[i]) ≈ scenario_peak_mw (±0.1 rounding)
        # because the baseline series maximum is baseline_peak_mw.
        #
        # Assumption: interventions reduce demand uniformly across the horizon.
        # This is the same assumption used to compute scenario_peak_mw, so the
        # chart is internally consistent with the summary cards.
        series_response = engine.get_forecast_series(
            locality_id=req.locality_id,
            horizon=req.horizon,
        )

        reduction_fraction = (
            total_reduction_mw / baseline_peak_mw if baseline_peak_mw > 0 else 0.0
        )

        scenario_series: List[ScenarioSeriesPoint] = []
        for point in series_response.points:
            # Parse HH:MM display time from ISO timestamp
            ts = point.timestamp
            if "T" in ts:
                time_str = ts.split("T")[1][:5]
            else:
                time_str = ts[-8:-3] if len(ts) >= 8 else ts

            # baseline_mw for this chart point (use actual_mw if present, else predicted)
            baseline_mw = float(
                point.actual_mw if point.actual_mw is not None else point.predicted_mw
            )
            simulated_mw = _round1(max(0.0, baseline_mw * (1.0 - reduction_fraction)))

            scenario_series.append(
                ScenarioSeriesPoint(
                    timestamp=ts,
                    time=time_str,
                    baseline_mw=_round1(baseline_mw),
                    simulated_mw=simulated_mw,
                    threshold_mw=_round1(threshold_mw),
                )
            )

        # ── Step 6: Compute scenario risk ─────────────────────────────────────
        scenario_risk = _risk_from_ratio(scenario_peak_mw, threshold_mw)
        peak_avoided = scenario_peak_mw < threshold_mw
        exceedance_mw = _round1(max(0.0, scenario_peak_mw - threshold_mw))

        # Scenario peak time: this simulator does not model temporal shifting.
        scenario_peak_time = baseline_peak_time

        return SimulationResponse(
            locality_id=locality.id,
            locality_name=locality.name,
            horizon=req.horizon,
            baseline_peak_mw=baseline_peak_mw,
            baseline_peak_time=baseline_peak_time,
            baseline_risk=baseline_risk,
            threshold_mw=threshold_mw,
            scenario_peak_mw=scenario_peak_mw,
            scenario_peak_time=scenario_peak_time,
            scenario_risk=scenario_risk,
            peak_avoided=peak_avoided,
            exceedance_mw=exceedance_mw,
            reduction_mw=total_reduction_mw,
            reduction_pct=reduction_pct,
            interventions=interventions,
            scenario_series=scenario_series,
            inputs=req,
            is_demo_fallback=False,
        )
