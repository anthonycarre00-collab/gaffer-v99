use rusqlite_migration::{M, Migrations};

/// Number of migrations defined. Keep in sync with the vec in `all_migrations`.
pub const MIGRATION_COUNT: usize = 46;

/// All migrations for a per-save game database.
/// Each save `.db` file gets this schema applied via `rusqlite_migration`.
pub fn all_migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("sql/v001_initial_schema.sql")),
        M::up(include_str!("sql/v002_training_groups.sql")),
        M::up(include_str!("sql/v003_alternate_positions.sql")),
        M::up(include_str!("sql/v004_natural_position.sql")),
        M::up(include_str!("sql/v005_player_training_focus.sql")),
        M::up(include_str!("sql/v006_team_match_roles.sql")),
        M::up(include_str!("sql/v007_team_financial_ledger.sql")),
        M::up(include_str!("sql/v008_team_sponsorship.sql")),
        M::up(include_str!("sql/v009_team_facilities.sql")),
        M::up(include_str!("sql/v010_player_morale_core.sql")),
        M::up(include_str!("sql/v011_player_footedness.sql")),
        M::up(include_str!("sql/v012_fixture_competition.sql")),
        M::up(include_str!("sql/v013_player_fitness.sql")),
        M::up(include_str!("sql/v014_football_identity.sql")),
        M::up(include_str!("sql/v015_match_stats_history.sql")),
        M::up(include_str!("sql/v016_manager_warning_stage.sql")),
        M::up(include_str!("sql/v017_vacant_team_days.sql")),
        M::up(include_str!("sql/v018_transfer_log.sql")),
        M::up(include_str!("sql/v019_player_squad_role.sql")),
        M::up(include_str!("sql/v020_player_ovr_potential.sql")),
        M::up(include_str!("sql/v021_youth_scouting_assignments.sql")),
        M::up(include_str!("sql/v022_youth_scouting_target_position.sql")),
        M::up(include_str!("sql/v023_youth_scouting_search_profile.sql")),
        M::up(include_str!("sql/v024_transfer_rumours.sql")),
        M::up(include_str!("sql/v025_player_retired.sql")),
        M::up(include_str!("sql/v026_world_history_archive.sql")),
        M::up(include_str!("sql/v027_available_staff_market_activity.sql")),
        M::up(include_str!("sql/v028_entity_media.sql")),
        M::up(include_str!("sql/v029_competition_save_metadata.sql")),
        M::up(include_str!("sql/v030_competitions_and_national_teams.sql")),
        M::up(include_str!("sql/v031_competition_groups.sql")),
        M::up(include_str!("sql/v032_competition_berths.sql")),
        M::up(include_str!("sql/v033_competition_season_start.sql")),
        M::up(include_str!("sql/v034_player_jersey_number.sql")),
        M::up(include_str!("sql/v035_team_kit_pattern.sql")),
        M::up(include_str!("sql/v036_player_jersey_number_unique.sql")),
        M::up(include_str!("sql/v037_team_tactics.sql")),
        M::up(include_str!("sql/v038_national_team_name_key.sql")),
        M::up(include_str!("sql/v039_game_extra_translations.sql")),
        M::up(include_str!("sql/v040_player_loan_state.sql")),
        M::up(include_str!("sql/v041_player_movement_history.sql")),
        M::up(include_str!("sql/v042_game_package_lockfile.sql")),
        M::up(include_str!("sql/v043_gaffer_player_fields.sql")),
        M::up(include_str!("sql/v044_gaffer_game_state.sql")),
        M::up(include_str!("sql/v045_v994_player_fields.sql")),
        M::up(include_str!("sql/v046_performance_indexes.sql")),
    ])
}
