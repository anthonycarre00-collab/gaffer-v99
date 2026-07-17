import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { ShieldX } from "lucide-react";
import { useGameStore } from "../../store/gameStore";

export default function FiredModal(): JSX.Element | null {
 const { t } = useTranslation();
 const showFiredModal = useGameStore((s) => s.showFiredModal);
 const setShowFiredModal = useGameStore((s) => s.setShowFiredModal);
 const gameState = useGameStore((s) => s.gameState);

 if (!showFiredModal || !gameState) return null;

 const manager = gameState.manager;
 const lastEntry = manager.career_history?.length
 ? manager.career_history[manager.career_history.length - 1]
 : null;
 const teamName = lastEntry?.team_name || "";

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
 <div className="mx-4 w-full max-w-lg rounded bg-white shadow-2xl bg-carbon-1 dark:border border-slate-line">
 {/* Header */}
 <div className="flex flex-col items-center pt-8 pb-4 px-6">
 <div className="w-16 h-16 rounded from-red-600 to-red-800 flex items-center justify-center mb-4 shadow-red-600/30">
 <ShieldX className="w-8 h-8 text-white" />
 </div>
 <h2 className="text-2xl font-heading font-bold text-ink uppercase tracking-wide text-center">
 {t("sacked.title")}
 </h2>
 {teamName && (
 <p className="text-sm text-ink-faint mt-1">
 {teamName}
 </p>
 )}
 </div>

 {/* Letter body */}
 <div className="px-8 pb-6">
 <div className="rounded bg-carbon-0/50 p-5 border border-slate-line">
 <p className="text-sm text-ink-dim leading-relaxed whitespace-pre-line">
 {t("sacked.dismissalLetter", { team: teamName })}
 </p>
 </div>
 </div>

 {/* Footer */}
 <div className="px-8 pb-8">
 <button
 onClick={() => setShowFiredModal(false)}
 className="w-full rounded bg-carbon-3 bg-carbon-2 px-6 py-3 font-heading font-bold text-sm uppercase tracking-wider text-white transition-all hover:bg-carbon-2 hover:bg-carbon-3 "
 >
 {t("dashboard.continue")}
 </button>
 </div>
 </div>
 </div>
 );
}
