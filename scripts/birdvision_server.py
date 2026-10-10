#!/usr/bin/env python3
"""
Bird vision server — proxies to iNaturalist computer vision API.

Token setup (OAuth2 ROPC — the server refreshes its own token):
    1. Register an app at https://www.inaturalist.org/oauth/applications/new
    2. Set four env vars on the service:
       gcloud run services update birdvision --region us-central1 \
         --set-env-vars INAT_CLIENT_ID=...,INAT_CLIENT_SECRET=...,INAT_USERNAME=...,INAT_PASSWORD=...

The previous setup was a hand-pasted INAT_TOKEN from /users/api_token. That
JWT expires after 24 h, so photo identification broke a day after every deploy
and stayed broken — silently, since the failure is a 502 from this proxy with
no alerting behind it. INAT_TOKEN is still honoured as a fallback when the
OAuth vars are absent, but it should not be relied on.

Run locally:
    INAT_CLIENT_ID=... INAT_CLIENT_SECRET=... INAT_USERNAME=... INAT_PASSWORD=... \
      python scripts/birdvision_server.py

Endpoint:
    POST /identify
    Content-Type: multipart/form-data
    Authorization: Bearer <firebase-id-token>
    file:  image (JPEG/PNG)
    lat:   float
    lng:   float
    date:  YYYY-MM-DD (optional)
"""

import asyncio
import os
import time
from collections import defaultdict, deque

import firebase_admin
import httpx
import uvicorn
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

INAT_TOKEN      = os.environ.get("INAT_TOKEN", "")
INAT_ENDPOINT   = "https://api.inaturalist.org/v1/computervision/score_image"
AVES_TAXON_ID   = 3
RATE_LIMIT      = 10
RATE_WINDOW_SEC = 60
MAX_IMAGE_BYTES = 10 * 1024 * 1024

# OAuth2 (ROPC). A hand-pasted INAT_TOKEN is a JWT that dies after 24h, so the
# service was only ever one day from breaking — and did, silently, for 40 days.
# With these set, the server fetches and caches its own api_token instead.
INAT_CLIENT_ID     = os.environ.get("INAT_CLIENT_ID", "")
INAT_CLIENT_SECRET = os.environ.get("INAT_CLIENT_SECRET", "")
INAT_USERNAME      = os.environ.get("INAT_USERNAME", "")
INAT_PASSWORD      = os.environ.get("INAT_PASSWORD", "")
INAT_OAUTH_URL     = "https://www.inaturalist.org/oauth/token"
INAT_APITOKEN_URL  = "https://www.inaturalist.org/users/api_token"

# iNaturalist's api_token JWT lasts ~24h; refresh well before the edge.
_TOKEN_TTL_SEC = 20 * 3600
_token_cache: dict[str, float | str] = {"value": "", "expires_at": 0.0}
_token_lock = asyncio.Lock()


def _oauth_configured() -> bool:
    return all([INAT_CLIENT_ID, INAT_CLIENT_SECRET, INAT_USERNAME, INAT_PASSWORD])


async def get_inat_token() -> str:
    """
    Current iNaturalist api_token, refreshed on demand.

    Falls back to a manually set INAT_TOKEN when OAuth is not configured, so
    this stays backwards compatible with the old deploy.
    """
    if not _oauth_configured():
        if not INAT_TOKEN:
            raise HTTPException(
                status_code=503,
                detail="iNaturalist credentials not configured (set INAT_CLIENT_ID/SECRET/USERNAME/PASSWORD).",
            )
        return INAT_TOKEN

    now = time.time()
    cached = _token_cache
    if cached["value"] and float(cached["expires_at"]) > now:
        return str(cached["value"])

    # Single-flight: a burst of requests on a cold container must not trigger
    # a burst of login attempts, which iNaturalist would rate-limit.
    async with _token_lock:
        if _token_cache["value"] and float(_token_cache["expires_at"]) > time.time():
            return str(_token_cache["value"])

        async with httpx.AsyncClient(timeout=30) as client:
            oauth_resp = await client.post(
                INAT_OAUTH_URL,
                data={
                    "client_id": INAT_CLIENT_ID,
                    "client_secret": INAT_CLIENT_SECRET,
                    "grant_type": "password",
                    "username": INAT_USERNAME,
                    "password": INAT_PASSWORD,
                },
            )
            if not oauth_resp.is_success:
                raise HTTPException(
                    status_code=502,
                    detail=f"iNaturalist OAuth failed ({oauth_resp.status_code})",
                )
            access_token = oauth_resp.json().get("access_token", "")

            # The OAuth access_token is not accepted by the vision API; it has
            # to be exchanged for a short-lived api_token JWT.
            api_resp = await client.get(
                INAT_APITOKEN_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if not api_resp.is_success:
                raise HTTPException(
                    status_code=502,
                    detail=f"iNaturalist api_token fetch failed ({api_resp.status_code})",
                )
            jwt = api_resp.json().get("api_token", "")

        if not jwt:
            raise HTTPException(status_code=502, detail="iNaturalist returned no api_token")

        _token_cache["value"] = jwt
        _token_cache["expires_at"] = time.time() + _TOKEN_TTL_SEC
        return jwt


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
    return {"status": "ok", "inat_auth": "oauth" if _oauth_configured() else ("static-token" if INAT_TOKEN else "unconfigured")}


async def verify_token(authorization: str = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization[7:]
    for fb_app in _fb_apps.values():
        try:
            return fb_auth.verify_id_token(token, app=fb_app)["uid"]
        except Exception:
            continue
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

    inat_token = await get_inat_token()

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
            headers={"Authorization": f"Bearer {inat_token}"},
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
