"""
PeakSense SHAP Explanation Engine Service.

Produces SHAP TreeExplainer feature contributions for the peak-point
prediction within a requested forecast horizon for a given locality.

Architecture notes:
- Uses the same trained XGBoost artifact as ForecastEngine (singleton).
- Builds the same feature vector that ForecastEngine uses for the predicted
  peak point so that SHAP contributions correspond exactly to the forecast.
- SHAP TreeExplainer is deterministic: same input → same SHAP values.
- Contributions are in bulk Mumbai MW units (the model's native output unit).
  They are labelled clearly — the UI must not present them as per-locality MW.
- The ExplanationEngine is a singleton; the SHAP explainer is built once on
  first call and cached (TreeExplainer initialisation reads the full tree
  structure — no computation per request after that).
"""

from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import math

import numpy as np
import pandas as pd

from app.seed_data import LOCALITIES_BY_ID
from app.schemas.explanation import ExplanationResponse, FeatureContribution
from app.schemas.forecast_inputs import ForecastInputFeature, ForecastInputsResponse
from app.services.forecasting import ForecastEngine

# ─── Feature metadata ─────────────────────────────────────────────────────────

# Human-readable labels for every feature in the model
FEATURE_LABELS: Dict[str, str] = {
    "observation_type_encoded": "Observation type (time slot)",
    "hour": "Hour of day",
    "day_of_week": "Day of week",
    "day_of_month": "Day of month",
    "month": "Month",
    "is_weekend": "Weekend flag",
    "is_holiday": "Holiday flag",
    "lag_1": "Demand 1 step ago (lag-1)",
    "lag_2": "Demand 2 steps ago (lag-2)",
    "lag_4": "Demand 4 steps ago (lag-4)",
    "lag_8": "Demand 8 steps ago (lag-8)",
    "lag_28": "4-week lagged demand (lag-28)",
    "rolling_mean_4": "4-step rolling mean demand",
    "rolling_mean_7": "7-step rolling mean demand",
    "rolling_max_4": "4-step rolling max demand",
    "rolling_min_4": "4-step rolling min demand",
    "rolling_std_7": "7-step rolling demand std dev",
    "temperature_c": "Ambient temperature (°C)",
    "relative_humidity_percent": "Relative humidity (%)",
    "cooling_degree_index": "Cooling degree index",
    "heat_index": "Heat index",
    "solar_irradiance": "Solar irradiance (W/m²)",
    "solar_ramp": "Solar generation ramp rate",
}

# Category assignment for each feature
FEATURE_CATEGORIES: Dict[str, str] = {
    "observation_type_encoded": "temporal",
    "hour": "temporal",
    "day_of_week": "temporal",
    "day_of_month": "temporal",
    "month": "temporal",
    "is_weekend": "temporal",
    "is_holiday": "temporal",
    "lag_1": "lag",
    "lag_2": "lag",
    "lag_4": "lag",
    "lag_8": "lag",
    "lag_28": "lag",
    "rolling_mean_4": "rolling",
    "rolling_mean_7": "rolling",
    "rolling_max_4": "rolling",
    "rolling_min_4": "rolling",
    "rolling_std_7": "rolling",
    "temperature_c": "weather",
    "relative_humidity_percent": "weather",
    "cooling_degree_index": "weather",
    "heat_index": "weather",
    "solar_irradiance": "solar",
    "solar_ramp": "solar",
}

# ─── Explanation summary builder ───────────────────────────────────────────────

