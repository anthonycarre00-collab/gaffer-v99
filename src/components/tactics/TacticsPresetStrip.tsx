import type { JSX } from "react";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  TACTICS_PRESETS,
  type TacticsPresetDefinition,
} from "./TacticsTab.helpers";

/**
 * V100 §9 (Issue #5): Formation preset strip.
 *
 * Horizontal scrollable strip of preset formations (4-4-2 Balanced Control,
 * 4-3-3 Wing Play, 3-4-3 High Press, 4-2-3-1 Counter, 5-3-2 Low Block) plus
 * every pure formation in FORMATIONS. Each chip shows a tiny formation
 * diagram (defense/mid/forward lines drawn as dots) plus the preset name.
 *
 * Clicking a chip selects that preset (which sets formation + play_style in
 * one shot). The currently active preset/formation is highlighted with a
 * brass ring so the user can see at a glance what they're running.
 *
 * This lives ABOVE the tactics command bar on the Pitch tab so the user can
 * quickly flip between preset tactical shapes without diving into the
 * dropdown.
 */
interface TacticsPresetStripProps {
  activeFormation: string;
  activePlayStyle: string;
  activePresetId: string | null;
  onSelectPreset: (preset: TacticsPresetDefinition) => void;
  onSelectFormation: (formation: string) => void;
}

/**
 * Build a minimal representation of a formation as rows of dots.
 * "4-4-2" → [[1,1,1,1],[1,1,1,1],[1,1]] (GK implied, omitted).
 * Used to draw a tiny pitch diagram on each chip.
 */
function formationToRows(formation: string): number[][] {
  const parts = formation
    .split("-")
    .map(Number)
    .filter((value) => !Number.isNaN(value));
  if (parts.length === 0) return [[1]];
  return parts.map((count) => Array(count).fill(1));
}

function MiniFormation({ formation }: { formation: string }): JSX.Element {
  const rows = formationToRows(formation);
  return (
    <div className="flex flex-col-reverse gap-[3px] items-center justify-center h-9 w-12">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-[3px]">
          {row.map((_, j) => (
            <span
              key={j}
              className="block h-1.5 w-1.5 rounded-full bg-accent-500/80 dark:bg-accent-400/80"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function TacticsPresetStrip({
  activeFormation,
  activePlayStyle,
  activePresetId,
  onSelectPreset,
  onSelectFormation,
}: TacticsPresetStripProps): JSX.Element {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Unique formations not already covered by a preset — surfaced as
  // formation-only chips at the end of the strip so the user can still pick
  // 4-1-4-1 / 4-5-1 / 3-5-2 directly without a matching preset.
  const presetFormations = new Set(TACTICS_PRESETS.map((p) => p.formation));
  const extraFormations = ["4-4-2", "4-3-3", "3-5-2", "4-5-1", "4-2-3-1", "3-4-3", "5-3-2", "4-1-4-1"]
    .filter((f) => !presetFormations.has(f));

  function scrollBy(direction: -1 | 1): void {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * 220, behavior: "smooth" });
  }

  return (
    <div className="relative flex items-center gap-1 rounded border border-slate-line bg-carbon-1 px-2 py-1.5">
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label={t("tactics.scrollLeft", { defaultValue: "Scroll left" })}
        className="shrink-0 rounded p-1 text-ink-faint hover:bg-accent-500/10 hover:text-accent-500"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        ref={scrollRef}
        className="flex flex-1 items-stretch gap-1.5 overflow-x-auto scroll-smooth"
        style={{ scrollbarWidth: "thin" }}
      >
        {TACTICS_PRESETS.map((preset) => {
          const isActive =
            activePresetId === preset.id ||
            (activeFormation === preset.formation &&
              activePlayStyle === preset.playStyle);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset)}
              className={`group flex shrink-0 flex-col items-center gap-0.5 rounded border px-2 py-1 transition-all duration-150 ${
                isActive
                  ? "border-accent-400 bg-accent-500/15 ring-1 ring-accent-400/40"
                  : "border-slate-line-soft bg-carbon-2 hover:border-accent-300/60 hover:bg-accent-500/5"
              }`}
              title={t(preset.descriptionKey, preset.id)}
            >
              <MiniFormation formation={preset.formation} />
              <span
                className={`text-[10px] font-heading font-bold uppercase tracking-wider ${
                  isActive ? "text-accent-600 dark:text-accent-300" : "text-ink-dim"
                }`}
              >
                {preset.formation}
              </span>
              <span className="text-[9px] text-ink-faint">
                {t(`common.playStyles.${preset.playStyle}`, preset.playStyle)}
              </span>
            </button>
          );
        })}

        {/* Divider between preset chips and formation-only chips */}
        {extraFormations.length > 0 && (
          <div className="mx-1 my-1 w-px shrink-0 self-stretch bg-slate-line-soft" />
        )}

        {extraFormations.map((formation) => {
          const isActive = activeFormation === formation;
          return (
            <button
              key={formation}
              type="button"
              onClick={() => onSelectFormation(formation)}
              className={`group flex shrink-0 flex-col items-center gap-0.5 rounded border px-2 py-1 transition-all duration-150 ${
                isActive
                  ? "border-accent-400 bg-accent-500/15 ring-1 ring-accent-400/40"
                  : "border-slate-line-soft bg-carbon-2 hover:border-accent-300/60 hover:bg-accent-500/5"
              }`}
              title={t("tactics.formationOnly", { defaultValue: "Formation: {{f}}", f: formation })}
            >
              <MiniFormation formation={formation} />
              <span
                className={`text-[10px] font-heading font-bold uppercase tracking-wider ${
                  isActive ? "text-accent-600 dark:text-accent-300" : "text-ink-dim"
                }`}
              >
                {formation}
              </span>
              <span className="text-[9px] text-ink-faint">
                {t("tactics.formation", { defaultValue: "Formation" })}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label={t("tactics.scrollRight", { defaultValue: "Scroll right" })}
        className="shrink-0 rounded p-1 text-ink-faint hover:bg-accent-500/10 hover:text-accent-500"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
