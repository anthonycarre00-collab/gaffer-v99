#!/usr/bin/env python3
"""
Gaffer Real Data Scraper — fetches real player data from Hugging Face datasets
+ Wikidata, no user action required.

Sources:
1. aloobun/fbref_understat_combined (Hugging Face) — full FBref + Understat stats
   for 32,956 player-seasons across Big 5 leagues, 2020-2025
2. Wikidata SPARQL — height, weight, date of birth, nationality for each player

Output: input/gaffer_players.json (ready for build_world.py)

Run: python3 fetch_real_data.py
"""

import csv
import json
import os
import re
import sys
import time
import requests
from pathlib import Path
from datetime import datetime

INPUT_DIR = Path(__file__).parent / "input"
OUTPUT_FILE = INPUT_DIR / "gaffer_players.json"
FBREF_CSV = Path("/tmp/master_player_stats_multi.csv")

HEADERS = {'User-Agent': 'GafferScraper/1.0 (football manager game)'}

# League code → full name mapping
LEAGUE_NAMES = {
    'ENG': 'Premier League',
    'ESP': 'La Liga',
    'ITA': 'Serie A',
    'GER': 'Bundesliga',
    'FRA': 'Ligue 1',
}

LEAGUE_COUNTRIES = {
    'ENG': 'England',
    'ESP': 'Spain',
    'ITA': 'Italy',
    'GER': 'Germany',
    'FRA': 'France',
}


def download_fbref_data():
    """Download the FBref + Understat combined dataset from Hugging Face."""
    url = 'https://huggingface.co/datasets/aloobun/fbref_understat_combined/resolve/main/data/player_stats_multi/master_player_stats_multi.csv'
    print(f"[1/4] Downloading FBref stats from Hugging Face...")
    print(f"      {url}")

    r = requests.get(url, headers=HEADERS, timeout=120, stream=True)
    if r.status_code != 200:
        raise RuntimeError(f"Download failed: HTTP {r.status_code}")

    total = 0
    with open(FBREF_CSV, 'wb') as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
            total += len(chunk)

    print(f"      Downloaded {total / 1024 / 1024:.1f} MB")
    return FBREF_CSV


def load_fbref_season(csv_path, season='2023-2024'):
    """Load FBref stats for a specific season, return list of player dicts."""
    print(f"\n[2/4] Loading {season} season data...")
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        all_rows = list(reader)

    season_rows = [r for r in all_rows if r.get('season') == season]
    print(f"      {len(season_rows)} players in {season} season")

    players = []
    for row in season_rows:
        name = (row.get('player') or '').strip()
        if not name:
            continue

        # Parse nationality: "tnTUN" → "TUN"
        nat_raw = row.get('nationality', '')
        nat_match = re.search(r'([A-Z]{3})$', nat_raw)
        nation = nat_match.group(1) if nat_match else nat_raw[-3:].upper()

        pos_raw = (row.get('position') or '').upper()
        if 'GK' in pos_raw:
            position = 'GK'
        elif 'DF' in pos_raw:
            position = 'DEF'
        elif 'FW' in pos_raw:
            position = 'FWD'
        else:
            position = 'MID'

        def to_int(v, default=0):
            try:
                v = float(v)
                return int(v) if v == v else default  # NaN check
            except (ValueError, TypeError):
                return default

        def to_float(v, default=0.0):
            try:
                v = float(v)
                return v if v == v else default
            except (ValueError, TypeError):
                return default

        league_code = row.get('league', '')
        players.append({
            'name': name,
            'player_id': row.get('player_id', ''),
            'position': position,
            'pos_raw': pos_raw,
            'age': to_int(row.get('age'), 25),
            'born': to_int(row.get('birth_year'), 2000),
            'team': (row.get('squad') or '').strip(),
            'nation': nation,
            'league': league_code,
            'league_name': LEAGUE_NAMES.get(league_code, league_code),
            'country': LEAGUE_COUNTRIES.get(league_code, ''),
            'matches': to_int(row.get('games')),
            'starts': to_int(row.get('games_starts')),
            'minutes': to_int(row.get('minutes')),
            'ninety': to_float(row.get('minutes_90s')),
            'goals': to_int(row.get('goals')),
            'assists': to_int(row.get('assists')),
            'pk': to_int(row.get('pens_made')),
            'pkatt': to_int(row.get('pens_att')),
            'yellow_cards': to_int(row.get('cards_yellow')),
            'red_cards': to_int(row.get('cards_red')),
            # Defense stats
            'tackles': to_int(row.get('tackles')),
            'tackles_won': to_int(row.get('tackles_won')),
            'interceptions': to_int(row.get('interceptions')),
            'blocks': to_int(row.get('blocks')),
            'clearances': to_int(row.get('clearances')),
            # Passing stats
            'passes_completed': to_int(row.get('passes_completed')),
            'passes_attempted': to_int(row.get('passes')),
            'pass_pct': to_float(row.get('passes_pct')),
            'passes_progressive_distance': to_float(row.get('passes_progressive_distance')),
            'passes_into_final_third': to_int(row.get('passes_into_final_third')),
            'passes_into_penalty_area': to_int(row.get('passes_into_penalty_area')),
            # Shooting stats
            'shots': to_int(row.get('shots')),
            'shots_on_target': to_int(row.get('shots_on_target')),
            # xG/xA from understat (may be None for older seasons)
            'xg': to_float(row.get('xg_assist_net'), 0),  # fallback
            # GK stats
            'gk_saves': to_int(row.get('gk_saves')),
            'gk_save_pct': to_float(row.get('gk_save_pct')),
            'gk_clean_sheets': to_int(row.get('gk_clean_sheets')),
            # Will be filled by Wikidata enrichment
            'height_cm': None,
            'weight_kg': None,
            'market_value': None,
            'contract_end': None,
        })

    return players


