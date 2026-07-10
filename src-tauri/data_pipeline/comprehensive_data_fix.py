#!/usr/bin/env python3
"""
V99 Phase 4 Comprehensive Data Fix:
1. Re-derive attributes from available raw stats (goals, assists, shots, etc.)
2. Fix defaulted attributes (decisions, passing, aerial, leadership all had same value for everyone)
3. Fix personality (confidence=100 for all, neuroticism too low)
4. Fix stability_modifier (all at 50)
5. Fetch real player images from Wikipedia for top players
"""

import json
import os
import math
import random
import hashlib
import time
import urllib.request
import urllib.parse
from pathlib import Path

DB_PATH = Path(__file__).parent.parent.parent / "src-tauri" / "databases" / "gaffer_world.json"
SOURCE_PATH = Path(__file__).parent.parent / "data_pipeline" / "input" / "gaffer_players.json"
FACE_CACHE_DIR = Path(__file__).parent.parent.parent / "src-tauri" / "databases" / "face-cache"

def load_db():
    with open(DB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def save_db(data):
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

def load_source():
    with open(SOURCE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def clamp(val, lo=1, hi=99):
    return max(lo, min(hi, int(round(val))))

def jitter(val, amount=3):
    return clamp(val + random.randint(-amount, amount))

# =============================================================================
# ATTRIBUTE RE-DERIVATION
# =============================================================================

def compute_per_90(stat, minutes):
    """Compute per-90 rate from a counting stat."""
    if minutes <= 0:
        return 0.0
    return stat / minutes * 90.0

def percentile_rank(value, all_values):
    """Compute where a value sits in the distribution (0-100)."""
    if not all_values:
        return 50
    below = sum(1 for v in all_values if v < value)
    return (below / len(all_values)) * 100

def rederive_attributes(players_source, players_db):
    """
    Re-derive attributes from raw stats using percentile ranking WITHIN POSITION.
    Players with no stats get defaults adjusted by OVR.
    """
    print("=== RE-DERIVING ATTRIBUTES FROM RAW STATS ===")

    # Group source players by position for percentile ranking
    by_pos = {"GK": [], "DEF": [], "MID": [], "FWD": []}
    for p in players_source:
        pos = p.get("position", "MID")
        if pos in by_pos:
            by_pos[pos].append(p)

    # Pre-compute per-90 stats for percentile ranking
    stat_keys = ["goals", "assists", "shots", "shots_on_target", "tackles",
                 "interceptions", "passes_completed", "passes_attempted",
                 "clearances", "blocks", "yellow_cards", "red_cards"]

    for pos, group in by_pos.items():
        for p in group:
            mins = p.get("minutes", 0)
            for key in stat_keys:
                p90_key = f"_p90_{key}"
                p[p90_key] = compute_per_90(p.get(key, 0), mins)

    # Build percentile lookup arrays
    def get_percentile(pos, key, value):
        group = by_pos.get(pos, [])
        if not group or value <= 0:
            return 50
        values = [p.get(f"_p90_{key}", 0) for p in group if p.get(f"_p90_{key}", 0) > 0]
        if not values:
            return 50
        return percentile_rank(value, values)

    # Map source IDs to source data
    source_by_id = {}
    for p in players_source:
        sid = p.get("id", p.get("player_id", ""))
        source_by_id[sid] = p
        # Also map by name as fallback
        source_by_id[p.get("full_name", "")] = p

    fixed_count = 0
    for db_player in players_db:
        db_id = db_player.get("id", "")
        db_name = db_player.get("full_name", "")

        # Find matching source player
        src = source_by_id.get(db_id) or source_by_id.get(db_name)
        if not src:
            continue

        pos = src.get("position", "MID")
        mins = src.get("minutes", 0)
        ovr = db_player.get("ovr", 50)
        attrs = db_player.get("attributes", {})

        # Use existing good attributes where they have real values,
        # re-derive the broken ones

        # === FIX: decisions (was 46 for everyone) ===
        # Derive from pass completion rate + minutes (experience = better decisions)
        pass_pct = src.get("pass_pct", 0)
        if pass_pct > 0 and mins > 450:
            # Better pass accuracy = better decisions
            dec_base = clamp(pass_pct * 0.8 + 20)  # 70% pass → 76 decisions
            # Experienced players make better decisions
            exp_bonus = min(10, mins / 2000)
            attrs["decisions"] = jitter(clamp(dec_base + exp_bonus + (ovr - 50) * 0.3))
        else:
            # No pass data — derive from OVR
            attrs["decisions"] = jitter(clamp(40 + (ovr - 50) * 0.5))

        # === FIX: passing (was 45 for everyone) ===
        passes_completed = src.get("passes_completed", 0)
        passes_attempted = src.get("passes_attempted", 0)
        if passes_attempted > 20 and pass_pct > 0:
            pass_pctile = get_percentile(pos, "passes_completed", compute_per_90(passes_completed, mins))
            attrs["passing"] = jitter(clamp(pass_pctile * 0.99))
        else:
            # Midfielders need passing even without data
            base = 40 + (ovr - 50) * 0.5
            if pos == "MID":
                base += 10
            attrs["passing"] = jitter(clamp(base))

        # === FIX: aerial (was 49 for everyone) ===
        # Derive from height (if available) + position
        height = src.get("height_cm")
        if height and height > 0:
            # 185cm → ~60, 195cm → ~80, 175cm → ~40
            aerial_base = clamp((height - 170) * 2.5)
            if pos in ("DEF", "GK"):
                aerial_base = min(95, aerial_base + 10)
            attrs["aerial"] = jitter(aerial_base)
        else:
            # No height data — use position + OVR
            base = 40 + (ovr - 50) * 0.3
            if pos in ("DEF", "GK"):
                base += 15
            elif pos == "FWD":
                base += 5
            attrs["aerial"] = jitter(clamp(base))

        # === FIX: leadership (was 85 for everyone) ===
        # Derive from age + position + OVR
        age = src.get("age", 25)
        born = src.get("born", 2000)
        # Older players + defenders/GKs tend to be leaders
        lead_base = 30 + min(30, max(0, (age - 20) * 2))
        if pos in ("DEF", "GK"):
            lead_base += 10
        lead_base += (ovr - 50) * 0.2
        attrs["leadership"] = jitter(clamp(lead_base))

        # === FIX: anticipation (62% were in 45-55 range) ===
        # Derive from interceptions + clearances
        ints = src.get("interceptions", 0)
        clears = src.get("clearances", 0)
        if ints > 0 or clears > 0:
            int_p90 = compute_per_90(ints + clears, mins)
            int_pctile = get_percentile(pos, "interceptions", int_p90)
            attrs["anticipation"] = jitter(clamp(int_pctile * 0.99))
        else:
            attrs["anticipation"] = jitter(clamp(40 + (ovr - 50) * 0.4))

        # === FIX: vision (80% were in 45-55 range) ===
        # Derive from assists + passes into final third
        assists = src.get("assists", 0)
        if assists > 0:
            ast_p90 = compute_per_90(assists, mins)
            ast_pctile = get_percentile(pos, "assists", ast_p90)
            attrs["vision"] = jitter(clamp(ast_pctile * 0.99))
        else:
            base = 40 + (ovr - 50) * 0.4
            if pos == "MID":
                base += 5
            attrs["vision"] = jitter(clamp(base))

        # === FIX: composure (86% were in 45-55 range) ===
        # Derive from shot conversion + yellow/red card discipline
        shots = src.get("shots", 0)
        goals = src.get("goals", 0)
        sot = src.get("shots_on_target", 0)
        if shots > 5 and goals > 0:
            # Clinical finishers are composed
            conversion = goals / shots
            comp_base = clamp(conversion * 200 + 30)  # 0.2 conversion → 70
            attrs["composure"] = jitter(comp_base)
        elif sot > 0:
            comp_base = clamp((sot / shots) * 80 + 20)
            attrs["composure"] = jitter(comp_base)
        else:
            attrs["composure"] = jitter(clamp(40 + (ovr - 50) * 0.4))

        # === FIX: power (derived from height/weight, but those are None) ===
        # Without height/weight, derive from position + OVR
        if not src.get("height_cm"):
            base = 45 + (ovr - 50) * 0.3
            if pos in ("DEF", "GK"):
                base += 10
            attrs["power"] = jitter(clamp(base))

        # === FIX: stability_modifier (was 50 for everyone) ===
        # Derive from consistency: players with high minutes + low cards = stable
        yellows = src.get("yellow_cards", 0)
        reds = src.get("red_cards", 0)
        if mins > 450:
            # Cards per 90 — lower = more stable
            cards_p90 = (yellows + reds * 3) / (mins / 90)
            # 0 cards/90 → 80 stability, 0.5 cards/90 → 50, 1.0 → 30
            stability = clamp(80 - cards_p90 * 50)
            db_player["stability_modifier"] = stability
        else:
            # Low minutes = unproven = average stability
            db_player["stability_modifier"] = jitter(50, 10)

        # === FIX: aggression (use card data) ===
        if mins > 450:
            fouls = src.get("yellow_cards", 0) + src.get("red_cards", 0) * 3
            fouls_p90 = fouls / (mins / 90)
            # More fouls/cards = more aggressive
            agg_base = clamp(40 + fouls_p90 * 30)
            if pos == "DEF":
                agg_base = min(90, agg_base + 10)
            attrs["aggression"] = agg_base
        # else: keep the position-weighted value from previous fix

        # === FIX: teamwork (use pass data) ===
        if passes_attempted > 20:
            # High pass completion = good teamwork
            tw_base = clamp(pass_pct * 0.7 + 25)
            if pos in ("MID", "DEF"):
                tw_base = min(90, tw_base + 5)
            attrs["teamwork"] = tw_base
        # else: keep the position-weighted value from previous fix

        db_player["attributes"] = attrs
        fixed_count += 1

    print(f"  Re-derived attributes for {fixed_count} players")

    # === FIX PERSONALITY ===
    print("\n=== FIXING PERSONALITY ===")
    for p in players_db:
        personality = p.get("personality", {})

        # Fix confidence (was 100 for everyone)
        ovr = p.get("ovr", 50)
        # High OVR = high confidence, but with variety
        conf_base = clamp(40 + (ovr - 50) * 0.8)
        personality["confidence"] = jitter(conf_base, 8)

        # Fix neuroticism (was 20 for everyone — too low, too uniform)
        # Derive from stability_modifier (inverse) + aggression
        stability = p.get("stability_modifier", 50)
        aggression = p.get("attributes", {}).get("aggression", 50)
        # High stability = low neuroticism, high aggression = high neuroticism
        neuro_base = clamp(50 - (stability - 50) * 0.4 + (aggression - 50) * 0.2)
        personality["neuroticism"] = jitter(neuro_base, 10)

        # Fix openness (was 50 for 96% of players)
        # Derive from position — forwards/attacking players tend to be more open
        pos = p.get("position", "Midfielder")
        open_base = 50
        if "Forward" in pos:
            open_base = 60
        elif "Goalkeeper" in pos:
            open_base = 40
        personality["openness"] = jitter(open_base + (ovr - 50) * 0.2, 8)

        # Add variety to extraversion if it was defaulted
        if personality.get("extraversion", 50) == 50:
            personality["extraversion"] = jitter(50 + (ovr - 50) * 0.3, 10)

        p["personality"] = personality

    print(f"  Fixed personality for all players")


# =============================================================================
# REAL PLAYER IMAGE FETCH
# =============================================================================

def fetch_wikipedia_image(player_name, nationality=None):
    """Fetch a player's thumbnail from Wikipedia REST API."""
    # Clean the name for search
    search_term = f"{player_name} footballer"
    if nationality:
        # Add nationality hint for disambiguation
        nat_names = {"ESP": "Spanish", "ENG": "English", "FRA": "French",
                     "GER": "German", "ITA": "Italian", "BRA": "Brazilian",
                     "ARG": "Argentine", "POR": "Portuguese", "NED": "Dutch",
                     "BEL": "Belgian", "SUI": "Swiss", "AUT": "Austrian"}
        nat_word = nat_names.get(nationality, "")
        if nat_word:
            search_term = f"{player_name} {nat_word} footballer"

    # Use Wikipedia REST API search
    search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(search_term)}&format=json&srlimit=1"

    try:
        req = urllib.request.Request(search_url, headers={"User-Agent": "GafferGame/1.0 (football manager game)"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())

        results = data.get("query", {}).get("search", [])
        if not results:
            return None

        page_title = results[0]["title"]

        # Get the page's thumbnail
        thumb_url = f"https://en.wikipedia.org/w/api.php?action=query&titles={urllib.parse.quote(page_title)}&prop=pageimages&format=json&pithumbsize=200"

        req2 = urllib.request.Request(thumb_url, headers={"User-Agent": "GafferGame/1.0"})
        with urllib.request.urlopen(req2, timeout=5) as resp2:
            thumb_data = json.loads(resp2.read().decode())

        pages = thumb_data.get("query", {}).get("pages", {})
        for page_id, page_info in pages.items():
            thumb = page_info.get("thumbnail", {})
            thumb_source = thumb.get("source")
            if thumb_source:
                return thumb_source

    except Exception as e:
        pass

    return None


def fetch_real_images(data, max_players=500):
    """Fetch real images for the top players by OVR."""
    print(f"\n=== FETCHING REAL PLAYER IMAGES (top {max_players}) ===")

    FACE_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    players = data["players"]
    # Sort by OVR descending — get the most famous players first
    sorted_players = sorted(players, key=lambda p: p.get("ovr", 0), reverse=True)

    fetched = 0
    failed = 0
    skipped = 0

    for i, player in enumerate(sorted_players[:max_players]):
        name = player.get("full_name", "")
        player_id = player.get("id", "")
        nationality = player.get("nationality", "")

        if not name or not player_id:
            skipped += 1
            continue

        # Check if we already have this image
        img_path = FACE_CACHE_DIR / f"{player_id}.png"
        if img_path.exists():
            player["media"] = {"face": f"face-cache/{player_id}.png"}
            skipped += 1
            continue

        # Fetch from Wikipedia
        img_url = fetch_wikipedia_image(name, nationality)

        if img_url:
            try:
                req = urllib.request.Request(img_url, headers={"User-Agent": "GafferGame/1.0"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    img_data = resp.read()

                with open(img_path, "wb") as f:
                    f.write(img_data)

                player["media"] = {"face": f"face-cache/{player_id}.png"}
                fetched += 1

                if fetched % 10 == 0:
                    print(f"  Fetched {fetched}/{max_players} images...")

            except Exception:
                failed += 1
        else:
            failed += 1

        # Rate limit — 1 request per 500ms to be polite
        time.sleep(0.5)

        # Check if we're taking too long
        if i > 0 and i % 50 == 0:
            print(f"  Progress: {i}/{max_players} processed, {fetched} fetched, {failed} failed")

    print(f"\n  Results: {fetched} fetched, {failed} failed, {skipped} skipped")
    print(f"  Images saved to: {FACE_CACHE_DIR}")


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("Loading databases...")
    db_data = load_db()
    source_data = load_source()

    players_db = db_data["players"]
    players_source = source_data["players"]

    print(f"  DB players: {len(players_db)}")
    print(f"  Source players: {len(players_source)}")

    # Step 1: Re-derive attributes
    rederive_attributes(players_source, players_db)

    # Step 2: Fetch real images for top players
    fetch_real_images(db_data, max_players=500)

    # Step 3: Save
    print("\nSaving database...")
    save_db(db_data)
    print(f"  Done! Size: {os.path.getsize(DB_PATH) / 1024 / 1024:.1f} MB")

    # Verify
    print("\n=== VERIFICATION ===")
    # Check fixed attributes
    dec_vals = [p.get("attributes", {}).get("decisions", 50) for p in db_data["players"]]
    pass_vals = [p.get("attributes", {}).get("passing", 50) for p in db_data["players"]]
    aerial_vals = [p.get("attributes", {}).get("aerial", 50) for p in db_data["players"]]
    lead_vals = [p.get("attributes", {}).get("leadership", 50) for p in db_data["players"]]
    stab_vals = [p.get("stability_modifier", 50) for p in db_data["players"]]
    conf_vals = [p.get("personality", {}).get("confidence", 50) for p in db_data["players"]]
    neuro_vals = [p.get("personality", {}).get("neuroticism", 50) for p in db_data["players"]]

    print(f"  decisions: mean={sum(dec_vals)/len(dec_vals):.1f} min={min(dec_vals)} max={max(dec_vals)} (was: all 46)")
    print(f"  passing: mean={sum(pass_vals)/len(pass_vals):.1f} min={min(pass_vals)} max={max(pass_vals)} (was: all 45)")
    print(f"  aerial: mean={sum(aerial_vals)/len(aerial_vals):.1f} min={min(aerial_vals)} max={max(aerial_vals)} (was: all 49)")
    print(f"  leadership: mean={sum(lead_vals)/len(lead_vals):.1f} min={min(lead_vals)} max={max(lead_vals)} (was: all 85)")
    print(f"  stability: mean={sum(stab_vals)/len(stab_vals):.1f} min={min(stab_vals)} max={max(stab_vals)} (was: all 50)")
    print(f"  confidence: mean={sum(conf_vals)/len(conf_vals):.1f} min={min(conf_vals)} max={max(conf_vals)} (was: all 100)")
    print(f"  neuroticism: mean={sum(neuro_vals)/len(neuro_vals):.1f} min={min(neuro_vals)} max={max(neuro_vals)} (was: all 20)")

    has_image = sum(1 for p in db_data["players"] if p.get("media", {}).get("face"))
    print(f"\n  Players with real images: {has_image}/{len(db_data['players'])}")
    print(f"  Face cache directory: {FACE_CACHE_DIR}")
    if FACE_CACHE_DIR.exists():
        img_count = len(list(FACE_CACHE_DIR.glob("*.png")))
        print(f"  Images in cache: {img_count}")


if __name__ == "__main__":
    main()
