import hashlib
import hmac
import os
from pathlib import Path
from xml.sax.saxutils import escape

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, Response

load_dotenv()
app = FastAPI(title="NexziByte Voice Reminder Service", version="1.0.0")
AUDIO_DIR = Path(__file__).parent / "generated_audio"
AUDIO_DIR.mkdir(exist_ok=True)


def authorize(token: str) -> None:
    expected = os.getenv("VOICE_SERVICE_TOKEN", "")
    if not expected or not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="Invalid voice-service token")


@app.get("/health")
def health():
    return {"ok": True, "provider": "elevenlabs" if os.getenv("ELEVENLABS_API_KEY") else "twilio-say-fallback"}


@app.get("/twiml")
async def twiml(token: str = Query(...), text: str = Query(..., min_length=5, max_length=1200)):
    authorize(token)
    api_key = os.getenv("ELEVENLABS_API_KEY", "")
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "")
    public_base = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
    if not api_key or not voice_id or not public_base:
        xml = f'<Response><Say voice="alice" language="en-IN">{escape(text)}</Say></Response>'
        return Response(xml, media_type="application/xml")

    key = hashlib.sha256(f"{voice_id}:{text}".encode()).hexdigest()
    output = AUDIO_DIR / f"{key}.mp3"
    if not output.exists():
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        payload = {
            "text": text,
            "model_id": os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"),
            "voice_settings": {"stability": 0.58, "similarity_boost": 0.78, "style": 0.18, "use_speaker_boost": True},
        }
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(url, headers={"xi-api-key": api_key, "accept": "audio/mpeg", "content-type": "application/json"}, json=payload)
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"Voice provider error: {response.text[:300]}")
        output.write_bytes(response.content)
    audio_url = f"{public_base}/audio/{key}.mp3?token={token}"
    return Response(f"<Response><Play>{escape(audio_url)}</Play></Response>", media_type="application/xml")


@app.get("/audio/{filename}")
def audio(filename: str, token: str = Query(...)):
    authorize(token)
    if not filename.endswith(".mp3") or Path(filename).name != filename:
        raise HTTPException(status_code=400, detail="Invalid audio name")
    path = AUDIO_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(path, media_type="audio/mpeg", filename=filename)

