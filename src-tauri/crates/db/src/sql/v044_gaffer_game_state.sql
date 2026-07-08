-- Gaffer Phase 2-7: Persist relationship_graph, memory_store, media_engine,
-- scouting_knowledge as JSON blobs on the game row.
-- Without this, every save/load wipes all Gaffer state to defaults.

ALTER TABLE game ADD COLUMN relationship_graph_json TEXT DEFAULT NULL;
ALTER TABLE game ADD COLUMN memory_store_json TEXT DEFAULT NULL;
ALTER TABLE game ADD COLUMN media_engine_json TEXT DEFAULT NULL;
ALTER TABLE game ADD COLUMN scouting_knowledge_json TEXT DEFAULT NULL;
