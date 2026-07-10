#!/usr/bin/env python3
"""
Download remaining player faces using multiple proxies in rotation.
Tries wsrv.nl first, then images.weserv.nl as fallback.
"""
import csv, os, time, json, urllib.request
from pathlib import Path
from urllib.parse import quote

CSV_PATH = Path(__file__).parent.parent.parent / "players_22.csv"
FACE_DIR = Path(__file__).parent.parent / "databases" / "face-cache"
PUBLIC_FACES = Path(__file__).parent.parent.parent / "public" / "face-cache"
MANIFEST = Path(__file__).parent.parent / "databases" / "image_manifest.json"

FACE_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_FACES.mkdir(parents=True, exist_ok=True)

PROXIES = [
    "https://wsrv.nl/?url=",
    "https://images.weserv.nl/?url=",
]
UA = "GafferGame/1.0"

def download_image(url, dest, timeout=6):
    for proxy in PROXIES:
        proxy_url = f"{proxy}{quote(url, safe='')}"
        try:
            req = urllib.request.Request(proxy_url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = resp.read()
            if len(data) > 100:
                with open(dest, "wb") as f:
                    f.write(data)
                return True
        except:
            continue
    return False

def main():
    import sys
    batch = int(sys.argv[1]) if len(sys.argv) > 1 else 30

    m = json.load(open(MANIFEST)) if MANIFEST.exists() else {"faces": {}, "logos": {}}

    with open(CSV_PATH, encoding="utf-8") as f:
        players = list(csv.DictReader(f))

    existing = set(f.stem for f in FACE_DIR.glob("p_*.png") if f.stem.replace("p_","").isdigit())

    to_download = []
    for p in players:
        sid = p.get("sofifa_id", "")
        url = p.get("player_face_url", "")
        if not sid or not url:
            continue
        pid = f"p_{sid}"
        if pid in existing:
            continue
        if m["faces"].get(pid):
            continue
        to_download.append((pid, url))

    print(f"To download: {len(to_download)} (batch: {batch})")

    ok = 0
    fail = 0
    for pid, url in to_download[:batch]:
        dest = FACE_DIR / f"{pid}.png"
        if download_image(url, dest):
            import shutil
            shutil.copy2(dest, PUBLIC_FACES / f"{pid}.png")
            m["faces"][pid] = True
            ok += 1
        else:
            m["faces"][pid] = False
            fail += 1
        time.sleep(0.1)

    with open(MANIFEST, "w") as f:
        json.dump(m, f)

    total = len([f for f in PUBLIC_FACES.glob("p_*.png") if f.stem.replace("p_","").isdigit()])
    print(f"Batch: {ok} ok, {fail} fail | Total SoFifa faces: {total}")

if __name__ == "__main__":
    main()
