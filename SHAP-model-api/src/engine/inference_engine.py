"""LIK inference engine: the two-stage warning decision of the JISEBI paper.

Stage 1 - Trust Index tier of each reported sign (paper Table 2 / Eq. 3):
    High: Wn-3, Wn-8, Wn-1, Wn-2, Wn-7
    Low:  Wn-13, Wn-4, Wn-9, Wn-6, Wn-5
    Unranked signs (Wn-10, 11, 12, 14-17; < 20 records) are never ignored, but are
    treated as Low-trust until they can be ranked (paper Section III.D).

Stage 2 - Behavioral class of the recipient (paper Eq. 4):
    * If a fisherman profile (the 12 fisherman features of the codebook) is given,
      the final Random Forest computes P(Actionable) for that fisherman together with
      the observed sign; class 1 if P >= 0.60, otherwise class 0 (Inaction).
    * Otherwise the beach-level community profile is used as a fallback
      ("Overall Category" in community_rule_categorization.csv; Unsafe -> class 0).

Coupling - Warning Strategy Matrix (paper Eq. 5 / Table 10):
                 Actionable (1)                   Inaction (0)
    High tier    Standard EWS Notification        Extra Warning + Action Guide
    Low tier     Enhanced Sign Monitoring         Maximum Alert + Intervention
"""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ENGINE_DIR = Path(__file__).parent
MODEL_DIR = ENGINE_DIR / "model"

HIGH_TRUST_SIGNS = ["Wn-3", "Wn-8", "Wn-1", "Wn-2", "Wn-7"]
LOW_TRUST_SIGNS = ["Wn-13", "Wn-4", "Wn-9", "Wn-6", "Wn-5"]
RANKED_SIGNS = HIGH_TRUST_SIGNS + LOW_TRUST_SIGNS
ALL_SIGNS = [f"Wn-{i}" for i in range(1, 18)]

# Beaches with a community profile (community_rule_categorization.csv) for the model in this service.
PROFILED_BEACHES = ["pantai_lampuuk", "pantai_lhoknga", "pantai_ulee_lheue", "pantai_depok", "pantai_samas"]
# West Java (Pangandaran) beaches: no location model loaded yet. Paper 3 shows the Aceh model is
# repeatable but not transportable, so the Aceh Random Forest is NOT applied here; until the
# Pangandaran export is loaded, every recipient is treated as Inaction (0), the cautious side of
# the matrix (Extra Warning / Maximum Alert). Results carry source="no_location_model".
NO_MODEL_BEACHES = ["pantai_pangandaran", "pantai_batu_karas", "pantai_bojongsalawe"]
BEACH_SLUGS = PROFILED_BEACHES + NO_MODEL_BEACHES

# Strategy -> LIK hazard level passed to the backend fusion (max with BMKG).
# Low-trust + Actionable is "Enhanced Sign Monitoring" rather than a direct alert (paper IV.D),
# so it is the only strategy below SIAGA. No strategy suppresses the alert.
STRATEGIES = {
    "STANDARD": {
        "label_id": "Peringatan Standar",
        "label_en": "Standard EWS Notification",
        "lik_risk_level": "SIAGA",
        "message_id": "Tanda alam terpercaya terdeteksi. Ikuti rekomendasi tindakan di bawah.",
    },
    "EXTRA_WARNING": {
        "label_id": "Peringatan Tambahan + Panduan Tindakan",
        "label_en": "Extra Warning + Action Guide",
        "lik_risk_level": "SIAGA",
        "message_id": "Tanda alam terpercaya terdeteksi. Jangan hanya berhati-hati: lakukan langkah perlindungan di bawah. Langkah ini terbukti melindungi nelayan dan perahu.",
    },
    "ENHANCED_MONITORING": {
        "label_id": "Pantau Tanda Alam Lebih Lanjut",
        "label_en": "Enhanced Sign Monitoring",
        "lik_risk_level": "WASPADA",
        "message_id": "Tanda alam ini belum terbukti cukup akurat. Amati tanda alam lain dan periksa info BMKG sebelum melaut.",
    },
    "MAXIMUM_ALERT": {
        "label_id": "Peringatan Maksimum + Intervensi",
        "label_en": "Maximum Alert + Intervention",
        "lik_risk_level": "SIAGA",
        "message_id": "Tanda alam terdeteksi dan risiko tidak bertindak tinggi. Tunda melaut, amankan alat tangkap, dan hubungi Panglima Laot atau ketua kelompok sebelum berangkat.",
    },
}
MATRIX = {
    ("High", 1): "STANDARD",
    ("High", 0): "EXTRA_WARNING",
    ("Low", 1): "ENHANCED_MONITORING",
    ("Low", 0): "MAXIMUM_ALERT",
}
# Protective action given in the action guide when the sign's most frequent response is not protective.
PROTECTIVE_FALLBACK_ACTION = "Siaga Penuh / Amankan Alat Tangkap, dan Sesuaikan Jadwal Melaut"

