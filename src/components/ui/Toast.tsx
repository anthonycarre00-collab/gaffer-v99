/**
 * V99 Toast Notification System — lightweight feedback for button actions.
 *
 * Shows a small toast in the bottom-right corner when actions complete
 * (save, transfer bid, contract offer, etc). Auto-dismisses after 3s.
 * No interruption — just visual confirmation that something happened.
 *
 * Usage:
 *  import { toast } from "../ui/Toast";
 *  toast.success("Saved!");
 *  toast.error("Failed to save");
 *  toast.info("Loading...");
 *
 * The toast container mounts itself on first use — no provider needed.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "loading";

interface ToastItem {
 id: string;
 type: ToastType;
 message: string;
 duration: number; // 0 = no auto-dismiss (for loading)
}

let toastIdCounter = 0;
const listeners = new Set<(toasts: ToastItem[]) => void>();
let currentToasts: ToastItem[] = [];

function emit() {
 listeners.forEach((listener) => listener([...currentToasts]));
}

function addToast(type: ToastType, message: string, duration = 3000) {
 const id = `toast-${++toastIdCounter}`;
 const item: ToastItem = { id, type, message, duration };
 currentToasts = [...currentToasts, item];
 emit();
 if (duration > 0) {
 setTimeout(() => removeToast(id), duration);
 }
 return id;
}

function removeToast(id: string) {
 currentToasts = currentToasts.filter((t) => t.id !== id);
 emit();
}

export const toast = {
 success: (message: string) => addToast("success", message),
 error: (message: string) => addToast("error", message, 5000),
 info: (message: string) => addToast("info", message),
 loading: (message: string) => addToast("loading", message, 0),
 dismiss: (id: string) => removeToast(id),
 /** Update a loading toast to success/error and auto-dismiss. */
 resolve: (id: string, type: "success" | "error", message: string) => {
 currentToasts = currentToasts.map((t) =>
 t.id === id ? { ...t, type, message, duration: 3000 } : t,
 );
 emit();
 setTimeout(() => removeToast(id), 3000);
 },
};

const TYPE_CONFIG: Record<ToastType, { icon: typeof Info; color: string }> = {
 success: { icon: CheckCircle2, color: "text-success-500" },
 error: { icon: XCircle, color: "text-danger-500" },
 info: { icon: Info, color: "text-primary-500" },
 loading: { icon: Info, color: "text-accent-500" },
};

function ToastContainer() {
 const [toasts, setToasts] = useState<ToastItem[]>([]);

 useEffect(() => {
 const listener = (newToasts: ToastItem[]) => setToasts(newToasts);
 listeners.add(listener);
 return () => {
 listeners.delete(listener);
 };
 }, []);

 if (toasts.length === 0) return null;

 return createPortal(
 <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
 {toasts.map((item) => {
 const config = TYPE_CONFIG[item.type];
 const Icon = config.icon;
 return (
 <div
 key={item.id}
 className={`pointer-events-auto flex items-center gap-3 rounded-lg bg-carbon-1 border border-slate-line shadow-lg px-4 py-3 min-w-[280px] max-w-[400px] animate-in slide-in-from-bottom-2 duration-200`}
 >
 <Icon className={`h-5 w-5 shrink-0 ${config.color} ${item.type === "loading" ? "animate-spin" : ""}`} />
 <span className="text-sm font-medium text-ink flex-1">
 {item.message}
 </span>
 {item.duration === 0 && (
 <button
 onClick={() => removeToast(item.id)}
 className="text-ink-faint hover:text-ink-dim hover:text-ink transition-colors"
 >
 <X className="h-4 w-4" />
 </button>
 )}
 </div>
 );
 })}
 </div>,
 document.body,
 );
}

let containerMounted = false;

/** Mount the toast container into the DOM. Safe to call multiple times. */
export function mountToastContainer() {
 if (containerMounted) return;
 if (typeof document === "undefined") return;
 const div = document.createElement("div");
 div.id = "toast-container-root";
 document.body.appendChild(div);
 containerMounted = true;
}

// Auto-mount on first import in browser.
if (typeof document !== "undefined") {
 // Defer to next tick so React is ready.
 setTimeout(() => mountToastContainer(), 0);
}

export { ToastContainer };
