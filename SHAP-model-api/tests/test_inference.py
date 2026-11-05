import pytest

from src.engine.inference_engine import HIGH_TRUST_SIGNS, LOW_TRUST_SIGNS, MATRIX

# A profile on the Inaction side of every tipping point in paper Table 8
# (interaction <= 1.5, avg monthly use <= 4.75, age >= 45.5, usage <= 17.5 y, experiences >= 2.5).
UNSAFE_PROFILE = dict(age=55, fishing_experience=30, fishing_role=3, head_of_community=0, fishing_duration=1,
                      disaster_experience_count=4, disaster_interaction=1, lik_combination_count=2,
                      usage_duration=8, usage_frequency_min=2, usage_frequency_max=4)
# A profile on the Actionable side of every tipping point.
SAFE_PROFILE = dict(age=30, fishing_experience=10, fishing_role=2, head_of_community=1, fishing_duration=1,
                    disaster_experience_count=1, disaster_interaction=6, lik_combination_count=2,
                    usage_duration=25, usage_frequency_min=12, usage_frequency_max=20)


def run(engine, codes, beach="pantai_lampuuk", active=None, profile=None):
    return engine.predict({"lik_codes": codes, "active_warning": active or [],
                           "rules": engine.beach_rules[beach], "fisherman_profile": profile})


class TestTrustTiers:

    def test_tiers_match_paper_table_2(self):
        assert HIGH_TRUST_SIGNS == ["Wn-3", "Wn-8", "Wn-1", "Wn-2", "Wn-7"]
        assert LOW_TRUST_SIGNS == ["Wn-13", "Wn-4", "Wn-9", "Wn-6", "Wn-5"]

    def test_unranked_signs_are_kept_as_low_trust(self, engine):
        r = run(engine, ["wn-10", "wn-11", "wn-1"])
        assert r["triggered_lik_codes"] == ["Wn-1", "Wn-10", "Wn-11"]
        tiers = {s["code"]: (s["trust_tier"], s["ranked"]) for s in r["signs"]}
        assert tiers["Wn-1"] == ("High", True)
        assert tiers["Wn-10"] == ("Low", False)

    def test_unknown_codes_are_dropped(self, engine):
        assert run(engine, ["wn-99", "xx", "wn-3"])["triggered_lik_codes"] == ["Wn-3"]

    def test_active_warning_merged_and_deduplicated(self, engine):
        r = run(engine, ["wn-1"], active=["wn-8", "wn-1"])
        assert r["triggered_lik_codes"] == ["Wn-1", "Wn-8"]


class TestBeachFallback:

    def test_depok_rules_use_depok_row(self, engine):
        # regression: Depok's interaction status used to be read from Lampuuk's row
        df = engine.df_community.set_index("Mapped Beach")
        assert engine.pantai_depok_rules["Level of Interaction with Disaster Status"] == \
            df.loc["pantai depok", "Level of Interaction with Disaster Status"]

    @pytest.mark.parametrize("beach,cls", [("pantai_lampuuk", 1), ("pantai_depok", 0), ("pantai_samas", 0)])
    def test_beach_class(self, engine, beach, cls):
        r = run(engine, ["wn-3"], beach=beach)
        assert r["signs"][0]["behavioral_class"] == cls
        assert r["warning_strategy"]["behavioral_source"] == "beach_profile"


class TestRandomForest:

    def test_threshold_is_paper_value(self, engine):
        assert engine.threshold == 0.60

    def test_unsafe_profile_is_inaction(self, engine):
        p = engine.predict_proba_for_sign(engine.profile_to_features(UNSAFE_PROFILE), "Wn-3")
        assert p < 0.60

    def test_safe_profile_is_actionable(self, engine):
        p = engine.predict_proba_for_sign(engine.profile_to_features(SAFE_PROFILE), "Wn-3")
        assert p >= 0.60

    def test_profile_overrides_beach(self, engine):
        # Depok's beach profile is Unsafe, but an individual profile decides when given.
        r = run(engine, ["wn-3"], beach="pantai_depok", profile=SAFE_PROFILE)
        assert r["signs"][0]["behavioral_class"] == 1
        assert r["warning_strategy"]["behavioral_source"] == "random_forest"
        assert r["signs"][0]["probability_actionable"] is not None

    def test_missing_profile_field_raises(self, engine):
        bad = {k: v for k, v in SAFE_PROFILE.items() if k != "age"}
        with pytest.raises(ValueError):
            run(engine, ["wn-3"], profile=bad)

    def test_average_frequency_defaults_to_mean(self, engine):
        f = engine.profile_to_features(SAFE_PROFILE)
        assert f["Average Frequency of Usage (in month)"] == 16


