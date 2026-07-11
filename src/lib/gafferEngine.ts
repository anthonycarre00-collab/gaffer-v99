/**
 * Gaffer Engine — Master Interpretation Layer
 *
 * This is the SINGLE source of truth for converting raw numeric values into
 * Gaffer-voice language across the entire UI. No raw number should ever
 * reach a React component without passing through this engine first
 * (except for genuine stats like goals, appearances, age).
 *
 * Design principles:
 * 1. Huge variety — every value maps to multiple tiered descriptions so the
 *    UI never feels repetitive. A 72-OVR striker reads differently than a
 *    72-OVR goalkeeper; a 45-morale winger reads differently than a
 *    45-morale centre-back.
 * 2. Position-aware — the same numeric value means different things for
 *    different positions. A 70 passing for a CB is "decent"; for an AM
 *    it's "limited".
 * 3. Context-relevant — morale, condition, form, etc. each have their own
 *    Gaffer-voice vocabulary that matches what a real manager would say.
 * 4. No raw numbers — unless it's a genuine counting stat (goals, caps,
 *    appearances, age, fee amounts), values are rendered as tier labels
 *    with full descriptions available on hover/title.
 *
 * This module re-exports the existing specialised interpretation layers
 * (ovrInterpretation, attributeInterpretation, staffInterpretation) and
 * adds the missing ones: morale, condition, form, potential, reputation,
 * age, contract status, match rating, and finance tiers.
 */

// Re-export the existing layers so components have a single import point.
export {
  interpretOvr,
  shortOvrLabel,
  scoutingAwareOvrLabel,
  scoutingAwareOvrColorClass,
  type OvrInterpretation,
} from "./ovrInterpretation";

export {
  interpretAttributeForPosition,
  ATTRIBUTE_SPECS,
  type AttributeKey,
  type AttrTier,
  type AttrSpec,
} from "./attributeInterpretation";

export {
  interpretStaffAttr,
  staffOvrLabel,
  staffOvrDescription,
  roleLabelForRole,
  STAFF_ATTR_SPECS,
  type StaffRole,
  type StaffAttrKey,
  type StaffAttrInterpretation,
} from "./staffInterpretation";

// ---------------------------------------------------------------------------
// MORALE interpretation
// ---------------------------------------------------------------------------

export type MoraleTier =
  | "flying"
  | "buzzing"
  | "content"
  | "flat"
  | "frustrated"
  | "fuming";

export interface MoraleInterpretation {
  tier: MoraleTier;
  short: string;
  description: string;
  colorClass: string;
}

const MORALE_LADDER: MoraleInterpretation[] = [
  {
    tier: "flying",
    short: "Flying",
    description: "On top of the world. Confidence is sky-high — he thinks he's invincible right now.",
    colorClass: "text-primary-600 dark:text-primary-400",
  },
  {
    tier: "buzzing",
    short: "Buzzing",
    description: "Proper up for it. Everything's going his way and he knows it.",
    colorClass: "text-primary-500 dark:text-primary-300",
  },
  {
    tier: "content",
    short: "Content",
    description: "Steady enough. No complaints, no fireworks. Doing his job.",
    colorClass: "text-accent-600 dark:text-accent-400",
  },
  {
    tier: "flat",
    short: "Flat",
    description: "A bit flat. Needs something to spark him back into it.",
    colorClass: "text-gray-600 dark:text-gray-400",
  },
  {
    tier: "frustrated",
    short: "Frustrated",
    description: "Frustrated. Things aren't going his way and it's showing.",
    colorClass: "text-accent-700 dark:text-accent-500",
  },
  {
    tier: "fuming",
    short: "Fuming",
    description: "Fuming. Body language is terrible — needs sorting before it spreads.",
    colorClass: "text-danger-600 dark:text-danger-400",
  },
];

