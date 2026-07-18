export interface TeamColors {
  primary: string;
  secondary: string;
}

export type KitPattern = "Solid" | "Stripes" | "Hoops" | "HalfAndHalf" | "Diagonal";

export interface FacilitiesData {
  training: number;
  medical: number;
  scouting: number;
  /** V99.11 A5: Youth academy facility level (1-5) */
  youth: number;
}

export interface SponsorshipData {
  sponsor_name: string;
  base_value: number;
  remaining_weeks: number;
  bonus_criteria: unknown[];
}

export type TransactionKind =
  | "PrizeMoney"
  | "ContractTermination"
  | "BoardSupport"
  | "CommercialCampaign";

export interface FinancialTransactionData {
  date: string;
  description: string;
  amount: number;
  kind: TransactionKind;
}

export interface TeamSeasonRecord {
  season: number;
  league_position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
}

export type PlayerRole =
  // Goalkeeper
  | "Standard"
  | "BallPlayingKeeper"
  | "SweeperKeeper"
  // Center Back
  | "Stopper"
  | "CoverCB"
  | "BallPlayingCB"
  // Full Back / Wing Back
  | "AttackingFB"
  | "DefensiveFB"
  | "InvertedFB"
  | "WingBack"
  // Defensive Midfielder
  | "AnchorMan"
  | "BallWinner"
  | "DeepLyingPlaymaker"
  // Central Midfielder
  | "BoxToBox"
  | "Carrilero"
  | "Mezzala"
  // Attacking Midfielder
  | "AdvancedPlaymaker"
  | "ShadowStriker"
  // Wide
  | "WideForward"
  | "InsideForward"
  | "InvertedWinger"
  // Striker
  | "Poacher"
  | "TargetMan"
  | "DeepLyingForward"
  | "False9"
  | "PressingForward"
  | "CompleteForward";

export type BuildUpStyle = "Short" | "Mixed" | "Long";
export type PitchWidth = "Narrow" | "Normal" | "Wide";
export type Tempo = "Patient" | "Direct";
export type DefensiveLine = "VeryLow" | "Low" | "Medium" | "High";
export type PressingIntensity = "Passive" | "Medium" | "Aggressive";
export type DefensiveShape = "Stretched" | "Normal" | "Compact";
export type MarkingStyle = "Zonal" | "Mixed" | "ManToMan";
export type CounterPressDuration = "None" | "Short" | "Long";
export type BreakSpeed = "Slow" | "Medium" | "Fast";

export interface TacticsPhaseSettings {
  build_up_style: BuildUpStyle;
  width: PitchWidth;
  tempo: Tempo;
  defensive_line: DefensiveLine;
  pressing_intensity: PressingIntensity;
  defensive_shape: DefensiveShape;
  marking_style: MarkingStyle;
  counter_press_duration: CounterPressDuration;
  break_speed: BreakSpeed;
}

export interface TeamMatchRolesData {
  captain: string | null;
  vice_captain: string | null;
  penalty_taker: string | null;
  free_kick_taker: string | null;
  corner_taker: string | null;
}

/** Optional media paths for team branding. resolveLocalMediaPath accepts local paths only. */
export interface TeamMediaData {
  /** Local path to a team logo image; remote URLs and data URIs are ignored. */
  logo?: string;
}

export interface TeamData {
  id: string;
  name: string;
  short_name: string;
  country: string;
  city: string;
  stadium_name: string;
  stadium_capacity: number;
  finance: number;
  manager_id: string | null;
  reputation: number;
  wage_budget: number;
  transfer_budget: number;
  season_income: number;
  season_expenses: number;
  financial_ledger?: FinancialTransactionData[];
  formation: string;
  play_style: string;
  training_focus: string;
  training_intensity: string;
  training_schedule: string;
  founded_year: number;
  colors: TeamColors;
  kit_pattern?: KitPattern;
  media?: TeamMediaData;
  facilities?: FacilitiesData;
  sponsorship?: SponsorshipData | null;
  starting_xi_ids: string[];
  /** V100 P2 (Issue #39): Players in the reserve squad (lightweight). */
  reserve_squad_ids?: string[];
  /** V100 P2 (Issue #39): Reserve team recent results (scorelines like "2-1"). */
  reserve_results?: string[];
  match_roles?: TeamMatchRolesData;
  player_roles?: Record<string, PlayerRole>;
  tactics_phase?: TacticsPhaseSettings;
  form: string[];
  history: TeamSeasonRecord[];
}

