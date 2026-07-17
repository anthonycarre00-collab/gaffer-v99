import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import type { TacticsPhaseSettings } from "../../store/types";
import {
 Activity,
 ArrowUpRight,
 CheckCircle2,
 CircleAlert,
} from "lucide-react";

/**
 * StyleGuidancePanel — Gaffer-voice guidance for the selected playing style.
 *
 * Renders in the left column of the "Style" sub-tab. Shows:
 *  - What the style asks of the players (in plain English)
 *  - Which phase-blueprint settings are aligned with the style (✓)
 *  - Which phase-blueprint settings are mismatched (⚠)
 *
 * Helps the manager understand how their phase blueprint settings either
 * complement or fight against the chosen playing style.
 */

interface StyleGuidancePanelProps {
 formation: string;
 playStyle: string;
 tacticsPhase?: TacticsPhaseSettings;
}

interface StyleGuidance {
 /** What this style demands of the side. */
 demands: string[];
 /** Phase-blueprint fields and the values that align with this style. */
 aligned: Partial<Record<keyof TacticsPhaseSettings, string[]>>;
}

const STYLE_GUIDANCE: Record<string, StyleGuidance> = {
 Balanced: {
 demands: [
 "Sensible football — mix of patience and directness depending on the moment",
 "Players need to be able to do both sides of the game",
 "Best for sides without a clear tactical edge",
 ],
 aligned: {
 build_up_style: ["Mixed"],
 tempo: ["Patient", "Direct"],
 width: ["Normal"],
 pressing_intensity: ["Medium"],
 },
 },
 Attacking: {
 demands: [
 "Numbers forward — full-backs high, midfielders joining the attack",
 "Take risks in the final third",
 "Defenders need to be comfortable on the front foot",
 ],
 aligned: {
 build_up_style: ["Short", "Mixed"],
 width: ["Wide"],
 tempo: ["Direct"],
 defensive_line: ["High"],
 pressing_intensity: ["Aggressive"],
 break_speed: ["Fast"],
 },
 },
 Defensive: {
 demands: [
 "Banks of four, low block, keep shape",
 "Limit space behind the back line",
 "Pick moments to break — don't over-commit",
 ],
 aligned: {
 build_up_style: ["Long", "Mixed"],
 width: ["Narrow"],
 tempo: ["Direct"],
 defensive_line: ["VeryLow", "Low"],
 pressing_intensity: ["Passive"],
 defensive_shape: ["Compact"],
 },
 },
 Possession: {
 demands: [
 "Patient build-up — never force it forward",
 "Players comfortable receiving under pressure",
 "Width comes from full-backs and wingers stretching the pitch",
 ],
 aligned: {
 build_up_style: ["Short"],
 width: ["Wide"],
 tempo: ["Patient"],
 pressing_intensity: ["Medium"],
 defensive_shape: ["Normal"],
 },
 },
 Counter: {
 demands: [
 "Defend deep in numbers, then break in three passes",
 "Forwards need pace to spring the trap",
 "Midfielders must be disciplined to hold shape",
 ],
 aligned: {
 build_up_style: ["Mixed", "Long"],
 tempo: ["Direct"],
 defensive_line: ["Low", "Medium"],
 pressing_intensity: ["Passive", "Medium"],
 break_speed: ["Fast"],
 counter_press_duration: ["None", "Short"],
 },
 },
 HighPress: {
 demands: [
 "In their faces from the off — win it high, win it quick",
 "Whole team needs serious legs — press fails, you're exposed",
 "Best against sides who struggle to play through pressure",
 ],
 aligned: {
 build_up_style: ["Short", "Mixed"],
 width: ["Wide"],
 defensive_line: ["High"],
 pressing_intensity: ["Aggressive"],
 defensive_shape: ["Compact"],
 counter_press_duration: ["Long"],
 },
 },
};

function resolveGuidance(playStyle: string): StyleGuidance {
 return STYLE_GUIDANCE[playStyle] ?? STYLE_GUIDANCE.Balanced;
}

