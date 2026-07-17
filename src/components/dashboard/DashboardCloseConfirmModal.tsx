import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import DashboardModalFrame from "./DashboardModalFrame";

interface DashboardCloseConfirmModalProps {
 onCancel: () => void;
 onQuitWithoutSave: () => void;
 onSaveAndQuit: () => void;
}

export default function DashboardCloseConfirmModal({
 onCancel,
 onQuitWithoutSave,
 onSaveAndQuit,
}: DashboardCloseConfirmModalProps): JSX.Element {
 const { t } = useTranslation();

 return (
 <DashboardModalFrame maxWidthClassName="max-w-sm">
 <h3 className="text-lg font-heading font-bold uppercase tracking-wide text-ink">
 {t("closeConfirm.title")}
 </h3>
 <p className="mt-2 text-sm text-ink-dim">
 {t("closeConfirm.message")}
 </p>
 <div className="mt-6 flex flex-col gap-2">
 <button
 onClick={onSaveAndQuit}
 className="w-full rounded bg-primary-500 px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-600"
 >
 {t("closeConfirm.saveQuit")}
 </button>
 <button
 onClick={onQuitWithoutSave}
 className="w-full rounded bg-danger-500 px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider text-white transition-colors hover:bg-danger-600"
 >
 {t("closeConfirm.quitNoSave")}
 </button>
 <button
 onClick={onCancel}
 className="w-full rounded bg-carbon-2 px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider text-ink transition-colors hover:bg-carbon-3 text-ink-dim hover:bg-carbon-3"
 >
 {t("common.cancel")}
 </button>
 </div>
 </DashboardModalFrame>
 );
}
