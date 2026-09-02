"""
Automated Pytest Suite for PeakSense POST /api/simulate Endpoint.

Tests:
- Valid simulation request with all interventions
- Zero-intervention scenario (baseline passthrough)
- Maximum intervention scenario
- All supported horizons
- Determinism (repeated identical requests)
- Risk calculation consistency
- Threshold crossing / peak_avoided logic
- Invalid locality → 404
- Invalid percentage ranges → 422
- Malformed request body → 422
- Per-intervention breakdown sanity
- Reduction math verification
"""

from fastapi.testclient import TestClient
from app.main import app
from app.seed_data import LOCALITIES

client = TestClient(app)

VALID_BODY = {
    "locality_id": "andheri",
    "horizon": "1h",
    "cooling_shift": 0.3,
    "commercial_shift": 0.2,
    "flexible_load": 0.1,
    "solar_utilization": 0.5,
}


# ─── 1. BASIC VALID REQUEST ───────────────────────────────────────────────────

def test_simulate_valid_request():
    """POST with a valid body returns 200 and correct schema."""
    res = client.post("/api/simulate", json=VALID_BODY)
    assert res.status_code == 200, res.text
    body = res.json()

    required = [
        "locality_id", "locality_name", "horizon",
        "baseline_peak_mw", "baseline_peak_time", "baseline_risk",
        "threshold_mw",
        "scenario_peak_mw", "scenario_peak_time", "scenario_risk",
        "peak_avoided", "exceedance_mw",
        "reduction_mw", "reduction_pct",
        "interventions", "scenario_series", "inputs",
        "simulation_method", "is_demo_fallback",
    ]
    for field in required:
        assert field in body, f"Missing field: {field}"

    assert body["locality_id"] == "andheri"
    assert body["locality_name"] == "Andheri"
    assert body["horizon"] == "1h"
    assert body["is_demo_fallback"] is False


def test_simulate_baseline_values_are_positive():
    """Baseline peak and threshold must be positive."""
    res = client.post("/api/simulate", json=VALID_BODY)
    assert res.status_code == 200
    body = res.json()
    assert body["baseline_peak_mw"] > 0
    assert body["threshold_mw"] > 0


def test_simulate_scenario_peak_le_baseline():
    """Scenario peak must never exceed baseline peak (interventions only reduce demand)."""
    res = client.post("/api/simulate", json=VALID_BODY)
    assert res.status_code == 200
    body = res.json()
    assert body["scenario_peak_mw"] <= body["baseline_peak_mw"], (
        f"scenario {body['scenario_peak_mw']} > baseline {body['baseline_peak_mw']}"
    )


# ─── 2. ZERO-INTERVENTION SCENARIO ────────────────────────────────────────────

def test_simulate_zero_interventions():
    """With all interventions at 0, scenario equals baseline."""
    body_zero = {
        "locality_id": "andheri",
        "horizon": "1h",
        "cooling_shift": 0.0,
        "commercial_shift": 0.0,
        "flexible_load": 0.0,
        "solar_utilization": 0.0,
    }
    res = client.post("/api/simulate", json=body_zero)
    assert res.status_code == 200
    body = res.json()

    assert body["reduction_mw"] == 0.0, f"Expected 0 reduction, got {body['reduction_mw']}"
    assert body["reduction_pct"] == 0.0
    assert body["scenario_peak_mw"] == body["baseline_peak_mw"]
    assert body["scenario_risk"] == body["baseline_risk"]

    for itvn in body["interventions"]:
        assert itvn["estimated_reduction_mw"] == 0.0


def test_simulate_zero_interventions_peak_avoided_matches_baseline():
    """Zero interventions: peak_avoided must match whether baseline < threshold."""
    body_zero = {
        "locality_id": "andheri",
        "horizon": "1h",
        "cooling_shift": 0.0,
        "commercial_shift": 0.0,
        "flexible_load": 0.0,
        "solar_utilization": 0.0,
    }
    res = client.post("/api/simulate", json=body_zero)
    body = res.json()
    expected_avoided = body["scenario_peak_mw"] < body["threshold_mw"]
    assert body["peak_avoided"] == expected_avoided


