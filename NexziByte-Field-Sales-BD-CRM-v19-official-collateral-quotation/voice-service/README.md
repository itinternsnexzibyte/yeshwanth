# NexziByte Python Voice Service

This service generates the spoken reminder content used by the CRM. Twilio is
still the telephone carrier. ElevenLabs supplies the natural voice when its API
key and voice ID are configured; otherwise Twilio text-to-speech is returned.

## Run locally

```cmd
copy .env.example .env
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 4100
```

Twilio must reach the service over public HTTPS. During development, expose
port 4100 with an approved tunnel and set `PUBLIC_BASE_URL` and the backend's
`VOICE_SERVICE_PUBLIC_URL` to that HTTPS address.

## Custom voice model

ElevenLabs custom voices require the speaker's permission. For a future local
model, add consented WAV and TXT pairs under `dataset/wavs`, run
`python train_voice.py`, and use the produced `metadata.csv` with a reviewed
Coqui/Piper training pipeline on a suitable GPU. No voice is cloned or trained
silently by this project.
