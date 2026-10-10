#!/usr/bin/env python3
"""
BirdNET identification server — wraps birdnetlib with a minimal REST API.

Setup:
    pip install birdnetlib fastapi uvicorn httpx
    brew install ffmpeg        # macOS
    # apt install ffmpeg       # Linux

Run:
    python scripts/birdnet_server.py
    # Listens on http://0.0.0.0:8080

Endpoint:
    POST /analyze
    Content-Type: application/json
    {
        "url":            "https://...",   # downloadable audio (Firebase Storage URL)
        "lat":            43.07,
        "lon":           -89.40,
        "date":           "2025-05-15",    # YYYY-MM-DD
        "min_confidence": 0.1
    }

    200 response:
    {
        "results": [
            { "common_name": "...", "scientific_name": "...", "confidence": 0.87 }
        ]
    }

Deploy:
    Works on any box with Python 3.9+ and ffmpeg.
    For cloud: Railway, Fly.io, Render (free tier), or a small VPS.
    Set the public URL as BIRDNET_ENDPOINT in lib/birdnet.ts.
"""

import os
import shutil
import subprocess
import tempfile

import firebase_admin
import uvicorn
from birdnetlib import Recording
from birdnetlib.analyzer import Analyzer
from datetime import datetime
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import auth as fb_auth

# Tokens are accepted from every Firebase project listed here, because the app
# has separate dev and prod projects (see docs/RELEASE.md) and verify_id_token
# only accepts tokens whose `aud` matches the app it was initialised with. A
# single hardcoded project meant dev builds got a bare 401 from every
# identification call. Override with FIREBASE_PROJECT_IDS=a,b at deploy time.
FIREBASE_PROJECT_IDS = [
    p.strip()
    for p in os.environ.get(
        "FIREBASE_PROJECT_IDS", "birding-app-1a446,birdapp-dev-birdleague"
    ).split(",")
    if p.strip()
]

_fb_apps = {
    pid: firebase_admin.initialize_app(name=pid, options={"projectId": pid})
    for pid in FIREBASE_PROJECT_IDS
}

app = FastAPI(title="BirdNET Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

print("Loading BirdNET model…")
analyzer = Analyzer()
print("Model ready.")


@app.get("/health")
def health():
    return {"status": "ok"}


async def verify_token(authorization: str = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization[7:]
    for fb_app in _fb_apps.values():
        try:
            fb_auth.verify_id_token(token, app=fb_app)
            return
        except Exception:
            continue
    raise HTTPException(status_code=401, detail="Invalid or expired token")


@app.post("/analyze", dependencies=[Depends(verify_token)])
async def analyze(
    file: UploadFile = File(...),
    lat: float = Form(0.0),
    lon: float = Form(0.0),
    date: str = Form(""),
    min_confidence: float = Form(0.1),
):
    dt = None
    if date:
        try:
            dt = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            pass

    with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as f:
        shutil.copyfileobj(file.file, f)
        m4a_path = f.name

    wav_path = m4a_path.replace(".m4a", ".wav")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", m4a_path, "-ar", "48000", "-ac", "1", wav_path],
            check=True,
            capture_output=True,
        )
        recording = Recording(
            analyzer,
            wav_path,
            lat=lat,
            lon=lon,
            date=dt,
            min_conf=min_confidence,
        )
        recording.analyze()
    finally:
        os.unlink(m4a_path)
        if os.path.exists(wav_path):
            os.unlink(wav_path)

    results = [
        {
            "common_name":     d["common_name"],
            "scientific_name": d["scientific_name"],
            "confidence":      round(float(d["confidence"]), 4),
        }
        for d in recording.detections
    ]

    return {"results": results}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
