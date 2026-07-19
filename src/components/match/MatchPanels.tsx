import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { MatchSnapshot, MatchEvent, EnginePlayerData } from "./types";
import { getEventDisplay, getEventTypeLabel, getPlayerName } from "./helpers";
import { getCommentary } from "./commentary";
import { getPunditLine, withSpeaker } from "./punditry";
import { getPunditNameForFixture } from "../../services/punditService";
import { Badge } from "../ui";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import { interpretCondition } from "../../lib/gafferEngine";

export function EventFeed({
 events,
 snapshot,
 feedRef,
 playerJerseyMap,
 userSide,
}: {
 events: MatchEvent[];
 snapshot: MatchSnapshot;
 feedRef: React.RefObject<HTMLDivElement | null>;
 playerJerseyMap?: Map<string, number>;
 /** Which side the user is on — drives the pundit's tone. */
 userSide?: "Home" | "Away";
}) {
 function displayName(playerId: string | null): string {
 const name = getPlayerName(snapshot, playerId);
 if (!name || !playerId || !playerJerseyMap) return name;
 const jersey = playerJerseyMap.get(playerId);
 return jersey != null ? `${name} (#${jersey})` : name;
 }
 const { t } = useTranslation();
 // Pundit tone → tailwind class
 const punditToneClass = (tone: "positive" | "neutral" | "negative" | "amazed" | "furious"): string => {
 switch (tone) {
 case "amazed":
 return "text-accent-600 dark:text-accent-400 border-accent-300 dark:border-accent-700 bg-accent-50 dark:bg-accent-950/30";
 case "positive":
 return "text-primary-600 dark:text-primary-400 border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/30";
 case "negative":
 return "text-ink-dim border-slate-line bg-carbon-2/40";
 case "furious":
 return "text-danger-600 dark:text-danger-400 border-danger-300 dark:border-danger-700 bg-danger-50 dark:bg-danger-950/30";
 default:
 return "text-ink-dim border-slate-line";
 }
 };
 // V99.2: Differentiate home vs away using distinct accent classes so the
 // user can tell at a glance which side did what. Previously both used the
 // same `text-primary-400` — making it impossible to distinguish.
 const sideAccentClass = (isHome: boolean): string =>
 isHome
 ? "text-primary-600 dark:text-primary-300"
 : "text-accent-600 dark:text-accent-300";

 // V100 P2 (Issue #12): Fetch the active pundit's name + catchphrases for this match.
 // Uses a pseudo-fixture-id derived from team ids so the same matchup
 // always gets the same pundit (deterministic, stable across re-renders).
 const [punditName, setPunditName] = useState<string | null>(null);
 const [punditCatchphrases, setPunditCatchphrases] = useState<Record<string, string>>({});
 useEffect(() => {
 const homeId = snapshot.home_team?.id ?? "";
 const awayId = snapshot.away_team?.id ?? "";
 if (!homeId || !awayId) return;
 const pseudoFixtureId = `${homeId}_vs_${awayId}`;
 let cancelled = false;
 void (async () => {
 const name = await getPunditNameForFixture(pseudoFixtureId);
 if (cancelled) return;
 setPunditName(name);
 // V100 (Issue #12): Pre-fetch catchphrases for key event types.
 const eventKeys = ["kickoff", "goal", "miss", "halftime", "fulltime_win", "fulltime_loss"];
 const phrases: Record<string, string> = {};
 for (const key of eventKeys) {
 try {
 const info = await invoke<{ catchphrase: string | null }>(
 "get_pundit_for_fixture",
 { fixtureId: pseudoFixtureId, eventKey: key }
 );
 if (info.catchphrase) phrases[key] = info.catchphrase;
 } catch { /* ignore */ }
 }
 if (!cancelled) setPunditCatchphrases(phrases);
 })();
 return () => { cancelled = true; };
 }, [snapshot.home_team?.id, snapshot.away_team?.id]);

 return (
 <div ref={feedRef} className="flex flex-col gap-1">
 {events.length === 0 ? (
 <div className="flex items-center justify-center h-40 text-ink-dim text-ink-faint">
 <p className="font-heading text-sm uppercase tracking-wider">
 {t("match.waitingKickoff")}
 </p>
 </div>
 ) : (
 events.map((evt, i) => {
 const display = getEventDisplay(evt);
 const isHome = evt.side === "Home";
 const commentary = getCommentary(evt, snapshot, t);
 // Pundit reaction — driven by whether the event is for/against
 // the user's team.
 const isUserEvent = userSide ? evt.side === userSide : false;
 const pundit = withSpeaker(getPunditLine(evt, snapshot, isUserEvent), punditName);
 return (
 <div
 key={i}
 className={`flex items-start gap-3 px-3 py-2 rounded transition-colors ${display.important ? "bg-carbon-1/80 border border-slate-line shadow-sm" : "opacity-60"}`}
 >
 <span className="text-ink-dim text-ink-faint tabular-nums font-heading text-sm w-8 text-right flex-shrink-0 pt-0.5">
 {evt.minute}'
 </span>
 <span className="text-lg flex-shrink-0">{display.icon}</span>
 <div className="flex-1 min-w-0">
 {commentary ? (
 <>
 <div className="flex items-center gap-2">
 <span
 className={`font-heading font-bold text-xs uppercase tracking-wider ${sideAccentClass(isHome)}`}
 >
 {commentary.headline}
 </span>
 <span className="text-xs text-ink-dim">
 {isHome ? snapshot.home_team.name : snapshot.away_team.name}
 </span>
 </div>
 <p className="text-sm text-ink-dim">
 {commentary.line}
 </p>
 {evt.event_type === "Goal" && evt.secondary_player_id && (
 <p className="text-xs text-ink-dim">
 {t("match.assist", {
 name: displayName(evt.secondary_player_id),
 })}
 </p>
 )}
 {/* Pundit reaction — second voice, like a co-commentator. */}
 {pundit ? (
 <p
 className={`mt-1 text-[11px] italic border-l-2 pl-2 py-0.5 rounded-sm ${punditToneClass(pundit.tone)}`}
 >
 <span className="font-heading not-italic uppercase tracking-wider opacity-70 mr-1">
 {pundit.speaker ?? t("match.punditLabel", { defaultValue: "Pundit:" })}
 {pundit.speaker ? ":" : ""}
 </span>
 {pundit.line}
 </p>
 ) : null}
 {/* V100 (Issue #12): Pundit catchphrase for key events. */}
 {(() => {
 const catchphraseKey = evt.event_type === "Goal" ? "goal"
 : evt.event_type === "ShotOffTarget" || evt.event_type === "ShotSaved" ? "miss"
 : evt.event_type === "HalfTime" ? "halftime"
 : evt.event_type === "FullTime" ? (isUserEvent ? "fulltime_win" : "fulltime_loss")
 : null;
 if (!catchphraseKey || !punditCatchphrases[catchphraseKey]) return null;
 return (
 <p className="mt-0.5 text-[10px] text-accent-400/70 italic pl-2">
 "{punditCatchphrases[catchphraseKey]}"
 </p>
 );
 })()}
 </>
 ) : (
 <>
 <div className="flex items-center gap-2">
 <span
 className={`font-heading font-bold text-xs uppercase tracking-wider ${sideAccentClass(isHome)}`}
 >
 {isHome ? snapshot.home_team.name : snapshot.away_team.name}
 </span>
 <span className="text-xs text-ink-dim">
 {getEventTypeLabel(evt.event_type, t)}
 </span>
 </div>
 {evt.player_id && (
 <p className="text-sm text-ink-dim font-medium">
 {displayName(evt.player_id)}
 {evt.secondary_player_id && (
 <span className="text-ink-dim font-normal">
 {evt.event_type === "Goal"
 ? ` (${t("match.assist", { name: displayName(evt.secondary_player_id) })})`
 : evt.event_type === "Substitution"
 ? ` ${t("match.subFor", { name: displayName(evt.secondary_player_id) })}`
 : ""}
 </span>
 )}
 </p>
 )}
 </>
 )}
 </div>
 </div>
 );
 })
 )}
 </div>
 );
}