const MORALE_THRESHOLDS: { threshold: number; tier: MoraleTier }[] = [
  { threshold: 85, tier: "flying" },
  { threshold: 70, tier: "buzzing" },
  { threshold: 55, tier: "content" },
  { threshold: 40, tier: "flat" },
  { threshold: 25, tier: "frustrated" },
  { threshold: 0, tier: "fuming" },
];

export function interpretMorale(morale: number): MoraleInterpretation {
  const tier = MORALE_THRESHOLDS.find((t) => morale >= t.threshold)?.tier ?? "fuming";
  return MORALE_LADDER.find((m) => m.tier === tier) ?? MORALE_LADDER[2];
}

// ---------------------------------------------------------------------------
// CONDITION interpretation
// ---------------------------------------------------------------------------

export type ConditionTier =
  | "fresh"
  | "sharp"
  | "tiring"
  | "heavy"
  | "shattered"
  | "dead";

export interface ConditionInterpretation {
  tier: ConditionTier;
  short: string;
  description: string;
  colorClass: string;
}

const CONDITION_LADDER: ConditionInterpretation[] = [
  {
    tier: "fresh",
    short: "Fresh",
    description: "Raring to go. Full tank, legs are fresh — could run all day.",
    colorClass: "text-primary-600 dark:text-primary-400",
  },
  {
    tier: "sharp",
    short: "Sharp",
    description: "Match-fit and ready. No fitness concerns here.",
    colorClass: "text-primary-500 dark:text-primary-300",
  },
  {
    tier: "tiring",
    short: "Tiring",
    description: "Starting to feel it. Won't last the full 90 at this rate.",
    colorClass: "text-accent-600 dark:text-accent-400",
  },
  {
    tier: "heavy",
    short: "Heavy-legged",
    description: "Heavy-legged. The fixtures are catching up with him.",
    colorClass: "text-accent-700 dark:text-accent-500",
  },
  {
    tier: "shattered",
    short: "Shattered",
    description: "Absolutely shattered. Needs a rest or he'll break down.",
    colorClass: "text-danger-600 dark:text-danger-400",
  },
  {
    tier: "dead",
    short: "On his last legs",
    description: "On his last legs. Don't start him unless you have to.",
    colorClass: "text-danger-700 dark:text-danger-500",
  },
];

const CONDITION_THRESHOLDS: { threshold: number; tier: ConditionTier }[] = [
  { threshold: 90, tier: "fresh" },
  { threshold: 75, tier: "sharp" },
  { threshold: 55, tier: "tiring" },
  { threshold: 35, tier: "heavy" },
  { threshold: 20, tier: "shattered" },
  { threshold: 0, tier: "dead" },
];

export function interpretCondition(condition: number): ConditionInterpretation {
  const tier = CONDITION_THRESHOLDS.find((t) => condition >= t.threshold)?.tier ?? "dead";
  return CONDITION_LADDER.find((c) => c.tier === tier) ?? CONDITION_LADDER[2];
}

// ---------------------------------------------------------------------------
// FORM interpretation
// ---------------------------------------------------------------------------

export type FormTier =
  | "unplayable"
  | "hot"
  | "good"
  | "steady"
  | "quiet"
  | "poor"
  | "dreadful";

export interface FormInterpretation {
  tier: FormTier;
  short: string;
  description: string;
  colorClass: string;
}

const FORM_LADDER: FormInterpretation[] = [
  {
    tier: "unplayable",
    short: "Unplayable",
    description: "Unplayable right now. Everything he touches turns to gold.",
    colorClass: "text-primary-600 dark:text-primary-400",
  },
  {
    tier: "hot",
    short: "Red-hot",
    description: "Red-hot form. You can't leave him out — he's the difference.",
    colorClass: "text-primary-500 dark:text-primary-300",
  },
  {
    tier: "good",
    short: "In good nick",
    description: "In good nick. Carrying it well from week to week.",
    colorClass: "text-accent-600 dark:text-accent-400",
  },
  {
    tier: "steady",
    short: "Steady",
    description: "Steady eddie. Doing the basics right, nothing spectacular.",
    colorClass: "text-gray-600 dark:text-gray-400",
  },
  {
    tier: "quiet",
    short: "Quiet",
    description: "Gone a bit quiet. Not influencing games like he can.",
    colorClass: "text-gray-500 dark:text-gray-500",
  },
  {
    tier: "poor",
    short: "Off the pace",
    description: "Off the pace. Needs a goal or a moment to get going again.",
    colorClass: "text-accent-700 dark:text-accent-500",
  },
  {
    tier: "dreadful",
    short: "Dreadful",
    description: "Dreadful run of form. Confidence is shot — might need dropping.",
    colorClass: "text-danger-600 dark:text-danger-400",
  },
];

