#!/usr/bin/env python3
"""Download club logos from SoFifa CDN."""
import csv, os, time, urllib.request
from pathlib import Path

CSV_PATH = Path(__file__).parent.parent.parent / "players_22.csv"
LOGO_DIR = Path(__file__).parent.parent.parent / "public" / "club-logos"
LOGO_DIR.mkdir(parents=True, exist_ok=True)
UA = "GafferGame/1.0 (https://github.com/anthonycarre00-collab/gaffer-v99)"

# Build unique club → (logo_url, team_id) mapping
clubs = {}
with open(CSV_PATH, encoding='utf-8') as f:
    for row in csv.DictReader(f):
        club = row.get('club_name', '').strip()
        url = row.get('club_logo_url', '').strip()
        if club and url and club not in clubs:
            team_id = club.lower().replace(' ', '_').replace('.', '').replace('-', '_').replace('é', 'e').replace('ü', 'u').replace('ö', 'o').replace('ä', 'a').replace('ñ', 'n').replace('á', 'a').replace('í', 'i').replace('ó', 'o').replace('ú', 'u').replace('ç', 'c')
            clubs[club] = (url, team_id)

print(f"Found {len(clubs)} unique clubs with logo URLs")

downloaded = 0
skipped = 0
failed = 0

for club, (url, team_id) in clubs.items():
    img_path = LOGO_DIR / f"{team_id}.png"
    if img_path.exists():
        skipped += 1
        continue
    
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=8) as resp:
            img_data = resp.read()
        with open(img_path, 'wb') as f:
            f.write(img_data)
        downloaded += 1
        if downloaded % 50 == 0:
            print(f"  Downloaded {downloaded}...")
    except:
        failed += 1
    
    time.sleep(0.1)

print(f"\nResults: {downloaded} downloaded, {skipped} skipped, {failed} failed")
print(f"Total logos in cache: {len(list(LOGO_DIR.glob('*.png')))}")
