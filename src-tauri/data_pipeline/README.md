# Gaffer Data Pipeline

Gets real player data into the game. Three tools, used in sequence:

```
scraper.py  →  build_world.py  →  gaffer_world.json (bundled with game)
```

## Quick Start (3 strategies — pick whichever works for you)

### Strategy 1: Save FBref page as HTML (MOST RELIABLE — 100% works)

1. Go to https://fbref.com/en/comps/Big5/stats/players/Big-5-European-Leagues-Stats
2. Press `Ctrl+S` (or `Cmd+S` on Mac) → save as "Webpage, HTML Only"
3. Run:
```bash
pip install requests beautifulsoup4
python3 scraper.py --source html --input saved_page.html
```

This is guaranteed to work because it reads a local file — no fetching, no bot detection.

### Strategy 2: Live scrape FBref (works on your home machine)

```bash
pip install requests beautifulsoup4 cloudscraper
python3 scraper.py --source fbref --season 2023-2024
```

This works on residential IPs. If you get 403 (Cloudflare), use Strategy 1 or 3.

### Strategy 3: Pre-downloaded Kaggle CSV

1. Go to kaggle.com, search "FBref Big 5 leagues stats"
2. Download a CSV dataset (free Kaggle account required)
3. Run:
```bash
pip install requests beautifulsoup4
python3 scraper.py --source csv --input kaggle_data.csv
```

## Adding Physical Data (height, weight, market value)

The FBref Standard view doesn't include height/weight. Add them with enrichment:

```bash
# Height/weight from Wikidata (free, no auth, ~70% of notable players covered):
python3 scraper.py --source fbref --season 2023-2024 --enrich wikidata

# Market value + height/weight from Transfermarkt (heavier, rate-limited):
python3 scraper.py --source fbref --season 2023-2024 --enrich wikidata transfermarkt
```

Wikidata enrichment queries ~1 player/second (rate-limited). For 2500 players, that's ~40 minutes.
Transfermarkt enrichment queries ~1 player/3 seconds (strict rate limiting). For 2500 players, that's ~2 hours.

## Full Pipeline

```bash
# 1. Scrape (produces input/gaffer_players.json)
python3 scraper.py --source fbref --season 2023-2024 --enrich wikidata

# 2. Build world (produces databases/gaffer_world.json)
python3 build_world.py

# 3. The game loads gaffer_world.json automatically on New Game
```

## Why This Works (when the old scraper.html didn't)

The old `scraper.html` ran **in the browser** → blocked by CORS (a browser-only security restriction that prevents JavaScript from fetching cross-origin pages).

This Python scraper runs **on your machine** → no CORS, direct HTTP access to any URL. It's the same technology as `curl` or `wget` — just Python.

## Files

| File | Purpose |
|---|---|
| `scraper.py` | Main scraper — fetches FBref + enriches with Wikidata/Transfermarkt |
| `build_world.py` | Converts scraper output to WorldData format for the game |
| `generate_synthetic_test_data.py` | Generates 50 synthetic players for testing (no fetching needed) |
| `sample_fbref.html` | Sample FBref page for testing the parser offline |
| `requirements.txt` | Python dependencies |
| `input/` | Drop your data files here (gaffer_players.json, Kaggle CSVs, saved HTML) |
| `scraper.html` | DEPRECATED — old browser-based scraper (doesn't work due to CORS) |

## Testing the Parser (without internet)

```bash
# Test with bundled sample HTML (20 players, no fetching):
python3 scraper.py --source html --input sample_fbref.html

# Test with synthetic data generator (50 players):
python3 generate_synthetic_test_data.py
python3 build_world.py
```

## Troubleshooting

**"403 Forbidden" from FBref**
→ You're on a datacenter/cloud IP. Use `--source html` (save the page manually) or `--source csv` (Kaggle download).

**"cloudscraper not installed"**
→ Run `pip install cloudscraper`. This library bypasses basic Cloudflare challenges.

**Wikidata enrichment is slow**
→ It's rate-limited to 1 query/second. For 2500 players, expect ~40 minutes. You can reduce the rate limit with `--rate-limit 0.5` (but Wikidata may block you).

**Transfermarkt enrichment is very slow**
→ Transfermarkt has strict rate limiting (3 seconds between requests). For 2500 players, expect ~2 hours. Consider skipping it and using Wikidata only.

**No physical data (height/weight) for most players**
→ Wikidata covers ~70% of notable players. Lesser-known players won't have height/weight data. The game falls back to position-appropriate defaults (DEF: 185cm/80kg, MID: 180cm/74kg, FWD: 180cm/76kg, GK: 190cm/85kg).

## Alternative Data Sources (not yet implemented)

If you want even more comprehensive data, consider:

- **API-Football** (api-sports.io) — paid but has photos, full stats, market values. Free tier: 100 req/day.
- **football-data.org** — free API with player data for major leagues. Rate limited to 10 req/min.
- **StatsBomb open data** (github.com/statsbomb/open-data) — free match event data (more granular than FBref but harder to aggregate to season stats).
