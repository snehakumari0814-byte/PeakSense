"""
Automated Pytest Suite for PeakSense DATE-AWARE Forecasting.

Covers: date parameter on GET /api/forecast, GET /api/forecast/series,
GET /api/explanation, GET /api/forecast/inputs, POST /api/simulate, and
GET /api/forecast/availability.

These tests use the backend's OWN reference date / historical range (via
ForecastEngine) rather than hardcoded dates, so they remain valid regardless
of which day they are run on.
"""

import math
from datetime import timedelta

from fastapi.testclient import TestClient

from app.main import app
from app.services.forecasting import ForecastEngine

client = TestClient(app)


def check_no_nan_or_inf(obj):
    if isinstance(obj, float):
        assert not math.isnan(obj)
        assert not math.isinf(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            check_no_nan_or_inf(v)
    elif isinstance(obj, list):
        for item in obj:
            check_no_nan_or_inf(item)


engine = ForecastEngine.get_instance()
REFERENCE_DATE = engine.get_reference_date()
HIST_MIN = engine.history_min_date
HIST_MAX = engine.history_max_date

# A genuinely historical date well inside the loaded dataset, and a second
# distinct historical date, for cross-date comparisons.
HIST_DATE_A = HIST_MIN + timedelta(days=5)
HIST_DATE_B = HIST_MIN + timedelta(days=10)

# A genuine gap day: strictly after the last historical observation and
# strictly before today (only exists if such a gap is present).
GAP_DATE = None
if HIST_MAX is not None and HIST_MAX + timedelta(days=1) < REFERENCE_DATE:
    GAP_DATE = HIST_MAX + timedelta(days=1)

FUTURE_DATE = REFERENCE_DATE + timedelta(days=2)
TOO_FAR_FUTURE_DATE = REFERENCE_DATE + timedelta(days=30)


# ============================================================
# 1. Backward compatibility — no date param
# ============================================================

def test_forecast_without_date_preserves_existing_behavior():
    r_no_date = client.get("/api/forecast?locality_id=dadar&horizon=1h")
    r_explicit_today = client.get(
        f"/api/forecast?locality_id=dadar&horizon=1h&date={REFERENCE_DATE.isoformat()}"
    )
    assert r_no_date.status_code == 200
    assert r_explicit_today.status_code == 200
    body_no_date = r_no_date.json()
    body_today = r_explicit_today.json()
    assert body_no_date["date"] == REFERENCE_DATE.isoformat()
    assert body_no_date["data_mode"] == "current"
    assert body_today["data_mode"] == "current"
    # current_demand_mw / threshold_mw are unaffected by date
    assert body_no_date["current_demand_mw"] == body_today["current_demand_mw"]


# ============================================================
# 2. Valid date succeeds
# ============================================================

def test_forecast_with_valid_historical_date_succeeds():
    r = client.get(f"/api/forecast?locality_id=dadar&horizon=1h&date={HIST_DATE_A.isoformat()}")
    assert r.status_code == 200
    body = r.json()
    assert body["date"] == HIST_DATE_A.isoformat()
    assert body["data_mode"] == "historical"
    assert body["peak"]["peak_mw"] > 0
    check_no_nan_or_inf(body)


# ============================================================
# 3. Invalid date -> clean error
# ============================================================

def test_forecast_with_malformed_date_returns_400():
    r = client.get("/api/forecast?locality_id=dadar&horizon=1h&date=not-a-date")
    assert r.status_code == 400
    assert "date" in r.json()["detail"].lower()


def test_forecast_with_unsupported_far_future_date_returns_404():
    r = client.get(f"/api/forecast?locality_id=dadar&horizon=1h&date={TOO_FAR_FUTURE_DATE.isoformat()}")
    assert r.status_code == 404


def test_forecast_with_gap_date_returns_404_if_gap_exists():
    if GAP_DATE is None:
        return  # no genuine gap between historical data and today on this dataset
    r = client.get(f"/api/forecast?locality_id=dadar&horizon=1h&date={GAP_DATE.isoformat()}")
    assert r.status_code == 404
    assert "unavailable" in r.json()["detail"].lower() or "no historical" in r.json()["detail"].lower()


# ============================================================
# 4/6. Timestamps correspond to requested date
# ============================================================

def test_forecast_series_timestamps_correspond_to_requested_date():
    r = client.get(f"/api/forecast/series?locality_id=dadar&horizon=24h&date={HIST_DATE_A.isoformat()}")
    assert r.status_code == 200
    body = r.json()
    assert body["date"] == HIST_DATE_A.isoformat()
    for point in body["points"]:
        assert point["timestamp"].startswith(HIST_DATE_A.isoformat())
        assert point["timestamp"].endswith("+05:30")


# ============================================================
# 5. Peak corresponds to requested date's series
# ============================================================

def test_forecast_peak_matches_requested_date_series_max():
    r_summary = client.get(f"/api/forecast?locality_id=dadar&horizon=1h&date={HIST_DATE_A.isoformat()}")
    r_series = client.get(f"/api/forecast/series?locality_id=dadar&horizon=1h&date={HIST_DATE_A.isoformat()}")
    assert r_summary.status_code == 200 and r_series.status_code == 200
    peak_mw = r_summary.json()["peak"]["peak_mw"]
    series_max = max(p["predicted_mw"] for p in r_series.json()["points"])
    assert abs(peak_mw - series_max) < 0.01


# ============================================================
# 7. Different valid dates -> different results
# ============================================================

def test_different_dates_produce_different_forecasts():
    r_a = client.get(f"/api/forecast?locality_id=andheri&horizon=1h&date={HIST_DATE_A.isoformat()}")
    r_b = client.get(f"/api/forecast?locality_id=andheri&horizon=1h&date={HIST_DATE_B.isoformat()}")
    assert r_a.status_code == 200 and r_b.status_code == 200
    assert r_a.json()["peak"]["peak_mw"] != r_b.json()["peak"]["peak_mw"]


# ============================================================
# 8. Different localities still produce locality-specific results
# ============================================================

def test_different_localities_same_date_produce_different_results():
    r_dadar = client.get(f"/api/forecast?locality_id=dadar&horizon=1h&date={HIST_DATE_A.isoformat()}")
    r_andheri = client.get(f"/api/forecast?locality_id=andheri&horizon=1h&date={HIST_DATE_A.isoformat()}")
    assert r_dadar.status_code == 200 and r_andheri.status_code == 200
    assert r_dadar.json()["peak"]["peak_mw"] != r_andheri.json()["peak"]["peak_mw"]
    assert r_dadar.json()["current_demand_mw"] != r_andheri.json()["current_demand_mw"]


# ============================================================
# 9. Horizons still work with a date param
# ============================================================

def test_all_horizons_work_with_date_param():
    for horizon, expected_len in [("15min", 8), ("1h", 12), ("24h", 24)]:
        r = client.get(
            f"/api/forecast/series?locality_id=powai&horizon={horizon}&date={HIST_DATE_A.isoformat()}"
        )
        assert r.status_code == 200, horizon
        body = r.json()
        assert len(body["points"]) == expected_len
        assert body["date"] == HIST_DATE_A.isoformat()


# ============================================================
# 10. SHAP explanation corresponds to requested date
# ============================================================

def test_explanation_differs_by_requested_date():
    r_a = client.get(f"/api/explanation?locality_id=dadar&horizon=1h&date={HIST_DATE_A.isoformat()}")
    r_b = client.get(f"/api/explanation?locality_id=dadar&horizon=1h&date={HIST_DATE_B.isoformat()}")
    assert r_a.status_code == 200 and r_b.status_code == 200
    body_a, body_b = r_a.json(), r_b.json()
    assert body_a["date"] == HIST_DATE_A.isoformat()
    assert body_b["date"] == HIST_DATE_B.isoformat()
    assert body_a["prediction_mw"] != body_b["prediction_mw"]


def test_explanation_unsupported_date_returns_clean_error():
    r = client.get(f"/api/explanation?locality_id=dadar&horizon=1h&date={TOO_FAR_FUTURE_DATE.isoformat()}")
    assert r.status_code == 404


# ============================================================
# 11. No future-target leakage in historical backtests
# ============================================================

def test_historical_lag1_never_equals_the_row_own_target_demand():
    """
    For every historical row, the precomputed lag_1 feature (used directly
    for genuine backtesting) must equal the PRECEDING row's demand_mw
    (shift(1)) — never that same row's own demand_mw, which is the value
    the model is trying to predict for that row. This is the leakage
    invariant preprocessing.py documents (lags via .shift(N)).
    """
    hist = engine.history_df.sort_values("timestamp").reset_index(drop=True)
    expected_lag_1 = hist["demand_mw"].shift(1)

    # Every row from the second onward: lag_1 must match the previous row's
    # actual demand, and must NOT equal this row's own demand_mw (unless the
    # two happen to coincide numerically, which we explicitly exclude below).
    mismatches = 0
    for i in range(1, len(hist)):
        row_lag1 = float(hist.loc[i, "lag_1"])
        own_demand = float(hist.loc[i, "demand_mw"])
        prev_demand = float(expected_lag_1.iloc[i])
        assert abs(row_lag1 - prev_demand) < 1e-6, (
            f"row {i}: lag_1={row_lag1} does not match previous observation {prev_demand}"
        )
        if abs(row_lag1 - own_demand) < 1e-6 and abs(prev_demand - own_demand) > 1e-6:
            mismatches += 1
    assert mismatches == 0, "lag_1 leaked the row's own target demand somewhere"


def test_historical_backtest_inputs_reuse_real_precomputed_features():
    """
    GET /api/forecast/inputs for a historical date must return lag_1 that
    genuinely traces back to a real prior CSV observation, not a value
    invented for the request.
    """
    r = client.get(f"/api/forecast/inputs?locality_id=dadar&horizon=1h&date={HIST_DATE_A.isoformat()}")
    assert r.status_code == 200
    features = {f["feature"]: f["value"] for f in r.json()["features"]}
    lag_1 = round(float(features["lag_1"]), 1)

    hist = engine.history_df
    all_demands = set(round(float(v), 1) for v in hist["demand_mw"])
    assert lag_1 in all_demands


# ============================================================
# 12. Unsupported dates never return fake data
# ============================================================

def test_unsupported_date_response_has_no_fabricated_forecast_body():
    r = client.get(f"/api/forecast?locality_id=dadar&horizon=1h&date={TOO_FAR_FUTURE_DATE.isoformat()}")
    assert r.status_code == 404
    body = r.json()
    assert "peak" not in body
    assert "forecast" not in body
    assert "detail" in body


# ============================================================
# 13. Availability endpoint correctness
# ============================================================

def test_forecast_availability_endpoint():
    r = client.get("/api/forecast/availability")
    assert r.status_code == 200
    body = r.json()
    assert body["reference_date"] == REFERENCE_DATE.isoformat()
    if HIST_MIN is not None:
        assert body["historical_range"]["start"] == HIST_MIN.isoformat()
        assert body["historical_range"]["end"] == HIST_MAX.isoformat()
    assert body["forecastable_range"]["start"] == REFERENCE_DATE.isoformat()
    # A date genuinely inside historical_range must actually succeed.
    r2 = client.get(f"/api/forecast?locality_id=dadar&horizon=1h&date={HIST_DATE_A.isoformat()}")
    assert r2.status_code == 200


# ============================================================
# 14. Timezone handling
# ============================================================

def test_series_timestamps_use_ist_offset_and_stay_within_requested_date():
    r = client.get(f"/api/forecast/series?locality_id=dadar&horizon=24h&date={HIST_DATE_A.isoformat()}")
    assert r.status_code == 200
    for point in r.json()["points"]:
        ts = point["timestamp"]
        assert ts.endswith("+05:30")
        assert ts[:10] == HIST_DATE_A.isoformat()


# ============================================================
# Simulator date-awareness
# ============================================================

def test_simulate_is_date_aware():
    payload = {
        "locality_id": "dadar",
        "horizon": "1h",
        "date": HIST_DATE_A.isoformat(),
        "cooling_shift": 0.3,
        "commercial_shift": 0.2,
        "flexible_load": 0.1,
        "solar_utilization": 0.5,
    }
    r = client.post("/api/simulate", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["date"] == HIST_DATE_A.isoformat()

    payload_b = dict(payload, date=HIST_DATE_B.isoformat())
    r_b = client.post("/api/simulate", json=payload_b)
    assert r_b.status_code == 200
    assert r_b.json()["baseline_peak_mw"] != body["baseline_peak_mw"]


def test_simulate_unsupported_date_returns_clean_error():
    payload = {"locality_id": "dadar", "horizon": "1h", "date": TOO_FAR_FUTURE_DATE.isoformat()}
    r = client.post("/api/simulate", json=payload)
    assert r.status_code == 404