def query_wikidata_for_player(name):
    """Query Wikidata SPARQL for a player's height, weight, and DOB.

    Returns dict with height_cm, weight_kg, dob (or None values if not found).
    Uses a flexible search: first exact label match, then alias match.
    """
    sparql_url = 'https://query.wikidata.org/sparql'

    # Try exact label match first
    query = f"""
    SELECT ?item ?itemLabel ?height ?weight ?dob WHERE {{
      ?item rdfs:label "{name}"@en.
      ?item wdt:P106 wd:Q937857.
      OPTIONAL {{ ?item wdt:P2048 ?height. }}
      OPTIONAL {{ ?item wdt:P2067 ?weight. }}
      OPTIONAL {{ ?item wdt:P569 ?dob. }}
    }}
    LIMIT 1
    """.strip()

    try:
        r = requests.get(sparql_url, params={'query': query, 'format': 'json'},
                        headers=HEADERS, timeout=15)
        if r.status_code == 200:
            results = r.json().get('results', {}).get('bindings', [])
            if results:
                binding = results[0]
                return _extract_wikidata_binding(binding)
        elif r.status_code == 429:
            return None  # rate limited
    except Exception:
        pass

    # Fallback: search via Wikidata search API (more flexible — matches aliases)
    try:
        search_url = 'https://www.wikidata.org/w/api.php'
        r = requests.get(search_url, params={
            'action': 'query',
            'list': 'search',
            'srsearch': f'{name} footballer',
            'srlimit': 1,
            'format': 'json',
        }, headers=HEADERS, timeout=15)
        if r.status_code == 200:
            search_results = r.json().get('query', {}).get('search', [])
            if search_results:
                qid = search_results[0]['title']
                # Now fetch the entity's height/weight
                entity_url = f'https://www.wikidata.org/wiki/Special:EntityData/{qid}.json'
                r2 = requests.get(entity_url, headers=HEADERS, timeout=15)
                if r2.status_code == 200:
                    entity_data = r2.json().get('entities', {}).get(qid, {})
                    claims = entity_data.get('claims', {})
                    height = None
                    weight = None
                    dob = None
                    # P2048 = height, P2067 = mass, P569 = date of birth
                    if 'P2048' in claims:
                        try:
                            h = claims['P2048'][0]['mainsnak']['datavalue']['value']
                            height_m = float(h.get('amount', 0))
                            unit = h.get('unit', '')
                            if 'Q11573' in unit:  # meter
                                height = int(height_m * 100)
                            else:
                                height = int(height_m)  # already cm
                        except: pass
                    if 'P2067' in claims:
                        try:
                            w = claims['P2067'][0]['mainsnak']['datavalue']['value']
                            weight = int(float(w.get('amount', 0)))
                        except: pass
                    if 'P569' in claims:
                        try:
                            dob_val = claims['P569'][0]['mainsnak']['datavalue']['value']['time']
                            # Format: "+2000-01-01T00:00:00Z"
                            dob = dob_val[1:11]  # strip the + prefix
                        except: pass
                    return {'height_cm': height, 'weight_kg': weight, 'dob': dob}
    except Exception:
        pass

    return None


