/**
 * Match Highlights Generator — IDEAS #1
 *
 * After each match, generate a "highlights package" — a short textual
 * replay of the key moments, told in the Gaffer's voice. Selects the
 * 5-8 most notable events (goals, big chances, red cards, late winners,
 * great saves) and chains them into a narrative summary.
 *
 * Different voice for wins vs losses vs draws.
 */

import type { TFunction } from "i18next";
import type { MatchEvent, MatchSnapshot } from "./types";
import { getCommentary } from "./commentary";

export interface MatchHighlights {
  /** Short headline — e.g. "Late drama at the Emirates" */
  headline: string;
  /** Full narrative paragraph in Gaffer voice */
  summary: string;
  /** The 5-8 key events selected, with commentary */
  keyMoments: Array<{
    minute: number;
    headline: string;
    line: string;
    important: boolean;
  }>;
}

/**
 * Select the most notable events from a match for the highlights package.
 * Priority: goals > red cards > penalties > big chances > great saves > late drama.
 */
function selectKeyEvents(events: MatchEvent[], maxCount: number = 7): MatchEvent[] {
  // Always include all goals + red cards, then fill with other notable events.
  const goals = events.filter((e) => e.event_type === "Goal" || e.event_type === "PenaltyGoal");
  const reds = events.filter((e) => e.event_type === "RedCard" || e.event_type === "SecondYellow");
  const pens = events.filter(
    (e) => e.event_type === "PenaltyAwarded" || e.event_type === "PenaltyMiss",
  );
  const saves = events.filter((e) => e.event_type === "ShotSaved");

  let selected = [...goals, ...reds, ...pens, ...saves];

  // Deduplicate (an event might match multiple filters).
  const seen = new Set(selected.map((e) => `${e.minute}-${e.event_type}-${e.player_id}`));
  selected = selected.filter(
    (e) => seen.has(`${e.minute}-${e.event_type}-${e.player_id}`) && seen.delete(`${e.minute}-${e.event_type}-${e.player_id}`),
  );

  // If we still have room, add late yellow cards + substitutions.
  if (selected.length < maxCount) {
    const late = events
      .filter((e) => e.minute >= 70 && e.event_type === "YellowCard")
      .filter((e) => !selected.includes(e))
      .slice(0, maxCount - selected.length);
    selected.push(...late);
  }

  // Sort by minute.
  selected.sort((a, b) => a.minute - b.minute);

  // Cap at maxCount.
  return selected.slice(0, maxCount);
}

/**
 * Generate the Gaffer-voice headline based on the result.
 */
function generateHeadline(
  homeScore: number,
  awayScore: number,
  isUserHome: boolean,
): string {
  const userScore = isUserHome ? homeScore : awayScore;
  const oppScore = isUserHome ? awayScore : homeScore;
  const userWon = userScore > oppScore;
  const draw = userScore === oppScore;

  if (draw) {
    if (userScore === 0) return "Stalemate";
    return "Honours even";
  }

  if (userWon) {
    const margin = userScore - oppScore;
    if (margin >= 4) return "Thumping win";
    if (margin >= 3) return "Rout";
    if (margin === 1 && userScore <= 2) return "Narrow victory";
    if (oppScore === 0) return "Clean sheet victory";
    return "Well-earned three points";
  }

  // User lost
  const margin = oppScore - userScore;
  if (margin >= 4) return "Hammering";
  if (margin >= 3) return "Heavy defeat";
  if (margin === 1) return "Narrow loss";
  return "Beaten";
}

/**
 * Generate the full narrative summary in Gaffer voice.
 */
function generateSummary(
  snapshot: MatchSnapshot,
  keyEvents: MatchEvent[],
  isUserHome: boolean,
  t: TFunction,
): string {
  const homeName = snapshot.home_team.name;
  const awayName = snapshot.away_team.name;
  const homeScore = snapshot.home_score;
  const awayScore = snapshot.away_score;
  const userName = isUserHome ? homeName : awayName;
  const oppName = isUserHome ? awayName : homeName;
  const userScore = isUserHome ? homeScore : awayScore;
  const oppScore = isUserHome ? awayScore : homeScore;
  const userWon = userScore > oppScore;
  const draw = userScore === oppScore;

  const parts: string[] = [];

  // Opening line based on result.
  if (userWon) {
    if (oppScore === 0) {
      parts.push(`${userName} kept it tight and got the job done.`);
    } else {
      parts.push(`${userName} got the better of ${oppName} today.`);
    }
  } else if (draw) {
    parts.push(`${userName} and ${oppName} couldn't be separated.`);
  } else {
    if (userScore === 0) {
      parts.push(`${userName} drew a blank against ${oppName}.`);
    } else {
      parts.push(`${userName} came up short against ${oppName}.`);
    }
  }

  // Chain the key events.
  const goals = keyEvents.filter(
    (e) => e.event_type === "Goal" || e.event_type === "PenaltyGoal",
  );
  const reds = keyEvents.filter(
    (e) => e.event_type === "RedCard" || e.event_type === "SecondYellow",
  );

  if (goals.length > 0) {
    const goalDescriptions = goals.map((evt) => {
      const commentary = getCommentary(evt, snapshot, t);
      return commentary?.line ?? `Goal on ${evt.minute} minutes`;
    });
    parts.push(goalDescriptions.join(". "));
  }

  if (reds.length > 0) {
    parts.push(`A red card${reds.length > 1 ? " or two" : ""} threw a spanner in the works.`);
  }

  // Closing line.
  if (userWon) {
    parts.push("The gaffer will be pleased with that one.");
  } else if (draw) {
    parts.push("A point's a point — onto the next one.");
  } else {
    parts.push("Back to the drawing board.");
  }

  return parts.join(" ");
}

/**
 * Generate a complete match highlights package.
 */
export function generateMatchHighlights(
  snapshot: MatchSnapshot,
  events: MatchEvent[],
  isUserHome: boolean,
  t: TFunction,
): MatchHighlights {
  const keyEvents = selectKeyEvents(events, 7);
  const headline = generateHeadline(
    snapshot.home_score,
    snapshot.away_score,
    isUserHome,
  );
  const summary = generateSummary(snapshot, keyEvents, isUserHome, t);

  const keyMoments = keyEvents.map((evt) => {
    const commentary = getCommentary(evt, snapshot, t);
    return {
      minute: evt.minute,
      headline: commentary?.headline ?? evt.event_type,
      line: commentary?.line ?? `${evt.event_type} on ${evt.minute} minutes`,
      important: evt.event_type === "Goal" || evt.event_type === "RedCard",
    };
  });

  return { headline, summary, keyMoments };
}

