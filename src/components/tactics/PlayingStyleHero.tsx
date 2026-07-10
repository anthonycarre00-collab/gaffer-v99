import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import {
 Target,
 Zap,
 Shield,
 RefreshCw,
 Crosshair,
 Flag,
} from "lucide-react";

/**
 * PlayingStyleHero — prominent banner at the top of the Tactics screen that
 * shows the current formation, playing style, and a Gaffer-voice description
 * of what that style means.
 *
 * Replaces the previous layout that had the playing style buried in a small
 * dropdown. Now it's the first thing the manager sees.
 */

interface PlayingStyleHeroProps {
 formation: string;
 playStyle: string;
 /** Optional: name of the active tactic (preset or custom). */
 tacticName?: string;
}

interface PlayStyleDescriptor {
 id: string;
 icon: JSX.Element;
 shortLabel: string;
 /** Gaffer-voice description of the style. */
 description: string;
 /** Tailwind classes for the badge accent. */
 accentClass: string;
 /** Background gradient classes. */
 bgClass: string;
}

const PLAY_STYLE_DESCRIPTORS: Record<string, PlayStyleDescriptor> = {
 Balanced: {
 id: "Balanced",
 icon: <Target className="w-5 h-5" />,
 shortLabel: "Balanced",
 description:
 "Neither floodgates nor shutters. Pick your moments — solid shape one minute, breaking forward the next. Sensible football for sides that don't have a clear edge.",
 accentClass: "text-primary-600 dark:text-primary-300",
 bgClass: "from-primary-500/15 via-primary-500/5 to-transparent",
 },
 Attacking: {
 id: "Attacking",
 icon: <Zap className="w-5 h-5" />,
 shortLabel: "Attacking",
 description:
 "Get at them. Numbers forward, full-backs high, take the game to the opposition. Entertaining — but you'd better score more than you concede.",
 accentClass: "text-accent-600 dark:text-accent-300",
 bgClass: "from-accent-500/15 via-accent-500/5 to-transparent",
 },
 Defensive: {
 id: "Defensive",
 icon: <Shield className="w-5 h-5" />,
 shortLabel: "Defensive",
 description:
 "Shut up shop. Banks of four, low block, ride it out. Boring as paint — but it keeps you in the league when the squad's not good enough.",
 accentClass: "text-gray-700 dark:text-gray-200",
 bgClass: "from-gray-600/15 via-gray-600/5 to-transparent",
 },
 Possession: {
 id: "Possession",
 icon: <RefreshCw className="w-5 h-5" />,
 shortLabel: "Possession",
 description:
 "Keep the ball. Make them chase. Patient build-up, plenty of sideways — eventually the gap opens. Style points for the purists, but you need the players to play it.",
 accentClass: "text-primary-600 dark:text-primary-300",
 bgClass: "from-primary-500/15 via-primary-500/5 to-transparent",
 },
 Counter: {
 id: "Counter",
 icon: <Crosshair className="w-5 h-5" />,
 shortLabel: "Counter",
 description:
 "Soak it, then spring. Defend deep in numbers, break in three passes. Predatory football — pick your moment, then ruthlessly take it.",
 accentClass: "text-danger-600 dark:text-danger-300",
 bgClass: "from-danger-500/15 via-danger-500/5 to-transparent",
 },
 HighPress: {
 id: "HighPress",
 icon: <Flag className="w-5 h-5" />,
 shortLabel: "High Press",
 description:
 "In their faces from the off. Win it high, win it quick, win it back if you lose it. Demands serious legs — if the press fails, you're wide open at the back.",
 accentClass: "text-accent-600 dark:text-accent-300",
 bgClass: "from-accent-500/15 via-accent-500/5 to-transparent",
 },
};

function resolveDescriptor(playStyle: string): PlayStyleDescriptor {
 return (
 PLAY_STYLE_DESCRIPTORS[playStyle] ?? PLAY_STYLE_DESCRIPTORS.Balanced
 );
}

export function PlayingStyleHero({
 formation,
 playStyle,
 tacticName,
}: PlayingStyleHeroProps): JSX.Element {
 const { t } = useTranslation();
 const descriptor = resolveDescriptor(playStyle);

 return (
 <div
 className={`relative overflow-hidden rounded-lg border border-gray-200 dark:border-navy-600 bg-gradient-to-r ${descriptor.bgClass} bg-white dark:bg-navy-800`}
 >
 {/* Subtle texture overlay */}
 <div
 className="absolute inset-0 opacity-[0.04] pointer-events-none"
 style={{
 backgroundImage:
 "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 1px, transparent 8px)",
 }}
 aria-hidden="true"
 />

 <div className="relative p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
 {/* Formation badge — large, prominent */}
 <div className="flex items-center gap-3 shrink-0">
 <div
 className={`flex flex-col items-center justify-center w-16 h-16 rounded-lg border-2 border-current ${descriptor.accentClass} bg-white dark:bg-navy-900`}
 >
 <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
 {t("tactics.formation", "Formation")}
 </span>
 <span className="text-xl font-heading font-extrabold tracking-tight text-gray-900 dark:text-white">
 {formation}
 </span>
 </div>
 </div>

 {/* Playing style + description */}
 <div className="flex-1 min-w-0">
 <div className="flex items-baseline gap-2 flex-wrap">
 <span
 className={`flex items-center gap-1.5 text-xs font-heading font-bold uppercase tracking-[0.22em] ${descriptor.accentClass}`}
 >
 {descriptor.icon}
 {t("tactics.playStyle", "Playing Style")}
 </span>
 <span className="text-lg font-heading font-extrabold uppercase tracking-wide text-gray-900 dark:text-white">
 {t(`common.playStyles.${playStyle}`, playStyle)}
 </span>
 {tacticName ? (
 <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
 — {tacticName}
 </span>
 ) : null}
 </div>
 <p className="mt-1.5 text-sm leading-snug text-gray-700 dark:text-gray-200 max-w-2xl">
 {descriptor.description}
 </p>
 </div>

 {/* Quick metrics — shows what this style favours */}
 <div className="flex sm:flex-col gap-2 sm:gap-1 shrink-0 sm:text-right">
 <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
 {t("tactics.styleSignature", "Style Signature")}
 </span>
 <div className="flex gap-1.5 sm:justify-end">
 {descriptor.id === "Balanced" && (
 <Pill label="Mix" />
 )}
 {descriptor.id === "Attacking" && (
 <>
 <Pill label="Forward" />
 <Pill label="Risk" />
 </>
 )}
 {descriptor.id === "Defensive" && (
 <>
 <Pill label="Shape" />
 <Pill label="Low" />
 </>
 )}
 {descriptor.id === "Possession" && (
 <>
 <Pill label="Calm" />
 <Pill label="Patient" />
 </>
 )}
 {descriptor.id === "Counter" && (
 <>
 <Pill label="Soak" />
 <Pill label="Spring" />
 </>
 )}
 {descriptor.id === "HighPress" && (
 <>
 <Pill label="High" />
 <Pill label="Aggro" />
 </>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}

function Pill({ label }: { label: string }): JSX.Element {
 return (
 <span className="inline-flex items-center text-[10px] font-heading font-bold uppercase tracking-wider rounded bg-gray-100 dark:bg-navy-700 px-1.5 py-0.5 text-gray-600 dark:text-gray-300">
 {label}
 </span>
 );
}