def _extract_wikidata_binding(binding):
    """Extract height/weight/dob from a SPARQL binding."""
    height = None
    weight = None
    dob = None
    if 'height' in binding:
        height_m = float(binding['height']['value'])
        height = int(height_m * 100) if height_m < 3 else int(height_m)
    if 'weight' in binding:
        weight = int(float(binding['weight']['value']))
    if 'dob' in binding:
        dob = binding['dob']['value'][:10]
    return {'height_cm': height, 'weight_kg': weight, 'dob': dob}


def enrich_with_wikidata(players, rate_limit=1.0):
    """Query Wikidata for height/weight/DOB for each player."""
    print(f"\n[3/4] Enriching {len(players)} players with Wikidata (height/weight)...")
    print(f"      Rate limit: {rate_limit}s per query (~{len(players) * rate_limit / 60:.0f} min total)")

    found = 0
    total = len(players)

    for i, player in enumerate(players):
        if (i + 1) % 50 == 0:
            print(f"      Progress: {i+1}/{total} ({found} enriched with physical data)")

        result = query_wikidata_for_player(player['name'])
        if result:
            if result.get('height_cm'):
                player['height_cm'] = result['height_cm']
                found += 1
            if result.get('weight_kg'):
                player['weight_kg'] = result['weight_kg']
            if result.get('dob'):
                # Use Wikidata DOB if our FBref birth_year was missing
                if not player.get('born') or player['born'] == 2000:
                    try:
                        player['born'] = int(result['dob'][:4])
                        player['date_of_birth'] = result['dob']
                    except:
                        pass

        time.sleep(rate_limit)

    print(f"      Enriched {found}/{total} players with height data")
    return players


def norm99(value, min_val, max_val, invert=False):
    """Normalize a value to 1-99 scale using ABSOLUTE benchmarks (not dataset-relative)."""
    if max_val == min_val:
        return 50
    normalized = (value - min_val) / (max_val - min_val)
    if invert:
        normalized = 1.0 - normalized
    return max(1, min(99, int(normalized * 99)))


