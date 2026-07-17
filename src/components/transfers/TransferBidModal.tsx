import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

import type {
 PlayerData,
 TeamData,
 TransferOfferData,
} from "../../store/gameStore";
import {
 formatVal,
 getTeamName,
 positionBadgeVariant,
} from "../../lib/helpers";
import type {
 TransferBidProjectionData,
 TransferNegotiationResponseData,
} from "../../services/transfersService";
import NegotiationFeedbackPanel, {
 type NegotiationFeedbackPanelData,
} from "../NegotiationFeedbackPanel";
import { Badge } from "../ui";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import TransferNegotiationHistory from "./TransferNegotiationHistory";

export interface TransferBidFormProps {
 bidTarget: PlayerData;
 teams: TeamData[];
 bidAmount: string;
 onBidAmountChange: (value: string) => void;
 myTeam: TeamData | null;
 bidFee: number | null;
 bidProjection: TransferBidProjectionData["projection"] | null;
 bidFeedback: NegotiationFeedbackPanelData | null;
 activeBidOffer: TransferOfferData | null;
 hasExistingOffer: boolean;
 bidResult: TransferNegotiationResponseData["decision"] | "error" | null;
 bidLoading: boolean;
 bidSubmitDisabled: boolean;
 blockingTitle?: string | null;
 blockingDetail?: string | null;
 showPlayerSummary?: boolean;
 onSubmit: () => void;
 onClose: () => void;
}

type TransferBidModalProps = TransferBidFormProps;

