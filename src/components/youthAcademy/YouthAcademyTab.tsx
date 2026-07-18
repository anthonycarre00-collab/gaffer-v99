import { useEffect, useState } from "react";
import type { GameStateData } from "../../store/gameStore";
import { useGameStore } from "../../store/gameStore";
import { useFetchedSquad } from "../../hooks/useFetchedSquad";
import { getStaff, type StaffSlice } from "../../services/staffService";
import {
 Card,
 CardHeader,
 CardBody,
 Badge,
 ProgressBar,
 CountryFlag,
 Button,
 PlayerAvatar,
} from "../ui";
import { calcAge, positionBadgeVariant } from "../../lib/helpers";
import { canDelegateToYouthAcademy, isYouthAcademyPlayer } from "../../lib/playerSquad";
import { TraitList } from "../TraitBadge";
import { useTranslation } from "react-i18next";
import { countryName } from "../../lib/countries";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import ContextMenu from "../ContextMenu";
import { buildPromoteToSeniorSquadMenuItem, buildViewProfileMenuItem } from "../playerActions/playerContextMenuItems";
import { setPlayerSquadRole } from "../../services/squadService";
import {
 cancelYouthScouting,
 reassignYouthScouting,
 startYouthScouting,
} from "../../services/scoutingService";
import { GraduationCap, ScanSearch, TrendingUp, Star, Users, Sparkles } from "lucide-react";
import type { DashboardNavigateContext } from "../dashboard/dashboardProfileNavigation";
import type { PlayerSquadRole } from "../../store/types";
import { calculateAvailableScouts } from "../scouting/ScoutingTab.helpers";
import ScoutingYouthRecruitmentCard from "../scouting/ScoutingYouthRecruitmentCard";
import { shortOvrLabel, interpretOvr } from "../../lib/ovrInterpretation";
import { interpretCondition, interpretGrowthRoom } from "../../lib/gafferEngine";

interface YouthAcademyTabProps {
 gameState: GameStateData | null;
 onSelectPlayer?: (id: string) => void;
 onGameUpdate?: (game: GameStateData) => void;
 onNavigate?: (tab: string, context?: DashboardNavigateContext) => void;
}

function getPotentialLabel(
 potential: number,
 t: (key: string) => string,
): { label: string; color: string } {
 if (potential >= 85)
 return { label: t("youthAcademy.potWorldClass"), color: "text-accent-400" };
 if (potential >= 75)
 return { label: t("youthAcademy.potExcellent"), color: "text-success-400" };
 if (potential >= 65)
 return { label: t("youthAcademy.potPromising"), color: "text-primary-400" };
 if (potential >= 55)
 return { label: t("youthAcademy.potDecent"), color: "text-ink-faint" };
 return { label: t("youthAcademy.potLimited"), color: "text-ink-faint" };
}

