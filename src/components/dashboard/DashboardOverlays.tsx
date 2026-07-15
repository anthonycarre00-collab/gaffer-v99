import { useTranslation } from "react-i18next";
import type { FixtureData, TeamData } from "../../store/gameStore";
import type { MatchModeType } from "../../hooks/useAdvanceTime";
import type { BlockerModal } from "../../hooks/useAdvanceTime.helpers";
import type { DigestEntry, DigestStopReason } from "../../hooks/useDigestAdvance";
import DashboardBlockerModal from "./DashboardBlockerModal";
import DashboardCloseConfirmModal from "./DashboardCloseConfirmModal";
import DashboardExitConfirmModal from "./DashboardExitConfirmModal";
import DashboardExitSavingModal from "./DashboardExitSavingModal";
import { type DashboardMatchModeMeta } from "./DashboardHeader";
import DashboardMatchConfirmModal from "./DashboardMatchConfirmModal";
import DashboardSimulatingModal from "./DashboardSimulatingModal";
import type { AdvanceRecap } from "./advanceRecap";

interface DashboardOverlaysProps {
 blockerModal: BlockerModal | null;
 currentModeMeta: DashboardMatchModeMeta;
 isAdvancing: boolean;
 recapResults: AdvanceRecap | null;
 onCloseRecap: () => void;
 handleConfirmMatch: () => void;
 handleExitToMenu: () => void | Promise<void>;
 handleNavigate: (tab: string) => void;
 handleCloseQuit: (save: boolean) => void | Promise<void>;
 isExitingToMenu: boolean;
 matchMode: MatchModeType;
 setBlockerModal: (value: BlockerModal | null) => void;
 setShowCloseConfirm: (value: boolean) => void;
 setShowExitConfirm: (value: boolean) => void;
 setShowMatchConfirm: (value: boolean) => void;
 showCloseConfirm: boolean;
 showExitConfirm: boolean;
 showMatchConfirm: boolean;
 teams: TeamData[];
 todayMatchFixture: FixtureData | null;
 // Digest feed props (present when digest mode is active)
 digestEntries?: DigestEntry[];
 digestStopReason?: DigestStopReason | null;
 isDigestVisible?: boolean;
 isDigestRunning?: boolean;
 isDigestAborting?: boolean;
 onDigestContinueAfterBlocker?: () => void;
 onDismissDigest?: () => void;
 onDigestStop?: () => void;
}

export default function DashboardOverlays({
 blockerModal,
 currentModeMeta,
 isAdvancing,
 recapResults,
 onCloseRecap,
 handleConfirmMatch,
 handleExitToMenu,
 handleNavigate,
 handleCloseQuit,
 isExitingToMenu,
 matchMode,
 setBlockerModal,
 setShowCloseConfirm,
 setShowExitConfirm,
 setShowMatchConfirm,
 showCloseConfirm,
 showExitConfirm,
 showMatchConfirm,
 teams,
 todayMatchFixture,
 digestEntries,
 digestStopReason,
 isDigestVisible,
 isDigestRunning,
 isDigestAborting,
 onDigestContinueAfterBlocker,
 onDismissDigest,
 onDigestStop,
}: DashboardOverlaysProps) {
 const { t } = useTranslation();
 return (
 <>
 {(isDigestVisible || isAdvancing) ? (
 <DashboardSimulatingModal
 digestEntries={digestEntries}
 isDigestRunning={isDigestRunning}
 isDigestAborting={isDigestAborting}
 stopReason={digestStopReason}
 onStop={onDigestStop}
 onDismiss={onDismissDigest}
 onNavigate={handleNavigate}
 onContinueAfterBlocker={onDigestContinueAfterBlocker}
 />
 ) : null}

 {/* V99: Recap now shows as a non-blocking toast panel at bottom-right
     instead of a full-screen modal that interrupts the player.
     Auto-dismisses after 7s. Can also be dismissed by clicking. */}
 {!isAdvancing && recapResults ? (
 <div className="fixed bottom-6 right-6 z-50 max-w-md max-h-[60vh] overflow-y-auto rounded-lg bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-600 shadow-xl animate-in slide-in-from-bottom-2 duration-200">
 <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-navy-600">
 <h3 className="text-sm font-heading font-bold uppercase tracking-wide text-gray-900 dark:text-white">
 {recapResults.advancedTo
 ? t("dashboard.recapAdvancedTo", { date: new Date(recapResults.advancedTo).toLocaleDateString() })
 : t("dashboard.resultsRecapTitle")}
 </h3>
 <button
 onClick={onCloseRecap}
 className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-xs"
 >
 ✕
 </button>
 </div>
 <div className="p-4 max-h-[40vh] overflow-y-auto">
 {recapResults.matches.length > 0 ? (
 <div className="space-y-1">
 {recapResults.matches.slice(0, 8).map((match, i) => (
 <div key={i} className="flex items-center justify-between text-xs py-1">
 <span className="text-gray-700 dark:text-gray-300 truncate flex-1">
 {match.home_team} {match.home_goals}-{match.away_goals} {match.away_team}
 </span>
 </div>
 ))}
 {recapResults.matches.length > 8 && (
 <p className="text-[10px] text-gray-400 mt-1">+ {recapResults.matches.length - 8} more</p>
 )}
 </div>
 ) : (
 <p className="text-xs text-gray-500 dark:text-gray-400 italic">{t("dashboard.recapNothingNotable")}</p>
 )}
 {recapResults.hasEvents && (
 <button
 onClick={onCloseRecap}
 className="mt-3 w-full text-center text-xs font-heading uppercase tracking-wider text-primary-500 hover:text-primary-600 transition-colors py-1"
 >
 {t("dashboard.resultsRecapDismiss")} →
 </button>
 )}
 </div>
 </div>
 ) : null}
 {isExitingToMenu ? <DashboardExitSavingModal /> : null}

 {showExitConfirm ? (
 <DashboardExitConfirmModal
 onCancel={() => setShowExitConfirm(false)}
 onConfirm={() => {
 setShowExitConfirm(false);
 void handleExitToMenu();
 }}
 />
 ) : null}

 {showCloseConfirm ? (
 <DashboardCloseConfirmModal
 onCancel={() => setShowCloseConfirm(false)}
 onQuitWithoutSave={() => void handleCloseQuit(false)}
 onSaveAndQuit={() => void handleCloseQuit(true)}
 />
 ) : null}

 {showMatchConfirm ? (
 <DashboardMatchConfirmModal
 matchMode={matchMode}
 modeMeta={currentModeMeta}
 onCancel={() => setShowMatchConfirm(false)}
 onConfirm={handleConfirmMatch}
 teams={teams}
 todayMatchFixture={todayMatchFixture}
 />
 ) : null}

 {blockerModal ? (
 <DashboardBlockerModal
 blockerModal={blockerModal}
 onClose={() => setBlockerModal(null)}
 onContinueAnyway={blockerModal.pendingAction ?? null}
 onNavigate={(tab) => {
 setBlockerModal(null);
 handleNavigate(tab);
 }}
 />
 ) : null}
 </>
 );
}