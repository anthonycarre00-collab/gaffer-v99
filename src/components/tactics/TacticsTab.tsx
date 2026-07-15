import type { DragEvent, JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
 GameStateData,
 PlayerData,
 PlayerSelectionOptions,
 TeamMatchRolesData,
} from "../../store/gameStore";
import { useGameStore } from "../../store/gameStore";
import { useTranslation } from "react-i18next";
import { setPlayerRole, setTacticsPhase as setTacticsPhaseService } from "../../services/squadService";
import { useFetchedSquad } from "../../hooks/useFetchedSquad";
import type { TacticsPhaseSettings } from "../../store/types";

import {
 applyLineupDrop,
 applyLineupSwap,
 buildAssignBestFitSlot,
 buildActivePositionMap,
 buildDemoteFromStartingXi,
 buildPitchRows,
 buildPitchSlotRows,
 buildPromoteToStartingXi,
 type DragState,
 type PitchSlotRow,
 type SquadSection,
} from "../squad/SquadTab.helpers";
import {
 TACTICS_PRESETS,
 buildTacticsPitchSlots,
 buildTacticsRoster,
 countOutOfPositionPlayers,
 findTacticsPresetBySetup,
 filterAndSortTacticsPlayers,
 getSelectedAndComparePlayers,
 resolveStartingXiIds,
 type SortKey,
} from "./TacticsTab.helpers";
import TacticsPitch from "./TacticsPitch";
import TacticsPlayerList from "./TacticsPlayerList";
import TacticsRightPanel from "./TacticsRightPanel";
import {
 buildCustomTacticsStorageKey,
 loadCustomTactics,
 saveCustomTactics,
} from "./TacticsCustomTactics.helpers";
import {
 buildUpdatedMatchRolesForAssignment,
 resolveEffectiveMatchRoles,
} from "./TacticsRoles.helpers";
import TacticsCommandBar, {
 type TacticsLibraryEntry,
} from "./TacticsCommandBar";
import TacticsPlayerFocusPanel from "./TacticsPlayerFocusPanel";
import { PlayingStyleHero } from "./PlayingStyleHero";
import { StyleGuidancePanel } from "./StyleGuidancePanel";

interface TacticsTabProps {
 gameState: GameStateData | null;
 onSelectPlayer: (id: string, options?: PlayerSelectionOptions) => void;
 onGameUpdate: (g: GameStateData) => void;
}

function isPlayerEligibleForLineup(
 player: PlayerData | null | undefined,
): boolean {
 return Boolean(player && !player.injury);
}

