import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { PlayerMeaningSnapshot, SquadMeaningSnapshot, MatchMeaningSnapshot, MediaMeaningSnapshot } from './types';

interface MeaningStore {
  playerSnapshots: Record<string, PlayerMeaningSnapshot>;
  squadSnapshot: SquadMeaningSnapshot | null;
  matchSnapshot: MatchMeaningSnapshot | null;
  mediaSnapshot: MediaMeaningSnapshot | null;
  loadingPlayer: boolean;
  loadingSquad: boolean;
  lastError: string | null;
  fetchPlayerMeaning: (playerId: string) => Promise<void>;
  fetchSquadMeaning: () => Promise<void>;
  fetchMatchMeaning: () => Promise<void>;
  fetchMediaMeaning: () => Promise<void>;
  clearAll: () => void;
}

export const useMeaningStore = create<MeaningStore>((set) => ({
  playerSnapshots: {}, squadSnapshot: null, matchSnapshot: null, mediaSnapshot: null,
  loadingPlayer: false, loadingSquad: false, lastError: null,
  fetchPlayerMeaning: async (playerId) => {
    set({ loadingPlayer: true, lastError: null });
    try { const s = await invoke<PlayerMeaningSnapshot>('get_player_meaning', { playerId }); set((st) => ({ playerSnapshots: { ...st.playerSnapshots, [playerId]: s }, loadingPlayer: false })); }
    catch (e) { set({ loadingPlayer: false, lastError: String(e) }); }
  },
  fetchSquadMeaning: async () => {
    set({ loadingSquad: true });
    try { const s = await invoke<SquadMeaningSnapshot>('get_squad_meaning'); set({ squadSnapshot: s, loadingSquad: false }); }
    catch (e) { set({ loadingSquad: false, lastError: String(e) }); }
  },
  fetchMatchMeaning: async () => { try { const s = await invoke<MatchMeaningSnapshot>('get_match_meaning'); set({ matchSnapshot: s }); } catch (e) { set({ lastError: String(e) }); } },
  fetchMediaMeaning: async () => { try { const s = await invoke<MediaMeaningSnapshot>('get_media_meaning'); set({ mediaSnapshot: s }); } catch (e) { set({ lastError: String(e) }); } },
  clearAll: () => set({ playerSnapshots: {}, squadSnapshot: null, matchSnapshot: null, mediaSnapshot: null, lastError: null }),
}));

export function usePlayerMeaning(playerId: string | null | undefined) {
  const snapshot = playerId ? useMeaningStore((s) => s.playerSnapshots[playerId]) : undefined;
  const fetch = useMeaningStore((s) => s.fetchPlayerMeaning);
  const loading = useMeaningStore((s) => s.loadingPlayer);
  if (playerId && !snapshot && !loading) { queueMicrotask(() => fetch(playerId)); }
  return { snapshot, loading };
}