FISHERMAN_FEATURE_KEYS = {
    # request key                    -> model feature name (codebook Table A)
    "age": "Age",
    "fishing_experience": "Fishing Experience",
    "fishing_role": "Fishing Role",                                   # 1 owner, 2 skipper, 3 crew
    "head_of_community": "Experience as Head of Communities",         # 0 no, 1 yes
    "fishing_duration": "Fishing Duration",                           # 1 <1 day, 2 days, 3 weeks
    "disaster_experience_count": "Number of Experience with Disaster",  # 1-5 hazard types
    "disaster_interaction": "Level of Interaction with Disaster",     # 0-8 times
    "lik_combination_count": "Number of LIK Combination",             # 1-4
    "usage_duration": "Usage Duration",                               # years
    "usage_frequency_min": "Frequency of Usage (min) (in month)",
    "usage_frequency_max": "Frequency of Usage (max) (in month)",
}


def tier_of(code: str) -> str:
    return "High" if code in HIGH_TRUST_SIGNS else "Low"


def normalize_code(code) -> str:
    s = str(code).strip()
    return s.capitalize() if s.lower().startswith("wn-") else s


class InferenceEngine:

    _model = None
    _config = None

    def __init__(self):
        self.df_community = pd.read_csv(ENGINE_DIR / 'community_rule_categorization.csv')
        self.beach_rules = {}
        for slug in NO_MODEL_BEACHES:
            self.beach_rules[slug] = {
                'Overall Category': "Unknown",
                'Level of Interaction with Disaster Status': "Unknown",
                'Frequency of Usage Status': "Unknown",
                'Usage Duration Status': "Unknown",
                'Number of Known LIK Status': "Unknown",
                'Number of Experience with Disaster Status': "Unknown",
                'location_model': False,
            }
        for slug in PROFILED_BEACHES:
            row = self.df_community[self.df_community['Mapped Beach'] == slug.replace("_", " ")].iloc[0]
            rules = {
                'Overall Category': row['Overall Category'],
                'Level of Interaction with Disaster Status': row['Level of Interaction with Disaster Status'],
                'Frequency of Usage Status': row['Frequency of Usage Status'],
                'Usage Duration Status': row['Usage Duration Status'],
                'Number of Known LIK Status': row['Number of LIK Combination Status'],
                'Number of Experience with Disaster Status': row['Number of Experience with Disaster Status'],
            }
            self.beach_rules[slug] = rules
            setattr(self, f"{slug}_rules", rules)
        self._load_model()

    @classmethod
    def _load_model(cls):
        if cls._model is None:
            cls._model = joblib.load(MODEL_DIR / "rf_final.joblib")
            cls._config = json.loads((MODEL_DIR / "rf_config.json").read_text())
        return cls._model, cls._config

    @property
    def config(self) -> dict:
        return self._config

    @property
    def threshold(self) -> float:
        return float(self._config["operating_threshold"])

    LIK_LABELS = {
        "wn-1": {"label_id": "Awan Turun", "label_en": "Falling Clouds", "detail_id": "Awan tampak turun ke bawah membentuk gumpalan 3 kali", "detail_en": "Clouds appear to descend forming clusters 3 times"},
        "wn-2": {"label_id": "Awan Bergumpal", "label_en": "Clustered Clouds", "detail_id": "Awan bergumpal dalam beberapa kelompok yang tampak saling mendekat atau menyatu", "detail_en": "Clouds cluster in groups that appear to approach or merge"},
        "wn-3": {"label_id": "Kilat", "label_en": "Lightning", "detail_id": "Kilat muncul di salah satu sisi langit ataupun saling berbalas antara dua sisi", "detail_en": "Lightning appears on one side of the sky or flashes between two sides"},
        "wn-4": {"label_id": "Ombak Besar", "label_en": "High Waves", "detail_id": "Gelombang laut berubah pola dari kecil dan sering hingga besar dan rapat", "detail_en": "Ocean waves change pattern from small and frequent to large and dense"},
        "wn-5": {"label_id": "Lumba-lumba Mendekat", "label_en": "Approaching Dolphins", "detail_id": "Lumba-lumba mendekati perahu, seolah menggiring perahu", "detail_en": "Dolphins approach the boat, seemingly herding it"},
        "wn-6": {"label_id": "Burung Camar", "label_en": "Seagulls", "detail_id": "Burung camar terbang tergesa sambil bersuara keras", "detail_en": "Seagulls fly hastily while calling loudly"},
        "wn-7": {"label_id": "Peralihan Angin", "label_en": "Wind Transition", "detail_id": "Pada masa peralihan angin barat ke angin timur", "detail_en": "During the transition from west wind to east wind"},
        "wn-8": {"label_id": "Langit Mendung", "label_en": "Overcast Sky", "detail_id": "Langit mendung namun tidak terlalu gelap", "detail_en": "Sky is overcast but not too dark"},
        "wn-9": {"label_id": "Hujan dan Awan Tebal", "label_en": "Rain and Thick Clouds", "detail_id": "Hujan atau langit tertutup awan tebal, saat angin timur", "detail_en": "Rain or sky covered by thick clouds during east wind"},
        "wn-10": {"label_id": "Cerah Tanpa Awan", "label_en": "Clear Cloudless Sky", "detail_id": "Cuaca cerah tanpa awan, saat angin barat", "detail_en": "Clear weather without clouds during west wind"},
        "wn-11": {"label_id": "Suara Dentuman", "label_en": "Booming Sound", "detail_id": "Terdengar suara dentuman satu atau tujuh kali", "detail_en": "A booming sound is heard once or seven times"},
        "wn-12": {"label_id": "Bintang Berkelip", "label_en": "Twinkling Stars", "detail_id": "Banyak bintang di malam hari berkelap kelip, saat angin barat", "detail_en": "Many stars twinkle at night during west wind"},
        "wn-13": {"label_id": "Bintang Tak Terlihat", "label_en": "Stars Not Visible", "detail_id": "Bintang tidak terlihat di malam hari, saat angin timur", "detail_en": "Stars not visible at night during east wind"},
        "wn-14": {"label_id": "Bintang Dekat Bulan", "label_en": "Star Near the Moon", "detail_id": "Bintang tampak dekat atau sejajar dengan bulan, bahkan di dalam lingkaran bulan", "detail_en": "Stars appear close to or aligned with the moon, even inside its halo"},
        "wn-15": {"label_id": "Kecoak Beterbangan", "label_en": "Flying Cockroaches", "detail_id": "Kecoak beterbangan di dalam perahu", "detail_en": "Cockroaches fly around inside the boat"},
        "wn-16": {"label_id": "Bulan di Bintang Kala", "label_en": "Moon in Scorpius", "detail_id": "Bulan tampak di antara capit bintang kala (rasi Scorpio)", "detail_en": "The moon appears between the claws of the Scorpius constellation"},
        "wn-17": {"label_id": "Paus Muncul", "label_en": "Surfacing Whales", "detail_id": "Paus muncul ke permukaan dan mengibaskan ekornya", "detail_en": "Whales surface and flap their tails"},
    }

    def get_lik_sign_info(self, lik_codes: list) -> list:
        return [
            {"code": code.upper(), **self.LIK_LABELS[code.lower()]}
            for code in lik_codes
            if code.lower() in self.LIK_LABELS
        ]

    # ------------------------------------------------------------------
    # Stage 2: behavioral class
    # ------------------------------------------------------------------
    @staticmethod
    def profile_to_features(profile: dict) -> dict:
        """Map a fisherman profile (request keys) to the 12 model features.

        `usage_frequency_avg` is derived as the mean of min and max (codebook No. 25)
        when it is not given.
        """
        feats = {}
        for key, name in FISHERMAN_FEATURE_KEYS.items():
            if profile.get(key) is None:
                raise ValueError(f"fisherman_profile.{key} is required")
            feats[name] = float(profile[key])
        avg = profile.get("usage_frequency_avg")
        feats["Average Frequency of Usage (in month)"] = (
            float(avg) if avg is not None
            else (feats["Frequency of Usage (min) (in month)"] + feats["Frequency of Usage (max) (in month)"]) / 2
        )
        return feats

    def predict_proba_for_sign(self, fisherman_features: dict, sign: str) -> float:
        """P(Class 1 = Actionable) of the final Random Forest for one fisherman + one sign."""
        model, cfg = self._load_model()
        row = {f: 0.0 for f in cfg["features"]}
        row.update(fisherman_features)
        if sign in ALL_SIGNS:
            row[sign] = 1.0
        X = pd.DataFrame([row], columns=cfg["features"])
        return float(model.predict_proba(X)[0, list(model.classes_).index(1)])

    def behavioral_class(self, sign: str, profile: dict | None, rules: dict) -> dict:
        if rules.get('location_model') is False:
            return {"class": 0, "probability": None, "threshold": None, "source": "no_location_model"}
        if profile:
            p = self.predict_proba_for_sign(self.profile_to_features(profile), sign)
            cls = 1 if p >= self.threshold else 0
            return {"class": cls, "probability": round(p, 4), "threshold": self.threshold, "source": "random_forest"}
        cls = 0 if rules.get('Overall Category') == "Unsafe" else 1
        return {"class": cls, "probability": None, "threshold": None, "source": "beach_profile"}

    # ------------------------------------------------------------------
    # Full decision
    # ------------------------------------------------------------------
    def predict(self, data: dict) -> dict:
        csv_path = ENGINE_DIR / 'lik_filtered_action_taken.csv'
        try:
            df_action = pd.read_csv(csv_path)
        except FileNotFoundError:
            df_action = pd.DataFrame(columns=['LIK', 'most_action_taken'])
        dominant_action = dict(zip(df_action['LIK'], df_action['most_action_taken']))

        rules = data.get('rules', {})
        profile = data.get('fisherman_profile')

        input_codes = [normalize_code(s) for s in data.get('lik_codes', [])]
        active_codes = [normalize_code(s) for s in data.get('active_warning', [])]
        # Every known Wn sign is kept: unranked signs are treated as Low-trust, never ignored.
        combined_codes = sorted({c for c in input_codes + active_codes if c in ALL_SIGNS},
                                key=lambda c: int(c.split('-')[1]))

        # ---- Per-sign decision: tier x behavioral class -> strategy
        signs = []
        for code in combined_codes:
            beh = self.behavioral_class(code, profile, rules)
            strategy = MATRIX[(tier_of(code), beh["class"])]
            signs.append({
                "code": code,
                "trust_tier": tier_of(code),
                "ranked": code in RANKED_SIGNS,
                "behavioral_class": beh["class"],
                "probability_actionable": beh["probability"],
                "strategy": strategy,
                "dominant_action": dominant_action.get(code),
            })

        # ---- Overall strategy for the beach alert.
        # A High-trust sign is the reliable basis for a direct alert, so when any High-trust sign is
        # present the decision is taken on the High-trust signs; otherwise on the Low-trust signs.
        # Within the chosen tier, the more intensive strategy (Inaction class) wins.
        if signs:
            tier = "High" if any(s["trust_tier"] == "High" for s in signs) else "Low"
            in_tier = [s for s in signs if s["trust_tier"] == tier]
            cls = 0 if any(s["behavioral_class"] == 0 for s in in_tier) else 1
            strategy_code = MATRIX[(tier, cls)]
            basis = in_tier
        else:
            tier, cls, strategy_code, basis = None, None, None, []

        # ---- Action recommendation (most severe dominant action among the basis signs)
        escalation_map = {
            'berhati-hati / tingkatkan kewaspadaan': 0,
            'siaga penuh / amankan alat tangkap': 1,
            'sesuaikan jadwal melaut': 2,
        }
        best_action, trigger_code, best_level = None, None, -1
        for s in basis:
            a = s["dominant_action"]
            lvl = escalation_map.get(str(a).lower(), -1) if a else -1
            if lvl > best_level:
                best_level, best_action, trigger_code = lvl, a, s["code"]
        if strategy_code in ("EXTRA_WARNING", "MAXIMUM_ALERT") and best_level < 1:
            # The action guide must state a protective action, not only "be cautious".
            best_action = PROTECTIVE_FALLBACK_ACTION
            trigger_code = trigger_code or (basis[0]["code"] if basis else None)

        if strategy_code is None:
            action_recommendation = "Situasi aman. Tidak ada rekomendasi tindakan eskalasi tinggi saat ini."
        elif strategy_code == "ENHANCED_MONITORING":
            info = self.get_lik_sign_info([basis[0]["code"]])
            sign_txt = info[0]['detail_id'] if info else basis[0]["code"]
            action_recommendation = (f"Berdasarkan indikasi: {sign_txt}. {STRATEGIES[strategy_code]['message_id']}")
        else:
            info = self.get_lik_sign_info([trigger_code]) if trigger_code else []
            sign_txt = info[0]['detail_id'] if info else trigger_code
            action_recommendation = f"Berdasarkan indikasi: {sign_txt}, direkomendasikan tindakan: {best_action}."
            if strategy_code != "STANDARD":
                action_recommendation += f" {STRATEGIES[strategy_code]['message_id']}"

        desc_list = self.get_lik_sign_info(combined_codes)
        sign_description_str = " | ".join(f"{d['code']} - {d['detail_id']}" for d in desc_list) \
            or "Tidak ada deskripsi tanda alam yang valid."

        lik_risk_level = STRATEGIES[strategy_code]["lik_risk_level"] if strategy_code else "NORMAL"

        return {
            "active_warning": combined_codes,
            "sign_description": sign_description_str,
            # Legacy field read by the backend and PWA: "Actionable" = the signs warrant an alert.
            "community_characteristics": "Actionable" if strategy_code else "Low Actionable",
            "action_recommendation": action_recommendation,
            "triggered_lik_codes": combined_codes,
            "lik_risk_level": lik_risk_level,
            "warning_strategy": None if strategy_code is None else {
                "code": strategy_code,
                "label_id": STRATEGIES[strategy_code]["label_id"],
                "label_en": STRATEGIES[strategy_code]["label_en"],
                "message_id": STRATEGIES[strategy_code]["message_id"],
                "trust_tier": tier,
                "behavioral_class": cls,
                "behavioral_label": None if cls is None else ("Actionable" if cls == 1 else "Inaction"),
                "behavioral_source": "random_forest" if profile else "beach_profile",
            },
            "signs": signs,
        }

    ESCALATION_WEIGHTS = {
        0: 0.3,
        1: 0.6,
        2: 0.9,
    }

    COMMUNITY_FACTOR_META = {
        "interaction": {
            "label_id": "Interaksi Bencana",
            "label_en": "Disaster Interaction",
            "rule_key": "Level of Interaction with Disaster Status",
            "detail_safe_id": "Cukup berinteraksi dengan bencana",
            "detail_safe_en": "Adequate disaster interaction",
            "detail_unsafe_id": "Kurang berinteraksi dengan bencana",
            "detail_unsafe_en": "Limited disaster interaction",
        },
        "frequency": {
            "label_id": "Frekuensi Pelaporan",
            "label_en": "Reporting Frequency",
            "rule_key": "Frequency of Usage Status",
            "detail_safe_id": "Sering menggunakan sistem",
            "detail_safe_en": "Frequently uses the system",
            "detail_unsafe_id": "Jarang menggunakan sistem",
            "detail_unsafe_en": "Rarely uses the system",
        },
        "duration": {
            "label_id": "Durasi Penggunaan",
            "label_en": "Usage Duration",
            "rule_key": "Usage Duration Status",
            "detail_safe_id": "Lama menggunakan sistem",
            "detail_safe_en": "Long usage duration",
            "detail_unsafe_id": "Durasi penggunaan singkat",
            "detail_unsafe_en": "Short usage duration",
        },
        "lik_combination": {
            "label_id": "Kombinasi LIK",
            "label_en": "LIK Combination",
            "rule_key": "Number of Known LIK Status",
            "detail_safe_id": "Cukup mengenal tanda alam",
            "detail_safe_en": "Adequate knowledge of natural signs",
            "detail_unsafe_id": "Kurang mengenal tanda alam",
            "detail_unsafe_en": "Limited knowledge of natural signs",
        },
        "experience": {
            "label_id": "Pengalaman Bencana",
            "label_en": "Disaster Experience",
            "rule_key": "Number of Experience with Disaster Status",
            "detail_safe_id": "Pengalaman bencana memadai",
            "detail_safe_en": "Adequate disaster experience",
            "detail_unsafe_id": "Pengalaman bencana terbatas",
            "detail_unsafe_en": "Limited disaster experience",
        },
    }

    def compute_contributions(self, prediction: dict, rules: dict, beach_location: str = "") -> dict:
        import pandas as pd
        from pathlib import Path

        contributions = []

        triggered_codes = prediction.get("triggered_lik_codes", [])
        csv_path = Path(__file__).parent / 'lik_filtered_action_taken.csv'
        df_action = pd.read_csv(csv_path)
        escalation_map = {
            'berhati-hati / tingkatkan kewaspadaan': 0,
            'siaga penuh / amankan alat tangkap': 1,
            'sesuaikan jadwal melaut': 2,
        }

        for code in triggered_codes:
            sign_info = self.get_lik_sign_info([code.lower()])
            if not sign_info:
                continue
            info = sign_info[0]
            row = df_action[df_action['LIK'] == code]
            if row.empty:
                continue
            action_str = row.iloc[0]['most_action_taken'].lower()
            level = escalation_map.get(action_str, 0)
            raw_weight = self.ESCALATION_WEIGHTS.get(level, 0.3)
            contributions.append({
                "factor": code,
                "label_id": info["label_id"],
                "label_en": info["label_en"],
                "category": "natural_sign",
                "weight": raw_weight,
                "direction": "increases_risk",
                "detail_id": info["detail_id"],
                "detail_en": info["detail_en"],
            })

        community_profile_factors = []
        beach_slug = beach_location.replace("_", " ") if beach_location else None
        csv_row = self.df_community[self.df_community['Mapped Beach'] == beach_slug] if beach_slug else None

        for key, meta in self.COMMUNITY_FACTOR_META.items():
            status = rules.get(meta["rule_key"], "Safe")
            is_unsafe = status == "Unsafe"
            raw_weight = 0.5 if is_unsafe else 0.0
            value = self._get_community_value_from_row(csv_row, key) if csv_row is not None and not csv_row.empty else 0.0

            contributions.append({
                "factor": key,
                "label_id": meta["label_id"],
                "label_en": meta["label_en"],
                "category": "community",
                "weight": raw_weight,
                "direction": "increases_risk" if is_unsafe else "neutral",
                "detail_id": meta["detail_unsafe_id"] if is_unsafe else meta["detail_safe_id"],
                "detail_en": meta["detail_unsafe_en"] if is_unsafe else meta["detail_safe_en"],
            })

            community_profile_factors.append({
                "key": key,
                "label_id": meta["label_id"],
                "label_en": meta["label_en"],
                "value": value,
                "status": status,
                "detail_id": meta["detail_unsafe_id"] if is_unsafe else meta["detail_safe_id"],
                "detail_en": meta["detail_unsafe_en"] if is_unsafe else meta["detail_safe_en"],
            })

        total = sum(c["weight"] for c in contributions)
        if total > 0:
            for c in contributions:
                c["weight"] = round(c["weight"] / total, 2)

        contributions.sort(key=lambda x: x["weight"], reverse=True)

        summary_parts_id = []
        summary_parts_en = []
        for c in contributions[:5]:
            if c["weight"] > 0:
                summary_parts_id.append(f"{c['label_id'].lower()} ({int(c['weight'] * 100)}%)")
                summary_parts_en.append(f"{c['label_en'].lower()} ({int(c['weight'] * 100)}%)")

        summary_id = f"Bahaya karena {', '.join(summary_parts_id)}" if summary_parts_id else "Tidak ada faktor risiko terdeteksi."
        summary_en = f"Danger due to {', '.join(summary_parts_en)}" if summary_parts_en else "No risk factors detected."

        overall = rules.get("Overall Category", "Safe")

        return {
            "summary_id": summary_id,
            "summary_en": summary_en,
            "contributions": contributions,
            "community_profile": {
                "beach": beach_location if beach_location else "unknown",
                "overall": overall,
                "factors": community_profile_factors,
            },
        }

    def _get_community_value_from_row(self, csv_row, factor_key: str) -> float:
        csv_col_map = {
            "interaction": "Level of Interaction with Disaster",
            "frequency": "Frequency of Usage (max) (in month)",
            "duration": "Usage Duration",
            "lik_combination": "Number of LIK Combination",
            "experience": "Number of Experience with Disaster",
        }
        col_name = csv_col_map.get(factor_key)
        if not col_name:
            return 0.0
        if csv_row is None or csv_row.empty:
            return 0.0
        return float(csv_row.iloc[0][col_name]) if col_name in csv_row.columns else 0.0