# ─── 3. MAXIMUM INTERVENTION SCENARIO ─────────────────────────────────────────

def test_simulate_maximum_interventions():
    """Maximum activation values are accepted and produce largest reduction."""
    body_max = {
        "locality_id": "andheri",
        "horizon": "1h",
        "cooling_shift": 0.5,
        "commercial_shift": 0.5,
        "flexible_load": 0.5,
        "solar_utilization": 1.0,
    }
    res = client.post("/api/simulate", json=body_max)
    assert res.status_code == 200
    body = res.json()

    assert body["reduction_mw"] > 0
    assert body["scenario_peak_mw"] < body["baseline_peak_mw"]
    assert body["reduction_pct"] > 0


def test_simulate_max_interventions_never_negative_peak():
    """Scenario peak must never go below 0 MW, even at max reduction."""
    body_max = {
        "locality_id": "borivali",  # smaller locality
        "horizon": "1h",
        "cooling_shift": 0.5,
        "commercial_shift": 0.5,
        "flexible_load": 0.5,
        "solar_utilization": 1.0,
    }
    res = client.post("/api/simulate", json=body_max)
    assert res.status_code == 200
    body = res.json()
    assert body["scenario_peak_mw"] >= 0.0


# ─── 4. ALL HORIZONS ──────────────────────────────────────────────────────────

def test_simulate_all_horizons():
    """Endpoint accepts all three supported horizons."""
    for horizon in ["15min", "1h", "24h"]:
        body = {**VALID_BODY, "horizon": horizon}
        res = client.post("/api/simulate", json=body)
        assert res.status_code == 200, f"Failed for horizon {horizon}: {res.text}"
        assert res.json()["horizon"] == horizon


def test_simulate_horizons_different_baselines():
    """Different horizons may produce different baseline peaks."""
    peaks = {}
    for horizon in ["15min", "1h", "24h"]:
        body = {
            "locality_id": "andheri",
            "horizon": horizon,
            "cooling_shift": 0.0,
            "commercial_shift": 0.0,
            "flexible_load": 0.0,
            "solar_utilization": 0.0,
        }
        res = client.post("/api/simulate", json=body)
        assert res.status_code == 200
        peaks[horizon] = res.json()["baseline_peak_mw"]
    # 24h should have the highest peak (full-day horizon)
    assert peaks["24h"] >= peaks["1h"], (
        f"24h peak {peaks['24h']} should be >= 1h peak {peaks['1h']}"
    )


# ─── 5. ALL LOCALITIES ────────────────────────────────────────────────────────

def test_simulate_all_localities():
    """Endpoint returns valid response for every seeded locality."""
    for loc in LOCALITIES:
        body = {
            "locality_id": loc.id,
            "horizon": "1h",
            "cooling_shift": 0.2,
            "commercial_shift": 0.1,
            "flexible_load": 0.1,
            "solar_utilization": 0.5,
        }
        res = client.post("/api/simulate", json=body)
        assert res.status_code == 200, f"Failed for {loc.id}: {res.text}"
        b = res.json()
        assert b["locality_id"] == loc.id
        assert b["baseline_peak_mw"] > 0
        assert b["threshold_mw"] == loc.peak_threshold_mw


# ─── 6. DETERMINISM ───────────────────────────────────────────────────────────

def test_simulate_is_deterministic():
    """Identical requests must return identical results."""
    res1 = client.post("/api/simulate", json=VALID_BODY)
    res2 = client.post("/api/simulate", json=VALID_BODY)
    assert res1.status_code == 200
    assert res2.status_code == 200

    b1, b2 = res1.json(), res2.json()
    assert b1["baseline_peak_mw"] == b2["baseline_peak_mw"]
    assert b1["scenario_peak_mw"] == b2["scenario_peak_mw"]
    assert b1["reduction_mw"] == b2["reduction_mw"]
    assert b1["baseline_risk"] == b2["baseline_risk"]
    assert b1["scenario_risk"] == b2["scenario_risk"]


# ─── 7. RISK CALCULATION CONSISTENCY ─────────────────────────────────────────

