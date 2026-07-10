/**
 * OVR Interpretation Layer — the Gaffer voice for overall player rating.
 *
 * Per the Gaffer constitution: players should NEVER be shown a raw "OVR"
 * number. Instead, the OVR is interpreted into a short, position-dependent
 * Gaffer-voice label ("Different Class", "Proper Player", "Limited", etc).
 *
 * Position-dependence matters: a 70-rated goalkeeper is described
 * differently than a 70-rated striker, because the same number means
 * different things in different contexts.
 *
 * Used everywhere the old code displayed `{player.ovr}` or `{getPlayerOvr(player)}`:
 * PitchToken, SquadRosterView, TacticsPlayerList, TransfersTab, PlayerProfileHeroCard,
 * etc. Drop-in replacement via `shortOvrLabel(ovr, position)`.
 *
 * Also handles scouting visibility: when a player hasn't been scouted
 * (no ScoutingKnowledge or Surface tier only), return "?" instead of a label.
 */

export type OvrTier =
 | "differentClass"
 | "properPlayer"
 | "solidPro"
 | "squadPlayer"
 | "limited"
 | "offThePace"
 | "outOfHisDepth";

export interface OvrInterpretation {
 /** Tier enum — useful for styling. */
 tier: OvrTier;
 /** Short label — 1-3 words for tight UI (pitch tokens, table cells). */
 short: string;
 /** Full description in Gaffer voice — for player profile hero card. */
 description: string;
 /** Tailwind colour class for the tier — drives badge colour. */
 colorClass: string;
}

/**
 * Per-position tiered descriptions.
 *
 * Each position has 7 tiers, ordered from highest to lowest threshold.
 * Thresholds are the same across positions (85/75/65/55/45/30/0) but the
 * descriptions are position-specific so a 75 GK reads differently than a
 * 75 ST.
 *
 * The descriptions are deliberately varied — no two positions share the
 * same phrasing for the same tier, so the game feels alive.
 */
const POSITION_OVR_LADDERS: Record<string, OvrInterpretation[]> = {
 // ───────────────── GOALKEEPER ─────────────────
 Goalkeeper: [
 {
 tier: "differentClass",
 short: "Wall",
 description: "Different class. A wall between the sticks — saves things he's got no right to.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "properPlayer",
 short: "Reliable",
 description: "Proper keeper. Makes the saves he should and a few he shouldn't.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solidPro",
 short: "Solid",
 description: "Solid shot-stopper. Doesn't make howlers.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "squadPlayer",
 short: "Average",
 description: "Average keeper. Beats more than he saves.",
 colorClass: "text-gray-700 dark:text-gray-300",
 },
 {
 tier: "limited",
 short: "Leaky",
 description: "Limited. Lets too many through him.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "offThePace",
 short: "Calamity",
 description: "Calamity. You hold your breath every shot.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 {
 tier: "outOfHisDepth",
 short: "Sieve",
 description: "Sieve. Defenders don't trust him — and rightly so.",
 colorClass: "text-danger-700 dark:text-danger-500",
 },
 ],

 // ───────────────── DEFENDER ─────────────────
 Defender: [
 {
 tier: "differentClass",
 short: "Wall",
 description: "Different class. A wall — reads it, nicks it, plays it simple.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "properPlayer",
 short: "Rock",
 description: "Proper defender. Holds his line, wins his duels.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solidPro",
 short: "Steady",
 description: "Steady at the back. Does the basics right.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "squadPlayer",
 short: "Beatable",
 description: "Beatable. Good wingers will have a field day.",
 colorClass: "text-gray-700 dark:text-gray-300",
 },
 {
 tier: "limited",
 short: "Leaky",
 description: "Leaky. Loses his man at the wrong moment.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "offThePace",
 short: "Liability",
 description: "Liability. The kind you drop after a fortnight.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 {
 tier: "outOfHisDepth",
 short: "Turnstile",
 description: "Turnstile. Anyone can walk through him.",
 colorClass: "text-danger-700 dark:text-danger-500",
 },
 ],

 // ───────────────── MIDFIELDER ─────────────────
 Midfielder: [
 {
 tier: "differentClass",
 short: "Puppeteer",
 description: "Different class. Pulls every string on the pitch.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "properPlayer",
 short: "Maestro",
 description: "Proper midfielder. Dictates the tempo, finds the angles.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solidPro",
 short: "Steady",
 description: "Steady in the middle. Keeps it ticking over.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "squadPlayer",
 short: "Average",
 description: "Average. Does a job, nothing more.",
 colorClass: "text-gray-700 dark:text-gray-300",
 },
 {
 tier: "limited",
 short: "Anonymous",
 description: "Limited. Goes missing too often.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "offThePace",
 short: "Bypassed",
 description: "Off the pace. Bypassed too easily.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 {
 tier: "outOfHisDepth",
 short: "Passenger",
 description: "Passenger. The other ten are carrying him.",
 colorClass: "text-danger-700 dark:text-danger-500",
 },
 ],

 // ───────────────── FORWARD ─────────────────
 Forward: [
 {
 tier: "differentClass",
 short: "Predator",
 description: "Different class. A chance is half a chance with him.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "properPlayer",
 short: "Clinical",
 description: "Proper finisher. Doesn't waste openings.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solidPro",
 short: "Reliable",
 description: "Reliable in front of goal. Takes the right option.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "squadPlayer",
 short: "Patchy",
 description: "Patchy. Scores the easy ones, misses the hard.",
 colorClass: "text-gray-700 dark:text-gray-300",
 },
 {
 tier: "limited",
 short: "Wayward",
 description: "Wayward. Snatches at chances too often.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "offThePace",
 short: "Profligate",
 description: "Profligate. You'd back the keeper over him most weeks.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 {
 tier: "outOfHisDepth",
 short: "Goal-shy",
 description: "Goal-shy. Forwards are paid to score — this one isn't earning it.",
 colorClass: "text-danger-700 dark:text-danger-500",
 },
 ],
};