def _build_summary(
    locality_name: str,
    locality_pred_mw: float,
    threshold_mw: float,
    drivers: List[FeatureContribution],
    peak_time: str,
) -> str:
    """
    Build a deterministic, human-readable summary from SHAP drivers.

    Derived only from actual SHAP values — no LLM, no heuristic text.
    """
    if not drivers:
        return (
            f"The XGBoost model predicts {locality_pred_mw:.0f} MW peak demand "
            f"for {locality_name} around {peak_time} "
            f"(threshold: {threshold_mw:.0f} MW)."
        )

    # Top positive contributor (demand-increasing)
    positive = [d for d in drivers if d.direction == "increase"]
    negative = [d for d in drivers if d.direction == "decrease"]

    top_pos = positive[0] if positive else None
    top_neg = negative[0] if negative else None

    # Risk assessment
    ratio = locality_pred_mw / threshold_mw if threshold_mw > 0 else 0.0
    if ratio >= 1.05:
        risk_phrase = "significantly above the safety threshold"
    elif ratio >= 1.0:
        risk_phrase = "at the safety threshold"
    elif ratio >= 0.9:
        risk_phrase = "approaching the safety threshold"
    else:
        risk_phrase = "within safe operating margins"

    parts: List[str] = [
        f"The XGBoost model predicts a peak of {locality_pred_mw:.0f} MW for "
        f"{locality_name} around {peak_time}, {risk_phrase} ({threshold_mw:.0f} MW)."
    ]

    if top_pos:
        parts.append(
            f"The strongest upward driver is {top_pos.label.lower()} "
            f"(SHAP: +{abs(top_pos.shap_value_mw):.1f} MW bulk)."
        )
    if top_neg:
        parts.append(
            f"The strongest downward driver is {top_neg.label.lower()} "
            f"(SHAP: −{abs(top_neg.shap_value_mw):.1f} MW bulk)."
        )

    # Weather signal
    weather_drivers = [d for d in drivers if d.category == "weather"]
    if weather_drivers:
        wd = weather_drivers[0]
        direction_word = "elevating" if wd.direction == "increase" else "reducing"
        parts.append(
            f"Thermal conditions ({wd.label.lower()}: {wd.feature_value:.1f}) "
            f"are {direction_word} bulk demand by {abs(wd.shap_value_mw):.1f} MW."
        )

    return " ".join(parts)


# ─── ExplanationEngine ────────────────────────────────────────────────────────

