#!/usr/bin/env python3
"""
Logs in to iNaturalist via HTTP, fetches a fresh JWT, then updates the
birdvision Cloud Run service env var.

Called by GitHub Actions daily. Not intended for local use — credentials
come from environment variables set as GitHub secrets.

Required env vars:
    INAT_USERNAME   iNaturalist login (email or username)
    INAT_PASSWORD   iNaturalist password
    GCP_PROJECT     GCP project ID
    GCP_REGION      Cloud Run region (e.g. us-central1)
    CLOUD_RUN_SVC   Cloud Run service name (e.g. birdvision)
"""

import os
import re
import subprocess
import sys

import httpx

INAT_LOGIN_URL     = "https://www.inaturalist.org/login"
INAT_SIGNIN_URL    = "https://www.inaturalist.org/users/sign_in"
INAT_API_TOKEN_URL = "https://www.inaturalist.org/users/api_token"


BROWSER_HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def get_inat_jwt(username: str, password: str) -> str:
    with httpx.Client(follow_redirects=True, timeout=30, headers=BROWSER_HEADERS) as client:
        r = client.get(INAT_LOGIN_URL)
        r.raise_for_status()

        # Try input field first, fall back to meta tag
        match = (
            re.search(r'name="authenticity_token"[^>]*value="([^"]+)"', r.text)
            or re.search(r'value="([^"]+)"[^>]*name="authenticity_token"', r.text)
            or re.search(r'<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"', r.text)
        )
        if not match:
            raise RuntimeError("Could not find CSRF token on iNaturalist login page")
        csrf = match.group(1)

        r = client.post(
            INAT_SIGNIN_URL,
            data={
                "utf8":               "✓",
                "authenticity_token": csrf,
                "user[login]":        username,
                "user[password]":     password,
                "commit":             "Log in",
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer":      INAT_LOGIN_URL,
                "Origin":       "https://www.inaturalist.org",
            },
        )
        r.raise_for_status()

        if "/login" in str(r.url):
            raise RuntimeError("iNaturalist login failed — check INAT_USERNAME / INAT_PASSWORD secrets")

        r = client.get(INAT_API_TOKEN_URL, headers={"Accept": "application/json"})
        r.raise_for_status()

        token = r.json().get("api_token")
        if not token:
            raise RuntimeError(f"No api_token in response: {r.text[:200]}")
        return token


def update_cloud_run(project: str, region: str, service: str, token: str) -> None:
    result = subprocess.run(
        [
            "gcloud", "run", "services", "update", service,
            f"--set-env-vars=INAT_TOKEN={token}",
            f"--region={region}",
            f"--project={project}",
            "--quiet",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"gcloud update failed:\n{result.stderr}")
    print(result.stdout or "Cloud Run updated successfully.")


def main() -> None:
    username = os.environ["INAT_USERNAME"]
    password = os.environ["INAT_PASSWORD"]
    project  = os.environ.get("GCP_PROJECT",    "birding-app-1a446")
    region   = os.environ.get("GCP_REGION",     "us-central1")
    service  = os.environ.get("CLOUD_RUN_SVC",  "birdvision")

    print("Fetching iNaturalist JWT...")
    token = get_inat_jwt(username, password)
    print(f"Token obtained ({len(token)} chars). Updating Cloud Run...")
    update_cloud_run(project, region, service, token)
    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
