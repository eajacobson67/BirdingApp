#!/usr/bin/env python3
"""
Logs in to iNaturalist via a headless browser, fetches a fresh JWT, then
updates the birdvision Cloud Run service env var.

Called by GitHub Actions daily. Can also be run locally for testing.

Required env vars:
    INAT_USERNAME   iNaturalist login (email or username)
    INAT_PASSWORD   iNaturalist password

Optional env vars (skip Cloud Run update if absent):
    GCP_PROJECT     GCP project ID          (default: birding-app-1a446)
    GCP_REGION      Cloud Run region        (default: us-central1)
    CLOUD_RUN_SVC   Cloud Run service name  (default: birdvision)

Local test (prints token, skips Cloud Run):
    INAT_USERNAME=you@email.com INAT_PASSWORD=xxx py scripts/refresh_inat_token.py --dry-run
"""

import os
import subprocess
import sys

from playwright.sync_api import sync_playwright

INAT_LOGIN_URL     = "https://www.inaturalist.org/login"
INAT_API_TOKEN_URL = "https://www.inaturalist.org/users/api_token"


def get_inat_jwt(username: str, password: str) -> str:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx     = browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        )
        page = ctx.new_page()

        page.goto(INAT_LOGIN_URL, wait_until="domcontentloaded", timeout=30000)
        page.screenshot(path="/tmp/inat_login.png")

        # Rails generates id="user_login" from name="user[login]"
        login_selector    = "#user_login, input[name='user[login]']"
        password_selector = "#user_password, input[name='user[password]']"

        page.wait_for_selector(login_selector, timeout=15000)
        page.fill(login_selector,    username)
        page.fill(password_selector, password)
        page.click("input[type='submit'], button[type='submit']")

        try:
            page.wait_for_url(lambda url: "/login" not in url, timeout=15000)
        except Exception:
            page.screenshot(path="/tmp/inat_after_login.png")
            raise RuntimeError("iNaturalist login failed — check INAT_USERNAME / INAT_PASSWORD secrets")

        response = ctx.request.get(
            INAT_API_TOKEN_URL,
            headers={"Accept": "application/json"},
        )
        if not response.ok:
            raise RuntimeError(f"api_token request failed: {response.status}")

        token = response.json().get("api_token")
        if not token:
            raise RuntimeError(f"No api_token in response: {response.text()[:200]}")

        browser.close()
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
    dry_run  = "--dry-run" in sys.argv
    username = os.environ["INAT_USERNAME"]
    password = os.environ["INAT_PASSWORD"]

    print("Fetching iNaturalist JWT...")
    token = get_inat_jwt(username, password)
    print(f"Token obtained ({len(token)} chars).")

    if dry_run:
        print(f"DRY RUN — token starts with: {token[:40]}...")
        return

    project = os.environ.get("GCP_PROJECT",   "birding-app-1a446")
    region  = os.environ.get("GCP_REGION",    "us-central1")
    service = os.environ.get("CLOUD_RUN_SVC", "birdvision")

    print(f"Updating Cloud Run service '{service}'...")
    update_cloud_run(project, region, service, token)
    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
