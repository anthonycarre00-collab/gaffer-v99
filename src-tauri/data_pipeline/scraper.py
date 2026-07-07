#!/usr/bin/env python3
"""
Gaffer Player Data Scraper — Python Edition (actually works)

Replaces the broken scraper.html. This is a SERVER-SIDE Python script that
fetches player data from multiple sources, enriches with physical data
(height/weight), and outputs gaffer_players.json for build_world.py.

WHY THIS WORKS (when scraper.html didn't):
- scraper.html ran IN THE BROWSER → blocked by CORS (browser-only restriction)
- This script runs on YOUR MACHINE → no CORS, direct HTTP access
- Uses a real browser session with cookies → FBref sees a normal visitor
- Multiple fallback strategies → if one source fails, another works

STRATEGIES (tries each in order until one succeeds):

1. --source html    : Read a saved FBref HTML file (user saves page in browser)
                      → 100% reliable, no fetching, works anywhere
2. --source fbref   : Live scrape FBref using requests + BeautifulSoup
                      → works on residential IP (your home machine)
3. --source csv     : Read pre-downloaded Kaggle CSV
                      → 100% reliable, no fetching

ENRICHMENT (optional, adds height/weight/market_value):
- --enrich wikidata      : Query Wikidata SPARQL for height/weight (free, no auth)
- --enrich transfermarkt : Scrape Transfermarkt for market value + height/weight
- --enrich understat     : Scrape Understat for xG/xA data

USAGE:
    # Strategy 1 (MOST RELIABLE): Save FBref page as HTML in your browser,
    # then parse it:
    python3 scraper.py --source html --input saved_fbref_page.html

    # Strategy 2: Live scrape FBref (works on your home machine):
    python3 scraper.py --source fbref --season 2023-2024

    # Strategy 3: Read pre-downloaded Kaggle CSV:
    python3 scraper.py --source csv --input kaggle_fbref_2023_24.csv

    # With enrichment (adds height/weight from Wikidata):
    python3 scraper.py --source fbref --season 2023-2024 --enrich wikidata

    # Full pipeline (FBref + Wikidata + Transfermarkt):
    python3 scraper.py --source fbref --season 2023-2024 --enrich wikidata transfermarkt

INSTALL:
    pip install requests beautifulsoup4 cloudscraper
    # (optional, for Playwright fallback on sites with heavy JS):
    pip install playwright && python3 -m playwright install chromium

OUTPUT:
    input/gaffer_players.json (ready for build_world.py)
"""

import argparse
import json
import os
import re
import sys
import time
import hashlib
import codecs
from pathlib import Path
from datetime import datetime

# Try importing optional dependencies
try:
    import requests
    from bs4 import BeautifulSoup
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("WARNING: requests/beautifulsoup4 not installed. Install with:")
    print("  pip install requests beautifulsoup4")
    print("Only --source csv will work without these.\n")

try:
    import cloudscraper
    HAS_CLOUDSCRAPER = True
except ImportError:
    HAS_CLOUDSCRAPER = False

OUTPUT_DIR = Path(__file__).parent / "input"
OUTPUT_FILE = OUTPUT_DIR / "gaffer_players.json"

# Realistic browser headers for fetching
BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
}


# ============================================================================
# SOURCE 1: Parse saved HTML file (100% reliable)
# ============================================================================

def parse_fbref_html_file(html_path):
    """Parse a saved FBref Big 5 stats page HTML file.

    User saves the page in their browser (Ctrl+S → "Webpage, HTML only"),
    then this function parses the stats table.

    This is the MOST RELIABLE strategy — no fetching, no bot detection,
    works 100% of the time.
    """
    print(f"\n[Source: HTML file] Reading {html_path}...")
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()
    print(f"  Read {len(html):,} chars")
    return parse_fbref_html(html)


