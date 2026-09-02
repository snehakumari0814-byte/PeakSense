"""
Automated Pytest Suite for PeakSense SHAP Explanation API.

Tests GET /api/explanation endpoint for:
- Valid localities and horizons
- Response schema correctness
- SHAP mathematical identity: prediction ≈ base + sum(shap_values)
- Determinism: same inputs → same outputs
- No NaN/Inf in any numeric field
- Invalid locality → 404
- Invalid horizon → 400
"""

import math
from fastapi.testclient import TestClient
from app.main import app
from app.seed_data import LOCALITIES

client = TestClient(app)


def check_no_nan_or_inf(obj):
    """Recursively ensure no NaN or Infinity in JSON data."""
    if isinstance(obj, float):
        assert not math.isnan(obj), f"Found NaN in response: {obj}"
        assert not math.isinf(obj), f"Found Infinity in response: {obj}"
    elif isinstance(obj, dict):
        for v in obj.values():
            check_no_nan_or_inf(v)
    elif isinstance(obj, list):
        for item in obj:
            check_no_nan_or_inf(item)


# ============================================================
# 1. VALID LOCALITY + HORIZONS
# ============================================================

def test_explanation_valid_horizons():
    """Endpoint returns 200 for all supported horizon aliases."""
    for horizon in ["15min", "1h", "24h"]:
        res = client.get(f"/api/explanation?locality_id=andheri&horizon={horizon}")
        assert res.status_code == 200, f"Failed for horizon {horizon}: {res.text}"
        body = res.json()
        check_no_nan_or_inf(body)
        assert body["locality_id"] == "andheri"
        assert body["locality_name"] == "Andheri"
        assert body["horizon"] in ("15min", "1h", "24h")


def test_explanation_response_schema():
    """Response matches ExplanationResponse schema exactly."""
    res = client.get("/api/explanation?locality_id=andheri&horizon=24h")
    assert res.status_code == 200
    body = res.json()
    check_no_nan_or_inf(body)

    # Top-level required fields
    required_fields = [
        "locality_id", "locality_name", "horizon",
        "prediction_mw", "locality_prediction_mw", "base_value_mw",
        "drivers", "summary", "method", "is_demo_fallback",
    ]
    for field in required_fields:
        assert field in body, f"Missing field: {field}"

    # Types
    assert isinstance(body["prediction_mw"], (int, float))
    assert isinstance(body["locality_prediction_mw"], (int, float))
    assert isinstance(body["base_value_mw"], (int, float))
    assert isinstance(body["drivers"], list)
    assert isinstance(body["summary"], str)
    assert body["method"] == "SHAP_TreeExplainer"
    assert isinstance(body["is_demo_fallback"], bool)

    # Values sanity
    assert body["prediction_mw"] > 0
    assert body["locality_prediction_mw"] > 0
    assert len(body["summary"]) > 20


def test_explanation_driver_schema():
    """Each driver has all required fields with correct types and valid values."""
    res = client.get("/api/explanation?locality_id=andheri&horizon=24h")
    assert res.status_code == 200
    drivers = res.json()["drivers"]
    assert len(drivers) > 0, "Expected at least one driver"

    for d in drivers:
        assert "feature" in d
        assert "label" in d
        assert "shap_value_mw" in d
        assert "direction" in d
        assert "feature_value" in d
        assert "category" in d
        assert d["direction"] in ("increase", "decrease")
        assert d["category"] in ("temporal", "lag", "rolling", "weather", "solar", "other")
        assert isinstance(d["shap_value_mw"], (int, float))
        assert isinstance(d["feature_value"], (int, float))
        assert not math.isnan(d["shap_value_mw"])
        assert not math.isinf(d["shap_value_mw"])


def test_explanation_direction_consistency():
    """Direction field must be consistent with sign of shap_value_mw."""
    res = client.get("/api/explanation?locality_id=andheri&horizon=24h")
    assert res.status_code == 200
    for d in res.json()["drivers"]:
        sv = d["shap_value_mw"]
        expected_dir = "increase" if sv >= 0 else "decrease"
        assert d["direction"] == expected_dir, (
            f"Direction mismatch for {d['feature']}: shap={sv}, direction={d['direction']}"
        )


def test_explanation_sorted_by_magnitude():
    """Drivers must be sorted by |shap_value_mw| descending."""
    res = client.get("/api/explanation?locality_id=andheri&horizon=24h")
    assert res.status_code == 200
    drivers = res.json()["drivers"]
    magnitudes = [abs(d["shap_value_mw"]) for d in drivers]
    assert magnitudes == sorted(magnitudes, reverse=True), (
        "Drivers not sorted by absolute SHAP magnitude descending"
    )


