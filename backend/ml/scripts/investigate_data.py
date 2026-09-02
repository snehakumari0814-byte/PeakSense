from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
RAW_DATA_DIR = BASE_DIR / "data" / "raw"

ELECTRICITY_DIR = RAW_DATA_DIR / "electricity"
WEATHER_DIR = RAW_DATA_DIR / "weather"
SOLAR_DIR = RAW_DATA_DIR / "solar"
CALENDAR_DIR = RAW_DATA_DIR / "calendar"


print("PeakSense Data Investigation")
print("-" * 40)

print(f"Base directory: {BASE_DIR}")
print(f"Electricity directory: {ELECTRICITY_DIR}")
print(f"Weather directory: {WEATHER_DIR}")
print(f"Solar directory: {SOLAR_DIR}")
print(f"Calendar directory: {CALENDAR_DIR}")