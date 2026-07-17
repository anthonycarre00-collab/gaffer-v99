import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import DashboardModalFrame from "./DashboardModalFrame";

interface DashboardExitConfirmModalProps {
 onCancel: () => void;
 onConfirm: () => void;
}

export default function DashboardExitConfirmModal({
 onCancel,
 onConfirm,
}: DashboardExitConfirmModalProps): JSX.Element {
 const { t } = useTranslation();

 return (
 <DashboardModalFrame maxWidthClassName="max-w-sm">
 <h3 className="text-lg font-heading font-bold uppercase tracking-wide text-ink">
 {t("exitConfirm.title")}
 </h3>
 <p className="mt-2 text-sm text-ink-dim">
 {t("exitConfirm.message")}
 </p>
 <div className="mt-6 flex gap-3">
 <button
 onClick={onCancel}
 className="flex-1 rounded bg-carbon-2 px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider text-ink transition-colors hover:bg-carbon-3 text-ink-dim hover:bg-carbon-3"
 >
 {t("exitConfirm.cancel")}
 </button>
 <button
 onClick={onConfirm}
 className="flex-1 rounded bg-danger-500 px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider text-white transition-colors hover:bg-danger-600"
 >
 {t("exitConfirm.saveExit")}
 </button>
 </div>
 </DashboardModalFrame>
 );
}
