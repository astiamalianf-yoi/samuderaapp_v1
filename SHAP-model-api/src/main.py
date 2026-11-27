import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from engine.inference_engine import (
    BEACH_SLUGS,
    HIGH_TRUST_SIGNS,
    LOW_TRUST_SIGNS,
    MATRIX,
    STRATEGIES,
    InferenceEngine as LikInferenceEngine,
)

DB_PATH = os.getenv("DB_PATH", "/app/data/disaster.db")

SUPPORTED_BEACHES = list(BEACH_SLUGS)
TRUSTED_SIGNS = HIGH_TRUST_SIGNS + LOW_TRUST_SIGNS  # ranked signs (Trust Index, paper Table 2)

app = FastAPI(title="LIK Inference Engine API", version="2.0.0")
engine = LikInferenceEngine()


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": engine.config is not None}


class FishermanProfile(BaseModel):
    """The 12 fisherman features of the classifier (see the supplementary codebook)."""
    age: float = Field(..., ge=10, le=100, description="Age in years")
    fishing_experience: float = Field(..., ge=0, le=80, description="Years as a fisherman")
    fishing_role: int = Field(..., ge=1, le=3, description="1 boat owner/master, 2 skipper/captain, 3 crew member")
    head_of_community: int = Field(..., ge=0, le=1, description="Ever led a fisherman association: 1 yes, 0 no")
    fishing_duration: int = Field(..., ge=1, le=3, description="Time at sea: 1 <1 day, 2 several days, 3 several weeks")
    disaster_experience_count: int = Field(..., ge=0, le=6, description="Number of hazard types experienced")
    disaster_interaction: float = Field(..., ge=0, le=50, description="Times personally hit by dangerous strong wind")
    lik_combination_count: int = Field(..., ge=1, le=17, description="Number of strong-wind signs used")
    usage_duration: float = Field(..., ge=0, le=80, description="Years using the sign")
    usage_frequency_min: float = Field(..., ge=0, le=60, description="Times per month the sign was observed (lower bound)")
    usage_frequency_max: float = Field(..., ge=0, le=60, description="Times per month the sign was observed (upper bound)")
    usage_frequency_avg: Optional[float] = Field(None, ge=0, le=60, description="Defaults to the mean of min and max")


class TrustTiers(BaseModel):
    """Live Trust Index tiers (Paper 2, Eq. 2-3, re-estimated with app data by the backend)."""
    high: list[str]
    low: list[str]


class PredictRequest(BaseModel):
    lik_codes: list[str]
    beach_location: str
    is_active_warning: bool = False
    active_warning: list[str] = []
    fisherman_profile: Optional[FishermanProfile] = None
    beach_id: Optional[int] = None
    beach_name: Optional[str] = None
    reported_codes: Optional[list[str]] = None
    bmkg_wind_speed: Optional[float] = None
    bmkg_wave_height: Optional[float] = None
    bmkg_rainfall: Optional[float] = None
    trust_tiers: Optional[TrustTiers] = None
    # Beach class per sign by majority of the beach's registered fishermen (1 Actionable, 0 Inaction);
    # used for the beach alert when no fisherman_profile is given. Absent: the survey beach profile.
    community_classes: Optional[dict[str, int]] = None


@app.post("/predict")
async def predict(req: PredictRequest):
    if req.beach_location not in SUPPORTED_BEACHES:
        raise HTTPException(status_code=400, detail=f"unsupported beach_location: {req.beach_location}")

    codes = req.reported_codes if req.reported_codes else req.lik_codes
    rules = engine.beach_rules[req.beach_location]
    profile = req.fisherman_profile.model_dump() if req.fisherman_profile else None

    try:
        result = engine.predict({
            "lik_codes": codes,
            "active_warning": req.active_warning,
            "rules": rules,
            "fisherman_profile": profile,
            "trust_tiers": req.trust_tiers.model_dump() if req.trust_tiers else None,
            "community_classes": req.community_classes,
        })
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    result["explanation"] = engine.compute_contributions(result, rules, req.beach_location)
    return result


class ExplainProfileRequest(BaseModel):
    fisherman_profile: FishermanProfile
    beach_location: Optional[str] = None


@app.post("/explain-profile")
async def explain_profile(req: ExplainProfileRequest):
    """SHAP of one fisherman's answers ("Profil Anda"). Beaches without a location model get no
    explanation: their fishermen are Inaction whatever their answers."""
    if req.beach_location and engine.beach_rules.get(req.beach_location, {}).get("location_model") is False:
        return {"available": False, "reason": "no_location_model"}
    try:
        return {"available": True, **engine.explain_profile(req.fisherman_profile.model_dump())}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.get("/model/info")
async def model_info():
    cfg = engine.config
    return {
        "name": "Trust-calibrated LIK warning (Trust Index + Random Forest)",
        "version": app.version,
        "type": "two-stage: trust tier + random-forest behavioral classifier + warning strategy matrix",
        "classifier": {
            "model": cfg["model"],
            "params": cfg["params"],
            "operating_threshold": cfg["operating_threshold"],
            "decision_rule": cfg["decision_rule"],
            "features": cfg["features"],
            "training_records": cfg["training_records"],
            "training_fishermen": cfg["training_fishermen"],
            "software": cfg["software"],
        },
        "trust_tiers": {"high": HIGH_TRUST_SIGNS, "low": LOW_TRUST_SIGNS, "unranked_signs_treated_as": "low"},
        "warning_strategy_matrix": {f"{tier}/{'actionable' if cls else 'inaction'}": code for (tier, cls), code in MATRIX.items()},
        "strategies": STRATEGIES,
        "supported_beaches": SUPPORTED_BEACHES,
        "trusted_signs": TRUSTED_SIGNS,
    }


@app.post("/retrain")
async def retrain():
    raise HTTPException(status_code=501, detail="Retraining runs offline: see training/train_rf.py")
