"""Natural-language search. Gemini ONLY turns a sentence into filters.
Availability is then checked against the real bookings table (services.free_rooms)."""
import json
import os
import urllib.error
import urllib.request

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

PROMPT = """You convert a faculty member's room request into JSON filters for a campus room booking system.
Today's date is {today}. Campus time is IST. Return ONLY JSON with these keys (use null if unknown):
{{
  "date": "YYYY-MM-DD",
  "start_time": "HH:MM" (24h),
  "end_time": "HH:MM" (24h),
  "duration_minutes": integer or null,
  "min_capacity": integer or null,
  "building": "IET" | "Deeksha Bhawan" | null,
  "floor": integer or null (0 = ground),
  "room_type": "classroom" | "lab" | "seminar_hall" | "library" | null,
  "purpose": "extra_class" | "minor_exam" | "practical" | "event" | null
}}
Request: {query}"""


class AIUnavailable(Exception):
    pass


def parse_request(query: str, today: str) -> dict:
    if not GEMINI_API_KEY:
        raise AIUnavailable("GEMINI_API_KEY is not set on the server")
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}")
    body = {
        "contents": [{"parts": [{"text": PROMPT.format(today=today, query=query)}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0},
    }
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)
    except (urllib.error.URLError, KeyError, IndexError, json.JSONDecodeError) as e:
        raise AIUnavailable(f"AI request failed: {e}")
