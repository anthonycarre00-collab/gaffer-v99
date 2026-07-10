#!/usr/bin/env python3
"""
V99.1 Phase F: Download player face images + club logos via wsrv.nl proxy.

SoFifa CDN (cdn.sofifa.net) returns 403 to direct requests, but image
proxy services like wsrv.nl can fetch them on our behalf.

Downloads:
1. Player face images (from players_22.csv player_face_url)
2. Club logo images (from players_22.csv club_logo_url)

Processes in chunks to avoid rate limits. Uses a manifest to track
progress and resume from where it left off.
"""

import csv
import os
import time
import urllib.request
import json
from pathlib import Path
from urllib.parse import quote

CSV_PATH = Path(__file__).parent.parent.parent / "players_22.csv"
FACE_DIR = Path(__file__).parent.parent / "databases" / "face-cache"
PUBLIC_FACES = Path(__file__).parent.parent.parent / "public" / "face-cache"
LOGO_DIR = Path(__file__).parent.parent.parent / "public" / "club-logos"
MANIFEST = Path(__file__).parent.parent / "databases" / "image_manifest.json"

FACE_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_FACES.mkdir(parents=True, exist_ok=True)
LOGO_DIR.mkdir(parents=True, exist_ok=True)

PROXY = "https://wsrv.nl/?url="
UA = "GafferGame/1.0"

def slugify(name):
    return name.lower().replace(" ", "_").replace(".", "").replace("-", "_").replace("é", "e").replace("ü", "u").replace("ö", "o").replace("ä", "a").replace("ñ", "n").replace("á", "a").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ç", "c")

def load_manifest():
    if MANIFEST.exists():
        with open(MANIFEST) as f:
            return json.load(f)
    return {"faces": {}, "logos": {}}

def save_manifest(m):
    with open(MANIFEST, "w") as f:
        json.dump(m, f)

def download_image(url, dest_path, timeout=8):
    """Download via wsrv.nl proxy."""
    proxy_url = f"{PROXY}{quote(url, safe='')}"
    try:
        req = urllib.request.Request(proxy_url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
        if len(data) < 100:  # Too small — probably an error page
            return False
        with open(dest_path, "wb") as f:
            f.write(data)
        return True
    except:
        return False

def main():
    import sys
    batch_size = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    mode = sys.argv[2] if len(sys.argv) > 2 else "faces"  # "faces" or "logos"

    manifest = load_manifest()

    with open(CSV_PATH, encoding="utf-8") as f:
        players = list(csv.DictReader(f))

    if mode == "faces":
        # Build list of players needing face downloads
        to_download = []
        for p in players:
            sofifa_id = p.get("sofifa_id", "")
            face_url = p.get("player_face_url", "")
            if not sofifa_id or not face_url:
                continue
            player_id = f"p_{sofifa_id}"
            if player_id in manifest["faces"] and manifest["faces"][player_id]:
                continue
            if (FACE_DIR / f"{player_id}.png").exists():
                manifest["faces"][player_id] = True
                continue
            to_download.append((player_id, face_url))

        print(f"Faces to download: {len(to_download)} (batch: {batch_size})")

        downloaded = 0
        failed = 0
        for player_id, url in to_download[:batch_size]:
            dest = FACE_DIR / f"{player_id}.png"
            if download_image(url, dest):
                # Copy to public dir
                import shutil
                shutil.copy2(dest, PUBLIC_FACES / f"{player_id}.png")
                manifest["faces"][player_id] = True
                downloaded += 1
            else:
                manifest["faces"][player_id] = False
                failed += 1
            time.sleep(0.15)

        save_manifest(manifest)
        total = sum(1 for v in manifest["faces"].values() if v)
        print(f"Batch: {downloaded} downloaded, {failed} failed | Total faces: {total}")

    elif mode == "logos":
        # Build unique club → logo URL mapping
        clubs = {}
        for p in players:
            club = p.get("club_name", "").strip()
            url = p.get("club_logo_url", "").strip()
            if club and url and club not in clubs:
                team_id = slugify(club)
                clubs[club] = (url, team_id)

        to_download = []
        for club, (url, team_id) in clubs.items():
            if team_id in manifest["logos"] and manifest["logos"][team_id]:
                continue
            if (LOGO_DIR / f"{team_id}.png").exists():
                manifest["logos"][team_id] = True
                continue
            to_download.append((team_id, url))

        print(f"Logos to download: {len(to_download)} (batch: {batch_size})")

        downloaded = 0
        failed = 0
        for team_id, url in to_download[:batch_size]:
            dest = LOGO_DIR / f"{team_id}.png"
            if download_image(url, dest, timeout=5):
                manifest["logos"][team_id] = True
                downloaded += 1
            else:
                manifest["logos"][team_id] = False
                failed += 1
            time.sleep(0.1)

        save_manifest(manifest)
        total = sum(1 for v in manifest["logos"].values() if v)
        print(f"Batch: {downloaded} downloaded, {failed} failed | Total logos: {total}")

if __name__ == "__main__":
    main()
