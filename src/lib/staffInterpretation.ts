/**
 * Staff Interpretation Layer — Gaffer voice for backroom staff ratings.
 *
 * Per the Gaffer constitution: staff ratings (coaching, judging, physio, etc)
 * should NEVER be shown as raw numbers. Each rating is interpreted into a
 * short tier label ("Top Class", "Proper Coach", "Limited", etc) and a
 * longer Gaffer-voice description.
 *
 * Role-specific: a 70-rated Coach reads differently than a 70-rated Scout,
 * because the same number means different things in different roles.
 *
 * Used by:
 *  - StaffTab.tsx (backroom staff list)
 *  - ScoutingScoutDetailsCard.tsx (scout detail card)
 *  - Anywhere staff attributes are surfaced in the UI.
 */

export type StaffRole = "AssistantManager" | "Coach" | "Scout" | "Physio";

export type StaffAttrKey =
 | "coaching"
 | "judgingAbility"
 | "judgingPotential"
 | "physiotherapy";

export type StaffTier =
 | "topClass"
 | "quality"
 | "solid"
 | "limited"
 | "poor";

export interface StaffAttrInterpretation {
 /** Tier enum — useful for styling. */
 tier: StaffTier;
 /** Short label for tight UI (cards, badges). */
 short: string;
 /** Full Gaffer-voice description — for tooltips / detail cards. */
 description: string;
 /** Tailwind colour class for the tier. */
 colorClass: string;
}

interface StaffAttrSpec {
 /** Translation key prefix — e.g. "staff.attrs.coaching". */
 labelKey: string;
 /** Default English label, used if i18n not yet loaded. */
 defaultLabel: string;
}

export const STAFF_ATTR_SPECS: Record<StaffAttrKey, StaffAttrSpec> = {
 coaching: { labelKey: "staff.attrs.coaching", defaultLabel: "Coaching" },
 judgingAbility: {
 labelKey: "staff.attrs.judgingAbility",
 defaultLabel: "Judging Ability",
 },
 judgingPotential: {
 labelKey: "staff.attrs.judgingPotential",
 defaultLabel: "Judging Potential",
 },
 physiotherapy: {
 labelKey: "staff.attrs.physiotherapy",
 defaultLabel: "Physiotherapy",
 },
};

/**
 * Per-role, per-attribute tiered descriptions.
 *
 * 5 tiers per (role, attr), thresholds:
 *  - 80+ → topClass
 *  - 65+ → quality
 *  - 50+ → solid
 *  - 35+ → limited
 *  - <35 → poor
 *
 * Descriptions are role-specific Gaffer voice — no two roles share the same
 * phrasing for the same attribute, so the backroom feels alive.
 */