const FORM_THRESHOLDS: { threshold: number; tier: FormTier }[] = [
  { threshold: 8.5, tier: "unplayable" },
  { threshold: 7.5, tier: "hot" },
  { threshold: 6.8, tier: "good" },
  { threshold: 6.0, tier: "steady" },
  { threshold: 5.0, tier: "quiet" },
  { threshold: 4.0, tier: "poor" },
  { threshold: 0, tier: "dreadful" },
];

export function interpretForm(form: number): FormInterpretation {
  const tier = FORM_THRESHOLDS.find((t) => form >= t.threshold)?.tier ?? "dreadful";
  return FORM_LADDER.find((f) => f.tier === tier) ?? FORM_LADDER[3];
}

// ---------------------------------------------------------------------------
// POTENTIAL interpretation
// ---------------------------------------------------------------------------

export type PotentialTier =
  | "once_generation"
  | "world_class"
  | "elite"
  | "quality"
  | "decent"
  | "limited";

export interface PotentialInterpretation {
  tier: PotentialTier;
  short: string;
  description: string;
  colorClass: string;
}

const POTENTIAL_LADDER: PotentialInterpretation[] = [
  {
    tier: "once_generation",
    short: "Once-in-a-generation",
    description: "Once-in-a-generation ceiling. Could become one of the all-time greats.",
    colorClass: "text-primary-600 dark:text-primary-400",
  },
  {
    tier: "world_class",
    short: "World-class ceiling",
    description: "World-class potential. Could play for any side on the planet.",
    colorClass: "text-primary-500 dark:text-primary-300",
  },
  {
    tier: "elite",
    short: "Elite potential",
    description: "Elite potential. Top-division starter at his peak.",
    colorClass: "text-accent-600 dark:text-accent-400",
  },
  {
    tier: "quality",
    short: "Quality prospect",
    description: "Quality prospect. Solid pro with a good career ahead.",
    colorClass: "text-accent-700 dark:text-accent-500",
  },
  {
    tier: "decent",
    short: "Decent ceiling",
    description: "Decent ceiling. Will do a job, won't set the world alight.",
    colorClass: "text-gray-600 dark:text-gray-400",
  },
  {
    tier: "limited",
    short: "Limited",
    description: "Limited upside. What you see is close to what you'll get.",
    colorClass: "text-gray-500 dark:text-gray-500",
  },
];

const POTENTIAL_THRESHOLDS: { threshold: number; tier: PotentialTier }[] = [
  { threshold: 90, tier: "once_generation" },
  { threshold: 80, tier: "world_class" },
  { threshold: 70, tier: "elite" },
  { threshold: 60, tier: "quality" },
  { threshold: 50, tier: "decent" },
  { threshold: 0, tier: "limited" },
];

export function interpretPotential(potential: number): PotentialInterpretation {
  const tier = POTENTIAL_THRESHOLDS.find((t) => potential >= t.threshold)?.tier ?? "limited";
  return POTENTIAL_LADDER.find((p) => p.tier === tier) ?? POTENTIAL_LADDER[4];
}

/**
 * Interpret the gap between current OVR and potential — "how much room
 * to grow" a young player has. Used in youth academy + scouting.
 */
