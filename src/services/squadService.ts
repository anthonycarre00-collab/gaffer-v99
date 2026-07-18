import { invoke } from "@tauri-apps/api/core";

import type { GameStateData, PlayerData } from "../store/gameStore";
import type { KitPattern, PlayerRole, PlayerSquadRole, TacticsPhaseSettings } from "../store/types";

export async function getSquad(teamId: string): Promise<PlayerData[]> {
    return invoke<PlayerData[]>("get_squad", { teamId });
}

export async function setPlayerSquadRole(
    playerId: string,
    squadRole: PlayerSquadRole,
): Promise<GameStateData> {
    return invoke<GameStateData>("set_player_squad_role", {
        playerId,
        squadRole,
    });
}

export async function setStartingXi(
    playerIds: string[],
): Promise<GameStateData> {
    return invoke<GameStateData>("set_starting_xi", { playerIds });
}

export async function setPlayerRole(
    playerId: string,
    role: PlayerRole | null,
): Promise<GameStateData> {
    return invoke<GameStateData>("set_player_role", {
        playerId,
        role: role ?? undefined,
    });
}

/**
 * V100 P1 (Issue #3): Set the position a player is retraining to learn.
 * Pass null to cancel retraining. Success is never 100% guaranteed (80%
 * chance at XP=100). The player accumulates XP during training sessions.
 */
export async function setPlayerTrainingPosition(
    playerId: string,
    position: string | null,
): Promise<GameStateData> {
    return invoke<GameStateData>("set_player_training_position", {
        playerId,
        position: position ?? undefined,
    });
}

/**
 * V100 P2 (Issue #39): Move a player to the reserve squad. The player
 * remains a member of the club but gets reserve-team minutes for
 * fitness/development/punishment.
 */
export async function moveToReserve(
    playerId: string,
): Promise<GameStateData> {
    return invoke<GameStateData>("move_to_reserve", { playerId });
}

/**
 * V100 P2 (Issue #39): Promote a player from the reserve squad back to
 * the senior squad.
 */
export async function promoteFromReserve(
    playerId: string,
): Promise<GameStateData> {
    return invoke<GameStateData>("promote_from_reserve", { playerId });
}

export async function assignJerseyNumber(
    playerId: string,
    jerseyNumber: number | null,
): Promise<GameStateData> {
    return invoke<GameStateData>("assign_jersey_number", {
        playerId,
        jerseyNumber,
    });
}

export async function setTacticsPhase(
    patch: Partial<TacticsPhaseSettings>,
): Promise<GameStateData> {
    return invoke<GameStateData>("set_tactics_phase", {
        buildUpStyle: patch.build_up_style,
        width: patch.width,
        tempo: patch.tempo,
        defensiveLine: patch.defensive_line,
        pressingIntensity: patch.pressing_intensity,
        defensiveShape: patch.defensive_shape,
        markingStyle: patch.marking_style,
        counterPressDuration: patch.counter_press_duration,
        breakSpeed: patch.break_speed,
    });
}

export async function setTeamKitPattern(
    kitPattern: KitPattern,
): Promise<GameStateData> {
    return invoke<GameStateData>("set_team_kit_pattern", {
        kitPattern,
    });
}