export function MatchStats({ snapshot }: { snapshot: MatchSnapshot }) {
 const { t } = useTranslation();
 const homeEvents = snapshot.events.filter((e) => e.side === "Home");
 const awayEvents = snapshot.events.filter((e) => e.side === "Away");
 const ct = (events: MatchEvent[], type: string) =>
 events.filter((e) => e.event_type === type).length;

 const stats = [
 {
 label: t("match.possession"),
 home: `${snapshot.home_possession_pct.toFixed(0)}%`,
 away: `${snapshot.away_possession_pct.toFixed(0)}%`,
 homePct: snapshot.home_possession_pct,
 },
 {
 label: t("match.shots"),
 home:
 ct(homeEvents, "Goal") +
 ct(homeEvents, "PenaltyGoal") +
 ct(homeEvents, "ShotSaved") +
 ct(homeEvents, "ShotOffTarget") +
 ct(homeEvents, "ShotBlocked"),
 away:
 ct(awayEvents, "Goal") +
 ct(awayEvents, "PenaltyGoal") +
 ct(awayEvents, "ShotSaved") +
 ct(awayEvents, "ShotOffTarget") +
 ct(awayEvents, "ShotBlocked"),
 },
 {
 label: t("match.shotsOnTarget"),
 home:
 ct(homeEvents, "Goal") +
 ct(homeEvents, "PenaltyGoal") +
 ct(homeEvents, "ShotSaved"),
 away:
 ct(awayEvents, "Goal") +
 ct(awayEvents, "PenaltyGoal") +
 ct(awayEvents, "ShotSaved"),
 },
 {
 label: t("match.fouls"),
 home: ct(homeEvents, "Foul"),
 away: ct(awayEvents, "Foul"),
 },
 {
 label: t("match.corners"),
 home: ct(homeEvents, "Corner"),
 away: ct(awayEvents, "Corner"),
 },
 {
 label: t("match.yellowCards"),
 home: Object.keys(snapshot.home_yellows).length,
 away: Object.keys(snapshot.away_yellows).length,
 },
 ];

 return (
 <div className="max-w-lg mx-auto flex flex-col gap-3">
 {stats.map((stat, i) => {
 const hv = typeof stat.home === "number" ? stat.home : 0;
 const av = typeof stat.away === "number" ? stat.away : 0;
 const total = hv + av || 1;
 const pct = stat.homePct ?? (hv / total) * 100;
 return (
 <div key={i}>
 <div className="flex justify-between text-xs mb-1">
 <span className="font-mono font-bold text-primary-400 tabular-nums">
 {stat.home}
 </span>
 <span className="text-ink-dim font-heading uppercase tracking-wider text-[10px]">
 {stat.label}
 </span>
 <span className="font-mono font-bold text-primary-400 tabular-nums">
 {stat.away}
 </span>
 </div>
 <div className="flex h-1.5 bg-carbon-3 bg-carbon-2 rounded-full overflow-hidden transition-colors duration-300">
 <div
 className="h-full bg-primary-500 transition-all duration-500"
 style={{ width: `${pct}%` }}
 />
 <div
 className="h-full bg-primary-500 transition-all duration-500"
 style={{ width: `${100 - pct}%` }}
 />
 </div>
 </div>
 );
 })}
 </div>
 );
}

