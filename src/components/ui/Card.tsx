import type { ReactNode } from "react";

interface CardProps {
 children: ReactNode;
 className?: string;
 accent?: "primary" | "accent" | "success" | "danger" | "none";
 /** V99.8: Opt out of the default Gaffer card texture. Use sparingly —
  *  the texture is what makes cards feel like they belong to the Gaffer
  *  office rather than a generic SaaS dashboard. */
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

 // V99.8: Gaffer card aesthetic — keep the Tailwind border/bg/shadow from
 // above (they're tuned per dark/light mode), and layer the paper texture
 // on top so every card has the dugout/broadsheet feel without each caller
 // needing to opt in. The `plain` prop is the escape hatch for cards that
 // sit on top of their own texture (e.g. tactics board, scouting dossier)
 // where doubling up looks muddy.
 const surface = plain ? "" : "gaffer-card-texture";

 return (
 <div
 className={`
 bg-white dark:bg-navy-700
 border border-gray-200 dark:border-navy-600
 ${accentBorder}
 rounded-lg
 shadow-sm
 transition-all duration-200
 ${surface}
 ${className}
 `}
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
 // V99.8: Brass-tinted header band with the Gaffer header gradient.
 // Adds depth to every card top — the brass tint reads as "framed
 // document" rather than "SaaS panel".
 return (
 <div
 className={`gaffer-header-gradient px-6 py-4 border-b border-accent-500/15 dark:border-accent-500/20 flex items-center justify-between ${className}`}
 >
 <h3 className="text-base font-heading font-bold uppercase tracking-[0.08em] text-gray-800 dark:text-chalk">
 {children}
 </h3>
 {action}
 </div>
 );
}

interface CardBodyProps {
 children: ReactNode;
 className?: string;
}

export function CardBody({ children, className = "" }: CardBodyProps) {
 return <div className={`p-6 ${className}`}>{children}</div>;
}