export function interpretGrowthRoom(ovr: number, potential: number): {
  short: string;
  description: string;
  colorClass: string;
} {
  const gap = potential - ovr;
  if (gap >= 25) {
    return {
      short: "Massive upside",
      description: "Massive room to grow. Could improve by 25+ rating points with the right development.",
      colorClass: "text-primary-600 dark:text-primary-400",
    };
  }
  if (gap >= 15) {
    return {
      short: "Big upside",
      description: "Plenty of room to grow. 15+ points of improvement possible.",
      colorClass: "text-primary-500 dark:text-primary-300",
    };
  }
  if (gap >= 8) {
    return {
      short: "Room to grow",
      description: "Still some development left in him. 8+ points of growth possible.",
      colorClass: "text-accent-600 dark:text-accent-400",
    };
  }
  if (gap >= 3) {
    return {
      short: "Near peak",
      description: "Close to his ceiling. A few points of refinement left.",
      colorClass: "text-gray-600 dark:text-gray-400",
    };
  }
  return {
    short: "At his peak",
    description: "At or near his peak. What you see is what you get.",
    colorClass: "text-gray-500 dark:text-gray-500",
  };
}

// ---------------------------------------------------------------------------
// REPUTATION interpretation (for teams, 0-1000 scale)
// ---------------------------------------------------------------------------

export type ReputationTier =
  | "elite"
  | "continental"
  | "established"
  | "mid_tier"
  | "lower"
  | "minnows";

export interface ReputationInterpretation {
  tier: ReputationTier;
  short: string;
  description: string;
  colorClass: string;
}

const REPUTATION_LADDER: ReputationInterpretation[] = [
  {
    tier: "elite",
    short: "Elite",
    description: "Elite club. One of the biggest in the world — Champions League regulars.",
    colorClass: "text-primary-600 dark:text-primary-400",
  },
  {
    tier: "continental",
    short: "Continational",
    description: "Continental force. Respected across Europe, challenges for honours.",
    colorClass: "text-primary-500 dark:text-primary-300",
  },
  {
    tier: "established",
    short: "Established",
    description: "Established top-flight side. Comfortable at this level.",
    colorClass: "text-accent-600 dark:text-accent-400",
  },
  {
    tier: "mid_tier",
    short: "Mid-table",
    description: "Mid-table outfit. Solid enough, nothing spectacular.",
    colorClass: "text-gray-600 dark:text-gray-400",
  },
  {
    tier: "lower",
    short: "Lower league",
    description: "Lower-league side. Scraping by, dreaming of better days.",
    colorClass: "text-gray-500 dark:text-gray-500",
  },
  {
    tier: "minnows",
    short: "Minnows",
    description: "Minnows. Just happy to be here.",
    colorClass: "text-gray-400 dark:text-gray-600",
  },
];

const REPUTATION_THRESHOLDS: { threshold: number; tier: ReputationTier }[] = [
  { threshold: 800, tier: "elite" },
  { threshold: 650, tier: "continental" },
  { threshold: 500, tier: "established" },
  { threshold: 350, tier: "mid_tier" },
  { threshold: 200, tier: "lower" },
  { threshold: 0, tier: "minnows" },
];

export function interpretReputation(reputation: number): ReputationInterpretation {
  const tier = REPUTATION_THRESHOLDS.find((t) => reputation >= t.threshold)?.tier ?? "minnows";
  return REPUTATION_LADDER.find((r) => r.tier === tier) ?? REPUTATION_LADDER[3];
}

// ---------------------------------------------------------------------------
// AGE interpretation (context-aware: different for different positions)
// ---------------------------------------------------------------------------

export interface AgeInterpretation {
  short: string;
  description: string;
  colorClass: string;
}

/**
 * Interpret a player's age in footballing terms.
 * Position-aware: goalkeepers peak later, wingers earlier.
 */
