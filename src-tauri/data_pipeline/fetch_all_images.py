#!/usr/bin/env python3
"""
V99 Full Image + Height/Weight Fetch
Fetches real images AND physical data from Wikipedia for ALL players.
Processes in chunks to avoid rate limits.
Also writes a fetch manifest so we can resume from where we left off.
"""

import json
import os
import time
import urllib.request
import urllib.parse
from pathlib import Path

DB_PATH = Path(__file__).parent.parent.parent / "src-tauri" / "databases" / "gaffer_world.json"
FACE_CACHE_DIR = Path(__file__).parent.parent.parent / "src-tauri" / "databases" / "face-cache"
PUBLIC_FACE_DIR = Path(__file__).parent.parent.parent / "public" / "face-cache"
MANIFEST_PATH = Path(__file__).parent.parent.parent / "src-tauri" / "databases" / "fetch_manifest.json"
UA = "GafferGame/1.0 (https://github.com/anthonycarre00-collab/gaffer-v99)"

FACE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_FACE_DIR.mkdir(parents=True, exist_ok=True)


def load_manifest():
    if MANIFEST_PATH.exists():
        with open(MANIFEST_PATH) as f:
            return json.load(f)
    return {"processed": {}, "heights": {}, "weights": {}}


def save_manifest(manifest):
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f)


def fetch_wikipedia_data(player_name, nationality=None):
    """Fetch image URL + height + weight from Wikipedia."""
    result = {"image_url": None, "height_cm": None, "weight_kg": None}

    # Build search term
    nat_words = {
        "ESP": "Spanish", "ENG": "English", "FRA": "French", "GER": "German",
        "ITA": "Italian", "BRA": "Brazilian", "ARG": "Argentine", "POR": "Portuguese",
        "NED": "Dutch", "BEL": "Belgian", "SUI": "Swiss", "AUT": "Austrian",
        "CRO": "Croatian", "SRB": "Serbian", "POL": "Polish", "TUR": "Turkish",
        "GRE": "Greek", "RUS": "Russian", "UKR": "Ukrainian", "DEN": "Danish",
        "SWE": "Swedish", "NOR": "Norwegian", "FIN": "Finnish", "CZE": "Czech",
        "SVK": "Slovak", "SVN": "Slovenian", "BIH": "Bosnian", "ALB": "Albanian",
        "MAR": "Moroccan", "ALG": "Algerian", "TUN": "Tunisian", "SEN": "Senegalese",
        "CIV": "Ivorian", "CMR": "Cameroonian", "NGA": "Nigerian", "GHA": "Ghanaian",
        "MEX": "Mexican", "COL": "Colombian", "URU": "Uruguayan", "PAR": "Paraguayan",
        "ECU": "Ecuadorian", "VEN": "Venezuelan", "CHI": "Chilean", "PER": "Peruvian",
        "JPN": "Japanese", "KOR": "South Korean", "AUS": "Australian",
        "USA": "American", "CAN": "Canadian", "IRL": "Irish", "WAL": "Welsh",
        "SCO": "Scottish", "NIR": "Northern Irish",
    }
    nat_word = nat_words.get(nationality or "", "")
    search = f"{player_name} footballer"
    if nat_word:
        search = f"{player_name} {nat_word} footballer"

    try:
        # Step 1: Search Wikipedia
        url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(search)}&format=json&srlimit=1"
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
        results = data.get("query", {}).get("search", [])
        if not results:
            # Try without "footballer"
            search2 = f"{player_name} {nat_word}" if nat_word else player_name
            url2 = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(search2)}&format=json&srlimit=1"
            req2 = urllib.request.Request(url2, headers={"User-Agent": UA})
            with urllib.request.urlopen(req2, timeout=5) as resp2:
                data2 = json.loads(resp2.read().decode())
            results = data2.get("query", {}).get("search", [])
            if not results:
                return result

        title = results[0]["title"]

        # Step 2: Get page images + extracts (for height/weight parsing)
        # Use the REST API for page content
        extract_url = f"https://en.wikipedia.org/w/api.php?action=query&titles={urllib.parse.quote(title)}&prop=pageimages|extracts&format=json&pithumbsize=200&exintro=true&explaintext=true"
        req3 = urllib.request.Request(extract_url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req3, timeout=5) as resp3:
            page_data = json.loads(resp3.read().decode())

        pages = page_data.get("query", {}).get("pages", {})
        for _, page in pages.items():
            # Get thumbnail
            thumb = page.get("thumbnail", {}).get("source")
            if thumb:
                result["image_url"] = thumb

            # Parse height/weight from extract
            extract = page.get("extract", "")
            if extract:
                import re
                # Height patterns: "1.85 m (6 ft 1 in)" or "185 cm"
                height_match = re.search(r'(\d+\.\d+)\s*m\s*\(', extract)
                if height_match:
                    result["height_cm"] = int(float(height_match.group(1)) * 100)
                else:
                    height_match2 = re.search(r'(\d{3})\s*cm', extract)
                    if height_match2:
                        result["height_cm"] = int(height_match2.group(1))

                # Weight patterns: "75 kg (165 lb)" or "75 kg"
                weight_match = re.search(r'(\d{2,3})\s*kg', extract)
                if weight_match:
                    result["weight_kg"] = int(weight_match.group(1))

        return result

    except Exception:
        return result


