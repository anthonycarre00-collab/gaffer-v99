-- V100 P0-5 (Issue #38): Add `saves` column to player_match_stats table.
--
-- Previously saves were only tracked at the team level (shots_on_target),
-- never credited to the GK. This meant a GK making 10 world-class saves
-- got the same 6.0 rating as one who wasn't tested. The new column
-- persists per-GK save counts so:
--   - Season totals reflect GK performance
--   - "Player of the Year" awards can consider GKs
--   - Career history shows GK save counts
--
-- SQLite ALTER TABLE ADD COLUMN is idempotent for our purposes: existing
-- rows get the DEFAULT (0), new rows write the actual save count.
-- The column is nullable-equivalent (NOT NULL DEFAULT 0) so old saves
-- load without issues.

ALTER TABLE player_match_stats ADD COLUMN saves INTEGER NOT NULL DEFAULT 0;