export function interpretAge(age: number, position?: string): AgeInterpretation {
  const isGk = position === "Goalkeeper" || position === "GK";
  const isDefender = position?.includes("Back") || position === "CenterBack" || position === "Defender";
  const isWinger = position?.includes("Winger") || position?.includes("Wing");

  // Adjust thresholds by position.
  const youthThreshold = 21;
  const developingThreshold = 24;
  const primeStart = isGk ? 27 : isDefender ? 25 : 24;
  const primeEnd = isGk ? 33 : isDefender ? 31 : isWinger ? 29 : 30;
  const veteranStart = isGk ? 36 : 33;

  if (age <= youthThreshold) {
    return {
      short: "Youngster",
      description: "Youngster. Still learning the trade — raw but full of potential.",
      colorClass: "text-primary-600 dark:text-primary-400",
    };
  }
  if (age <= developingThreshold) {
    return {
      short: "Developing",
      description: "Developing. Best years are still ahead of him.",
      colorClass: "text-primary-500 dark:text-primary-300",
    };
  }
  if (age < primeStart) {
    return {
      short: "Entering prime",
      description: "Entering his prime years. Starting to deliver consistently.",
      colorClass: "text-accent-600 dark:text-accent-400",
    };
  }
  if (age <= primeEnd) {
    return {
      short: "Prime",
      description: "In his prime. This is the player at his absolute best.",
      colorClass: "text-primary-600 dark:text-primary-400",
    };
  }
  if (age <= veteranStart) {
    return {
      short: "Veteran",
      description: "Veteran campaigner. Knows every trick in the book.",
      colorClass: "text-accent-700 dark:text-accent-500",
    };
  }
  if (age <= 38) {
    return {
      short: "Swansong",
      description: "Swansong years. Making the most of every minute he gets.",
      colorClass: "text-gray-600 dark:text-gray-400",
    };
  }
  return {
    short: "Remarkable",
    description: "Remarkable to still be going. Father Time is knocking loudly.",
    colorClass: "text-gray-500 dark:text-gray-500",
  };
}

// ---------------------------------------------------------------------------
// MATCH RATING interpretation (0-10 scale)
// ---------------------------------------------------------------------------

export interface MatchRatingInterpretation {
  short: string;
  description: string;
  colorClass: string;
}

export function interpretMatchRating(rating: number): MatchRatingInterpretation {
  if (rating >= 9.0) {
    return {
      short: "Different class",
      description: "Different class. Man of the match performance — unplayable.",
      colorClass: "text-primary-600 dark:text-primary-400",
    };
  }
  if (rating >= 8.0) {
    return {
      short: "Excellent",
      description: "Excellent. One of his best performances of the season.",
      colorClass: "text-primary-500 dark:text-primary-300",
    };
  }
  if (rating >= 7.0) {
    return {
      short: "Strong",
      description: "Strong performance. Did everything asked of him and more.",
      colorClass: "text-accent-600 dark:text-accent-400",
    };
  }
  if (rating >= 6.0) {
    return {
      short: "Solid",
      description: "Solid enough. Did his job, nothing more, nothing less.",
      colorClass: "text-gray-600 dark:text-gray-400",
    };
  }
  if (rating >= 5.0) {
    return {
      short: "Anonymous",
      description: "Anonymous. Drifted through the game without influencing it.",
      colorClass: "text-accent-700 dark:text-accent-500",
    };
  }
  if (rating >= 4.0) {
    return {
      short: "Poor",
      description: "Poor. Off the pace, gave the ball away, needs to do better.",
      colorClass: "text-danger-600 dark:text-danger-400",
    };
  }
  return {
    short: "Dreadful",
    description: "Dreadful. Cost the team today — won't want to see this one back.",
    colorClass: "text-danger-700 dark:text-danger-500",
  };
}

// ---------------------------------------------------------------------------
// CONTRACT status interpretation
// ---------------------------------------------------------------------------

export interface ContractInterpretation {
  short: string;
  description: string;
  colorClass: string;
}

