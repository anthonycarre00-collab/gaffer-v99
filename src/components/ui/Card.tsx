import type { ReactNode } from "react";

interface CardProps {
 children: ReactNode;
 className?: string;
 accent?: "primary" | "accent" | "success" | "danger" | "none";
 /** V99.11: Opt out of the default card texture. */
 plain?: boolean;
}

export function Card({ children, className = "", accent = "none", plain = false }: CardProps) {
 const accentBorder = {
 primary: "border-t-2 border-t-primary-500",
 accent: "border-t-2 border-t-accent-500",
 success: "border-t-2 border-t-success-500",
 danger: "border-t-2 border-t-danger-500",
 none: "",
 }[accent];

 // V99.11 A6: Use .gaffer-surface as single source of truth for card
 // surfaces. The texture is opt-in via the `plain` prop (false = texture on).
 const surface = plain ? "" : "gaffer-card-texture";

 return (
 <div
 className={`gaffer-surface ${accentBorder} transition-all duration-200 ${surface} ${className}`}
 >
 {children}
 </div>
 );
}

interface CardHeaderProps {
 children: ReactNode;
 action?: ReactNode;
 className?: string;
}

export function CardHeader({ children, action, className = "" }: CardHeaderProps) {
 // V99.11: Brass-tinted header band. Uses gaffer-header-gradient for
 // subtle depth + brass-marker bar (the signature motif from the UI spec).
 return (
 <div
 className={`gaffer-header-gradient px-3.5 py-2.5 border-b border-accent-500/15 dark:border-accent-500/20 flex items-center justify-between ${className}`}
 >
 <div className="flex items-center gap-2">
 {/* V99.11: Brass marker bar — 3×11px brass rectangle before every
   card title (UI spec §4 signature motif) */}
 <span className="inline-block h-[11px] w-[3px] bg-accent-500 shrink-0" />
 <h3 className="text-xs font-heading font-bold uppercase tracking-[0.09em] text-concrete dark:text-chalk">
 {children}
 </h3>
 </div>
 {action}
 </div>
 );
}

interface CardBodyProps {
 children: ReactNode;
 className?: string;
}

export function CardBody({ children, className = "" }: CardBodyProps) {
 // V99.11: Padding per UI spec §1.3 (13-14px)
 return <div className={`p-3.5 ${className}`}>{children}</div>;
}
