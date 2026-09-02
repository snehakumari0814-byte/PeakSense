"""
Tests for GET /api/forecast/inputs — real model feature values endpoint.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

VALID_LOCALITY = "andheri"
VALID_HORIZON = "1h"

REQUIRED_FEATURES = {
    "temperature_c",
    "relative_humidity_percent",
    "solar_irradiance",
    "lag_1",
    "hour",
    "day_of_week",
    "is_weekend",
    "is_holiday",
    "cooling_degree_index",
    "rolling_mean_4",
}

VALID_SOURCES = {"historical_lag", "model_computed", "fixed_assumption", "calendar"}


# ─── 1. Valid request ──────────────────────────────────────────────────────────

def test_forecast_inputs_valid_request():
    """GET with valid locality and horizon returns 200 and correct schema."""
    res = client.get(
        "/api/forecast/inputs",
        params={"locality_id": VALID_LOCALITY, "horizon": VALID_HORIZON},
    )
    assert res.status_code == 200, res.text
    body = res.json()

    assert body["locality_id"] == VALID_LOCALITY
    assert body["horizon"] == VALID_HORIZON
    assert isinstance(body["features"], list)
    assert len(body["features"]) > 0
    assert "peak_hour" in body
    assert "is_demo_fallback" in body
    assert "disclaimer" in body


def test_forecast_inputs_feature_fields():
    """Every feature must have all required fields with correct types."""
    res = client.get(
        "/api/forecast/inputs",
        params={"locality_id": VALID_LOCALITY, "horizon": VALID_HORIZON},
    )
    body = res.json()
    for feat in body["features"]:
        assert "feature" in feat
        assert "label" in feat
        assert "value" in feat
        assert "unit" in feat
        assert "source" in feat
        assert "source_note" in feat
        assert isinstance(feat["value"], (int, float))
        assert feat["source"] in VALID_SOURCES
        assert len(feat["source_note"]) > 0


def test_forecast_inputs_required_features_present():
    """All required model input features must be present in the response."""
    res = client.get(
        "/api/forecast/inputs",
        params={"locality_id": VALID_LOCALITY, "horizon": VALID_HORIZON},
    )
    body = res.json()
    returned_features = {f["feature"] for f in body["features"]}
    for required in REQUIRED_FEATURES:
        assert required in returned_features, f"Missing feature: {required}"


# ─── 2. Provenance correctness ─────────────────────────────────────────────────

def test_forecast_inputs_temperature_is_model_computed():
    """temperature_c must be labelled model_computed (not measured)."""
    res = client.get(
        "/api/forecast/inputs",
        params={"locality_id": VALID_LOCALITY, "horizon": VALID_HORIZON},
    )
    body = res.json()
    temp_feats = [f for f in body["features"] if f["feature"] == "temperature_c"]
    assert len(temp_feats) == 1
    assert temp_feats[0]["source"] == "model_computed"


def test_forecast_inputs_humidity_is_fixed_assumption():
    """relative_humidity_percent must be labelled fixed_assumption."""
    res = client.get(
        "/api/forecast/inputs",
        params={"locality_id": VALID_LOCALITY, "horizon": VALID_HORIZON},
    )
    body = res.json()
    hum_feats = [f for f in body["features"] if f["feature"] == "relative_humidity_percent"]
    assert len(hum_feats) == 1
    assert hum_feats[0]["source"] == "fixed_assumption"
    assert hum_feats[0]["value"] == 78.0


def test_forecast_inputs_lag1_is_historical():
    """lag_1 must be labelled historical_lag and must be positive."""
    res = client.get(
        "/api/forecast/inputs",
        params={"locality_id": VALID_LOCALITY, "horizon": VALID_HORIZON},
    )
    body = res.json()
    lag_feats = [f for f in body["features"] if f["feature"] == "lag_1"]
    assert len(lag_feats) == 1
    assert lag_feats[0]["source"] == "historical_lag"
    assert lag_feats[0]["value"] > 0, "lag_1 must be a positive demand value"


def test_forecast_inputs_holiday_is_zero():
    """is_holiday is always 0 (fixed assumption — no holiday calendar)."""
    res = client.get(
        "/api/forecast/inputs",
        params={"locality_id": VALID_LOCALITY, "horizon": VALID_HORIZON},
    )
    body = res.json()
    hol_feats = [f for f in body["features"] if f["feature"] == "is_holiday"]
    assert len(hol_feats) == 1
    assert hol_feats[0]["value"] == 0.0
    assert hol_feats[0]["source"] == "fixed_assumption"


# ─── 3. Value sanity ──────────────────────────────────────────────────────────

def test_forecast_inputs_temperature_realistic():
    """temperature_c must be in a realistic Mumbai range (20–45°C)."""
    res = client.get(
        "/api/forecast/inputs",
        params={"locality_id": VALID_LOCALITY, "horizon": VALID_HORIZON},
    )
    body = res.json()
    temp = next(f["value"] for f in body["features"] if f["feature"] == "temperature_c")
    assert 20.0 <= temp <= 45.0, f"temperature_c={temp} outside realistic Mumbai range"


def test_forecast_inputs_solar_irradiance_non_negative():
    """solar_irradiance must be >= 0."""
    res = client.get(
        "/api/forecast/inputs",
        params={"locality_id": VALID_LOCALITY, "horizon": VALID_HORIZON},
    )
    body = res.json()
    solar = next(f["value"] for f in body["features"] if f["feature"] == "solar_irradiance")
    assert solar >= 0.0


def test_forecast_inputs_peak_hour_valid():
    """peak_hour must be in range 0–23."""
    res = client.get(
        "/api/forecast/inputs",
        params={"locality_id": VALID_LOCALITY, "horizon": VALID_HORIZON},
    )
    body = res.json()
    assert 0 <= body["peak_hour"] <= 23


def test_forecast_inputs_cooling_degree_index_non_negative():
    """cooling_degree_index = max(0, temp - 24) must be >= 0."""
    res = client.get(
        "/api/forecast/inputs",
        params={"locality_id": VALID_LOCALITY, "horizon": VALID_HORIZON},
    )
    body = res.json()
    cdi = next(f["value"] for f in body["features"] if f["feature"] == "cooling_degree_index")
    assert cdi >= 0.0


# ─── 4. All horizons ─────────────────────────────────────────────────────────

def test_forecast_inputs_all_horizons():
    """Valid inputs response for all supported horizons."""
    for horizon in ["15min", "1h", "24h"]:
        res = client.get(
            "/api/forecast/inputs",
            params={"locality_id": VALID_LOCALITY, "horizon": horizon},
        )
        assert res.status_code == 200, f"Failed for horizon={horizon}"
        body = res.json()
        assert len(body["features"]) > 0


# ─── 5. All localities ────────────────────────────────────────────────────────

def test_forecast_inputs_all_localities():
    """Valid inputs response for all seed localities."""
    localities_res = client.get("/api/localities")
    localities = localities_res.json()
    for loc in localities:
        res = client.get(
            "/api/forecast/inputs",
            params={"locality_id": loc["id"], "horizon": "1h"},
        )
        assert res.status_code == 200, f"Failed for locality={loc['id']}"


# ─── 6. Determinism ──────────────────────────────────────────────────────────

def test_forecast_inputs_is_deterministic():
    """Same request at the same moment produces identical feature values."""
    params = {"locality_id": VALID_LOCALITY, "horizon": VALID_HORIZON}
    r1 = client.get("/api/forecast/inputs", params=params).json()
    r2 = client.get("/api/forecast/inputs", params=params).json()
    assert r1["features"] == r2["features"]
    assert r1["peak_hour"] == r2["peak_hour"]


# ─── 7. Error cases ──────────────────────────────────────────────────────────

def test_forecast_inputs_invalid_locality():
    """Unknown locality_id returns 404."""
    res = client.get(
        "/api/forecast/inputs",
        params={"locality_id": "not_a_real_place", "horizon": "1h"},
    )
    assert res.status_code == 404


def test_forecast_inputs_missing_locality_id():
    """Missing locality_id returns 422."""
    res = client.get("/api/forecast/inputs", params={"horizon": "1h"})
    assert res.status_code == 422


def test_forecast_inputs_is_demo_fallback_false():
    """When the model is loaded, is_demo_fallback must be False."""
    res = client.get(
        "/api/forecast/inputs",
        params={"locality_id": VALID_LOCALITY, "horizon": "1h"},
    )
    body = res.json()
    assert body["is_demo_fallback"] is False
