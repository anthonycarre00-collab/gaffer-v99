import { useTranslation } from "react-i18next";

import type { TransferOfferData } from "../../store/gameStore";
import { formatVal } from "../../lib/helpers";

interface TransferNegotiationHistoryProps {
 offer: TransferOfferData | null;
 mode: "outgoing" | "incoming";
}

export default function TransferNegotiationHistory({
 offer,
 mode,
}: TransferNegotiationHistoryProps) {
 const { t } = useTranslation();

 if (!offer || offer.negotiation_round < 2) {
 return null;
 }

 const managerLabel =
 mode === "outgoing"
 ? t("transfers.lastBidLabel")
 : t("transfers.lastCounterLabel");
 const clubLabel =
 mode === "outgoing"
 ? t("transfers.lastClubSignalLabel")
 : t("transfers.currentOfferLabel");
 const managerFee = offer.last_manager_fee;
 const clubFee = offer.suggested_counter_fee ?? offer.fee;

 return (
 <div className="rounded border border-slate-line bg-white/70 bg-carbon-0/40 p-3 mb-3 space-y-2">
 <p className="text-[11px] font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("transfers.negotiationHistory")}
 </p>
 {managerFee !== null && managerFee !== undefined ? (
 <div className="flex items-center justify-between gap-3 text-xs text-ink-dim">
 <span>{managerLabel}</span>
 <span className="font-semibold tabular-nums text-ink">
 {formatVal(managerFee)}
 </span>
 </div>
 ) : null}
 <div className="flex items-center justify-between gap-3 text-xs text-ink-dim">
 <span>{clubLabel}</span>
 <span className="font-semibold tabular-nums text-ink">
 {formatVal(clubFee)}
 </span>
 </div>
 </div>
 );
}