export interface PlayerSeasonStats {
  appearances: number;
  goals: number;
  assists: number;
  clean_sheets: number;
  yellow_cards: number;
  red_cards: number;
  avg_rating: number;
  minutes_played: number;
  shots?: number;
  shots_on_target?: number;
  passes_completed?: number;
  passes_attempted?: number;
  tackles_won?: number;
  interceptions?: number;
  fouls_committed?: number;
}

export interface CareerEntry {
  season: number;
  team_id: string;
  team_name: string;
  appearances: number;
  goals: number;
  assists: number;
}

export type PlayerMovementKind =
  | "permanent_transfer"
  | "loan_start"
  | "loan_return"
  | "loan_to_buy"
  | "free_agent_signing"
  | "released";

export interface PlayerMovementEntry {
  date: string;
  kind: PlayerMovementKind;
  from_team_id?: string | null;
  from_team_name?: string | null;
  to_team_id?: string | null;
  to_team_name?: string | null;
  fee?: number | null;
  loan_end_date?: string | null;
}

export interface ContractExitIntentData {
  kind: "let_expire";
  set_on: string;
  reason?: string | null;
}

export interface ContractRenewalStateData {
  // Backend `RenewalSessionStatus` (domain/player.rs) uses serde default enum
  // representation — PascalCase variant names on the wire. Do not confuse with
  // the lowercase `session_status` in command responses, which goes through a
  // dedicated `serialize_session_status()` helper on the Rust side.
  status: "Idle" | "Open" | "Agreed" | "Blocked" | "Stalled";
  manager_blocked_until?: string | null;
  last_attempt_date?: string | null;
  last_assistant_attempt_date?: string | null;
  last_outcome?: string | null;
  conversation_round: number;
  exit_intent?: ContractExitIntentData | null;
}

export interface PlayerMoraleCoreData {
  manager_trust: number;
  renewal_state?: ContractRenewalStateData | null;
}

export type PlayerSquadRole = "Senior" | "Youth";

/** Optional media paths for player visuals. resolveLocalMediaPath accepts local paths only. */
export interface PlayerMediaData {
  /** Local path to a player face image; remote URLs and data URIs are ignored. */
  face?: string;
}

