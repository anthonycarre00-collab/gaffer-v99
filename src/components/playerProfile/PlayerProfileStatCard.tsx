import type { ReactNode } from "react";

/**
 * Shared shell for the equal-height stat cards used across the player
 * profile (attribute groups, advanced stats): bordered card with a
 * header row holding a label on the left and an optional value slot on
 * the right, above arbitrary body content.
 */
export default function PlayerProfileStatCard({
 label,
 labelClassName = "text-ink-dim",
 headerRight,
 children,
}: {
 label: string;
 labelClassName?: string;
 headerRight?: ReactNode;
 children: ReactNode;
}) {
 return (
 <div className="flex flex-col rounded border border-slate-line-soft bg-carbon-2/60 bg-carbon-1/40 p-4">
 <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-slate-line-soft">
 <h4
 className={`font-heading font-bold text-xs uppercase tracking-wider ${labelClassName}`}
 >
 {label}
 </h4>
 {headerRight}
 </div>
 {children}
 </div>
 );
}
