"""
Risk scoring heuristic for Mumbai flood spots.
Formula: rainfall_3h * 0.6 + severity * 0.3 * 20 + tide_bonus * 0.1 * 100
This is NOT a calibrated ML model — it is a transparent heuristic.
"""

from datetime import datetime, timezone
import math


# Approximate Mumbai high tide reference points (IST).
# Two high tides per day, ~12h25m apart.
# Reference high tide: 2025-06-15 05:30 IST → used to compute rolling schedule.
# TODO: replace with IMD tide table API when/if it becomes available.
TIDE_PERIOD_MINUTES = 745  # 12h 25m in minutes
REFERENCE_HIGH_TIDE_IST = datetime(2025, 6, 15, 5, 30, tzinfo=timezone.utc)

# Mumbai's tidal range means both peaks and troughs influence drainage backwater.
# We treat proximity to high tide as the primary risk window.
TIDE_ACTIVE_WINDOW_MINUTES = 120  # ±2 hours around high tide


def minutes_to_next_high_tide(now_utc: datetime) -> float:
    """Return minutes until the next Mumbai high tide."""
    elapsed = (now_utc - REFERENCE_HIGH_TIDE_IST).total_seconds() / 60
    phase = elapsed % TIDE_PERIOD_MINUTES
    minutes_until_next = TIDE_PERIOD_MINUTES - phase
    return minutes_until_next


def tide_proximity_bonus(now_utc: datetime) -> float:
    """
    Returns:
      - 1.0 if within ±2 hours (120 min) of a high tide (increases flood risk)
      - -0.5 if within ±2 hours (120 min) of a low tide (decreases flood risk)
      - 0.0 otherwise
    Checks both next and previous tide states.
    """
    mins_to_next = minutes_to_next_high_tide(now_utc)
    mins_since_last = TIDE_PERIOD_MINUTES - mins_to_next

    # High tide window check (high tide occurs at 0 and TIDE_PERIOD_MINUTES)
    if mins_to_next <= TIDE_ACTIVE_WINDOW_MINUTES or mins_since_last <= TIDE_ACTIVE_WINDOW_MINUTES:
        return 1.0

    # Low tide window check (low tide occurs halfway, at TIDE_PERIOD_MINUTES / 2)
    low_tide_center = TIDE_PERIOD_MINUTES / 2
    if abs(mins_to_next - low_tide_center) <= TIDE_ACTIVE_WINDOW_MINUTES:
        return -0.5

    return 0.0


def compute_risk_score(rainfall_3h_mm: float, historical_severity: int, now_utc: datetime) -> dict:
    """
    Compute a 0-100 risk score for a flood spot.

    Components:
      - Rainfall last 3h (mm) × 0.6  → dominates when rain is heavy
      - Historical severity (1-5) × 0.3 × 20 → max 30 points for severity=5
      - Tide proximity bonus (0, 1 or -0.5) × 0.1 × 100 → up to 10 points if near high tide, -5 if near low tide

    Raw score can exceed 100 in extreme events; capped at 100 and minimum 0.
    """
    tide_bonus = tide_proximity_bonus(now_utc)

    rainfall_component = rainfall_3h_mm * 0.6
    severity_component = historical_severity * 0.3 * 20
    tide_component = tide_bonus * 0.1 * 100

    raw = rainfall_component + severity_component + tide_component
    score = max(0.0, min(round(raw, 1), 100.0))

    if score < 33:
        level = "low"
    elif score < 67:
        level = "moderate"
    else:
        level = "high"

    # Map tide bonus to descriptive state string
    if tide_bonus == 1.0:
        tide_state = "high"
    elif tide_bonus == -0.5:
        tide_state = "low"
    else:
        tide_state = "normal"

    return {
        "score": score,
        "level": level,
        "components": {
            "rainfall_mm_3h": round(rainfall_3h_mm, 2),
            "rainfall_contribution": round(rainfall_component, 1),
            "severity_contribution": round(severity_component, 1),
            "tide_contribution": round(tide_component, 1),
            "tide_active": tide_bonus == 1.0,
            "tide_state": tide_state,
        },
    }


