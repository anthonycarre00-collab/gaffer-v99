import type { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
 variant?: "primary" | "accent" | "ghost" | "outline";
 size?: "sm" | "md" | "lg";
 children: ReactNode;
 icon?: ReactNode;
 iconRight?: ReactNode;
}

export function Button({
 variant = "primary",
 size = "md",
 children,
 icon,
 iconRight,
 className = "",
 disabled,
 ...props
}: ButtonProps) {
 const base =
 "inline-flex items-center justify-center gap-2 font-heading font-bold uppercase tracking-wider rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.98]";

 const variants = {
 primary:
 "bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-ink focus:ring-primary-500 dark:focus:ring-offset-navy-800",
 accent:
 "bg-accent-500 hover:bg-accent-600 active:bg-accent-700 text-ink focus:ring-accent-500 dark:focus:ring-offset-navy-800",
 ghost:
 "bg-transparent hover:bg-carbon-2 hover:bg-carbon-3 text-ink-dim focus:ring-gray-300 dark:focus:ring-offset-navy-800",
 outline:
 "bg-transparent border border-slate-line hover:border-primary-500 dark:hover:border-primary-400 text-ink-dim hover:text-primary-500 dark:hover:text-primary-400 focus:ring-primary-500 dark:focus:ring-offset-navy-800",
 };

 const sizes = {
 sm: "px-3 py-1.5 text-xs",
 md: "px-5 py-2.5 text-sm",
 lg: "px-7 py-3.5 text-base",
 };

 return (
 <button
 className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
 disabled={disabled}
 {...props}
 >
 {icon && <span className="[&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
 {children}
 {iconRight && <span className="[&>svg]:w-4 [&>svg]:h-4">{iconRight}</span>}
 </button>
 );
}
