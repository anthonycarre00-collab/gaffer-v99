#!/usr/bin/env python3
"""
Gaffer Data Enrichment — downloads FIFA23 data (height/weight/overall) and 
merges with FBref stats to produce a complete, realistic player database.

Run this on YOUR machine (it downloads 5.6GB from Hugging Face, which is
too large for the dev server). It produces gaffer_players.json with:
- Real FBref stats (goals, assists, shots, passes, tackles, etc.)
- Real FIFA height, weight, overall rating, potential
- 19 Gaffer attributes calibrated from BOTH sources
- Big Five personality profiles
- Narrative traits
- Intra-team relationships

USAGE:
    pip install pandas requests
    python3 enrich_with_fifa.py

OUTPUT:
    input/gaffer_players.json (ready for build_world.py)
"""

import csv
import json
import os
import re
import sys
import time
import random
import hashlib
import requests
from pathlib import Path
from datetime import datetime

INPUT_DIR = Path(__file__).parent / "input"
OUTPUT_FILE = INPUT_DIR / "gaffer_players.json"
FBREF_CSV = Path("/tmp/master_player_stats_multi.csv")
FIFA_CSV = Path("/tmp/fifa23_big5.csv")

HEADERS = {'User-Agent': 'GafferScraper/1.0'}

LEAGUE_NAMES = {
    'ENG': 'Premier League', 'ESP': 'La Liga', 'ITA': 'Serie A',
    'GER': 'Bundesliga', 'FRA': 'Ligue 1',
}

# FIFA league name → FBref league code mapping
FIFA_TO_FBREF_LEAGUE = {
    'Premier League': 'ENG', 'La Liga': 'ESP', 'Serie A': 'ITA',
    'Bundesliga': 'GER', 'Ligue 1': 'FRA',
}


def download_fifa_data():
    """Download FIFA23 Big 5 player data from Hugging Face.
    
    Downloads in chunks to handle the 5.6GB file reliably.
    Shows progress so the user knows it's working.
    """
    import pandas as pd
    
    print("[1] Downloading FIFA23 data from Hugging Face...")
    print("    (5.6GB file — downloading in chunks, this takes 5-15 minutes)")
    print("    DO NOT close this window!")
    
    cols = ['short_name', 'long_name', 'fifa_version', 'fifa_update', 'overall', 'potential',
            'height_cm', 'weight_kg', 'age', 'club_name', 'league_name', 'nationality_name',
            'player_positions', 'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physic',
            'value_eur', 'wage_eur']
    
    url = 'https://huggingface.co/datasets/jsulz/FIFA23/resolve/main/male_players.csv'
    local_file = Path(__file__).parent / 'input' / 'fifa23_raw.csv'
    local_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Download in chunks to disk (resumable, shows progress)
    if not local_file.exists() or local_file.stat().st_size < 1_000_000:
        print(f"    Streaming to {local_file.name}...")
        r = requests.get(url, headers=HEADERS, stream=True, timeout=600)
        total_size = int(r.headers.get('content-length', 0))
        downloaded = 0
        chunk_count = 0
        
        with open(local_file, 'wb') as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):  # 1MB chunks
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    chunk_count += 1
                    if chunk_count % 50 == 0:  # print every 50MB
                        pct = (downloaded / total_size * 100) if total_size else 0
                        mb = downloaded / 1024 / 1024
                        print(f"    {mb:.0f} MB / {total_size/1024/1024:.0f} MB ({pct:.0f}%)")
        
        print(f"    Download complete: {downloaded / 1024 / 1024:.0f} MB")
    else:
        print(f"    Already downloaded: {local_file.name} ({local_file.stat().st_size / 1024 / 1024:.0f} MB)")
    
    # Read from local file (much faster, no network issues)
    print("    Parsing CSV...")
    df = pd.read_csv(local_file, usecols=cols, encoding='utf-8', low_memory=False)
    print(f"    Total rows: {len(df):,}")
    
    # Filter to FIFA 23, latest update, Big 5 leagues
    df = df[df['fifa_version'] == 23]
    df = df.sort_values('fifa_update', ascending=False).drop_duplicates('short_name', keep='first')
    big5 = ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']
    df = df[df['league_name'].isin(big5)]
    print(f"    Big 5 players (FIFA 23, latest): {len(df)}")
    print(f"    Height coverage: {df['height_cm'].notna().sum()}/{len(df)}")
    print(f"    Weight coverage: {df['weight_kg'].notna().sum()}/{len(df)}")
    
    # Save filtered version
    df.to_csv(FIFA_CSV, index=False)
    print(f"    Saved filtered FIFA data to {FIFA_CSV.name}")
    
    # Clean up the raw download to save disk space
    try:
        local_file.unlink()
        print(f"    Cleaned up raw download ({local_file.name})")
    except:
        pass  # don't fail if cleanup fails
    
    return df


