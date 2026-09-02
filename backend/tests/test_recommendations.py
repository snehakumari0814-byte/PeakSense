"""
Automated Pytest Suite for PeakSense GET /api/recommendations Endpoint.

Tests:
- Valid locality + valid horizon returns 200 and correct schema
- Invalid locality -> 404
- Invalid horizon -> 400
- All supported horizon aliases accepted
- Deterministic output (identical requests -> identical response)
- Recommendation ranking is sorted by estimated_reduction_mw descending
- estimated_reduction_mw values match POST /api/simulate for the same
  test scenario (no independent/duplicate calculation)
- Solar recommendation omitted for a locality with zero solar capacity
- rank fields are a contiguous 1..N sequence
"""

from fastapi.testclient import TestClient

from app.main import app
from app.seed_data import LOCALITIES

client = TestClient(app)

TEST_SCENARIO_BODY = {
    "cooling_shift": 0.30,
    "commercial_shift": 0.20,
    "flexible_load": 0.10,
    "solar_utilization": 0.50,
}


# ─── 1. BASIC VALID REQUEST ────────────────────────────────────────────────────

def test_recommendations_valid_locality():
    res = client.get("/api/recommendations?locality_id=andheri&horizon=1h")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["locality_id"] == "andheri"
    assert body["locality_name"] == "Andheri"
    assert body["horizon"] == "1h"
    assert isinstance(body["recommendations"], list)
    assert len(body["recommendations"]) > 0


def test_recommendations_item_schema():
    res = client.get("/api/recommendations?locality_id=andheri&horizon=1h")
    item = res.json()["recommendations"][0]
    for key in (
        "intervention",
        "title",
        "reason",
        "scenario_percentage",
        "estimated_reduction_mw",
        "rank",
    ):
        assert key in item


# ─── 2. INVALID INPUTS ─────────────────────────────────────────────────────────

def test_recommendations_invalid_locality_404():
    res = client.get("/api/recommendations?locality_id=nonexistent-zone&horizon=1h")
    assert res.status_code == 404


def test_recommendations_invalid_horizon_400():
    res = client.get("/api/recommendations?locality_id=andheri&horizon=bogus")
    assert res.status_code == 400


def test_recommendations_missing_locality_422():
    res = client.get("/api/recommendations?horizon=1h")
    assert res.status_code == 422


# ─── 3. HORIZON ALIASES ────────────────────────────────────────────────────────

def test_recommendations_all_horizon_aliases():
    for alias in ["15min", "15m", "1h", "1hour", "24h", "24hour"]:
        res = client.get(f"/api/recommendations?locality_id=andheri&horizon={alias}")
        assert res.status_code == 200, f"horizon={alias} failed: {res.text}"


# ─── 4. DETERMINISM ────────────────────────────────────────────────────────────

def test_recommendations_deterministic():
    res1 = client.get("/api/recommendations?locality_id=powai&horizon=1h")
    res2 = client.get("/api/recommendations?locality_id=powai&horizon=1h")
    assert res1.json() == res2.json()


# ─── 5. RANKING ─────────────────────────────────────────────────────────────────

def test_recommendations_ranked_descending_by_reduction():
    res = client.get("/api/recommendations?locality_id=andheri&horizon=1h")
    recs = res.json()["recommendations"]
    reductions = [r["estimated_reduction_mw"] for r in recs]
    assert reductions == sorted(reductions, reverse=True)


def test_recommendations_rank_field_is_contiguous():
    res = client.get("/api/recommendations?locality_id=andheri&horizon=1h")
    recs = res.json()["recommendations"]
    ranks = [r["rank"] for r in recs]
    assert ranks == list(range(1, len(recs) + 1))


# ─── 6. CONSISTENCY WITH POST /api/simulate ────────────────────────────────────

def test_recommendations_reduction_matches_simulate_same_scenario():
    """
    The recommendation engine must not perform an independent calculation.
    Its estimated_reduction_mw values must equal what POST /api/simulate
    returns for the same fixed test scenario.
    """
    rec_res = client.get("/api/recommendations?locality_id=andheri&horizon=1h")
    rec_body = rec_res.json()

    sim_res = client.post(
        "/api/simulate",
        json={"locality_id": "andheri", "horizon": "1h", **TEST_SCENARIO_BODY},
    )
    sim_body = sim_res.json()
    sim_by_key = {i["key"]: i["estimated_reduction_mw"] for i in sim_body["interventions"]}

    for rec in rec_body["recommendations"]:
        assert rec["estimated_reduction_mw"] == sim_by_key[rec["intervention"]]


# ─── 7. SOLAR OMITTED WHEN NO SOLAR CAPACITY ───────────────────────────────────

def test_recommendations_omit_solar_for_zero_capacity_locality():
    zero_solar = [l for l in LOCALITIES if l.solar_capacity_mw <= 0]
    if not zero_solar:
        return  # no such locality in current seed data — nothing to assert
    locality = zero_solar[0]
    res = client.get(f"/api/recommendations?locality_id={locality.id}&horizon=1h")
    interventions = [r["intervention"] for r in res.json()["recommendations"]]
    assert "solar_utilization" not in interventions


# ─── 8. ALL LOCALITIES WORK ────────────────────────────────────────────────────

def test_recommendations_all_localities():
    for locality in LOCALITIES:
        res = client.get(f"/api/recommendations?locality_id={locality.id}&horizon=1h")
        assert res.status_code == 200, f"{locality.id} failed: {res.text}"
