"""
PeakSense Forecasting Engine Service.

Integrates the trained XGBoost bulk Mumbai demand forecasting model with the
Digital Twin Locality Mapping Model to generate multi-horizon forecasts,
prediction intervals, and peak strain indicators.
"""

from pathlib import Path
from datetime import date as date_cls, datetime, timedelta
from typing import Dict, List, Optional, Tuple
import joblib
import numpy as np
import pandas as pd

from app.models import Locality, DemandProfile
from app.seed_data import LOCALITIES_BY_ID
from app.schemas.forecast import (
    ForecastPoint,
    ForecastResponse,
    ForecastSeriesResponse,
    ForecastValues,
    PeakAnalysis,
    RiskLevel,
)
from app.services.peak_detection import analyze_peak


BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "ml" / "models" / "mumbai_demand_model.joblib"
DATA_PATH = BASE_DIR / "data" / "processed" / "mumbai_demand_features.csv"

# Representative bulk-Mumbai baseline used to scale the model's city-wide
# prediction down to a single locality (see _map_to_locality).
CITY_BASELINE_MW = 3100.0

# Recursive/autoregressive multi-step forecasts compound error the further
# out they extrapolate. 7 days is a deliberately conservative, documented
# reliability boundary — not an arbitrary technical wall.
MAX_FUTURE_DAYS = 7


class DateUnavailableError(Exception):
    """Raised when a requested forecast date cannot be genuinely served
    (no historical data for a past date, or beyond the future forecast cap)."""