export function Lineups({ snapshot }: { snapshot: MatchSnapshot }) {
 const { t } = useTranslation();
 const renderTeam = (
 team: MatchSnapshot["home_team"],
 bench: EnginePlayerData[],
 side: "Home" | "Away",
 yellows: Record<string, number>,
 sentOff: string[],
 ) => {
 const positions = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
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
 return (
 <div className="flex-1">
 <h4
 className={`font-heading font-bold text-sm uppercase tracking-wider mb-3 ${side === "Home" ? "text-primary-400" : "text-primary-400"}`}
 >
 {team.name}{" "}
 <span className="text-ink-dim text-ink-faint font-normal text-xs">
 ({team.formation})
 </span>
 </h4>
 {positions.map((pos) => {
 const players = team.players.filter((p) => p.position === pos);
 if (players.length === 0) return null;
 return (
 <div key={pos} className="mb-3">
 <p className="text-[10px] font-heading uppercase tracking-widest text-ink-dim text-ink-faint mb-1">
 {pos}s
 </p>
 {players.map((p) => {
 const isOff = sentOff.includes(p.id);
 const yc = yellows[p.id] || 0;
 const isSubOn = subbedOnIds.has(p.id);
 const condColor =
 p.condition >= 70
 ? "bg-primary-500"
 : p.condition >= 40
 ? "bg-accent-500"
 : "bg-danger-500";
 return (
 <div
 key={p.id}
 className={`flex items-center gap-2 py-1 px-2 rounded text-xs ${isOff ? "opacity-40" : ""}`}
 >
 {isSubOn && (
 <span className="text-success-400 text-[10px]">▲</span>
 )}
 <span
 className={`font-medium flex-1 truncate ${isOff ? "line-through text-ink-dim text-ink-faint" : "text-ink-dim"}`}
 >
 {p.name}
 </span>
 {yc > 0 && (
 <span className="w-3 h-4 rounded-sm bg-accent-400 text-navy-900 text-[8px] flex items-center justify-center font-bold">
 {yc > 1 ? yc : ""}
 </span>
 )}
 {isOff && (
 <span className="w-3 h-4 rounded-sm bg-danger-500" />
 )}
 <div className="w-14 flex items-center gap-1">
 <div className="flex-1 h-1.5 bg-carbon-3 bg-carbon-3 rounded-full overflow-hidden transition-colors duration-300">
 <div
 className={`h-full ${condColor} rounded-full transition-all`}
 style={{ width: `${p.condition}%` }}
 />
 </div>
 <span
 className={`tabular-nums text-[10px] w-12 text-right ${interpretCondition(p.condition).colorClass}`}
 title={interpretCondition(p.condition).description}
 >
 {interpretCondition(p.condition).short}
 </span>
 </div>
 </div>
 );
 })}
 </div>
 );
 })}

 {/* Bench */}
 {bench.length > 0 && (
 <div className="mt-3 pt-3 border-t border-slate-line">
 <p className="text-[10px] font-heading uppercase tracking-widest text-ink-dim text-ink-faint mb-1">
 {t("match.bench")}
 </p>
 {bench.map((p) => {
 const wasSubbedOff = subbedOffIds.has(p.id);
 return (
 <div
 key={p.id}
 className={`flex items-center gap-2 py-1 px-2 rounded text-xs ${wasSubbedOff ? "opacity-50" : ""}`}
 >
 {wasSubbedOff && (
 <span className="text-danger-400 text-[10px]">▼</span>
 )}
 <span className="text-ink-dim font-medium flex-1 truncate">
 {p.name}
 </span>
 <Badge variant="neutral" size="sm">
 {translatePositionAbbreviation(t, p.position)}
 </Badge>
 <span
 className={`tabular-nums text-[10px] w-12 text-right ${interpretCondition(p.condition).colorClass}`}
 title={interpretCondition(p.condition).description}
 >
 {interpretCondition(p.condition).short}
 </span>
 </div>
 );
 })}
 </div>
 )}

 {/* Sub History */}
 {snapshot.substitutions.filter((s) => s.side === side).length > 0 && (
 <div className="mt-3 pt-3 border-t border-slate-line">
 <p className="text-[10px] font-heading uppercase tracking-widest text-ink-dim text-ink-faint mb-1">
 {t("match.substitutions")}
 </p>
 {snapshot.substitutions
 .filter((s) => s.side === side)
 .map((sub, i) => (
 <div
 key={i}
 className="flex items-center gap-1.5 py-0.5 text-[11px]"
 >
 <span className="text-ink-dim text-ink-faint tabular-nums w-5 text-right font-heading">
 {sub.minute}'
 </span>
 <span className="text-success-400">▲</span>
 <span className="text-ink-dim truncate">
 {getPlayerName(snapshot, sub.player_on_id)}
 </span>
 <span className="text-danger-400">▼</span>
 <span className="text-ink-dim truncate">
 {getPlayerName(snapshot, sub.player_off_id)}
 </span>
 </div>
 ))}
 </div>
 )}
 </div>
 );
 };
 return (
 <div className="flex gap-6">
 {renderTeam(
 snapshot.home_team,
 snapshot.home_bench,
 "Home",
 snapshot.home_yellows,
 snapshot.sent_off,
 )}
 <div className="w-px bg-carbon-3 transition-colors duration-300" />
 {renderTeam(
 snapshot.away_team,
 snapshot.away_bench,
 "Away",
 snapshot.away_yellows,
 snapshot.sent_off,
 )}
 </div>
 );
}