def download_fbref_data():
    """Download FBref+Understat combined dataset."""
    print("\n[2] Downloading FBref stats from Hugging Face...")
    url = 'https://huggingface.co/datasets/aloobun/fbref_understat_combined/resolve/main/data/player_stats_multi/master_player_stats_multi.csv'
    r = requests.get(url, headers=HEADERS, timeout=120)
    with open(FBREF_CSV, 'wb') as f:
        f.write(r.content)
    print(f"    Downloaded {len(r.content) / 1024 / 1024:.1f} MB")
    return FBREF_CSV


def load_fbref_season(season='2023-2024'):
    """Load FBref stats for a specific season."""
    print(f"\n[3] Loading FBref {season} season...")
    with open(FBREF_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        all_rows = list(reader)
    
    season_rows = [r for r in all_rows if r.get('season') == season]
    print(f"    {len(season_rows)} players in {season}")
    
    players = []
    for row in season_rows:
        name = (row.get('player') or '').strip()
        if not name:
            continue
        
        nat_raw = row.get('nationality', '')
        nat_match = re.search(r'([A-Z]{3})$', nat_raw)
        nation = nat_match.group(1) if nat_match else nat_raw[-3:].upper()
        
        pos_raw = (row.get('position') or '').upper()
        if 'GK' in pos_raw: position = 'GK'
        elif 'DF' in pos_raw: position = 'DEF'
        elif 'FW' in pos_raw: position = 'FWD'
        else: position = 'MID'
        
        def to_int(v, d=0):
            try:
                v = float(v)
                return int(v) if v == v else d
            except: return d
        
        def to_float(v, d=0.0):
            try:
                v = float(v)
                return v if v == v else d
            except: return d
        
        league_code = row.get('league', '')
        players.append({
            'name': name,
            'position': position,
            'pos_raw': pos_raw,
            'age': to_int(row.get('age'), 25),
            'born': to_int(row.get('birth_year'), 2000),
            'team': (row.get('squad') or '').strip(),
            'nation': nation,
            'league': league_code,
            'league_name': LEAGUE_NAMES.get(league_code, league_code),
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
            'tackles': to_int(row.get('tackles')),
            'tackles_won': to_int(row.get('tackles_won')),
            'interceptions': to_int(row.get('interceptions')),
            'passes_completed': to_int(row.get('passes_completed')),
            'passes_attempted': to_int(row.get('passes')),
            'pass_pct': to_float(row.get('passes_pct')),
            'passes_progressive_distance': to_float(row.get('passes_progressive_distance')),
            'passes_into_final_third': to_int(row.get('passes_into_final_third')),
            'shots': to_int(row.get('shots')),
            'shots_on_target': to_int(row.get('shots_on_target')),
            'gk_saves': to_int(row.get('gk_saves')),
            'gk_save_pct': to_float(row.get('gk_save_pct')),
            'gk_clean_sheets': to_int(row.get('gk_clean_sheets')),
            # FIFA enrichment (filled later)
            'height_cm': None,
            'weight_kg': None,
            'fifa_overall': None,
            'fifa_potential': None,
            'fifa_pace': None,
            'fifa_shooting': None,
            'fifa_passing': None,
            'fifa_dribbling': None,
            'fifa_defending': None,
            'fifa_physic': None,
            'market_value': None,
        })
    
    return players


def normalize_name(name):
    """Normalize a player name for matching between FBref and FIFA."""
    # Remove accents, lowercase, remove dots/extra spaces
    import unicodedata
    name = unicodedata.normalize('NFD', name)
    name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
    return name.lower().strip().replace('.', '').replace('  ', ' ')


def enrich_with_fifa(players, fifa_df):
    """Match FBref players to FIFA data by normalized name."""
    print(f"\n[4] Enriching {len(players)} FBref players with FIFA data...")
    
    # Build FIFA lookup by normalized short_name and long_name
    fifa_by_short = {}
    fifa_by_long = {}
    for _, row in fifa_df.iterrows():
        short = normalize_name(str(row.get('short_name', '')))
        long = normalize_name(str(row.get('long_name', '')))
        if short:
            fifa_by_short[short] = row
        if long:
            fifa_by_long[long] = row
    
    enriched = 0
    for player in players:
        norm_name = normalize_name(player['name'])
        
        # Try short name first, then long name
        fifa_row = fifa_by_short.get(norm_name) or fifa_by_long.get(norm_name)
        
        if fifa_row is not None:
            player['height_cm'] = int(fifa_row['height_cm']) if pd.notna(fifa_row['height_cm']) else None
            player['weight_kg'] = int(fifa_row['weight_kg']) if pd.notna(fifa_row['weight_kg']) else None
            player['fifa_overall'] = int(fifa_row['overall']) if pd.notna(fifa_row['overall']) else None
            player['fifa_potential'] = int(fifa_row['potential']) if pd.notna(fifa_row['potential']) else None
            player['fifa_pace'] = int(fifa_row['pace']) if pd.notna(fifa_row['pace']) else None
            player['fifa_shooting'] = int(fifa_row['shooting']) if pd.notna(fifa_row['shooting']) else None
            player['fifa_passing'] = int(fifa_row['passing']) if pd.notna(fifa_row['passing']) else None
            player['fifa_dribbling'] = int(fifa_row['dribbling']) if pd.notna(fifa_row['dribbling']) else None
            player['fifa_defending'] = int(fifa_row['defending']) if pd.notna(fifa_row['defending']) else None
            player['fifa_physic'] = int(fifa_row['physic']) if pd.notna(fifa_row['physic']) else None
            player['market_value'] = int(fifa_row['value_eur']) if pd.notna(fifa_row['value_eur']) else None
            enriched += 1
    
    print(f"    Enriched {enriched}/{len(players)} players with FIFA data")
    return players


def norm99(value, min_val, max_val, invert=False):
    if max_val == min_val:
        return 50
    normalized = (value - min_val) / (max_val - min_val)
    if invert:
        normalized = 1.0 - normalized
    return max(1, min(99, int(normalized * 99)))


def compute_gaffer_attributes(players):
    """Compute 19 Gaffer attributes using FIFA data where available, FBref otherwise.
    
    When FIFA data exists (overall, pace, shooting, passing, etc.), we use it
    as the PRIMARY source because it's already calibrated to 0-99 by professionals.
    FBref stats are used to ADJUST the FIFA values based on real-world performance.
    
    When FIFA data is missing, we fall back to FBref-only computation.
    """
    print(f"\n[5] Computing 19 Gaffer attributes...")
    
    for fb in players:
        pg = fb['position']
        is_gk = pg == 'GK'
        is_def = pg == 'DEF'
        is_fwd = pg == 'FWD'
        is_mid = pg == 'MID'
        
        n90 = fb['ninety'] or (fb['minutes'] / 90) or 1
        
        # ===== IF FIFA DATA EXISTS, USE IT AS THE BASE =====
        if fb.get('fifa_overall'):
            # Map FIFA attributes to Gaffer attributes
            # FIFA has: pace, shooting, passing, dribbling, defending, physic
            # Gaffer has 19 attrs in Body/Ball/Head/Gloves groups
            
            fifa_ovr = fb['fifa_overall']
            fifa_pot = fb['fifa_potential'] or fifa_ovr
            
            # BODY (5) — map from FIFA pace/physic + height/weight
            pace = fb['fifa_pace'] or 50
            if is_gk: pace = max(25, min(40, pace // 3))
            
            burst = max(30, pace - 5)
            engine = min(90, max(40, fifa_ovr + 5))  # fitness proxy from overall
            if fb['minutes'] > 2500: engine = min(92, engine + 5)
            
            height = fb.get('height_cm') or (190 if is_gk else 185 if is_def else 180)
            weight = fb.get('weight_kg') or (85 if is_gk else 80 if is_def else 74)
            bmi = weight / ((height / 100) ** 2)
            power = fb['fifa_physic'] or norm99(bmi, 21, 27)
            if is_def or is_gk: power = min(95, power + 5)
            
            agility = max(35, min(90, (pace + (fb['fifa_dribbling'] or 50)) // 2))
            if is_gk: agility = max(35, min(60, agility - 10))
            
            # BALL (6) — map from FIFA passing/shooting/dribbling/defending
            passing = fb['fifa_passing'] or 55
            distribution = max(40, min(88, passing - 5))
            touch = fb['fifa_dribbling'] or 55
            finishing = fb['fifa_shooting'] or 40
            if is_gk: finishing = 15
            if is_def: finishing = min(40, finishing)
            defending = fb['fifa_defending'] or 30
            if is_fwd: defending = min(45, defending)
            aerial = norm99(height, 168, 200)
            if is_def or is_gk: aerial = min(95, aerial + 15)
            if is_fwd: aerial = min(85, aerial + 8)
            
            # HEAD (5) — derive from overall + position
            anticipation = min(88, max(45, fifa_ovr - 5 + (5 if is_def else 0)))
            vision = min(88, max(45, passing - 3))
            decisions = min(85, max(45, fifa_ovr - 3))
            composure = min(88, max(45, fifa_ovr - 2))
            leadership = min(85, max(40, fifa_ovr - 10))
            if fb['minutes'] > 2500: leadership = min(88, leadership + 10)
            
            # GLOVES (3, GK only)
            if is_gk:
                shot_stopping = min(90, max(60, fifa_ovr + 5))
                commanding = min(85, max(50, fifa_ovr - 5))
                playing_out = min(80, max(40, passing - 10))
            else:
                shot_stopping = 15
                commanding = 20
                playing_out = 25
            
            # Adjust based on real-world FBref performance
            # If a player is outperforming their FIFA rating in real life, boost them
            if fb['goals'] > 0 and is_fwd:
                real_goals_per90 = fb['goals'] / n90
                if real_goals_per90 > 0.8: finishing = min(92, finishing + 5)
                elif real_goals_per90 > 0.5: finishing = min(90, finishing + 3)
            
            if fb['assists'] > 5:
                vision = min(90, vision + 3)
                passing = min(90, passing + 2)
            
            if fb['tackles'] + fb['interceptions'] > 50 and (is_def or is_mid):
                defending = min(92, defending + 3)
            
            ovr = fifa_ovr
            potential = fifa_pot
        
        else:
            # ===== FALLBACK: FBref-only computation (no FIFA data) =====
            pass_pct = fb['pass_pct'] if fb['pass_pct'] > 0 else 75
            sot_pct = (fb['shots_on_target'] / fb['shots'] * 100) if fb['shots'] > 0 else 0
            def_actions = ((fb['tackles'] or fb['tackles_won'] or 0) + fb['interceptions']) / n90
            prog_p90 = (fb['passes_into_final_third'] or 0) / n90
            
            base_ovr = norm99(fb['minutes'], 200, 3400)
            base_ovr = max(40, min(75, base_ovr))
            ga = fb['goals'] + fb['assists']
            if ga >= 25: base_ovr = max(base_ovr, 78)
            elif ga >= 20: base_ovr = max(base_ovr, 75)
            elif ga >= 15: base_ovr = max(base_ovr, 72)
            elif ga >= 10: base_ovr = max(base_ovr, 68)
            elif ga >= 6: base_ovr = max(base_ovr, 63)
            
            height = fb.get('height_cm') or (190 if is_gk else 185 if is_def else 180)
            weight = fb.get('weight_kg') or (85 if is_gk else 80 if is_def else 74)
            
            pace = max(40, min(88, base_ovr + 10))
            if is_gk: pace = 30
            burst = max(35, pace - 5)
            engine = max(45, min(88, norm99(fb['minutes'], 200, 3400) + 20))
            bmi = weight / ((height / 100) ** 2)
            power = norm99(bmi, 21, 26)
            if is_def or is_gk: power = min(90, power + 15)
            agility = max(40, min(80, base_ovr + 5))
            if is_gk: agility = 35
            
            passing = max(45, min(85, norm99(pass_pct, 65, 90) + 10))
            distribution = max(40, min(80, passing - 5))
            touch = max(40, min(80, base_ovr + 5))
            if is_gk: touch = 25
            
            if fb['shots'] > 5:
                finishing = norm99(fb['goals'] / fb['shots'], 0.03, 0.20)
            elif fb['goals'] > 0:
                finishing = norm99(fb['goals'], 1, 30)
            else:
                finishing = 40 if is_fwd else 30 if is_mid else 20 if is_def else 15
            if is_fwd and fb['goals'] >= 15: finishing = max(finishing, 80)
            elif is_fwd and fb['goals'] >= 10: finishing = max(finishing, 70)
            if is_def: finishing = min(40, finishing)
            if is_gk: finishing = 15
            
            if is_def:
                defending = min(88, max(55, norm99(def_actions, 2, 9) + 25))
            elif is_mid:
                defending = min(72, max(35, norm99(def_actions, 1, 7) + 15))
            elif is_fwd:
                defending = min(40, max(15, norm99(def_actions, 0, 5)))
            else:
                defending = 15
            
            aerial = norm99(height, 168, 200)
            if is_def or is_gk: aerial = min(90, aerial + 15)
            if is_fwd: aerial = min(80, aerial + 8)
            
            anticipation = max(45, min(80, base_ovr))
            vision = max(45, min(80, base_ovr + 5))
            decisions = max(45, min(80, base_ovr))
            composure = max(45, min(80, base_ovr))
            leadership = max(40, min(75, base_ovr - 5))
            if fb['minutes'] > 2500: leadership = max(leadership, 60)
            
            if is_gk:
                gk_save_pct = fb.get('gk_save_pct', 0)
                shot_stopping = min(88, max(60, norm99(gk_save_pct, 55, 82) + 20)) if gk_save_pct > 0 else 65
                commanding = min(80, max(50, 60))
                playing_out = max(40, min(70, distribution))
            else:
                shot_stopping = 15
                commanding = 20
                playing_out = 25
            
            # Position-weighted OVR
            if is_gk:
                ovr_attrs = [shot_stopping, commanding, playing_out, composure, leadership, anticipation]
            elif is_def:
                ovr_attrs = [defending, aerial, power, anticipation, pace, composure, decisions, passing]
            elif is_mid:
                ovr_attrs = [passing, distribution, vision, engine, decisions, composure, touch, defending]
            else:
                ovr_attrs = [finishing, touch, pace, composure, aerial, agility, vision]
            ovr = round(sum(ovr_attrs) / len(ovr_attrs))
            ovr = round(ovr * 0.7 + base_ovr * 0.3)
            ovr = max(35, min(88, ovr))
            potential = min(92, ovr + max(0, 25 - fb['age'])) if fb['age'] < 25 else ovr
        
        attrs = {
            'pace': pace, 'burst': burst, 'engine': engine, 'power': power, 'agility': agility,
            'passing': passing, 'distribution': distribution, 'touch': touch, 'finishing': finishing,
            'defending': defending, 'aerial': aerial,
            'anticipation': anticipation, 'vision': vision, 'decisions': decisions,
            'composure': composure, 'leadership': leadership,
            'shot_stopping': shot_stopping, 'commanding': commanding, 'playing_out': playing_out,
        }
        
        # PERSONALITY
        cards_per90 = (fb['yellow_cards'] + fb['red_cards'] * 2) / n90
        goals_p90 = fb['goals'] / n90
        assists_p90 = fb['assists'] / n90
        openness = max(25, min(90, 50 + int(goals_p90 * 10) + int(assists_p90 * 8)))
        conscientiousness = max(25, min(90, 70 - int(cards_per90 * 30) + (10 if fb['minutes'] > 2000 else 0)))
        extraversion = max(30, min(90, 50 + int((goals_p90 + assists_p90) * 15) + int(fb['minutes'] / 100)))
        total_ga = fb['goals'] + fb['assists']
        agreeableness = norm99(fb['assists'] / total_ga, 0, 0.7) if total_ga > 3 else 50
        agreeableness = max(30, min(85, agreeableness + 20))
        if cards_per90 > 0.3: agreeableness = max(25, agreeableness - 15)
        neuroticism = 20
        if fb['red_cards'] > 0: neuroticism += fb['red_cards'] * 12
        neuroticism = max(10, min(75, neuroticism))
        
        personality = {
            'openness': openness, 'conscientiousness': conscientiousness,
            'extraversion': extraversion, 'agreeableness': agreeableness,
            'neuroticism': neuroticism, 'confidence': 100,
        }
        
        # TRAITS
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
        fb['potential'] = potential
        fb['id'] = 'p_' + fb['name'].lower().replace(' ', '_').replace('-', '_').replace("'", '')
        fb['match_name'] = fb['name']
        fb['full_name'] = fb['name']
        fb['date_of_birth'] = f"{fb['born']}-01-01"
        fb['nationality'] = fb['nation']
        fb['competition'] = fb['league_name']
        fb['market_value'] = fb.get('market_value') or max(100000, ovr * ovr * 10000)
        fb['contract_end'] = '2028-06-30'
        fb['wage'] = max(1000, ovr * ovr * 15)
    
    avg_ovr = sum(p['ovr'] for p in players) // len(players) if players else 0
    print(f"    Average OVR: {avg_ovr}")
    return players


def compute_relationships(players):
    relationships = []
    by_team = {}
    for p in players:
        t = p['team']
        if not t: continue
        by_team.setdefault(t, []).append(p)
    
    random.seed(42)
    for team, tp in by_team.items():
        for i, p1 in enumerate(tp):
            for j, p2 in enumerate(tp):
                if i < j:
                    s = 40
                    if p1['nation'] == p2['nation']: s += 20
                    if abs(p1['age'] - p2['age']) <= 3: s += 10
                    s += random.randint(-15, 15)
                    s = max(-30, min(95, s))
                    relationships.append({
                        'player_a': p1['id'], 'player_b': p2['id'],
                        'strength': s, 'volatility': 0.3,
                    })
    return relationships


def main():
    print("=" * 70)
    print("GAFFER DATA ENRICHMENT — FIFA23 + FBref")
    print("=" * 70)
    
    # Step 1: Download FIFA data
    try:
        import pandas as pd
    except ImportError:
        print("ERROR: pandas not installed. Run: pip install pandas")
        sys.exit(1)
    
    if not FIFA_CSV.exists():
        fifa_df = download_fifa_data()
    else:
        print("[1] FIFA data already downloaded, loading...")
        fifa_df = pd.read_csv(FIFA_CSV)
        print(f"    {len(fifa_df)} players loaded")
    
    # Step 2: Download FBref data
    if not FBREF_CSV.exists():
        download_fbref_data()
    
    # Step 3: Load FBref season
    players = load_fbref_season('2023-2024')
    
    # Step 4: Enrich with FIFA
    players = enrich_with_fifa(players, fifa_df)
    
    # Step 5: Compute attributes
    players = compute_gaffer_attributes(players)
    
    # Step 6: Relationships
    print(f"\n[6] Computing relationships...")
    relationships = compute_relationships(players)
    print(f"    Generated {len(relationships)} relationships")
    
    # Step 7: Write output
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    output = {
        'name': 'Gaffer Real Player Database',
        'description': f'FBref + FIFA23 enriched ({len(players)} players)',
        'version': 4,
        'generated': datetime.now().isoformat(),
        'source': 'fbref + fifa23',
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
    
    enriched = sum(1 for p in players if p.get('fifa_overall'))
    print(f"  FIFA-enriched: {enriched}/{len(players)}")
    
    pos_counts = {}
    for p in players:
        pos_counts[p['position']] = pos_counts.get(p['position'], 0) + 1
    print(f"  Positions: {pos_counts}")
    
    # Top 10
    top = sorted(players, key=lambda p: -p['ovr'])[:10]
    print(f"\n  Top 10 by OVR:")
    for p in top:
        print(f"    {p['name']:22s} | {p['position']} | {p['team']:18s} | OVR {p['ovr']} | {p.get('height_cm','?')}cm {p.get('weight_kg','?')}kg")
    
    print(f"\n  Next: python3 build_world.py")


if __name__ == '__main__':
    main()
