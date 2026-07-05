"""
Gemini API service for the natural-language ask bar.
The model is given live risk data as context and instructed to answer
only from that data — it should never invent flood points not in the dataset.
"""

import os
import json
import httpx

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
    if not GEMINI_API_KEY:
        # Graceful fallback when key is not configured
        return (
            "The AI ask bar is not configured (missing GEMINI_API_KEY). "
            "Check the map and ranked list for current risk levels."
        )

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

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            GEMINI_URL,
            params={"key": GEMINI_API_KEY},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    try:
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError):
        return "Could not parse response from Gemini. Please try again."
