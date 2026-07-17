import { AlertCircle } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import type { BlockerModal } from "../../hooks/useAdvanceTime.helpers";
import type { BlockerData } from "../../services/advanceTimeService";
import { resolveBackendText } from "../../utils/backendI18n";
import { getBlockerTabLabel } from "../../utils/blockerUtils";
import DashboardModalFrame from "./DashboardModalFrame";

interface DashboardBlockerModalProps {
 blockerModal: BlockerModal;
 onClose: () => void;
 onContinueAnyway: (() => void) | null;
 onNavigate: (tab: string) => void;
}

function getBlockerButtonClassName(severity: string): string {
 const baseClassName =
 "w-full rounded border p-3 text-left transition-all hover:shadow-sm";

 if (severity === "warn") {
 return `${baseClassName} border-accent-500/30 bg-accent-500/5 hover:bg-accent-500/10`;
 }

 return `${baseClassName} border-primary-500/30 bg-primary-500/5 hover:bg-primary-500/10`;
}

function getBlockerTextClassName(severity: string): string {
 if (severity === "warn") {
 return "text-sm font-medium text-accent-600 dark:text-accent-400";
 }

 return "text-sm font-medium text-primary-600 dark:text-primary-400";
}

function getBlockerText(blocker: BlockerData): string {
 return resolveBackendText(blocker.text_key, blocker.text, blocker.text_params);
}

export default function DashboardBlockerModal({
 blockerModal,
 onClose,
 onContinueAnyway,
 onNavigate,
}: DashboardBlockerModalProps): JSX.Element {
 const { t } = useTranslation();

 return (
 <DashboardModalFrame maxWidthClassName="max-w-md">
 <div className="mb-4 flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded bg-accent-500/20">
 <AlertCircle className="h-5 w-5 text-accent-500" />
 </div>
 <div>
 <h3 className="text-lg font-heading font-bold uppercase tracking-wide text-ink">
 {t("notifications.attentionRequired")}
 </h3>
 <p className="text-xs text-ink-dim">
 {t("notifications.resolveBeforeContinuing")}
 </p>
 </div>
 </div>
 <div className="mb-5 flex flex-col gap-2">
 {blockerModal.blockers.map((blocker) => (
 <button
 key={blocker.id}
 onClick={() => onNavigate(blocker.tab)}
 className={getBlockerButtonClassName(blocker.severity)}
 >
 <p className={getBlockerTextClassName(blocker.severity)}>
 {getBlockerText(blocker)}
 </p>
 <p className="mt-1 text-[10px] font-heading uppercase tracking-widest text-ink-faint">
 {t("notifications.goTo")} {getBlockerTabLabel(t, blocker.tab)} →
 </p>
 </button>
 ))}
 </div>
 <div className="flex gap-3">
 <button
 onClick={onClose}
 className="flex-1 rounded bg-carbon-2 px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider text-ink transition-colors hover:bg-carbon-3 text-ink-dim hover:bg-carbon-3"
 >
 {t("notifications.reviewIssues")}
 </button>
 {onContinueAnyway && (
 <button
 onClick={onContinueAnyway}
 className="flex-1 rounded bg-accent-500 px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider text-white transition-colors hover:bg-accent-600"
 >
 {t("notifications.continueAnyway")}
 </button>
 )}
 </div>
 </DashboardModalFrame>
 );
}
