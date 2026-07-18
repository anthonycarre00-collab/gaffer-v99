import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { GameStateData } from "../../store/gameStore";
import {
 MatchSnapshot,
 MatchEvent,
 getTeamTalkOptions,
 TeamTalkTone,
} from "./types";
import { getEventDisplay, getPlayerName, makeTeamFallback } from "./helpers";
import { getTalkIcon } from "./TeamTalkIcons";
import { Badge, TeamLogo, ThemeToggle } from "../ui";
import {
 QuickStat,
 renderScorers,
 PlayerRatingsPanel,
} from "./PostMatchHelpers";
import { PossessionDonut } from "./PostMatchCharts";
import { interpretMorale } from "../../lib/gafferEngine";
import { generateMatchHighlights } from "./matchHighlights";
import {
 Trophy,
 TrendingDown,
 Minus,
 Star,
 MessageCircle,
 ChevronRight,
 BarChart3,
 Users,
 FileText,
 Shield,
} from "lucide-react";

interface PostMatchScreenProps {
 snapshot: MatchSnapshot;
 gameState: GameStateData;
 userSide: "Home" | "Away" | null;
 isSpectator: boolean;
 importantEvents: MatchEvent[];
 onContinue: () => void;
 onFinish: () => void;
}

type PostMatchTab = "teamTalk" | "matchReport" | "playerRatings" | "tactics";

const SET_PIECE_CLEAR_EVENTS = new Set([
 "ShotOffTarget", "ShotBlocked", "ShotSaved", "PenaltyMiss",
 "Clearance", "Interception", "PassIntercepted", "GoalKick",
]);

export function computeGoalSources(
 events: MatchEvent[],
 side: "Home" | "Away",
): { openPlay: number; corners: number; freekicks: number; penalties: number } {
 const sources = { openPlay: 0, corners: 0, freekicks: 0, penalties: 0 };
 // Track (type, side) so a set piece by one team doesn't attribute the other's goal
 let lastSetPiece: { type: "Corner" | "FreeKick"; side: "Home" | "Away" } | null = null;
 for (const evt of events) {
 if (evt.event_type === "Corner") {
 lastSetPiece = { type: "Corner", side: evt.side };
 } else if (evt.event_type === "FreeKick") {
 lastSetPiece = null;
 // Only dangerous FKs: taking side must be in their attacking third
 const dangerousZone = evt.side === "Home" ? "AwayDefense" : "HomeDefense";
 if (evt.zone === dangerousZone) {
 lastSetPiece = { type: "FreeKick", side: evt.side };
 }
 } else if (SET_PIECE_CLEAR_EVENTS.has(evt.event_type)) {
 lastSetPiece = null;
 } else if (evt.event_type === "Goal") {
 if (evt.side === side) {
 if (lastSetPiece?.type === "Corner" && lastSetPiece.side === side) sources.corners++;
 else if (lastSetPiece?.type === "FreeKick" && lastSetPiece.side === side) sources.freekicks++;
 else sources.openPlay++;
 }
 lastSetPiece = null;
 } else if (evt.event_type === "PenaltyGoal") {
 if (evt.side === side) sources.penalties++;
 lastSetPiece = null;
 }
 }
 return sources;
}