export interface PlayerData {
  id: string;
  match_name: string;
  full_name: string;
  date_of_birth: string;
  nationality: string;
  football_nation?: string;
  media?: PlayerMediaData;
  position: string;
  natural_position: string;
  alternate_positions: string[];
  footedness?: string;
  weak_foot?: number;
  /** V100 P1 (Issue #1): Player height in centimeters. */
  height_cm?: number;
  /** V100 P1 (Issue #1): Player weight in kilograms. */
  weight_kg?: number;
  /** V100 P1 (Issue #3): Position the player is retraining to (null = no retraining). */
  training_position_focus?: string | null;
  /** V100 P1 (Issue #3): Accumulated retraining XP (0-100). */
  retraining_xp?: number;
  training_focus: string | null;
  attributes: {
    pace: number; burst: number; engine: number; power: number; agility: number;
    passing: number; distribution: number; touch: number; finishing: number; defending: number; aerial: number;
    anticipation: number; vision: number; decisions: number; composure: number; leadership: number;
    shot_stopping: number; commanding: number; playing_out: number;
  };
  condition: number;
  morale: number;
  injury: null | { name: string; days_remaining: number };
  team_id: string | null;
  retired: boolean;
  squad_role?: PlayerSquadRole;
  contract_end: string | null;
  wage: number;
  market_value: number;
  /** V99.4 T4.4: Release clause amount (null = no clause). */
  release_clause?: number | null;
  /** V99.4 T4.1: Player fame tier. */
  fame?: string;
  stats: PlayerSeasonStats;
  career: CareerEntry[];
  /** V99.4 T2.1: Career milestone events (debut, first goal, etc.) */
  career_events?: CareerEvent[];
  movement_history?: PlayerMovementEntry[];
  transfer_listed: boolean;
  loan_listed: boolean;
  /** V100 P0-8 (Issue #5): When true, AI clubs will not bid for this player. */
  not_for_sale: boolean;
  /** V99.4 T1.3: Date the player requested a transfer (null = no request). */
  transfer_request_date?: string | null;
  transfer_offers: TransferOfferData[];
  loan_offers?: LoanOfferData[];
  active_loan?: ActiveLoanData | null;
  traits: string[];
  morale_core?: PlayerMoraleCoreData;
  /** Position-weighted overall rating (1–99). Computed by the backend from the player's natural position. */
  ovr?: number;
  /** Player's potential ceiling (1–99). Set at generation; higher than ovr for young players. */
  potential?: number;
  /** Jersey/squad number (1–99). Null if unassigned. */
  jersey_number?: number | null;
  personality?: PersonalityProfile;
  stability_modifier?: number;
  /** Gaffer Phase 2 — narrative traits (Technical Identity + Psychological + Social) */
  narrative_traits?: string[];
}

export interface PersonalityProfile { openness:number;conscientiousness:number;extraversion:number;agreeableness:number;neuroticism:number;confidence:number; }
export type PressureResponse = "Thrives"|"Channels"|"Folds"|"Escalates";
export type MediaSensitivity = "ThickSkinned"|"Average"|"Sensitive"|"Brittle";
export interface ExplanationEntry { reason:string; source:string|null; }
export interface ExplanationChain { entries:ExplanationEntry[]; }
export interface SpreadsheetAttributes { pace:number;burst:number;engine:number;power:number;agility:number;passing:number;distribution:number;touch:number;finishing:number;defending:number;aerial:number;anticipation:number;vision:number;decisions:number;composure:number;leadership:number;shot_stopping:number;commanding:number;playing_out:number;body_avg:number;ball_avg:number;head_avg:number;gloves_avg:number;overall:number; }
export interface ScoutingKnowledge { player_id:string;reveal_tier:string;times_scouted:number;last_scouted_date:string;last_scout_id:string;last_judging_ability:number;last_judging_potential:number;fuzzed_attributes:Record<string,number>;fuzzed_ovr:number|null;fuzzed_potential:number|null;revealed_personality:PersonalityProfile|null;revealed_narrative_traits:string[];revealed_stability_label:string|null;known_condition:number|null;known_morale:number|null;known_injury:string|null; }
export interface PlayerMeaningSnapshot { display_name:string;club:string;role_identity_label:string;archetype_label:string;locker_room_role:string;narrative_status_tag:string;current_form_label:string;confidence_label:string;fatigue_label:string;trajectory_label:string;stability_label:string;stability_description:string;pressure_response_type:PressureResponse;media_sensitivity:MediaSensitivity;rivalry_trigger_flag:boolean;morale_state:string;strongest_positive_link:string|null;strongest_negative_link:string|null;chemistry_score:number;clique_membership:string[];growth_vector:string;training_alignment_label:string;mentor_bonus_flag:boolean;spreadsheet_attributes:SpreadsheetAttributes;role_identity_explanation:ExplanationChain;stability_explanation:ExplanationChain;morale_state_explanation:ExplanationChain;pressure_response_explanation:ExplanationChain;scouting_knowledge:ScoutingKnowledge|null; }
export interface SquadMeaningSnapshot { squad_harmony_score:number;tactical_coherence_score:number;pressure_level:string;media_heat:number;dressing_room_tension_flag:boolean;emerging_story_threads:string[];chemistry_hotspots:string[];fatigue_risk_band:string;identity_alignment_label:string;harmony_explanation:ExplanationChain; }
export interface MatchMeaningSnapshot { momentum_state:string;rivalry_intensity:number;turning_point_event_id:string|null;narrative_shift_label:string;pundit_tone_weight:number;resurfaced_memory_flag:string|null;archived_memory_used_flag:string|null; }
export interface MediaMeaningSnapshot { active_story_count:number;top_headline:string|null;pundit_disagreement_active:boolean;betting_sentiment_trend:string; }

