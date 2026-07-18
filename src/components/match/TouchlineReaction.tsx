/**
 * Manager Touchline Reactions — IDEAS #8
 *
 * During live matches, at big moments (goal conceded, red card, late winner
 * chance), show 2-3 quick options: "Calm them down" / "Get into them" /
 * "Change the shape". Each gives a tiny morale/composure modifier for the
 * next 10 minutes.
 *
 * This is a lightweight overlay that appears at key moments and disappears
 * after the user picks an option (or after 30 seconds of inactivity).
 */

import { useState, useEffect } from "react";
import { Volume2, Flame, Shield } from "lucide-react";

export interface TouchlineOption {
 id: string;
 label: string;
 icon: React.ReactNode;
 description: string;
 moraleDelta: number;
 composureDelta: number;
 aggressionDelta: number;
}

const TOUCHLINE_OPTIONS: TouchlineOption[] = [
 {
  id: "calm",
  label: "Calm them down",
  icon: <Volume2 className="w-4 h-4" />,
  description: "Steady the ship. +5 composure, -2 aggression for 10 minutes.",
  moraleDelta: 2,
  composureDelta: 5,
  aggressionDelta: -2,
 },
 {
  id: "geaux",
  label: "Get into them",
  icon: <Flame className="w-4 h-4" />,
  description: "Fire them up. +5 aggression, -2 composure for 10 minutes.",
  moraleDelta: 3,
  composureDelta: -2,
  aggressionDelta: 5,
 },
 {
  id: "shape",
  label: "Change the shape",
  icon: <Shield className="w-4 h-4" />,
  description: "Tactical tweak. +3 morale, opens formation change prompt.",
  moraleDelta: 3,
  composureDelta: 0,
  aggressionDelta: 0,
 },
];

interface TouchlineReactionProps {
 /** Trigger type — what moment caused the reaction prompt. */
 trigger: "goal_conceded" | "red_card" | "late_winner_chance" | null;
 /** Called when the user picks an option. */
 onSelect: (option: TouchlineOption) => void;
 /** Called when the user dismisses without choosing. */
 onDismiss: () => void;
}

export function TouchlineReaction({ trigger, onSelect, onDismiss }: TouchlineReactionProps) {
 const [visible, setVisible] = useState(false);

 useEffect(() => {
  if (trigger) {
   setVisible(true);
   // Auto-dismiss after 30 seconds.
   const timer = setTimeout(() => {
    setVisible(false);
    onDismiss();
   }, 30000);
   return () => clearTimeout(timer);
  } else {
   setVisible(false);
  }
 }, [trigger, onDismiss]);

 if (!visible || !trigger) {
  return null;
 }

 const triggerLabel = (() => {
  switch (trigger) {
   case "goal_conceded":
    return "Goal conceded — what's the shout?";
   case "red_card":
    return "Red card — how do you react?";
   case "late_winner_chance":
    return "Late winner chance — go for it?";
   default:
    return "Touchline shout";
  }
 })();

 return (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom duration-300">
   <div className="bg-carbon-1 rounded-lg border border-slate-line shadow-lg p-4 max-w-md gaffer-card-texture">
    <div className="flex items-center justify-between mb-3">
     <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-accent-600 dark:text-accent-400">
      {triggerLabel}
     </h3>
     <button
      onClick={() => {
       setVisible(false);
       onDismiss();
      }}
      className="text-ink-faint hover:text-ink transition-colors text-xs"
     >
      Skip
     </button>
    </div>
    <div className="grid grid-cols-3 gap-2">
     {TOUCHLINE_OPTIONS.map((option) => (
      <button
       key={option.id}
       onClick={() => {
        onSelect(option);
        setVisible(false);
       }}
       className="flex flex-col items-center gap-1 p-3 rounded border border-slate-line hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-all text-center"
       title={option.description}
      >
       <span className="text-primary-500 dark:text-primary-400">{option.icon}</span>
       <span className="text-xs font-heading font-bold uppercase tracking-wide text-ink-dim">
        {option.label}
       </span>
      </button>
     ))}
    </div>
    <p className="mt-2 text-[10px] text-ink-faint text-center">
     Quick shout — modifier lasts 10 minutes
    </p>
   </div>
  </div>
 );
}

export { TOUCHLINE_OPTIONS };
