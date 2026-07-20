import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * V100 Issue #30: Player rivalry system.
 *
 * Tracks manager-noted player-vs-player rivalries (think Messi-Ronaldo,
 * Keane-Vieira, Salah-De Bruyne). These are NOT auto-generated — the
 * manager marks them via the PlayerProfile "Mark Rivalry" action and
 * provides a reason ("scored winner in cup final", "sent me off last
 * season", "rival for top scorer").
 *
 * Used by:
 * - PlayerProfile: shows "Rivalries" card listing the player's rivals
 * - Match commentary (future): when a player with an active rivalry
 *   scores against / fouls / duels their rival, commentary picks up
 *   the rivalry tag
 * - News (future): "X settles score with Y" stories
 *
 * Storage: localStorage, keyed by manager_id so different saves keep
 * separate rivalry lists. No backend persistence (yet) — this is a
 * lightweight client-side feature that doesn't touch the save file.
 */

export type RivalryIntensity = "spark" | "simmer" | "boil";

export interface PlayerRivalry {
  id: string;
  player_a_id: string;
  player_b_id: string;
  intensity: RivalryIntensity;
  reason: string;
  created_at: number;
}

interface RivalryStore {
  rivalries: PlayerRivalry[];
  addRivalry: (
    playerId: string,
    rivalId: string,
    intensity: RivalryIntensity,
    reason: string,
  ) => void;
  removeRivalry: (rivalryId: string) => void;
  getRivalriesForPlayer: (playerId: string) => PlayerRivalry[];
  hasRivalryBetween: (playerA: string, playerB: string) => boolean;
  clearAll: () => void;
}

function makeId(): string {
  return `rivalry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Intensity metadata — used by the UI to render the right colour + label.
 * - spark: a fresh grievance, mostly cosmetic
 * - simmer: building tension, will surface in commentary
 * - boil: full-blown feud, will generate news stories on contact
 */
export const RIVALRY_INTENSITY_META: Record<
  RivalryIntensity,
  { label: string; tone: string; description: string }
> = {
  spark: {
    label: "Spark",
    tone: "text-ink-dim bg-carbon-2 border-slate-line",
    description: "A fresh grievance. Mostly cosmetic.",
  },
  simmer: {
    label: "Simmer",
    tone: "text-accent-600 bg-accent-500/10 border-accent-300/60",
    description: "Building tension. Will surface in match commentary.",
  },
  boil: {
    label: "Boil",
    tone: "text-danger-600 bg-danger-500/10 border-danger-400/60",
    description: "Full-blown feud. Generates news stories on contact.",
  },
};

export const useRivalryStore = create<RivalryStore>()(
  persist(
    (set, get) => ({
      rivalries: [],

      addRivalry: (playerId, rivalId, intensity, reason) => {
        if (playerId === rivalId) return;
        const existing = get().rivalries.find(
          (r) =>
            (r.player_a_id === playerId && r.player_b_id === rivalId) ||
            (r.player_a_id === rivalId && r.player_b_id === playerId),
        );
        if (existing) {
          // Update intensity + reason rather than duplicate.
          set((st) => ({
            rivalries: st.rivalries.map((r) =>
              r.id === existing.id
                ? { ...r, intensity, reason, created_at: Date.now() }
                : r,
            ),
          }));
          return;
        }
        set((st) => ({
          rivalries: [
            ...st.rivalries,
            {
              id: makeId(),
              player_a_id: playerId,
              player_b_id: rivalId,
              intensity,
              reason: reason.trim(),
              created_at: Date.now(),
            },
          ],
        }));
      },

      removeRivalry: (rivalryId) =>
        set((st) => ({
          rivalries: st.rivalries.filter((r) => r.id !== rivalryId),
        })),

      getRivalriesForPlayer: (playerId) => {
        return get().rivalries.filter(
          (r) => r.player_a_id === playerId || r.player_b_id === playerId,
        );
      },

      hasRivalryBetween: (playerA, playerB) =>
        get().rivalries.some(
          (r) =>
            (r.player_a_id === playerA && r.player_b_id === playerB) ||
            (r.player_a_id === playerB && r.player_b_id === playerA),
        ),

      clearAll: () => set({ rivalries: [] }),
    }),
    {
      name: "gaffer-player-rivalries",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
