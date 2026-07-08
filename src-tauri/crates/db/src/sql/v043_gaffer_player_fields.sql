-- Gaffer Phase 1-8: Persist personality, stability, narrative traits on players
-- Without this, every save/load wipes Big Five personality, stability_modifier,
-- and narrative_traits to defaults — making all Gaffer systems non-functional.

ALTER TABLE players ADD COLUMN personality_json TEXT DEFAULT NULL;
ALTER TABLE players ADD COLUMN stability_modifier INTEGER NOT NULL DEFAULT 50;
ALTER TABLE players ADD COLUMN narrative_traits_json TEXT DEFAULT NULL;
ALTER TABLE players ADD COLUMN former_team_id TEXT DEFAULT NULL;
ALTER TABLE players ADD COLUMN retired_season INTEGER DEFAULT NULL;