export function interpretContractStatus(daysRemaining: number): ContractInterpretation {
  if (daysRemaining < 0) {
    return {
      short: "Expired",
      description: "Contract has expired. Free agent.",
      colorClass: "text-danger-700 dark:text-danger-500",
    };
  }
  if (daysRemaining <= 30) {
    return {
      short: "Expiring",
      description: "Contract expires this month. Urgent — sort it now or lose him for nothing.",
      colorClass: "text-danger-600 dark:text-danger-400",
    };
  }
  if (daysRemaining <= 90) {
    return {
      short: "Running down",
      description: "Contract running down. Months, not years, left on the deal.",
      colorClass: "text-accent-700 dark:text-accent-500",
    };
  }
  if (daysRemaining <= 180) {
    return {
      short: "Six months",
      description: "Less than six months left. Time to start talks.",
      colorClass: "text-accent-600 dark:text-accent-400",
    };
  }
  if (daysRemaining <= 365) {
    return {
      short: "Final year",
      description: "Into the final year. Get it sorted before it becomes a distraction.",
      colorClass: "text-gray-600 dark:text-gray-400",
    };
  }
  if (daysRemaining <= 730) {
    return {
      short: "Two years",
      description: "Two years left. Comfortable — no rush, but keep an eye on it.",
      colorClass: "text-primary-500 dark:text-primary-300",
    };
  }
  return {
    short: "Long-term",
    description: "Long-term deal. Sorted for the foreseeable.",
    colorClass: "text-primary-600 dark:text-primary-400",
  };
}

// ---------------------------------------------------------------------------
// FINANCE interpretation (transfer fee + wage tiers)
// ---------------------------------------------------------------------------

export interface FeeInterpretation {
  short: string;
  description: string;
  colorClass: string;
}

export function interpretTransferFee(fee: number): FeeInterpretation {
  if (fee >= 100_000_000) {
    return {
      short: "Marquee money",
      description: "Marquee money. Statement signing — the kind that sells shirts.",
      colorClass: "text-primary-600 dark:text-primary-400",
    };
  }
  if (fee >= 50_000_000) {
    return {
      short: "Big money",
      description: "Big-money move. Expectation will be enormous from day one.",
      colorClass: "text-primary-500 dark:text-primary-300",
    };
  }
  if (fee >= 20_000_000) {
    return {
      short: "Significant fee",
      description: "Significant fee. He's expected to start pretty much every week.",
      colorClass: "text-accent-600 dark:text-accent-400",
    };
  }
  if (fee >= 10_000_000) {
    return {
      short: "Decent outlay",
      description: "Decent outlay. Squad starter money.",
      colorClass: "text-accent-700 dark:text-accent-500",
    };
  }
  if (fee >= 2_000_000) {
    return {
      short: "Modest fee",
      description: "Modest fee. One for the squad, maybe one for the future.",
      colorClass: "text-gray-600 dark:text-gray-400",
    };
  }
  if (fee > 0) {
    return {
      short: "Loose change",
      description: "Loose change really. Worth a punt.",
      colorClass: "text-gray-500 dark:text-gray-500",
    };
  }
  return {
    short: "Free transfer",
    description: "Free transfer. No fee — just wages to sort.",
    colorClass: "text-primary-500 dark:text-primary-300",
  };
}

export function interpretWage(wage: number): FeeInterpretation {
  // wage is annual
  if (wage >= 10_000_000) {
    return {
      short: "Elite earner",
      description: "Elite earner. Top-bracket money — superstar wages.",
      colorClass: "text-primary-600 dark:text-primary-400",
    };
  }
  if (wage >= 5_000_000) {
    return {
      short: "Top earner",
      description: "Top earner at the club. Paid like a star.",
      colorClass: "text-primary-500 dark:text-primary-300",
    };
  }
  if (wage >= 2_000_000) {
    return {
      short: "Well paid",
      description: "Well paid. Comfortable Premier League starter money.",
      colorClass: "text-accent-600 dark:text-accent-400",
    };
  }
  if (wage >= 1_000_000) {
    return {
      short: "Decent money",
      description: "Decent money. Squad-player wages.",
      colorClass: "text-accent-700 dark:text-accent-500",
    };
  }
  if (wage >= 500_000) {
    return {
      short: "Modest",
      description: "Modest wages. Lower-tier starter money.",
      colorClass: "text-gray-600 dark:text-gray-400",
    };
  }
  return {
    short: "Spare change",
    description: "Spare change really. Youth-contract money.",
    colorClass: "text-gray-500 dark:text-gray-500",
  };
}

