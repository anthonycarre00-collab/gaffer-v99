import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
 type GameStateData,
 useGameStore,
} from "../../store/gameStore";
import type { PlayerSelectionOptions } from "../../store/gameStore";
import { useFetchedSquad } from "../../hooks/useFetchedSquad";
import SquadRosterView from "./SquadRosterView";
import type { SquadListSortState } from "./SquadRosterView.state";
import { Card, CardHeader, CardBody, Button } from "../ui";

interface SquadTabProps {
 gameState: GameStateData | null;
 managerId: string;
 onSelectPlayer: (id: string, options?: PlayerSelectionOptions) => void;
 onGameUpdate?: (g: GameStateData) => void;
 sortState?: SquadListSortState;
 onSortStateChange?: (sortState: SquadListSortState) => void;
}

export default function SquadTab({
 gameState,
 managerId,
 onSelectPlayer,
 onGameUpdate,
 sortState,
 onSortStateChange,
}: SquadTabProps) {
 const { t } = useTranslation();
 const sessionState = useGameStore((s) => s.sessionState);

 const teamId =
 sessionState?.manager?.team_id ?? gameState?.manager?.team_id ?? null;
 const clockDate =
 sessionState?.clock.current_date ?? gameState?.clock.current_date ?? "";
 const [fetchedSquad, setFetchedSquad] = useFetchedSquad(teamId, clockDate);

 const team =
 sessionState?.team ??
 gameState?.teams.find((t) => t.manager_id === managerId) ??
 null;
 const players =
 fetchedSquad ??
 gameState?.players.filter((p) => p.team_id === teamId) ??
 [];

 const handleMutationComplete = (game: GameStateData) => {
 onGameUpdate?.(game);
 if (teamId) {
 setFetchedSquad(game.players.filter((p) => p.team_id === teamId));
 }
 };

 // V100 P2 (Issue #39): Promote a player from the reserve squad.
 const handlePromoteFromReserve = async (playerId: string) => {
 try {
 const updated = await invoke<GameStateData>("promote_from_reserve", { playerId });
 handleMutationComplete(updated);
 } catch (error) {
 console.error("Failed to promote from reserve:", error);
 }
 };

 if (!team) {
 return (
 <p className="text-ink-dim">
 {t("common.unemployed")}
 </p>
 );
 }

 return (
 <div className="space-y-4">
 <SquadRosterView
 players={players}
 team={team}
 clockDate={clockDate}
 onSelectPlayer={onSelectPlayer}
 onMutationComplete={handleMutationComplete}
 sortState={sortState}
 onSortStateChange={onSortStateChange}
 />

 {/* V100 FIX (forensic): Reserve squad panel — ALWAYS shown.
   User said: "RESERVES doesnt do anything, doesnt even offer manager
   reasons or affect morale and theres no reserves section anyway."
   Was only shown when reserve_squad_ids was non-empty. Now always
   shown so the user knows the feature exists. */}
 <Card>
 <CardHeader>
 <div className="flex items-center gap-2">
 <span className="inline-block w-[3px] h-[11px] bg-accent-500" />
 {t("squad.reserveTeam", { defaultValue: "Reserve Squad" })}
 {(team.reserve_squad_ids?.length ?? 0) > 0 && (
 <span className="text-[10px] font-bold text-accent-500">
 ({team.reserve_squad_ids?.length})
 </span>
 )}
 </div>
 </CardHeader>
 <CardBody>
 {(team.reserve_squad_ids?.length ?? 0) === 0 ? (
 <div className="text-center py-4">
 <p className="text-sm text-ink-dim">
 {t("squad.noReservePlayers", { defaultValue: "No players in the reserve squad." })}
 </p>
 <p className="text-[11px] text-ink-faint mt-1">
 {t("squad.reserveExplanation", {
 defaultValue: "Right-click a player in the squad list above and select 'Move to Reserve' to send them here. Reserve players get match minutes on matchdays — keeping them fit and sharp.",
 })}
 </p>
 </div>
 ) : (
 <div className="space-y-1">
 {team.reserve_squad_ids?.map((pid) => {
 const rp = players.find((p) => p.id === pid);
 if (!rp) return null;
 return (
 <div key={pid} className="flex items-center justify-between rounded border border-slate-line bg-carbon-2 px-3 py-2">
 <div className="flex-1 min-w-0">
 <p className="text-sm text-ink font-medium truncate">
 {rp.match_name ?? rp.full_name}
 </p>
 <p className="text-[10px] text-ink-faint">
 {rp.position} • {t("squad.reservePlayer", { defaultValue: "Reserve" })}
 </p>
 </div>
 <Button
 size="sm"
 variant="outline"
 onClick={() => void handlePromoteFromReserve(pid)}
 >
 {t("squad.promote", { defaultValue: "Promote" })}
 </Button>
 </div>
 );
 })}
 </div>
 )}
 {/* Show recent reserve results if available. */}
 {(team.reserve_results?.length ?? 0) > 0 && (
 <div className="mt-4 pt-3 border-t border-slate-line">
 <p className="text-[10px] font-heading font-bold uppercase tracking-widest text-ink-faint mb-2">
 {t("squad.reserveResults", { defaultValue: "Recent Reserve Results" })}
 </p>
 <div className="flex flex-wrap gap-2">
 {team.reserve_results?.slice(-5).reverse().map((result, i) => (
 <span
 key={i}
 className="text-xs font-mono tabular-nums bg-carbon-2 px-2 py-1 rounded border border-slate-line text-ink-dim"
 >
 {result}
 </span>
 ))}
 </div>
 </div>
 )}
 </CardBody>
 </Card>
 </div>
 );
}