/** Fallback ladder for unknown positions (shouldn't happen, but defensive). */
const DEFAULT_LADDER: OvrInterpretation[] = [
 {
 tier: "differentClass",
 short: "Different Class",
 description: "Different class — top, top player.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "properPlayer",
 short: "Proper Player",
 description: "Proper player. Would walk into most teams.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solidPro",
 short: "Solid Pro",
 description: "Solid pro. Does a job.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "squadPlayer",
 short: "Squad Player",
 description: "Squad player. Nothing special.",
 colorClass: "text-gray-700 dark:text-gray-300",
 },
 {
 tier: "limited",
 short: "Limited",
 description: "Limited. Not going to set the world alight.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "offThePace",
 short: "Off the Pace",
 description: "Off the pace. Struggles to keep up.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 {
 tier: "outOfHisDepth",
 short: "Out of His Depth",
 description: "Out of his depth at this level.",
 colorClass: "text-danger-700 dark:text-danger-500",
 },
];

/** Thresholds for each tier (must match the order of the ladders above). */
const TIER_THRESHOLDS: number[] = [85, 75, 65, 55, 45, 30, 0];

/**
 * Normalise a position string to one of the four ladder keys.
 * Handles "Goalkeeper", "GK", "Defender", "DEF", "Central Defender",
 * "Midfielder", "MID", "Forward", "FWD", "Striker", "Winger", etc.
 */
function normalisePosition(position?: string | null): string {
 if (!position) return "DEFAULT";
 const p = position.toLowerCase().trim();
 if (p.includes("gk") || p.includes("goal")) return "Goalkeeper";
 if (p.includes("def") || p.includes("back") || p.includes("centre half")) return "Defender";
 if (p.includes("mid") || p.includes("centre")) return "Midfielder";
 if (p.includes("fwd") || p.includes("forward") || p.includes("str") || p.includes("wing")) return "Forward";
 return "DEFAULT";
}

/**
 * Interpret an OVR value into a Gaffer-voice tier + description.
 *
 * @param ovr - The raw OVR number (0-99).
 * @param position - The player's position (Goalkeeper/Defender/Midfielder/Forward,
 *                   or abbreviations like GK/DEF/MID/FWD).
 * @returns OvrInterpretation with short label, full description, and colour class.
 */
export function interpretOvr(ovr: number, position?: string | null): OvrInterpretation {
 const ladderKey = normalisePosition(position);
 const ladder = POSITION_OVR_LADDERS[ladderKey] ?? DEFAULT_LADDER;
 for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
 if (ovr >= TIER_THRESHOLDS[i]) {
 return ladder[i];
 }
 }
 return ladder[ladder.length - 1];
}

/**
 * Get just the short label — for tight UI like pitch tokens, table cells,
 * sortable headers, etc.
 */
export function shortOvrLabel(ovr: number, position?: string | null): string {
 return interpretOvr(ovr, position).short;
}

/**
 * Scouting visibility gate.
 *
 * Returns "?" when the player's OVR should NOT be shown to the manager:
 * - When it's a rival player AND they haven't been scouted to at least
 *   Surface tier.
 *
 * Own-club players always show their OVR interpretation. Rival players
 * show "?" until scouted.
 *
 * @param ovr - The raw OVR number.
 * @param position - The player's position.
 * @param isOwnClub - Whether the player is on the manager's own club.
 * @param scoutingTier - The reveal tier ("Surface" | "Detailed" | "Complete" | null).
 *                       null = no scouting knowledge at all.
 * @returns The short label to display, or "?" if hidden.
 */
export function scoutingAwareOvrLabel(
 ovr: number,
 position: string | null | undefined,
 isOwnClub: boolean,
 scoutingTier: string | null | undefined,
): string {
 if (isOwnClub) {
 return shortOvrLabel(ovr, position);
 }
 // Rival player — needs at least Surface tier to show OVR band
 if (!scoutingTier || scoutingTier === "None") {
 return "?";
 }
 return shortOvrLabel(ovr, position);
}

/**
 * Scouting visibility gate for the colour class.
 * Returns a muted grey when the OVR is hidden, so the badge looks
 * consistent whether it shows a label or "?".
 */
export function scoutingAwareOvrColorClass(
 ovr: number,
 position: string | null | undefined,
 isOwnClub: boolean,
 scoutingTier: string | null | undefined,
): string {
 if (!isOwnClub && (!scoutingTier || scoutingTier === "None")) {
 return "text-gray-400 dark:text-gray-500";
 }
 return interpretOvr(ovr, position).colorClass;
}