export function TransferBidForm({
 bidTarget,
 teams,
 bidAmount,
 onBidAmountChange,
 myTeam,
 bidFee,
 bidProjection,
 bidFeedback,
 activeBidOffer,
 hasExistingOffer,
 bidResult,
 bidLoading,
 bidSubmitDisabled,
 blockingTitle = null,
 blockingDetail = null,
 showPlayerSummary = true,
 onSubmit,
 onClose,
}: TransferBidFormProps) {
 const { t } = useTranslation();
 const titleId = `transfer-bid-modal-title-${bidTarget.id}`;

 return (
 <>
 <h3
 id={titleId}
 className="text-sm font-heading font-bold uppercase tracking-wider text-ink-dim mb-3"
 >
 {t("transfers.makeBid")}
 </h3>

 {showPlayerSummary ? (
 <div className="flex items-center gap-3 mb-4">
 <Badge variant={positionBadgeVariant(bidTarget.position)} size="sm">
 {translatePositionAbbreviation(t, bidTarget.position)}
 </Badge>
 <div>
 <p className="font-semibold text-sm text-ink text-ink">
 {bidTarget.full_name}
 </p>
 <p className="text-xs text-ink-faint">
 {getTeamName(teams, bidTarget.team_id)} •{" "}
 {t("transfers.playerValue", {
 value: formatVal(bidTarget.market_value),
 })}
 </p>
 </div>
 </div>
 ) : null}
 {blockingTitle ? (
 <div
 role="alert"
 className="mb-4 flex gap-2 rounded border border-danger-200 bg-danger-50 px-3 py-2 text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200"
 >
 <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
 <div className="text-xs">
 <p className="font-heading font-bold uppercase tracking-wider">
 {blockingTitle}
 </p>
 {blockingDetail ? <p className="mt-1">{blockingDetail}</p> : null}
 </div>
 </div>
 ) : null}
 {hasExistingOffer ? (
 <p className="text-xs text-ink-dim mb-3">
 {t("transfers.resumeNegotiationHint")}
 </p>
 ) : null}
 <label
 htmlFor="bid-amount"
 className="text-xs font-heading font-bold uppercase tracking-wider text-ink-dim mb-1 block"
 >
 {t("transfers.bidAmount")}
 </label>
 <input
 id="bid-amount"
 type="number"
 step="0.1"
 min="0"
 value={bidAmount}
 onChange={(event) => onBidAmountChange(event.target.value)}
 className="w-full px-3 py-2 rounded bg-carbon-2 border border-slate-line text-sm text-ink text-ink mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
 />
 {myTeam && bidFee !== null && bidProjection ? (
 <div className="rounded border border-slate-line bg-white/70 bg-carbon-0/40 p-3 mb-3 space-y-2">
 <p className="text-[11px] font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("transfers.bidImpactTitle")}
 </p>
 <p className="text-xs text-ink-dim">
 {t(
 bidProjection.pending_registration_date
 ? "transfers.bidImpactTransferBudgetDeferred"
 : "transfers.bidImpactTransferBudget",
 {
 before: formatVal(bidProjection.transfer_budget_before),
 after: formatVal(bidProjection.transfer_budget_after),
 date: bidProjection.pending_registration_date ?? "",
 },
 )}
 </p>
 <p className="text-xs text-ink-dim">
 {t(
 bidProjection.pending_registration_date
 ? "transfers.bidImpactBalanceDeferred"
 : "transfers.bidImpactBalance",
 {
 before: formatVal(bidProjection.finance_before),
 after: formatVal(bidProjection.finance_after),
 date: bidProjection.pending_registration_date ?? "",
 },
 )}
 </p>
 <p className="text-xs text-ink-dim">
 {t("transfers.bidImpactWagePressure", {
 percent: bidProjection.projected_wage_budget_usage_pct,
 })}
 </p>
 {bidProjection.exceeds_transfer_budget ? (
 <p className="text-xs text-danger-600 dark:text-danger-300">
 {t("transfers.bidImpactOverTransferBudget")}
 </p>
 ) : null}
 {bidProjection.exceeds_finance ? (
 <p className="text-xs text-danger-600 dark:text-danger-300">
 {t("transfers.bidImpactOverBalance")}
 </p>
 ) : null}
 </div>
 ) : null}
 <NegotiationFeedbackPanel
 feedback={bidFeedback}
 titleKey="transfers.negotiationPulse"
 roundKey="transfers.negotiationRound"
 patienceKey="transfers.negotiationPatience"
 tensionKey="transfers.negotiationTension"
 className="mb-3"
 />
 <TransferNegotiationHistory offer={activeBidOffer} mode="outgoing" />
 {bidResult ? (
 <div
 className={`text-xs font-heading font-bold uppercase tracking-wider mb-3 ${bidResult === "accepted" ? "text-success-500" : bidResult === "rejected" ? "text-danger-600 dark:text-danger-300" : "text-accent-500"}`}
 >
 {bidResult === "accepted"
 ? t("transfers.bidAccepted")
 : bidResult === "rejected"
 ? t("transfers.bidRejected")
 : bidResult === "counter_offer"
 ? t("transfers.bidCountered")
 : bidResult}
 </div>
 ) : null}
 <div className="flex gap-2">
 <button
 type="button"
 onClick={onSubmit}
 disabled={bidSubmitDisabled}
 className="flex-1 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded font-heading font-bold text-sm uppercase tracking-wider transition-colors disabled:opacity-50"
 >
 {bidLoading ? t("transfers.submitting") : t("transfers.submitBid")}
 </button>
 <button
 type="button"
 onClick={onClose}
 className="px-4 py-2 bg-carbon-3 text-ink-dim rounded font-heading font-bold text-sm uppercase tracking-wider hover:bg-carbon-3 hover:bg-carbon-3 transition-colors"
 >
 {t("transfers.close")}
 </button>
 </div>
 </>
 );
}

export default function TransferBidModal(props: TransferBidModalProps) {
 const titleId = `transfer-bid-modal-title-${props.bidTarget.id}`;

 return (
 <div
 role="presentation"
 className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
 onClick={props.onClose}
 >
 <div
 role="dialog"
 aria-modal="true"
 aria-labelledby={titleId}
 className="bg-white bg-carbon-1 rounded shadow-2xl border border-slate-line p-6 w-full max-w-sm"
 onClick={(event) => event.stopPropagation()}
 >
 <TransferBidForm {...props} />
 </div>
 </div>
 );
}
