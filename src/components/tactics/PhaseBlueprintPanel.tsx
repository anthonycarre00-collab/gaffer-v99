import type { JSX } from "react";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TacticsPhaseSettings } from "../../store/types";
import { Select } from "../ui";

const WITH_BALL_FIELDS = [
 ["build_up_style", "buildUpStyle", ["Short", "Mixed", "Long"]] as const,
 ["width", "width", ["Narrow", "Normal", "Wide"]] as const,
 ["tempo", "tempo", ["Patient", "Direct"]] as const,
];

const WITHOUT_BALL_FIELDS = [
 ["defensive_line", "defensiveLine", ["VeryLow", "Low", "Medium", "High"]] as const,
 ["pressing_intensity", "pressingIntensity", ["Passive", "Medium", "Aggressive"]] as const,
 ["defensive_shape", "defensiveShape", ["Stretched", "Normal", "Compact"]] as const,
 ["marking_style", "markingStyle", ["Zonal", "Mixed", "ManToMan"]] as const,
];

const TRANSITION_FIELDS = [
 ["counter_press_duration", "counterPressDuration", ["None", "Short", "Long"]] as const,
 ["break_speed", "breakSpeed", ["Slow", "Medium", "Fast"]] as const,
];

const SECTIONS = [
 ["withBall", WITH_BALL_FIELDS] as const,
 ["withoutBall", WITHOUT_BALL_FIELDS] as const,
 ["transitions", TRANSITION_FIELDS] as const,
];

function PhaseButtonGroup({
 field,
 labelKey,
 onTacticsPhaseChange,
 options,
 tacticsPhase,
}: {
 field: keyof TacticsPhaseSettings;
 labelKey: string;
 onTacticsPhaseChange: (patch: Partial<TacticsPhaseSettings>) => void;
 options: readonly string[];
 tacticsPhase?: TacticsPhaseSettings;
}): JSX.Element {
 const { t } = useTranslation();
 const currentValue = (tacticsPhase?.[field] ?? options[0]) as string;
 return (
 <div className="flex items-center gap-2">
 <span className="w-20 shrink-0 text-[11px] text-ink-dim">
 {t(`tactics.phaseSettings.${labelKey}`)}
 </span>
 <Select
 selectSize="sm"
 variant="subtle"
 fullWidth
 value={currentValue}
 onChange={(e) => {
 onTacticsPhaseChange({ [field]: e.target.value });
 }}
 >
 {options.map((opt) => (
 <option key={opt} value={opt}>
 {t(`tactics.phaseSettings.${labelKey}_${opt}`, opt)}
 </option>
 ))}
 </Select>
 </div>
 );
}

/**
 * Collapsible section header — clicking the chevron toggles the body.
 * V100 §9 (Issue #5): All Phase Blueprint sections are now collapsible so
 * managers can hide instructions they don't tweak often (e.g. transitions)
 * and free vertical space for the ones they do.
 */
function CollapsibleSection({
 labelKey,
 children,
 defaultOpen = true,
}: {
 labelKey: string;
 children: JSX.Element | JSX.Element[];
 defaultOpen?: boolean;
}): JSX.Element {
 const { t } = useTranslation();
 const [open, setOpen] = useState(defaultOpen);
 return (
 <div className="border-b border-slate-line-soft last:border-b-0">
 <button
 type="button"
 onClick={() => setOpen((o) => !o)}
 aria-expanded={open}
 className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[11px] font-heading font-bold uppercase tracking-[0.2em] text-primary-500 dark:text-primary-400 hover:bg-accent-500/5"
 >
 <ChevronDown
 className={`h-3 w-3 transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
 />
 {t(`tactics.phaseLabels.${labelKey}`)}
 </button>
 {open && <div className="space-y-2 p-3 pt-0">{children}</div>}
 </div>
 );
}

/**
 * The Phase Blueprint editor (with-ball / without-ball / transitions tactical
 * settings). Shared by the Tactics board's right panel and the pre-match screen
 * so both edit the same `team.tactics_phase`. Renders the section body only —
 * the caller provides the surrounding card/header.
 *
 * V100 §9: All three sections are now collapsible. "With ball" and "Without
 * ball" default to open; "Transitions" defaults to collapsed since it's the
 * least-tweaked section.
 */
export function PhaseBlueprintPanel({
 tacticsPhase,
 onTacticsPhaseChange,
}: {
 tacticsPhase?: TacticsPhaseSettings;
 onTacticsPhaseChange: (patch: Partial<TacticsPhaseSettings>) => void;
}): JSX.Element {
 return (
 <div className="divide-y divide-slate-line-soft dark:divide-slate-line-soft">
 {SECTIONS.map(([labelKey, fields], idx) => (
 <CollapsibleSection
 key={labelKey}
 labelKey={labelKey}
 defaultOpen={idx < 2}
 >
 {fields.map(([field, fieldLabelKey, options]) => (
 <PhaseButtonGroup
 key={field}
 field={field}
 labelKey={fieldLabelKey}
 onTacticsPhaseChange={onTacticsPhaseChange}
 options={options}
 tacticsPhase={tacticsPhase}
 />
 ))}
 </CollapsibleSection>
 ))}
 </div>
 );
}