def test_simulate_risk_is_consistent_with_thresholds():
    """
    Scenario risk must match the documented threshold rules:
      CRITICAL: scenario_peak >= 1.05 × threshold
      HIGH:     scenario_peak >= 1.00 × threshold
      MEDIUM:   scenario_peak >= 0.90 × threshold
      LOW:      scenario_peak <  0.90 × threshold
    """
    res = client.post("/api/simulate", json=VALID_BODY)
    body = res.json()

    sp = body["scenario_peak_mw"]
    th = body["threshold_mw"]
    risk = body["scenario_risk"]

    if sp >= 1.05 * th:
        assert risk == "CRITICAL", f"Expected CRITICAL but got {risk} (sp={sp}, th={th})"
    elif sp >= 1.00 * th:
        assert risk == "HIGH", f"Expected HIGH but got {risk} (sp={sp}, th={th})"
    elif sp >= 0.90 * th:
        assert risk == "MEDIUM", f"Expected MEDIUM but got {risk} (sp={sp}, th={th})"
    else:
        assert risk == "LOW", f"Expected LOW but got {risk} (sp={sp}, th={th})"


def test_simulate_peak_avoided_consistency():
    """peak_avoided must be True iff scenario_peak_mw < threshold_mw."""
    for loc in LOCALITIES[:3]:
        for cooling in [0.0, 0.5]:
            body = {
                "locality_id": loc.id,
                "horizon": "24h",
                "cooling_shift": cooling,
                "commercial_shift": cooling,
                "flexible_load": cooling,
                "solar_utilization": 1.0,
            }
            res = client.post("/api/simulate", json=body)
            b = res.json()
            expected = b["scenario_peak_mw"] < b["threshold_mw"]
            assert b["peak_avoided"] == expected, (
                f"peak_avoided mismatch for {loc.id}: "
                f"scenario={b['scenario_peak_mw']}, threshold={b['threshold_mw']}, "
                f"peak_avoided={b['peak_avoided']}"
            )


def test_simulate_exceedance_mw_is_correct():
    """exceedance_mw must equal max(0, scenario_peak - threshold)."""
    res = client.post("/api/simulate", json=VALID_BODY)
    b = res.json()
    expected = round(max(0.0, b["scenario_peak_mw"] - b["threshold_mw"]), 1)
    assert abs(b["exceedance_mw"] - expected) < 0.15, (
        f"exceedance_mw {b['exceedance_mw']} != expected {expected}"
    )


# ─── 8. REDUCTION MATH ────────────────────────────────────────────────────────

def test_simulate_reduction_math():
    """
    reduction_mw must equal sum of per-intervention reductions.
    scenario_peak_mw must equal baseline_peak_mw - reduction_mw (clamped to 0).
    """
    res = client.post("/api/simulate", json=VALID_BODY)
    body = res.json()

    itvn_total = sum(i["estimated_reduction_mw"] for i in body["interventions"])
    assert abs(itvn_total - body["reduction_mw"]) < 0.2, (
        f"Sum of interventions {itvn_total} != reduction_mw {body['reduction_mw']}"
    )

    expected_scenario = max(0.0, round(body["baseline_peak_mw"] - body["reduction_mw"], 1))
    assert abs(body["scenario_peak_mw"] - expected_scenario) < 0.2, (
        f"scenario_peak {body['scenario_peak_mw']} != expected {expected_scenario}"
    )


def test_simulate_reduction_pct_is_correct():
    """reduction_pct must equal (reduction_mw / baseline_peak_mw) * 100."""
    res = client.post("/api/simulate", json=VALID_BODY)
    body = res.json()

    if body["baseline_peak_mw"] > 0:
        expected_pct = round((body["reduction_mw"] / body["baseline_peak_mw"]) * 100, 1)
        assert abs(body["reduction_pct"] - expected_pct) < 0.2, (
            f"reduction_pct {body['reduction_pct']} != expected {expected_pct}"
        )


def test_simulate_intervention_breakdown_count():
    """Response must always contain exactly 4 intervention breakdown items."""
    res = client.post("/api/simulate", json=VALID_BODY)
    body = res.json()
    assert len(body["interventions"]) == 4