class ForecastEngine:
    _instance: Optional["ForecastEngine"] = None

    def __init__(self):
        self.model_artifact = None
        self.model = None
        self.feature_columns = []
        self.metrics = {}
        self.prediction_interval_info = {}
        self.history_df = None
        self.history_min_date: Optional[date_cls] = None
        self.history_max_date: Optional[date_cls] = None
        self._load_model()
        self._load_history()

    @classmethod
    def get_instance(cls) -> "ForecastEngine":
        if cls._instance is None:
            cls._instance = ForecastEngine()
        return cls._instance

    def _load_model(self):
        """Load trained XGBoost model and artifacts."""
        if MODEL_PATH.exists():
            try:
                self.model_artifact = joblib.load(MODEL_PATH)
                self.model = self.model_artifact.get("model")
                self.feature_columns = self.model_artifact.get("feature_columns", [])
                self.metrics = self.model_artifact.get("metrics", {})
                self.prediction_interval_info = self.model_artifact.get("prediction_interval", {})
            except Exception as e:
                print(f"Warning: Failed to load model artifact: {e}")
                self.model = None
        else:
            print(f"Warning: Model file not found at {MODEL_PATH}")

    def _load_history(self):
        """Load recent processed demand history."""
        if DATA_PATH.exists():
            try:
                self.history_df = pd.read_csv(DATA_PATH)
                # CSV timestamps carry a +05:30 (Asia/Kolkata) offset. The rest of
                # this service (datetime.now(), timedelta arithmetic) uses naive
                # datetimes on the assumption that server-local time == IST
                # (verified: this host's local timezone is IST) — so drop the tz
                # here to get naive IST wall-clock datetimes consistent with that.
                self.history_df["timestamp"] = pd.to_datetime(
                    self.history_df["timestamp"], utc=False
                ).dt.tz_localize(None)
                self.history_df = self.history_df.sort_values("timestamp").reset_index(drop=True)
                dates = self.history_df["timestamp"].dt.date
                self.history_min_date = dates.min()
                self.history_max_date = dates.max()
            except Exception as e:
                print(f"Warning: Failed to load history: {e}")
                self.history_df = None

    def get_reference_date(self) -> date_cls:
        """
        The backend's current/reference calendar date.

        The server runs with local time = Asia/Kolkata (verified: `date` /
        `time.tzname` on this host report IST), so naive `datetime.now()`
        already reflects IST wall-clock time. This matches the pre-existing
        codebase convention (all timestamps assume local time == IST).
        """
        return datetime.now().date()

    def _parse_date_param(self, date_str: Optional[str]) -> date_cls:
        """Parse a 'YYYY-MM-DD' query param. None -> today's reference date."""
        if date_str is None or date_str == "":
            return self.get_reference_date()
        try:
            return datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError(
                f"Invalid date '{date_str}'. Expected format YYYY-MM-DD."
            )

    def get_availability(self) -> Dict:
        """
        Genuine, data-derived date-availability summary.

        The dataset has a real 4-day gap between the last historical
        observation (history_max_date) and today's reference date, so
        availability is two disjoint ranges, not one continuous span —
        we report both honestly rather than inventing coverage.
        """
        reference_date = self.get_reference_date()
        max_future_date = reference_date + timedelta(days=MAX_FUTURE_DAYS)

        historical_range = None
        if self.history_min_date is not None and self.history_max_date is not None:
            historical_range = {
                "start": self.history_min_date.isoformat(),
                "end": self.history_max_date.isoformat(),
            }

        forecastable_range = {
            "start": reference_date.isoformat(),
            "end": max_future_date.isoformat(),
        }

        overall_min = self.history_min_date if self.history_min_date is not None else reference_date

        return {
            "reference_date": reference_date.isoformat(),
            "historical_range": historical_range,
            "forecastable_range": forecastable_range,
            "min_date": overall_min.isoformat(),
            "max_date": max_future_date.isoformat(),
        }

    def _bulk_points_from_history_rows(self, rows: pd.DataFrame) -> List[Dict]:
        """
        Genuine historical backtest: reuse the precomputed, leakage-safe
        feature columns already stored for each row (see preprocessing.py —
        lags via shift(N), rolling stats via shift(1).rolling(...)) and run
        them through the real trained model. No fabrication: every feature
        value is either an actual historical measurement or a value derived
        exclusively from earlier chronological observations.
        """
        obs_name_map = {0: "night_minimum", 1: "morning_peak", 2: "day_peak", 3: "evening_peak"}
        points: List[Dict] = []
        for _, row in rows.iterrows():
            feat_dict = {col: float(row[col]) for col in self.feature_columns}
            feat_df = pd.DataFrame([feat_dict])[self.feature_columns]
            pred_mw = float(self.model.predict(feat_df)[0])
            points.append({
                "timestamp": row["timestamp"].to_pydatetime(),
                "predicted_mw": pred_mw,
                "hour": int(row["hour"]),
                "observation_type": obs_name_map.get(int(row.get("observation_type_encoded", 1)), "slot"),
                "solar_irradiance": float(row.get("solar_irradiance", 0.0)),
                "temperature_c": float(row.get("temperature_c", 0.0)),
                "feat_dict": feat_dict,
            })
        return points

    def get_bulk_series_for_date(self, target_date: date_cls) -> Tuple[List[Dict], str]:
        """
        Resolve the genuine bulk-Mumbai model series that should back a
        forecast for `target_date`, and the mode used to produce it:

          - "current":    target_date == today. Identical to the pre-date-
                           parameter behavior: autoregressive continuation
                           anchored at `datetime.now()`.
          - "historical": target_date is a real day inside the loaded
                           history CSV (before today). True backtest —
                           reuses that day's actual precomputed leakage-safe
                           features, run through the real model. Never uses
                           the target day's own demand_mw as a feature input
                           (only shifted lag/rolling columns of earlier rows).
          - "future":     target_date is after today, within MAX_FUTURE_DAYS.
                           Autoregressive continuation from the real history
                           tail through `datetime.now()`, extended far enough
                           to cover target_date.

        Raises DateUnavailableError for any date this backend cannot
        genuinely serve (a past date with no historical data, or a future
        date beyond the extrapolation cap) — never fabricates a fallback.
        """
        if self.model is None or self.history_df is None or len(self.history_df) < 28:
            raise DateUnavailableError(
                "Forecasting model or historical data failed to load; no genuine "
                "forecast can be produced for any date."
            )

        reference_date = self.get_reference_date()

        if target_date == reference_date:
            now = datetime.now().replace(second=0, microsecond=0)
            return self._generate_mumbai_raw_forecasts(now, steps=12), "current"

        if target_date < reference_date:
            hist_min, hist_max = self.history_min_date, self.history_max_date
            if hist_min is not None and hist_min <= target_date <= hist_max:
                day_rows = self.history_df[self.history_df["timestamp"].dt.date == target_date]
                if day_rows.empty:
                    raise DateUnavailableError(
                        f"No historical observations recorded for {target_date.isoformat()}."
                    )
                # Bounding rows from the adjacent days give the interpolation
                # in _map_to_locality a real anchor just outside the day edges.
                before = self.history_df[self.history_df["timestamp"].dt.date < target_date].tail(1)
                after = self.history_df[self.history_df["timestamp"].dt.date > target_date].head(1)
                combined = pd.concat([before, day_rows, after]).sort_values("timestamp")
                return self._bulk_points_from_history_rows(combined), "historical"

            raise DateUnavailableError(
                f"Forecast unavailable for {target_date.isoformat()}: no historical demand data "
                f"exists for this date, and it is in the past so it cannot be forecast forward "
                f"either. Genuinely supported historical range: "
                f"{hist_min.isoformat() if hist_min else 'none'} to "
                f"{hist_max.isoformat() if hist_max else 'none'}."
            )

        # target_date > reference_date
        days_ahead = (target_date - reference_date).days
        if days_ahead > MAX_FUTURE_DAYS:
            raise DateUnavailableError(
                f"Forecast unavailable for {target_date.isoformat()}: {days_ahead} days ahead of "
                f"today exceeds the maximum supported forecast horizon of {MAX_FUTURE_DAYS} days. "
                f"Beyond this window, recursive autoregressive forecast error compounds too much "
                f"to be presented as a genuine prediction."
            )
        now = datetime.now().replace(second=0, microsecond=0)
        # ~4 observation slots/day plus a buffer, so the requested date's
        # slots (and one trailing slot for interpolation) are fully covered.
        steps = min(80, (days_ahead + 2) * 4)
        return self._generate_mumbai_raw_forecasts(now, steps=steps), "future"

    def _generate_mumbai_raw_forecasts(self, start_dt: datetime, steps: int = 12) -> List[Dict]:
        """
        Produce autoregressive multi-step bulk Mumbai predictions using the trained XGBoost model.
        """
        if self.model is None or self.history_df is None or len(self.history_df) < 28:
            # Fallback heuristic bulk Mumbai diurnal curve if artifact absent
            return self._heuristic_mumbai_curve(start_dt, steps)

        history = self.history_df.copy()
        recent_demands = history["demand_mw"].astype(float).tolist()

        observation_hours = [3, 10, 16, 20]
        obs_encoded_map = {3: 0, 10: 1, 16: 2, 20: 3}
        obs_name_map = {3: "night_minimum", 10: "morning_peak", 16: "day_peak", 20: "evening_peak"}

        results = []
        curr_dt = start_dt

        for _ in range(steps):
            # Find next observation slot
            next_slots = [h for h in observation_hours if h > curr_dt.hour]
            if next_slots:
                next_hour = next_slots[0]
                target_dt = curr_dt.replace(hour=next_hour, minute=0, second=0, microsecond=0)
            else:
                next_hour = observation_hours[0]
                target_dt = (curr_dt + timedelta(days=1)).replace(hour=next_hour, minute=0, second=0, microsecond=0)

            # Build feature vector
            obs_type_enc = obs_encoded_map.get(next_hour, 1)
            hour = target_dt.hour
            day_of_week = target_dt.weekday()
            day_of_month = target_dt.day
            month = target_dt.month
            is_weekend = int(day_of_week >= 5)
            is_holiday = 0

            lag_1 = recent_demands[-1]
            lag_2 = recent_demands[-2] if len(recent_demands) >= 2 else lag_1
            lag_4 = recent_demands[-4] if len(recent_demands) >= 4 else lag_1
            lag_8 = recent_demands[-8] if len(recent_demands) >= 8 else lag_1
            lag_28 = recent_demands[-28] if len(recent_demands) >= 28 else lag_1

            rolling_mean_4 = float(np.mean(recent_demands[-4:]))
            rolling_mean_7 = float(np.mean(recent_demands[-7:]))
            rolling_max_4 = float(np.max(recent_demands[-4:]))
            rolling_min_4 = float(np.min(recent_demands[-4:]))
            rolling_std_7 = float(np.std(recent_demands[-7:]))

            # Ambient thermal & cooling features for next slot
            temp_c = 28.0 + 5.0 * np.sin(np.pi * (hour - 6) / 12) if 6 <= hour <= 18 else 26.5
            rh_pct = 78.0
            cooling_idx = max(0.0, temp_c - 24.0)
            heat_idx = temp_c + 2.0
            solar_irr = max(0.0, 700.0 * np.sin(np.pi * (hour - 6) / 12)) if 6 <= hour <= 18 else 0.0
            solar_ramp = 0.0

            feat_dict = {
                "observation_type_encoded": obs_type_enc,
                "hour": hour,
                "day_of_week": day_of_week,
                "day_of_month": day_of_month,
                "month": month,
                "is_weekend": is_weekend,
                "is_holiday": is_holiday,
                "lag_1": lag_1,
                "lag_2": lag_2,
                "lag_4": lag_4,
                "lag_8": lag_8,
                "lag_28": lag_28,
                "rolling_mean_4": rolling_mean_4,
                "rolling_mean_7": rolling_mean_7,
                "rolling_max_4": rolling_max_4,
                "rolling_min_4": rolling_min_4,
                "rolling_std_7": rolling_std_7,
                "temperature_c": temp_c,
                "relative_humidity_percent": rh_pct,
                "cooling_degree_index": cooling_idx,
                "heat_index": heat_idx,
                "solar_irradiance": solar_irr,
                "solar_ramp": solar_ramp,
            }

            feat_df = pd.DataFrame([feat_dict])[self.feature_columns]
            pred_mw = float(self.model.predict(feat_df)[0])

            results.append({
                "timestamp": target_dt,
                "predicted_mw": pred_mw,
                "hour": hour,
                "observation_type": obs_name_map.get(next_hour, "slot"),
                "solar_irradiance": solar_irr,
                "temperature_c": temp_c,
                "feat_dict": dict(feat_dict),
            })

            recent_demands.append(pred_mw)
            curr_dt = target_dt

        return results

    def _heuristic_mumbai_curve(self, start_dt: datetime, steps: int = 12) -> List[Dict]:
        """Heuristic bulk Mumbai curve fallback."""
        results = []
        curr_dt = start_dt
        for i in range(1, steps + 1):
            target_dt = curr_dt + timedelta(hours=i * 2)
            hour = target_dt.hour
            # Mumbai baseline curve between 2200 MW (night) and 3500 MW (afternoon/evening peak)
            base = 2800.0 + 600.0 * np.sin(np.pi * (hour - 5) / 14) if 5 <= hour <= 23 else 2250.0
            results.append({
                "timestamp": target_dt,
                "predicted_mw": float(base),
                "hour": hour,
                "observation_type": "interpolated",
                "solar_irradiance": max(0.0, 700.0 * np.sin(np.pi * (hour - 6) / 12)) if 6 <= hour <= 18 else 0.0,
                "temperature_c": 29.0,
            })
        return results

    def _map_to_locality(
        self,
        locality: Locality,
        bulk_points: List[Dict],
        start_time: datetime,
        horizon_type: str,
        anchor_to_current: bool = False,
    ) -> List[ForecastPoint]:
        """
        Digital Twin Locality Mapping:
        Interpolates the real, sparse (~4/day) XGBoost bulk-Mumbai predictions
        in `bulk_points` onto the locality's fine-grained output grid, scales
        them to the locality via base_scale = current_demand_mw / CITY_BASELINE_MW,
        then applies locality-specific physical refinements (cooling load,
        rooftop solar offset) on top of that real model signal.

        `bulk_points` is genuinely used here (previously this method silently
        discarded it and generated a synthetic hour-of-day-only curve — a bug
        fixed as part of adding date-awareness, since a curve independent of
        `bulk_points` would also be independent of the requested date).
        """
        base_scale = locality.current_demand_mw / CITY_BASELINE_MW

        points: List[ForecastPoint] = []
        residual_std = self.prediction_interval_info.get("residual_std", 150.0)
        loc_res_std = max(2.5, residual_std * base_scale)

        # Generate smooth timestamps for the requested horizon
        if horizon_type == "15min":
            # 8 points at 15-minute intervals (covering next 2 hours)
            step_minutes = 15
            total_points = 8
        elif horizon_type == "1h":
            # 12 points at 1-hour intervals (covering next 12 hours)
            step_minutes = 60
            total_points = 12
        else:  # 24h
            # 24 points at 1-hour intervals (covering full 24h cycle)
            step_minutes = 60
            total_points = 24

        bulk_sorted = sorted(bulk_points, key=lambda p: p["timestamp"]) if bulk_points else []
        bulk_x = np.array([(p["timestamp"] - start_time).total_seconds() / 60.0 for p in bulk_sorted])
        bulk_y = np.array([p["predicted_mw"] for p in bulk_sorted])

        curr_time = start_time

        for i in range(total_points):
            t = curr_time + timedelta(minutes=i * step_minutes)
            hour = t.hour
            minute = t.minute
            frac_hour = hour + minute / 60.0
            x = (t - start_time).total_seconds() / 60.0

            # Real model signal: linearly interpolate the sparse bulk-Mumbai
            # predictions onto this timestamp, then scale to the locality.
            if len(bulk_x) >= 2:
                interp_bulk_mw = float(np.interp(x, bulk_x, bulk_y))
            elif len(bulk_x) == 1:
                interp_bulk_mw = float(bulk_y[0])
            else:
                interp_bulk_mw = CITY_BASELINE_MW
            scaled_mw = interp_bulk_mw * base_scale

            # Locality-specific physical refinements on top of the real signal.
            ambient_temp = 27.0 + 6.0 * np.sin(np.pi * (frac_hour - 6) / 13) if 6 <= frac_hour <= 19 else 26.5
            cooling_offset = locality.cooling_sensitivity * max(0.0, ambient_temp - 26.0) * 8.0
            solar_irr = max(0.0, 750.0 * np.sin(np.pi * (frac_hour - 6) / 12)) if 6 <= frac_hour <= 18 else 0.0
            solar_gen_mw = locality.solar_capacity_mw * (solar_irr / 800.0) * 0.85

            raw_loc_demand = scaled_mw + cooling_offset - solar_gen_mw

            if anchor_to_current:
                # Smooth anchor to the live current_demand_mw snapshot at t=0,
                # decaying to the pure model-driven curve — only meaningful
                # when the requested date is today (mode == "current").
                weight_anchor = max(0.0, 1.0 - (i * step_minutes / 180.0))
                pred_mw = weight_anchor * locality.current_demand_mw + (1.0 - weight_anchor) * raw_loc_demand
            else:
                pred_mw = raw_loc_demand
            pred_mw = round(max(5.0, float(pred_mw)), 1)

            # Prediction intervals (90% bounds)
            lower_bound = round(max(0.0, pred_mw - 1.645 * loc_res_std), 1)
            upper_bound = round(pred_mw + 1.645 * loc_res_std, 1)

            # Timestamp in ISO 8601 with Asia/Kolkata +05:30 offset
            ts_iso = t.strftime("%Y-%m-%dT%H:%M:%S+05:30")

            # For the first point of a "today" (current) series, record
            # actual_mw as the live current_demand_mw snapshot.
            actual_mw = locality.current_demand_mw if (anchor_to_current and i == 0) else None

            points.append(
                ForecastPoint(
                    timestamp=ts_iso,
                    actual_mw=actual_mw,
                    predicted_mw=pred_mw,
                    lower_bound_mw=lower_bound,
                    upper_bound_mw=upper_bound,
                )
            )

        return points

    def get_forecast(
        self, locality_id: str, horizon: str = "24h", date: Optional[str] = None
    ) -> ForecastResponse:
        """
        Generate locality forecast summary and peak risk analysis for the
        requested calendar date (defaults to today's reference date).
        """
        locality = LOCALITIES_BY_ID.get(locality_id)
        if locality is None:
            raise KeyError(f"Locality '{locality_id}' not found")

        # Standardize horizon string
        norm_horizon = "24h"
        if horizon in ["15min", "15m"]:
            norm_horizon = "15min"
        elif horizon in ["1h", "1hour"]:
            norm_horizon = "1h"

        target_date = self._parse_date_param(date)
        bulk_forecasts, mode = self.get_bulk_series_for_date(target_date)

        if mode == "current":
            grid_start = datetime.now().replace(second=0, microsecond=0)
            anchor = True
        else:
            grid_start = datetime(target_date.year, target_date.month, target_date.day)
            anchor = False

        points_24h = self._map_to_locality(locality, bulk_forecasts, grid_start, "24h", anchor)
        points_1h = self._map_to_locality(locality, bulk_forecasts, grid_start, "1h", anchor)
        points_15m = self._map_to_locality(locality, bulk_forecasts, grid_start, "15min", anchor)

        # Extract horizon benchmark numbers
        fifteen_min_mw = points_15m[1].predicted_mw if len(points_15m) > 1 else locality.current_demand_mw
        one_hour_mw = points_1h[1].predicted_mw if len(points_1h) > 1 else locality.current_demand_mw
        twenty_four_hour_peak_mw = max(p.predicted_mw for p in points_24h)

        # Select relevant series for peak analysis based on requested horizon
        if norm_horizon == "15min":
            active_points = points_15m
        elif norm_horizon == "1h":
            active_points = points_1h
        else:
            active_points = points_24h

        # Deterministic Peak Analysis
        base_scale = locality.current_demand_mw / 3100.0
        residual_std = max(2.5, self.prediction_interval_info.get("residual_std", 150.0) * base_scale)
        peak_analysis = analyze_peak(active_points, locality.peak_threshold_mw, residual_std=residual_std)

        # Confidence from model MAPE
        mape_24h = self.metrics.get("24hour", {}).get("mape", 3.64)
        confidence = round(max(0.70, min(0.98, 1.0 - (mape_24h / 100.0))), 2)

        return ForecastResponse(
            locality_id=locality.id,
            locality_name=locality.name,
            current_demand_mw=locality.current_demand_mw,
            date=target_date.isoformat(),
            data_mode=mode,
            forecast=ForecastValues(
                **{
                    "15min_mw": fifteen_min_mw,
                    "1hour_mw": one_hour_mw,
                    "24hour_peak_mw": twenty_four_hour_peak_mw,
                }
            ),
            peak=peak_analysis,
            confidence=confidence,
            is_demo_fallback=False,
        )

    def get_forecast_series(
        self, locality_id: str, horizon: str = "24h", date: Optional[str] = None
    ) -> ForecastSeriesResponse:
        """
        Generate time-series forecast points with prediction intervals for
        chart rendering, for the requested calendar date.
        """
        locality = LOCALITIES_BY_ID.get(locality_id)
        if locality is None:
            raise KeyError(f"Locality '{locality_id}' not found")

        norm_horizon = "24h"
        if horizon in ["15min", "15m"]:
            norm_horizon = "15min"
        elif horizon in ["1h", "1hour"]:
            norm_horizon = "1h"

        target_date = self._parse_date_param(date)
        bulk_forecasts, mode = self.get_bulk_series_for_date(target_date)

        if mode == "current":
            grid_start = datetime.now().replace(second=0, microsecond=0)
            anchor = True
        else:
            grid_start = datetime(target_date.year, target_date.month, target_date.day)
            anchor = False

        points = self._map_to_locality(locality, bulk_forecasts, grid_start, norm_horizon, anchor)

        return ForecastSeriesResponse(
            locality_id=locality.id,
            horizon=norm_horizon,
            unit="MW",
            date=target_date.isoformat(),
            data_mode=mode,
            points=points,
            is_demo_fallback=False,
        )
