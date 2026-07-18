import { invoke } from "@tauri-apps/api/core";

import type { GameStateData } from "../store/gameStore";
import type { ScoutingAssignment, StaffData, YouthScoutingAssignment } from "../store/types";

export interface StaffSlice {
  team_staff: StaffData[];
  available_staff: StaffData[];
  scouting_assignments: ScoutingAssignment[];
  youth_scouting_assignments: YouthScoutingAssignment[];
}

export async function getStaff(teamId: string): Promise<StaffSlice> {
  return invoke<StaffSlice>("get_staff", { teamId });
}

export async function hireStaff(staffId: string): Promise<GameStateData> {
  return invoke<GameStateData>("hire_staff", { staffId });
}

export async function releaseStaff(staffId: string): Promise<GameStateData> {
  return invoke<GameStateData>("release_staff", { staffId });
}
/**
 * V100 P2 (Issue #17): Assistant manager advice response.
 */
export interface AssistantAdviceData {
    advice: string;
    topic: string;
    tone: "warning" | "positive" | "neutral";
}

/**
 * V100 P2 (Issue #17): Get weekly advice from the assistant manager.
 * Returns Gaffer-voice advice based on the squad's current state.
 */
export async function getAssistantManagerAdvice(): Promise<AssistantAdviceData> {
    return invoke<AssistantAdviceData>("get_assistant_manager_advice");
}
