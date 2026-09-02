from pathlib import Path
from datetime import timedelta

import joblib
import pandas as pd


# ============================================================
# PATH CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

MODEL_FILE = (
    BASE_DIR
    / "ml"
    / "models"
    / "mumbai_demand_model.joblib"
)

INPUT_FILE = (
    BASE_DIR
    / "data"
    / "raw"
    / "electricity"
    / "mumbai_demand_extracted.csv"
)


# ============================================================
# CONSTANTS
# ============================================================

OBSERVATION_SLOTS = [
    {
        "hour": 3,
        "observation_type": "night_minimum",
        "observation_type_encoded": 0,
    },
    {
        "hour": 10,
        "observation_type": "morning_peak",
        "observation_type_encoded": 1,
    },
    {
        "hour": 16,
        "observation_type": "day_peak",
        "observation_type_encoded": 2,
    },
    {
        "hour": 20,
        "observation_type": "evening_peak",
        "observation_type_encoded": 3,
    },
]


# ============================================================
# LOAD MODEL
# ============================================================

def load_model():

    if not MODEL_FILE.exists():

        raise FileNotFoundError(
            f"Model file not found:\n{MODEL_FILE}"
        )

    artifact = joblib.load(
        MODEL_FILE
    )

    return artifact


# ============================================================
# LOAD HISTORY
# ============================================================

def load_history():

    if not INPUT_FILE.exists():

        raise FileNotFoundError(
            f"Historical dataset not found:\n{INPUT_FILE}"
        )

    df = pd.read_csv(
        INPUT_FILE
    )

    df["timestamp"] = pd.to_datetime(
        df["timestamp"],
        errors="coerce"
    )

    df["demand_mw"] = pd.to_numeric(
        df["demand_mw"],
        errors="coerce"
    )

    df = df.dropna(
        subset=[
            "timestamp",
            "demand_mw",
        ]
    )

    df = df.sort_values(
        "timestamp"
    ).reset_index(
        drop=True
    )

    return df


# ============================================================
# GET NEXT OBSERVATION SLOT
# ============================================================

def get_next_slot(timestamp):

    timestamp = pd.Timestamp(
        timestamp
    )

    current_date = timestamp.date()

    for slot in OBSERVATION_SLOTS:

        candidate = pd.Timestamp(
            f"{current_date} "
            f"{slot['hour']:02d}:00:00",
            tz="Asia/Kolkata"
        )

        if candidate > timestamp:

            return candidate, slot

    next_date = (
        timestamp.normalize()
        + timedelta(days=1)
    )

    slot = OBSERVATION_SLOTS[0]

    candidate = pd.Timestamp(
        f"{next_date.date()} "
        f"{slot['hour']:02d}:00:00",
        tz="Asia/Kolkata"
    )

    return candidate, slot


# ============================================================
# BUILD FEATURES
# ============================================================

def build_features(
    history,
    target_timestamp,
    slot,
):

    demand_values = (
        history["demand_mw"]
        .astype(float)
        .tolist()
    )

    if len(demand_values) < 28:

        raise ValueError(
            "Not enough historical observations "
            "to create forecast features."
        )

    lag_1 = demand_values[-1]

    lag_4 = demand_values[-4]

    lag_8 = demand_values[-8]

    lag_28 = demand_values[-28]

    previous_values = demand_values[:-0]

    rolling_source = (
        demand_values
    )

    rolling_mean_4 = (
        pd.Series(
            rolling_source
        )
        .tail(4)
        .mean()
    )

    rolling_mean_7 = (
        pd.Series(
            rolling_source
        )
        .tail(7)
        .mean()
    )

    rolling_std_7 = (
        pd.Series(
            rolling_source
        )
        .tail(7)
        .std()
    )

    day_of_week = (
        target_timestamp.dayofweek
    )

    day_of_month = (
        target_timestamp.day
    )

    month = (
        target_timestamp.month
    )

    is_weekend = int(
        day_of_week >= 5
    )

    feature_row = pd.DataFrame(
        [
            {
                "observation_type_encoded":
                    slot[
                        "observation_type_encoded"
                    ],

                "hour":
                    slot["hour"],

                "day_of_week":
                    day_of_week,

                "day_of_month":
                    day_of_month,

                "month":
                    month,

                "is_weekend":
                    is_weekend,

                "lag_1":
                    lag_1,

                "lag_4":
                    lag_4,

                "lag_8":
                    lag_8,

                "lag_28":
                    lag_28,

                "rolling_mean_4":
                    rolling_mean_4,

                "rolling_mean_7":
                    rolling_mean_7,

                "rolling_std_7":
                    rolling_std_7,
            }
        ]
    )

    return feature_row


# ============================================================
# PREDICT NEXT OBSERVATIONS
# ============================================================

def predict_future_observations(
    model,
    feature_columns,
    history,
    number_of_predictions=8,
):

    forecast_history = history.copy()

    forecasts = []

    latest_timestamp = (
        forecast_history[
            "timestamp"
        ].iloc[-1]
    )

    current_timestamp = (
        latest_timestamp
    )

    for _ in range(
        number_of_predictions
    ):

        target_timestamp, slot = (
            get_next_slot(
                current_timestamp
            )
        )

        features = build_features(
            history=forecast_history,
            target_timestamp=target_timestamp,
            slot=slot,
        )

        features = features[
            feature_columns
        ]

        predicted_demand = float(
            model.predict(
                features
            )[0]
        )

        forecast_record = {
            "timestamp":
                target_timestamp,

            "demand_mw":
                predicted_demand,

            "observation_type":
                slot[
                    "observation_type"
                ],

            "is_prediction":
                True,
        }

        forecasts.append(
            forecast_record
        )

        forecast_history = pd.concat(
            [
                forecast_history,
                pd.DataFrame(
                    [forecast_record]
                ),
            ],
            ignore_index=True,
        )

        current_timestamp = (
            target_timestamp
        )

    return pd.DataFrame(
        forecasts
    )


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 70)
    print(
        "PEAKSENSE MUMBAI FORECAST ENGINE"
    )
    print("=" * 70)

    print("\nLoading model...")

    artifact = load_model()

    model = artifact["model"]

    feature_columns = artifact[
        "feature_columns"
    ]

    print(
        f"Model: "
        f"{artifact['model_name']}"
    )

    print("\nLoading history...")

    history = load_history()

    print(
        f"Historical observations: "
        f"{len(history)}"
    )

    print(
        f"Latest observation: "
        f"{history['timestamp'].iloc[-1]}"
    )

    print("\nGenerating forecasts...")

    forecasts = (
        predict_future_observations(
            model=model,
            feature_columns=feature_columns,
            history=history,
            number_of_predictions=8,
        )
    )

    print("\n" + "=" * 70)
    print("FORECAST RESULTS")
    print("=" * 70)

    display = forecasts.copy()

    display["timestamp"] = (
        display["timestamp"]
        .astype(str)
    )

    display["demand_mw"] = (
        display["demand_mw"]
        .round(2)
    )

    print(
        display[
            [
                "timestamp",
                "observation_type",
                "demand_mw",
            ]
        ].to_string(
            index=False
        )
    )

    print("\n" + "=" * 70)
    print("DONE")
    print("=" * 70)


if __name__ == "__main__":

    main()