"""Train the final Random Forest of the JISEBI paper (Stage 2, behavioral classifier).

Reproduces Section 7/10 of `JISEBI_implementation_RandomForest_Rev.ipynb`:
  RandomForestClassifier(n_estimators=200, max_depth=None, max_features='sqrt',
                         min_samples_leaf=1, random_state=42, n_jobs=1)
  fitted on all 607 Aceh records with balanced sample weights.

The dataset (master-data-shared.csv, see the supplementary codebook) is NOT stored in
this repository. Pass its path on the command line:

    python training/train_rf.py /path/to/master-data-shared.csv [--check]

Outputs (written next to the inference engine):
    src/engine/model/rf_final.joblib
    src/engine/model/rf_config.json

`--check` additionally runs a fisherman-grouped 5-fold CV of the final configuration
and a grouped 3-fold threshold sweep, so the numbers can be compared with the paper.
"""
import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score, accuracy_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.utils.class_weight import compute_sample_weight

SEED = 42
TAU = 0.60
FINAL_PARAMS = {"n_estimators": 200, "max_depth": None, "max_features": "sqrt", "min_samples_leaf": 1}
TARGET = "Class (0 = Inaction, 1 = Actionable)"

# 12 fisherman features (codebook Table A) + 17 Wn sign indicators = 29 features.
FISHERMAN_FEATURES = [
    "Age",
    "Fishing Experience",
    "Fishing Role",
    "Experience as Head of Communities",
    "Fishing Duration",
    "Number of Experience with Disaster",
    "Level of Interaction with Disaster",
    "Number of LIK Combination",
    "Usage Duration",
    "Frequency of Usage (min) (in month)",
    "Frequency of Usage (max) (in month)",
    "Average Frequency of Usage (in month)",
]
WN_FEATURES = [f"Wn-{i}" for i in range(1, 18)]
FEATURES = FISHERMAN_FEATURES + WN_FEATURES

HIGH_TRUST = ["Wn-3", "Wn-8", "Wn-1", "Wn-2", "Wn-7"]
LOW_TRUST = ["Wn-13", "Wn-4", "Wn-9", "Wn-6", "Wn-5"]


def make_model():
    return RandomForestClassifier(random_state=SEED, n_jobs=1, **FINAL_PARAMS)


def fit(X, y):
    return make_model().fit(X, y, sample_weight=compute_sample_weight("balanced", y=y))


def scores(y, p, t):
    yp = (p >= t).astype(int)
    return {
        "Accuracy": accuracy_score(y, yp),
        "F1-Macro": f1_score(y, yp, average="macro"),
        "Recall (C0)": recall_score(y, yp, pos_label=0, zero_division=0),
        "Precision (C0)": precision_score(y, yp, pos_label=0, zero_division=0),
        "ROC-AUC": roc_auc_score(y, p),
    }


def check(X, y, g):
    oof = np.zeros(len(y))
    for tr, te in StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED).split(X, y, g):
        oof[te] = fit(X.iloc[tr], y.iloc[tr]).predict_proba(X.iloc[te])[:, 1]
    for t in (0.50, TAU):
        print(f"Grouped 5-fold CV, final config, threshold {t:.2f}:",
              {k: round(v, 3) for k, v in scores(y.values, oof, t).items()})
    rows = []
    folds = list(StratifiedGroupKFold(n_splits=3, shuffle=True, random_state=SEED).split(X, y, g))
    for t in (0.50, 0.55, 0.60, 0.65):
        r = [scores(y.iloc[te].values, fit(X.iloc[tr], y.iloc[tr]).predict_proba(X.iloc[te])[:, 1], t) for tr, te in folds]
        rows.append({"Threshold": t, **pd.DataFrame(r).mean().round(3).to_dict()})
    print("Grouped 3-fold threshold sweep (compare with paper Table 5):")
    print(pd.DataFrame(rows).to_string(index=False))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data", help="path to master-data-shared.csv")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    df = pd.read_csv(args.data)
    df = df[df["Province"] == 1].reset_index(drop=True)
    X, y, g = df[FEATURES].astype(float), df[TARGET].astype(int), df["Respondent_ID"]
    print(f"{len(df)} records, {g.nunique()} fishermen, Class 0 = {(y == 0).sum()}, Class 1 = {(y == 1).sum()}")
    if args.check:
        check(X, y, g)

    model = fit(X, y)
    out = Path(__file__).resolve().parents[1] / "src" / "engine" / "model"
    out.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out / "rf_final.joblib", compress=3)

    config = {
        "model": "Random Forest",
        "params": FINAL_PARAMS,
        "random_state": SEED,
        "features": FEATURES,
        "fisherman_features": FISHERMAN_FEATURES,
        "operating_threshold": TAU,
        "decision_rule": f"P(Class 1) >= {TAU} -> 1 (Actionable); otherwise 0 (Inaction)",
        "high_trust_tier_signs": HIGH_TRUST,
        "low_trust_tier_signs": LOW_TRUST,
        "training_records": int(len(df)),
        "training_fishermen": int(g.nunique()),
        "software": {"python": sys.version.split()[0], "scikit-learn": sklearn.__version__,
                     "numpy": np.__version__, "pandas": pd.__version__},
    }
    (out / "rf_config.json").write_text(json.dumps(config, indent=2))
    print(f"Saved {out / 'rf_final.joblib'} and {out / 'rf_config.json'}")


if __name__ == "__main__":
    main()