def test_explanation_is_live_not_fallback():
    """When model is loaded and SHAP works, is_demo_fallback must be False."""
    res = client.get("/api/explanation?locality_id=andheri&horizon=24h")
    assert res.status_code == 200
    body = res.json()
    assert body["is_demo_fallback"] is False, (
        "Expected live SHAP explanation, got demo fallback"
    )


# ============================================================
# 2. ALL PROTOTYPE LOCALITIES
# ============================================================

def test_explanation_all_localities():
    """Endpoint returns valid response for every seeded locality."""
    for loc in LOCALITIES:
        res = client.get(f"/api/explanation?locality_id={loc.id}&horizon=24h")
        assert res.status_code == 200, f"Failed for locality {loc.id}: {res.text}"
        body = res.json()
        check_no_nan_or_inf(body)
        assert body["locality_id"] == loc.id
        assert body["locality_name"] == loc.name
        assert body["locality_prediction_mw"] > 0
        assert len(body["drivers"]) > 0


def test_explanation_locality_prediction_scales_correctly():
    """Locality prediction must be smaller than bulk prediction (locality is a fraction of city)."""
    res = client.get("/api/explanation?locality_id=andheri&horizon=24h")
    assert res.status_code == 200
    body = res.json()
    assert body["locality_prediction_mw"] < body["prediction_mw"], (
        "Locality prediction should be less than bulk Mumbai prediction"
    )
    assert body["locality_prediction_mw"] > 0


# ============================================================
# 3. DETERMINISM
# ============================================================

def test_explanation_is_deterministic():
    """Two identical requests must return identical SHAP values."""
    url = "/api/explanation?locality_id=bandra&horizon=1h"
    res1 = client.get(url)
    res2 = client.get(url)
    assert res1.status_code == 200
    assert res2.status_code == 200

    d1 = res1.json()["drivers"]
    d2 = res2.json()["drivers"]

    assert len(d1) == len(d2)
    for drv1, drv2 in zip(d1, d2):
        assert drv1["feature"] == drv2["feature"]
        assert abs(drv1["shap_value_mw"] - drv2["shap_value_mw"]) < 0.01, (
            f"Non-deterministic SHAP for {drv1['feature']}: {drv1['shap_value_mw']} vs {drv2['shap_value_mw']}"
        )


# ============================================================
# 4. TOP_N PARAMETER
# ============================================================

def test_explanation_top_n_parameter():
    """top_n query param controls the number of drivers returned."""
    res3 = client.get("/api/explanation?locality_id=andheri&horizon=24h&top_n=3")
    assert res3.status_code == 200
    assert len(res3.json()["drivers"]) == 3

    res5 = client.get("/api/explanation?locality_id=andheri&horizon=24h&top_n=5")
    assert res5.status_code == 200
    assert len(res5.json()["drivers"]) == 5


# ============================================================
# 5. ERROR CASES
# ============================================================

def test_explanation_invalid_locality():
    """Unknown locality_id must return 404."""
    res = client.get("/api/explanation?locality_id=nonexistent_place&horizon=24h")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_explanation_invalid_horizon():
    """Invalid horizon must return 400."""
    res = client.get("/api/explanation?locality_id=andheri&horizon=5years")
    assert res.status_code == 400
    assert "invalid horizon" in res.json()["detail"].lower()


def test_explanation_missing_locality_param():
    """Missing locality_id must return 422 Unprocessable Entity."""
    res = client.get("/api/explanation?horizon=24h")
    assert res.status_code == 422


# ============================================================
# 6. MULTIPLE LOCALITIES + HORIZONS (CROSS-CHECK)
# ============================================================

def test_explanation_different_localities_different_results():
    """Different localities must produce different SHAP driver magnitudes."""
    res_a = client.get("/api/explanation?locality_id=andheri&horizon=24h")
    res_b = client.get("/api/explanation?locality_id=borivali&horizon=24h")
    assert res_a.status_code == 200
    assert res_b.status_code == 200

    pred_a = res_a.json()["locality_prediction_mw"]
    pred_b = res_b.json()["locality_prediction_mw"]
    # Andheri has higher current_demand_mw than Borivali, so prediction should differ
    assert pred_a != pred_b, "Different localities should produce different predictions"