const STAFF_LADDERS: Record<StaffRole, Record<StaffAttrKey, StaffAttrInterpretation[]>> = {
 // ───────────────── ASSISTANT MANAGER ─────────────────
 AssistantManager: {
 coaching: [
 {
 tier: "topClass",
 short: "Top Class",
 description:
 "Different class on the training pitch. Players improve just by being around him.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Quality",
 description:
 "Proper coach. Runs sessions that actually translate to Saturday.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Solid",
 description:
 "Does the work. Won't set the world alight, but the drills get done.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Limited. Sessions feel stale — players go through the motions.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Out of his depth on the grass. You'll be doing the coaching yourself.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 judgingAbility: [
 {
 tier: "topClass",
 short: "Reads a Player",
 description:
 "Spots a player a mile off. His opinion on a signing is worth the wage alone.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Sharp Eye",
 description:
 "Proper judge of a player. Rarely leads you up the garden path.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Trustworthy",
 description:
 "Sound judgement. Won't uncover hidden gems but won't miss the obvious.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Hit and miss. Take his word with a pinch of salt.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Wouldn't know a player if he tripped over him. Don't ask.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 judgingPotential: [
 {
 tier: "topClass",
 short: "Eye for Youth",
 description:
 "Sees the player a kid could become. Worth his weight in gold around the academy.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Promising",
 description:
 "Decent judge of potential. Spots the raw materials most miss.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Solid",
 description:
 "Reliable with kids. Won't unearth the next big thing but won't miss obvious talent.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Struggles to project potential. Better with finished articles.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Couldn't spot potential if it kicked him. Youth setup suffers.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 physiotherapy: [
 {
 tier: "topClass",
 short: "Miracle Worker",
 description:
 "Keeps the treatment room empty. Players back weeks ahead of schedule.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Quality",
 description:
 "Proper physio. Knows when to push and when to hold back.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Solid",
 description:
 "Does the job. Standard recovery times, no surprises.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Limited. Players seem to pick up niggles that linger.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Treatment room's always full. You'll be fishing for a replacement.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 },

 // ───────────────── COACH ─────────────────
 Coach: {
 coaching: [
 {
 tier: "topClass",
 short: "Top Class",
 description:
 "Different class. Players actually want to train under him.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Quality",
 description:
 "Proper coach. Sessions are sharp, intense, and translate to matchday.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Solid",
 description:
 "Does the work. Reliable pair of hands on the training ground.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Limited. Drills feel like going through the motions.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Out of his depth. You'll end up taking sessions yourself.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 judgingAbility: [
 {
 tier: "topClass",
 short: "Reads a Player",
 description:
 "Eye for a player. Worth listening to when he flags someone up.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Sharp Eye",
 description:
 "Decent judge. His reports are worth reading.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Trustworthy",
 description:
 "Sound opinion. Not always right, but not often embarrassingly wrong.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Take with a pinch of salt. Better with the players he knows.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Don't ask. Wouldn't recognise a player in his own living room.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 judgingPotential: [
 {
 tier: "topClass",
 short: "Eye for Youth",
 description:
 "Spots the kid who'll make it. Trust him with academy prospects.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Promising",
 description:
 "Good eye for potential. Worth a listen on the youth setup.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Solid",
 description:
 "Reasonable with the kids. Won't unearth hidden gems, but steady.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Better with seniors. Doesn't really see the kids coming through.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Useless with youth. Keep him away from the academy.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 physiotherapy: [
 {
 tier: "topClass",
 short: "Miracle Worker",
 description:
 "Better than most physios. A genuine asset to the medical team.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Quality",
 description:
 "Knows his way around a hamstring. Useful to have around.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Solid",
 description:
 "Can hold a physio's coat. Basic first aid is fine.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Limited medical knowledge. Stick to coaching.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Don't let him near the treatment room.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 },

 // ───────────────── SCOUT ─────────────────
 Scout: {
 coaching: [
 {
 tier: "topClass",
 short: "Top Class",
 description:
 "Could easily be a coach. Useful when training ground is short-handed.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Quality",
 description:
 "Decent on the grass. Can step in if needed.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Solid",
 description:
 "Can take a session if pushed. Not his strong suit.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Limited coach. Better off on the road scouting.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Useless on the training ground. Keep him on the road.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 judgingAbility: [
 {
 tier: "topClass",
 short: "Reads a Player",
 description:
 "Spots them a mile off. His reports are worth the fuel money.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Sharp Eye",
 description:
 "Proper scout. Knows a player when he sees one.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Trustworthy",
 description:
 "Sound reports. Won't waste your time with duffs.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Hit and miss. Take his reports with a pinch of salt.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Waste of a fuel budget. Time to look for a replacement.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 judgingPotential: [
 {
 tier: "topClass",
 short: "Eyes in the Stands",
 description:
 "Sees the player the kid could become. Trust him on the youth circuit.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Sharp",
 description:
 "Decent eye for a youngster. Worth sending to youth tournaments.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Solid",
 description:
 "Reasonable on potential. Won't miss obvious talent.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Better with established players. Struggles with kids.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Useless on the youth circuit. Don't waste him on academy games.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 physiotherapy: [
 {
 tier: "topClass",
 short: "Handy",
 description:
 "Knows his way around a player. Useful on scouting trips.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Decent",
 description:
 "Basic medical knowledge. Could spot a crock from the stands.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Solid",
 description:
 "Can tell a hamstring from a groin. About it.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Not his area. Don't ask him to flag medicals.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Useless. Stick to judging players.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 },

 // ───────────────── PHYSIO ─────────────────
 Physio: {
 coaching: [
 {
 tier: "topClass",
 short: "Handy",
 description:
 "Could turn his hand to coaching. Useful when short-handed.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Decent",
 description:
 "Can take a fitness session. Not a proper coach, but close.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Solid",
 description:
 "Sound on fitness work. Leave the technical stuff to the coaches.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Limited. Stick to the treatment room.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Useless on the grass. Keep him in the medical room.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 judgingAbility: [
 {
 tier: "topClass",
 short: "Reads a Body",
 description:
 "Can tell a player's condition from how he walks in. Genuinely useful.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Sharp",
 description:
 "Decent judge of fitness. Worth listening to on availability.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Solid",
 description:
 "Sound on fitness calls. Won't lead you astray on injuries.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Limited. Better with the bodywork than the judgement.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Don't ask him to judge a player. Stick to the treatments.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 judgingPotential: [
 {
 tier: "topClass",
 short: "Eyes for Youth",
 description:
 "Knows which kids' bodies will handle the step up. Genuinely insightful.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Decent",
 description:
 "Can flag growth concerns in academy players. Useful.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Solid",
 description:
 "Reasonable on youth fitness. Standard medical input.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Limited view on potential. Better with current injuries.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Don't ask. Not his area at all.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 physiotherapy: [
 {
 tier: "topClass",
 short: "Miracle Worker",
 description:
 "Different class. Treatment room's always empty — players back weeks early.",
 colorClass: "text-primary-600 dark:text-primary-400",
 },
 {
 tier: "quality",
 short: "Quality",
 description:
 "Proper physio. Knows when to push and when to hold back.",
 colorClass: "text-primary-500 dark:text-primary-300",
 },
 {
 tier: "solid",
 short: "Solid",
 description:
 "Does the job. Standard recovery times, no nasty surprises.",
 colorClass: "text-accent-600 dark:text-accent-400",
 },
 {
 tier: "limited",
 short: "Limited",
 description:
 "Limited. Players seem to pick up niggles that hang around.",
 colorClass: "text-gray-500 dark:text-gray-400",
 },
 {
 tier: "poor",
 short: "Poor",
 description:
 "Treatment room's a constant traffic jam. Time to find a replacement.",
 colorClass: "text-danger-600 dark:text-danger-400",
 },
 ],
 },
};

const TIER_THRESHOLDS: { threshold: number; tier: StaffTier }[] = [
 { threshold: 80, tier: "topClass" },
 { threshold: 65, tier: "quality" },
 { threshold: 50, tier: "solid" },
 { threshold: 35, tier: "limited" },
 { threshold: 0, tier: "poor" },
];

function tierForValue(value: number): StaffTier {
 for (const { threshold, tier } of TIER_THRESHOLDS) {
 if (value >= threshold) return tier;
 }
 return "poor";
}

/**
 * Interpret a staff attribute for a given role.
 *
 * Falls back to a generic ladder if the role is unknown.
 */
export function interpretStaffAttr(
 attr: StaffAttrKey,
 value: number,
 role?: string | null,
): StaffAttrInterpretation {
 const safeRole = (role as StaffRole) ?? "Coach";
 const ladder = STAFF_LADDERS[safeRole] ?? STAFF_LADDERS.Coach;
 const tier = tierForValue(value);
 const entries = ladder[attr] ?? ladder.coaching;
 return entries.find((e) => e.tier === tier) ?? entries[0];
}

/**
 * Aggregate staff OVR interpretation — uses the player OVR ladder but with
 * a "staff" twist in the description (passed via tooltip).
 */
export function staffOvrLabel(ovr: number): string {
 if (ovr >= 80) return "Top Class";
 if (ovr >= 65) return "Quality";
 if (ovr >= 50) return "Solid";
 if (ovr >= 35) return "Limited";
 return "Poor";
}

export function staffOvrDescription(ovr: number, role?: string | null): string {
 const roleLabel = roleLabelForRole(role);
 const label = staffOvrLabel(ovr);
 const quality: Record<StaffTier, string> = {
 topClass: `Different class. ${roleLabel} worth his wage and then some.`,
 quality: `Proper ${roleLabel.toLowerCase()}. Does the job well.`,
 solid: `Solid ${roleLabel.toLowerCase()}. Reliable, if unspectacular.`,
 limited: `Limited ${roleLabel.toLowerCase()}. You could do better.`,
 poor: `Poor. Time to look for a replacement ${roleLabel.toLowerCase()}.`,
 };
 const tier = tierForValue(ovr);
 return quality[tier].replace(label, label);
}

export function roleLabelForRole(role?: string | null): string {
 switch (role) {
 case "AssistantManager":
 return "Assistant Manager";
 case "Coach":
 return "Coach";
 case "Scout":
 return "Scout";
 case "Physio":
 return "Physio";
 default:
 return "Staff";
 }
}
