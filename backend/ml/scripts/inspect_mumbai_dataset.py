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


# ============================================================
# LOAD DATA
# ============================================================

print("=" * 70)
print("PEAKSENSE MUMBAI DEMAND DATASET INSPECTION")
print("=" * 70)

print(f"\nLoading dataset:\n{INPUT_FILE}")

if not INPUT_FILE.exists():

    print("\nERROR: Dataset file not found.")

    raise SystemExit


df = pd.read_csv(INPUT_FILE)


# ============================================================
# BASIC INFORMATION
# ============================================================

print("\n" + "=" * 70)
print("BASIC INFORMATION")
print("=" * 70)

print(f"\nTotal records: {len(df)}")

print("\nColumns:")

for column in df.columns:
    print(f"- {column}")


# ============================================================
# TIMESTAMP PROCESSING
# ============================================================

print("\n" + "=" * 70)
print("TIMESTAMP ANALYSIS")
print("=" * 70)

df["timestamp"] = pd.to_datetime(
    df["timestamp"],
    errors="coerce"
)

invalid_timestamps = df["timestamp"].isna().sum()

print(
    f"\nInvalid timestamps: "
    f"{invalid_timestamps}"
)

valid_timestamps = df.dropna(
    subset=["timestamp"]
)

if len(valid_timestamps) > 0:

    print(
        f"Date range:\n"
        f"{valid_timestamps['timestamp'].min()}"
        f"\nTO\n"
        f"{valid_timestamps['timestamp'].max()}"
    )


# ============================================================
# MISSING VALUES
# ============================================================

print("\n" + "=" * 70)
print("MISSING VALUES")
print("=" * 70)

missing = df.isna().sum()

print()

for column, count in missing.items():

    print(
        f"{column}: {count}"
    )


# ============================================================
# DUPLICATE TIMESTAMPS
# ============================================================

print("\n" + "=" * 70)
print("DUPLICATE CHECK")
print("=" * 70)

duplicate_timestamps = df[
    "timestamp"
].duplicated().sum()

print(
    f"\nDuplicate timestamps: "
    f"{duplicate_timestamps}"
)


# ============================================================
# DEMAND STATISTICS
# ============================================================

print("\n" + "=" * 70)
print("DEMAND STATISTICS")
print("=" * 70)

df["demand_mw"] = pd.to_numeric(
    df["demand_mw"],
    errors="coerce"
)

print(
    f"\nMinimum demand: "
    f"{df['demand_mw'].min():.2f} MW"
)

print(
    f"Maximum demand: "
    f"{df['demand_mw'].max():.2f} MW"
)

print(
    f"Mean demand: "
    f"{df['demand_mw'].mean():.2f} MW"
)

print(
    f"Median demand: "
    f"{df['demand_mw'].median():.2f} MW"
)

print(
    f"Standard deviation: "
    f"{df['demand_mw'].std():.2f} MW"
)


# ============================================================
# OBSERVATION TYPE DISTRIBUTION
# ============================================================

print("\n" + "=" * 70)
print("OBSERVATION TYPE DISTRIBUTION")
print("=" * 70)

observation_counts = df[
    "observation_type"
].value_counts()

print()

for observation, count in observation_counts.items():

    print(
        f"{observation}: {count}"
    )


# ============================================================
# OBSERVATIONS PER DAY
# ============================================================

print("\n" + "=" * 70)
print("OBSERVATIONS PER DAY")
print("=" * 70)

df["date"] = df[
    "timestamp"
].dt.date

daily_counts = df.groupby(
    "date"
).size()

print(
    f"\nUnique dates: "
    f"{len(daily_counts)}"
)

print(
    f"Minimum observations per day: "
    f"{daily_counts.min()}"
)

print(
    f"Maximum observations per day: "
    f"{daily_counts.max()}"
)


# ============================================================
# DAYS NOT HAVING EXACTLY FOUR OBSERVATIONS
# ============================================================

invalid_days = daily_counts[
    daily_counts != 4
]

print()

if len(invalid_days) == 0:

    print(
        "SUCCESS: Every date has exactly "
        "4 observations."
    )

else:

    print(
        "WARNING: Some dates do not have "
        "exactly 4 observations."
    )

    print()

    for date_value, count in invalid_days.items():

        print(
            f"{date_value}: "
            f"{count} observations"
        )


# ============================================================
# CHECK EXPECTED HOURS
# ============================================================

print("\n" + "=" * 70)
print("HOUR DISTRIBUTION")
print("=" * 70)

df["hour"] = df[
    "timestamp"
].dt.hour

hour_counts = df[
    "hour"
].value_counts().sort_index()

print()

for hour, count in hour_counts.items():

    print(
        f"{hour:02d}:00 -> "
        f"{count} observations"
    )


expected_hours = {
    3,
    10,
    16,
    20
}

actual_hours = set(
    df["hour"].dropna().unique()
)

unexpected_hours = (
    actual_hours -
    expected_hours
)

missing_hours = (
    expected_hours -
    actual_hours
)


print("\nExpected hours:")

for hour in sorted(expected_hours):

    print(
        f"- {hour:02d}:00"
    )


if unexpected_hours:

    print(
        "\nWARNING: Unexpected hours found:"
    )

    print(
        sorted(unexpected_hours)
    )


if missing_hours:

    print(
        "\nWARNING: Expected hours missing:"
    )

    print(
        sorted(missing_hours)
    )


# ============================================================
# SORT AND PREVIEW
# ============================================================

print("\n" + "=" * 70)
print("DATA PREVIEW")
print("=" * 70)

df = df.sort_values(
    "timestamp"
).reset_index(
    drop=True
)

preview_columns = [
    "timestamp",
    "demand_mw",
    "observation_type",
]

print()

print(
    df[
        preview_columns
    ].head(20).to_string(
        index=False
    )
)


# ============================================================
# FINAL SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("FINAL SUMMARY")
print("=" * 70)

print(
    f"\nTotal records: "
    f"{len(df)}"
)

print(
    f"Unique days: "
    f"{df['date'].nunique()}"
)

print(
    f"Missing demand values: "
    f"{df['demand_mw'].isna().sum()}"
)

print(
    f"Duplicate timestamps: "
    f"{duplicate_timestamps}"
)

print("\nDataset inspection complete.")

print("=" * 70)