"""
PeakSense Deterministic Peak Detection Engine.

Analyzes forecasted electricity demand time series against locality capacity thresholds,
identifies peak strain periods, calculates exceedance, assigns calibrated risk levels,
and estimates statistical exceedance probabilities.
"""

from typing import List, Optional, Tuple
import math
from app.schemas.forecast import ForecastPoint, PeakAnalysis, RiskLevel


def normal_cdf(x: float) -> float:
    """Standard normal cumulative distribution function (CDF)."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def analyze_peak(
    points: List[ForecastPoint],
    threshold_mw: float,
    residual_std: float = 6.5,
) -> PeakAnalysis:
    """
    Perform deterministic peak detection across a series of forecast points.

    Risk Level Classification Rules:
    - CRITICAL: peak_mw >= 1.05 * threshold_mw (severe grid strain / overload risk)
    - HIGH:     1.00 * threshold_mw <= peak_mw < 1.05 * threshold_mw (threshold breached)
    - MEDIUM:   0.90 * threshold_mw <= peak_mw < 1.00 * threshold_mw (near capacity / alert)
    - LOW:      peak_mw < 0.90 * threshold_mw (safe operating buffer)
    """
    if not points:
        return PeakAnalysis(
            peak_mw=0.0,
            peak_time="00:00",
            threshold_mw=threshold_mw,
            risk=RiskLevel.LOW,
            probability=0.0,
            exceedance_mw=0.0,
            peak_window="N/A",
        )

    # Find max predicted peak
    max_point = max(points, key=lambda p: p.predicted_mw)
    peak_mw = round(float(max_point.predicted_mw), 1)

    # Format peak time (either HH:MM or ISO timestamp substring)
    raw_ts = max_point.timestamp
    if "T" in raw_ts:
        time_part = raw_ts.split("T")[1][:5]
    else:
        time_part = raw_ts[-8:-3] if len(raw_ts) >= 8 else raw_ts

    peak_time = time_part

    # Calculate exceedance
    exceedance_mw = max(0.0, round(peak_mw - threshold_mw, 1))

    # Determine risk level
    if peak_mw >= 1.05 * threshold_mw:
        risk = RiskLevel.CRITICAL
    elif peak_mw >= 1.00 * threshold_mw:
        risk = RiskLevel.HIGH
    elif peak_mw >= 0.90 * threshold_mw:
        risk = RiskLevel.MEDIUM
    else:
        risk = RiskLevel.LOW

    # Calculate statistical probability of exceeding threshold
    # P(Demand > Threshold) where Demand ~ N(peak_mw, residual_std^2)
    std = max(1.0, residual_std)
    z_score = (peak_mw - threshold_mw) / std
    raw_prob = normal_cdf(z_score)
    # Clip probability between 0.01 and 0.99 for numerical stability
    probability = round(max(0.01, min(0.99, raw_prob)), 2)

    # Compute peak window (consecutive points where demand >= 90% of threshold or >= 95% of peak)
    high_strain_threshold = max(0.90 * threshold_mw, 0.95 * peak_mw)
    strain_points = [p for p in points if p.predicted_mw >= high_strain_threshold]

    if strain_points:
        start_ts = strain_points[0].timestamp
        end_ts = strain_points[-1].timestamp
        start_time = start_ts.split("T")[1][:5] if "T" in start_ts else start_ts[:5]
        end_time = end_ts.split("T")[1][:5] if "T" in end_ts else end_ts[:5]
        if start_time == end_time:
            peak_window = f"{start_time}"
        else:
            peak_window = f"{start_time} - {end_time}"
    else:
        peak_window = f"{peak_time}"

    return PeakAnalysis(
        peak_mw=peak_mw,
        peak_time=peak_time,
        threshold_mw=round(threshold_mw, 1),
        risk=risk,
        probability=probability,
        exceedance_mw=exceedance_mw,
        peak_window=peak_window,
    )
