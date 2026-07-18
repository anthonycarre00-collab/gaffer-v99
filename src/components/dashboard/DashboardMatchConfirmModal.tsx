import { AlertCircle } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { getFixtureDisplayLabel, getTeamName } from "../../lib/helpers";
import type { FixtureData, TeamData } from "../../store/gameStore";
import type { MatchModeType } from "../../hooks/useAdvanceTime";
import type { DashboardMatchModeMeta } from "./DashboardHeader";
import DashboardModalFrame from "./DashboardModalFrame";

interface DashboardMatchConfirmModalProps {
 matchMode: MatchModeType;
 modeMeta: DashboardMatchModeMeta;
 onCancel: () => void;
 onConfirm: () => void;
 teams: TeamData[];
 todayMatchFixture: FixtureData | null;
}

export default function DashboardMatchConfirmModal({
 matchMode,
 modeMeta,
 onCancel,
 onConfirm,
 teams,
 todayMatchFixture,
}: DashboardMatchConfirmModalProps): JSX.Element {
 const { t } = useTranslation();

 return (
 <DashboardModalFrame maxWidthClassName="max-w-md">
 <div className="mb-4 flex items-center gap-3">
 <div
 className={`flex h-10 w-10 items-center justify-center rounded ${modeMeta.buttonColorClass} text-ink`}
 >
 {modeMeta.icon}
 </div>
 <div>
 <h3 className="text-lg font-heading font-bold uppercase tracking-wide text-ink">
 {t("continueMenu.matchDayTitle")}
 </h3>
 <p className="text-xs text-ink-dim">
 {modeMeta.label}
 </p>
 </div>
 </div>
 {todayMatchFixture && (
 <div className="mb-4 rounded bg-carbon-2 p-4 text-center bg-carbon-2">
 <p className="mb-2 text-xs font-heading uppercase tracking-widest text-ink-faint">
 {getFixtureDisplayLabel(t, todayMatchFixture)}
 </p>
 <p className="text-lg font-heading font-bold text-ink">
 {getTeamName(teams, todayMatchFixture.home_team_id)}{" "}
 <span className="mx-2 text-ink-faint">{t("common.vs")}</span>{" "}
 {getTeamName(teams, todayMatchFixture.away_team_id)}
 </p>
 </div>
 )}
 <p className="mb-1 text-sm text-ink-dim">
 {modeMeta.desc}
 </p>
 {matchMode === "delegate" && (
 <p className="mt-1 flex items-center gap-1 text-xs text-accent-500 dark:text-accent-400">
 <AlertCircle className="h-3.5 w-3.5" />
 {t("continueMenu.delegateWarning")}
 </p>
 )}
 <div className="mt-5 flex gap-3">
 <button
 onClick={onCancel}
 className="flex-1 rounded bg-carbon-2 px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider text-ink transition-colors hover:bg-carbon-3 text-ink-dim hover:bg-carbon-3"
 >
 {t("common.cancel")}
 </button>
 <button
 onClick={onConfirm}
 className={`flex flex-1 items-center justify-center gap-2 rounded ${modeMeta.buttonColorClass} px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider text-ink transition-all hover:brightness-110`}
 >
 {modeMeta.icon}
 {t("common.confirm")}
 </button>
 </div>
 </DashboardModalFrame>
 );
}