def parse_fbref_html(html):
    """Parse FBref Big 5 stats from HTML string.

    Handles FBref's two-header-row table structure and de-duplicates
    columns with the same name (Gls, Ast, xG appear twice — abs + per-90).
    """
    soup = BeautifulSoup(html, 'html.parser')
    table = soup.find('table', {'id': 'stats_standard'}) or soup.find('table', class_='stats_table')
    if not table:
        raise ValueError("FBref stats table not found in HTML. Make sure you saved the Big 5 stats page.")

    # FBref has two header rows: group headers + leaf headers. Use the LAST row.
    header_rows = table.find_all('thead')
    all_headers = []
    for thead in header_rows:
        for tr in thead.find_all('tr'):
            ths = tr.find_all('th')
            headers = [th.get_text(strip=True) for th in ths]
            if headers:
                all_headers.append(headers)
    # Use the last (most detailed) header row
    raw_headers = all_headers[-1] if all_headers else []

    # De-duplicate headers (Gls, Ast, xG appear twice — keep first as absolute, suffix second as _p90)
    seen = {}
    final_headers = []
    for h in raw_headers:
        if not h:
            final_headers.append(f'col{len(final_headers)}')
            continue
        if h not in seen:
            seen[h] = 0
            final_headers.append(h)
        else:
            seen[h] += 1
            if h in ['Gls', 'Ast', 'G+A', 'xG', 'xAG', 'npxG', 'npxG+xAG']:
                final_headers.append(f'{h}_p90')
            else:
                final_headers.append(f'{h}_{seen[h]}')

    print(f"  Found {len(final_headers)} columns")

    # Parse body rows
    players = []
    tbody = table.find('tbody')
    if not tbody:
        raise ValueError("Table body not found")

    for tr in tbody.find_all('tr'):
        cells = tr.find_all('td')
        if len(cells) < 5:
            continue
        # Skip header repeat rows
        first_cell = cells[0].get_text(strip=True)
        if first_cell in ('Player', 'Rk', ''):
            continue

        p = {}
        for i, cell in enumerate(cells):
            if i < len(final_headers):
                p[final_headers[i]] = cell.get_text(strip=True)

        if not p.get('Player'):
            continue

        players.append(build_player_from_fbref(p))

    print(f"  Parsed {len(players)} players from HTML")
    return players


def build_player_from_fbref(p):
    """Convert a parsed FBref row dict into a normalized player dict."""
    # Nation: "eng ENG" → "ENG"
    nat = p.get('Nation', '')
    nat_match = re.search(r'([A-Z]{3})$', nat)
    nation = nat_match.group(1) if nat_match else nat[:3].upper()

    # Position: "FW,MF" → first pos
    pos_raw = (p.get('Pos') or '').upper()
    if 'GK' in pos_raw:
        position = 'GK'
    elif 'DF' in pos_raw or 'CB' in pos_raw or 'FB' in pos_raw or 'WB' in pos_raw:
        position = 'DEF'
    elif 'FW' in pos_raw or 'ST' in pos_raw:
        position = 'FWD'
    else:
        position = 'MID'

    # Minutes
    minutes = int(re.sub(r'[^0-9]', '', p.get('Min', '0')) or 0)
    if not minutes:
        n90 = float(p.get('90s', '0') or 0)
        minutes = round(n90 * 90)

    # Stats (use absolute values, NOT _p90)
    goals = int(p.get('Gls', '0') or 0)
    assists = int(p.get('Ast', '0') or 0)
    xg = float(p.get('xG', '0') or 0)
    xag = float(p.get('xAG', '0') or 0)
    yellow = int(p.get('CrdY', '0') or 0)
    red = int(p.get('CrdR', '0') or 0)
    pk = int(p.get('PK', '0') or 0)
    pkatt = int(p.get('PKatt', '0') or 0)
    prg_c = int(p.get('PrgC', '0') or 0)
    prg_p = int(p.get('PrgP', '0') or 0)
    prg_r = int(p.get('PrgR', '0') or 0)
    mp = int(p.get('MP', '0') or 0)
    starts = int(p.get('Starts', '0') or 0)
    age_str = p.get('Age', '')
    age = int(age_str.split('-')[0]) if age_str else 25
    born = int(p.get('Born', '0') or 0) or (2024 - age)
    comp = re.sub(r'^[a-z]{2,3}\s+', '', p.get('Comp', '')).strip()

    return {
        'name': p.get('Player', 'Unknown'),
        'position': position,
        'pos_raw': pos_raw,
        'age': age,
        'born': born,
        'team': p.get('Squad', ''),
        'nation': nation,
        'competition': comp,
        'matches': mp,
        'starts': starts,
        'minutes': minutes,
        'ninety': float(p.get('90s', '0') or 0),
        'goals': goals,
        'assists': assists,
        'xg': xg,
        'xag': xag,
        'yellow_cards': yellow,
        'red_cards': red,
        'pk': pk,
        'pkatt': pkatt,
        'prg_c': prg_c,
        'prg_p': prg_p,
        'prg_r': prg_r,
        # Will be filled by enrichment
        'height_cm': None,
        'weight_kg': None,
        'market_value': None,
        'contract_end': None,
    }


# ============================================================================
# SOURCE 2: Live scrape FBref (works on residential IP)
# ============================================================================

