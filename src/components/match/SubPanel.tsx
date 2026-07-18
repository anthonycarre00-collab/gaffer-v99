import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
 type MatchSnapshot,
 FORMATIONS,
 PLAY_STYLES,
} from "./types";
import { getPlayerName } from "./helpers";
import { FormationPitch } from "./FormationPitch";
import { condBgColor, condColor } from "../../lib/playerConditionDisplay";
import { shortOvrLabel, interpretOvr, interpretCondition } from "../../lib/gafferEngine";
import { shortAttrLabel } from "../../lib/attributeInterpretation";
import { Badge, Select } from "../ui";
import {
 RefreshCw,
 AlertTriangle,
 UserMinus,
 UserPlus,
 Shield,
 Swords,
 Sparkles,
} from "lucide-react";
import ContextMenu from "../ContextMenu";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import {
 buildRecommendedSubstitutions,
 getMatchScenario,
 type MatchScenarioId,
} from "./SubPanel.helpers";

const CompareBar = ({
 label,
 valA,
 valB,
 displayA,
 displayB,
}: {
 label: string;
 valA: number;
 valB: number;
 /** Optional display override — if provided, shows this instead of the raw number. */
 displayA?: string;
 displayB?: string;
}) => {
 const diff = valB - valA;
 return (
 <div className="flex items-center gap-1.5 py-0.5 text-xs">
 <span className="w-7 text-right font-heading text-ink-faint">{label}</span>
 <span className="w-5 text-right tabular-nums text-danger-400">{displayA ?? valA}</span>
 <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-navy-600">
 <div className="h-full bg-danger-500/60" style={{ width: `${valA}%` }} />
 </div>
 <div className="flex h-1.5 flex-1 justify-end overflow-hidden rounded-full bg-navy-600">
 <div className="h-full bg-success-500/60" style={{ width: `${valB}%` }} />
 </div>
 <span className="w-5 tabular-nums text-success-400">{displayB ?? valB}</span>
 <span
 className={`w-6 text-right tabular-nums font-heading font-bold ${diff > 0 ? "text-success-400" : diff < 0 ? "text-danger-400" : "text-ink-dim"}`}
 >
 {diff > 0 ? "+" : ""}
 {diff}
 </span>
 </div>
 );
};

