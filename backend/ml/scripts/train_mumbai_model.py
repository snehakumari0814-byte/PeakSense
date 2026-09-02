from pathlib import Path
import json

import joblib
import pandas as pd

from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# ============================================================
# PATH CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

INPUT_FILE = (
    BASE_DIR
    / "data"
    / "processed"
    / "mumbai_demand_features.csv"
)

MODELS_DIR = (
    BASE_DIR
    / "ml"
    / "models"
)

ARTIFACTS_DIR = (
    BASE_DIR
    / "ml"
    / "artifacts"
)

MODEL_FILE = (
    MODELS_DIR
    / "mumbai_demand_model.joblib"
)

METRICS_FILE = (
    ARTIFACTS_DIR
    / "mumbai_model_metrics.json"
)

FEATURES_FILE = (
    ARTIFACTS_DIR
    / "mumbai_feature_columns.json"
)


# ============================================================
# LOAD DATA
# ============================================================

print("=" * 70)
print("PEAKSENSE MUMBAI MODEL TRAINING")
print("=" * 70)

print("\nLoading dataset:")
print(INPUT_FILE)

if not INPUT_FILE.exists():
    print("\nERROR: Feature dataset not found.")
    raise SystemExit

df = pd.read_csv(INPUT_FILE)

print(f"\nTotal records: {len(df)}")

# Convert timestamp for chronological ordering
df["timestamp"] = pd.to_datetime(df["timestamp"])

df = df.sort_values("timestamp").reset_index(drop=True)


# ============================================================
# DEFINE FEATURES AND TARGET
# ============================================================

TARGET_COLUMN = "demand_mw"

FEATURE_COLUMNS = [
    "observation_type_encoded",
    "hour",
    "day_of_week",
    "day_of_month",
    "month",
    "is_weekend",
    "lag_1",
    "lag_4",
    "lag_8",
    "lag_28",
    "rolling_mean_4",
    "rolling_mean_7",
    "rolling_std_7",
]

# Verify required columns exist
missing_columns = [
    column
    for column in FEATURE_COLUMNS
    if column not in df.columns
]

if missing_columns:

    print("\nERROR: Missing feature columns:")
    for column in missing_columns:
        print(f"- {column}")

    raise SystemExit


X = df[FEATURE_COLUMNS]
y = df[TARGET_COLUMN]


# ============================================================
# CHRONOLOGICAL TRAIN / TEST SPLIT
# ============================================================

split_index = int(len(df) * 0.80)

X_train = X.iloc[:split_index]
X_test = X.iloc[split_index:]

y_train = y.iloc[:split_index]
y_test = y.iloc[split_index:]

print("\n" + "=" * 70)
print("TRAIN / TEST SPLIT")
print("=" * 70)

print(f"Training records: {len(X_train)}")
print(f"Testing records:  {len(X_test)}")

print(
    "\nTraining period:"
    f"\n{df.iloc[0]['timestamp']}"
    f"\nTO"
    f"\n{df.iloc[split_index - 1]['timestamp']}"
)

print(
    "\nTesting period:"
    f"\n{df.iloc[split_index]['timestamp']}"
    f"\nTO"
    f"\n{df.iloc[-1]['timestamp']}"
)


# ============================================================
# MODEL DEFINITIONS
# ============================================================

models = {

    "Random Forest": RandomForestRegressor(
        n_estimators=300,
        max_depth=8,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    ),

    "Gradient Boosting": GradientBoostingRegressor(
        n_estimators=150,
        learning_rate=0.05,
        max_depth=3,
        random_state=42,
    ),

}


# ============================================================
# TRAIN AND EVALUATE MODELS
# ============================================================

results = {}
trained_models = {}

print("\n" + "=" * 70)
print("TRAINING MODELS")
print("=" * 70)

for model_name, model in models.items():

    print(f"\nTraining: {model_name}")

    model.fit(
        X_train,
        y_train
    )

    predictions = model.predict(
        X_test
    )

    mae = mean_absolute_error(
        y_test,
        predictions
    )

    rmse = mean_squared_error(
        y_test,
        predictions
    ) ** 0.5

    r2 = r2_score(
        y_test,
        predictions
    )

    results[model_name] = {
        "mae": float(mae),
        "rmse": float(rmse),
        "r2": float(r2),
    }

    trained_models[model_name] = model

    print(f"MAE:  {mae:.2f} MW")
    print(f"RMSE: {rmse:.2f} MW")
    print(f"R²:   {r2:.4f}")


# ============================================================
# SELECT BEST MODEL
# ============================================================

best_model_name = min(
    results,
    key=lambda name: results[name]["mae"]
)

best_model = trained_models[
    best_model_name
]

print("\n" + "=" * 70)
print("BEST MODEL")
print("=" * 70)

print(
    f"Selected model: {best_model_name}"
)

print(
    f"Best MAE: "
    f"{results[best_model_name]['mae']:.2f} MW"
)


# ============================================================
# CREATE OUTPUT DIRECTORIES
# ============================================================

MODELS_DIR.mkdir(
    parents=True,
    exist_ok=True
)

ARTIFACTS_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# SAVE MODEL
# ============================================================

model_artifact = {
    "model": best_model,
    "model_name": best_model_name,
    "feature_columns": FEATURE_COLUMNS,
}

joblib.dump(
    model_artifact,
    MODEL_FILE
)

print("\nModel saved:")
print(MODEL_FILE)


# ============================================================
# SAVE METRICS
# ============================================================

metrics_output = {
    "best_model": best_model_name,
    "all_models": results,
    "training_records": int(len(X_train)),
    "testing_records": int(len(X_test)),
    "total_records": int(len(df)),
}

with open(
    METRICS_FILE,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        metrics_output,
        file,
        indent=4
    )

print("\nMetrics saved:")
print(METRICS_FILE)


# ============================================================
# SAVE FEATURE COLUMNS
# ============================================================

with open(
    FEATURES_FILE,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        FEATURE_COLUMNS,
        file,
        indent=4
    )

print("\nFeature columns saved:")
print(FEATURES_FILE)


# ============================================================
# SAMPLE PREDICTIONS
# ============================================================

sample_results = pd.DataFrame({
    "timestamp": df.iloc[split_index:]["timestamp"].values,
    "actual_demand_mw": y_test.values,
    "predicted_demand_mw": best_model.predict(X_test),
})

print("\n" + "=" * 70)
print("SAMPLE TEST PREDICTIONS")
print("=" * 70)

print(
    sample_results
    .head(10)
    .to_string(index=False)
)


# ============================================================
# FINAL SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("MODEL TRAINING COMPLETE")
print("=" * 70)

print(f"Best model: {best_model_name}")
print(
    f"Best MAE: "
    f"{results[best_model_name]['mae']:.2f} MW"
)
print(
    f"Best RMSE: "
    f"{results[best_model_name]['rmse']:.2f} MW"
)
print(
    f"Best R²: "
    f"{results[best_model_name]['r2']:.4f}"
)

print("\nDONE")