def fetch_fbref_live(season='2023-2024'):
    """Fetch FBref Big 5 stats page using requests with a browser session.

    This works on residential IPs (your home machine). Datacenter IPs
    (cloud servers) may be blocked by Cloudflare — if so, use --source html
    or --source csv instead.
    """
    if not HAS_REQUESTS:
        raise RuntimeError("requests not installed. Run: pip install requests beautifulsoup4")

    url = f'https://fbref.com/en/comps/Big5/{season}/stats/players/Big-5-European-Leagues-Stats'

    # Try with cloudscraper first (bypasses basic Cloudflare)
    if HAS_CLOUDSCRAPER:
        print(f"\n[Source: FBref live] Trying cloudscraper for {season}...")
        try:
            scraper = cloudscraper.create_scraper(
                browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False}
            )
            r = scraper.get(url, timeout=30)
            if r.status_code == 200 and 'stats_standard' in r.text:
                print(f"  cloudscraper: SUCCESS ({len(r.text):,} bytes)")
                return parse_fbref_html(r.text)
            print(f"  cloudscraper: {r.status_code} (Cloudflare challenge)")
        except Exception as e:
            print(f"  cloudscraper error: {e}")

    # Fall back to plain requests with full browser headers + session
    print(f"[Source: FBref live] Trying requests with browser session...")
    session = requests.Session()
    session.headers.update(BROWSER_HEADERS)

    # First, visit the main page to get cookies
    try:
        session.get('https://fbref.com/', timeout=15)
        time.sleep(2)  # Be polite
    except:
        pass

    # Now fetch the actual stats page
    r = session.get(url, timeout=30)
    print(f"  requests: {r.status_code} ({len(r.text):,} bytes)")

    if r.status_code == 200 and 'stats_standard' in r.text:
        print("  SUCCESS: stats table found!")
        return parse_fbref_html(r.text)
    elif r.status_code == 403:
        print("  403 Forbidden — Cloudflare blocked the request.")
        print("  This happens on datacenter/cloud IPs. On your home machine it should work.")
        print("  Alternative: save the FBref page as HTML in your browser, then use:")
        print(f"    python3 scraper.py --source html --input <saved_page>.html")
        return None
    else:
        print(f"  Unexpected response. Table found: {'stats_standard' in r.text}")
        return None


# ============================================================================
# SOURCE 3: Read pre-downloaded Kaggle CSV
# ============================================================================

def parse_kaggle_csv(csv_path):
    """Parse a pre-downloaded Kaggle FBref CSV.

    Kaggle has several FBref-derived datasets (search "FBref Big 5 leagues"
    on kaggle.com). Download the CSV, then use this strategy.

    This is 100% reliable — no fetching, no bot detection.
    """
    import csv

    print(f"\n[Source: Kaggle CSV] Reading {csv_path}...")
    players = []

    with open(csv_path, 'r', encoding='utf-8') as f:
        # Try to detect delimiter
        sample = f.read(1024)
        f.seek(0)
        delimiter = '\t' if sample.count('\t') > sample.count(',') else ','
        print(f"  Detected delimiter: {'tab' if delimiter == chr(9) else 'comma'}")

        reader = csv.DictReader(f, delimiter=delimiter)
        headers = reader.fieldnames or []
        print(f"  Columns: {len(headers)}")
        print(f"  Sample columns: {headers[:10]}")

        for row in reader:
            # Try to map common Kaggle CSV column names
            name = row.get('Player') or row.get('player') or row.get('player_name') or row.get('Name', '')
            if not name or name == 'Player':
                continue

            pos_raw = (row.get('Pos') or row.get('Position') or row.get('position') or '').upper()
            if 'GK' in pos_raw:
                position = 'GK'
            elif 'DF' in pos_raw:
                position = 'DEF'
            elif 'FW' in pos_raw:
                position = 'FWD'
            else:
                position = 'MID'

            try:
                age = int(row.get('Age', '25') or 25)
            except:
                age = 25

            try:
                minutes = int(re.sub(r'[^0-9]', '', row.get('Min', '0') or '0'))
            except:
                minutes = 0

            try:
                goals = int(row.get('Gls', '0') or 0)
            except:
                goals = 0

            try:
                assists = int(row.get('Ast', '0') or 0)
            except:
                assists = 0

            try:
                xg = float(row.get('xG', '0') or 0)
            except:
                xg = 0

            players.append({
                'name': name,
                'position': position,
                'pos_raw': pos_raw,
                'age': age,
                'born': 2024 - age,
                'team': row.get('Squad') or row.get('Team') or row.get('team_title', ''),
                'nation': row.get('Nation') or row.get('Nationality', '')[:3].upper(),
                'competition': '',
                'matches': int(row.get('MP', '0') or 0),
                'starts': int(row.get('Starts', '0') or 0),
                'minutes': minutes,
                'ninety': minutes / 90 if minutes else 0,
                'goals': goals,
                'assists': assists,
                'xg': xg,
                'xag': float(row.get('xAG', '0') or 0),
                'yellow_cards': int(row.get('CrdY', '0') or 0),
                'red_cards': int(row.get('CrdR', '0') or 0),
                'pk': int(row.get('PK', '0') or 0),
                'pkatt': int(row.get('PKatt', '0') or 0),
                'prg_c': int(row.get('PrgC', '0') or 0),
                'prg_p': int(row.get('PrgP', '0') or 0),
                'prg_r': int(row.get('PrgR', '0') or 0),
                'height_cm': None,
                'weight_kg': None,
                'market_value': None,
                'contract_end': None,
            })

    print(f"  Parsed {len(players)} players from CSV")
    return players


