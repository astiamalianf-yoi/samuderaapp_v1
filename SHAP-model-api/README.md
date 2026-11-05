# LIK Inference Engine (Trust Index + Random Forest)

Implements the two-stage warning decision of the JISEBI paper:

1. **Trust tier** of each reported sign (Table 2): High = Wn-3, Wn-8, Wn-1, Wn-2, Wn-7; Low = Wn-13, Wn-4, Wn-9, Wn-6, Wn-5.
   Unranked signs (Wn-10, 11, 12, 14-17) are kept and treated as Low-trust.
2. **Behavioral class** (Eq. 4): if the request carries a `fisherman_profile`, the final Random Forest
   (200 trees, `max_features='sqrt'`, balanced weights) gives P(Actionable); class 1 if P >= 0.60.
   Without a profile, the beach-level community profile (`community_rule_categorization.csv`) is used.
3. **Warning strategy matrix** (Eq. 5 / Table 10):

| Trust tier | Actionable (1) | Inaction (0) |
|---|---|---|
| High | `STANDARD` -> SIAGA | `EXTRA_WARNING` (+ action guide) -> SIAGA |
| Low | `ENHANCED_MONITORING` -> WASPADA | `MAXIMUM_ALERT` (+ intervention) -> SIAGA |

`lik_risk_level` is what the backend fuses with BMKG (max of the two). No strategy suppresses an alert.

### Optional `fisherman_profile` in `POST /predict`

```json
{"age": 50, "fishing_experience": 25, "fishing_role": 3, "head_of_community": 0, "fishing_duration": 1,
 "disaster_experience_count": 3, "disaster_interaction": 1, "lik_combination_count": 2,
 "usage_duration": 10, "usage_frequency_min": 2, "usage_frequency_max": 4}
```

Codes follow the supplementary codebook (fishing_role 1 owner / 2 skipper / 3 crew; fishing_duration 1 <1 day / 2 days / 3 weeks).

### Retraining

The dataset is not stored in this repository.

```bash
python training/train_rf.py /path/to/master-data-shared.csv --check
```

Writes `src/engine/model/rf_final.joblib` and `rf_config.json`. `--check` prints grouped-CV metrics and the threshold sweep for comparison with the paper (Table 5).

---

# Dokumentasi Skenario Pengujian API (Hybrid SHAP)
Gunakan kumpulan JSON di bawah ini untuk menguji endpoint /predict pada API. Seluruh skenario didasarkan pada ambang batas matematis (tipping points) yang diekstraksi dari analisis dan pemodelan rule based SHAP.

## Skenario 1: Community Unsafe & Tanda dalam Trust Index
Contoh Kondisi: Komunitas memiliki karakteristik perilaku tidak aman dan melaporkan tanda alam dengan validitas tinggi (WN-3).

```JSON
{
  "lik_codes": ["wn-3"],
  "beach_location": "pantai_depok",
}
```

Ekspektasi return:

```JSON
{
    "community_risk_behaviour": "Unsafe",
    "description": "Komunitas diklasifikasikan berisiko tinggi karena terdeteksi karakteristik: Frekuensi Penggunaan Tanda Alam Rendah, Durasi Penggunaan Tanda Alam Rendah, Pengetahuan Tanda Alam Lokal Kurang. Terdeteksi tanda alam dengan tingkat kepercayaan tinggi: WN-3.",
    "detected_signs": [
        {
            "code": "WN-3",
            "description": "Kilat muncul di salah satu sisi langit ataupun saling berbalas antara dua sisi"
        }
    ]
}
```

## Skenario 2: Community Safe & Tanda dalam Trust Index
Contoh Kondisi: Komunitas tidak memiliki karakteristik perilaku tidak aman dan melaporkan tanda alam dengan validitas tinggi (WN-3).

```JSON
{
    "lik_codes": ["wn-3"],
    "beach_location": "pantai_lampuuk"
}
```

Ekspektasi return:

```JSON
{
    "community_risk_behaviour": "Safe",
    "description": "Komunitas tidak memenuhi kriteria risiko tinggi pada profil demografis/behavior. Terdeteksi tanda alam dengan tingkat kepercayaan tinggi: WN-3.",
    "detected_signs": [
        {
            "code": "WN-3",
            "description": "Kilat muncul di salah satu sisi langit ataupun saling berbalas antara dua sisi"
        }
    ]
}
```

## Skenario 3: Terdeteksi 3 tanda alam atau lebih

```JSON
{
    "lik_codes": ["wn-3", "wn-1", "wn-12"],
    "beach_location": "pantai_lampuuk"
}
```

Ekspektasi return:

```JSON
{
    "community_risk_behaviour": "Safe",
    "description": "Komunitas tidak memenuhi kriteria risiko tinggi pada profil demografis/behavior. Harap berhati-hati, terdeteksi 3 atau lebih tanda alam pengetahuan lokal. Terdeteksi tanda alam dengan tingkat kepercayaan tinggi: WN-3, WN-1.",
    "detected_signs": [
        {
            "code": "WN-3",
            "description": "Kilat muncul di salah satu sisi langit ataupun saling berbalas antara dua sisi"
        },
        {
            "code": "WN-1",
            "description": "Awan tampak turun ke bawah membentuk gumpalan 3 kali"
        },
        {
            "code": "WN-12",
            "description": "Banyak bintang di malam hari berkelap kelip, saat angin barat"
        }
    ]
}
```

## Catatan Implementasi untuk Developer
**community_risk_behaviour**: Jika Unsafe, pengembang disarankan untuk memicu Extra Warning pada antarmuka pengguna.

**Multimodal Detection**: Deteksi lebih dari 3 tanda alam (seperti skenario 5-8) secara teknis meningkatkan level bahaya meskipun profil user aman.