def test_simulate_solar_bounded_by_capacity():
    """Solar reduction must not exceed the locality's solar_capacity_mw."""
    from app.seed_data import LOCALITIES_BY_ID
    loc = LOCALITIES_BY_ID["andheri"]

    body = {
        "locality_id": "andheri",
        "horizon": "1h",
        "cooling_shift": 0.0,
        "commercial_shift": 0.0,
        "flexible_load": 0.0,
        "solar_utilization": 1.0,
    }
    res = client.post("/api/simulate", json=body)
    solar_itvn = next(i for i in res.json()["interventions"] if i["key"] == "solar_utilization")
    assert solar_itvn["estimated_reduction_mw"] <= loc.solar_capacity_mw + 0.1


def test_simulate_inputs_echoed_back():
    """Response.inputs must match request body."""
    res = client.post("/api/simulate", json=VALID_BODY)
    body = res.json()
    inputs = body["inputs"]
    assert inputs["locality_id"] == VALID_BODY["locality_id"]
    assert inputs["horizon"] == VALID_BODY["horizon"]
    assert abs(inputs["cooling_shift"] - VALID_BODY["cooling_shift"]) < 0.001
    assert abs(inputs["solar_utilization"] - VALID_BODY["solar_utilization"]) < 0.001


# ─── 9. ERROR CASES ───────────────────────────────────────────────────────────

def test_simulate_invalid_locality():
    """Unknown locality_id must return 404."""
    body = {**VALID_BODY, "locality_id": "nonexistent_place"}
    res = client.post("/api/simulate", json=body)
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_simulate_cooling_shift_too_high():
    """cooling_shift > 0.5 must return 422."""
    body = {**VALID_BODY, "cooling_shift": 0.6}
    res = client.post("/api/simulate", json=body)
    assert res.status_code == 422


def test_simulate_commercial_shift_too_high():
    """commercial_shift > 0.5 must return 422."""
    body = {**VALID_BODY, "commercial_shift": 0.51}
    res = client.post("/api/simulate", json=body)
    assert res.status_code == 422


def test_simulate_flexible_load_too_high():
    """flexible_load > 0.5 must return 422."""
    body = {**VALID_BODY, "flexible_load": 0.51}
    res = client.post("/api/simulate", json=body)
    assert res.status_code == 422


def test_simulate_solar_too_high():
    """solar_utilization > 1.0 must return 422."""
    body = {**VALID_BODY, "solar_utilization": 1.01}
    res = client.post("/api/simulate", json=body)
    assert res.status_code == 422


def test_simulate_negative_cooling_shift():
    """Negative cooling_shift must return 422."""
    body = {**VALID_BODY, "cooling_shift": -0.1}
    res = client.post("/api/simulate", json=body)
    assert res.status_code == 422


def test_simulate_invalid_horizon():
    """Invalid horizon must return 422 (Pydantic Literal validation)."""
    body = {**VALID_BODY, "horizon": "5years"}
    res = client.post("/api/simulate", json=body)
    assert res.status_code == 422


def test_simulate_missing_locality_id():
    """Missing locality_id must return 422."""
    body = {k: v for k, v in VALID_BODY.items() if k != "locality_id"}
    res = client.post("/api/simulate", json=body)
    assert res.status_code == 422


def test_simulate_empty_body():
    """Empty body must return 422 (locality_id is required)."""
    res = client.post("/api/simulate", json={})
    assert res.status_code == 422