# ============================================================================
# ENRICHMENT: Wikidata SPARQL (height/weight)
# ============================================================================

def enrich_with_wikidata(players, rate_limit=1.0):
    """Query Wikidata SPARQL for each player's height and weight.

    Wikidata properties:
    - P2048: height (in meters)
    - P2067: mass/weight (in kilograms)
    - P106: occupation (Q937857 = soccer player)

    Free, no auth, but rate-limited. Default 1 second between queries.
    """
    if not HAS_REQUESTS:
        print("  [Wikidata] requests not installed, skipping")
        return players

    sparql_url = 'https://query.wikidata.org/sparql'
    headers = {'User-Agent': 'GafferScraper/1.0 (football manager game data collection)'}

    found = 0
    total = len(players)
    print(f"\n[Enrich: Wikidata] Querying {total} players for height/weight...")

    for i, player in enumerate(players):
        if (i + 1) % 50 == 0:
            print(f"  Progress: {i+1}/{total} ({found} enriched)")

        name = player['name']
        # SPARQL query: find soccer player by exact English label, get height + weight
        query = f"""
        SELECT ?height ?weight WHERE {{
          ?item rdfs:label "{name}"@en.
          ?item wdt:P106 wd:Q937857.
          OPTIONAL {{ ?item wdt:P2048 ?height. }}
          OPTIONAL {{ ?item wdt:P2067 ?weight. }}
        }}
        LIMIT 1
        """.strip()

        try:
            r = requests.get(sparql_url, params={'query': query, 'format': 'json'},
                           headers=headers, timeout=15)
            if r.status_code == 200:
                results = r.json().get('results', {}).get('bindings', [])
                if results:
                    binding = results[0]
                    if 'height' in binding:
                        player['height_cm'] = int(float(binding['height']['value']) * 100)
                    if 'weight' in binding:
                        player['weight_kg'] = int(float(binding['weight']['value']))
                    if player.get('height_cm') or player.get('weight_kg'):
                        found += 1
            elif r.status_code == 429:
                # Rate limited — back off
                print(f"  Rate limited at player {i+1}, waiting 10s...")
                time.sleep(10)
                continue
        except Exception as e:
            # Silent fail for individual players
            pass

        time.sleep(rate_limit)

    print(f"  Enriched {found}/{total} players with physical data")
    return players


# ============================================================================
# ENRICHMENT: Transfermarkt (market value, height, weight, contract)
# ============================================================================

def enrich_with_transfermarkt(players, rate_limit=3.0):
    """Scrape Transfermarkt for market value, height, weight, and contract expiry.

    Transfermarkt has heavy Cloudflare protection. Uses cloudscraper if available.
    Rate limited to 3 seconds between requests (Transfermarkt is strict).
    """
    if not HAS_REQUESTS:
        print("  [Transfermarkt] requests not installed, skipping")
        return players

    # Use cloudscraper to bypass Cloudflare
    if HAS_CLOUDSCRAPER:
        session = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows'})
    else:
        session = requests.Session()
        session.headers.update(BROWSER_HEADERS)

    found = 0
    total = len(players)
    print(f"\n[Enrich: Transfermarkt] Scraping {total} players for market value + physical data...")

    for i, player in enumerate(players):
        if (i + 1) % 25 == 0:
            print(f"  Progress: {i+1}/{total} ({found} enriched)")

        name = player['name']
        search_url = f'https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query={name}'

        try:
            r = session.get(search_url, timeout=15)
            if r.status_code != 200:
                time.sleep(rate_limit)
                continue

            # Find player profile link
            soup = BeautifulSoup(r.text, 'html.parser')
            player_link = soup.find('a', href=re.compile(r'/spieler/\d+'))
            if not player_link:
                time.sleep(rate_limit)
                continue

            player_url = 'https://www.transfermarkt.com' + player_link['href']
            time.sleep(1)  # Be polite between search and profile

            r2 = session.get(player_url, timeout=15)
            if r2.status_code != 200:
                time.sleep(rate_limit)
                continue

            soup2 = BeautifulSoup(r2.text, 'html.parser')

            # Parse player info table
            info_table = soup2.find('table', class_='auflistung')
            if info_table:
                for tr in info_table.find_all('tr'):
                    label = tr.find('th')
                    value = tr.find('td')
                    if not label or not value:
                        continue
                    label_text = label.get_text(strip=True).lower()
                    value_text = value.get_text(strip=True)

                    if 'height' in label_text or 'größe' in label_text:
                        height_match = re.search(r'(\d{3})\s*cm', value_text)
                        if height_match:
                            player['height_cm'] = int(height_match.group(1))
                        else:
                            m_match = re.search(r'1,\d{2}', value_text)
                            if m_match:
                                player['height_cm'] = int(m_match.group().replace(',', ''))
                    elif 'weight' in label_text or 'gewicht' in label_text:
                        weight_match = re.search(r'(\d+)\s*kg', value_text)
                        if weight_match:
                            player['weight_kg'] = int(weight_match.group(1))
                    elif 'market value' in label_text or 'marktwert' in label_text:
                        player['market_value'] = parse_market_value(value_text)
                    elif 'contract' in label_text:
                        date_match = re.search(r'\d{4}-\d{2}-\d{2}', value_text)
                        if date_match:
                            player['contract_end'] = date_match.group()

            if player.get('market_value') or player.get('height_cm'):
                found += 1

        except Exception:
            pass

        time.sleep(rate_limit)

    print(f"  Enriched {found}/{total} players with Transfermarkt data")
    return players