def compute_leave_by(score: float, level: str, spot: dict = None) -> str:
    """Plain-English guidance based on risk score band and spot characteristics."""
    if not spot:
        # Fallback to generic text if spot is not provided
        if level == "high":
            if score >= 90:
                return "CRITICAL: Severe waterlogging (>2 feet). High risk of vehicle damage and stranding. Do not travel."
            elif score >= 80:
                return "HIGH RISK: Significant flooding in low-lying areas. Subways are closed or unsafe. Avoid low-ground routes."
            else:
                return "AVOID ROUTE: Water accumulation starting. High probability of gridlock. Allow 60+ min extra or find detours."
        elif level == "moderate":
            if score >= 50:
                return "PROCEED WITH CAUTION: Slow traffic and water pooling. SUVs/large vehicles preferred. Allow 30-45 min extra."
            else:
                return "WATCH OUT: Roadside pooling and minor slow-downs. Commute is passable but expect delays near low-lying points."
        else:
            if score >= 15:
                return "MINIMAL RISK: Roads are clear. Monitor local weather updates if heavy rain persists."
            else:
                return "SAFE: Clear roads and safe driving conditions. Travel normally."

    name = spot.get("name", "Area")
    name_lower = name.lower()
    desc_lower = spot.get("description", "").lower()

    # Determine spot type
    if "subway" in name_lower or "subway" in desc_lower or "underpass" in name_lower:
        spot_type = "subway"
    elif "junction" in name_lower or "circle" in name_lower or "crossing" in name_lower or "tt" in name_lower:
        spot_type = "junction"
    elif "highway" in name_lower or "express" in name_lower or "link" in name_lower or "flyover" in name_lower:
        spot_type = "highway"
    else:
        spot_type = "road"

    if level == "high":
        if spot_type == "subway":
            if score >= 90:
                return f"CRITICAL: {name} subway is completely submerged and impassable. Do not attempt to cross."
            elif score >= 80:
                return f"HIGH RISK: {name} subway flooding. Pumping failed. Subway is closed to all passenger vehicles."
            else:
                return f"AVOID ROUTE: Fast-rising water at {name} subway. Detour now to avoid being stranded."
        elif spot_type == "junction":
            if score >= 90:
                return f"CRITICAL: Complete gridlock at {name} junction. Vehicles are stranded. Avoid entirely."
            elif score >= 80:
                return f"HIGH RISK: Deep waterlogging at {name} junction. High-clearance vehicles only. Heavy delays."
            else:
                return f"AVOID ROUTE: Junction water accumulation at {name}. Major traffic backlog forming."
        else:  # highway/road
            if score >= 90:
                return f"CRITICAL: Severe flooding (>2 feet) on {name}. Road is blocked. Do not travel."
            elif score >= 80:
                return f"HIGH RISK: Major lanes on {name} are underwater. Dangerous driving conditions. Avoid."
            else:
                return f"AVOID ROUTE: Waterlogging starting on {name}. High chance of multi-hour traffic delays."

    elif level == "moderate":
        if spot_type == "subway":
            if score >= 50:
                return f"PROCEED WITH CAUTION: Active pumping at {name} subway. Water on road. Allow 30+ min buffer."
            else:
                return f"WATCH OUT: Runoff draining into {name} subway. Passable with care; small cars should monitor depth."
        elif spot_type == "junction":
            if score >= 50:
                return f"PROCEED WITH CAUTION: Slow crawl at {name} due to water pooling. Allow 30-45 min extra."
            else:
                return f"WATCH OUT: Moderate water pooling near {name}. Passable but expect slow-moving queues."
        else:  # highway/road
            if score >= 50:
                return f"PROCEED WITH CAUTION: Low lanes flooded on {name}. Stick to middle/fast lanes. Slow traffic."
            else:
                return f"WATCH OUT: Roadside water pooling on {name}. Drains are slow. Passable with care."

    else:  # low
        if score >= 15:
            return f"MINIMAL RISK: {name} is clear. Minor pooling on shoulders. Safe to drive normally."
        else:
            return f"SAFE: {name} road conditions are normal. Safe to travel."
