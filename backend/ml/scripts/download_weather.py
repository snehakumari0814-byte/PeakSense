from pathlib import Path
import requests
import pandas as pd


# -----------------------------
# Mumbai coordinates
# -----------------------------
LATITUDE = 19.0760
LONGITUDE = 72.8777

START_DATE = "20240101"
END_DATE = "20251231"

PARAMETERS = [
    "T2M",                 # Temperature at 2 metres
    "RH2M",                # Relative humidity
    "WS10M",               # Wind speed at 10 metres
    "ALLSKY_SFC_SW_DWN"    # Solar irradiance
]


# -----------------------------
# Paths
# -----------------------------
BASE_DIR = Path(__file__).resolve().parents[2]

WEATHER_DIR = BASE_DIR / "data" / "raw" / "weather"
WEATHER_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_FILE = WEATHER_DIR / "mumbai_weather_hourly_2024_2025.csv"


# -----------------------------
# NASA POWER API
# -----------------------------
url = "https://power.larc.nasa.gov/api/temporal/hourly/point"

params = {
    "parameters": ",".join(PARAMETERS),
    "community": "RE",
    "longitude": LONGITUDE,
    "latitude": LATITUDE,
    "start": START_DATE,
    "end": END_DATE,
    "format": "JSON",
    "time-standard": "UTC"
}

print("Requesting weather data from NASA POWER...")
response = requests.get(url, params=params, timeout=60)

print("HTTP status:", response.status_code)

response.raise_for_status()

data = response.json()


# -----------------------------
# Convert API response to table
# -----------------------------
parameter_data = data["properties"]["parameter"]

df = pd.DataFrame(parameter_data)

df.index.name = "timestamp"

df = df.reset_index()

df["timestamp"] = pd.to_datetime(
    df["timestamp"],
    format="%Y%m%d%H"
)


# Rename columns clearly
df = df.rename(
    columns={
        "T2M": "temperature_c",
        "RH2M": "relative_humidity_percent",
        "WS10M": "wind_speed_m_s",
        "ALLSKY_SFC_SW_DWN": "solar_irradiance"
    }
)


# -----------------------------
# Save
# -----------------------------
df.to_csv(OUTPUT_FILE, index=False)

print()
print("SUCCESS!")
print("Saved to:", OUTPUT_FILE)
print()
print("Rows:", len(df))
print()
print(df.head())