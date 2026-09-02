# PeakSense Data Inventory & Documentation

## Project Overview

**PeakSense** is a Mumbai-focused electricity demand and peak-demand forecasting platform.
Core architectural paradigm: **Predict → Explain → Simulate → Prevent**.

---

## 1. Supported Localities & Digital Twin Scope

The PeakSense prototype models 10 key Mumbai zones for urban load management:

1. **Andheri** (Mixed dual peak, high commercial & cooling sensitivity)
2. **Bandra** (Residential evening peak, residential/retail mix)
3. **Borivali** (High residential density, evening AC load peak)
4. **Powai** (Commercial/tech park daytime peak, high cooling demand)
5. **Dadar** (Central transit & mixed residential-commercial dual peak)
6. **Lower Parel** (Commercial high-rise hub, strong daytime HVAC peak)
7. **Kurla** (Mixed residential/transport hub)
8. **Goregaon** (Commercial/media hub & residential mixed load)
9. **Mulund** (Residential evening peak)
10. **Colaba** (Heritage commercial, institutional & residential load)

### Critical Data Limitation Statement
- Official utility-metered historical electricity demand at the individual suburb/feeder level (e.g. 11kV/33kV substations in Andheri or Bandra) is not publicly published by Mumbai distribution licensees (Tata Power, Adani Electricity Mumbai Ltd, BEST, MSEDCL).
- **PeakSense explicitly does NOT fabricate locality-level utility meter readings.**
- The 10 locality time-series forecasts are generated via the **PeakSense Digital Twin Locality Mapping Model**, which maps authentic Mumbai bulk grid demand dynamics to locality-specific characteristics (residential vs. commercial share, cooling sensitivity index, rooftop solar offset, baseline load).
- All locality-level outputs are transparently identified as **Digital Twin Estimates**.

---

## 2. Dataset Inventory

### A. Electricity Demand Dataset (Greater Mumbai Bulk Grid)
- **Source**: Maharashtra State Load Despatch Centre (MSLDC).
- **URL / Source Name**: MSLDC Daily System Operations Reports (`https://mahasldc.in/`).
- **Date Range**: July 1, 2026 to August 30, 2026 (61 operational days).
- **Time Resolution**: 4 daily operational benchmark observations:
  1. *Night Minimum* (03:00 IST)
  2. *Morning Peak* (10:00 IST)
  3. *Day Peak* (16:00 IST)
  4. *Evening Peak* (20:00 IST)
- **Units**: Megawatts (MW).
- **Geography**: Greater Mumbai transmission & distribution boundary (bulk grid demand).
- **Dataset Size**: 244 operational benchmark slots (61 days × 4 slots).
- **Missing Values**: 0 missing values across all extracted daily reports.
- **Duplicates**: 0 duplicates (verified by timestamp deduplication).
- **Limitations**: Represents bulk Mumbai transmission-level demand; does not supply individual feeder/locality telemetry.
- **Access / License**: Public operational regulatory reporting by MSLDC under Maharashtra Electricity Regulatory Commission (MERC) guidelines.

### B. Weather & Solar Resource Dataset
- **Source**: NASA POWER (Prediction Of Worldwide Energy Resources) Hourly Point API.
- **URL / Source Name**: NASA Langley Research Center (`https://power.larc.nasa.gov/`).
- **Date Range**: 2024-01-01 to 2025-12-31 (17,544 hourly records) and operational period.
- **Time Resolution**: Hourly (UTC converted to IST `Asia/Kolkata`).
- **Units & Variables**:
  - `temperature_c`: Temperature at 2 metres above surface (°C)
  - `relative_humidity_percent`: Relative humidity at 2 metres (%)
  - `wind_speed_m_s`: Wind speed at 10 metres (m/s)
  - `solar_irradiance`: All-sky surface downward shortwave irradiance (`ALLSKY_SFC_SW_DWN`, W/m² / kWh/m²/day)
- **Geography**: Mumbai centroid (Latitude: 19.0760° N, Longitude: 72.8777° E).
- **Missing Values**: 0 missing values.
- **Limitations**:
  - Weather observations are taken from a central Mumbai coordinate grid rather than microclimate micro-stations across every suburb.
  - Solar irradiance is a meteorological solar radiation measurement, not measured solar PV electricity generation.
- **Access / License**: Open access public domain (NASA Open Data Policy).

### C. Calendar & Holiday Dataset
- **Source**: Python `holidays` library (India calendar with Maharashtra state gazetted holidays).
- **Date Range**: 2024 to 2026.
- **Time Resolution**: Hourly / observation slot alignment.
- **Variables**: `hour`, `day_of_week`, `day_of_month`, `month`, `is_weekend`, `is_holiday`, `holiday_name`.
- **Units**: Categorical / binary indicators.
- **Missing Values**: 0 missing values.
- **Limitations**: Reflects statutory and bank holidays; does not model localized spontaneous festivals or regional weather advisories.

---

## 3. Data Pipeline & Preprocessing

The data pipeline enforces strict reproducibility and data integrity:

1. **Chronological Ordering**: Data is sorted strictly by ascending timestamp (`Asia/Kolkata` IST timezone). Shuffling across time boundaries is forbidden.
2. **Missing Value & Outlier Auditing**: Timestamps are parsed to ISO 8601; numeric fields are validated against physical bounds (e.g. non-negative demand and valid thermal ranges).
3. **No Artificial Modification**: Raw source records are never manually edited to manipulate accuracy.
4. **Feature Leakage Prevention**: All rolling windows (`rolling_mean_4`, `rolling_mean_7`, `rolling_max_4`, `rolling_min_4`, `rolling_std_7`) and historical lag features (`lag_1`, `lag_2`, `lag_4`, `lag_8`, `lag_28`) are strictly computed with a `shift(1)` lag relative to the prediction target.
5. **Multi-Horizon Alignment**: Multi-step autoregressive rolling predictions are generated for 24-hour day-ahead horizons, and smooth shape-preserving monotonic PCHIP splines are used for high-frequency 1-hour and 15-minute operational interpolation.

---

## 4. Directory Structure

```text
data/
├── raw/
│   ├── electricity/
│   │   ├── reports/                   # 61 daily MSLDC PDF operational reports
│   │   └── mumbai_demand_extracted.csv # Extracted 4-slot daily benchmark demand
│   ├── weather/
│   │   └── mumbai_weather_hourly_2024_2025.csv # NASA POWER hourly weather
│   └── calendar/
│       └── india_calendar_2024_2025.csv       # Indian holiday calendar
└── processed/
    └── mumbai_demand_features.csv             # Clean feature engineered dataset
```
