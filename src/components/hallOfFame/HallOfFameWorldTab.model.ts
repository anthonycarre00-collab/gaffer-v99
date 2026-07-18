import type { GameStateData, PlayerData, TeamData, TeamSeasonRecord } from "../../store/gameStore";

export interface HallOfFameLegend {
  player: PlayerData;
  appearances: number;
  goals: number;
  assists: number;
  titles: number;
  lastClubName: string | null;
  finalSeason: number | null;
}

export interface PastChampionEntry {
  season: number;
  team: TeamData;
  record: TeamSeasonRecord;
}

function championSeasonsByTeam(gameState: GameStateData): Map<string, Set<number>> {
  const champions = new Map<string, Set<number>>();

  for (const team of gameState.teams) {
    const seasons = new Set<number>();

    for (const record of team.history) {
      if (record.league_position === 1) {
        seasons.add(record.season);
      }
    }

    if (seasons.size > 0) {
      champions.set(team.id, seasons);
    }
  }

  return champions;
}

/**
 * V100 P0-10 (Issue #22): Build a map of team_id -> competition_id so the
 * Hall of Fame can prioritise the user's domestic league when sorting.
 * Falls back to "" if a team isn't in any competition (e.g. international sides).
 */
function buildTeamCompetitionMap(
  gameState: GameStateData,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const comp of gameState.competitions ?? []) {
    for (const teamId of comp.participant_ids ?? []) {
      // First competition wins (domestic leagues are usually seeded first).
      if (!map.has(teamId)) {
        map.set(teamId, comp.id);
      }
    }
  }
  return map;
}

/**
 * V100 P0-10 (Issue #22): Resolve the competition id of the user's club
 * so we can prioritise their league in Hall of Fame sorting.
 * Returns null when the user is unemployed or their team isn't in any competition.
 */
function resolveUserCompetitionId(
  gameState: GameStateData,
  userTeamId: string | null | undefined,
): string | null {
  if (!userTeamId) return null;
  for (const comp of gameState.competitions ?? []) {
    if ((comp.participant_ids ?? []).includes(userTeamId)) {
      return comp.id;
    }
  }
  return null;
}

export function deriveHallOfFameLegends(
  gameState: GameStateData,
  userTeamId?: string | null,
): HallOfFameLegend[] {
  const championSeasons = championSeasonsByTeam(gameState);
  const teamCompMap = buildTeamCompetitionMap(gameState);
  const userCompId = resolveUserCompetitionId(gameState, userTeamId);

  return gameState.players
    .filter((player) => player.retired && player.career.length > 0)
    .map((player) => {
      const appearances = player.career.reduce(
        (total, entry) => total + entry.appearances,
        0,
      );
      const goals = player.career.reduce((total, entry) => total + entry.goals, 0);
      const assists = player.career.reduce(
        (total, entry) => total + entry.assists,
        0,
      );
      const lastEntry = [...player.career].sort(
        (left, right) => right.season - left.season,
      )[0] ?? null;
      const titles = player.career.reduce((count, entry) => {
        return count + (championSeasons.get(entry.team_id)?.has(entry.season) ? 1 : 0);
      }, 0);

      // V100 P0-10 (Issue #22): Detect whether this legend's last club
      // plays in the user's domestic league. We only consider the last
      // club because that's the most relevant connection for the user.
      const lastTeamCompId = lastEntry ? (teamCompMap.get(lastEntry.team_id) ?? null) : null;
      const inUserLeague = userCompId !== null && lastTeamCompId === userCompId;

      return {
        player,
        appearances,
        goals,
        assists,
        titles,
        lastClubName: lastEntry?.team_name ?? null,
        finalSeason: lastEntry?.season ?? null,
        _inUserLeague: inUserLeague,
      } as HallOfFameLegend & { _inUserLeague: boolean };
    })
    .sort((left, right) => {
      // V100 P0-10 (Issue #22): Legends from the user's league come first.
      const leftInLeague = (left as HallOfFameLegend & { _inUserLeague: boolean })._inUserLeague ? 1 : 0;
      const rightInLeague = (right as HallOfFameLegend & { _inUserLeague: boolean })._inUserLeague ? 1 : 0;
      if (leftInLeague !== rightInLeague) return rightInLeague - leftInLeague;
      return right.titles - left.titles
        || right.appearances - left.appearances
        || right.goals - left.goals
        || left.player.full_name.localeCompare(right.player.full_name);
    });
}

export function derivePastChampions(
  gameState: GameStateData,
  userTeamId?: string | null,
): PastChampionEntry[] {
  const teamCompMap = buildTeamCompetitionMap(gameState);
  const userCompId = resolveUserCompetitionId(gameState, userTeamId);

  return gameState.teams
    .flatMap((team) => {
      return team.history
        .filter((record) => record.league_position === 1)
        .map((record) => ({ season: record.season, team, record }));
    })
    .sort((left, right) => {
      // V100 P0-10 (Issue #22): Champions from the user's domestic league
      // come first. We compare the competition id of the winning team
      // against the user's competition id.
      const leftCompId = teamCompMap.get(left.team.id) ?? null;
      const rightCompId = teamCompMap.get(right.team.id) ?? null;
      const leftInLeague = userCompId !== null && leftCompId === userCompId ? 1 : 0;
      const rightInLeague = userCompId !== null && rightCompId === userCompId ? 1 : 0;
      if (leftInLeague !== rightInLeague) return rightInLeague - leftInLeague;
      return right.season - left.season
        || right.record.won - left.record.won
        || left.team.name.localeCompare(right.team.name);
    });
}
