from fastapi.testclient import TestClient

from app.main import app
from app.seed_data import LOCALITIES

client = TestClient(app)


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_list_localities_returns_all_seeded_localities():
    res = client.get("/api/localities")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == len(LOCALITIES)
    assert {item["id"] for item in body} == {loc.id for loc in LOCALITIES}


def test_list_localities_includes_expected_fields():
    res = client.get("/api/localities")
    first = res.json()[0]
    expected_fields = {
        "id",
        "name",
        "latitude",
        "longitude",
        "residential_share",
        "commercial_share",
        "solar_capacity_mw",
        "typical_peak_hour",
        "demand_profile",
        "cooling_sensitivity",
        "current_demand_mw",
        "peak_threshold_mw",
    }
    assert expected_fields.issubset(first.keys())


def test_get_locality_by_id():
    res = client.get("/api/localities/andheri")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == "andheri"
    assert body["name"] == "Andheri"


def test_get_locality_not_found():
    res = client.get("/api/localities/nonexistent-zone")
    assert res.status_code == 404