def process_batch(db_data, manifest, start_idx, batch_size):
    """Process a batch of players."""
    players = db_data["players"]
    # Sort by OVR descending — most famous first
    sorted_players = sorted(players, key=lambda p: p.get("ovr", 0), reverse=True)

    fetched_images = 0
    found_heights = 0
    found_weights = 0
    skipped = 0
    failed = 0

    end_idx = min(start_idx + batch_size, len(sorted_players))

    for i in range(start_idx, end_idx):
        p = sorted_players[i]
        name = p.get("full_name", "")
        pid = p.get("id", "")
        nat = p.get("nationality", "")

        if not name or not pid:
            skipped += 1
            continue

        # Skip if already processed (unless we want to retry)
        if pid in manifest["processed"]:
            skipped += 1
            continue

        # Fetch data from Wikipedia
        wiki_data = fetch_wikipedia_data(name, nat)

        # Save image if found
        if wiki_data["image_url"]:
            img_path = FACE_CACHE_DIR / f"{pid}.png"
            try:
                req = urllib.request.Request(wiki_data["image_url"], headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=8) as resp:
                    img_data = resp.read()
                with open(img_path, "wb") as f:
                    f.write(img_data)
                p["media"] = {"face": f"face-cache/{pid}.png"}
                fetched_images += 1
            except Exception:
                failed += 1
        else:
            failed += 1

        # Save height/weight if found
        if wiki_data["height_cm"]:
            manifest["heights"][pid] = wiki_data["height_cm"]
            found_heights += 1
        if wiki_data["weight_kg"]:
            manifest["weights"][pid] = wiki_data["weight_kg"]
            found_weights += 1

        # Mark as processed
        manifest["processed"][pid] = {
            "image": bool(wiki_data["image_url"]),
            "height": wiki_data["height_cm"],
            "weight": wiki_data["weight_kg"],
        }

        # Rate limit
        time.sleep(0.25)

    return fetched_images, found_heights, found_weights, skipped, failed


def main():
    import sys
    start_idx = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    batch_size = int(sys.argv[2]) if len(sys.argv) > 2 else 100

    print(f"Loading database...")
    with open(DB_PATH) as f:
        db_data = json.load(f)

    print(f"Loading manifest...")
    manifest = load_manifest()
    print(f"  Already processed: {len(manifest['processed'])} players")
    print(f"  Heights found: {len(manifest['heights'])}")
    print(f"  Weights found: {len(manifest['weights'])}")

    print(f"\nProcessing batch: start={start_idx}, size={batch_size}")
    imgs, heights, weights, skipped, failed = process_batch(
        db_data, manifest, start_idx, batch_size
    )

    print(f"\nBatch results:")
    print(f"  Images fetched: {imgs}")
    print(f"  Heights found: {heights}")
    print(f"  Weights found: {weights}")
    print(f"  Skipped (already done): {skipped}")
    print(f"  Failed: {failed}")

    # Save manifest
    save_manifest(manifest)
    print(f"\nManifest saved: {len(manifest['processed'])} total processed")

    # Save DB
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db_data, f, ensure_ascii=False, separators=(",", ":"))

    # Copy new images to public dir
    import shutil
    for img in FACE_CACHE_DIR.glob("*.png"):
        dest = PUBLIC_FACE_DIR / img.name
        if not dest.exists():
            shutil.copy2(img, dest)

    has_img = sum(1 for p in db_data["players"] if p.get("media", {}).get("face"))
    total_cached = len(list(FACE_CACHE_DIR.glob("*.png")))
    print(f"\nTotal players with images: {has_img}/{len(db_data['players'])}")
    print(f"Cache files: {total_cached}")
    print(f"DB size: {os.path.getsize(DB_PATH)/1024/1024:.1f} MB")


if __name__ == "__main__":
    main()