export default function TacticsTab({
 gameState,
 onSelectPlayer,
 onGameUpdate,
}: TacticsTabProps): JSX.Element {
 const { t } = useTranslation();
 const sessionState = useGameStore((s) => s.sessionState);
 const teamId = sessionState?.manager?.team_id ?? gameState?.manager?.team_id ?? null;
 const clockDate = sessionState?.clock.current_date ?? gameState?.clock.current_date ?? "";
 const [fetchedSquad] = useFetchedSquad(teamId, clockDate);
 const initialTeam = sessionState?.team ?? gameState?.teams?.find((t) => t.id === teamId) ?? null;
 const initialPreset = initialTeam
 ? findTacticsPresetBySetup(
 initialTeam.formation || "4-4-2",
 initialTeam.play_style || "Balanced",
 )
 : null;
 const [playerSearch, setPlayerSearch] = useState("");
 const [positionFilter, setPositionFilter] = useState("All");
 // V99: Sub-tab navigation for the tactics screen.
 type TacticsSubTab = "pitch" | "selection" | "style" | "setPieces";
 const [activeSubTab, setActiveSubTab] = useState<TacticsSubTab>("pitch");
 const sortKey: SortKey = "pos";
 const sortDir: "asc" | "desc" = "asc";
 const [dragState, setDragState] = useState<DragState | null>(null);
 const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
 const [pendingStartingXiIds, setPendingStartingXiIds] = useState<
 string[] | null
 >(null);
 const [presetAnchorId, setPresetAnchorId] = useState<string | null>(
 initialPreset?.id ?? null,
 );
 const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
 const [selectedPlayerSection, setSelectedPlayerSection] =
 useState<SquadSection | null>(null);
 const [comparePlayerId, setComparePlayerId] = useState<string | null>(null);
 const [comparePlayerSection, setComparePlayerSection] =
 useState<SquadSection | null>(null);
 const [customTactics, setCustomTactics] = useState<TacticsLibraryEntry[]>(() =>
 gameState ? loadCustomTactics(gameState) : [],
 );
 const [activeTacticId, setActiveTacticId] = useState<string | null>(
 initialPreset ? `preset:${initialPreset.id}` : null,
 );
 const [draftTacticName, setDraftTacticName] = useState(
 initialPreset?.id
 ? t(`tactics.presetNames.${initialPreset.id}`, initialPreset.id)
 : t("tactics.customTactic"),
 );
 const dragStateRef = useRef<DragState | null>(null);
 const hoveredSlotRef = useRef<number | null>(null);
 const dragPreviewRef = useRef<HTMLDivElement | null>(null);
 const hydratedCustomTacticsScopeRef = useRef<string | null>(null);

 const team = sessionState?.team ?? gameState?.teams?.find((t) => t.id === teamId) ?? null;
 const players = fetchedSquad ?? gameState?.players ?? [];
 const roster = team ? buildTacticsRoster(players, team.id) : [];
 const customTacticsStorageKey = gameState ? buildCustomTacticsStorageKey(gameState) : null;

 const formation = team?.formation || "4-4-2";
 const activePlayStyle = team?.play_style || "Balanced";
 const savedStartingXiKey = (team?.starting_xi_ids || []).join(",");
 const playersById = useMemo(
 () => new Map(roster.map((player) => [player.id, player])),
 [roster],
 );
 const available = roster.filter((player) => !player.injury);
 const pitchRows = useMemo(() => buildPitchRows(formation), [formation]);

 const startingXiIds = useMemo(
 () =>
 resolveStartingXiIds({
 availablePlayers: available,
 formation,
 pendingStartingXiIds,
 playersById,
 savedStartingXiIds: team?.starting_xi_ids || [],
 }),
 [
 available.map((player) => player.id).join(","),
 formation,
 (team?.starting_xi_ids || []).join(","),
 (pendingStartingXiIds || []).join(","),
 roster.map((player) => player.id).join(","),
 ],
 );

 const startingXI = useMemo(
 () =>
 startingXiIds
 .map((id) => playersById.get(id))
 .filter((player): player is PlayerData => player != null),
 [playersById, startingXiIds],
 );

 useEffect(() => {
 if (!pendingStartingXiIds) return;
 if (savedStartingXiKey === pendingStartingXiIds.join(",")) {
 setPendingStartingXiIds(null);
 }
 }, [pendingStartingXiIds, savedStartingXiKey]);

 const pitchSlotRows = useMemo<PitchSlotRow[]>(
 () => buildPitchSlotRows(pitchRows, startingXiIds, playersById),
 [pitchRows, playersById, startingXiIds],
 );
 const pitchSlots = useMemo(
 () => buildTacticsPitchSlots(pitchSlotRows),
 [pitchSlotRows],
 );
 const xiIds = new Set(startingXiIds);
 const bench = roster.filter((player) => !xiIds.has(player.id));
 const xiActivePosition = useMemo(
 () => buildActivePositionMap(pitchSlotRows),
 [pitchSlotRows],
 );

 const { comparePlayer, selectedPlayer } = getSelectedAndComparePlayers(
 comparePlayerId,
 playersById,
 selectedPlayerId,
 );

 useEffect(() => {
 if (!gameState || !customTacticsStorageKey) return;
 hydratedCustomTacticsScopeRef.current = null;
 setCustomTactics(loadCustomTactics(gameState));
 }, [customTacticsStorageKey, gameState]);

 useEffect(() => {
 if (!gameState || !customTacticsStorageKey) return;
 if (hydratedCustomTacticsScopeRef.current !== customTacticsStorageKey) {
 hydratedCustomTacticsScopeRef.current = customTacticsStorageKey;
 return;
 }

 saveCustomTactics(gameState, customTactics);
 }, [customTactics, customTacticsStorageKey, gameState]);

 const canConfirmSwap = useMemo(() => {
 if (
 !selectedPlayerId ||
 !selectedPlayerSection ||
 !comparePlayerId ||
 !comparePlayerSection
 ) {
 return false;
 }

 if (
 (selectedPlayerSection === "bench" &&
 !isPlayerEligibleForLineup(
 selectedPlayerId ? playersById.get(selectedPlayerId) : null,
 )) ||
 (comparePlayerSection === "bench" &&
 !isPlayerEligibleForLineup(
 comparePlayerId ? playersById.get(comparePlayerId) : null,
 ))
 ) {
 return false;
 }

 const nextXiIds = applyLineupSwap(
 startingXiIds,
 { id: selectedPlayerId, from: selectedPlayerSection },
 comparePlayerId,
 comparePlayerSection,
 );

 return !!nextXiIds && nextXiIds.join(",") !== startingXiIds.join(",");
 }, [
 comparePlayerId,
 comparePlayerSection,
 playersById,
 selectedPlayerId,
 selectedPlayerSection,
 startingXiIds,
 ]);

 const filteredStartingXI = useMemo(
 () =>
 filterAndSortTacticsPlayers(
 startingXI,
 {
 playerSearch,
 positionFilter,
 section: "xi",
 xiActivePosition,
 },
 {
 section: "xi",
 sortDir,
 sortKey,
 xiActivePosition,
 },
 ),
 [
 startingXI,
 playerSearch,
 positionFilter,
 sortKey,
 sortDir,
 xiActivePosition,
 ],
 );
 const filteredBench = useMemo(
 () =>
 filterAndSortTacticsPlayers(
 bench,
 {
 playerSearch,
 positionFilter,
 section: "bench",
 xiActivePosition,
 },
 {
 section: "bench",
 sortDir,
 sortKey,
 xiActivePosition,
 },
 ),
 [bench, playerSearch, positionFilter, sortKey, sortDir, xiActivePosition],
 );

 const outOfPositionCount = countOutOfPositionPlayers(
 startingXI,
 xiActivePosition,
 );
 const effectiveMatchRoles = useMemo(
 () => resolveEffectiveMatchRoles(startingXI, team?.match_roles),
 [team?.match_roles, startingXI],
 );
 const matchedPreset = findTacticsPresetBySetup(formation, activePlayStyle);
 const anchoredPreset = presetAnchorId
 ? TACTICS_PRESETS.find((preset) => preset.id === presetAnchorId) ?? null
 : null;
 const isPresetDirty = Boolean(
 anchoredPreset &&
 (formation !== anchoredPreset.formation ||
 activePlayStyle !== anchoredPreset.playStyle),
 );
 const translatedPresetLibrary = useMemo<TacticsLibraryEntry[]>(
 () =>
 TACTICS_PRESETS.map((preset) => ({
 description: t(preset.descriptionKey),
 formation: preset.formation,
 id: `preset:${preset.id}`,
 name: t(`tactics.presetNames.${preset.id}`, preset.id),
 playStyle: preset.playStyle,
 sourcePresetName: null,
 type: "preset",
 })),
 [t],
 );
 const tacticLibrary = useMemo(
 () => [...customTactics, ...translatedPresetLibrary],
 [customTactics, translatedPresetLibrary],
 );
 const currentSetupFallbackTactic = useMemo<TacticsLibraryEntry>(
 () => ({
 description: t("tactics.customTacticDescription"),
 formation,
 id: "current:setup",
 name: t("tactics.customTactic"),
 playStyle: activePlayStyle,
 sourcePresetName: null,
 type: "custom",
 }),
 [activePlayStyle, formation, t],
 );
 const activeTactic =
 tacticLibrary.find((entry) => entry.id === activeTacticId) ??
 translatedPresetLibrary.find((entry) => entry.id === `preset:${matchedPreset?.id}`) ??
 currentSetupFallbackTactic;
 const isActiveCustomTactic = activeTactic?.type === "custom";
 const isActiveTacticDirty = Boolean(
 activeTactic &&
 (formation !== activeTactic.formation ||
 activePlayStyle !== activeTactic.playStyle ||
 (isActiveCustomTactic &&
 draftTacticName.trim().length > 0 &&
 draftTacticName.trim() !== activeTactic.name)),
 );
 const isCommandBarDirty = isActiveCustomTactic
 ? isActiveTacticDirty
 : isActiveTacticDirty || isPresetDirty;

 useEffect(() => {
 if (!matchedPreset) {
 return;
 }

 if (matchedPreset.id !== presetAnchorId) {
 setPresetAnchorId(matchedPreset.id);
 }

 const nextActivePresetId = `preset:${matchedPreset.id}`;
 setActiveTacticId((current) =>
 current?.startsWith("custom:") || current === nextActivePresetId
 ? current
 : nextActivePresetId,
 );
 }, [matchedPreset, presetAnchorId]);

 useEffect(() => {
 if (!activeTactic) {
 return;
 }

 const nextName =
 activeTactic.type === "custom"
 ? activeTactic.name
 : t(`tactics.presetNames.${activeTactic.id.replace("preset:", "")}`);
 setDraftTacticName(nextName);
 }, [activeTactic?.id, activeTactic?.name, activeTactic?.type, t]);

 function createCustomTacticEntry(
 overrides: Partial<TacticsLibraryEntry> = {},
 ): TacticsLibraryEntry {
 const customCount = customTactics.length + 1;
 const sourcePresetName =
 matchedPreset
 ? t(`tactics.presetNames.${matchedPreset.id}`, matchedPreset.id)
 : null;

 return {
 description:
 overrides.description ??
 t("tactics.customTacticDescription"),
 formation: overrides.formation ?? formation,
 id:
 overrides.id ??
 `custom:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
 name:
 overrides.name ??
 t("tactics.customTacticNumber", { count: customCount }),
 playStyle: overrides.playStyle ?? activePlayStyle,
 sourcePresetName:
 overrides.sourcePresetName === undefined
 ? sourcePresetName
 : overrides.sourcePresetName,
 type: "custom",
 };
 }

 async function applyTacticSelection(nextTactic: TacticsLibraryEntry): Promise<void> {
 if (formation !== nextTactic.formation) {
 const didUpdateFormation = await handleFormationChange(nextTactic.formation);
 if (!didUpdateFormation) {
 return;
 }
 }

 if (activePlayStyle !== nextTactic.playStyle) {
 const didUpdatePlayStyle = await handlePlayStyleChange(nextTactic.playStyle);
 if (!didUpdatePlayStyle) {
 return;
 }
 }

 setActiveTacticId(nextTactic.id);
 setDraftTacticName(nextTactic.name);

 if (nextTactic.id.startsWith("preset:")) {
 setPresetAnchorId(nextTactic.id.replace("preset:", ""));
 }
 }

 function handleCreateCustomTactic(): void {
 const nextTactic = createCustomTacticEntry();
 setCustomTactics((current) => [nextTactic, ...current]);
 setActiveTacticId(nextTactic.id);
 setDraftTacticName(nextTactic.name);
 }

 function handleDuplicateTactic(): void {
 const nextTactic = createCustomTacticEntry({
 description: activeTactic?.description,
 formation,
 name: t("tactics.copyOfTactic", {
 name: draftTacticName.trim() || activeTactic?.name || t("tactics.customTactic"),
 }),
 playStyle: activePlayStyle,
 sourcePresetName: activeTactic?.sourcePresetName ?? activeTactic?.name ?? null,
 });

 setCustomTactics((current) => [nextTactic, ...current]);
 setActiveTacticId(nextTactic.id);
 setDraftTacticName(nextTactic.name);
 }

 function handleSaveTactic(): void {
 const nextName = draftTacticName.trim() || t("tactics.customTactic");

 if (isActiveCustomTactic && activeTactic && customTactics.some((e) => e.id === activeTactic.id)) {
 setCustomTactics((current) =>
 current.map((entry) =>
 entry.id === activeTactic.id
 ? {
 ...entry,
 description: activeTactic.description,
 formation,
 name: nextName,
 playStyle: activePlayStyle,
 }
 : entry,
 ),
 );
 return;
 }

 const nextTactic = createCustomTacticEntry({
 description: activeTactic?.description,
 formation,
 name: nextName,
 playStyle: activePlayStyle,
 sourcePresetName: activeTactic?.name ?? null,
 });

 setCustomTactics((current) => [nextTactic, ...current]);
 setActiveTacticId(nextTactic.id);
 setDraftTacticName(nextTactic.name);
 }

 async function persistStartingXI(playerIds: string[]): Promise<void> {
 setPendingStartingXiIds(playerIds);
 try {
 const updated = await invoke<GameStateData>("set_starting_xi", {
 playerIds,
 });
 onGameUpdate(updated);
 } catch (error) {
 setPendingStartingXiIds(null);
 console.error("Failed to set starting XI:", error);
 }
 }

 async function handleFormationChange(nextFormation: string): Promise<boolean> {
 try {
 const updated = await invoke<GameStateData>("set_formation", {
 formation: nextFormation,
 });
 onGameUpdate(updated);
 return true;
 } catch (error) {
 console.error("Failed to set formation:", error);
 return false;
 }
 }

 async function handlePlayStyleChange(playStyle: string): Promise<boolean> {
 try {
 const updated = await invoke<GameStateData>("set_play_style", {
 playStyle,
 });
 onGameUpdate(updated);
 return true;
 } catch (error) {
 console.error("Failed to set play style:", error);
 return false;
 }
 }

 async function handleAssignBestFit(playerId: string): Promise<void> {
 const nextXiIds = buildAssignBestFitSlot(
 startingXiIds,
 playersById,
 formation,
 playerId,
 );

 if (!nextXiIds || nextXiIds.join(",") === startingXiIds.join(",")) {
 return;
 }

 await persistStartingXI(nextXiIds);
 clearLineupSelection();
 }

 async function handlePromoteBenchPlayer(playerId: string): Promise<void> {
 if (!isPlayerEligibleForLineup(playersById.get(playerId))) {
 return;
 }

 const nextXiIds = buildPromoteToStartingXi(
 startingXiIds,
 playersById,
 formation,
 playerId,
 );

 if (!nextXiIds || nextXiIds.join(",") === startingXiIds.join(",")) {
 return;
 }

 await persistStartingXI(nextXiIds);
 clearLineupSelection();
 }

 async function handleDemoteStarter(playerId: string): Promise<void> {
 const nextXiIds = buildDemoteFromStartingXi(
 startingXiIds,
 available,
 formation,
 playerId,
 );

 if (!nextXiIds || nextXiIds.join(",") === startingXiIds.join(",")) {
 return;
 }

 await persistStartingXI(nextXiIds);
 clearLineupSelection();
 }

 function clearLineupSelection(): void {
 setSelectedPlayerId(null);
 setSelectedPlayerSection(null);
 setComparePlayerId(null);
 setComparePlayerSection(null);
 }

 function setHoveredSlotValue(slotIndex: number | null): void {
 if (hoveredSlotRef.current === slotIndex) {
 return;
 }

 hoveredSlotRef.current = slotIndex;
 setHoveredSlot(slotIndex);
 }

 function resetDragState(): void {
 dragStateRef.current = null;
 setDragState(null);
 setHoveredSlotValue(null);
 }

 function applyLightweightDragPreview(event: DragEvent<HTMLElement>): void {
 if (!dragPreviewRef.current) {
 return;
 }

 if (typeof event.dataTransfer.setDragImage !== "function") {
 return;
 }

 event.dataTransfer.setDragImage(dragPreviewRef.current, 16, 16);
 }

 function handleDragStart(
 event: DragEvent<HTMLElement>,
 playerId: string,
 from: SquadSection,
 slotIndex: number | null = null,
 ): void {
 event.dataTransfer.effectAllowed = "move";
 event.dataTransfer.setData("text/plain", playerId);
 applyLightweightDragPreview(event);
 const nextDragState = { playerId, from, slotIndex };
 dragStateRef.current = nextDragState;
 setDragState(nextDragState);
 }

 function handleSlotDragOver(
 event: DragEvent<HTMLElement>,
 slotIndex: number,
 ): void {
 event.preventDefault();
 event.dataTransfer.dropEffect = "move";
 setHoveredSlotValue(slotIndex);
 }

 function handleSlotDragLeave(slotIndex: number): void {
 if (hoveredSlotRef.current !== slotIndex) {
 return;
 }

 setHoveredSlotValue(null);
 }

 async function handleSlotDrop(
 event: DragEvent<HTMLElement>,
 slotIndex: number,
 ): Promise<void> {
 event.preventDefault();
 const draggedPlayerId = event.dataTransfer.getData("text/plain");
 const currentDragState = dragStateRef.current ?? dragState;
 const resolvedDragState =
 currentDragState ??
 (draggedPlayerId
 ? {
 playerId: draggedPlayerId,
 from: xiIds.has(draggedPlayerId) ? "xi" : "bench",
 slotIndex: xiIds.has(draggedPlayerId)
 ? startingXiIds.indexOf(draggedPlayerId)
 : null,
 }
 : null);

 if (!resolvedDragState) return;

 if (
 resolvedDragState.from === "bench" &&
 !isPlayerEligibleForLineup(playersById.get(resolvedDragState.playerId))
 ) {
 resetDragState();
 return;
 }

 const nextXiIds = applyLineupDrop(
 startingXiIds,
 resolvedDragState,
 slotIndex,
 );
 if (nextXiIds.join(",") === startingXiIds.join(",")) {
 resetDragState();
 return;
 }

 await persistStartingXI(nextXiIds);
 clearLineupSelection();
 resetDragState();
 }

 async function handleLineupPlayerClick(
 playerId: string,
 section: SquadSection,
 ): Promise<void> {
 if (!selectedPlayerId || !selectedPlayerSection) {
 setSelectedPlayerId(playerId);
 setSelectedPlayerSection(section);
 return;
 }

 if (selectedPlayerId === playerId && selectedPlayerSection === section) {
 if (comparePlayerId && comparePlayerSection) {
 setSelectedPlayerId(comparePlayerId);
 setSelectedPlayerSection(comparePlayerSection);
 setComparePlayerId(null);
 setComparePlayerSection(null);
 return;
 }

 clearLineupSelection();
 return;
 }

 if (comparePlayerId === playerId && comparePlayerSection === section) {
 setComparePlayerId(null);
 setComparePlayerSection(null);
 return;
 }

 setComparePlayerId(playerId);
 setComparePlayerSection(section);
 }

 async function handleConfirmSwap(): Promise<void> {
 if (
 !selectedPlayerId ||
 !selectedPlayerSection ||
 !comparePlayerId ||
 !comparePlayerSection
 ) {
 return;
 }

 if (
 (selectedPlayerSection === "bench" &&
 !isPlayerEligibleForLineup(
 selectedPlayerId ? playersById.get(selectedPlayerId) : null,
 )) ||
 (comparePlayerSection === "bench" &&
 !isPlayerEligibleForLineup(
 comparePlayerId ? playersById.get(comparePlayerId) : null,
 ))
 ) {
 return;
 }

 const nextXiIds = applyLineupSwap(
 startingXiIds,
 { id: selectedPlayerId, from: selectedPlayerSection },
 comparePlayerId,
 comparePlayerSection,
 );

 if (!nextXiIds || nextXiIds.join(",") === startingXiIds.join(",")) {
 return;
 }

 await persistStartingXI(nextXiIds);
 clearLineupSelection();
 }

 function handleClearFilters(): void {
 setPlayerSearch("");
 setPositionFilter("All");
 }

 async function persistMatchRoles(
 nextRoles: TeamMatchRolesData,
 ): Promise<void> {
 try {
 const updated = await invoke<GameStateData>("set_team_match_roles", {
 matchRoles: nextRoles,
 });
 onGameUpdate(updated);
 } catch (error) {
 console.error("Failed to set team match roles:", error);
 }
 }

 async function handleAssignMatchRole(
 role: keyof TeamMatchRolesData,
 playerId: string,
 ): Promise<void> {
 await persistMatchRoles(
 buildUpdatedMatchRolesForAssignment(
 effectiveMatchRoles,
 startingXI,
 role,
 playerId,
 ),
 );
 }

 async function handleTacticsPhaseChange(
 patch: Partial<TacticsPhaseSettings>,
 ): Promise<void> {
 try {
 const updated = await setTacticsPhaseService(patch);
 onGameUpdate(updated);
 } catch (error) {
 console.error("Failed to set tactics phase:", error);
 }
 }

 if (!team) {
 return (
 <p className="text-gray-500 dark:text-gray-400">{t("common.noTeam")}</p>
 );
 }

 return (
 <div className="tactics-board-bg flex w-full flex-col gap-4">
 <div
 ref={dragPreviewRef}
 aria-hidden="true"
 className="pointer-events-none fixed -left-20 top-0 h-8 w-8 rounded-full border border-white/15 bg-navy-900/90 "
 />

 {/* V99.2: Playing Style hero — prominent banner showing formation + style
     + Gaffer-voice description. Always visible at the top of the screen. */}
 <PlayingStyleHero
 formation={formation}
 playStyle={activePlayStyle}
 tacticName={activeTactic?.name}
 />

 {/* V99.7-7: Sub-tab navigation — removed "Set Pieces" tab since set pieces
     are always visible in the right panel alongside the Phase Blueprint.
     Three tabs: Pitch (formation + roles), Selection (squad management),
     Style (playing style + guidance).
     V99.8: Brass-on-chalk palette so labels stay readable against the
     tactics-board texture in both light and dark mode. The active tab
     uses a solid brass chip with a dark chalk inner; inactive tabs use
     cream/chalk text that lifts off the dark chalkboard. */}
 <div className="flex gap-1 border-b border-accent-500/30 dark:border-accent-500/20">
 {([
 { id: "pitch", label: t("tactics.subTabs.pitch", { defaultValue: "Pitch" }) },
 { id: "selection", label: t("tactics.subTabs.selection", { defaultValue: "Selection" }) },
 { id: "style", label: t("tactics.subTabs.style", { defaultValue: "Style" }) },
 ] as const).map((tab) => (
 <button
 key={tab.id}
 onClick={() => setActiveSubTab(tab.id)}
 className={`px-4 py-2 text-sm font-heading font-bold uppercase tracking-wider transition-all duration-200 border-b-2 ${
 activeSubTab === tab.id
 ? "border-accent-400 bg-accent-500/15 text-accent-700 dark:text-accent-200"
 : "border-transparent text-chalk/80 dark:text-chalk/70 hover:text-accent-600 dark:hover:text-accent-300 hover:bg-accent-500/5"
 }`}
 >
 {tab.label}
 </button>
 ))}
 </div>

 <TacticsCommandBar
 activeTactic={activeTactic}
 activePlayStyle={activePlayStyle}
 formation={formation}
 isDirty={isCommandBarDirty}
 onCreateNew={handleCreateCustomTactic}
 onDuplicate={handleDuplicateTactic}
 onFormationChange={(nextFormation) => {
 void handleFormationChange(nextFormation);
 }}
 onPlayStyleChange={(playStyle) => {
 void handlePlayStyleChange(playStyle);
 }}
 onSave={handleSaveTactic}
 onSelectTactic={(id) => {
 const nextTactic = tacticLibrary.find((entry) => entry.id === id);
 if (!nextTactic) {
 return;
 }

 void applyTacticSelection(nextTactic);
 }}
 tacticLibrary={tacticLibrary}
 />

 {/* V99.7-7: Tab-conditional layout — wider center column for the pitch
     (was 260px_1fr_280px, now 240px_1fr_300px for pitch tab to give the
     formation pitch more room). Style tab uses 2-column with guidance
     on left and blueprint on right. */}
 <div className={`grid grid-cols-1 gap-4 xl:items-start ${
 activeSubTab === "pitch"
 ? "xl:grid-cols-[240px_1fr_300px]"
 : activeSubTab === "selection"
 ? "xl:grid-cols-[1fr_300px]"
 : activeSubTab === "style"
 ? "xl:grid-cols-[1fr_340px]"
 : "xl:grid-cols-1"
 }`}>
 {/* Left: player list — shown in pitch + selection tabs */}
 {(activeSubTab === "pitch" || activeSubTab === "selection") && (
 <TacticsPlayerList
 bench={filteredBench}
 comparePlayerId={comparePlayerId}
 dragState={dragState}
 matchRoles={effectiveMatchRoles}
 onAssignMatchRole={(role, playerId) => {
 void handleAssignMatchRole(role, playerId);
 }}
 onClearFilters={handleClearFilters}
 onDemoteStarter={(playerId) => {
 void handleDemoteStarter(playerId);
 }}
 onDragEnd={resetDragState}
 onDragStart={handleDragStart}
 onOpenPlayerProfile={onSelectPlayer}
 onPlayerSearchChange={setPlayerSearch}
 onPositionFilterChange={setPositionFilter}
 onPromoteBench={(playerId) => {
 void handlePromoteBenchPlayer(playerId);
 }}
 onTacticalSelect={(playerId, section) => {
 void handleLineupPlayerClick(playerId, section);
 }}
 playerSearch={playerSearch}
 positionFilter={positionFilter}
 selectedPlayerId={selectedPlayerId}
 starters={filteredStartingXI}
 xiActivePosition={xiActivePosition}
 />
 )}

 {/* Center: pitch — shown in pitch tab only */}
 {activeSubTab === "pitch" && (
 <TacticsPitch
 dragState={dragState}
 formation={formation}
 comparePlayerId={comparePlayerId}
 hoveredSlot={hoveredSlot}
 matchRoles={effectiveMatchRoles}
 onRoleChange={(playerId, role) => {
 void setPlayerRole(playerId, role)
 .then(onGameUpdate)
 .catch((error: unknown) => {
 console.error("Failed to set player role:", error);
 });
 }}
 playerRoles={team?.player_roles}
 tacticsPhase={team?.tactics_phase}
 teamKitPattern={team?.kit_pattern}
 teamPrimaryColor={team?.colors?.primary}
 teamSecondaryColor={team?.colors?.secondary}
 onAssignBestFit={(playerId) => {
 void handleAssignBestFit(playerId);
 }}
 onAssignMatchRole={(role, playerId) => {
 void handleAssignMatchRole(role, playerId);
 }}
 onClearSelection={clearLineupSelection}
 onDemoteStarter={(playerId) => {
 void handleDemoteStarter(playerId);
 }}
 onDragEnd={resetDragState}
 onDragStart={handleDragStart}
 onLineupPlayerClick={(playerId, section) => {
 void handleLineupPlayerClick(playerId, section);
 }}
 onOpenPlayerProfile={(playerId) => {
 onSelectPlayer(playerId);
 }}
 onPromoteBench={(playerId) => {
 void handlePromoteBenchPlayer(playerId);
 }}
 onSlotDragLeave={handleSlotDragLeave}
 onSlotDragOver={handleSlotDragOver}
 onSlotDrop={(event, slotIndex) => {
 void handleSlotDrop(event, slotIndex);
 }}
 outOfPositionCount={outOfPositionCount}
 pitchSlots={pitchSlots}
 selectedPlayer={selectedPlayer}
 selectedPlayerId={selectedPlayerId}
 />
 )}

 {/* V99.7-7: Right panel — Phase Blueprint + Set Pieces + Roles.
     Shown on pitch + style tabs (setPieces tab was removed). */}
 {(activeSubTab === "pitch" || activeSubTab === "style") && (
 <TacticsRightPanel
 allSquad={roster}
 matchRoles={team.match_roles}
 onGameUpdate={onGameUpdate}
 onTacticsPhaseChange={(patch) => {
 void handleTacticsPhaseChange(patch);
 }}
 startingPlayers={startingXI}
 tacticsPhase={team?.tactics_phase}
 />
 )}

 {/* Style tab — left column shows a Gaffer-voice style guidance panel so
     the screen is no longer empty on the left when only the right panel
     would otherwise be visible. */}
 {activeSubTab === "style" && (
 <StyleGuidancePanel
 formation={formation}
 playStyle={activePlayStyle}
 tacticsPhase={team?.tactics_phase}
 />
 )}
 </div>

 {/* Inspector modal — only when both players are selected for comparison */}
 {selectedPlayer && comparePlayer && (
 <>
 <div
 className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
 onClick={clearLineupSelection}
 />
 <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
 <div className="pointer-events-auto w-full max-w-lg max-h-[85vh] overflow-y-auto">
 <TacticsPlayerFocusPanel
 canConfirmSwap={canConfirmSwap}
 comparePlayer={comparePlayer}
 onClose={clearLineupSelection}
 onConfirmSwap={() => { void handleConfirmSwap(); }}
 selectedPlayer={selectedPlayer}
 />
 </div>
 </div>
 </>
 )}
 </div>
 );
}
