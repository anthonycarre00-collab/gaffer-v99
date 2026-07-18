import {
 ArrowUp,
 Ban,
 Building2,
 Gavel,
 GraduationCap,
 Repeat,
 ScanSearch,
 ShoppingCart,
 User,
 UserPlus,
 XCircle,
} from "lucide-react";

import type { ContextMenuItem } from "../ContextMenu";

type MenuTranslateFn = (
 key: string,
 options?: Record<string, string | number>,
) => string;

export type ScoutMenuState =
 | "ready"
 | "busy"
 | "already-assigned"
 | "unavailable";

export function buildDividerMenuItem(): ContextMenuItem {
 return {
 label: "",
 icon: undefined,
 onClick: () => { },
 divider: true,
 };
}

export function buildViewProfileMenuItem(
 t: MenuTranslateFn,
 onClick: () => void,
): ContextMenuItem {
 return {
 label: t("squad.viewProfile"),
 icon: <User className="w-4 h-4" />,
 onClick,
 };
}

export function buildViewTeamMenuItem(
 t: MenuTranslateFn,
 onClick: () => void,
): ContextMenuItem {
 return {
 label: t("common.viewTeam"),
 icon: <Building2 className="w-4 h-4" />,
 onClick,
 };
}

export function buildToggleTransferListMenuItem(
 t: MenuTranslateFn,
 transferListed: boolean,
 onClick: () => void,
): ContextMenuItem {
 return {
 label: transferListed
 ? t("squad.removeFromTransferList")
 : t("squad.addToTransferList"),
 icon: <ShoppingCart className="w-4 h-4" />,
 onClick,
 };
}

export function buildToggleLoanListMenuItem(
 t: MenuTranslateFn,
 loanListed: boolean,
 onClick: () => void,
): ContextMenuItem {
 return {
 label: loanListed
 ? t("squad.removeFromLoanList")
 : t("squad.addToLoanList"),
 icon: <Repeat className="w-4 h-4" />,
 onClick,
 };
}

/**
 * V100 P0-8 (Issue #5): Toggle "not for sale" status. When set, AI clubs will
 * not bid for the player. Distinct from transfer-listed (which means the user
 * WANTS to sell) — not-for-sale means the user refuses all bids.
 */
export function buildToggleNotForSaleMenuItem(
 t: MenuTranslateFn,
 notForSale: boolean,
 onClick: () => void,
): ContextMenuItem {
 return {
 label: notForSale
 ? t("squad.removeFromNotForSale")
 : t("squad.markAsNotForSale"),
 icon: <Ban className="w-4 h-4" />,
 onClick,
 };
}

/**
 * V100 P0-8 (Issue #5): Reject all pending transfer offers for this player
 * in one batch. Only enabled when there are pending offers.
 */
export function buildRejectAllPendingOffersMenuItem(
 t: MenuTranslateFn,
 pendingOfferCount: number,
 onClick: () => void,
): ContextMenuItem {
 return {
 label: t("squad.rejectAllBids", { count: pendingOfferCount }),
 icon: <XCircle className="w-4 h-4" />,
 disabled: pendingOfferCount === 0,
 onClick,
 };
}

export function buildScoutPlayerMenuItem(
 t: MenuTranslateFn,
 state: ScoutMenuState,
 onClick: () => void,
): ContextMenuItem {
 return {
 label:
 state === "already-assigned"
 ? t("scouting.scoutingInProgress")
 : state === "unavailable"
 ? t("scouting.noScoutsFree")
 : t("scouting.scoutBtn"),
 icon: <ScanSearch className="w-4 h-4" />,
 disabled: state !== "ready",
 onClick,
 };
}

export function buildMakeTransferBidMenuItem(
 t: MenuTranslateFn,
 onClick: () => void,
): ContextMenuItem {
 return {
 label: t("transfers.makeBid"),
 icon: <Gavel className="w-4 h-4" />,
 onClick,
 };
}

export function buildOfferFreeAgentContractMenuItem(
 t: MenuTranslateFn,
 onClick: () => void,
): ContextMenuItem {
 return {
 label: t("transfers.offerContract"),
 icon: <UserPlus className="w-4 h-4" />,
 onClick,
 };
}

export function buildDelegateToYouthAcademyMenuItem(
 t: MenuTranslateFn,
 onClick: () => void,
): ContextMenuItem {
 return {
 label: t("youthAcademy.delegateToYouthAcademy"),
 icon: <GraduationCap className="w-4 h-4" />,
 onClick,
 };
}

export function buildPromoteToSeniorSquadMenuItem(
 t: MenuTranslateFn,
 onClick: () => void,
): ContextMenuItem {
 return {
 label: t("youthAcademy.promoteToSeniorSquad"),
 icon: <ArrowUp className="w-4 h-4" />,
 onClick,
 };
}
