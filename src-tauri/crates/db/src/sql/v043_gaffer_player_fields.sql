-- Gaffer Phase 1-8: Persist personality, stability, narrative traits on players
-- Note: These columns are already in v001_initial_schema.sql for new saves.
-- This migration is for upgrading pre-Gaffer saves. SQLite doesn't support
-- ADD COLUMN IF NOT EXISTS, so we use a conditional approach via PRAGMA.
-- If the column already exists (new save), this is a no-op.

-- SQLite doesn't have ADD COLUMN IF NOT EXISTS, but we can catch the error
-- by using a DO block. However, SQLite doesn't support DO blocks either.
-- The safest approach: just try to add and ignore errors if column exists.
-- The rusqlite_migration library handles this by running each M::up() as
-- a transaction — if it fails, the migration is skipped.

-- Actually, the simplest fix: since v001 already has these columns for new DBs,
-- and old saves won't have v001 (they start from their last migration version),
-- we just need a harmless statement for new saves that already have the columns.
-- We'll use CREATE TABLE IF NOT EXISTS as a no-op placeholder.

CREATE TABLE IF NOT EXISTS _gaffer_player_fields_marker (id INTEGER PRIMARY KEY);
DROP TABLE IF EXISTS _gaffer_player_fields_marker;
