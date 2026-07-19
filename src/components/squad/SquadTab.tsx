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

 {/* V100 P2 (Issue #39): Reserve squad panel. Shows players in the reserve
     squad + allows promoting them back. Move-to-reserve is done via the
     player context menu on SquadRosterView. */}
 {(team.reserve_squad_ids?.length ?? 0) > 0 && (
 <Card>
 <CardHeader>
 <div className="flex items-center gap-2">
 <span className="inline-block w-[3px] h-[11px] bg-accent-500" />
 {t("squad.reserveTeam", { defaultValue: "Reserve Squad" })}
 </div>
 </CardHeader>
 <CardBody>
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
 </CardBody>
 </Card>
 )}
 </div>
 );
}
