-- Gaffer Phase 2-7: Game-level state persistence
-- Note: These columns are already in v001_initial_schema.sql for new saves.
-- This migration is a no-op for new saves (columns already exist).
-- For old pre-Gaffer saves, they would need ALTER TABLE, but SQLite
-- doesn't support conditional ALTER. Since v001 is always applied first
-- for new saves, this is just a marker.

CREATE TABLE IF NOT EXISTS _gaffer_game_state_marker (id INTEGER PRIMARY KEY);
DROP TABLE IF EXISTS _gaffer_game_state_marker;