export function StyleGuidancePanel({
 formation,
 playStyle,
 tacticsPhase,
}: StyleGuidancePanelProps): JSX.Element {
 const { t } = useTranslation();
 const guidance = resolveGuidance(playStyle);

 /** Check whether a phase field value aligns with the style. */
 function checkAlignment(
 field: keyof TacticsPhaseSettings,
 ): "aligned" | "mismatch" | "neutral" {
 const alignedValues = guidance.aligned[field];
 if (!alignedValues) return "neutral";
 const currentValue = (tacticsPhase?.[field] ?? "") as string;
 if (!currentValue) return "neutral";
 return alignedValues.includes(currentValue) ? "aligned" : "mismatch";
 }

 const alignedFields = (Object.keys(guidance.aligned) as (keyof TacticsPhaseSettings)[]).filter(
 (f) => checkAlignment(f) === "aligned",
 );
 const mismatchedFields = (Object.keys(guidance.aligned) as (keyof TacticsPhaseSettings)[]).filter(
 (f) => checkAlignment(f) === "mismatch",
 );

 return (
 <div className="rounded-lg border border-slate-line bg-white bg-carbon-1 overflow-hidden">
 {/* Header */}
 <div className="px-4 py-3 border-b border-slate-line-soft bg-carbon-2/60 bg-carbon-0/30">
 <div className="flex items-center gap-2">
 <Activity className="w-4 h-4 text-primary-500 dark:text-primary-400" />
 <h3 className="font-heading font-bold uppercase tracking-wide text-sm text-ink">
 {t("tactics.styleGuidance", { defaultValue: "Style Guidance" })}
 </h3>
 </div>
 <p className="mt-1 text-xs text-ink-dim">
 {t("tactics.styleGuidanceHint", {
 defaultValue:
 "What this style asks of the side, and how your phase blueprint aligns.",
 })}
 </p>
 </div>

 {/* Demands */}
 <div className="p-4">
 <h4 className="text-[10px] font-heading font-bold uppercase tracking-[0.22em] text-primary-500 dark:text-primary-400 mb-2">
 {t("tactics.styleDemands", { defaultValue: "What It Asks" })}
 </h4>
 <ul className="space-y-1.5">
 {guidance.demands.map((demand, idx) => (
 <li
 key={idx}
 className="flex items-start gap-2 text-xs text-ink-dim"
 >
 <ArrowUpRight className="w-3 h-3 mt-0.5 shrink-0 text-ink-faint" />
 <span>{demand}</span>
 </li>
 ))}
 </ul>
 </div>

 {/* Alignment summary */}
 <div className="px-4 pb-4">
 <h4 className="text-[10px] font-heading font-bold uppercase tracking-[0.22em] text-primary-500 dark:text-primary-400 mb-2">
 {t("tactics.blueprintAlignment", { defaultValue: "Blueprint Alignment" })}
 </h4>
 {alignedFields.length === 0 && mismatchedFields.length === 0 ? (
 <p className="text-xs text-ink-faint italic">
 {t("tactics.noAlignmentData", {
 defaultValue: "No phase-blueprint fields to check against this style.",
 })}
 </p>
 ) : (
 <div className="space-y-1">
 {alignedFields.map((field) => (
 <div
 key={`a-${field}`}
 className="flex items-center gap-2 text-xs text-ink-dim"
 >
 <CheckCircle2 className="w-3.5 h-3.5 text-primary-500 dark:text-primary-400" />
 <span>
 {t(`tactics.phaseSettings.${field}`, field)} —{" "}
 <span className="font-medium">
 {(tacticsPhase?.[field] ?? "") as string}
 </span>
 </span>
 </div>
 ))}
 {mismatchedFields.map((field) => (
 <div
 key={`m-${field}`}
 className="flex items-center gap-2 text-xs text-ink-dim"
 >
 <CircleAlert className="w-3.5 h-3.5 text-accent-500 dark:text-accent-400" />
 <span>
 {t(`tactics.phaseSettings.${field}`, field)} —{" "}
 <span className="font-medium">
 {(tacticsPhase?.[field] ?? "") as string}
 </span>
 </span>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Formation reminder */}
 <div className="px-4 py-3 border-t border-slate-line-soft bg-carbon-2/40 bg-carbon-0/20">
 <p className="text-[10px] text-ink-dim">
 {t("tactics.currentFormation", { defaultValue: "Current formation" })}:{" "}
 <span className="font-heading font-bold text-ink">
 {formation}
 </span>
 </p>
 </div>
 </div>
 );
}