def compute_gaffer_attributes(players):
    """Compute 19 Gaffer attributes + Big Five personality from real stats.

    Uses ABSOLUTE football benchmarks (not dataset-relative) so that:
    - Elite players (Haaland, Kane) → OVR 80-90
    - Good players (Saka, Salah) → OVR 70-80
    - Average starters → OVR 55-65
    - Bench players → OVR 40-55
    - Squad fillers → OVR 30-45

    OVR is POSITION-WEIGHTED — outfield players don't get dragged down
    by their 15 in shot_stopping.
    """
    print(f"\n[4/4] Computing 19 Gaffer attributes + personality...")

    if not players:
        return players

    for fb in players:
        pg = fb['position']
        is_gk = pg == 'GK'
        is_def = pg == 'DEF'
        is_fwd = pg == 'FWD'
        is_mid = pg == 'MID'

        n90 = fb['ninety'] or (fb['minutes'] / 90) or 1
        goals_p90 = fb['goals'] / n90
        assists_p90 = fb['assists'] / n90

        # Pass completion percentage
        pass_pct = fb['pass_pct'] if fb['pass_pct'] > 0 else (
            (fb['passes_completed'] / fb['passes_attempted'] * 100) if fb['passes_attempted'] > 0 else 75
        )

        # Shots on target %
        sot_pct = (fb['shots_on_target'] / fb['shots'] * 100) if fb['shots'] > 0 else 0

        # Progressive actions per 90
        prog_actions = (fb['passes_into_final_third'] or 0) + (fb['passes_into_penalty_area'] or 0)
        prog_p90 = prog_actions / n90 if prog_actions else 0

        # Defensive actions per 90
        def_actions = ((fb['tackles'] or fb['tackles_won'] or 0) + fb['interceptions']) / n90

        # Height/weight (from Wikidata if available, else position defaults)
        height = fb.get('height_cm') or (190 if is_gk else 185 if is_def else 180)
        weight = fb.get('weight_kg') or (85 if is_gk else 80 if is_def else 74 if is_mid else 76)

        # ===== BASE OVR — anchors all attributes =====
        # Start from minutes played (regulars are better players)
        base_ovr = norm99(fb['minutes'], 200, 3400)  # 200min→1, 3400min→99
        base_ovr = max(35, min(75, base_ovr))  # clamp to 35-75 range

        # Boost for attacking output (goals + assists)
        ga = fb['goals'] + fb['assists']
        if ga >= 25: base_ovr = max(base_ovr, 78)
        elif ga >= 20: base_ovr = max(base_ovr, 75)
        elif ga >= 15: base_ovr = max(base_ovr, 72)
        elif ga >= 10: base_ovr = max(base_ovr, 68)
        elif ga >= 6: base_ovr = max(base_ovr, 63)
        elif ga >= 3: base_ovr = max(base_ovr, 58)

        # Boost for defensive output (tackles + interceptions per 90)
        if is_def or is_mid:
            if def_actions >= 7: base_ovr = max(base_ovr, 72)
            elif def_actions >= 5: base_ovr = max(base_ovr, 68)
            elif def_actions >= 3: base_ovr = max(base_ovr, 62)

        # Boost for passing quality
        if pass_pct >= 88: base_ovr = max(base_ovr, 70)
        elif pass_pct >= 85: base_ovr = max(base_ovr, 65)

        # GK boost from clean sheets
        if is_gk and fb.get('gk_clean_sheets', 0) >= 10:
            base_ovr = max(base_ovr, 72)
        elif is_gk and fb.get('gk_clean_sheets', 0) >= 5:
            base_ovr = max(base_ovr, 65)

        # ===== BODY (5 attrs) =====
        # Pace: not directly measurable from FBref standard stats.
        # Proxy: base 55-70 from minutes, boost for forwards who score a lot.
        pace = 55 + (base_ovr - 50) * 0.3  # center around base_ovr
        if is_fwd and fb['goals'] >= 15: pace = max(pace, 80)
        elif is_fwd and fb['goals'] >= 10: pace = max(pace, 75)
        elif is_fwd and fb['goals'] >= 5: pace = max(pace, 70)
        if is_gk: pace = 30
        if is_def: pace = min(pace, 75)  # defenders slower on average
        pace = max(40, min(95, int(pace)))

        burst = pace - 5  # burst slightly lower than pace
        burst = max(35, burst)

        engine = norm99(fb['minutes'], 200, 3400)  # absolute benchmark
        engine = max(40, min(90, engine + 20))  # shift up — pros are fit

        bmi = weight / ((height / 100) ** 2)
        power = norm99(bmi, 21, 26)
        if is_def or is_gk: power = min(95, power + 20)
        if is_fwd: power = min(90, power + 10)
        power = max(45, power)

        agility = 50 + (base_ovr - 50) * 0.3
        if sot_pct > 0: agility = max(agility, norm99(sot_pct, 20, 55))
        if is_gk: agility = 35
        agility = max(40, min(90, int(agility)))

        # ===== BALL (6 attrs) =====
        passing = norm99(pass_pct, 65, 92)  # absolute: 65%→1, 92%→99
        passing = max(45, min(90, passing + 10))  # shift up
        if is_fwd: passing = max(45, passing - 5)

        distribution = norm99(fb['passes_attempted'], 100, 2500) if fb['passes_attempted'] > 0 else 50
        distribution = max(40, min(88, distribution + 10))
        if is_gk: distribution = max(35, distribution - 5)

        touch = 50 + (base_ovr - 50) * 0.4
        if sot_pct > 0: touch = max(touch, norm99(sot_pct, 20, 55) + 10)
        if prog_p90 > 0: touch = max(touch, min(88, norm99(prog_p90, 0, 8) + 30))
        if is_gk: touch = 25
        touch = max(40, min(88, int(touch)))

        # Finishing: the key stat — goals per shot
        if fb['shots'] > 5:
            finishing = norm99(fb['goals'] / fb['shots'], 0.03, 0.25)
        elif fb['goals'] > 0:
            finishing = norm99(fb['goals'], 1, 30)
        else:
            finishing = 40 if is_fwd else 30 if is_mid else 20 if is_def else 15

        # Major boosts for prolific scorers
        if is_fwd and fb['goals'] >= 20: finishing = max(finishing, 88)
        elif is_fwd and fb['goals'] >= 15: finishing = max(finishing, 82)
        elif is_fwd and fb['goals'] >= 10: finishing = max(finishing, 75)
        elif is_fwd and fb['goals'] >= 5: finishing = max(finishing, 65)
        elif is_mid and fb['goals'] >= 10: finishing = max(finishing, 70)
        elif is_mid and fb['goals'] >= 5: finishing = max(finishing, 60)

        # Caps for non-attackers
        if is_def: finishing = min(45, finishing)
        elif is_mid and not is_fwd: finishing = min(65, finishing)
        if is_gk: finishing = 15
        # Hard cap — nobody is a perfect 99 finisher
        finishing = min(92, finishing)

        # Penalty conversion bonus
        if fb['pkatt'] > 0:
            pk_rate = fb['pk'] / fb['pkatt']
            finishing = round(finishing * 0.7 + norm99(pk_rate, 0.5, 1.0) * 0.3)

        # Defending: tackles + interceptions per 90
        if is_def:
            defending = norm99(def_actions, 2, 9)  # absolute: 2/90→1, 9/90→99
            defending = max(60, min(92, defending + 25))  # shift up for defenders
        elif is_mid:
            defending = norm99(def_actions, 1, 7)
            defending = max(40, min(75, defending + 15))
        elif is_fwd:
            defending = norm99(def_actions, 0, 5)
            defending = max(15, min(45, defending))
        else:
            defending = 15

        # Aerial from height (absolute)
        aerial = norm99(height, 168, 198)
        if is_def or is_gk: aerial = min(95, aerial + 20)
        if is_fwd: aerial = min(85, aerial + 10)
        aerial = max(40, aerial)

        # ===== HEAD (5 attrs) =====
        anticipation = 50 + (base_ovr - 50) * 0.3
        if fb['interceptions'] > 0:
            anticipation = max(anticipation, norm99(fb['interceptions'] / n90, 0, 4) + 30)
        if is_gk: anticipation = max(55, norm99(fb['minutes'], 200, 3400) + 20)
        anticipation = max(45, min(88, int(anticipation)))

        vision = 50 + (base_ovr - 50) * 0.4
        if prog_p90 > 0:
            vision = max(vision, min(88, norm99(prog_p90, 0, 8) + 35))
        if fb['assists'] >= 10: vision = max(vision, 80)
        elif fb['assists'] >= 5: vision = max(vision, 72)
        if is_fwd: vision = max(45, vision - 5)
        if is_gk: vision = 35
        vision = max(45, min(88, int(vision)))

        decisions = norm99(pass_pct, 65, 92)
        decisions = max(45, min(85, decisions + 10))
        if is_gk: decisions = 60
        if fb['yellow_cards'] + fb['red_cards'] * 3 > 12:
            decisions = max(35, decisions - 10)

        # Composure from goals/shots ratio + penalty conversion
        if fb['shots'] > 10:
            composure = norm99(fb['goals'] / fb['shots'], 0.03, 0.25)
        elif fb['goals'] > 0:
            composure = norm99(fb['goals'], 1, 30)
        else:
            composure = 50 + (base_ovr - 50) * 0.2
        if fb['pkatt'] > 0:
            composure = round(composure * 0.6 + norm99(fb['pk'] / fb['pkatt'], 0.5, 1.0) * 0.4)
        if fb['red_cards'] > 0: composure = max(30, composure - 10)
        if is_gk: composure = max(55, norm99(fb['minutes'], 200, 3400) + 20)
        composure = max(45, min(88, composure))

        if fb['matches'] > 0:
            leadership = norm99(fb['starts'] / fb['matches'], 0.2, 1.0)
            leadership = max(40, min(85, leadership + 25))
        else:
            leadership = 40
        if is_gk: leadership = min(88, leadership + 8)
        if fb['minutes'] >= 2500: leadership = max(leadership, 65)  # regulars lead

        # ===== GLOVES (3 attrs, GK only) =====
        if is_gk:
            gk_save_pct = fb.get('gk_save_pct', 0)
            if gk_save_pct > 0:
                shot_stopping = norm99(gk_save_pct, 55, 82)
                shot_stopping = max(60, min(90, shot_stopping + 20))
            else:
                shot_stopping = max(60, norm99(fb['minutes'], 200, 3400) + 25)
            cs = fb.get('gk_clean_sheets', 0)
            commanding = max(50, min(85, 55 + cs * 2))
            playing_out = max(40, min(75, distribution))
        else:
            shot_stopping = 15
            commanding = 20
            playing_out = 25

        attrs = {
            'pace': pace, 'burst': burst, 'engine': engine, 'power': power, 'agility': agility,
            'passing': passing, 'distribution': distribution, 'touch': touch, 'finishing': finishing,
            'defending': defending, 'aerial': aerial,
            'anticipation': anticipation, 'vision': vision, 'decisions': decisions,
            'composure': composure, 'leadership': leadership,
            'shot_stopping': shot_stopping, 'commanding': commanding, 'playing_out': playing_out,
        }

        # ===== POSITION-WEIGHTED OVR =====
        # Only average the RELEVANT attributes for each position
        if is_gk:
            ovr_attrs = [attrs['shot_stopping'], attrs['commanding'], attrs['playing_out'],
                        attrs['composure'], attrs['leadership'], attrs['anticipation']]
        elif is_def:
            ovr_attrs = [attrs['defending'], attrs['aerial'], attrs['power'],
                        attrs['anticipation'], attrs['pace'], attrs['composure'],
                        attrs['decisions'], attrs['passing']]
        elif is_mid:
            ovr_attrs = [attrs['passing'], attrs['distribution'], attrs['vision'],
                        attrs['engine'], attrs['decisions'], attrs['composure'],
                        attrs['touch'], attrs['defending']]
        else:  # FWD
            ovr_attrs = [attrs['finishing'], attrs['touch'], attrs['pace'],
                        attrs['composure'], attrs['aerial'], attrs['agility'],
                        attrs['vision']]
        ovr = round(sum(ovr_attrs) / len(ovr_attrs))

        # Final OVR adjustment — blend with base_ovr for stability
        ovr = round(ovr * 0.7 + base_ovr * 0.3)
        ovr = max(30, min(92, ovr))

        # ===== PERSONALITY =====
        cards_per90 = (fb['yellow_cards'] + fb['red_cards'] * 2) / n90
        openness = max(25, min(90, 50 + int(prog_p90 * 5) + int(goals_p90 * 10)))
        conscientiousness = max(25, min(90, 70 - int(cards_per90 * 30) + (10 if fb['minutes'] > 2000 else 0)))
        extraversion = max(30, min(90, 50 + int((prog_p90 + goals_p90 + assists_p90) * 8) + int(fb['minutes'] / 100)))
        total_ga = fb['goals'] + fb['assists']
        agreeableness = norm99(fb['assists'] / total_ga, 0, 0.7) if total_ga > 3 else 50
        agreeableness = max(30, min(85, agreeableness + 20))
        if cards_per90 > 0.3: agreeableness = max(25, agreeableness - 15)
        neuroticism = 20
        if fb['red_cards'] > 0: neuroticism += fb['red_cards'] * 12
        if fb['pkatt'] > 0 and fb['pk'] < fb['pkatt']: neuroticism += (fb['pkatt'] - fb['pk']) * 4
        neuroticism = max(10, min(80, neuroticism))

        personality = {
            'openness': openness, 'conscientiousness': conscientiousness,
            'extraversion': extraversion, 'agreeableness': agreeableness,
            'neuroticism': neuroticism, 'confidence': 100,
        }

        # ===== TRAITS =====
        traits = []
        if attrs['defending'] >= 75 and attrs['engine'] >= 70: traits.append('PressingAnchor')
        if attrs['passing'] >= 78 and attrs['distribution'] >= 72: traits.append('TempoConductor')
        if attrs['touch'] >= 75 and attrs['pace'] >= 75 and pg == 'FWD': traits.append('ChaosWinger')
        if attrs['defending'] >= 78 and attrs['aerial'] >= 70: traits.append('DefensiveWall')
        if attrs['pace'] >= 78 and attrs['finishing'] >= 70: traits.append('CounterKiller')
        if personality['extraversion'] >= 65 and personality['neuroticism'] < 50: traits.append('BigGameResponder')
        if personality['neuroticism'] >= 65: traits.append('MediaSensitive')
        if personality['neuroticism'] <= 30 and attrs['composure'] >= 70: traits.append('IceCold')
        traits = traits[:3]

        # Build final record
        fb['attributes'] = attrs
        fb['personality'] = personality
        fb['narrative_traits'] = traits
        fb['stability_modifier'] = 50
        fb['ovr'] = ovr
        fb['potential'] = min(95, ovr + max(0, 25 - fb['age'])) if fb['age'] < 25 else ovr
        fb['id'] = 'p_' + fb['name'].lower().replace(' ', '_').replace('-', '_').replace("'", '')
        fb['match_name'] = fb['name']
        fb['full_name'] = fb['name']
        if not fb.get('date_of_birth'):
            fb['date_of_birth'] = f"{fb['born']}-01-01"
        fb['nationality'] = fb['nation']
        fb['competition'] = fb['league_name']
        fb['market_value'] = fb.get('market_value') or max(100000, ovr * ovr * 10000)
        fb['contract_end'] = fb.get('contract_end') or '2028-06-30'
        fb['wage'] = max(1000, ovr * ovr * 15)

    avg_ovr = sum(p['ovr'] for p in players) // len(players)
    print(f"      Average OVR: {avg_ovr}")
    return players


