/**
 * V99 Tooltip — Gaffer-voice tooltips for key UI elements.
 *
 * Lightweight tooltip that appears on hover. Uses the browser's native
 * title attribute as a fallback, but provides a styled tooltip for
 * elements that need more context.
 *
 * Usage:
 *  <Tooltip text="The gaffer's explanation of what this does">
 *   <button>...</button>
 *  </Tooltip>
 *
 * Or for simple cases, just use the title attribute:
 *  <button title="The gaffer's explanation">...</button>
 */

import { useState, type ReactNode } from "react";

interface TooltipProps {
 text: string;
 children: ReactNode;
 /** Position of the tooltip relative to the trigger. */
 position?: "top" | "bottom" | "left" | "right";
 /** Delay before showing (ms). Default 500. */
 delay?: number;
 className?: string;
}

export function Tooltip({
 text,
 children,
 position = "top",
 delay = 500,
 className = "",
}: TooltipProps) {
 const [visible, setVisible] = useState(false);
 const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

 const show = () => {
 if (timeoutId) clearTimeout(timeoutId);
 const id = setTimeout(() => setVisible(true), delay);
 setTimeoutId(id);
 };

 const hide = () => {
 if (timeoutId) clearTimeout(timeoutId);
 setVisible(false);
 };

 const positionClasses = {
 top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
 bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
 left: "right-full top-1/2 -translate-y-1/2 mr-2",
 right: "left-full top-1/2 -translate-y-1/2 ml-2",
 };

 return (
 <span
 className={`relative inline-flex ${className}`}
 onMouseEnter={show}
 onMouseLeave={hide}
 onFocus={show}
 onBlur={hide}
 >
 {children}
 {visible && (
 <span
 className={`absolute z-50 ${positionClasses[position]} pointer-events-none whitespace-normal max-w-[250px] rounded-lg bg-carbon-0 bg-carbon-0 px-3 py-2 text-xs text-ink shadow-lg animate-in fade-in duration-150`}
 role="tooltip"
 >
 {text}
 </span>
 )}
 </span>
 );
}
