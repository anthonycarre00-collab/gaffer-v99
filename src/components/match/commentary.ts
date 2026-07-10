import type { TFunction } from "i18next";
import type {
  MatchEvent,
  MatchSnapshot,
  EventDetail,
  DangerBand,
  SaveQuality,
  FoulSeverity,
  GoalContext,
} from "./types";
import { getPlayerName } from "./helpers";

/**
 * Map PascalCase event_type values (from the Rust engine) to the camelCase
 * i18n keys used in `match.commentary.*`. Some event types are also aliased
 * (e.g. `ShotSaved` → `save`, `YellowCard` → `card`) because the i18n
 * templates were written before the engine's event-type enum was finalised.
 *
 * Without this map, the lookup `match.commentary.${evt.event_type}` resolves
 * to e.g. `match.commentary.Goal` (PascalCase) — but the i18n key is
 * `match.commentary.goal` (camelCase). The lookup fails silently, falls
 * through to the plain "team + event type label" fallback in MatchPanels,
 * and the user sees what looks like "broken commentary".
 */
const EVENT_TYPE_TO_I18N_KEY: Record<string, string> = {
 // Goals & shots
 Goal: "goal",
 PenaltyGoal: "penaltyGoal",
 PenaltyMiss: "penaltyMissed",
 PenaltyAwarded: "penalty",
 ShotSaved: "save",
 ShotOffTarget: "miss",
 ShotBlocked: "shotBlocked",
 ShotOnTarget: "save", // close enough — a shot on target is a save
 // Discipline
 Foul: "foul",
 YellowCard: "card",
 RedCard: "card",
 SecondYellow: "card",
 // Match flow
 Injury: "injury",
 Substitution: "substitution",
 KickOff: "kickOff",
 HalfTime: "halfTime",
 SecondHalfStart: "secondHalfStart",
 FullTime: "fullTime",
 // Build-up & defending
 PassCompleted: "passCompleted",
 PassIntercepted: "passIntercepted",
 Dribble: "dribble",
 DribbleTackled: "dribbleTackled",
 Cross: "cross",
 Tackle: "tackle",
 Interception: "interception",
 Clearance: "clearance",
 // Aerial duels + offside
 HeaderWon: "headerWon",
 HeaderLost: "headerLost",
 Offside: "offside",
 // Set pieces
 Corner: "corner",
 FreeKick: "freeKick",
 GoalKick: "goalKick",
 // Penalty shootout
 ShootoutGoal: "shootoutGoal",
 ShootoutMiss: "shootoutMiss",
};

/** Event types that get the full headline + prose treatment. */
const COMMENTARY_EVENTS = new Set(Object.keys(EVENT_TYPE_TO_I18N_KEY));

export interface Commentary {
  headline: string;
  line: string;
}