def compute_relationships(players):
    """Generate intra-team relationships."""
    relationships = []
    by_team = {}
    for p in players:
        team = p['team']
        if not team: continue
        if team not in by_team:
            by_team[team] = []
        by_team[team].append(p)

    import random
    random.seed(42)

    for team, team_players in by_team.items():
        for i, p1 in enumerate(team_players):
            for j, p2 in enumerate(team_players):
                if i < j:
                    strength = 40
                    if p1['nation'] == p2['nation']:
                        strength += 20
                    if abs(p1['age'] - p2['age']) <= 3:
                        strength += 10
                    strength += random.randint(-15, 15)
                    strength = max(-30, min(95, strength))
                    relationships.append({
                        'player_a': p1['id'],
                        'player_b': p2['id'],
                        'strength': strength,
                        'volatility': 0.3,
                    })
    return relationships


def main():
    print("=" * 70)
    print("GAFFER REAL DATA SCRAPER — Hugging Face + Wikidata")
    print("=" * 70)
    print(f"Sources:")
    print(f"  1. aloobun/fbref_understat_combined (Hugging Face) — FBref stats")
    print(f"  2. Wikidata SPARQL — height, weight, DOB")
    print()

    # Step 1: Download FBref data
    csv_path = download_fbref_data()

    # Step 2: Load 2023-2024 season
    players = load_fbref_season(csv_path, '2023-2024')
    print(f"      {len(players)} players loaded")

    # Step 3: Enrich with Wikidata (height/weight)
    # Rate limit: 1s per query. 3200 players = ~53 minutes.
    # For testing, we can skip enrichment and use defaults.
    if '--skip-wikidata' in sys.argv:
        print("\n[3/4] Skipping Wikidata enrichment (--skip-wikidata flag)")
    else:
        enrich_with_wikidata(players, rate_limit=1.0)

    # Step 4: Compute Gaffer attributes
    players = compute_gaffer_attributes(players)

    # Step 5: Compute relationships
    print(f"\nComputing relationships...")
    relationships = compute_relationships(players)
    print(f"  Generated {len(relationships)} relationships")

    # Step 6: Write output
    INPUT_DIR.mkdir(parents=True, exist_ok=True)

    output = {
        'name': 'Gaffer Real Player Database',
        'description': f'Real player data from FBref + Wikidata ({len(players)} players, 2023-24 season)',
        'version': 3,
        'generated': datetime.now().isoformat(),
        'source': 'huggingface:aloobun/fbref_understat_combined + wikidata',
        'season': '2023-2024',
        'players': players,
        'relationships': relationships,
    }

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    file_size = OUTPUT_FILE.stat().st_size
    print(f"\n{'=' * 70}")
    print(f"DONE!")
    print(f"  Output: {OUTPUT_FILE}")
    print(f"  Size: {file_size / 1024:.1f} KB")
    print(f"  Players: {len(players)}")
    print(f"  Relationships: {len(relationships)}")

    # Stats
    pos_counts = {}
    for p in players:
        pos_counts[p['position']] = pos_counts.get(p['position'], 0) + 1
    print(f"  Position breakdown: {pos_counts}")

    teams = set(p['team'] for p in players if p['team'])
    print(f"  Teams: {len(teams)}")

    enriched = sum(1 for p in players if p.get('height_cm'))
    print(f"  Players with height data: {enriched}/{len(players)}")

    print(f"\n  Next: python3 build_world.py")


if __name__ == '__main__':
    main()
