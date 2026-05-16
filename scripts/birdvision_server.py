#!/usr/bin/env python3
"""
Bird vision server — proxies to iNaturalist computer vision API.

iNaturalist combines image recognition with geographic frequency data,
giving much better results than a standalone image classifier.

Setup:
    1. Log in to iNaturalist, then visit:
       https://www.inaturalist.org/users/api_token
       Copy the token shown there.
    2. Set it as a Cloud Run env var:
       gcloud run services update birdvision --set-env-vars INAT_TOKEN=<your-token>

    pip install -r requirements.birdvision.txt

Run locally:
    INAT_TOKEN=xxx python scripts/birdvision_server.py

Endpoint:
    POST /identify
    Content-Type: multipart/form-data
    Authorization: Bearer <firebase-id-token>
    file:  image (JPEG/PNG)
    lat:   float
    lng:   float
    date:  YYYY-MM-DD (optional)

    200 response:
    {
        "results": [
            { "common_name": "American Robin", "scientific_name": "Turdus migratorius", "confidence": 0.91 }
        ]
    }
"""

import os
import time
from collections import defaultdict, deque

import firebase_admin
import httpx
import uvicorn
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import auth as fb_auth

firebase_admin.initialize_app(options={"projectId": "birding-app-1a446"})

INAT_TOKEN      = os.environ.get("INAT_TOKEN", "")
INAT_ENDPOINT   = "https://api.inaturalist.org/v1/computervision/score_image"
AVES_TAXON_ID   = 3       # iNaturalist taxon ID for birds
RATE_LIMIT      = 10
RATE_WINDOW_SEC = 60
MAX_IMAGE_BYTES = 10 * 1024 * 1024

app = FastAPI(title="Bird Vision Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

_rate_counters: dict[str, deque] = defaultdict(deque)


def check_rate_limit(uid: str) -> None:
    now = time.monotonic()
    window = _rate_counters[uid]
    while window and window[0] < now - RATE_WINDOW_SEC:
        window.popleft()
    if len(window) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many requests — try again in a minute.")
    window.append(now)


@app.get("/health")
def health():
    return {"status": "ok", "inat_token_set": bool(INAT_TOKEN)}


async def verify_token(authorization: str = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    try:
        decoded = fb_auth.verify_id_token(authorization[7:])
        return decoded["uid"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@app.post("/identify")
async def identify(
    file: UploadFile = File(...),
    lat: float = Form(0.0),
    lng: float = Form(0.0),
    date: str = Form(""),
    uid: str = Depends(verify_token),
):
    check_rate_limit(uid)

    if not INAT_TOKEN:
        raise HTTPException(status_code=503, detail="INAT_TOKEN env var not set.")

    img_bytes = await file.read()
    if len(img_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB).")

    params: dict = {"taxon_id": AVES_TAXON_ID}
    if lat or lng:
        params["lat"] = lat
        params["lng"] = lng
    if date:
        params["observed_on"] = date

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            INAT_ENDPOINT,
            files={"image": ("photo.jpg", img_bytes, file.content_type or "image/jpeg")},
            data=params,
            headers={"Authorization": f"Bearer {INAT_TOKEN}"},
        )

    if not resp.is_success:
        raise HTTPException(status_code=502, detail=f"iNaturalist error {resp.status_code}")

    raw = resp.json().get("results", [])
    results = [
        {
            "common_name":     r["taxon"].get("preferred_common_name") or r["taxon"]["name"],
            "scientific_name": r["taxon"]["name"],
            "confidence":      round(float(r.get("combined_score", 0)) / 100, 4),
        }
        for r in raw
        if r.get("taxon", {}).get("iconic_taxon_name") == "Aves"
    ][:5]

    return {"results": results}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