/** Stable, RNG-free hash so a given event always renders the same variant. */
function hashEvent(evt: MatchEvent): number {
  const key = `${evt.minute}|${evt.event_type}|${evt.player_id ?? ""}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Map an event's truthful detail to a commentary sub-key (camelCase to match
 * the i18n keys). Returns null when the base key should be used.
 */
function detailVariant(detail: EventDetail | null | undefined): string | null {
  if (!detail) return null;
  if ("Shot" in detail) {
    const map: Record<DangerBand, string> = {
      Speculative: "speculative",
      Decent: "decent",
      BigChance: "bigChance",
    };
    return map[detail.Shot.danger] ?? null;
  }
  if ("Save" in detail) {
    const map: Record<SaveQuality, string> = {
      Routine: "routine",
      Strong: "strong",
      WorldClass: "worldClass",
    };
    return map[detail.Save.quality] ?? null;
  }
  if ("Foul" in detail) {
    const map: Record<FoulSeverity, string | null> = {
      Soft: null,
      Hard: "hard",
      Reckless: "reckless",
    };
    const val = map[detail.Foul.severity];
    return val !== undefined ? val : null;
  }
  if ("Goal" in detail) {
    const map: Record<GoalContext, string> = {
      Opener: "opener",
      Equaliser: "equaliser",
      Extends: "extends",
      Consolation: "consolation",
    };
    return map[detail.Goal.context] ?? null;
  }
  return null;
}

/** Count goals scored by a player up to and including this event. */
function goalTally(evt: MatchEvent, snapshot: MatchSnapshot): number {
  if (!evt.player_id) return 0;
  // `minute <=` (not an index/identity comparison) is intentional: the rendered
  // event is not always reference-identical to the entry in snapshot.events, so
  // indexOf would fail. The engine resolves at most one shot per minute, so a
  // same-minute same-player double goal cannot occur and this cannot overcount.
  return snapshot.events.filter(
    (e) =>
      (e.event_type === "Goal" || e.event_type === "PenaltyGoal") &&
      e.player_id === evt.player_id &&
      e.minute <= evt.minute,
  ).length;
}

/**
 * Resolve the variant sub-key, with goal tally (hat-trick/brace) taking
 * precedence over goal context.
 */
function variantKey(evt: MatchEvent, snapshot: MatchSnapshot): string | null {
  if (evt.event_type === "Goal" || evt.event_type === "PenaltyGoal") {
    const tally = goalTally(evt, snapshot);
    if (tally === 3) return "hattrick";
    if (tally === 2) return "brace";
  }
  return detailVariant(evt.detail);
}

/** Manual interpolation since the variant string is a value, not a key. */
function interpolate(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => tokens[name] ?? "");
}

/**
 * Capitalise the first letter of a variant string. Used to compose top-level
 * variant keys like `goalBrace`, `goalHattrick`, `goalOpener` — the i18n
 * schema has these as separate top-level entries (NOT nested under `goal`).
 */
function capitalise(s: string): string {
 return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

function pickLine(
  t: TFunction,
  baseKey: string,
  variant: string | null,
  hash: number,
  tokens: Record<string, string>,
): Commentary | null {
  // V99.2: Build the candidate key list.
  // 1. If there's a variant, try `${baseKey}${Capitalised(variant)}` as a
  //    sibling top-level key (e.g. `match.commentary.goalBrace`).
  // 2. Then try `${baseKey}.${variant}` (nested form, e.g. `match.commentary.goal.brace`).
  // 3. Finally fall back to the bare `${baseKey}`.
  const candidates: string[] = [];
  if (variant) {
 candidates.push(`${baseKey}${capitalise(variant)}`, `${baseKey}.${variant}`);
  }
  candidates.push(baseKey);

  for (const key of candidates) {
    // The i18n structure can be either:
    //   match.commentary.goal: ["line1", "line2", ...]   (array form)
    //   match.commentary.goal: { lines: {...}, headline: "..." }  (object form)
    // Try both — first the object form (.lines), then the array form (direct).
    const linesObj = t(`${key}.lines`, { returnObjects: true }) as
      | Record<string, string>
      | string[];
    const linesArr = t(`${key}`, { returnObjects: true }) as
      | string[]
      | Record<string, string>;

    let values: string[] = [];
    if (Array.isArray(linesObj)) {
      values = linesObj;
    } else if (linesObj && typeof linesObj === "object") {
      values = Object.values(linesObj);
    } else if (Array.isArray(linesArr)) {
      values = linesArr;
    } else if (linesArr && typeof linesArr === "object") {
      values = Object.values(linesArr);
    }

    if (values.length === 0) continue;
    const template = values[hash % values.length];
    if (typeof template !== "string") continue;
    let headline = t(`${key}.headline`, { defaultValue: "" });
    // V99.2: If no explicit headline was set, derive one from the line's
    // opening word(s) — e.g. "HAT-TRICK! {{scorer}} has got three!" → "HAT-TRICK!"
    // This makes the headline meaningful for variant arrays that don't have
    // a separate headline field in the i18n.
    if (!headline) {
      const exclaimIdx = template.indexOf("!");
      if (exclaimIdx > 0 && exclaimIdx <= 16) {
        headline = template.slice(0, exclaimIdx + 1).trim();
      }
    }
    return { headline, line: interpolate(template, tokens) };
  }
  return null;
}

export function getCommentary(
  evt: MatchEvent,
  snapshot: MatchSnapshot,
  t: TFunction,
): Commentary | null {
  if (!COMMENTARY_EVENTS.has(evt.event_type)) return null;

  const isHome = evt.side === "Home";
  const team = isHome ? snapshot.home_team.name : snapshot.away_team.name;
  const opponent = isHome ? snapshot.away_team.name : snapshot.home_team.name;
  const player = getPlayerName(snapshot, evt.player_id);
  const victim = getPlayerName(snapshot, evt.secondary_player_id);

  // Tokens — cover all variants used in the i18n templates. `scorer` is an
  // alias for `player` (goal templates use {{scorer}}), `on`/`off` are for
  // substitutions (substitution templates use {{on}}/{{off}}).
  const tokens: Record<string, string> = {
    team,
    opponent,
    player,
    victim,
    scorer: player,
    on: player,
    off: victim,
  };

  // V99.2: Map PascalCase event_type to camelCase i18n key.
  // Without this, the lookup always fails (key `match.commentary.Goal`
  // doesn't exist — only `match.commentary.goal` does).
  const i18nKey = EVENT_TYPE_TO_I18N_KEY[evt.event_type];
  if (!i18nKey) return null;

  const baseKey = `match.commentary.${i18nKey}`;
  const variant = variantKey(evt, snapshot);
  const hash = hashEvent(evt);

  const result = pickLine(t, baseKey, variant, hash, tokens);
  if (result) return result;

  // Fallback: synthesize a basic commentary line if no i18n template matched.
  // This ensures the user always sees SOMETHING in the commentary feed rather
  // than a bare "team + event label" — the previous "broken commentary" bug.
  const fallbackHeadline = t(`match.eventTypes.${evt.event_type}`, {
    defaultValue: evt.event_type,
  });
  const fallbackLine = [player, team].filter(Boolean).join(" — ") || team;
  return { headline: fallbackHeadline, line: fallbackLine };
}
