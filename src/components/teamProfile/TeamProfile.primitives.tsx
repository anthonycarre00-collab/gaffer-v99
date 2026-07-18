import type { ReactNode } from "react";

export function QuickStat({
 label,
 value,
 color,
}: {
 label: string;
 value: string;
 color: string;
}) {
 return (
 <div className="bg-carbon-1 p-3 text-center">
 <p className="text-xs text-ink-faint font-heading uppercase tracking-wider">
 {label}
 </p>
 <p className={`font-heading font-bold text-lg mt-0.5 ${color}`}>
 {value}
 </p>
 </div>
 );
}

export function InfoRow({
 icon,
 label,
 value,
}: {
 icon: ReactNode;
 label: string;
 value: string;
}) {
 return (
 <div className="flex items-center gap-3 py-2 border-b border-slate-line-soft last:border-0">
 <div className="text-ink-faint">{icon}</div>
 <span className="text-sm text-ink-dim flex-1">
 {label}
 </span>
 <span className="text-sm font-semibold text-ink">
 {value}
 </span>
 </div>
 );
}

export function StatBox({
 label,
 value,
 highlight,
}: {
 label: string;
 value: number;
 highlight?: boolean;
}) {
 return (
 <div
 className={`p-2.5 rounded ${highlight ? "bg-primary-50 dark:bg-primary-500/10" : "bg-carbon-2"}`}
 >
 <p
 className={`font-heading font-bold text-lg tabular-nums ${highlight ? "text-primary-600 dark:text-primary-400" : "text-ink"}`}
 >
 {value}
 </p>
 <p className="text-xs text-ink-faint font-heading uppercase tracking-wider">
 {label}
 </p>
 </div>
 );
}
