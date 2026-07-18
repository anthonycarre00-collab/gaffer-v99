import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

import type {
 PlayerData,
 TeamData,
 TransferOfferData,
} from "../../store/gameStore";
import {
 formatExactMoney,
 formatVal,
 getTeamName,
 positionBadgeVariant,
} from "../../lib/helpers";
import type { TransferNegotiationResponseData } from "../../services/transfersService";
import NegotiationFeedbackPanel, {
 type NegotiationFeedbackPanelData,
} from "../NegotiationFeedbackPanel";
import { Badge } from "../ui";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import TransferNegotiationHistory from "./TransferNegotiationHistory";
import { parseTransferFeeInput } from "./TransfersTab.helpers";

interface TransferCounterTarget {
 player: PlayerData;
 offerId: string;
 fromTeamId: string;
 fee: number;
}

interface TransferCounterOfferModalProps {
 counterTarget: TransferCounterTarget;
 teams: TeamData[];
 counterAmount: string;
 onCounterAmountChange: (value: string) => void;
 counterFeedback: NegotiationFeedbackPanelData | null;
 activeCounterOffer: TransferOfferData | null;
 counterResult: TransferNegotiationResponseData["decision"] | "error" | null;
 counterError: string | null;
 counterLoading: boolean;
 submitDisabled?: boolean;
 blockingTitle?: string | null;
 blockingDetail?: string | null;
 onSubmit: () => void;
 onClose: () => void;
}

export default function TransferCounterOfferModal({
 counterTarget,
 teams,
 counterAmount,
 onCounterAmountChange,
 counterFeedback,
 activeCounterOffer,
 counterResult,
 counterError,
 counterLoading,
 submitDisabled = false,
 blockingTitle = null,
 blockingDetail = null,
 onSubmit,
 onClose,
}: TransferCounterOfferModalProps) {
 const { t } = useTranslation();
 const parsedCounterAmount = parseTransferFeeInput(counterAmount);

 return (
 <div
 className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
 onClick={onClose}
 >
 <div
 className="bg-carbon-1 rounded shadow-2xl border border-slate-line p-6 w-full max-w-sm"
 onClick={(event) => event.stopPropagation()}
 >
 <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-ink-dim mb-3">
 {t("transfers.counterOffer")}
 </h3>
 <div className="flex items-center gap-3 mb-4">
 <Badge
 variant={positionBadgeVariant(counterTarget.player.position)}
 size="sm"
 >
 {translatePositionAbbreviation(t, counterTarget.player.position)}
 </Badge>
 <div>
 <p className="font-semibold text-sm text-ink">
 {counterTarget.player.full_name}
 </p>
 <p className="text-xs text-ink-faint">
 {getTeamName(teams, counterTarget.fromTeamId)} •
 {t("transfers.currentOffer", {
 fee: formatVal(counterTarget.fee),
 })}
 </p>
 </div>
 </div>
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
 {counterFeedback ? (
 <p className="text-xs text-ink-dim mb-3">
 {t("transfers.resumeNegotiationHint")}
 </p>
 ) : null}
 <label
 htmlFor="counter-offer-amount"
 className="text-xs font-heading font-bold uppercase tracking-wider text-ink-dim mb-1 block"
 >
 {t("transfers.counterAmount")}
 </label>
 <input
 id="counter-offer-amount"
 type="text"
 inputMode="numeric"
 pattern="[0-9]*"
 value={counterAmount}
 onChange={(event) => onCounterAmountChange(event.target.value)}
 className="w-full px-3 py-2 rounded bg-carbon-2 border border-slate-line text-sm text-ink mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
 />
 {parsedCounterAmount !== null ? (
 <p className="text-xs text-ink-dim mb-3">
 {formatExactMoney(parsedCounterAmount)}
 </p>
 ) : null}
 <NegotiationFeedbackPanel
 feedback={counterFeedback}
 titleKey="transfers.negotiationPulse"
 roundKey="transfers.negotiationRound"
 patienceKey="transfers.negotiationPatience"
 tensionKey="transfers.negotiationTension"
 className="mb-3"
 />
 <TransferNegotiationHistory offer={activeCounterOffer} mode="incoming" />
 {counterResult ? (
 <div
 className={`text-xs font-heading font-bold uppercase tracking-wider mb-3 ${counterResult === "accepted" ? "text-success-500" : counterResult === "rejected" ? "text-danger-500" : "text-accent-500"}`}
 >
 {counterResult === "accepted"
 ? t("transfers.counterAccepted")
 : counterResult === "rejected"
 ? t("transfers.counterRejected")
 : t("transfers.counterCountered")}
 </div>
 ) : null}
 {counterError ? (
 <div className="text-xs font-heading font-bold uppercase tracking-wider mb-3 text-danger-500">
 {counterError}
 </div>
 ) : null}
 <div className="flex gap-2">
 <button
 onClick={onSubmit}
 disabled={
 submitDisabled || counterLoading || counterResult === "accepted"
 }
 className="flex-1 py-2 bg-primary-700 hover:bg-primary-800 text-ink rounded font-heading font-bold text-sm uppercase tracking-wider transition-colors disabled:opacity-50"
 >
 {counterLoading
 ? t("transfers.submitting")
 : t("transfers.submitCounter")}
 </button>
 <button
 onClick={onClose}
 className="px-4 py-2 bg-carbon-3 text-ink-dim rounded font-heading font-bold text-sm uppercase tracking-wider hover:bg-carbon-3 hover:bg-carbon-3 transition-colors"
 >
 {t("transfers.close")}
 </button>
 </div>
 </div>
 </div>
 );
}