class TestWarningStrategyMatrix:

    def test_matrix_matches_paper_table_10(self):
        assert MATRIX == {("High", 1): "STANDARD", ("High", 0): "EXTRA_WARNING",
                          ("Low", 1): "ENHANCED_MONITORING", ("Low", 0): "MAXIMUM_ALERT"}

    @pytest.mark.parametrize("code,profile,strategy,level", [
        ("wn-3", SAFE_PROFILE, "STANDARD", "SIAGA"),
        ("wn-3", UNSAFE_PROFILE, "EXTRA_WARNING", "SIAGA"),
        ("wn-5", SAFE_PROFILE, "ENHANCED_MONITORING", "WASPADA"),
        ("wn-5", UNSAFE_PROFILE, "MAXIMUM_ALERT", "SIAGA"),
    ])
    def test_four_cells(self, engine, code, profile, strategy, level):
        r = run(engine, [code], profile=profile)
        assert r["warning_strategy"]["code"] == strategy
        assert r["lik_risk_level"] == level
        assert r["community_characteristics"] == "Actionable"

    def test_high_trust_sign_decides_mixed_alert(self, engine):
        r = run(engine, ["wn-3", "wn-5"], profile=SAFE_PROFILE)
        assert r["warning_strategy"]["trust_tier"] == "High"
        assert r["warning_strategy"]["code"] == "STANDARD"

    def test_inaction_action_guide_is_protective(self, engine):
        # Wn-2's most frequent response is "be cautious"; the action guide must still be protective.
        r = run(engine, ["wn-2"], profile=UNSAFE_PROFILE)
        assert r["warning_strategy"]["code"] == "EXTRA_WARNING"
        assert "Amankan Alat Tangkap" in r["action_recommendation"]

    def test_no_signs_is_normal(self, engine):
        r = run(engine, [])
        assert r["warning_strategy"] is None
        assert r["lik_risk_level"] == "NORMAL"
        assert r["community_characteristics"] == "Low Actionable"
        assert "Tidak ada rekomendasi" in r["action_recommendation"]


class TestActionRecommendation:

    def test_highest_action_wins(self, engine):
        r = run(engine, ["wn-1", "wn-2", "wn-3"])
        assert "Sesuaikan Jadwal Melaut" in r["action_recommendation"]

    def test_single_code_returns_its_action(self, engine):
        r = run(engine, ["wn-8"])
        assert "Siaga Penuh" in r["action_recommendation"]


class TestSignDescriptions:

    def test_valid_code_returns_info(self, engine):
        descs = engine.get_lik_sign_info(["wn-1"])
        assert descs[0]["code"] == "WN-1"

    def test_all_17_signs_have_labels(self, engine):
        assert len(engine.get_lik_sign_info([f"wn-{i}" for i in range(1, 18)])) == 17

    def test_invalid_code_returns_empty(self, engine):
        assert engine.get_lik_sign_info(["wn-99"]) == []


class TestContributions:

    def test_contributions_sorted_and_normalized(self, engine):
        rules = engine.pantai_samas_rules
        pred = run(engine, ["wn-4", "wn-7"], beach="pantai_samas")
        out = engine.compute_contributions(pred, rules, "pantai_samas")
        w = [c["weight"] for c in out["contributions"]]
        assert w == sorted(w, reverse=True)
        assert abs(sum(w) - 1.0) < 0.02
        assert len(out["community_profile"]["factors"]) == 5
