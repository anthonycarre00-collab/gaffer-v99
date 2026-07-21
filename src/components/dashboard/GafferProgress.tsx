import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * V100 FIX (forensic): Gaffer-voice progress indicator for the continue/
 * advance screen. Replaces the static "Crunching the numbers..." text with
 * rotating funny Gaffer-voice lines + an animated progress bar.
 *
 * The user said: "the continue screen only shows 'done' and needs a progress
 * bar or progress timer" and "ensure the progress bar uses gaffer voice or
 * the player will get bored so make it funny or something good."
 *
 * The lines rotate every 2.5 seconds. They're grouped by "phase" so early
 * messages match the start of advancing, later messages match the end.
 * No backend changes needed — this is pure UI flavour.
 */

/** Gaffer-voice rotating messages. Grouped by phase. */
const GAFFER_LINES = {
  early: [
    "Right lads, let's see what the football gods have got for us today...",
    "Crunching the numbers... not the physio's biscuits.",
    "The world's turning — matches kicking off from here to Timbuktu.",
    "Checking the tealeaves... looks like a 4-4-2 sort of day.",
    "Processing the fixtures... someone's got to do it.",
    "The lads are out there warming up. Or they should be.",
    "Pitch is looking green. Results coming in soon enough.",
    "Tactics board's dusted off. Let's see if anyone read it.",
  ],
  mid: [
    "Still crunching... the gaffer's not known for his patience.",
    "Half the league's playing right now. Mental.",
    "Checking results from the other pitches... no peeking at yours yet.",
    "The footballing world doesn't stop for anyone, not even the gaffer.",
    "Patience, boss. Rome wasn't built in a matchday.",
    "Stats are being crunched. Not as crunchy as the physio's biscuits, mind.",
    "The results are coming. Like a slow centre-half, but they're coming.",
    "Still processing... the chairman's already asking about the table.",
  ],
  late: [
    "Nearly there... the gaffer's pacing the touchline by now.",
    "Final whistle's approaching on the sims. Hang tight.",
    "Just ironing out the last results. The football gods are particular.",
    "Almost done. The table's about to look different.",
    "One more batch of results... and we're off.",
    "The last matches are wrapping up. Check the shoelaces, boss.",
    "Final crunch incoming. The gaffer's got his coat on.",
    "Sorted... almost. The footballing world is a complex place.",
  ],
};

/** Pick a deterministic-ish line for a given phase + tick. */
function pickLine(phase: keyof typeof GAFFER_LINES, tick: number): string {
  const pool = GAFFER_LINES[phase];
  return pool[tick % pool.length] ?? pool[0];
}

interface GafferProgressProps {
  /** Optional message override — if set, shows this instead of rotating lines. */
  message?: string;
  /** Estimated progress 0.0–1.0. If unknown, the bar animates indeterminately. */
  progress?: number;
  /** Whether the sim is actively running. */
  isRunning: boolean;
}

/**
 * Animated progress bar + rotating Gaffer-voice messages.
 * Cycles through ~24 different lines across 3 phases.
 */
export default function GafferProgress({
  message,
  progress,
  isRunning,
}: GafferProgressProps): JSX.Element {
  const { t } = useTranslation();
  const [tick, setTick] = useState(0);

  // Rotate the message every 2.5 seconds while running.
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 2500);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Pick phase based on progress (or tick if progress unknown).
  const phase: keyof typeof GAFFER_LINES = useMemo(() => {
    if (progress != null) {
      if (progress < 0.33) return "early";
      if (progress < 0.66) return "mid";
      return "late";
    }
    // No progress info — cycle through all phases.
    const cycle = tick % 6;
    if (cycle < 2) return "early";
    if (cycle < 4) return "mid";
    return "late";
  }, [progress, tick]);

  const line = message ?? pickLine(phase, tick);
  const pct = progress != null ? Math.round(progress * 100) : null;

  return (
    <div className="flex flex-col items-center text-center w-full">
      {/* Progress bar */}
      <div className="w-full max-w-xs h-2 bg-carbon-3 rounded-full overflow-hidden">
        {progress != null ? (
          <div
            className="h-full bg-accent-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
          />
        ) : (
          // Indeterminate bar — slides back and forth.
          <div className="h-full w-1/3 bg-accent-500 rounded-full animate-pulse" style={{
            animation: "gaffer-progress-slide 1.5s ease-in-out infinite",
          }} />
        )}
      </div>

      {/* Percentage (if known) */}
      {pct != null && (
        <p className="mt-2 text-[10px] font-heading font-bold uppercase tracking-widest text-accent-500">
          {pct}%
        </p>
      )}

      {/* Rotating Gaffer-voice message */}
      <p
        key={tick}
        className="mt-3 text-sm text-ink-dim italic max-w-sm tab-enter"
        style={{ minHeight: "2.5rem" }}
      >
        "{line}"
      </p>

      {/* "Gaffer says:" label */}
      <p className="mt-1 text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-ink-faint">
        — {t("dashboard.gafferMuttering", { defaultValue: "The Gaffer" })}
      </p>
    </div>
  );
}
