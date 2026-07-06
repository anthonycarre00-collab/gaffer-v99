use rusqlite_migration::{M, Migrations};

/// Number of migrations defined. Keep in sync with the vec in `all_migrations`.
pub const MIGRATION_COUNT: usize = 42;

/// All migrations for a per-save game database.
/// Each save `.db` file gets this schema applied via `rusqlite_migration`.
pub fn all_migrations() -> Migrations<'static> {
    Migrations::new(vec![
        // V1: Initial schema — all game entity tables
        M::up(include_str!("sql/v001_initial_schema.sql")),
        // V2: Training groups per team
        // V3: Alternate positions per player
        // V4: Natural/preferred position per player
        // V5: Per-player training focus override
        // V6: Team match roles defaults
        // V7: Team financial ledger
        // V8: Team sponsorship state
        // V9: Team facilities state
        // V10: Hidden per-player morale architecture state
        // V11: Player footedness identity fields
        // V12: Fixture competition metadata
        // V13: Player long-term fitness value
        // V14: Explicit football identity fields for teams and people
        // V15: Historical player and team match stats
        // V16: Manager board-warning stage tracking (per-club, resets on hire)
        // V17: Persist vacancy-age tracking for delayed AI manager replacements
        // V18: Completed transfer log for world transfer-centre views
        // V19: Explicit senior versus youth squad assignment for players
        // V20: Persist computed OVR and potential so they survive save/load
        // V21: Persist youth recruitment scouting assignments separately from player scouting
        // V22: Persist target position for youth recruitment scouting assignments
        // V23: Persist region and objective for youth recruitment scouting assignments
        // V24: Persist structured transfer rumours for the world transfer centre
        // V25: Persist retired player state for seasonal aging and hall-of-fame work
        // V26: Persist world-history archives for rivalries and historical season awards
        // V27: Persist available staff market activity for monthly rotation
        // V28: Persist optional local media paths for teams and players
        // V29: Save metadata for world package versions and active simulation scope
        // V30: Persist multi-competition and national-team state
        // V31: Persist group stages for group-and-knockout competitions
        // V32: Persist qualification berths on competitions
        // V33: Season start month and day per competition for hemisphere-aware scheduling
        // V34: Optional jersey/squad number per player (1-99, NULL = unassigned)
        // V35: Kit pattern for team jersey visual (Solid, Stripes, Hoops, HalfAndHalf, Diagonal)
        // V36: Enforce per-team jersey number uniqueness at DB level
        // V37: Per-player tactical roles and phase blueprint settings
        // V38: i18n name key for national teams
        // V39: Persist extra translations bundle from world packages
        // V40: Persist loan offer history and active loan contracts
        // V41: Persist per-player transfer and loan movement history
        // V42: Persist installed-package lockfile (id, version, hash) for save reproducibility
    ])
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_migrations_are_valid() {
        let migrations = all_migrations();
        migrations.validate().expect("migrations should be valid");
    }

    #[test]
    fn test_apply_migrations_to_empty_db() {
        let mut conn = Connection::open_in_memory().unwrap();
        let migrations = all_migrations();
        migrations
            .to_latest(&mut conn)
            .expect("migrations should apply cleanly");

        // Verify all expected tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(
            tables.contains(&"game_meta".to_string()),
            "missing game_meta"
        );
        assert!(tables.contains(&"managers".to_string()), "missing managers");
        assert!(tables.contains(&"teams".to_string()), "missing teams");
        assert!(tables.contains(&"players".to_string()), "missing players");
        assert!(
            tables.contains(&"player_match_stats".to_string()),
            "missing player_match_stats"
        );
        assert!(tables.contains(&"staff".to_string()), "missing staff");
        assert!(
            tables.contains(&"team_match_stats".to_string()),
            "missing team_match_stats"
        );
        assert!(tables.contains(&"league".to_string()), "missing league");
        assert!(tables.contains(&"fixtures".to_string()), "missing fixtures");
        assert!(
            tables.contains(&"standings".to_string()),
            "missing standings"
        );
        assert!(tables.contains(&"messages".to_string()), "missing messages");
        assert!(
            tables.contains(&"transfer_log".to_string()),
            "missing transfer_log"
        );
        assert!(
            tables.contains(&"transfer_rumours".to_string()),
            "missing transfer_rumours"
        );
        assert!(tables.contains(&"news".to_string()), "missing news");
        assert!(
            tables.contains(&"board_objectives".to_string()),
            "missing board_objectives"
        );
        assert!(
            tables.contains(&"scouting_assignments".to_string()),
            "missing scouting_assignments"
        );
        assert!(
            tables.contains(&"youth_scouting_assignments".to_string()),
            "missing youth_scouting_assignments"
        );

        let game_meta_columns: Vec<String> = conn
            .prepare("PRAGMA table_info(game_meta)")
            .unwrap()
            .query_map([], |row| row.get(1))
            .unwrap()
            .filter_map(|row| row.ok())
            .collect();
        assert!(
            game_meta_columns.contains(&"world_history_json".to_string()),
            "missing game_meta.world_history_json"
        );
        assert!(
            game_meta_columns.contains(&"available_staff_market_last_activity_date".to_string()),
            "missing game_meta.available_staff_market_last_activity_date"
        );
        assert!(
            game_meta_columns.contains(&"extra_translations_json".to_string()),
            "missing game_meta.extra_translations_json"
        );

        let national_team_columns: Vec<String> = conn
            .prepare("PRAGMA table_info(national_teams)")
            .unwrap()
            .query_map([], |row| row.get(1))
            .unwrap()
            .filter_map(|row| row.ok())
            .collect();
        assert!(
            national_team_columns.contains(&"name_key".to_string()),
            "missing national_teams.name_key"
        );

        let team_columns: Vec<String> = conn
            .prepare("PRAGMA table_info(teams)")
            .unwrap()
            .query_map([], |row| row.get(1))
            .unwrap()
            .filter_map(|row| row.ok())
            .collect();
        assert!(
            team_columns.contains(&"media_json".to_string()),
            "missing teams.media_json"
        );

        let player_columns: Vec<String> = conn
            .prepare("PRAGMA table_info(players)")
            .unwrap()
            .query_map([], |row| row.get(1))
            .unwrap()
            .filter_map(|row| row.ok())
            .collect();
        assert!(
            player_columns.contains(&"media_json".to_string()),
            "missing players.media_json"
        );
        assert!(
            player_columns.contains(&"loan_offers".to_string()),
            "missing players.loan_offers"
        );
        assert!(
            player_columns.contains(&"active_loan".to_string()),
            "missing players.active_loan"
        );
        assert!(
            player_columns.contains(&"movement_history".to_string()),
            "missing players.movement_history"
        );
    }

    #[test]
    fn test_migrations_are_idempotent() {
        let mut conn = Connection::open_in_memory().unwrap();
        let migrations = all_migrations();
        migrations
            .to_latest(&mut conn)
            .expect("first apply should succeed");
        // Applying again should be a no-op (already at latest)
        migrations
            .to_latest(&mut conn)
            .expect("second apply should succeed (idempotent)");
    }

    #[test]
    fn test_schema_version_after_migration() {
        let mut conn = Connection::open_in_memory().unwrap();
        let migrations = all_migrations();
        migrations.to_latest(&mut conn).unwrap();

        let version: i64 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        // rusqlite_migration sets user_version to the number of applied migrations
        assert_eq!(
            version, MIGRATION_COUNT as i64,
            "expected schema version {} after migrations",
            MIGRATION_COUNT
        );
    }
}