export default function PostMatchScreen({
 snapshot,
 gameState,
 userSide,
 isSpectator,
 importantEvents,
 onContinue,
 onFinish,
}: PostMatchScreenProps) {
 const { t } = useTranslation();
 const teamTalkOptions = getTeamTalkOptions(t);
 const [activeTab, setActiveTab] = useState<PostMatchTab>(
 !isSpectator && userSide ? "teamTalk" : "matchReport",
 );
 const [selectedTalk, setSelectedTalk] = useState<TeamTalkTone | null>(null);
 const [talkDelivered, setTalkDelivered] = useState(false);
 const [talkPending, setTalkPending] = useState(false);
 const [talkError, setTalkError] = useState<string | null>(null);
 const [talkResults, setTalkResults] = useState<
 {
 player_id: string;
 player_name: string;
 old_morale: number;
 new_morale: number;
 delta: number;
 }[]
 >([]);

 const homeFullTeam = gameState.teams.find(
 (t) => t.id === snapshot.home_team.id,
 );
 const awayFullTeam = gameState.teams.find(
 (t) => t.id === snapshot.away_team.id,
 );
 const homeTeamColor = homeFullTeam?.colors?.primary || "#2d5a3d";
 const awayTeamColor = awayFullTeam?.colors?.primary || "#7a2e1f";

 const userScore =
 userSide === "Home" ? snapshot.home_score : snapshot.away_score;
 const oppScore =
 userSide === "Home" ? snapshot.away_score : snapshot.home_score;

 // The match score stays the regulation/ET score; a level tie decided on
 // penalties resolves the verdict via the shootout tally instead.
 const shootout = snapshot.penalty_shootout;
 const userPens =
 userSide === "Home" ? shootout?.home_scored : shootout?.away_scored;
 const oppPens =
 userSide === "Home" ? shootout?.away_scored : shootout?.home_scored;

 const resultType =
 userScore > oppScore
 ? "win"
 : userScore < oppScore
 ? "loss"
 : userPens !== undefined && oppPens !== undefined && userPens !== oppPens
 ? userPens > oppPens
 ? "win"
 : "loss"
 : "draw";

 const keyEvents = importantEvents.filter((e) =>
 [
 "Goal",
 "PenaltyGoal",
 "YellowCard",
 "RedCard",
 "SecondYellow",
 "PenaltyMiss",
 "Injury",
 ].includes(e.event_type),
 );

 const homeEvents = snapshot.events.filter((e) => e.side === "Home");
 const awayEvents = snapshot.events.filter((e) => e.side === "Away");
 const countType = (events: MatchEvent[], type: string) =>
 events.filter((e) => e.event_type === type).length;

 const homeShots =
 countType(homeEvents, "Goal") +
 countType(homeEvents, "PenaltyGoal") +
 countType(homeEvents, "ShotSaved") +
 countType(homeEvents, "ShotOffTarget") +
 countType(homeEvents, "ShotBlocked");
 const awayShots =
 countType(awayEvents, "Goal") +
 countType(awayEvents, "PenaltyGoal") +
 countType(awayEvents, "ShotSaved") +
 countType(awayEvents, "ShotOffTarget") +
 countType(awayEvents, "ShotBlocked");

 const suggestedTalks: TeamTalkTone[] =
 resultType === "win"
 ? ["praise", "calm", "motivational"]
 : resultType === "loss"
 ? ["motivational", "assertive", "disappointed"]
 : ["calm", "motivational", "assertive"];

 const handleDeliverTalk = async () => {
 if (!selectedTalk || talkPending) return;
 const context =
 resultType === "win"
 ? "winning"
 : resultType === "loss"
 ? "losing"
 : "drawing";
 setTalkPending(true);
 setTalkError(null);
 try {
 const results = await invoke<
 {
 player_id: string;
 player_name: string;
 old_morale: number;
 new_morale: number;
 delta: number;
 }[]
 >("apply_team_talk", { tone: selectedTalk, context });
 setTalkResults(results);
 setTalkDelivered(true);
 } catch (err) {
 console.error("Team talk failed:", err);
 setTalkError(t("match.teamTalkFailed"));
 } finally {
 setTalkPending(false);
 }
 };

 const tabs: { id: PostMatchTab; label: string; icon: React.ReactNode }[] = [
 ...(!isSpectator && userSide
 ? [
 {
 id: "teamTalk" as PostMatchTab,
 label: t("match.postMatchTeamTalk"),
 icon: <MessageCircle className="w-4 h-4" />,
 },
 ]
 : []),
 {
 id: "matchReport",
 label: t("match.matchReport"),
 icon: <FileText className="w-4 h-4" />,
 },
 {
 id: "playerRatings",
 label: t("match.playerRatings"),
 icon: <Users className="w-4 h-4" />,
 },
 {
 id: "tactics",
 label: t("match.tacticsTab"),
 icon: <Shield className="w-4 h-4" />,
 },
 ];

 return (
 <div className="min-h-screen bg-carbon-2 text-ink bg-carbon-0 text-ink flex flex-col transition-colors duration-300">
 {/* Result Header */}
 <header
 // V99.10 UI-6: Replaced gradients with matte Gaffer palette backgrounds.
 // The design system explicitly avoids gradients — this was the last
 // remaining `bg-linear-to-r` in the app.
 className={`gaffer-pitch-strip border-b border-accent-500/20 px-4 py-6 transition-colors duration-300 ${
 resultType === "win"
 ? "bg-primary-500/15 dark:bg-primary-500/10"
 : resultType === "loss"
 ? "bg-danger-500/15 dark:bg-danger-500/10"
 : "bg-concrete/15 bg-carbon-2/50"
 }`}
 >
 <div className="text-center relative">
 <ThemeToggle className="absolute right-0 top-0" />

 {/* Result badge */}
 {!isSpectator && userSide && (
 <div className="mb-3">
 {resultType === "win" && (
 <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-100 dark:bg-primary-500/20 rounded-full transition-colors duration-300">
 <Trophy className="w-4 h-4 text-accent-700 dark:text-accent-400" />
 <span className="font-heading font-bold text-sm uppercase tracking-widest text-primary-700 dark:text-primary-400">
 {t("match.victory")}
 </span>
 </div>
 )}
 {resultType === "loss" && (
 <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-danger-500/20 rounded-full">
 <TrendingDown className="w-4 h-4 text-danger-400" />
 <span className="font-heading font-bold text-sm uppercase tracking-widest text-danger-400">
 {t("match.defeat")}
 </span>
 </div>
 )}
 {resultType === "draw" && (
 <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-carbon-3/20 rounded-full">
 <Minus className="w-4 h-4 text-ink-faint" />
 <span className="font-heading font-bold text-sm uppercase tracking-widest text-ink-faint">
 {t("match.draw")}
 </span>
 </div>
 )}
 </div>
 )}

 {/* Scoreboard */}
 <div className="flex items-center justify-center gap-10">
 <div className="flex items-center gap-4">
 <TeamLogo
 team={homeFullTeam ?? makeTeamFallback(snapshot.home_team.name)}
 className="w-14 h-14 rounded flex items-center justify-center font-heading font-bold text-lg overflow-hidden"
 imageClassName="h-10 w-10 object-contain drop-shadow"
 style={{
 backgroundColor: homeTeamColor + "30",
 borderColor: homeTeamColor,
 borderWidth: 2,
 }}
 />
 <p className="font-heading font-bold text-base text-ink">
 {snapshot.home_team.name}
 </p>
 </div>

 <div className="flex items-center gap-5">
 <span className="text-5xl font-heading font-bold text-ink tabular-nums">
 {snapshot.home_score}
 </span>
 <div className="text-center">
 <p className="text-xs font-heading uppercase tracking-widest text-accent-700 dark:text-accent-400">
 {t("match.fullTime")}
 </p>
 <p className="text-base font-heading font-bold text-ink-faint text-ink-faint">
 {t("match.ft")}
 </p>
 {shootout && (
 <p className="text-sm font-heading font-bold text-ink-dim tabular-nums whitespace-nowrap">
 {t("match.pen")} {shootout.home_scored}–{shootout.away_scored}
 </p>
 )}
 </div>
 <span className="text-5xl font-heading font-bold text-ink tabular-nums">
 {snapshot.away_score}
 </span>
 </div>

 <div className="flex items-center gap-4">
 <p className="font-heading font-bold text-base text-ink">
 {snapshot.away_team.name}
 </p>
 <TeamLogo
 team={awayFullTeam ?? makeTeamFallback(snapshot.away_team.name)}
 className="w-14 h-14 rounded flex items-center justify-center font-heading font-bold text-lg overflow-hidden"
 imageClassName="h-10 w-10 object-contain drop-shadow"
 style={{
 backgroundColor: awayTeamColor + "30",
 borderColor: awayTeamColor,
 borderWidth: 2,
 }}
 />
 </div>
 </div>
 </div>
 </header>

 {/* Sticky Action Bar */}
 <div className="sticky top-0 z-10 bg-carbon-1 border-b border-slate-line shadow-sm transition-colors duration-300">
 <div className="px-6 py-3 flex items-center justify-center gap-3">
 {isSpectator ? (
 <button
 type="button"
 onClick={onFinish}
 className="flex items-center gap-2 px-6 py-2 bgc-primary-500 hover:bg-primary-600 rounded font-heading font-bold uppercase tracking-wider text-sm text-ink transition-all"
 >
 {t("match.continueDashboard")}
 <ChevronRight className="w-4 h-4" />
 </button>
 ) : (
 <>
 <button
 type="button"
 onClick={onFinish}
 className="flex items-center gap-2 px-5 py-2 bg-carbon-2 hover:bg-carbon-3 hover:bg-carbon-3 rounded font-heading font-bold uppercase tracking-wider text-sm text-ink-dim transition-colors"
 >
 {t("match.skip")}
 </button>
 <button
 type="button"
 onClick={onContinue}
 className="flex items-center gap-2 px-6 py-2 bgc-primary-500 hover:bg-primary-600 rounded font-heading font-bold uppercase tracking-wider text-sm text-ink transition-all"
 >
 {t("match.continue")}
 <ChevronRight className="w-4 h-4" />
 </button>
 </>
 )}
 </div>
 </div>

 {/* Tab Bar */}
 <div className="bg-carbon-1 border-b border-slate-line transition-colors duration-300">
 <div className="px-6">
 <div className="flex gap-1" role="tablist">
 {tabs.map((tab) => (
 <button
 key={tab.id}
 id={`tab-${tab.id}`}
 type="button"
 role="tab"
 aria-selected={activeTab === tab.id}
 aria-controls={`tabpanel-${tab.id}`}
 onClick={() => setActiveTab(tab.id)}
 className={`flex items-center gap-2 px-5 py-3 text-sm font-heading font-bold uppercase tracking-wider border-b-2 transition-colors ${
 activeTab === tab.id
 ? "border-primary-500 text-primary-600 dark:text-primary-400"
 : "border-transparent text-ink-dim hover:text-ink"
 }`}
 >
 {tab.icon}
 {tab.label}
 </button>
 ))}
 </div>
 </div>
 </div>

 {/* Tab Content */}
 <div className="flex-1 overflow-auto">
 <div className="px-6 py-6">
 {/* Team Talk Tab */}
 {!isSpectator && userSide && (
 <div
 id="tabpanel-teamTalk"
 role="tabpanel"
 aria-labelledby="tab-teamTalk"
 hidden={activeTab !== "teamTalk"}
 className="max-w-2xl mx-auto"
 >
 {!talkDelivered ? (
 <div className="bg-carbon-1 rounded border border-slate-line shadow-sm p-6 transition-colors duration-300">
 <div className="flex items-center gap-2 mb-4">
 <MessageCircle className="w-4 h-4 text-accent-400" />
 <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-ink-dim">
 {t("match.postMatchTeamTalk")}
 </h3>
 </div>
 <p className="text-sm text-ink-dim mb-4">
 {t("match.addressPlayers")}
 </p>
 <div className="grid grid-cols-2 gap-3 mb-4">
 {teamTalkOptions.map((opt) => {
 const isSuggested = suggestedTalks.includes(opt.id);
 return (
 <button
 key={opt.id}
 type="button"
 onClick={() => setSelectedTalk(opt.id)}
 className={`flex items-center gap-3 p-4 rounded text-left transition-all ${
 selectedTalk === opt.id
 ? "bg-primary-500/20 ring-2 ring-primary-500/50"
 : "bg-carbon-2 hover:bg-carbon-2/50 hover:bg-carbon-3"
 }`}
 >
 <span className="text-2xl">
 {getTalkIcon(opt.icon)}
 </span>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5">
 <p
 className={`text-sm font-heading font-bold truncate ${
 selectedTalk === opt.id
 ? "text-primary-400"
 : "text-ink"
 }`}
 >
 {opt.label}
 </p>
 {isSuggested && (
 <Star className="w-3 h-3 text-accent-400 shrink-0" />
 )}
 </div>
 <p className="text-[11px] text-ink-dim truncate">
 {opt.description}
 </p>
 </div>
 </button>
 );
 })}
 </div>
 {selectedTalk && (
 <button
 type="button"
 onClick={handleDeliverTalk}
 disabled={talkPending}
 className={`w-full py-3 rounded font-heading font-bold text-sm uppercase tracking-wider transition-colors ${
 talkPending
 ? "bg-carbon-3 bg-carbon-3 text-ink-faint cursor-not-allowed"
 : "bg-primary-500/20 hover:bg-primary-500/30 text-primary-400"
 }`}
 >
 {talkPending
 ? t("match.delivering")
 : t("match.deliverTeamTalk")}
 </button>
 )}
 {talkError && (
 <p className="text-sm text-danger-500 mt-2">{talkError}</p>
 )}
 </div>
 ) : (
 <div className="bg-carbon-1 rounded border border-slate-line shadow-sm p-6 transition-colors duration-300">
 <div className="flex items-center gap-3 mb-5">
 <span className="text-2xl">
 {getTalkIcon(selectedTalk || "")}
 </span>
 <div>
 <p className="text-sm font-heading font-bold text-primary-400">
 {
 teamTalkOptions.find((o) => o.id === selectedTalk)
 ?.label
 }
 </p>
 <Badge variant="success" size="sm">
 {t("match.delivered")}
 </Badge>
 </div>
 </div>
 {talkResults.length > 0 && (
 <div className="rounded overflow-hidden border border-slate-line">
 <table className="w-full text-xs">
 <thead>
 <tr className="bg-carbon-2/50">
 <th className="text-left px-3 py-2 font-heading uppercase tracking-wider text-ink-dim">
 {t("match.player")}
 </th>
 <th className="text-right px-3 py-2 font-heading uppercase tracking-wider text-ink-dim">
 Δ
 </th>
 <th className="px-3 py-2 w-24"></th>
 <th className="text-right px-3 py-2 font-heading uppercase tracking-wider text-ink-dim">
 %
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-line-soft dark:divide-slate-line-soft">
 {talkResults.map((r) => (
 <tr
 key={r.player_id}
 className="hover:bg-carbon-2 hover:bg-carbon-3/30 transition-colors"
 >
 <td className="px-3 py-2 text-ink-dim font-medium truncate max-w-0 w-full">
 {r.player_name}
 </td>
 <td
 className={`px-3 py-2 text-right font-mono font-mono font-bold tabular-nums ${
 r.delta > 0
 ? "text-success-500"
 : r.delta < 0
 ? "text-danger-400"
 : "text-ink-faint"
 }`}
 >
 {r.delta > 0 ? "+" : ""}
 {r.delta}
 </td>
 <td className="px-3 py-2">
 <div className="h-1.5 bg-carbon-3 rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full transition-all ${
 r.new_morale >= 70
 ? "bg-success-500"
 : r.new_morale >= 40
 ? "bg-accent-500"
 : "bg-danger-500"
 }`}
 style={{ width: `${r.new_morale}%` }}
 />
 </div>
 </td>
 <td className="px-3 py-2 text-right tabular-nums font-heading">
 <span
 className={`font-bold ${interpretMorale(r.new_morale).colorClass}`}
 title={interpretMorale(r.new_morale).description}
 >
 {interpretMorale(r.new_morale).short}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 )}
 </div>
 )}

 {/* Match Report Tab */}
 <div
 id="tabpanel-matchReport"
 role="tabpanel"
 aria-labelledby="tab-matchReport"
 hidden={activeTab !== "matchReport"}
 className="grid grid-cols-2 gap-6"
 >
 {/* V99.3 IDEAS #1: Match Highlights package — Gaffer-voice narrative */}
 {(() => {
 const highlights = generateMatchHighlights(
 snapshot,
 importantEvents,
 userSide === "Home",
 t,
 );
 return (
 <div className="col-span-2 bg-carbon-1 rounded border border-slate-line shadow-sm p-4 transition-colors duration-300 gaffer-card-texture">
 <div className="flex items-center gap-2 mb-2">
 <Trophy className="w-4 h-4 text-accent-500" />
 <h3 className="text-sm font-heading font-bold uppercase tracking-widest text-accent-600 dark:text-accent-400">
 {highlights.headline}
 </h3>
 </div>
 <p className="text-sm text-ink-dim leading-relaxed">
 {highlights.summary}
 </p>
 {highlights.keyMoments.length > 0 && (
 <div className="mt-3 pt-3 border-t border-slate-line-soft">
 <p className="text-[10px] font-heading font-bold uppercase tracking-widest text-ink-dim mb-2">
 Key Moments
 </p>
 <div className="flex flex-col gap-1.5">
 {highlights.keyMoments.map((moment, i) => (
 <div key={i} className="flex items-start gap-2 text-xs">
 <span className="font-heading font-bold tabular-nums text-ink-dim w-8 shrink-0">
 {moment.minute}'
 </span>
 <span className={`flex-1 ${moment.important ? "font-medium text-ink" : "text-ink-dim"}`}>
 {moment.line}
 </span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
 })()}
 {/* Scorers */}
 <div className="bg-carbon-1 rounded border border-slate-line shadow-sm p-4 transition-colors duration-300">
 <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-ink-dim mb-3">
 {t("match.scorers")}
 </h3>
 {renderScorers(snapshot, importantEvents, "Home")}
 {renderScorers(snapshot, importantEvents, "Away")}
 {keyEvents.filter(
 (e) =>
 e.event_type === "Goal" || e.event_type === "PenaltyGoal",
 ).length === 0 && (
 <p className="text-xs text-ink-dim text-ink-faint">
 {t("match.noGoals")}
 </p>
 )}
 </div>

 {/* Quick Stats */}
 <div className="bg-carbon-1 rounded border border-slate-line shadow-sm p-4 transition-colors duration-300">
 <div className="flex items-center gap-2 mb-3">
 <BarChart3 className="w-4 h-4 text-ink-dim" />
 <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-ink-dim">
 {t("match.quickStats")}
 </h3>
 </div>
 <div className="flex justify-center mb-3">
 <PossessionDonut
 homePct={snapshot.home_possession_pct}
 awayPct={snapshot.away_possession_pct}
 homeTeamName={snapshot.home_team.name}
 awayTeamName={snapshot.away_team.name}
 homeColor={homeTeamColor}
 awayColor={awayTeamColor}
 label={t("match.possession")}
 />
 </div>
 <QuickStat
 label={t("match.shots")}
 home={homeShots}
 away={awayShots}
 />
 <QuickStat
 label={t("match.fouls")}
 home={countType(homeEvents, "Foul")}
 away={countType(awayEvents, "Foul")}
 />
 <QuickStat
 label={t("match.corners")}
 home={countType(homeEvents, "Corner")}
 away={countType(awayEvents, "Corner")}
 />
 </div>

 {/* Key Events */}
 <div className="bg-carbon-1 rounded border border-slate-line shadow-sm p-4 transition-colors duration-300">
 <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-ink-dim mb-3">
 {t("match.matchEvents")}
 </h3>
 {keyEvents.length === 0 ? (
 <p className="text-xs text-ink-dim text-ink-faint">
 {t("match.quietMatch")}
 </p>
 ) : (
 <div className="flex flex-col gap-2">
 {keyEvents.map((evt, i) => {
 const display = getEventDisplay(evt);
 return (
 <div key={i} className="flex items-center gap-2 text-xs">
 <span className="text-ink-dim text-ink-faint tabular-nums w-6 text-right font-heading">
 {evt.minute}'
 </span>
 <span>{display.icon}</span>
 <span
 className={`${display.color} font-medium truncate flex-1`}
 >
 {getPlayerName(snapshot, evt.player_id)}
 </span>
 <Badge
 variant={evt.side === "Home" ? "primary" : "accent"}
 size="sm"
 >
 {evt.side === "Home"
 ? snapshot.home_team.name.substring(0, 3)
 : snapshot.away_team.name.substring(0, 3)}
 </Badge>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Substitutions */}
 {snapshot.substitutions.length > 0 && (
 <div className="bg-carbon-1 rounded border border-slate-line shadow-sm p-4 transition-colors duration-300">
 <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-ink-dim mb-3">
 {t("match.substitutions")}
 </h3>
 <div className="flex flex-col gap-2">
 {snapshot.substitutions.map((sub, i) => (
 <div key={i} className="flex items-center gap-2 text-xs">
 <span className="text-ink-dim text-ink-faint tabular-nums w-6 text-right font-heading">
 {sub.minute}'
 </span>
 <span className="text-success-400">↑</span>
 <span className="text-ink-dim truncate flex-1">
 {getPlayerName(snapshot, sub.player_on_id)}
 </span>
 <span className="text-danger-400">↓</span>
 <span className="text-ink-dim truncate">
 {getPlayerName(snapshot, sub.player_off_id)}
 </span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* Player Ratings Tab */}
 <div
 id="tabpanel-playerRatings"
 role="tabpanel"
 aria-labelledby="tab-playerRatings"
 hidden={activeTab !== "playerRatings"}
 className="grid grid-cols-2 gap-6"
 >
 {(["Home", "Away"] as const).map((side) => (
 <PlayerRatingsPanel
 key={side}
 snapshot={snapshot}
 side={side}
 teamColor={side === "Home" ? homeTeamColor : awayTeamColor}
 userSide={userSide}
 />
 ))}
 </div>

 {/* Tactics Tab */}
 <div
 id="tabpanel-tactics"
 role="tabpanel"
 aria-labelledby="tab-tactics"
 hidden={activeTab !== "tactics"}
 className="grid grid-cols-2 gap-6"
 >
 {/* Goal Sources — spans both columns */}
 {(() => {
 const homeSrc = computeGoalSources(snapshot.events, "Home");
 const awaySrc = computeGoalSources(snapshot.events, "Away");
 const homeTotal = homeSrc.openPlay + homeSrc.corners + homeSrc.freekicks + homeSrc.penalties || 1;
 const awayTotal = awaySrc.openPlay + awaySrc.corners + awaySrc.freekicks + awaySrc.penalties || 1;
 const sourceKeys: { key: keyof typeof homeSrc; label: string }[] = [
 { key: "openPlay", label: t("match.openPlay") },
 { key: "corners", label: t("match.cornersGoals") },
 { key: "freekicks", label: t("match.freekickGoals") },
 { key: "penalties", label: t("match.penaltyGoals") },
 ];
 return (
 <div className="col-span-2 bg-carbon-1 rounded border border-slate-line shadow-sm p-4 transition-colors duration-300">
 <div className="flex items-center gap-2 mb-3">
 <BarChart3 className="w-4 h-4 text-ink-dim" />
 <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-ink-dim">
 {t("match.goalSources")}
 </h3>
 </div>
 <div className="space-y-2">
 {sourceKeys.map(({ key, label }) => {
 const hv = homeSrc[key];
 const av = awaySrc[key];
 const homePct = Math.round((hv / homeTotal) * 100);
 const awayPct = Math.round((av / awayTotal) * 100);
 const rowTotal = hv + av;
 const homeBarPct = rowTotal > 0 ? Math.round((hv / rowTotal) * 100) : 0;
 const awayBarPct = rowTotal > 0 ? 100 - homeBarPct : 0;
 return (
 <div key={key} className="mb-1 last:mb-0">
 <div className="flex justify-between text-xs mb-0.5">
 <span className="font-mono font-bold text-primary-400 tabular-nums">
 {hv} <span className="font-normal text-ink-faint">({homePct}%)</span>
 </span>
 <span className="text-ink-dim text-ink-faint font-heading uppercase tracking-wider text-[10px]">
 {label}
 </span>
 <span className="font-mono font-bold text-primary-400 tabular-nums">
 <span className="font-normal text-ink-faint">({awayPct}%)</span> {av}
 </span>
 </div>
 <div className="flex h-1 bg-carbon-3 bg-carbon-2 rounded-full overflow-hidden">
 <div className="h-full bg-primary-500" style={{ width: `${homeBarPct}%` }} />
 <div className="h-full bg-primary-500" style={{ width: `${awayBarPct}%` }} />
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
 })()}

 {/* Player roles per side */}
 {(["Home", "Away"] as const).map((side) => {
 const team = side === "Home" ? snapshot.home_team : snapshot.away_team;
 const teamColor = side === "Home" ? homeTeamColor : awayTeamColor;
 return (
 <div
 key={side}
 className="bg-carbon-1 rounded border border-slate-line shadow-sm p-4 transition-colors duration-300"
 >
 <div className="flex items-center gap-2 mb-1">
 <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teamColor }} />
 <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-ink-dim">
 {team.name}
 </h3>
 </div>
 <p className="text-[10px] text-ink-faint text-ink-faint font-heading uppercase tracking-wider mb-3">
 {team.formation} · {t(`common.playStyles.${team.play_style}` as never, team.play_style)}
 </p>
 <div className="flex flex-col gap-0.5 max-h-52 overflow-auto">
 {team.players.map((p) => (
 <div key={p.id} className="flex items-center gap-2 text-xs py-0.5">
 <span className="text-ink-faint text-ink-faint text-[10px] font-heading uppercase w-6 shrink-0">
 {p.position.charAt(0)}
 </span>
 <span className="text-ink-dim truncate flex-1">{p.name}</span>
 <span className="text-ink-dim text-[10px] font-heading shrink-0">
 {t(`tactics.playerRoles.${p.role ?? "Standard"}` as never, p.role ?? "Standard")}
 </span>
 </div>
 ))}
 </div>
 </div>
 );
 })}
 </div>

 </div>
 </div>
 </div>
 );
}
