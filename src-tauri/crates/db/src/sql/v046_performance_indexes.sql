-- Wave-E: Add performance indexes to the players, messages, and news tables.
--
-- These tables are queried by team_id (squad lookups) and by date (pruning),
-- but have no indexes. Without indexes, these queries do full table scans
-- over 5,000+ players or 5,000+ messages.
--
-- CREATE INDEX IF NOT EXISTS is safe to run on tables that already have
-- the index (new saves + existing saves).

CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(date);
CREATE INDEX IF NOT EXISTS idx_news_date ON news(date);
CREATE INDEX IF NOT EXISTS idx_staff_team_id ON staff(team_id);