export interface TransferOfferData {
  id: string;
  from_team_id: string;
  fee: number;
  wage_offered: number;
  last_manager_fee: number | null;
  negotiation_round: number;
  suggested_counter_fee: number | null;
  status:
    | "Pending"
    | "PendingRegistration"
    | "Accepted"
    | "Rejected"
    | "Withdrawn";
  date: string;
  registration_date?: string | null;
}

export interface LoanOfferData {
  id: string;
  from_team_id: string;
  parent_team_id: string;
  start_date: string;
  end_date: string;
  wage_contribution_pct: number;
  buy_option_fee?: number | null;
  last_manager_wage_contribution_pct?: number | null;
  last_manager_end_date?: string | null;
  last_manager_buy_option_fee?: number | null;
  negotiation_round?: number;
  suggested_wage_contribution_pct?: number | null;
  suggested_end_date?: string | null;
  suggested_buy_option_fee?: number | null;
  status:
    | "Pending"
    | "PendingRegistration"
    | "Accepted"
    | "Rejected"
    | "Withdrawn";
  date: string;
  /** V99.4 T4.5: One-time loan fee paid to parent club. */
  loan_fee?: number;
  /** V99.4 T4.5: If true, parent club can recall in January. */
  recall_clause?: boolean;
  /** V99.4 T4.5: Minimum % of games the player must start. */
  playtime_guarantee_pct?: number;
}

export interface ActiveLoanData {
  parent_team_id: string;
  loan_team_id: string;
  start_date: string;
  end_date: string;
  wage_contribution_pct: number;
  buy_option_fee?: number | null;
  loan_start_minutes?: number;
  loan_start_appearances?: number;
  development_reported_minutes?: number;
  development_reported_appearances?: number;
}

export interface StaffData {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  football_nation?: string;
  role: "AssistantManager" | "Coach" | "Scout" | "Physio";
  attributes: {
    coaching: number;
    judgingAbility: number;
    judgingPotential: number;
    physiotherapy: number;
  };
  team_id: string | null;
  specialization: string | null;
  wage: number;
  contract_end: string | null;
}

export interface MessageAction {
  id: string;
  label: string;
  action_type:
  | "Acknowledge"
  | "Dismiss"
  | { NavigateTo: { route: string } }
  | { ChooseOption: { options: MessageActionOption[] } };
  resolved: boolean;
  label_key?: string;
}

export interface MessageActionOption {
  id: string;
  label: string;
  description: string;
  label_key?: string;
  description_key?: string;
}

export interface ScoutReportData {
  player_id: string;
  player_name: string;
  position: string;
  nationality: string;
  dob: string;
  team_name: string | null;
  pace: number | null;
  finishing: number | null;
  passing: number | null;
  touch: number | null;
  defending: number | null;
  physical: number | null;
  condition: number | null;
  morale: number | null;
  avg_rating: number | null;
  rating_key: string;
  potential_key: string;
  confidence_key: string;
}

export interface DelegatedRenewalCaseMessageData {
  player_id: string;
  player_name: string;
  status: string;
  agreed_wage?: number | null;
  agreed_years?: number | null;
  note_key?: string;
  note_params?: Record<string, string>;
}

export interface DelegatedRenewalReportMessageData {
  success_count: number;
  failure_count: number;
  stalled_count: number;
  cases: DelegatedRenewalCaseMessageData[];
}

export interface PlayerSelectionOptions {
  openRenewal?: boolean;
  openTermination?: boolean;
}

