"""
Gemini API service for the natural-language ask bar.
The model is given live risk data as context and instructed to answer
only from that data — it should never invent flood points not in the dataset.
"""

import os
import json
import httpx
from pathlib import Path

# Load .env file manually if it exists
env_file = Path(__file__).parent / ".env"
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

SYSTEM_PROMPT = """You are a Mumbai waterlogging assistant embedded in the Rasta Radar commute advisory tool.
You will be given a JSON array of currently scored flood spots in Mumbai.
Answer the user's question ONLY using the data provided. Rules:
- Never invent a flood spot that is not in the provided data.
- Be concise and direct — commuters need a quick answer.
- Always mention the risk level (low / moderate / high) when referring to a specific spot.
- If the user asks about a location not in the data, say: "I don't have data for that location."
- Do not speculate about future conditions beyond what the score and forecast data show.
- End your answer with one practical line of advice for the commuter.
"""


async def ask_gemini(question: str, spots_context: list[dict]) -> str:
    if GEMINI_API_KEY:
        try:
            context_str = json.dumps(spots_context, indent=2)
            full_prompt = (
                f"Current flood spot risk data:\n{context_str}\n\n"
                f"User question: {question}"
            )

            payload = {
                "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                "contents": [{"parts": [{"text": full_prompt}]}],
                "generationConfig": {"maxOutputTokens": 300, "temperature": 0.2},
            }

            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(
                    GEMINI_URL,
                    params={"key": GEMINI_API_KEY},
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception:
            # Fall back gracefully to local rule-based response generator when rate-limited or offline
            pass

    # --- SMART LOCAL FALLBACK ADVISORY ENGINE ---
    q_lower = question.lower()
    
    # 1. Location match check
    matched_spots = []
    for spot in spots_context:
        spot_name = spot.get("name", "").lower()
        spot_area = spot.get("area", "").lower()
        # strip common suffixes to matching
        base_name = spot_name.replace("junction", "").replace("cinema", "").replace("subway", "").strip()
        if base_name in q_lower or spot_area in q_lower:
            matched_spots.append(spot)
            
    if matched_spots:
        lines = []
        for s in matched_spots:
            lines.append(f"• **{s['name']}** ({s['area']}) is at **{s['risk_level'].upper()}** risk with a score of {s['risk_score']}. *{s['leave_by']}*")
        return (
            "Here is the live status for the requested location(s):\n\n" + 
            "\n".join(lines) + 
            "\n\nAdvisory: Avoid passing through low-lying subways if rainfall intensifies."
        )

    # 2. Highway safety comparison (WEH vs EEH)
    if "weh" in q_lower or "western express" in q_lower or "eeh" in q_lower or "eastern express" in q_lower:
        weh_score = 0
        eeh_score = 0
        weh_spots = []
        eeh_spots = []
        for spot in spots_context:
            name = spot.get("name", "").lower()
            if any(k in name for k in ["subway", "andheri", "milan", "dahisar"]):
                weh_score = max(weh_score, spot.get("risk_score", 0))
                weh_spots.append(spot.get("name"))
            if any(k in name for k in ["sion", "hindmata", "kurla", "king"]):
                eeh_score = max(eeh_score, spot.get("risk_score", 0))
                eeh_spots.append(spot.get("name"))
                
        if weh_score > eeh_score:
            return (
                "Based on current telemetry, the **Eastern Express Highway (EEH)** is currently **SAFER** than the Western Express Highway (WEH). "
                f"WEH has active high-risk points (e.g. {', '.join(weh_spots[:2])}) with a peak risk score of {weh_score}. "
                "Advisory: Commuters traveling North-South should prioritize EEH routes."
            )
        else:
            return (
                "Based on current telemetry, the **Western Express Highway (WEH)** is currently **SAFER** than the Eastern Express Highway (EEH). "
                f"EEH has active high-risk points (e.g. {', '.join(eeh_spots[:2])}) with a peak risk score of {eeh_score}. "
                "Advisory: Commuters traveling North-South should prioritize WEH routes."
            )

    # 3. List active high-risk zones
    high_spots = [s for s in spots_context if s.get("risk_level", "").lower() == "high"]
    if any(k in q_lower for k in ["high", "worst", "active", "list", "where", "what", "flooded"]):
        if high_spots:
            lines = [f"• **{s['name']}** ({s['area']}): Risk Score {s['risk_score']}" for s in high_spots]
            return (
                "Currently, the following zones are monitored at **HIGH RISK**:\n\n" + 
                "\n".join(lines) + 
                "\n\nAdvisory: Avoid these flooded intersections and plan alternative transits."
            )
        else:
            return "There are no active high-risk waterlogging zones reported in our database at this moment. Advisory: Monitor local bulletins for updates."

    # 4. General fallback response
    high_count = len(high_spots)
    mod_count = len([s for s in spots_context if s.get("risk_level", "").lower() == "moderate"])
    return (
        f"Hello! I am your Rasta Radar AI Assistant. Currently, there are **{high_count} HIGH risk** and **{mod_count} MODERATE risk** flood spots active in Mumbai. "
        "You can ask me about specific locations (e.g. 'Is Andheri Subway passable?') or route safety (e.g. 'WEH vs EEH safety'). "
        "Advisory: Stay updated on active rainfall and tide forecasts before starting your commute."
    )