def test_simulate_malformed_json():
    """Malformed JSON must return 422."""
    res = client.post(
        "/api/simulate",
        content="not json at all",
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 422


# ─── 10. SCENARIO SERIES ───────────────────────────────────────────────────

def test_simulate_scenario_series_present():
    """Response must contain a non-empty scenario_series."""
    res = client.post("/api/simulate", json=VALID_BODY)
    body = res.json()
    assert "scenario_series" in body
    assert len(body["scenario_series"]) > 0


def test_simulate_scenario_series_point_fields():
    """Every scenario_series point must have all required fields with correct types."""
    res = client.post("/api/simulate", json=VALID_BODY)
    body = res.json()
    for point in body["scenario_series"]:
        assert "timestamp" in point, "Missing timestamp"
        assert "time" in point, "Missing time"
        assert "baseline_mw" in point, "Missing baseline_mw"
        assert "simulated_mw" in point, "Missing simulated_mw"
        assert "threshold_mw" in point, "Missing threshold_mw"
        assert isinstance(point["baseline_mw"], (int, float))
        assert isinstance(point["simulated_mw"], (int, float))
        assert isinstance(point["threshold_mw"], (int, float))
        assert point["simulated_mw"] >= 0.0
        assert point["baseline_mw"] >= 0.0


def test_simulate_scenario_series_max_equals_scenario_peak():
    """
    The maximum simulated_mw across all scenario_series points must equal
    scenario_peak_mw (within 0.2 MW rounding tolerance).
    This is the key consistency invariant: chart and summary card must agree.
    """
    res = client.post("/api/simulate", json=VALID_BODY)
    body = res.json()
    max_sim = max(p["simulated_mw"] for p in body["scenario_series"])
    assert abs(max_sim - body["scenario_peak_mw"]) <= 0.2, (
        f"max(simulated_mw)={max_sim} != scenario_peak_mw={body['scenario_peak_mw']}"
    )


def test_simulate_scenario_series_length_matches_horizon():
    """Scenario series length must match the forecast series length for the horizon."""
    horizon_expected = {"15min": 8, "1h": 12, "24h": 24}
    for horizon, expected_len in horizon_expected.items():
        body_h = {**VALID_BODY, "horizon": horizon}
        res = client.post("/api/simulate", json=body_h)
        assert res.status_code == 200, f"Failed for horizon {horizon}"
        body = res.json()
        assert len(body["scenario_series"]) == expected_len, (
            f"horizon={horizon}: expected {expected_len} points, "
            f"got {len(body['scenario_series'])}"
        )


def test_simulate_scenario_series_zero_interventions():
    """
    With zero interventions: simulated_mw == baseline_mw for every point.
    """
    body_zero = {
        "locality_id": "andheri",
        "horizon": "1h",
        "cooling_shift": 0.0,
        "commercial_shift": 0.0,
        "flexible_load": 0.0,
        "solar_utilization": 0.0,
    }
    res = client.post("/api/simulate", json=body_zero)
    body = res.json()
    for point in body["scenario_series"]:
        assert abs(point["simulated_mw"] - point["baseline_mw"]) <= 0.15, (
            f"Zero interventions but simulated_mw {point['simulated_mw']} "
            f"!= baseline_mw {point['baseline_mw']}"
        )


def test_simulate_scenario_series_threshold_consistent():
    """Every point's threshold_mw must equal the response threshold_mw."""
    res = client.post("/api/simulate", json=VALID_BODY)
    body = res.json()
    for point in body["scenario_series"]:
        assert abs(point["threshold_mw"] - body["threshold_mw"]) < 0.1, (
            f"Point threshold {point['threshold_mw']} != response threshold {body['threshold_mw']}"
        )


def test_simulate_scenario_series_simulated_le_baseline():
    """simulated_mw must be <= baseline_mw for every point (interventions only reduce)."""
    res = client.post("/api/simulate", json=VALID_BODY)
    body = res.json()
    for point in body["scenario_series"]:
        assert point["simulated_mw"] <= point["baseline_mw"] + 0.1, (
            f"simulated_mw {point['simulated_mw']} > baseline_mw {point['baseline_mw']}"
        )


def test_simulate_max_interventions_scenario_series_consistent():
    """At max interventions, max(simulated_mw) must still equal scenario_peak_mw."""
    body_max = {
        "locality_id": "andheri",
        "horizon": "24h",
        "cooling_shift": 0.5,
        "commercial_shift": 0.5,
        "flexible_load": 0.5,
        "solar_utilization": 1.0,
    }
    res = client.post("/api/simulate", json=body_max)
    assert res.status_code == 200
    body = res.json()
    max_sim = max(p["simulated_mw"] for p in body["scenario_series"])
    assert abs(max_sim - body["scenario_peak_mw"]) <= 0.2, (
        f"max(simulated_mw)={max_sim} != scenario_peak_mw={body['scenario_peak_mw']}"
    )
    # All simulated values must be non-negative
    for p in body["scenario_series"]:
        assert p["simulated_mw"] >= 0.0