export interface MessageContext {
  team_id: string | null;
  team_name?: string | null;
  player_id: string | null;
  fixture_id: string | null;
  youth_target_position?: string | null;
  youth_search_region?: string | null;
  youth_search_objective?: string | null;
  youth_prospects?: PlayerData[];
  match_result: null | {
    home_team_id: string;
    home_team_name?: string;
    away_team_id: string;
    away_team_name?: string;
    home_goals: number;
    away_goals: number;
  };
  scout_report?: ScoutReportData;
  delegated_renewal_report?: DelegatedRenewalReportMessageData;
}

export interface MessageData {
  id: string;
  subject: string;
  body: string;
  sender: string;
  sender_role: string;
  date: string;
  read: boolean;
  category: string;
  priority: string;
  actions: MessageAction[];
  context: MessageContext;
  subject_key?: string;
  body_key?: string;
  sender_key?: string;
  sender_role_key?: string;
  i18n_params?: Record<string, string>;
}

export interface ManagerCareerStats {
  matches_managed: number;
  wins: number;
  draws: number;
  losses: number;
  trophies: number;
  best_finish: number | null;
}

export interface ManagerCareerEntry {
  team_id: string;
  team_name: string;
  start_date: string;
  end_date: string | null;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  best_league_position: number | null;
}

export interface ManagerData {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  football_nation?: string;
  birth_country?: string | null;
  reputation: number;
  satisfaction: number;
  fan_approval: number;
  team_id: string | null;
  warning_stage?: number;
  career_stats: ManagerCareerStats;
  career_history: ManagerCareerEntry[];
}

export interface FixtureData {
  id: string;
  competition_id?: string;
  matchday: number;
  date: string;
  home_team_id: string;
  away_team_id: string;
  competition:
  | "League"
  | "Cup"
  | "ContinentalClub"
  | "InternationalClub"
  | "InternationalNation"
  | "Friendly"
  | "FriendlyCup"
  | "PreseasonTournament";
  status: "Scheduled" | "InProgress" | "Completed";
  result: null | {
    home_goals: number;
    away_goals: number;
    home_scorers: { player_id: string; minute: number }[];
    away_scorers: { player_id: string; minute: number }[];
    report?: CompactMatchReportData | null;
    /** Shootout score when a knockout tie was decided on penalties. */
    home_penalties?: number | null;
    away_penalties?: number | null;
  };
  /** V99.4 T1.1: Weather condition for the match (empty = not generated). */
  weather?: string;
  /** V99.4 T1.5: Fixture importance level. */
  importance?: string;
}

export interface CompactMatchEventData {
  minute: number;
  event_type: string;
  side: "Home" | "Away";
  player_id: string | null;
  secondary_player_id: string | null;
}

export interface CompactTeamMatchStatsData {
  possession_pct: number;
  shots: number;
  shots_on_target: number;
  fouls: number;
  corners: number;
  yellow_cards: number;
  red_cards: number;
}

export interface CompactMatchReportData {
  total_minutes: number;
  home_stats: CompactTeamMatchStatsData;
  away_stats: CompactTeamMatchStatsData;
  events: CompactMatchEventData[];
}

export interface StandingData {
  team_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
}

export interface CompletedTransferData {
  date: string;
  from_team_id: string;
  to_team_id: string;
  player_id: string;
  fee: number;
}

export interface TransferRumourData {
  id: string;
  date: string;
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
}

export interface LeagueData {
  id: string;
  name: string;
  kind?: string;
  scope?: string;
  season: number;
  region_id?: string | null;
  country_id?: string | null;
  required_region_ids?: string[];
  participant_ids?: string[];
  rules?: {
    format: "LeagueTable" | "Knockout" | "GroupAndKnockout";
    counts_in_season_flow: boolean;
  };
  fixtures: FixtureData[];
  standings: StandingData[];
  groups?: {
    id: string;
    name: string;
    team_ids: string[];
    standings: StandingData[];
  }[];
  knockout_rounds?: {
    id: string;
    name: string;
    fixture_ids: string[];
    bye_team_ids?: string[];
    completed: boolean;
  }[];
  transfer_log?: CompletedTransferData[];
  transfer_rumours?: TransferRumourData[];
  priority?: number;
  name_key?: string;
}

