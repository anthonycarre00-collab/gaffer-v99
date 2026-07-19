import type { JSX } from "react";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TacticsPhaseSettings } from "../../store/types";

/**
 * V100 §9 (Issue #5): Instructions rail.
 *
 * Compact, always-visible "quick instructions" panel that lives in the right
 * rail of the Pitch tab. Surfaces the four most-used tactical levers:
 *   - Tempo (Patient / Direct)
 *   - Width (Narrow / Normal / Wide)
 *   - Pressing intensity (Passive / Medium / Aggressive)
 *   - Defensive line (VeryLow / Low / Medium / High)
 *
 * The full Phase Blueprint (with-ball / without-ball / transitions) remains
 * on the Style tab; this rail is the "tweak in 5 seconds before kickoff"
 * surface that managers actually use match-to-match.
 *
 * Sections are collapsible — clicking the chevron collapses the body so the
 * user can hide instructions they don't care about and free vertical space
 * for the Roles + Set Pieces panel below.
 */

interface QuickInstructionField {
  field: keyof TacticsPhaseSettings;
  labelKey: string;
  options: readonly string[];
}

const QUICK_FIELDS: QuickInstructionField[] = [
  { field: "tempo", labelKey: "tempo", options: ["Patient", "Direct"] },
  { field: "width", labelKey: "width", options: ["Narrow", "Normal", "Wide"] },
  {
    field: "pressing_intensity",
    labelKey: "pressingIntensity",
    options: ["Passive", "Medium", "Aggressive"],
  },
  {
    field: "defensive_line",
    labelKey: "defensiveLine",
    options: ["VeryLow", "Low", "Medium", "High"],
  },
];

interface TacticsInstructionsRailProps {
  tacticsPhase?: TacticsPhaseSettings;
  onTacticsPhaseChange: (patch: Partial<TacticsPhaseSettings>) => void;
}

function QuickButtonRow({
  field,
  labelKey,
  options,
  tacticsPhase,
  onTacticsPhaseChange,
}: QuickInstructionField & {
  tacticsPhase?: TacticsPhaseSettings;
  onTacticsPhaseChange: (patch: Partial<TacticsPhaseSettings>) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const currentValue = (tacticsPhase?.[field] ?? options[0]) as string;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-ink-faint">
        {t(`tactics.phaseSettings.${labelKey}`)}
      </span>
      <div className="flex gap-1">
        {options.map((opt) => {
          const isActive = currentValue === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onTacticsPhaseChange({ [field]: opt })}
              className={`flex-1 rounded border px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all duration-100 ${
                isActive
                  ? "border-accent-400 bg-accent-500/15 text-accent-600 dark:text-accent-300"
                  : "border-slate-line-soft bg-carbon-2 text-ink-dim hover:border-accent-300/60 hover:text-ink"
              }`}
            >
              {t(`tactics.phaseSettings.${labelKey}_${opt}`, opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TacticsInstructionsRail({
  tacticsPhase,
  onTacticsPhaseChange,
}: TacticsInstructionsRailProps): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded border border-slate-line bg-carbon-1">
      <div className="border-b border-slate-line-soft px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1.5 text-[11px] font-heading font-bold uppercase tracking-[0.22em] text-ink-faint hover:text-ink-dim"
        >
          <ChevronDown
            className={`h-3 w-3 transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
          />
          {t("tactics.quickInstructions", { defaultValue: "Quick Instructions" })}
        </button>
      </div>
      {open && (
        <div className="space-y-2.5 p-3">
          {QUICK_FIELDS.map((f) => (
            <QuickButtonRow
              key={f.field}
              {...f}
              tacticsPhase={tacticsPhase}
              onTacticsPhaseChange={onTacticsPhaseChange}
            />
          ))}
          <p className="pt-1 text-[10px] text-ink-faint italic">
            {t("tactics.fullBlueprintOnStyleTab", {
              defaultValue:
                "Full Phase Blueprint available on the Style tab.",
            })}
          </p>
        </div>
      )}
    </div>
  );
}