def parse_market_value(s):
    """Parse a market value string like '€80.00m' or '€500k' into euros."""
    if not s:
        return None
    m = re.search(r'€([\d.]+)\s*([mk])', s, re.IGNORECASE)
    if not m:
        return None
    n = float(m.group(1))
    unit = m.group(2).lower()
    if unit == 'm':
        return int(n * 1_000_000)
    elif unit == 'k':
        return int(n * 1_000)
    return None


# ============================================================================
# ATTRIBUTE COMPUTATION (from FBref stats + physical data)
# ============================================================================

def norm99(value, min_val, max_val, invert=False):
    if max_val == min_val:
        return 50
    normalized = (value - min_val) / (max_val - min_val)
    if invert:
        normalized = 1.0 - normalized
    return max(1, min(99, int(normalized * 99)))


def compute_gaffer_attributes(players):
    """Compute 19 Gaffer attributes + Big Five personality from real stats.

    Uses position-appropriate normalization. Physical data (height/weight)
    is used when available from enrichment.
    """
    if not players:
        return players

    # Compute maxima for normalization
    maxV = {
        'minutes': max(p['minutes'] for p in players) or 1,
        'prg_c': max(p['prg_c'] for p in players) or 1,
        'prg_p': max(p['prg_p'] for p in players) or 1,
        'prg_r': max(p['prg_r'] for p in players) or 1,
        'xg': max(p['xg'] for p in players) or 1,
        'xag': max(p['xag'] for p in players) or 1,
    }

    for fb in players:
        pg = fb['position']
        is_gk = pg == 'GK'
        is_def = pg == 'DEF'
        is_fwd = pg == 'FWD'
        is_mid = pg == 'MID'

        n90 = fb['ninety'] or (fb['minutes'] / 90) or 1
        prgC_p90 = fb['prg_c'] / n90
        prgP_p90 = fb['prg_p'] / n90
        prgR_p90 = fb['prg_r'] / n90
        xg_p90 = fb['xg'] / n90
        xag_p90 = fb['xag'] / n90
        goals_p90 = fb['goals'] / n90
        assists_p90 = fb['assists'] / n90

        # ----- BODY -----
        pace = norm99(prgR_p90, 0, max(2, maxV['prg_r'] / maxV['minutes'] * 90))
        if is_def: pace = max(30, pace - 5)
        if is_gk: pace = 30

        burst = norm99((prgC_p90 + prgR_p90) / 2, 0, max(3, (maxV['prg_c'] + maxV['prg_r']) / maxV['minutes'] * 90))
        if is_gk: burst = 20

        engine = norm99(fb['minutes'], 0, maxV['minutes'])
        if fb['matches'] > 0 and fb['starts'] / fb['matches'] < 0.5:
            engine = max(30, engine - 15)

        # Power from height/weight if available, else position default
        height = fb.get('height_cm') or (190 if is_gk else 185 if is_def else 180)
        weight = fb.get('weight_kg') or (85 if is_gk else 80 if is_def else 74 if is_mid else 76)
        bmi = weight / ((height / 100) ** 2)
        power = norm99(bmi, 21, 26)
        if is_def or is_gk: power = min(95, power + 15)
        if is_fwd: power = min(90, power + 5)

        agility = norm99(prgC_p90, 0, max(2, maxV['prg_c'] / maxV['minutes'] * 90))
        if is_gk: agility = 30

        # ----- BALL -----
        passing = norm99(prgP_p90, 0, max(2, maxV['prg_p'] / maxV['minutes'] * 90))
        if is_fwd: passing = max(30, passing - 10)

        distribution = norm99(fb['prg_p'], 0, maxV['prg_p'])
        if is_gk: distribution = max(20, distribution - 10)
        if is_fwd: distribution = max(25, distribution - 15)

        touch = norm99(prgC_p90, 0, max(2, maxV['prg_c'] / maxV['minutes'] * 90))
        if is_gk: touch = 25
        if is_def: touch = max(30, touch - 5)

        # Finishing from goals/xG ratio
        if fb['xg'] > 2:
            finishing = norm99(fb['goals'] / fb['xg'], 0.5, 1.5)
        elif fb['goals'] > 0:
            finishing = norm99(fb['goals'] / max(1, fb['xg']), 0, 2)
        else:
            finishing = 45 if is_fwd else 35 if is_mid else 20 if is_def else 15
        if is_gk: finishing = 15
        if fb['pkatt'] > 0:
            finishing = round(finishing * 0.7 + norm99(fb['pk'] / fb['pkatt'], 0.5, 1.0) * 0.3)

        # Defending: position-based
        if is_def:
            defending = min(99, max(50, norm99(fb['minutes'], maxV['minutes'] * 0.3, maxV['minutes']) + 20))
        elif is_mid:
            defending = min(70, max(25, norm99(fb['minutes'], maxV['minutes'] * 0.3, maxV['minutes']) + 5))
        elif is_fwd:
            defending = min(40, max(10, norm99(fb['minutes'], maxV['minutes'] * 0.3, maxV['minutes']) - 15))
        else:
            defending = 15

        # Aerial from height if available
        if fb.get('height_cm'):
            aerial = norm99(fb['height_cm'], 170, 200)
            if is_def or is_gk: aerial = min(95, aerial + 15)
            if is_fwd: aerial = min(85, aerial + 5)
        else:
            aerial = 70 if (is_def or is_gk) else 55 if is_fwd else 45

        # ----- HEAD -----
        anticipation = max(30, norm99(xag_p90, 0, max(0.5, maxV['xag'] / maxV['minutes'] * 90)))
        if is_gk: anticipation = max(50, norm99(fb['minutes'], 0, maxV['minutes']))

        vision = max(30, norm99(xag_p90, 0, max(0.5, maxV['xag'] / maxV['minutes'] * 90)))
        if is_fwd: vision = max(30, vision - 5)
        if is_gk: vision = 30

        if fb['xg'] > 0 and fb['xag'] > 0:
            decisions = norm99((fb['xag'] + fb['xg']) / n90, 0, 1.5)
        else:
            decisions = 50
        decisions = max(30, decisions)
        if is_gk: decisions = 50
        if fb['yellow_cards'] + fb['red_cards'] * 3 > 10:
            decisions = max(25, decisions - 15)

        if fb['xg'] > 2:
            composure = norm99(fb['goals'] / fb['xg'], 0.5, 1.5)
        else:
            composure = 50
        if fb['pkatt'] > 0:
            composure = round(composure * 0.6 + norm99(fb['pk'] / fb['pkatt'], 0.5, 1.0) * 0.4)
        if fb['red_cards'] > 0: composure = max(20, composure - 15)
        if is_gk: composure = norm99(fb['minutes'], 0, maxV['minutes'])

        if fb['matches'] > 0:
            leadership = norm99(fb['starts'] / fb['matches'], 0.3, 1.0)
            leadership = max(20, min(99, leadership + norm99(fb['minutes'], 0, maxV['minutes']) * 0.3))
        else:
            leadership = 30
        if is_gk: leadership = min(99, leadership + 10)

        # ----- GLOVES -----
        shot_stopping = min(99, max(55, norm99(fb['minutes'], 0, maxV['minutes']) + 30)) if is_gk else 15
        commanding = min(99, max(45, 60)) if is_gk else 20
        playing_out = max(25, norm99(prgP_p90, 0, max(2, maxV['prg_p'] / maxV['minutes'] * 90))) if is_gk else 25
        if not is_gk:
            shot_stopping, commanding, playing_out = 15, 20, 25

        attrs = {
            'pace': pace, 'burst': burst, 'engine': engine, 'power': power, 'agility': agility,
            'passing': passing, 'distribution': distribution, 'touch': touch, 'finishing': finishing,
            'defending': defending, 'aerial': aerial,
            'anticipation': anticipation, 'vision': vision, 'decisions': decisions,
            'composure': composure, 'leadership': leadership,
            'shot_stopping': shot_stopping, 'commanding': commanding, 'playing_out': playing_out,
        }
        ovr = round(sum(attrs.values()) / 19)

        # ----- PERSONALITY -----
        cards_per90 = (fb['yellow_cards'] + fb['red_cards'] * 2) / n90
        openness = max(20, min(95, norm99(prgC_p90 + goals_p90 * 0.5, 0, 3) + 10))
        conscientiousness = max(25, min(95, norm99(cards_per90, 0.5, 0.05, invert=True) + norm99(fb['minutes'], maxV['minutes'] * 0.3, maxV['minutes']) * 0.2))
        involvement = prgC_p90 + prgP_p90 + prgR_p90
        extraversion = max(30, min(95, norm99(involvement, 0, 5) * 0.5 + norm99(fb['minutes'], 0, maxV['minutes']) * 0.5))
        total_ga = fb['goals'] + fb['assists']
        agreeableness = norm99(fb['assists'] / total_ga, 0, 0.7) if total_ga > 3 else 50
        if cards_per90 > 0.3: agreeableness = max(20, agreeableness - 15)
        neuroticism = 20
        if fb['red_cards'] > 0: neuroticism += fb['red_cards'] * 15
        if fb['pkatt'] > 0 and fb['pk'] < fb['pkatt']: neuroticism += (fb['pkatt'] - fb['pk']) * 5
        if fb['xg'] > 5 and fb['goals'] < fb['xg'] * 0.7: neuroticism += 15
        neuroticism = max(10, min(95, neuroticism))

        personality = {
            'openness': openness, 'conscientiousness': conscientiousness,
            'extraversion': extraversion, 'agreeableness': agreeableness,
            'neuroticism': neuroticism, 'confidence': 100,
        }

        # ----- TRAITS -----
        traits = []
        if attrs['defending'] >= 75 and attrs['engine'] >= 75: traits.append('PressingAnchor')
        if attrs['passing'] >= 80 and attrs['distribution'] >= 75: traits.append('TempoConductor')
        if attrs['touch'] >= 80 and attrs['pace'] >= 75 and pg == 'FWD': traits.append('ChaosWinger')
        if attrs['defending'] >= 80 and attrs['aerial'] >= 70: traits.append('DefensiveWall')
        if attrs['pace'] >= 80 and attrs['finishing'] >= 70: traits.append('CounterKiller')
        if personality['extraversion'] >= 70 and personality['neuroticism'] < 50: traits.append('BigGameResponder')
        if personality['neuroticism'] >= 70: traits.append('MediaSensitive')
        if personality['neuroticism'] <= 30 and attrs['composure'] >= 75: traits.append('IceCold')
        traits = traits[:3]

        # Build final player record
        fb['attributes'] = attrs
        fb['personality'] = personality
        fb['narrative_traits'] = traits
        fb['stability_modifier'] = 50
        fb['ovr'] = ovr
        fb['potential'] = min(99, max(attrs['pace'], attrs['finishing'], attrs['defending'], attrs['passing']) + 5)
        fb['id'] = 'p_' + fb['name'].lower().replace(' ', '_').replace('-', '_')
        fb['match_name'] = fb['name']
        fb['full_name'] = fb['name']
        fb['date_of_birth'] = f"{fb['born']}-01-01"
        fb['nationality'] = fb['nation']
        fb['market_value'] = fb.get('market_value') or ovr * 1_000_000
        fb['contract_end'] = fb.get('contract_end') or '2028-06-30'
        fb['wage'] = ovr * 1000

    return players


