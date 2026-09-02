from pathlib import Path

import pandas as pd


# ============================================================
# PATH CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

INPUT_FILE = (
    BASE_DIR
    / "data"
    / "raw"
    / "electricity"
    / "mumbai_demand_extracted.csv"
)

OUTPUT_FILE = (
    BASE_DIR
    / "data"
    / "processed"
    / "mumbai_demand_features.csv"
)


# ============================================================
# LOAD DATA
# ============================================================

print("=" * 70)
print("PEAKSENSE MUMBAI FEATURE ENGINEERING")
print("=" * 70)

print(f"\nLoading:\n{INPUT_FILE}")

df = pd.read_csv(INPUT_FILE)

df["timestamp"] = pd.to_datetime(
    df["timestamp"],
    errors="coerce"
)

# Remove invalid timestamps if any.
df = df.dropna(
    subset=["timestamp", "demand_mw"]
)

# Ensure demand is numeric.
df["demand_mw"] = pd.to_numeric(
    df["demand_mw"],
    errors="coerce"
)

df = df.dropna(
    subset=["demand_mw"]
)

# Sort chronologically.
df = df.sort_values(
    "timestamp"
).reset_index(
    drop=True
)


# ============================================================
# TIME FEATURES
# ============================================================

print("\nCreating time features...")

df["hour"] = df["timestamp"].dt.hour

df["day_of_week"] = (
    df["timestamp"].dt.dayofweek
)

df["day_of_month"] = (
    df["timestamp"].dt.day
)

df["month"] = (
    df["timestamp"].dt.month
)

df["is_weekend"] = (
    df["day_of_week"] >= 5
).astype(int)


# ============================================================
# OBSERVATION TYPE ENCODING
# ============================================================

print("Encoding observation types...")

observation_mapping = {
    "night_minimum": 0,
    "morning_peak": 1,
    "day_peak": 2,
    "evening_peak": 3,
}

df["observation_type_encoded"] = (
    df["observation_type"]
    .map(observation_mapping)
)

if df["observation_type_encoded"].isna().any():

    unknown_types = df.loc[
        df["observation_type_encoded"].isna(),
        "observation_type"
    ].unique()

    print(
        f"WARNING: Unknown observation types: "
        f"{unknown_types}"
    )


# ============================================================
# LAG FEATURES
# ============================================================

print("Creating lag features...")

# Previous observation.
df["lag_1"] = df[
    "demand_mw"
].shift(1)

# Previous day, same observation type.
# There are 4 observations per day.
df["lag_4"] = df[
    "demand_mw"
].shift(4)

# Two days ago, same observation type.
df["lag_8"] = df[
    "demand_mw"
].shift(8)

# Seven days ago, same observation type.
df["lag_28"] = df[
    "demand_mw"
].shift(28)


# ============================================================
# ROLLING FEATURES
# ============================================================

print("Creating rolling features...")

# IMPORTANT:
# shift(1) prevents the current target demand
# from leaking into the model features.

df["rolling_mean_4"] = (
    df["demand_mw"]
    .shift(1)
    .rolling(window=4)
    .mean()
)

df["rolling_mean_7"] = (
    df["demand_mw"]
    .shift(1)
    .rolling(window=7)
    .mean()
)

df["rolling_std_7"] = (
    df["demand_mw"]
    .shift(1)
    .rolling(window=7)
    .std()
)


# ============================================================
# REMOVE ROWS WITHOUT REQUIRED LAG HISTORY
# ============================================================

print("\nRemoving rows without sufficient history...")

feature_columns_required = [
    "lag_1",
    "lag_4",
    "lag_8",
    "lag_28",
    "rolling_mean_4",
    "rolling_mean_7",
    "rolling_std_7",
]

before_drop = len(df)

df = df.dropna(
    subset=feature_columns_required
).reset_index(
    drop=True
)

after_drop = len(df)

print(
    f"Rows before lag cleanup: "
    f"{before_drop}"
)

print(
    f"Rows after lag cleanup: "
    f"{after_drop}"
)

print(
    f"Rows removed: "
    f"{before_drop - after_drop}"
)


# ============================================================
# SELECT FINAL COLUMNS
# ============================================================

final_columns = [
    "timestamp",
    "demand_mw",
    "observation_type",
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

df = df[
    final_columns
]


# ============================================================
# SAVE DATASET
# ============================================================

OUTPUT_FILE.parent.mkdir(
    parents=True,
    exist_ok=True
)

df.to_csv(
    OUTPUT_FILE,
    index=False
)


# ============================================================
# SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("FEATURE ENGINEERING COMPLETE")
print("=" * 70)

print(
    f"\nFinal records: "
    f"{len(df)}"
)

print(
    f"\nSaved to:\n"
    f"{OUTPUT_FILE}"
)

print("\nFEATURE COLUMNS:")

for column in df.columns:

    print(
        f"- {column}"
    )


print("\nDATA PREVIEW:")

print(
    df.head(10).to_string(
        index=False
    )
)

print("\n" + "=" * 70)
print("DONE")
print("=" * 70)