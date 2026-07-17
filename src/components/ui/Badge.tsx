import type { ReactNode } from "react";

interface BadgeProps {
 children: ReactNode;
 variant?: "primary" | "accent" | "success" | "danger" | "neutral";
 size?: "sm" | "md";
 className?: string;
}

export function Badge({ children, variant = "neutral", size = "sm", className = "" }: BadgeProps) {
 const variants = {
 primary: "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300",
 accent: "bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300",
 success: "bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-400",
 danger: "bg-danger-100 text-danger-700 dark:bg-danger-900/40 dark:text-danger-400",
 neutral: "bg-carbon-2 text-ink-dim bg-carbon-3 text-ink-faint",
 };

 const sizes = {
 sm: "px-2 py-0.5 text-xs",
 md: "px-3 py-1 text-sm",
 };

 return (
 <span
 className={`inline-flex items-center font-bold font-heading uppercase tracking-wider rounded-full ${variants[variant]} ${sizes[size]} ${className}`}
 >
 {children}
 </span>
 );
}