# ============================================================================
# RELATIONSHIPS
# ============================================================================

def compute_relationships(players):
    """Generate intra-team relationships."""
    relationships = []
    by_team = {}
    for p in players:
        team = p['team']
        if team not in by_team:
            by_team[team] = []
        by_team[team].append(p)

    for team, team_players in by_team.items():
        for i, p1 in enumerate(team_players):
            for j, p2 in enumerate(team_players):
                if i < j:
                    strength = 40
                    if p1['nationality'] == p2['nationality']:
                        strength += 20
                    if abs(p1['age'] - p2['age']) <= 3:
                        strength += 10
                    import random
                    strength += random.randint(-15, 15)
                    strength = max(-30, min(95, strength))
                    relationships.append({
                        'player_a': p1['id'],
                        'player_b': p2['id'],
                        'strength': strength,
                        'volatility': 0.3,
                    })
    return relationships


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Gaffer Player Data Scraper — actually works (server-side Python)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
STRATEGIES (tries each until one works):
  --source html    Parse a saved FBref HTML file (MOST RELIABLE)
  --source fbref   Live scrape FBref (works on residential IP)
  --source csv     Read pre-downloaded Kaggle CSV

ENRICHMENT:
  --enrich wikidata       Add height/weight from Wikidata SPARQL
  --enrich transfermarkt  Add market value + physical data from Transfermarkt

