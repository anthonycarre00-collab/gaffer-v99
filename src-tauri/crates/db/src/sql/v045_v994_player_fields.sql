-- P0-1: Add V99.4 player fields that were missing from the schema.
--
-- These fields exist on the Player struct but were never persisted.
-- Every save/reload reset them to defaults, silently breaking:
--   - Player fame (V99.4 T4.1) — reset to Unknown on every load
--   - Release clauses (V99.4 T4.4) — disappeared on save
--   - Career events (V99.4 T2.1) — season of milestones lost
--   - Partnerships (V99.4 T2.2) — goal combo tracking reset
--   - Transfer requests (V99.4 T1.3) — low_morale_days counter reset
--
-- SQLite doesn't support ADD COLUMN IF NOT EXISTS, but since v001
-- already creates the players table without these columns, the ALTER
-- TABLE will succeed for all existing saves. For brand-new saves
-- (which also use v001), the columns are added by this migration too.

ALTER TABLE players ADD COLUMN fame TEXT NOT NULL DEFAULT 'Unknown';
ALTER TABLE players ADD COLUMN release_clause INTEGER;
ALTER TABLE players ADD COLUMN career_events_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE players ADD COLUMN partnerships_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE players ADD COLUMN transfer_request_date TEXT;
ALTER TABLE players ADD COLUMN low_morale_days INTEGER NOT NULL DEFAULT 0;

-- P0-2: Add personality_json to managers table.
-- V99.4 T1.7 manager personalities (tactical style, transfer philosophy, etc.)
-- were generated but never persisted. Every save/reload reset to default.

ALTER TABLE managers ADD COLUMN personality_json TEXT DEFAULT NULL;

-- P0-3: Add board_type to teams table.
-- V99.4 T4.7 board types (SugarDaddy, Sensible, PennyPinching, Ambitious)
-- were set but never persisted. Every save/reload reset to Sensible.

ALTER TABLE teams ADD COLUMN board_type TEXT NOT NULL DEFAULT 'Sensible';
