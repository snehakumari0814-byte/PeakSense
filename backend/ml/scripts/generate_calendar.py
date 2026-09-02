from pathlib import Path

import holidays
import pandas as pd


# --------------------------------------------------
# Paths
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parents[2]

OUTPUT_DIR = BASE_DIR / "data" / "raw" / "calendar"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_FILE = OUTPUT_DIR / "india_calendar_2024_2025.csv"


# --------------------------------------------------
# Date range
# --------------------------------------------------

timestamps = pd.date_range(
    start="2024-01-01 00:00:00",
    end="2025-12-31 23:00:00",
    freq="h",
    tz="Asia/Kolkata"
)


# --------------------------------------------------
# Indian public holidays
# --------------------------------------------------

india_holidays = holidays.country_holidays(
    "IN",
    years=[2024, 2025]
)


# --------------------------------------------------
# Build calendar dataframe
# --------------------------------------------------

df = pd.DataFrame({
    "timestamp": timestamps
})

df["date"] = df["timestamp"].dt.date
df["hour"] = df["timestamp"].dt.hour
df["day_of_week"] = df["timestamp"].dt.dayofweek
df["month"] = df["timestamp"].dt.month

df["is_weekend"] = (
    df["day_of_week"] >= 5
).astype(int)

df["is_holiday"] = df["date"].isin(india_holidays).astype(int)

df["holiday_name"] = df["date"].map(india_holidays)


# --------------------------------------------------
# Save
# --------------------------------------------------

df.to_csv(OUTPUT_FILE, index=False)

print("PeakSense Calendar Generation")
print("-" * 40)
print("Saved to:", OUTPUT_FILE)
print("Rows:", len(df))
print()
print(df.head())
print()
print("Holiday hours:", df["is_holiday"].sum())