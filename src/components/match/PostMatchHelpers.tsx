import { useTranslation } from "react-i18next";
import { MatchSnapshot, MatchEvent } from "./types";
import { getPlayerName } from "./helpers";
import { Badge } from "../ui";
import { Circle, Star } from "lucide-react";
import { interpretMatchRating } from "../../lib/gafferEngine";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";

// ---------------------------------------------------------------------------
// QuickStat bar
// ---------------------------------------------------------------------------

export function QuickStat({
 label,
 home,
 away,
 homePct,
}: {
 label: string;
 home: number | string;
 away: number | string;
 homePct?: number;
}) {
 const hv = typeof home === "number" ? home : 0;
 const av = typeof away === "number" ? away : 0;
 const total = hv + av || 1;
 const pct = homePct ?? (hv / total) * 100;

 return (
 <div className="mb-2 last:mb-0">
 <div className="flex justify-between text-xs mb-0.5">
 <span className="font-mono font-bold text-primary-400 tabular-nums">
 {home}
 </span>
 <span className="text-ink-dim text-ink-faint font-heading uppercase tracking-wider text-[10px]">
 {label}
 </span>
 <span className="font-mono font-bold text-primary-400 tabular-nums">
 {away}
 </span>
 </div>
 <div className="flex h-1 bg-carbon-3 bg-carbon-2 rounded-full overflow-hidden transition-colors duration-300">
 <div className="h-full bg-primary-500" style={{ width: `${pct}%` }} />
 <div
 className="h-full bg-primary-500"
 style={{ width: `${100 - pct}%` }}
 />
 </div>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Scorer list per side
// ---------------------------------------------------------------------------

export function renderScorers(
 snapshot: MatchSnapshot,
 events: MatchEvent[],
 side: "Home" | "Away",
) {
 const goals = events.filter(
 (e) =>
 e.side === side &&
 (e.event_type === "Goal" || e.event_type === "PenaltyGoal"),
 );
 if (goals.length === 0) return null;

 const team = side === "Home" ? snapshot.home_team : snapshot.away_team;
 return (
 <div className="mb-3 last:mb-0">
 <p
 className={`text-[10px] font-heading uppercase tracking-widest mb-1 ${
 side === "Home" ? "text-primary-400" : "text-primary-400"
 }`}
 >
 {team.name}
 </p>
 {goals.map((g, i) => (
 <div key={i} className="flex items-center gap-2 text-xs py-0.5">
 <span className="text-ink-dim text-ink-faint tabular-nums w-6 text-right font-heading">
 {g.minute}'
 </span>
 <Circle className="w-3 h-3 fill-current text-accent-400" />
 <span className="text-ink text-ink font-medium">
 {getPlayerName(snapshot, g.player_id)}
 </span>
 {g.event_type === "PenaltyGoal" && (
 <Badge variant="accent" size="sm">
 PEN
 </Badge>
 )}
 </div>
 ))}
 </div>
 );
}

// ---------------------------------------------------------------------------
// Player Ratings panel for one side
// ---------------------------------------------------------------------------

export function PlayerRatingsPanel({
 snapshot,
 side,
 teamColor,
 userSide,
}: {
 snapshot: MatchSnapshot;
 side: "Home" | "Away";
 teamColor: string;
 userSide: "Home" | "Away" | null;
}) {
 const { t } = useTranslation();
 const team = side === "Home" ? snapshot.home_team : snapshot.away_team;
 const ratings: Record<string, number> = {};
 team.players.forEach((p) => {
 ratings[p.id] = 6.0;
 });
 snapshot.events.forEach((evt) => {
 if (evt.side !== side || !evt.player_id) return;
 if (!ratings[evt.player_id] && ratings[evt.player_id] !== 0) return;
 if (evt.event_type === "Goal" || evt.event_type === "PenaltyGoal")
 ratings[evt.player_id] = (ratings[evt.player_id] || 6) + 1.2;
 else if (
 evt.event_type === "ShotSaved" ||
 evt.event_type === "ShotOnTarget"
 )
 ratings[evt.player_id] = (ratings[evt.player_id] || 6) + 0.2;
 else if (evt.event_type === "ShotOffTarget")
 ratings[evt.player_id] = (ratings[evt.player_id] || 6) - 0.1;
 else if (evt.event_type === "PassCompleted")
 ratings[evt.player_id] = (ratings[evt.player_id] || 6) + 0.02;
 else if (evt.event_type === "Tackle" || evt.event_type === "Interception")
 ratings[evt.player_id] = (ratings[evt.player_id] || 6) + 0.15;
 else if (evt.event_type === "Foul")
 ratings[evt.player_id] = (ratings[evt.player_id] || 6) - 0.2;
 else if (
 evt.event_type === "YellowCard" ||
 evt.event_type === "SecondYellow"
 )
 ratings[evt.player_id] = (ratings[evt.player_id] || 6) - 0.5;
 else if (evt.event_type === "RedCard")
 ratings[evt.player_id] = (ratings[evt.player_id] || 6) - 1.5;
 if (
 evt.secondary_player_id &&
 ratings[evt.secondary_player_id] !== undefined
 ) {
 if (evt.event_type === "Goal" || evt.event_type === "PenaltyGoal")
 ratings[evt.secondary_player_id] += 0.7;
 }
 });
 const won =
 (side === "Home" && snapshot.home_score > snapshot.away_score) ||
 (side === "Away" && snapshot.away_score > snapshot.home_score);
 if (won)
 Object.keys(ratings).forEach((id) => {
 ratings[id] += 0.5;
 });
 Object.keys(ratings).forEach((id) => {
 ratings[id] = Math.max(1, Math.min(10, ratings[id]));
 });
 const sorted = team.players
 .map((p) => ({ ...p, rating: Math.round(ratings[p.id] * 10) / 10 }))
 .sort((a, b) => b.rating - a.rating);
 const motm = sorted[0];

 return (
 <div className="bg-white bg-carbon-1 rounded border border-slate-line shadow-sm p-4 transition-colors duration-300">
 <div className="flex items-center gap-2 mb-3">
 <Star className="w-4 h-4 text-accent-700 dark:text-accent-400" />
 <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-ink-dim">
 {t("match.ratings", { team: team.name })}
 </h3>
 <div
 className="w-2 h-2 rounded-full ml-auto"
 style={{ backgroundColor: teamColor }}
 />
 </div>
 {motm && side === (userSide || "Home") && (
 <div className="flex items-center gap-3 mb-3 p-2 bg-accent-50 dark:bg-accent-500/10 rounded border border-accent-200 dark:border-accent-500/20 transition-colors duration-300">
 <div className="w-8 h-8 rounded bg-accent-100 dark:bg-accent-500/20 flex items-center justify-center transition-colors duration-300">
 <span className="text-sm font-heading font-bold text-accent-700 dark:text-accent-400">
 {motm.rating.toFixed(1)}
 </span>
 </div>
 <div>
 <p className="text-xs font-heading font-bold text-accent-700 dark:text-accent-400 uppercase tracking-wider">
 {t("match.motm")}
 </p>
 <p className="text-sm text-ink text-ink font-medium">{motm.name}</p>
 </div>
 </div>
 )}
 <div className="flex flex-col gap-0.5 max-h-40 overflow-auto">
 {sorted.map((p) => (
 <div
 key={p.id}
 className="flex items-center gap-2 px-1 py-0.5 text-xs"
 >
 <span
 className={`font-heading font-bold tabular-nums w-16 ${interpretMatchRating(p.rating).colorClass}`}
 title={interpretMatchRating(p.rating).description}
 >
 {interpretMatchRating(p.rating).short}
 </span>
 <span className="text-ink-dim truncate flex-1">{p.name}</span>
 <span className="text-ink-dim text-ink-faint text-[10px] font-heading uppercase">
 {translatePositionAbbreviation(t, p.position)}
 </span>
 </div>
 ))}
 </div>
 </div>
 );
}
