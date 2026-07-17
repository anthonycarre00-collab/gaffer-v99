import { useTranslation } from "react-i18next";

import type { PlayerData, TeamData } from "../../store/gameStore";
import type { FreeAgentContractProjection } from "../../services/freeAgentService";
import type { NegotiationFeedbackPanelData } from "../NegotiationFeedbackPanel";
import NegotiationFeedbackPanel from "../NegotiationFeedbackPanel";
import { Badge } from "../ui";
import { formatVal, getTeamName, positionBadgeVariant } from "../../lib/helpers";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";

const MAX_CONTRACT_YEARS = 5;

export interface FreeAgentContractFormProps {
 player: PlayerData;
 teams: TeamData[];
 wage: string;
 onWageChange: (value: string) => void;
 contractLength: string;
 onContractLengthChange: (value: string) => void;
 projection: FreeAgentContractProjection | null;
 feedback: NegotiationFeedbackPanelData | null | undefined;
 statusMessage: string | null;
 statusClassName: string;
 submitting: boolean;
 submitDisabled: boolean;
 showPlayerSummary?: boolean;
 onSubmit: () => void;
 onClose: () => void;
}

type FreeAgentContractModalProps = FreeAgentContractFormProps;

export function FreeAgentContractForm({
 player,
 teams,
 wage,
 onWageChange,
 contractLength,
 onContractLengthChange,
 projection,
 feedback,
 statusMessage,
 statusClassName,
 submitting,
 submitDisabled,
 showPlayerSummary = true,
 onSubmit,
 onClose,
}: FreeAgentContractFormProps) {
 const { t } = useTranslation();
 const titleId = `free-agent-contract-title-${player.id}`;

 return (
 <>
 <h3
 id={titleId}
 className="text-sm font-heading font-bold uppercase tracking-wider text-ink-dim mb-3"
 >
 {t("transfers.offerContract")}
 </h3>
 {showPlayerSummary ? (
 <div className="flex items-center gap-3 mb-4">
 <Badge variant={positionBadgeVariant(player.position)} size="sm">
 {translatePositionAbbreviation(t, player.position)}
 </Badge>
 <div>
 <p className="font-semibold text-sm text-ink text-ink">
 {player.full_name}
 </p>
 <p className="text-xs text-ink-faint">
 {player.team_id
 ? getTeamName(teams, player.team_id)
 : t("common.freeAgent")}{" "}
 •{" "}
 {t("transfers.playerValue", {
 value: formatVal(player.market_value),
 })}
 </p>
 </div>
 </div>
 ) : null}

 <label
 htmlFor="free-agent-wage"
 className="text-xs font-heading font-bold uppercase tracking-wider text-ink-dim mb-1 block"
 >
 {t("playerProfile.renewalWage")}
 </label>
 <input
 id="free-agent-wage"
 type="number"
 min="0"
 step="1000"
 value={wage}
 onChange={(event) => onWageChange(event.target.value)}
 className="w-full px-3 py-2 rounded bg-carbon-2 border border-slate-line text-sm text-ink text-ink mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
 />

 <label
 htmlFor="free-agent-years"
 className="text-xs font-heading font-bold uppercase tracking-wider text-ink-dim mb-1 block"
 >
 {t("playerProfile.renewalLength")}
 </label>
 <input
 id="free-agent-years"
 type="number"
 min="1"
 max={String(MAX_CONTRACT_YEARS)}
 step="1"
 value={contractLength}
 onChange={(event) => onContractLengthChange(event.target.value)}
 className="w-full px-3 py-2 rounded bg-carbon-2 border border-slate-line text-sm text-ink text-ink mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
 />

 {projection ? (
 <div className="rounded border border-slate-line bg-white/70 bg-carbon-0/40 p-3 mb-3 space-y-2">
 <p className="text-[11px] font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("playerProfile.renewalProjectionTitle")}
 </p>
 <p className="text-xs text-ink-dim">
 {t("playerProfile.renewalProjectionWageBill", {
 before: formatVal(projection.current_weekly_wage_spend),
 after: formatVal(projection.projected_weekly_wage_spend),
 })}
 </p>
 <p className="text-xs text-ink-dim">
 {t("playerProfile.renewalProjectionBudgetUsage", {
 before: Math.round(
 (projection.current_annual_wage_bill /
 Math.max(projection.annual_wage_budget, 1)) *
 100,
 ),
 after: Math.round(
 (projection.projected_annual_wage_bill /
 Math.max(projection.annual_wage_budget, 1)) *
 100,
 ),
 })}
 </p>
 <p className="text-xs text-ink-dim">
 {t("playerProfile.renewalProjectionRunway", {
 before: projection.current_cash_runway_weeks ?? "∞",
 after: projection.projected_cash_runway_weeks ?? "∞",
 })}
 </p>
 {!projection.policy_allows ? (
 <p className="text-xs text-danger-600 dark:text-danger-300">
 {t("playerProfile.renewalBudgetWarning")}
 </p>
 ) : null}
 </div>
 ) : null}

 <NegotiationFeedbackPanel
 feedback={feedback ?? null}
 titleKey="playerProfile.renewalConversationTitle"
 roundKey="playerProfile.renewalRound"
 patienceKey="playerProfile.renewalPatience"
 tensionKey="playerProfile.renewalTension"
 className="mb-3"
 />

 {statusMessage ? (
 <div
 className={`text-xs font-heading font-bold uppercase tracking-wider mb-3 ${statusClassName}`}
 >
 {statusMessage}
 </div>
 ) : null}

 <div className="flex gap-2">
 <button
 onClick={onSubmit}
 disabled={submitDisabled}
 className="flex-1 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded font-heading font-bold text-sm uppercase tracking-wider transition-colors disabled:opacity-50"
 >
 {submitting
 ? t("transfers.submitting")
 : t("playerProfile.renewalSubmit")}
 </button>
 <button
 onClick={onClose}
 className="px-4 py-2 bg-carbon-3 text-ink-dim rounded font-heading font-bold text-sm uppercase tracking-wider hover:bg-carbon-3 hover:bg-carbon-3 transition-colors"
 >
 {t("transfers.close")}
 </button>
 </div>
 </>
 );
}

export default function FreeAgentContractModal(
 props: FreeAgentContractModalProps,
) {
 const titleId = `free-agent-contract-title-${props.player.id}`;

 return (
 <div
 className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
 onClick={props.onClose}
 >
 <div
 className="bg-white bg-carbon-1 rounded shadow-2xl border border-slate-line p-6 w-full max-w-sm"
 role="dialog"
 aria-modal="true"
 aria-labelledby={titleId}
 onClick={(event) => event.stopPropagation()}
 >
 <FreeAgentContractForm {...props} />
 </div>
 </div>
 );
}