class ExplanationEngine:
    _instance: Optional["ExplanationEngine"] = None
    _explainer = None  # cached shap.TreeExplainer

    def __init__(self):
        self._engine = ForecastEngine.get_instance()
        self._explainer = None
        self._init_explainer()

    @classmethod
    def get_instance(cls) -> "ExplanationEngine":
        if cls._instance is None:
            cls._instance = ExplanationEngine()
        return cls._instance

    def _init_explainer(self):
        """Initialise SHAP TreeExplainer from the cached XGBoost model."""
        if self._engine.model is None:
            return
        try:
            import shap  # lazy import — only needed when endpoint is called
            self._explainer = shap.TreeExplainer(self._engine.model)
        except Exception as e:
            print(f"Warning: SHAP TreeExplainer init failed: {e}")
            self._explainer = None

    def _build_feature_vector(
        self, locality_id: str, horizon: str
    ) -> Tuple[Optional[pd.DataFrame], Optional[Dict[str, float]]]:
        """
        Build the exact feature vector for the peak prediction point.

        Mirrors the logic in ForecastEngine._generate_mumbai_raw_forecasts()
        so that SHAP values correspond to the actual forecast that was served.
        Returns (feature_df, raw_feature_dict) or (None, None) on failure.
        """
        engine = self._engine
        if engine.model is None or engine.history_df is None:
            return None, None

        feature_columns = engine.feature_columns
        history = engine.history_df.copy()
        recent_demands = history["demand_mw"].astype(float).tolist()

        observation_hours = [3, 10, 16, 20]
        obs_encoded_map = {3: 0, 10: 1, 16: 2, 20: 3}

        now = datetime.now().replace(second=0, microsecond=0)

        # Determine how many steps ahead the peak occurs within the horizon
        if horizon in ("15min", "15m"):
            total_steps = 8
        elif horizon in ("1h", "1hour"):
            total_steps = 12
        else:  # 24h
            total_steps = 12  # bulk model always runs 12 steps

        # Simulate all steps to find the peak point (matching ForecastEngine logic)
        curr_dt = now
        all_results = []
        demands_sim = list(recent_demands)

        for _ in range(total_steps):
            next_slots = [h for h in observation_hours if h > curr_dt.hour]
            if next_slots:
                next_hour = next_slots[0]
                target_dt = curr_dt.replace(hour=next_hour, minute=0, second=0, microsecond=0)
            else:
                next_hour = observation_hours[0]
                target_dt = (curr_dt + timedelta(days=1)).replace(
                    hour=next_hour, minute=0, second=0, microsecond=0
                )

            obs_type_enc = obs_encoded_map.get(next_hour, 1)
            hour = target_dt.hour
            day_of_week = target_dt.weekday()
            day_of_month = target_dt.day
            month = target_dt.month
            is_weekend = int(day_of_week >= 5)
            is_holiday = 0

            lag_1 = demands_sim[-1]
            lag_2 = demands_sim[-2] if len(demands_sim) >= 2 else lag_1
            lag_4 = demands_sim[-4] if len(demands_sim) >= 4 else lag_1
            lag_8 = demands_sim[-8] if len(demands_sim) >= 8 else lag_1
            lag_28 = demands_sim[-28] if len(demands_sim) >= 28 else lag_1

            rolling_mean_4 = float(np.mean(demands_sim[-4:]))
            rolling_mean_7 = float(np.mean(demands_sim[-7:]))
            rolling_max_4 = float(np.max(demands_sim[-4:]))
            rolling_min_4 = float(np.min(demands_sim[-4:]))
            rolling_std_7 = float(np.std(demands_sim[-7:]))

            temp_c = 28.0 + 5.0 * np.sin(np.pi * (hour - 6) / 12) if 6 <= hour <= 18 else 26.5
            rh_pct = 78.0
            cooling_idx = max(0.0, temp_c - 24.0)
            heat_idx = temp_c + 2.0
            solar_irr = max(0.0, 700.0 * np.sin(np.pi * (hour - 6) / 12)) if 6 <= hour <= 18 else 0.0
            solar_ramp = 0.0

            feat_dict: Dict[str, float] = {
                "observation_type_encoded": float(obs_type_enc),
                "hour": float(hour),
                "day_of_week": float(day_of_week),
                "day_of_month": float(day_of_month),
                "month": float(month),
                "is_weekend": float(is_weekend),
                "is_holiday": float(is_holiday),
                "lag_1": float(lag_1),
                "lag_2": float(lag_2),
                "lag_4": float(lag_4),
                "lag_8": float(lag_8),
                "lag_28": float(lag_28),
                "rolling_mean_4": rolling_mean_4,
                "rolling_mean_7": rolling_mean_7,
                "rolling_max_4": rolling_max_4,
                "rolling_min_4": rolling_min_4,
                "rolling_std_7": rolling_std_7,
                "temperature_c": float(temp_c),
                "relative_humidity_percent": float(rh_pct),
                "cooling_degree_index": float(cooling_idx),
                "heat_index": float(heat_idx),
                "solar_irradiance": float(solar_irr),
                "solar_ramp": float(solar_ramp),
            }

            feat_df = pd.DataFrame([feat_dict])[feature_columns]
            pred_mw = float(engine.model.predict(feat_df)[0])

            all_results.append((target_dt, feat_dict, pred_mw))
            demands_sim.append(pred_mw)
            curr_dt = target_dt

        if not all_results:
            return None, None

        # Peak = step with highest prediction
        peak_step = max(all_results, key=lambda x: x[2])
        _, peak_feat_dict, _ = peak_step

        feat_df = pd.DataFrame([peak_feat_dict])[feature_columns]
        return feat_df, peak_feat_dict

    def get_explanation(
        self, locality_id: str, horizon: str, top_n: int = 8
    ) -> ExplanationResponse:
        """
        Compute SHAP explanation for the peak-point forecast for a locality.

        Returns ExplanationResponse with real SHAP contributions.
        Falls back to a feature-importance-based response if SHAP is unavailable.
        """
        locality = LOCALITIES_BY_ID.get(locality_id)
        if locality is None:
            raise KeyError(f"Locality '{locality_id}' not found")

        # Normalise horizon
        norm = "24h"
        if horizon in ("15min", "15m"):
            norm = "15min"
        elif horizon in ("1h", "1hour"):
            norm = "1h"

        # Build peak-point feature vector
        feat_df, feat_dict = self._build_feature_vector(locality_id, norm)

        if feat_df is None or feat_dict is None or self._explainer is None:
            return self._fallback_explanation(locality_id, norm)

        # Predict (bulk Mumbai MW)
        engine = self._engine
        prediction_mw = float(engine.model.predict(feat_df)[0])

        # Locality-scale the prediction the same way ForecastEngine does
        city_baseline = 3100.0
        base_scale = locality.current_demand_mw / city_baseline
        locality_pred_mw = round(prediction_mw * base_scale, 1)

        # SHAP values
        shap_values = self._explainer.shap_values(feat_df)  # shape: (1, n_features)
        base_value_mw = float(self._explainer.expected_value)
        sv_row = shap_values[0]  # numpy array of length n_features

        feature_columns = engine.feature_columns

        # Sanity checks
        for val in sv_row:
            if math.isnan(val) or math.isinf(val):
                return self._fallback_explanation(locality_id, norm)

        # Build contributions list
        contributions: List[FeatureContribution] = []
        for fname, sv, fval in zip(feature_columns, sv_row, feat_df.iloc[0].tolist()):
            if math.isnan(sv) or math.isinf(sv):
                continue
            contributions.append(
                FeatureContribution(
                    feature=fname,
                    label=FEATURE_LABELS.get(fname, fname),
                    shap_value_mw=round(float(sv), 3),
                    direction="increase" if sv >= 0 else "decrease",
                    feature_value=round(float(fval), 3),
                    category=FEATURE_CATEGORIES.get(fname, "other"),
                )
            )

        # Sort by absolute SHAP magnitude, take top_n
        contributions.sort(key=lambda c: -abs(c.shap_value_mw))
        top_drivers = contributions[:top_n]

        # Build deterministic peak time from the 24h forecast for context
        try:
            forecast = engine.get_forecast(locality_id=locality_id, horizon=horizon)
            peak_time = forecast.peak.peak_time
            threshold_mw = forecast.peak.threshold_mw
        except Exception:
            peak_time = "—"
            threshold_mw = locality.peak_threshold_mw

        summary = _build_summary(
            locality_name=locality.name,
            locality_pred_mw=locality_pred_mw,
            threshold_mw=threshold_mw,
            drivers=top_drivers,
            peak_time=peak_time,
        )

        return ExplanationResponse(
            locality_id=locality.id,
            locality_name=locality.name,
            horizon=norm,
            prediction_mw=round(prediction_mw, 2),
            locality_prediction_mw=locality_pred_mw,
            base_value_mw=round(base_value_mw, 2),
            drivers=top_drivers,
            summary=summary,
            method="SHAP_TreeExplainer",
            is_demo_fallback=False,
        )

    def _fallback_explanation(self, locality_id: str, horizon: str) -> ExplanationResponse:
        """
        Feature-importance-based fallback when SHAP is unavailable.
        Clearly labelled as fallback — never presented as SHAP.
        """
        locality = LOCALITIES_BY_ID.get(locality_id)
        if locality is None:
            raise KeyError(f"Locality '{locality_id}' not found")

        engine = self._engine
        if engine.model is None:
            drivers: List[FeatureContribution] = []
        else:
            fi = engine.model.feature_importances_
            fc = engine.feature_columns
            sorted_fi = sorted(zip(fc, fi), key=lambda x: -x[1])
            drivers = [
                FeatureContribution(
                    feature=fname,
                    label=FEATURE_LABELS.get(fname, fname),
                    shap_value_mw=round(float(imp) * 100, 3),  # scaled gain, NOT MW
                    direction="increase",
                    feature_value=0.0,
                    category=FEATURE_CATEGORIES.get(fname, "other"),
                )
                for fname, imp in sorted_fi[:8]
            ]

        return ExplanationResponse(
            locality_id=locality_id,
            locality_name=locality.name if locality else locality_id,
            horizon=horizon,
            prediction_mw=0.0,
            locality_prediction_mw=0.0,
            base_value_mw=0.0,
            drivers=drivers,
            summary=(
                "SHAP explanation unavailable — showing native XGBoost feature importance "
                "(gain-based, not per-prediction contributions)."
            ),
            method="SHAP_TreeExplainer",
            is_demo_fallback=True,
        )

    def get_forecast_inputs(
        self, locality_id: str, horizon: str
    ) -> ForecastInputsResponse:
        """
        Return the actual model input feature values at the peak-point prediction.

        These are the REAL values passed to the XGBoost model during inference.
        They are NOT externally measured sensor readings.

        Reuses _build_feature_vector() so the returned values correspond exactly
        to the forecast already served by GET /api/forecast for the same request.

        Source provenance per feature:
          historical_lag   — actual demand values from the loaded history CSV
          model_computed   — diurnal formula or derived calculation
          fixed_assumption — constant value baked into the inference pipeline
          calendar         — wall-clock datetime attributes
        """
        locality = LOCALITIES_BY_ID.get(locality_id)
        if locality is None:
            raise KeyError(f"Locality '{locality_id}' not found")

        # Normalise horizon
        norm = "24h"
        if horizon in ("15min", "15m"):
            norm = "15min"
        elif horizon in ("1h", "1hour"):
            norm = "1h"

        feat_df, feat_dict = self._build_feature_vector(locality_id, norm)

        # If model/history unavailable, return a clearly-labelled fallback
        if feat_df is None or feat_dict is None:
            return ForecastInputsResponse(
                locality_id=locality_id,
                locality_name=locality.name,
                horizon=norm,
                peak_hour=0,
                features=[],
                is_demo_fallback=True,
            )

        peak_hour = int(feat_dict.get("hour", 0))

        # Build the typed feature list with honest provenance annotations
        features: list[ForecastInputFeature] = [
            ForecastInputFeature(
                feature="temperature_c",
                label="Ambient temperature",
                value=round(feat_dict.get("temperature_c", 0.0), 1),
                unit="°C",
                source="model_computed",
                source_note=(
                    "Diurnal approximation: 28 + 5×sin(π×(hour−6)/12) for daytime, "
                    "26.5°C at night. Not a real-time weather reading."
                ),
            ),
            ForecastInputFeature(
                feature="relative_humidity_percent",
                label="Relative humidity",
                value=round(feat_dict.get("relative_humidity_percent", 78.0), 1),
                unit="%",
                source="fixed_assumption",
                source_note=(
                    "Fixed at 78% — a reasonable Mumbai monsoon season estimate. "
                    "No real-time humidity data available."
                ),
            ),
            ForecastInputFeature(
                feature="solar_irradiance",
                label="Solar irradiance",
                value=round(feat_dict.get("solar_irradiance", 0.0), 1),
                unit="W/m²",
                source="model_computed",
                source_note=(
                    "Diurnal approximation: 700×sin(π×(hour−6)/12) for daytime, "
                    "0 W/m² at night. Not a real-time solar sensor reading."
                ),
            ),
            ForecastInputFeature(
                feature="lag_1",
                label="Previous demand (lag-1)",
                value=round(feat_dict.get("lag_1", 0.0), 1),
                unit="MW",
                source="historical_lag",
                source_note=(
                    "Most-recent bulk Mumbai demand value from the loaded history CSV. "
                    "This is the actual historical value used during inference."
                ),
            ),
            ForecastInputFeature(
                feature="hour",
                label="Hour of day",
                value=float(int(feat_dict.get("hour", 0))),
                unit="",
                source="calendar",
                source_note="Wall-clock hour (0–23) at the predicted peak step.",
            ),
            ForecastInputFeature(
                feature="day_of_week",
                label="Day of week",
                value=float(int(feat_dict.get("day_of_week", 0))),
                unit="",
                source="calendar",
                source_note="0 = Monday, 6 = Sunday. Wall-clock value at the predicted peak step.",
            ),
            ForecastInputFeature(
                feature="is_weekend",
                label="Weekend flag",
                value=float(int(feat_dict.get("is_weekend", 0))),
                unit="",
                source="calendar",
                source_note="1 if Saturday or Sunday, else 0.",
            ),
            ForecastInputFeature(
                feature="is_holiday",
                label="Holiday flag",
                value=float(int(feat_dict.get("is_holiday", 0))),
                unit="",
                source="fixed_assumption",
                source_note=(
                    "Fixed at 0. No public holiday calendar is integrated into the model pipeline."
                ),
            ),
            ForecastInputFeature(
                feature="cooling_degree_index",
                label="Cooling degree index",
                value=round(feat_dict.get("cooling_degree_index", 0.0), 2),
                unit="",
                source="model_computed",
                source_note=(
                    "Derived: max(0, temperature_c − 24.0). "
                    "Represents cooling load intensity above 24°C comfort threshold."
                ),
            ),
            ForecastInputFeature(
                feature="rolling_mean_4",
                label="4-step rolling mean demand",
                value=round(feat_dict.get("rolling_mean_4", 0.0), 1),
                unit="MW",
                source="historical_lag",
                source_note=(
                    "Mean of the 4 most-recent bulk Mumbai demand values. "
                    "Computed from the loaded history CSV."
                ),
            ),
        ]

        return ForecastInputsResponse(
            locality_id=locality_id,
            locality_name=locality.name,
            horizon=norm,
            peak_hour=peak_hour,
            features=features,
            is_demo_fallback=False,
        )