// ---------------------------------------------------------------------------
// STABILITY interpretation (0-100 scale)
// ---------------------------------------------------------------------------

export interface StabilityInterpretation {
  short: string;
  description: string;
  colorClass: string;
}

export function interpretStability(stability: number): StabilityInterpretation {
  if (stability >= 80) {
    return {
      short: "Ice cold",
      description: "Ice cold under pressure. The bigger the moment, the better he performs.",
      colorClass: "text-primary-600 dark:text-primary-400",
    };
  }
  if (stability >= 65) {
    return {
      short: "Reliable",
      description: "Reliable when it matters. Doesn't go missing in big games.",
      colorClass: "text-primary-500 dark:text-primary-300",
    };
  }
  if (stability >= 50) {
    return {
      short: "Steady",
      description: "Steady enough. Will turn up most weeks.",
      colorClass: "text-accent-600 dark:text-accent-400",
    };
  }
  if (stability >= 35) {
    return {
      short: "Flaky",
      description: "A bit flaky. Goes missing when the heat is on.",
      colorClass: "text-accent-700 dark:text-accent-500",
    };
  }
  return {
    short: "Liability",
    description: "Liability under pressure. Don't trust him with the big moments.",
    colorClass: "text-danger-600 dark:text-danger-400",
  };
}

// ---------------------------------------------------------------------------
// INJURY duration interpretation
// ---------------------------------------------------------------------------

export interface InjuryInterpretation {
  short: string;
  description: string;
  colorClass: string;
}

export function interpretInjuryDuration(daysOut: number): InjuryInterpretation {
  if (daysOut <= 0) {
    return {
      short: "Fit",
      description: "Fit and available.",
      colorClass: "text-primary-600 dark:text-primary-400",
    };
  }
  if (daysOut <= 7) {
    return {
      short: "Minor knock",
      description: "Minor knock. Back within a week.",
      colorClass: "text-accent-600 dark:text-accent-400",
    };
  }
  if (daysOut <= 21) {
    return {
      short: "Couple of weeks",
      description: "Couple of weeks out. Back after the next couple of fixtures.",
      colorClass: "text-accent-700 dark:text-accent-500",
    };
  }
  if (daysOut <= 60) {
    return {
      short: "Longer term",
      description: "Longer-term injury. Out for a month or two.",
      colorClass: "text-danger-600 dark:text-danger-400",
    };
  }
  if (daysOut <= 180) {
    return {
      short: "Season over?",
      description: "Long-term layoff. Could be the rest of the season.",
      colorClass: "text-danger-700 dark:text-danger-500",
    };
  }
  return {
    short: "Serious",
    description: "Serious injury. Long road back ahead.",
    colorClass: "text-danger-700 dark:text-danger-500",
  };
}

// ---------------------------------------------------------------------------
// Convenience: format money amounts (the ONE place raw numbers ARE shown)
// ---------------------------------------------------------------------------

export function formatFee(fee: number): string {
  if (fee >= 100_000_000) {
    return `£${(fee / 100_000_000).toFixed(1)}B`;
  }
  if (fee >= 1_000_000) {
    return `£${(fee / 1_000_000).toFixed(1)}M`;
  }
  if (fee >= 1_000) {
    return `£${(fee / 1_000).toFixed(0)}k`;
  }
  return `£${fee}`;
}

export function formatWage(wage: number): string {
  // wage is annual; display as weekly
  const weekly = wage / 52;
  if (weekly >= 1_000_000) {
    return `£${(weekly / 1_000_000).toFixed(1)}M/wk`;
  }
  if (weekly >= 1_000) {
    return `£${(weekly / 1_000).toFixed(0)}k/wk`;
  }
  return `£${weekly.toFixed(0)}/wk`;
}