export function SubPanel({
 snapshot,
 side,
 onSubstitute,
 onFormationChange,
 onPlayStyleChange,
 onClose,
}: {
 snapshot: MatchSnapshot;
 side: "Home" | "Away";
 onSubstitute: (offId: string, onId: string) => void;
 onFormationChange: (formation: string) => void;
 onPlayStyleChange: (playStyle: string) => void;
 onClose: () => void;
}) {
 const { t } = useTranslation();
 const [selectedOff, setSelectedOff] = useState<string | null>(null);
 const [selectedBench, setSelectedBench] = useState<string | null>(null);

 const team = side === "Home" ? snapshot.home_team : snapshot.away_team;
 const bench = side === "Home" ? snapshot.home_bench : snapshot.away_bench;
 const subsMade =
 side === "Home" ? snapshot.home_subs_made : snapshot.away_subs_made;

 const subbedOnIds = new Set(
 snapshot.substitutions
 .filter((s) => s.side === side)
 .map((s) => s.player_on_id),
 );
 const subbedOffIds = new Set(
 snapshot.substitutions
 .filter((s) => s.side === side)
 .map((s) => s.player_off_id),
 );
 const availableBench = bench.filter(
 (p) => !subbedOffIds.has(p.id) && !subbedOnIds.has(p.id),
 );
 const selectedPlayer = selectedOff
 ? team.players.find((p) => p.id === selectedOff)
 : null;
 const comparedPlayer = selectedBench
 ? availableBench.find((p) => p.id === selectedBench)
 : null;

 const scenario = getMatchScenario(snapshot, side);
 const recommendations = buildRecommendedSubstitutions(snapshot, side);
 const visibleRecommendations = recommendations.flatMap((rec) => {
 const offPlayer = team.players.find((p) => p.id === rec.offId);
 const onPlayer = availableBench.find((p) => p.id === rec.onId);
 if (!offPlayer || !onPlayer) return [];
 return [{ rec, offPlayer, onPlayer }];
 });

 const getScenarioIcon = (id: MatchScenarioId) => {
 switch (id) {
 case "protect-lead":
 return <Shield className="h-3.5 w-3.5 text-primary-400" />;
 case "chase-goal":
 return <Swords className="h-3.5 w-3.5 text-accent-400" />;
 case "find-winner":
 return <Sparkles className="h-3.5 w-3.5 text-accent-400" />;
 default:
 return <RefreshCw className="h-3.5 w-3.5 text-ink-faint" />;
 }
 };

 const handleClearSelection = () => {
 setSelectedOff(null);
 setSelectedBench(null);
 };

 const handleSelectOffPlayer = (playerId: string) => {
 setSelectedOff((cur) => {
 if (cur === playerId) {
 setSelectedBench(null);
 return null;
 }
 setSelectedBench(null);
 return playerId;
 });
 };

 const handleSelectBenchPlayer = (playerId: string) => {
 if (!selectedOff) return;
 setSelectedBench((cur) => (cur === playerId ? null : playerId));
 };

 const handleConfirmSubstitution = () => {
 if (!selectedOff || !selectedBench) return;
 onSubstitute(selectedOff, selectedBench);
 };

 const handleApplyRecommendation = (offId: string, onId: string) => {
 setSelectedOff(offId);
 setSelectedBench(onId);
 };

 const handleInteractiveRowKeyDown = (
 event: KeyboardEvent<HTMLElement>,
 action: () => void,
 ) => {
 if (event.key === "Enter" || event.key === " ") {
 event.preventDefault();
 action();
 return;
 }
 if (
 event.key === "ContextMenu" ||
 (event.shiftKey && event.key === "F10")
 ) {
 event.preventDefault();
 event.currentTarget.dispatchEvent(
 new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
 );
 }
 };

 return (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
 onClick={onClose}
 >
 <div
 className="bg-carbon-1 rounded border border-slate-line shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden transition-colors duration-300"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Header */}
 <div className="flex shrink-0 items-center justify-between border-b border-slate-line bg-linear-to-r from-gray-100 to-white px-5 py-3 border-slate-line bg-carbon-1">
 <div className="flex items-center gap-2.5">
 <RefreshCw className="h-4 w-4 text-accent-400" />
 <h3 className="font-heading text-sm font-bold uppercase tracking-widest text-ink">
 {t("match.substitutionsTitle")}
 </h3>
 <Badge
 variant={subsMade >= snapshot.max_subs ? "danger" : "primary"}
 size="sm"
 >
 {t("match.subsUsed", { used: subsMade, max: snapshot.max_subs })}
 </Badge>
 </div>
 <button
 onClick={onClose}
 className="rounded p-1.5 text-ink-faint transition-colors hover:bg-carbon-2 hover:text-ink-faint hover:bg-carbon-3 hover:text-ink"
 >
 <span className="font-heading text-sm">✕</span>
 </button>
 </div>

 {subsMade >= snapshot.max_subs ? (
 <div className="flex flex-1 items-center justify-center p-12">
 <div className="flex flex-col items-center gap-3">
 <AlertTriangle className="h-8 w-8 text-accent-500" />
 <p className="font-heading text-sm font-bold uppercase tracking-wider text-accent-500">
 {t("match.allSubsUsed")}
 </p>
 </div>
 </div>
 ) : (
 <>
 {/* Tactics strip — scenario, recommendation chips, quick selects */}
 <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-line bg-carbon-2/60 px-4 py-2 border-slate-line bg-carbon-0/30">
 {/* Scenario + apply play style */}
 <div className="flex items-center gap-1.5">
 {getScenarioIcon(scenario.id)}
 <span className="font-heading text-[11px] font-bold uppercase tracking-widest text-ink">
 {t(`match.subScenario.${scenario.id}.title`)}
 </span>
 <button
 type="button"
 data-testid="recommended-plan-cta"
 onClick={() =>
 onPlayStyleChange(scenario.recommendedPlayStyle)
 }
 className="rounded-full border border-primary-500/25 bg-primary-500/12 px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-widest text-primary-500 transition-colors hover:bg-primary-500/20 dark:text-primary-300"
 >
 {t("match.recommendedPlan")}:{" "}
 {t(`common.playStyles.${scenario.recommendedPlayStyle}`)}
 </button>
 </div>

 {/* Recommendation chips */}
 {visibleRecommendations.length > 0 && (
 <div className="flex flex-wrap items-center gap-1">
 {visibleRecommendations.slice(0, 3).map(
 ({ rec, offPlayer, onPlayer }) => (
 <button
 key={`${rec.offId}-${rec.onId}`}
 type="button"
 data-testid={`recommended-sub-${rec.offId}-${rec.onId}`}
 onClick={() =>
 handleApplyRecommendation(rec.offId, rec.onId)
 }
 className="flex items-center gap-1 rounded-full border border-slate-line bg-carbon-1 px-2 py-0.5 font-heading text-[10px] font-bold transition-colors hover:border-primary-400 hover:bg-primary-50 border-slate-line bg-carbon-1 hover:bg-carbon-3"
 >
 <span className="text-danger-400">
 {offPlayer.name.split(" ").pop()}
 </span>
 <span className="text-ink-faint">→</span>
 <span className="text-success-400">
 {onPlayer.name.split(" ").pop()}
 </span>
 </button>
 ),
 )}
 {visibleRecommendations.length > 3 && (
 <span className="font-heading text-[10px] text-ink-faint">
 +{visibleRecommendations.length - 3}
 </span>
 )}
 </div>
 )}

 {/* Quick formation & play style selects */}
 <div className="ml-auto flex items-center gap-2">
 <Select
 value={
 FORMATIONS.includes(team.formation)
 ? team.formation
 : FORMATIONS[0]
 }
 onChange={(e) => onFormationChange(e.target.value)}
 aria-label={t("tactics.formation")}
 selectSize="xs"
 >
 {FORMATIONS.map((f) => (
 <option key={f} value={f}>
 {f}
 </option>
 ))}
 </Select>
 <Select
 value={team.play_style}
 onChange={(e) => onPlayStyleChange(e.target.value)}
 aria-label={t("tactics.playStyle")}
 selectSize="xs"
 >
 {PLAY_STYLES.map((style) => (
 <option key={style} value={style}>
 {t(`common.playStyles.${style}`, style)}
 </option>
 ))}
 </Select>
 </div>
 </div>

 {/* Main body: two columns */}
 <div className="flex min-h-0 flex-1 overflow-hidden">
 {/* Left: formation pitch + on-field player list */}
 <div className="flex min-w-0 flex-1 flex-col border-r border-slate-line">
 <div className="shrink-0 border-b border-slate-line bg-carbon-2 px-4 py-2 border-slate-line bg-carbon-1/50">
 <p className="font-heading text-xs uppercase tracking-widest text-danger-400">
 {selectedOff
 ? t("match.takingOff", { name: selectedPlayer?.name })
 : t("match.selectPlayerOff")}
 </p>
 </div>

 {/* Formation pitch */}
 <FormationPitch
 formation={team.formation}
 players={team.players}
 sentOff={snapshot.sent_off}
 selectedId={selectedOff}
 subbedOnIds={subbedOnIds}
 onPlayerClick={handleSelectOffPlayer}
 className="mx-4 mt-3 h-[210px] shrink-0"
 />

 {/* On-field player table */}
 <div className="min-h-0 flex-1 overflow-auto px-4 py-2">
 <table className="w-full text-left">
 <thead>
 <tr className="border-b border-slate-line font-heading text-[10px] uppercase tracking-widest text-ink-dim border-slate-line text-ink-faint">
 <th className="py-2 pr-2">{t("match.player")}</th>
 <th className="w-12 py-2 text-center">
 {t("common.position")}
 </th>
 <th className="w-12 py-2 text-center">
 {t("common.ovr")}
 </th>
 <th className="w-24 py-2">{t("match.fitness")}</th>
 </tr>
 </thead>
 <tbody>
 {team.players
 .filter((p) => !snapshot.sent_off.includes(p.id))
 .sort((a, b) => {
 const ord: Record<string, number> = {
 Goalkeeper: 1,
 Defender: 2,
 Midfielder: 3,
 Forward: 4,
 };
 return (
 (ord[a.position] ?? 99) -
 (ord[b.position] ?? 99) ||
 a.name.localeCompare(b.name)
 );
 })
 .map((p) => {
 const isSelected = selectedOff === p.id;
 const isSubOn = subbedOnIds.has(p.id);
 const row = (
 <tr
 key={p.id}
 data-testid={`sub-panel-off-${p.id}`}
 onClick={() => handleSelectOffPlayer(p.id)}
 onKeyDown={(e) =>
 handleInteractiveRowKeyDown(e, () =>
 handleSelectOffPlayer(p.id),
 )
 }
 role="button"
 tabIndex={0}
 aria-pressed={isSelected}
 className={`cursor-pointer text-sm transition-colors ${
 isSelected
 ? "bg-danger-500/10"
 : "hover:bg-carbon-2 hover:bg-carbon-3/50"
 }`}
 >
 <td className="py-2 pr-2">
 <div className="flex items-center gap-1.5">
 {isSelected && (
 <UserMinus className="h-3.5 w-3.5 shrink-0 text-danger-400" />
 )}
 {isSubOn && (
 <span className="text-[10px] text-success-400">
 ▲
 </span>
 )}
 <span
 className={`truncate font-medium ${isSelected ? "text-danger-400" : "text-ink-dim"}`}
 >
 {p.name}
 </span>
 </div>
 </td>
 <td className="w-12 py-2 text-center">
 <span className="font-heading text-xs text-ink-dim">
 {translatePositionAbbreviation(
 t,
 p.position,
 )}
 </span>
 </td>
 <td
 className={`w-12 py-2 text-center font-heading font-bold ${interpretOvr(p.ovr, p.position).colorClass}`}
 title={interpretOvr(p.ovr, p.position).description}
 >
 {shortOvrLabel(p.ovr, p.position)}
 </td>
 <td className="w-24 py-2">
 <div className="flex items-center gap-1.5">
 <div className="h-2 flex-1 overflow-hidden rounded-full bg-carbon-3 bg-carbon-3">
 <div
 className={`h-full rounded-full ${condBgColor(p.condition)}`}
 style={{ width: `${p.condition}%` }}
 />
 </div>
 <span
 className={`w-16 text-right font-heading text-xs ${condColor(p.condition)}`}
 title={interpretCondition(Math.round(p.condition)).description}
 >
 {interpretCondition(Math.round(p.condition)).short}
 </span>
 </div>
 </td>
 </tr>
 );
 return (
 <ContextMenu
 key={p.id}
 items={[
 {
 label: isSelected
 ? t("common.cancel")
 : t("match.selectToTakeOff"),
 icon: <UserMinus className="h-4 w-4" />,
 onClick: () => handleSelectOffPlayer(p.id),
 },
 ]}
 >
 {row}
 </ContextMenu>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>

 {/* Right: bench players (full column height) */}
 <div className="flex min-w-0 flex-1 flex-col">
 <div className="shrink-0 border-b border-slate-line bg-carbon-2 px-4 py-2 border-slate-line bg-carbon-1/50">
 <p className="font-heading text-xs uppercase tracking-widest text-success-400">
 {selectedOff
 ? t("match.selectReplacement")
 : t("match.benchPlayers")}
 </p>
 </div>

 {availableBench.length === 0 ? (
 <div className="flex flex-1 items-center justify-center">
 <p className="text-xs text-ink-dim text-ink-faint">
 {t("match.noBenchAvailable")}
 </p>
 </div>
 ) : (
 <div className="min-h-0 flex-1 overflow-auto px-4 py-2">
 <table className="w-full text-left">
 <thead>
 <tr className="border-b border-slate-line font-heading text-[10px] uppercase tracking-widest text-ink-dim border-slate-line text-ink-faint">
 <th className="py-2 pr-2">{t("match.player")}</th>
 <th className="w-12 py-2 text-center">
 {t("common.position")}
 </th>
 <th className="w-12 py-2 text-center">
 {t("common.ovr")}
 </th>
 <th className="w-24 py-2">{t("match.fitness")}</th>
 </tr>
 </thead>
 <tbody>
 {availableBench.map((p) => {
 const posMatch = selectedPlayer
 ? p.position === selectedPlayer.position
 : true;
 const benchRow = (
 <tr
 key={p.id}
 data-testid={`sub-panel-bench-${p.id}`}
 onClick={() => handleSelectBenchPlayer(p.id)}
 onKeyDown={(e) =>
 handleInteractiveRowKeyDown(e, () =>
 handleSelectBenchPlayer(p.id),
 )
 }
 role="button"
 tabIndex={0}
 aria-pressed={selectedBench === p.id}
 aria-disabled={!selectedOff}
 className={`text-sm transition-colors ${
 selectedOff
 ? selectedBench === p.id
 ? "cursor-pointer bg-success-500/15 ring-1 ring-success-500/30"
 : "cursor-pointer hover:bg-success-500/10"
 : "opacity-60"
 }`}
 >
 <td className="py-2 pr-2">
 <div className="flex items-center gap-1.5">
 {selectedOff && (
 <UserPlus className="h-3.5 w-3.5 shrink-0 text-success-400/50" />
 )}
 <span className="truncate font-medium text-ink-dim">
 {p.name}
 </span>
 </div>
 </td>
 <td className="w-12 py-2 text-center">
 <span
 className={`font-heading text-xs ${!posMatch && selectedOff ? "text-accent-400" : "text-ink-dim"}`}
 >
 {translatePositionAbbreviation(t, p.position)}
 {!posMatch && selectedOff && " !"}
 </span>
 </td>
 <td
 className={`w-12 py-2 text-center font-heading font-bold ${interpretOvr(p.ovr, p.position).colorClass}`}
 title={interpretOvr(p.ovr, p.position).description}
 >
 {shortOvrLabel(p.ovr, p.position)}
 </td>
 <td className="w-24 py-2">
 <div className="flex items-center gap-1.5">
 <div className="h-2 flex-1 overflow-hidden rounded-full bg-carbon-3 bg-carbon-3">
 <div
 className={`h-full rounded-full ${condBgColor(p.condition)}`}
 style={{ width: `${p.condition}%` }}
 />
 </div>
 <span
 className={`w-16 text-right font-heading text-xs ${condColor(p.condition)}`}
 title={interpretCondition(Math.round(p.condition)).description}
 >
 {interpretCondition(Math.round(p.condition)).short}
 </span>
 </div>
 </td>
 </tr>
 );
 return (
 <ContextMenu
 key={p.id}
 items={
 selectedOff
 ? [
 {
 label:
 selectedBench === p.id
 ? t(
 "match.clearReplacementSelection",
 )
 : t("match.selectReplacementMenu"),
 icon: <UserPlus className="h-4 w-4" />,
 onClick: () =>
 handleSelectBenchPlayer(p.id),
 },
 ]
 : [
 {
 label: t(
 "match.selectPlayerToTakeOffFirst",
 ),
 icon: <UserPlus className="h-4 w-4" />,
 onClick: () => {},
 disabled: true,
 },
 ]
 }
 >
 {benchRow}
 </ContextMenu>
 );
 })}
 </tbody>
 </table>
 </div>
 )}

 {/* Sub history */}
 {snapshot.substitutions.filter((s) => s.side === side).length >
 0 && (
 <div className="shrink-0 border-t border-slate-line px-4 py-3 border-slate-line">
 <p className="mb-1.5 font-heading text-[10px] uppercase tracking-widest text-ink-dim text-ink-faint">
 {t("match.history")}
 </p>
 {snapshot.substitutions
 .filter((s) => s.side === side)
 .map((sub, i) => (
 <div
 key={i}
 className="flex items-center gap-1.5 py-0.5 text-[11px]"
 >
 <span className="w-5 text-right font-mono tabular-nums text-ink-dim text-ink-faint">
 {sub.minute}'
 </span>
 <span className="text-success-400">▲</span>
 <span className="truncate text-ink-dim">
 {getPlayerName(snapshot, sub.player_on_id)}
 </span>
 <span className="text-danger-400">▼</span>
 <span className="truncate text-ink-dim">
 {getPlayerName(snapshot, sub.player_off_id)}
 </span>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 {/* Sticky footer: comparison summary + confirm / cancel */}
 <div className="shrink-0 border-t border-slate-line bg-carbon-2/60 px-4 py-3 border-slate-line bg-carbon-0/30">
 {selectedPlayer && comparedPlayer ? (
 <div>
 {/* Player names + position match + action buttons */}
 <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
 <div className="flex items-center gap-1.5">
 <UserMinus className="h-3.5 w-3.5 shrink-0 text-danger-400" />
 <span className="max-w-[110px] truncate font-heading text-sm font-bold text-danger-400">
 {selectedPlayer.name}
 </span>
 <span className="text-ink-faint">→</span>
 <span className="max-w-[110px] truncate font-heading text-sm font-bold text-success-400">
 {comparedPlayer.name}
 </span>
 <UserPlus className="h-3.5 w-3.5 shrink-0 text-success-400" />
 </div>
 <span
 className={`font-heading text-[10px] font-bold uppercase tracking-wide ${
 comparedPlayer.position === selectedPlayer.position
 ? "text-success-400"
 : "text-accent-400"
 }`}
 >
 {comparedPlayer.position === selectedPlayer.position
 ? t("match.fitExact")
 : t("match.fitAdjusted")}
 </span>
 <div className="ml-auto flex items-center gap-2">
 <button
 type="button"
 onClick={handleClearSelection}
 className="rounded border border-slate-line px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-ink transition-colors hover:bg-carbon-2 border-slate-line text-ink-dim hover:bg-carbon-3"
 >
 {t("common.cancel")}
 </button>
 <button
 type="button"
 onClick={handleConfirmSubstitution}
 className="rounded bg-success-500 px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-ink transition-colors hover:bg-success-400"
 >
 {t("match.confirmSubstitution")}
 </button>
 </div>
 </div>
 {/* V99.7-4: Attribute comparison bars — all use Gaffer-voice labels,
   no raw numbers shown. The bar widths still use the underlying values
   for visual comparison, but the text shows interpretation tiers. */}
 <div className="grid grid-cols-2 gap-x-4">
 <CompareBar
 label="OVR"
 valA={selectedPlayer.ovr}
 valB={comparedPlayer.ovr}
 displayA={shortOvrLabel(selectedPlayer.ovr, selectedPlayer.position)}
 displayB={shortOvrLabel(comparedPlayer.ovr, comparedPlayer.position)}
 />
 <CompareBar
 label="PAC"
 valA={selectedPlayer.pace}
 valB={comparedPlayer.pace}
 displayA={shortAttrLabel("pace", selectedPlayer.pace)}
 displayB={shortAttrLabel("pace", comparedPlayer.pace)}
 />
 <CompareBar
 label="PAS"
 valA={selectedPlayer.passing}
 valB={comparedPlayer.passing}
 displayA={shortAttrLabel("passing", selectedPlayer.passing)}
 displayB={shortAttrLabel("passing", comparedPlayer.passing)}
 />
 <CompareBar
 label="SHO"
 valA={selectedPlayer.shooting}
 valB={comparedPlayer.shooting}
 displayA={shortAttrLabel("finishing", selectedPlayer.shooting)}
 displayB={shortAttrLabel("finishing", comparedPlayer.shooting)}
 />
 <CompareBar
 label="TAC"
 valA={selectedPlayer.tackling}
 valB={comparedPlayer.tackling}
 displayA={shortAttrLabel("defending", selectedPlayer.tackling)}
 displayB={shortAttrLabel("defending", comparedPlayer.tackling)}
 />
 <CompareBar
 label="COND"
 valA={Math.round(selectedPlayer.condition)}
 valB={Math.round(comparedPlayer.condition)}
 displayA={interpretCondition(Math.round(selectedPlayer.condition)).short}
 displayB={interpretCondition(Math.round(comparedPlayer.condition)).short}
 />
 </div>
 </div>
 ) : selectedPlayer ? (
 <div className="flex items-center gap-2">
 <UserMinus className="h-3.5 w-3.5 text-danger-400" />
 <span className="font-heading text-sm font-bold text-danger-400">
 {selectedPlayer.name}
 </span>
 <span className="text-ink-faint">—</span>
 <span className="font-heading text-xs uppercase tracking-wide text-ink-dim">
 {t("match.selectBenchToCompare")}
 </span>
 </div>
 ) : (
 <p className="text-center font-heading text-xs uppercase tracking-widest text-ink-dim">
 {t("match.selectPlayerOff")}
 </p>
 )}
 </div>
 </>
 )}
 </div>
 </div>
 );
}