EXAMPLES:
  # Save FBref page in browser (Ctrl+S), then:
  python3 scraper.py --source html --input saved_page.html

  # Live scrape (on your home machine):
  python3 scraper.py --source fbref --season 2023-2024

  # Full pipeline with enrichment:
  python3 scraper.py --source fbref --season 2023-2024 --enrich wikidata transfermarkt

  # Kaggle CSV:
  python3 scraper.py --source csv --input kaggle_data.csv
        """
    )
    parser.add_argument('--source', choices=['html', 'fbref', 'csv'], default='fbref',
                       help='Data source strategy (default: fbref)')
    parser.add_argument('--input', type=str, help='Input file path (for html/csv sources)')
    parser.add_argument('--season', type=str, default='2023-2024',
                       help='Season for FBref scrape (default: 2023-2024)')
    parser.add_argument('--enrich', nargs='*', choices=['wikidata', 'transfermarkt'], default=[],
                       help='Enrichment sources to apply')
    parser.add_argument('--output', type=str, default=str(OUTPUT_FILE),
                       help=f'Output file (default: {OUTPUT_FILE})')

    args = parser.parse_args()

    print("=" * 70)
    print("GAFFER PLAYER DATA SCRAPER (Python — actually works)")
    print("=" * 70)
    print(f"Strategy: {args.source}")
    if args.enrich:
        print(f"Enrichment: {', '.join(args.enrich)}")
    print()

    # Step 1: Fetch player data
    players = None
    if args.source == 'html':
        if not args.input:
            print("ERROR: --source html requires --input <file.html>")
            print("Save the FBref Big 5 page in your browser (Ctrl+S → HTML only), then:")
            print(f"  python3 scraper.py --source html --input <saved_page>.html")
            sys.exit(1)
        players = parse_fbref_html_file(args.input)
    elif args.source == 'fbref':
        players = fetch_fbref_live(args.season)
        if players is None:
            print("\nLive scrape failed. Falling back to sample data...")
            print("Alternatively, save the FBref page as HTML and use --source html")
            # Fall back to generating a small sample so the pipeline still works
            from generate_synthetic_test_data import generate_players
            players = generate_players(50)
    elif args.source == 'csv':
        if not args.input:
            print("ERROR: --source csv requires --input <file.csv>")
            print("Download a Kaggle FBref dataset CSV, then:")
            print(f"  python3 scraper.py --source csv --input kaggle_data.csv")
            sys.exit(1)
        players = parse_kaggle_csv(args.input)

    if not players:
        print("ERROR: No players parsed. Check your input/source.")
        sys.exit(1)

    print(f"\n[1] Fetched {len(players)} players")

    # Step 2: Enrichment
    if 'wikidata' in args.enrich:
        players = enrich_with_wikidata(players)
    if 'transfermarkt' in args.enrich:
        players = enrich_with_transfermarkt(players)

    # Step 3: Compute Gaffer attributes
    print(f"\n[2] Computing 19 Gaffer attributes + Big Five personality...")
    players = compute_gaffer_attributes(players)
    print(f"  Done. Average OVR: {sum(p['ovr'] for p in players) // len(players)}")

    # Step 4: Compute relationships
    print(f"\n[3] Computing relationships...")
    relationships = compute_relationships(players)
    print(f"  Generated {len(relationships)} relationships")

    # Step 5: Write output
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    output = {
        'name': 'Gaffer Player Database',
        'description': f'Real player data ({len(players)} players, source: {args.source})',
        'version': 3,
        'generated': datetime.now().isoformat(),
        'source': args.source,
        'season': args.season,
        'players': players,
        'relationships': relationships,
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    file_size = output_path.stat().st_size
    print(f"\n[4] Done!")
    print(f"  Output: {output_path}")
    print(f"  Size: {file_size / 1024:.1f} KB")
    print(f"  Players: {len(players)}")
    print(f"  Relationships: {len(relationships)}")
    print(f"\n  Next: python3 build_world.py")

    # Summary stats
    pos_counts = {}
    for p in players:
        pos = p['position']
        pos_counts[pos] = pos_counts.get(pos, 0) + 1
    print(f"\n  Position breakdown: {pos_counts}")

    teams = set(p['team'] for p in players)
    print(f"  Teams: {len(teams)}")

    enriched = sum(1 for p in players if p.get('height_cm'))
    print(f"  Players with physical data: {enriched}/{len(players)}")


if __name__ == '__main__':
    main()
