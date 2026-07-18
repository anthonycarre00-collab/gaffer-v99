import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui";
import { X, ChevronRight, ArrowLeft, Loader2, ChevronDown } from "lucide-react";
import type { CareerStartPhase } from "./CreateManagerForm";

// ---------------------------------------------------------------------------
// Shared types — imported by MainMenu and PackageBuildStep
// ---------------------------------------------------------------------------

export interface WorldDatabaseInfo {
 id: string;
 name: string;
 description: string;
 team_count: number;
 player_count: number;
 history_mode?: "generated" | "reference" | "hybrid";
 base_year?: number | null;
 snapshot_date?: string | null;
 source: string;
 path: string;
}

export interface PackageIssue {
 code: string;
 file: string;
 params: Record<string, string>;
}

export interface StackConflictInfo {
 severity: "warning" | "error";
 code: string;
 entityKind: string;
 entityId: string;
 packages: string[];
}

export interface PackageInfo {
 id: string;
 name: string;
 version: string;
 author: string;
 description: string;
 license: string;
 gameMinVersion: string;
 packageType: string;
 teamCount: number;
 playerCount: number;
 competitionCount: number;
 installedPath: string;
 logoDataUrl?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// V99.7: Reduced from [0, 6, 12, 24] to [0, 1, 3, 6] — 12+ seasons was
// too slow on new game creation. 3 seasons gives enough seed history.
const HISTORY_DEPTH_OPTIONS = [0, 1, 3, 6] as const;

function historyDepthOptionLabel(
 t: (key: string, options?: Record<string, unknown>) => string,
 value: (typeof HISTORY_DEPTH_OPTIONS)[number],
): string {
 if (value === 0) return t("worldSelect.historyDepth.none");
 return t("worldSelect.historyDepth.option", { count: value });
}

// ---------------------------------------------------------------------------
// Step indicator (shared with PackageBuildStep)
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: 2 | 3 }) {
 const active = "flex items-center justify-center w-6 h-6 rounded-full bg-primary-500 text-ink text-xs font-bold";
 const done = "flex items-center justify-center w-6 h-6 rounded-full bg-primary-500/30 text-primary-400 text-xs font-bold";
 const future = "flex items-center justify-center w-6 h-6 rounded-full bg-carbon-3 text-ink-faint text-xs font-bold";
 const filledLine = "h-0.5 flex-1 bg-primary-500";
 const emptyLine = "h-0.5 flex-1 bg-carbon-3";

 return (
 <div className="flex items-center gap-2 mb-1">
 <div className={done}>1</div>
 <div className={filledLine} />
 <div className={current === 2 ? active : done}>2</div>
 <div className={current === 3 ? filledLine : emptyLine} />
 <div className={current === 3 ? active : future}>3</div>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GenerationStepProps {
 isStarting: boolean;
 startYear: number;
 startPhase: CareerStartPhase;
 historyDepthYears: number;
 onChangeHistoryDepthYears: (value: number) => void;
 onStart: () => void;
 onBack: () => void;
 onClose: () => void;
 /** Pre-filtered active packages from MainMenu state. */
 activePackages: PackageInfo[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GenerationStep({
 isStarting,
 startYear,
 startPhase,
 historyDepthYears,
 onChangeHistoryDepthYears,
 onStart,
 onBack,
 onClose,
 activePackages: _activePackages,
}: GenerationStepProps) {
 const { t } = useTranslation();
 const historyDepthLabelId = useId();
 const [showAdvanced, setShowAdvanced] = useState(false);

 // V99.5: activePackages is always [] now (packages flow removed).
 // hasActiveDatabases is always false → history depth is always shown.
 // We keep the prop for API compatibility but ignore its value.
 const hasActiveDatabases = false;

 return (
 <div className="flex flex-col gap-4">
 {/* Header */}
 <div className="flex justify-between items-center mb-2">
 <div className="flex items-center gap-2">
 <button
 onClick={onBack}
 className="text-ink-faint hover:text-ink transition-colors p-1 rounded hover:bg-carbon-2 hover:bg-carbon-3"
 >
 <ArrowLeft className="w-5 h-5" />
 </button>
 <h2 className="text-xl font-heading font-bold uppercase tracking-wide text-ink">
 {t("generation.title")}
 </h2>
 </div>
 <button
 type="button"
 onClick={onClose}
 className="text-ink-faint hover:text-ink transition-colors p-1 rounded hover:bg-carbon-2 hover:bg-carbon-3"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <StepIndicator current={2} />

 {/* Summary card */}
 <div className="rounded border border-slate-line bg-carbon-2 p-3 text-sm text-ink-dim border-slate-line bg-carbon-2/60 text-ink">
 <div className="flex flex-wrap items-center gap-2">
 <span className="font-heading font-bold uppercase tracking-[0.18em] text-ink-dim">
 {t("worldSelect.summary.startYear")}
 </span>
 <span className="font-heading font-bold uppercase tracking-wide text-ink">
 {startYear}
 </span>
 <span className="rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
 {hasActiveDatabases
 ? t("worldSelect.historyMode.reference")
 : t("worldSelect.historyMode.generated")}
 </span>
 </div>
 <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-dim">
 {hasActiveDatabases
 ? t(`worldSelect.summary.${startPhase}.reference`, { year: startYear, count: historyDepthYears })
 : t(`worldSelect.summary.${startPhase}.generated`, { year: startYear, count: historyDepthYears })}
 </p>
 </div>

 {/* Advanced options — history depth (collapsible) */}
 <div className="rounded border border-slate-line">
 <button
 type="button"
 onClick={() => setShowAdvanced(!showAdvanced)}
 className="flex w-full items-center justify-between p-3 text-left text-xs font-heading font-bold uppercase tracking-wider text-ink-faint transition-colors hover:text-ink-faint hover:text-ink"
 >
 {t("createManager.advancedOptions")}
 <ChevronDown
 className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
 />
 </button>
 {showAdvanced && (
 <div className="border-t border-slate-line p-3 border-slate-line">
 <div className="flex items-start justify-between gap-3">
 <div>
 <p
 id={historyDepthLabelId}
 className="font-heading font-bold uppercase tracking-[0.18em] text-ink-dim"
 >
 {t("worldSelect.historyDepth.label")}
 </p>
 <p className="mt-1 text-xs text-ink-dim">
 {t("worldSelect.historyDepth.hint")}
 </p>
 </div>
 <span className="rounded-full bg-accent-500/10 px-2 py-0.5 text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-accent-600 dark:text-accent-300 flex-shrink-0">
 {t("worldSelect.historyDepth.applied", { count: historyDepthYears })}
 </span>
 </div>

 <div
 role="radiogroup"
 aria-labelledby={historyDepthLabelId}
 className="mt-3 grid grid-cols-2 gap-2"
 >
 {HISTORY_DEPTH_OPTIONS.map((value) => {
 const selected = historyDepthYears === value;
 return (
 <button
 key={value}
 type="button"
 role="radio"
 aria-checked={selected}
 onClick={() => onChangeHistoryDepthYears(value)}
 className={`rounded border px-3 py-3 text-left transition-all ${
 selected
 ? "border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-400/30 dark:border-primary-500 dark:bg-primary-500/10 dark:text-primary-300"
 : "border-slate-line bg-carbon-2 text-ink hover:border-slate-line bg-carbon-1 text-ink dark:hover:border-navy-500"
 }`}
 >
 <span className="block font-heading font-bold uppercase tracking-wide">
 {historyDepthOptionLabel(t, value)}
 </span>
 {value === 3 && (
 <span className="block text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-300 mt-0.5">
 {t("worldSelect.historyDepth.recommended")}
 </span>
 )}
 </button>
 );
 })}
 </div>
 </div>
 )}
 </div>

 <Button
 variant="primary"
 size="lg"
 className="w-full"
 iconRight={isStarting ? <Loader2 className="animate-spin" /> : <ChevronRight />}
 onClick={onStart}
 disabled={isStarting}
 >
 {isStarting ? t("worldSelect.creatingWorld") : t("worldSelect.startCareer")}
 </Button>
 </div>
 );
}