export default function YouthAcademyTab({
 gameState,
 onSelectPlayer,
 onGameUpdate,
 onNavigate,
}: YouthAcademyTabProps) {
 const { t, i18n } = useTranslation();
 const sessionState = useGameStore((s) => s.sessionState);
 const [fetchedStaff, setFetchedStaff] = useState<StaffSlice | null>(null);
 const [selectedYouthScoutId, setSelectedYouthScoutId] = useState("");
 const [youthRegion, setYouthRegion] = useState("Domestic");
 const [youthObjective, setYouthObjective] = useState("Balanced");
 const [youthTargetPosition, setYouthTargetPosition] = useState("");
 const [startingYouthSearch, setStartingYouthSearch] = useState(false);
 const [youthSearchError, setYouthSearchError] = useState<string | null>(null);

 const teamId = sessionState?.manager?.team_id ?? gameState?.manager?.team_id ?? null;
 const clockDate = sessionState?.clock.current_date ?? gameState?.clock.current_date ?? "";
 const [fetchedSquad, setFetchedSquad] = useFetchedSquad(teamId, clockDate);

 useEffect(() => {
 if (!teamId) return;
 let cancelled = false;
 void getStaff(teamId)
 .then((staff) => {
 if (!cancelled) setFetchedStaff(staff);
 })
 .catch(() => {});
 return () => {
 cancelled = true;
 };
 }, [teamId, clockDate]);

 const team = sessionState?.team ?? gameState?.teams.find((tm) => tm.id === teamId) ?? null;
 const scouts =
 fetchedStaff?.team_staff.filter((s) => s.role === "Scout") ??
 gameState?.staff.filter((s) => s.role === "Scout" && s.team_id === teamId) ??
 [];
 const youthAssignments =
 fetchedStaff?.youth_scouting_assignments ?? gameState?.youth_scouting_assignments ?? [];
 const allAssignments = [
 ...(fetchedStaff?.scouting_assignments ?? gameState?.scouting_assignments ?? []),
 ...youthAssignments,
 ];
 const availableScouts = calculateAvailableScouts(scouts, allAssignments);

 useEffect(() => {
 if (
 selectedYouthScoutId &&
 availableScouts.some((scout) => scout.id === selectedYouthScoutId)
 ) {
 return;
 }

 setSelectedYouthScoutId(availableScouts[0]?.id ?? "");
 }, [availableScouts, selectedYouthScoutId]);

 const roster =
 fetchedSquad ?? gameState?.players.filter((p) => p.team_id === teamId) ?? [];
 const youthPlayers = roster
 .filter((player) => isYouthAcademyPlayer(player))
 .map((p) => ({
 ...p,
 age: calcAge(p.date_of_birth),
 ovr: p.ovr ?? 0,
 potential: p.potential ?? 1,
 }))
 .sort((a, b) => b.potential - a.potential);
 const eligibleSeniorPlayers = roster
 .filter((player) => canDelegateToYouthAcademy(player))
 .map((player) => ({
 ...player,
 age: calcAge(player.date_of_birth),
 }))
 .sort(
 (left, right) =>
 left.age - right.age || left.full_name.localeCompare(right.full_name),
 );

 const avgOvr =
 youthPlayers.length > 0
 ? Math.round(
 youthPlayers.reduce((s, p) => s + p.ovr, 0) / youthPlayers.length,
 )
 : 0;
 const avgPotential =
 youthPlayers.length > 0
 ? Math.round(
 youthPlayers.reduce((s, p) => s + p.potential, 0) /
 youthPlayers.length,
 )
 : 0;
 const highPotential = youthPlayers.filter((p) => p.potential >= 75).length;

 // Youth development staff
 const youthCoach =
 fetchedStaff?.team_staff.filter((s) => s.specialization === "Youth") ??
 gameState?.staff.filter((s) => s.team_id === team?.id && s.specialization === "Youth") ??
 [];

 const applyScoutingUpdate = (updated: GameStateData) => {
 onGameUpdate?.(updated);
 setFetchedStaff((prev) =>
 prev
 ? {
 ...prev,
 scouting_assignments: updated.scouting_assignments,
 youth_scouting_assignments: updated.youth_scouting_assignments ?? [],
 }
 : null,
 );
 };

 // Both squad-role moves must also patch the cached squad: the prospects and
 // recovery lists render from `fetchedSquad`, which only refetches on remount
 // or when the game clock advances (issue #250).
 const handleSetSquadRole = async (
 playerId: string,
 squadRole: PlayerSquadRole,
 ) => {
 try {
 const updated = await setPlayerSquadRole(playerId, squadRole);
 onGameUpdate?.(updated);
 setFetchedSquad(updated.players.filter((p) => p.team_id === teamId));
 } catch {
 return;
 }
 };

 const handleStartYouthScouting = async () => {
 if (!selectedYouthScoutId || !onGameUpdate) return;

 setStartingYouthSearch(true);
 setYouthSearchError(null);
 try {
 const updated = await startYouthScouting({
 scoutId: selectedYouthScoutId,
 region: youthRegion,
 objective: youthObjective,
 targetPosition: youthTargetPosition || null,
 });
 applyScoutingUpdate(updated);
 setSelectedYouthScoutId("");
 } catch (err) {
 setYouthSearchError(String(err));
 } finally {
 setStartingYouthSearch(false);
 }
 };

 const handleCancelYouthScouting = async (assignmentId: string) => {
 setYouthSearchError(null);
 try {
 applyScoutingUpdate(await cancelYouthScouting(assignmentId));
 } catch (err) {
 setYouthSearchError(String(err));
 }
 };

 const handleReassignYouthScouting = async (
 assignmentId: string,
 scoutId: string,
 ) => {
 setYouthSearchError(null);
 try {
 applyScoutingUpdate(await reassignYouthScouting(assignmentId, scoutId));
 } catch (err) {
 setYouthSearchError(String(err));
 }
 };

 return (
 <div className="gaffer-card-texture flex flex-col gap-5">
 {/* Header */}
 <div className="flex items-center gap-3">
 <GraduationCap className="w-5 h-5 text-primary-500" />
 <h2 className="gaffer-section-underline text-lg font-heading font-bold text-ink uppercase tracking-wider">
 {t("youthAcademy.title")}
 </h2>
 <Badge variant="neutral" size="sm">
 {t("youthAcademy.playersUnder21", { count: youthPlayers.length })}
 </Badge>
 </div>

 {/* Overview Cards */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <Card>
 <CardBody>
 <div className="text-center">
 <Users className="w-5 h-5 text-ink-faint mx-auto mb-1" />
 <p className="font-heading font-bold text-2xl text-ink">
 {youthPlayers.length}
 </p>
 <p className="text-[10px] text-ink-faint font-heading uppercase tracking-wider">
 {t("youthAcademy.youthPlayers")}
 </p>
 </div>
 </CardBody>
 </Card>
 <Card>
 <CardBody>
 <div className="text-center">
 <Star className="w-5 h-5 text-accent-400 mx-auto mb-1" />
 <p className="font-heading font-bold text-2xl text-ink">
 {avgOvr}
 </p>
 <p className="text-[10px] text-ink-faint font-heading uppercase tracking-wider">
 {t("youthAcademy.avgOvr")}
 </p>
 </div>
 </CardBody>
 </Card>
 <Card>
 <CardBody>
 <div className="text-center">
 <TrendingUp className="w-5 h-5 text-success-500 mx-auto mb-1" />
 <p className="font-heading font-bold text-2xl text-ink">
 {avgPotential}
 </p>
 <p className="text-[10px] text-ink-faint font-heading uppercase tracking-wider">
 {t("youthAcademy.avgPotential")}
 </p>
 </div>
 </CardBody>
 </Card>
 <Card>
 <CardBody>
 <div className="text-center">
 <Sparkles className="w-5 h-5 text-accent-400 mx-auto mb-1" />
 <p className="font-heading font-bold text-2xl text-accent-500">
 {highPotential}
 </p>
 <p className="text-[10px] text-ink-faint font-heading uppercase tracking-wider">
 {t("youthAcademy.highPotential")}
 </p>
 </div>
 </CardBody>
 </Card>
 </div>

 <Card accent="primary">
 <CardHeader
 action={
 onNavigate ? (
 <Button
 size="sm"
 variant="outline"
 icon={<ScanSearch />}
 onClick={() => onNavigate("Scouting")}
 >
 {t("youthAcademy.openScouting")}
 </Button>
 ) : undefined
 }
 >
 {t("youthAcademy.recoveryTitle")}
 </CardHeader>
 <CardBody className="flex flex-col gap-4">
 <p className="text-sm text-ink-dim">
 {t("youthAcademy.recoveryDescription")}
 </p>

 {eligibleSeniorPlayers.length > 0 ? (
 <div className="flex flex-col gap-3">
 <Badge variant="primary" size="sm" className="w-fit">
 {t("youthAcademy.eligibleSeniorPlayers", {
 count: eligibleSeniorPlayers.length,
 })}
 </Badge>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {eligibleSeniorPlayers.slice(0, 4).map((player) => (
 <div
 key={player.id}
 className="flex items-center justify-between gap-3 rounded border border-slate-line bg-carbon-2/60 px-4 py-3"
 >
 <div className="min-w-0 flex items-center gap-3">
 <PlayerAvatar player={player} />
 <div className="min-w-0">
 <button
 onClick={() => onSelectPlayer?.(player.id)}
 className="text-left font-heading font-bold text-sm text-ink hover:text-primary-500 transition-colors truncate block"
 >
 {player.full_name}
 </button>
 <p className="text-xs text-ink-dim mt-0.5">
 {translatePositionAbbreviation(
 t,
 player.natural_position || player.position,
 )} · {t("youthAcademy.age")} {player.age}
 </p>
 </div>
 </div>

 <Button
 size="sm"
 onClick={() => {
 void handleSetSquadRole(player.id, "Youth");
 }}
 >
 {t("youthAcademy.delegateToYouthAcademy")}
 </Button>
 </div>
 ))}
 </div>
 </div>
 ) : (
 <p className="text-sm text-ink-dim">
 {t("youthAcademy.noEligibleSeniorPlayers")}
 </p>
 )}
 </CardBody>
 </Card>

 {scouts.length > 0 ? (
 <ScoutingYouthRecruitmentCard
 title={t("youthAcademy.recruitmentWorkflowTitle")}
 hint={t("youthAcademy.recruitmentWorkflowHint")}
 youthAssignments={youthAssignments}
 scouts={scouts}
 availableScouts={availableScouts}
 isStarting={startingYouthSearch}
 selectedScoutId={selectedYouthScoutId}
 region={youthRegion}
 objective={youthObjective}
 targetPosition={youthTargetPosition}
 errorMessage={youthSearchError}
 onScoutChange={setSelectedYouthScoutId}
 onRegionChange={setYouthRegion}
 onObjectiveChange={setYouthObjective}
 onTargetPositionChange={setYouthTargetPosition}
 onStartSearch={() => {
 void handleStartYouthScouting();
 }}
 onCancelSearch={(assignmentId) => {
 void handleCancelYouthScouting(assignmentId);
 }}
 onReassignSearch={(assignmentId, scoutId) => {
 void handleReassignYouthScouting(assignmentId, scoutId);
 }}
 />
 ) : null}

 {/* V100 P1 (Issue #19): Youth Development Tracker — differentiates the Youth
     tab from the Scouting tab. Shows the academy's recent intake + each
     youth player's development trajectory (OVR, potential, recent rating trend).
     This is youth-specific content that doesn't belong on the Scouting tab. */}
 <Card>
 <CardHeader>
 <div className="flex items-center gap-2">
 <TrendingUp className="w-4 h-4 text-accent-400" />
 <span className="text-sm font-heading font-bold uppercase tracking-wide text-ink">
 {t("youthAcademy.developmentTrackerTitle", { defaultValue: "Development Tracker" })}
 </span>
 </div>
 </CardHeader>
 <CardBody>
 <p className="text-xs text-ink-dim mb-3">
 {t("youthAcademy.developmentTrackerHint", {
 defaultValue: "Track the progress of your academy prospects. Players under 21 with a Youth-specialist coach get a +25% development bonus.",
 })}
 </p>
 {youthPlayers.length === 0 ? (
 <p className="text-center text-xs text-ink-faint py-4">
 {t("youthAcademy.noYouthPlayers", { defaultValue: "No youth players in the academy." })}
 </p>
 ) : (
 <div className="space-y-2">
 {youthPlayers.slice(0, 8).map((player) => {
 const age = calcAge(player.date_of_birth);
 const growthRoom = Math.max(0, (player.potential ?? 0) - (player.ovr ?? 0));
 return (
 <div
 key={player.id}
 className="flex items-center gap-3 rounded border border-slate-line bg-carbon-2 px-3 py-2"
 >
 <PlayerAvatar player={player} size="sm" />
 <div className="flex-1 min-w-0">
 <p className="text-sm text-ink font-medium truncate">
 {player.match_name ?? player.full_name}
 </p>
 <p className="text-[10px] text-ink-faint">
 {age}y • {translatePositionAbbreviation(player.position, t)}
 </p>
 </div>
 <div className="text-right">
 <p className="text-xs font-mono text-accent-400">
 {shortOvrLabel(player.ovr ?? 0)}
 </p>
 <p className="text-[10px] text-ink-faint">
 {t("youthAcademy.growthRoom", { defaultValue: "+{{n}} room", n: growthRoom })}
 </p>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </CardBody>
 </Card>

 {/* Youth Staff */}
 {youthCoach.length > 0 && (
 <Card>
 <CardBody>
 <div className="flex items-center gap-2 text-xs">
 <GraduationCap className="w-3.5 h-3.5 text-primary-500" />
 <span className="text-ink-dim">
 {t("youthAcademy.youthCoach")}
 </span>
 {youthCoach.map((s) => (
 <Badge key={s.id} variant="primary" size="sm">
 {s.first_name} {s.last_name} ({s.attributes.coaching})
 </Badge>
 ))}
 </div>
 </CardBody>
 </Card>
 )}

 {/* Youth Players Table */}
 <Card>
 <CardHeader>{t("youthAcademy.youthProspects")}</CardHeader>
 <CardBody className="p-0">
 {youthPlayers.length === 0 ? (
 <div className="flex flex-col items-center gap-3 py-12">
 <GraduationCap className="w-10 h-10 text-ink-faint dark:text-navy-600" />
 <p className="text-sm text-ink-dim">
 {t("youthAcademy.noYouthPlayers")}
 </p>
 </div>
 ) : (
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-carbon-2 border-b border-slate-line text-xs">
 <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("youthAcademy.player")}
 </th>
 <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("youthAcademy.pos")}
 </th>
 <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-ink-dim text-center">
 {t("youthAcademy.age")}
 </th>
 <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-ink-dim text-center">
 {t("youthAcademy.ovr")}
 </th>
 <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-ink-dim text-center">
 {t("youthAcademy.potential")}
 </th>
 <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("youthAcademy.growth")}
 </th>
 <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("youthAcademy.traits")}
 </th>
 <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-ink-dim text-center">
 {t("youthAcademy.condition")}
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-line-soft dark:divide-slate-line">
 {youthPlayers.map((player) => {
 const potLabel = getPotentialLabel(player.potential, t);
 const growthRoom = player.potential - player.ovr;
 const contextItems = [
 buildViewProfileMenuItem(t, () => onSelectPlayer?.(player.id)),
 buildPromoteToSeniorSquadMenuItem(t, () => {
 void handleSetSquadRole(player.id, "Senior");
 }),
 ];

 return (
 <ContextMenu items={contextItems} key={player.id}>
 <tr
 onClick={() => onSelectPlayer?.(player.id)}
 className="hover:bg-carbon-2 hover:bg-carbon-3/50 cursor-pointer transition-colors"
 >
 <td className="py-2.5 px-4">
 <div className="flex items-center gap-3 min-w-0">
 <PlayerAvatar player={player} />
 <div className="min-w-0">
 <p className="text-sm font-medium text-ink truncate">
 {player.full_name}
 </p>
 <div className="text-[10px] text-ink-faint flex items-center gap-1 mt-0.5">
 <CountryFlag
 code={player.nationality}
 locale={i18n.language}
 className="text-xs leading-none"
 />
 <span>
 {countryName(player.nationality, i18n.language)}
 </span>
 </div>
 </div>
 </div>
 </td>
 <td className="py-2.5 px-4">
 <Badge
 variant={positionBadgeVariant(
 player.natural_position || player.position,
 )}
 size="sm"
 >
 {translatePositionAbbreviation(
 t,
 player.natural_position || player.position,
 )}
 </Badge>
 </td>
 <td className="py-2.5 px-4 text-center">
 <span className="text-sm font-heading font-bold text-ink-dim tabular-nums">
 {player.age}
 </span>
 </td>
 <td className="py-2.5 px-4 text-center">
 <span
 className={`text-xs font-heading font-bold ${interpretOvr(player.ovr, player.natural_position || player.position).colorClass}`}
 title={interpretOvr(player.ovr, player.natural_position || player.position).description}
 >
 {shortOvrLabel(player.ovr, player.natural_position || player.position)}
 </span>
 </td>
 <td className="py-2.5 px-4 text-center">
 <span
 className={`text-sm font-mono font-mono font-bold tabular-nums ${potLabel.color}`}
 >
 {player.potential}
 </span>
 <p
 className={`text-[9px] font-heading uppercase tracking-wider ${potLabel.color}`}
 >
 {potLabel.label}
 </p>
 </td>
 <td className="py-2.5 px-4">
 <div className="flex items-center gap-2">
 <ProgressBar
 value={Math.min(
 100,
 (player.ovr / player.potential) * 100,
 )}
 variant={
 growthRoom > 15
 ? "accent"
 : growthRoom > 5
 ? "primary"
 : "auto"
 }
 size="sm"
 />
 <span
 className={`text-[10px] font-heading font-bold tabular-nums w-20 ${interpretGrowthRoom(player.ovr, player.potential).colorClass}`}
 title={interpretGrowthRoom(player.ovr, player.potential).description}
 >
 {interpretGrowthRoom(player.ovr, player.potential).short}
 </span>
 </div>
 </td>
 <td className="py-2.5 px-4">
 <TraitList traits={player.traits || []} max={2} />
 </td>
 <td className="py-2.5 px-4 text-center">
 <span
 className={`text-xs font-heading font-bold tabular-nums ${interpretCondition(player.condition).colorClass}`}
 title={interpretCondition(player.condition).description}
 >
 {interpretCondition(player.condition).short}
 </span>
 </td>
 </tr>
 </ContextMenu>
 );
 })}
 </tbody>
 </table>
 )}
 </CardBody>
 </Card>
 </div>
 );
}