export interface WorldCupChampionData {
  year: number;
  nation_code: string;
  nation_name: string;
}

export interface NationalTeamData {
  id: string;
  name: string;
  football_nation: string;
  region_id?: string | null;
  squad_player_ids: string[];
  manager_name?: string | null;
  reputation: number;
  fixtures: FixtureData[];
  name_key?: string | null;
}

export interface WorldRegionData {
  id: string;
  name: string;
  country_codes: string[];
}

export type SeasonPhase = "Preseason" | "InSeason" | "PostSeason";

export type TransferWindowStatus = "Closed" | "Open" | "DeadlineDay";

export interface TransferWindowContextData {
  status: TransferWindowStatus;
  opens_on: string | null;
  closes_on: string | null;
  days_until_opens: number | null;
  days_remaining: number | null;
}

export interface SeasonContextData {
  phase: SeasonPhase;
  season_start: string | null;
  season_end: string | null;
  days_until_season_start: number | null;
  transfer_window: TransferWindowContextData;
}

export interface NewsMatchScore {
  home_team_id: string;
  away_team_id: string;
  home_goals: number;
  away_goals: number;
}

export interface NewsArticle {
  id: string;
  headline: string;
  body: string;
  source: string;
  date: string;
  category: string;
  team_ids: string[];
  player_ids: string[];
  match_score: NewsMatchScore | null;
  read: boolean;
  headline_key?: string;
  body_key?: string;
  source_key?: string;
  i18n_params?: Record<string, string>;
}

export interface SeasonAwardEntryData {
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  value: number;
}

export interface SeasonManagerAwardEntryData {
  manager_id: string;
  manager_name: string;
  team_id: string;
  team_name: string;
  value: number;
  win_rate: number;
}

export interface SeasonAwardsData {
  golden_boot: SeasonAwardEntryData[];
  assist_king: SeasonAwardEntryData[];
  player_of_year: SeasonAwardEntryData[];
  clean_sheet_king: SeasonAwardEntryData[];
  most_appearances: SeasonAwardEntryData[];
  young_player: SeasonAwardEntryData[];
  manager_of_season: SeasonManagerAwardEntryData[];
}

export interface BoardObjective {
  id: string;
  description: string;
  target: number;
  objective_type: string;
  met: boolean;
}

export interface ScoutingAssignment {
  id: string;
  scout_id: string;
  player_id: string;
  days_remaining: number;
}

export interface YouthScoutingAssignment {
  id: string;
  scout_id: string;
  region?: string;
  objective?: string;
  target_position?: string | null;
  days_remaining: number;
}

export interface GameStateData {
  clock: {
    current_date: string;
    start_date: string;
  };
  manager: ManagerData;
  managers?: ManagerData[];
  teams: TeamData[];
  players: PlayerData[];
  staff: StaffData[];
  messages: MessageData[];
  news: NewsArticle[];
  competitions?: LeagueData[];
  national_teams?: NationalTeamData[];
  world_history?: {
    world_cup_champions?: WorldCupChampionData[];
  };
  // Authored competition definitions (resolved at game creation; present on
  // imported worlds that ship their own competitions).
  competitionDefinitions?: unknown;
  active_region_ids?: string[];
  active_competition_ids?: string[];
  regions?: WorldRegionData[];
  league: LeagueData | null;
  scouting_assignments: ScoutingAssignment[];
  youth_scouting_assignments?: YouthScoutingAssignment[];
  board_objectives: BoardObjective[];
  season_context?: SeasonContextData;
  available_staff_market_last_activity_date?: string | null;
  extra_translations?: Record<string, Record<string, unknown>>;
  package_lockfile?: Array<{ id: string; version: string; hash: string }>;
}

// V99.4 T2.1: Career event types
export interface CareerEvent {
  event_type: string;
  season: number;
  date: string;
  team_id?: string | null;
  team_name?: string | null;
  description: string;
}
