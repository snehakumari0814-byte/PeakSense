"""
Automated Pytest Suite for PeakSense Forecasting & Model Intelligence APIs.
"""

import math
from fastapi.testclient import TestClient
from app.main import app
from app.seed_data import LOCALITIES

client = TestClient(app)


def check_no_nan_or_inf(obj):
    """Recursively ensure no NaN or Infinity exists in JSON data."""
    if isinstance(obj, float):
        assert not math.isnan(obj), "Found NaN float value in response"
        assert not math.isinf(obj), "Found Infinity float value in response"
    elif isinstance(obj, dict):
        for k, v in obj.items():
            check_no_nan_or_inf(v)
    elif isinstance(obj, list):
        for item in obj:
            check_no_nan_or_inf(item)


# ============================================================
# 1. FORECAST SUMMARY ENDPOINT TESTS: GET /api/forecast
# ============================================================

def test_get_forecast_valid_locality_and_horizons():
    for horizon in ["15min", "1h", "24h"]:
        res = client.get(f"/api/forecast?locality_id=andheri&horizon={horizon}")
        assert res.status_code == 200
        body = res.json()
        check_no_nan_or_inf(body)

        assert body["locality_id"] == "andheri"
        assert body["locality_name"] == "Andheri"
        assert isinstance(body["current_demand_mw"], (int, float))
        assert body["current_demand_mw"] > 0

        # Validate forecast multi-horizon fields
        assert "forecast" in body
        forecast_vals = body["forecast"]
        assert "15min_mw" in forecast_vals
        assert "1hour_mw" in forecast_vals
        assert "24hour_peak_mw" in forecast_vals
        assert forecast_vals["15min_mw"] > 0
        assert forecast_vals["1hour_mw"] > 0
        assert forecast_vals["24hour_peak_mw"] > 0

        # Validate peak analysis
        assert "peak" in body
        peak = body["peak"]
        assert "peak_mw" in peak
        assert "peak_time" in peak
        assert "threshold_mw" in peak
        assert "risk" in peak
        assert peak["risk"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        assert peak["peak_mw"] > 0
        assert peak["threshold_mw"] > 0
        assert 0.0 <= peak["probability"] <= 1.0

        # Validate confidence score
        assert "confidence" in body
        assert 0.0 <= body["confidence"] <= 1.0


def test_get_forecast_all_prototype_localities():
    for loc in LOCALITIES:
        res = client.get(f"/api/forecast?locality_id={loc.id}&horizon=24h")
        assert res.status_code == 200
        body = res.json()
        assert body["locality_id"] == loc.id
        assert body["locality_name"] == loc.name
        assert body["current_demand_mw"] == loc.current_demand_mw
        assert body["peak"]["threshold_mw"] == loc.peak_threshold_mw


def test_get_forecast_invalid_locality():
    res = client.get("/api/forecast?locality_id=nonexistent_locality&horizon=24h")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_get_forecast_invalid_horizon():
    res = client.get("/api/forecast?locality_id=andheri&horizon=invalid_horizon")
    assert res.status_code == 400
    assert "invalid horizon" in res.json()["detail"].lower()


# ============================================================
# 2. FORECAST SERIES ENDPOINT TESTS: GET /api/forecast/series
# ============================================================

def test_get_forecast_series_valid_24h():
    res = client.get("/api/forecast/series?locality_id=andheri&horizon=24h")
    assert res.status_code == 200
    body = res.json()
    check_no_nan_or_inf(body)

    assert body["locality_id"] == "andheri"
    assert body["horizon"] == "24h"
    assert body["unit"] == "MW"
    assert isinstance(body["points"], list)
    assert len(body["points"]) == 24

    first_point = body["points"][0]
    assert "timestamp" in first_point
    assert "T" in first_point["timestamp"]
    assert "+05:30" in first_point["timestamp"]
    assert "predicted_mw" in first_point
    assert "lower_bound_mw" in first_point
    assert "upper_bound_mw" in first_point

    # Ensure bounds are logically ordered: lower <= predicted <= upper
    for p in body["points"]:
        assert p["lower_bound_mw"] <= p["predicted_mw"] <= p["upper_bound_mw"]


def test_get_forecast_series_15min_and_1h():
    res_15m = client.get("/api/forecast/series?locality_id=bandra&horizon=15min")
    assert res_15m.status_code == 200
    body_15m = res_15m.json()
    assert len(body_15m["points"]) == 8

    res_1h = client.get("/api/forecast/series?locality_id=powai&horizon=1h")
    assert res_1h.status_code == 200
    body_1h = res_1h.json()
    assert len(body_1h["points"]) == 12


def test_get_forecast_series_invalid_locality():
    res = client.get("/api/forecast/series?locality_id=unknown_zone&horizon=24h")
    assert res.status_code == 404


def test_get_forecast_series_invalid_horizon():
    res = client.get("/api/forecast/series?locality_id=andheri&horizon=5year")
    assert res.status_code == 400


# ============================================================
# 3. MODEL METRICS ENDPOINT TESTS: GET /api/model-metrics
# ============================================================

def test_get_model_metrics():
    res = client.get("/api/model-metrics")
    assert res.status_code == 200
    body = res.json()
    check_no_nan_or_inf(body)

    required_horizons = ["15min", "1hour", "24hour"]
    for horizon in required_horizons:
        assert horizon in body
        metrics = body[horizon]
        assert "mae" in metrics
        assert "rmse" in metrics
        assert "mape" in metrics
        assert metrics["mae"] > 0
        assert metrics["rmse"] > 0
        assert metrics["mape"] > 0
        # Sanity check on reasonable statistical bounds
        assert metrics["rmse"] >= metrics["mae"]


# ============================================================
# 4. REGRESSION TESTS ON EXISTING LOCALITIES & HEALTH
# ============================================================

def test_regression_localities_list():
    res = client.get("/api/localities")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == len(LOCALITIES)


def test_regression_single_locality():
    res = client.get("/api/localities/andheri")
    assert res.status_code == 200
    assert res.json()["name"] == "Andheri"


def test_regression_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
