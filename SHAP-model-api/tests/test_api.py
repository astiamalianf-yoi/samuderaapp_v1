from src.main import SUPPORTED_BEACHES, TRUSTED_SIGNS
from tests.test_inference import SAFE_PROFILE, UNSAFE_PROFILE

VALID_PAYLOAD = {"beach_location": "pantai_lampuuk", "lik_codes": ["wn-3"], "is_active_warning": False, "active_warning": []}
UNSAFE_BEACH_PAYLOAD = {**VALID_PAYLOAD, "beach_location": "pantai_depok"}

LEGACY_FIELDS = {"active_warning", "sign_description", "community_characteristics",
                 "action_recommendation", "triggered_lik_codes"}


def test_predict_valid_keeps_legacy_fields(client):
    res = client.post("/predict", json=VALID_PAYLOAD)
    assert res.status_code == 200
    body = res.json()
    assert LEGACY_FIELDS <= set(body)
    assert {"lik_risk_level", "warning_strategy", "signs", "explanation"} <= set(body)


def test_predict_invalid_beach(client):
    res = client.post("/predict", json={**VALID_PAYLOAD, "beach_location": "pantai_bali"})
    assert res.status_code == 400


def test_predict_empty_lik_codes(client):
    body = client.post("/predict", json={**VALID_PAYLOAD, "lik_codes": []}).json()
    assert body["triggered_lik_codes"] == []
    assert body["lik_risk_level"] == "NORMAL"
    assert "aman" in body["action_recommendation"].lower()


def test_unsafe_beach_gets_more_intensive_strategy_not_suppression(client):
    # Regression: an Unsafe community must get a MORE intensive warning, never a suppressed one.
    safe = client.post("/predict", json=VALID_PAYLOAD).json()
    unsafe = client.post("/predict", json=UNSAFE_BEACH_PAYLOAD).json()
    assert safe["warning_strategy"]["code"] == "STANDARD"
    assert unsafe["warning_strategy"]["code"] == "EXTRA_WARNING"
    assert unsafe["lik_risk_level"] == "SIAGA"
    assert unsafe["community_characteristics"] == "Actionable"


def test_predict_with_fisherman_profile(client):
    res = client.post("/predict", json={**VALID_PAYLOAD, "fisherman_profile": UNSAFE_PROFILE})
    assert res.status_code == 200
    ws = res.json()["warning_strategy"]
    assert ws["behavioral_source"] == "random_forest"
    assert ws["code"] == "EXTRA_WARNING"
    res = client.post("/predict", json={**VALID_PAYLOAD, "fisherman_profile": SAFE_PROFILE})
    assert res.json()["warning_strategy"]["code"] == "STANDARD"


def test_predict_rejects_out_of_range_profile(client):
    res = client.post("/predict", json={**VALID_PAYLOAD, "fisherman_profile": {**SAFE_PROFILE, "fishing_role": 7}})
    assert res.status_code == 422


def test_predict_active_warning_merged(client):
    body = client.post("/predict", json={**VALID_PAYLOAD, "is_active_warning": True, "active_warning": ["wn-1"]}).json()
    assert {"Wn-3", "Wn-1"} <= set(body["triggered_lik_codes"])


def test_explanation_shape(client):
    body = client.post("/predict", json={**VALID_PAYLOAD, "beach_location": "pantai_samas", "lik_codes": ["wn-4"]}).json()
    exp = body["explanation"]
    assert {"summary_id", "summary_en", "contributions", "community_profile"} <= set(exp)
    assert abs(sum(c["weight"] for c in exp["contributions"]) - 1.0) < 0.02


def test_health(client):
    assert client.get("/health").json() == {"status": "ok", "model_loaded": True}


def test_retrain_not_implemented(client):
    assert client.post("/retrain").status_code == 501


def test_model_info(client):
    body = client.get("/model/info").json()
    assert body["classifier"]["model"] == "Random Forest"
    assert body["classifier"]["operating_threshold"] == 0.60
    assert body["classifier"]["params"]["n_estimators"] == 200
    assert body["supported_beaches"] == SUPPORTED_BEACHES
    assert body["trusted_signs"] == TRUSTED_SIGNS
    assert body["trust_tiers"]["high"] == ["Wn-3", "Wn-8", "Wn-1", "Wn-2", "Wn-7"]


def test_explain_profile_lists_his_answers(client):
    r = client.post("/explain-profile", json={"fisherman_profile": SAFE_PROFILE, "beach_location": "pantai_lampuuk"})
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is True
    assert set(body["contributions"]) == {
        "age", "fishing_experience", "fishing_role", "head_of_community", "fishing_duration",
        "disaster_experience_count", "disaster_interaction", "lik_combination_count", "usage_duration", "usage_frequency"}


def test_explain_profile_many_signs_pushes_towards_inaction(client):
    many = {**SAFE_PROFILE, "lik_combination_count": 6}
    c = client.post("/explain-profile", json={"fisherman_profile": many}).json()["contributions"]
    assert c["lik_combination_count"] < 0


def test_explain_profile_not_given_for_beach_without_model(client):
    r = client.post("/explain-profile", json={"fisherman_profile": SAFE_PROFILE, "beach_location": "pantai_pangandaran"})
    assert r.json() == {"available": False, "reason": "no_location_model"}
