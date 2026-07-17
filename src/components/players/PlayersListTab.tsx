import { useCallback, useEffect, useState } from "react";
import { GameStateData, PlayerSelectionOptions } from "../../store/gameStore";
import { getErrorMessage, resolveTranslatedErrorMessage } from "../../utils/errorMessage";
import { Card, CardBody, Badge, Select, CountryFlag, PlayerAvatar } from "../ui";
import ContextMenu from "../ContextMenu";
import {
 Search,
 Filter,
 ArrowUpDown,
 ChevronLeft,
 ChevronRight,
 ChevronsLeft,
 ChevronsRight,
} from "lucide-react";
import { calcAge, formatVal } from "../../lib/helpers";
import { positionBadgeVariant } from "../../lib/helpers";
import { useTranslation } from "react-i18next";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import { buildAlreadyScoutingIds } from "../scouting/ScoutingTab.model";
import { calculateAvailableScouts } from "../scouting/ScoutingTab.helpers";
import { sendScout } from "../../services/scoutingService";
import {
 toggleLoanList,
 toggleTransferList,
} from "../../services/transfersService";
import {
 fetchPlayersPage,
 type PlayerSortKey,
 type PlayersPage,
 type PlayersPageQuery,
} from "../../services/playersService";
import {
 buildDividerMenuItem,
 buildOfferFreeAgentContractMenuItem,
 buildMakeTransferBidMenuItem,
 buildScoutPlayerMenuItem,
 buildToggleLoanListMenuItem,
 buildToggleTransferListMenuItem,
 buildViewProfileMenuItem,
 buildViewTeamMenuItem,
} from "../playerActions/playerContextMenuItems";
import FreeAgentContractModal from "../transfers/FreeAgentContractModal";
import TransferBidModal from "../transfers/TransferBidModal";
import { useFreeAgentContractFlow } from "../transfers/useFreeAgentContractFlow";
import { useTransferBidFlow } from "../transfers/useTransferBidFlow";
import { shortOvrLabel, interpretOvr } from "../../lib/ovrInterpretation";

interface PlayersListTabProps {
 gameState: GameStateData;
 onGameUpdate?: (game: GameStateData) => void;
 onSelectPlayer: (id: string, options?: PlayerSelectionOptions) => void;
 onSelectTeam: (id: string) => void;
}

const PAGE_SIZE = 30;

const DEFAULT_QUERY: PlayersPageQuery = {
 search: null,
 position: null,
 team_id: null,
 status: "all",
 sort_key: "ovr",
 sort_asc: false,
 page: 1,
 page_size: PAGE_SIZE,
};

export default function PlayersListTab({
 gameState,
 onGameUpdate,
 onSelectPlayer,
 onSelectTeam,
}: PlayersListTabProps) {
 const { t } = useTranslation();
 const [query, setQuery] = useState<PlayersPageQuery>(DEFAULT_QUERY);
 const [slice, setSlice] = useState<PlayersPage | null>(null);
 const [refetchKey, setRefetchKey] = useState(0);
 const [fetchError, setFetchError] = useState<string | null>(null);
 const [sendingPlayerId, setSendingPlayerId] = useState<string | null>(null);
 const [scoutError, setScoutError] = useState<string | null>(null);
 const managerTeamId = gameState.manager.team_id ?? "";

 const patchQuery = useCallback((patch: Partial<PlayersPageQuery>) => {
 setQuery((q) => {
 const resetPage = !("page" in patch);
 return { ...q, ...patch, ...(resetPage ? { page: 1 } : {}) };
 });
 }, []);

 const refetchSlice = useCallback(() => setRefetchKey((k) => k + 1), []);

 const handleGameUpdate = useCallback(
 (game: GameStateData) => {
 onGameUpdate?.(game);
 refetchSlice();
 },
 [onGameUpdate, refetchSlice],
 );

 useEffect(() => {
 let cancelled = false;
 fetchPlayersPage(query)
 .then((result) => {
 if (cancelled) return;
 setSlice(result);
 setFetchError(null);
 })
 .catch((error) => {
 if (cancelled) return;
 setFetchError(resolveTranslatedErrorMessage(getErrorMessage(error), t));
 });
 return () => {
 cancelled = true;
 };
 }, [query, refetchKey, t]);

 const findFullPlayer = useCallback(
 (id: string) => gameState.players.find((p) => p.id === id),
 [gameState.players],
 );
 const {
 bidTarget,
 bidAmount,
 setBidAmount,
 bidResult,
 bidLoading,
 bidFeedback,
 bidProjection,
 bidFee,
 activeBidOffer,
 myTeam,
 hasExistingOffer,
 bidSubmitDisabled,
 openBidNegotiation,
 closeBidNegotiation,
 handleMakeBid,
 } = useTransferBidFlow({
 gameState,
 onGameUpdate: handleGameUpdate,
 });
 const {
 freeAgentTarget,
 contractWage,
 setContractWage,
 contractLength,
 setContractLength,
 contractFeedback,
 contractProjection,
 contractSubmitting,
 contractSubmitDisabled,
 contractStatusMessage,
 contractStatusClassName,
 openFreeAgentContract,
 closeFreeAgentContract,
 submitFreeAgentContract,
 } = useFreeAgentContractFlow({
 gameState,
 onGameUpdate: handleGameUpdate,
 });
 const scouts = gameState.staff.filter(
 (staffMember) =>
 staffMember.role === "Scout" && staffMember.team_id === managerTeamId,
 );
 const scoutingAssignments = gameState.scouting_assignments || [];
 const allScoutingAssignments = [
 ...scoutingAssignments,
 ...(gameState.youth_scouting_assignments || []),
 ];
 const availableScouts = calculateAvailableScouts(scouts, allScoutingAssignments);
 const alreadyScoutingIds = buildAlreadyScoutingIds(scoutingAssignments);

 const handleScoutPlayer = async (playerId: string): Promise<void> => {
 if (availableScouts.length === 0) {
 setScoutError(null);
 return;
 }

 const scout = availableScouts[0];
 setScoutError(null);
 setSendingPlayerId(playerId);

 try {
 const updated = await sendScout(scout.id, playerId);
 setScoutError(null);
 handleGameUpdate(updated);
 } catch (error) {
 console.error("Failed to send scout:", error);
 setScoutError(resolveTranslatedErrorMessage(getErrorMessage(error), t));
 } finally {
 setSendingPlayerId(null);
 }
 };

 const handleSort = (key: PlayerSortKey) => {
 if (query.sort_key === key) {
 patchQuery({ sort_asc: !query.sort_asc });
 } else {
 patchQuery({ sort_key: key, sort_asc: key === "name" });
 }
 };

 const items = slice?.items ?? [];
 const total = slice?.total ?? 0;
 const page = query.page;
 const pageSize = slice?.page_size ?? query.page_size;
 const totalPages = Math.max(1, Math.ceil(total / pageSize));
 const positions = ["Goalkeeper", "Defender", "Midfielder", "Forward"];

 return (
 <div className="gaffer-card-texture">
 {/* Filters */}
 <div className="flex flex-wrap gap-3 mb-4 items-center">
 <div className="relative flex-1 min-w-[200px] max-w-sm">
 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
 <input
 type="text"
 placeholder={t("players.searchPlaceholder")}
 value={query.search ?? ""}
 onChange={(e) => patchQuery({ search: e.target.value || null })}
 className="w-full pl-9 pr-3 py-2 rounded bg-white bg-carbon-1 border border-slate-line text-sm text-ink text-ink placeholder-ink-faint placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-primary-500/50"
 />
 </div>

 <div className="flex gap-1.5">
 <button
 onClick={() => patchQuery({ position: null })}
 className={`px-3 py-1.5 rounded text-xs font-heading font-bold uppercase tracking-wider transition-all ${!query.position
 ? "bg-primary-500 text-white shadow-sm"
 : "bg-white bg-carbon-1 text-ink-dim border border-slate-line"
 }`}
 >
 {t("players.allPos")}
 </button>
 {positions.map((pos) => (
 <button
 key={pos}
 onClick={() =>
 patchQuery({ position: query.position === pos ? null : pos })
 }
 className={`px-3 py-1.5 rounded text-xs font-heading font-bold uppercase tracking-wider transition-all ${query.position === pos
 ? "bg-primary-500 text-white shadow-sm"
 : "bg-white bg-carbon-1 text-ink-dim border border-slate-line"
 }`}
 >
 {t(`common.posAbbr.${pos}`)}
 </button>
 ))}
 </div>

 <div className="flex gap-1.5">
 <button
 onClick={() => patchQuery({ status: "all" })}
 className={`px-3 py-1.5 rounded text-xs font-heading font-bold uppercase tracking-wider transition-all ${query.status === "all" ? "bg-primary-500 text-white shadow-sm" : "bg-white bg-carbon-1 text-ink-dim border border-slate-line"}`}
 >
 {t("common.all")}
 </button>
 <button
 onClick={() => patchQuery({ status: "transfer" })}
 className={`px-3 py-1.5 rounded text-xs font-heading font-bold uppercase tracking-wider transition-all ${query.status === "transfer" ? "bg-accent-500 text-white shadow-sm" : "bg-white bg-carbon-1 text-ink-dim border border-slate-line"}`}
 >
 {t("transfers.transfer")}
 </button>
 <button
 onClick={() => patchQuery({ status: "loan" })}
 className={`px-3 py-1.5 rounded text-xs font-heading font-bold uppercase tracking-wider transition-all ${query.status === "loan" ? "bg-primary-500 text-white shadow-sm" : "bg-white bg-carbon-1 text-ink-dim border border-slate-line"}`}
 >
 {t("transfers.loan")}
 </button>
 </div>

 <Select
 value={query.team_id ?? ""}
 onChange={(e) => patchQuery({ team_id: e.target.value || null })}
 selectSize="sm"
 className="min-w-44 font-heading font-bold uppercase tracking-wider"
 >
 <option value="">{t("players.allTeams")}</option>
 {gameState.teams.map((tm) => (
 <option key={tm.id} value={tm.id}>
 {tm.name}
 </option>
 ))}
 </Select>
 </div>

 <p className="text-xs text-ink-faint mb-3 font-heading uppercase tracking-wider">
 <Filter className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
 {t("players.nPlayersFound", { count: total })}
 </p>

 {fetchError ? (
 <p
 role="alert"
 className="mb-3 text-xs font-heading font-bold uppercase tracking-wider text-danger-500"
 >
 {fetchError}
 </p>
 ) : null}

 {scoutError ? (
 <p
 role="alert"
 className="mb-3 text-xs font-heading font-bold uppercase tracking-wider text-danger-500"
 >
 {scoutError}
 </p>
 ) : null}

 {/* Players table */}
 <Card>
 <CardBody className="p-0">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-carbon-2 border-b border-slate-line text-xs">
 <SortHeader
 label={t("common.position")}
 sortKey="position"
 current={query.sort_key}
 asc={query.sort_asc}
 onClick={handleSort}
 />
 <SortHeader
 label={t("common.name")}
 sortKey="name"
 current={query.sort_key}
 asc={query.sort_asc}
 onClick={handleSort}
 />
 <SortHeader
 label={t("common.age")}
 sortKey="age"
 current={query.sort_key}
 asc={query.sort_asc}
 onClick={handleSort}
 />
 <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("common.nationality")}
 </th>
 <SortHeader
 label={t("common.team")}
 sortKey="team"
 current={query.sort_key}
 asc={query.sort_asc}
 onClick={handleSort}
 />
 <SortHeader
 label={t("common.value")}
 sortKey="value"
 current={query.sort_key}
 asc={query.sort_asc}
 onClick={handleSort}
 />
 <SortHeader
 label={t("common.ovr")}
 sortKey="ovr"
 current={query.sort_key}
 asc={query.sort_asc}
 onClick={handleSort}
 />
 <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("common.status")}
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-line-soft dark:divide-slate-line">
 {items.map((summary) => {
 const age = calcAge(summary.date_of_birth);
 const scoutState = alreadyScoutingIds.has(summary.id)
 ? "already-assigned"
 : sendingPlayerId === summary.id
 ? "busy"
 : availableScouts.length === 0
 ? "unavailable"
 : "ready";
 const contextItems = [
 buildViewProfileMenuItem(t, () => onSelectPlayer(summary.id)),
 ...(summary.team_id
 ? [
 buildViewTeamMenuItem(t, () => {
 onSelectTeam(summary.team_id!);
 }),
 ]
 : []),
 ];

 if (summary.team_id === managerTeamId) {
 contextItems.push(buildDividerMenuItem());
 contextItems.push(
 buildToggleTransferListMenuItem(
 t,
 summary.transfer_listed,
 async () => {
 try {
 const updated = await toggleTransferList(summary.id);
 handleGameUpdate(updated);
 } catch {
 return;
 }
 },
 ),
 );
 contextItems.push(
 buildToggleLoanListMenuItem(t, summary.loan_listed, async () => {
 try {
 const updated = await toggleLoanList(summary.id);
 handleGameUpdate(updated);
 } catch {
 return;
 }
 }),
 );
 } else {
 const playerActions = summary.team_id
 ? [
 buildMakeTransferBidMenuItem(t, () => {
 const full = findFullPlayer(summary.id);
 if (full) openBidNegotiation(full);
 }),
 buildScoutPlayerMenuItem(t, scoutState, () => {
 void handleScoutPlayer(summary.id);
 }),
 ]
 : summary.retired
 ? []
 : [
 buildOfferFreeAgentContractMenuItem(t, () => {
 const full = findFullPlayer(summary.id);
 if (full) openFreeAgentContract(full);
 }),
 buildScoutPlayerMenuItem(t, scoutState, () => {
 void handleScoutPlayer(summary.id);
 }),
 ];

 if (playerActions.length > 0) {
 contextItems.push(buildDividerMenuItem());
 contextItems.push(...playerActions);
 }
 }

 const ovr = summary.ovr;
 const row = (
 <tr
 key={summary.id}
 onClick={() => onSelectPlayer(summary.id)}
 className="hover:bg-carbon-2 hover:bg-carbon-3/50 transition-colors cursor-pointer group"
 >
 <td className="py-2.5 px-4">
 <Badge
 variant={positionBadgeVariant(
 summary.natural_position || summary.position,
 )}
 size="sm"
 >
 {translatePositionAbbreviation(
 t,
 summary.natural_position || summary.position,
 )}
 </Badge>
 </td>
 <td className="py-2.5 px-4">
 <div className="flex items-center gap-3">
 <PlayerAvatar player={summary} />
 <span className="font-semibold text-sm text-ink text-ink group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
 {summary.full_name}
 </span>
 </div>
 </td>
 <td className="py-2.5 px-4 text-sm text-ink-dim tabular-nums">
 {age}
 </td>
 <td
 className="py-2.5 px-4 text-sm text-ink-dim"
 title={summary.nationality}
 >
 <CountryFlag
 code={summary.nationality}
 className="text-lg leading-none"
 />
 </td>
 <td className="py-2.5 px-4">
 {summary.team_id ? (
 <button
 onClick={(e) => {
 e.stopPropagation();
 onSelectTeam(summary.team_id!);
 }}
 className="text-sm text-ink-dim hover:text-primary-500 hover:underline transition-colors"
 >
 {summary.team_name ?? ""}
 </button>
 ) : (
 <span className="text-sm text-ink-dim">
 {t("common.freeAgent")}
 </span>
 )}
 </td>
 <td className="py-2.5 px-4 text-sm text-ink-dim font-medium">
 {formatVal(summary.market_value)}
 </td>
 <td className="py-2.5 px-4">
 <span
 className={`font-heading font-bold text-xs ${interpretOvr(ovr, summary.natural_position || summary.position).colorClass}`}
 title={interpretOvr(ovr, summary.natural_position || summary.position).description}
 >
 {shortOvrLabel(ovr, summary.natural_position || summary.position)}
 </span>
 </td>
 <td className="py-2.5 px-4">
 {summary.transfer_listed && (
 <Badge variant="accent" size="sm">
 {t("transfers.transfer")}
 </Badge>
 )}
 {summary.loan_listed && (
 <Badge variant="primary" size="sm">
 {t("transfers.loan")}
 </Badge>
 )}
 {summary.injured && (
 <Badge variant="danger" size="sm">
 {t("common.injured")}
 </Badge>
 )}
 </td>
 </tr>
 );

 return (
 <ContextMenu items={contextItems} key={summary.id}>
 {row}
 </ContextMenu>
 );
 })}
 </tbody>
 </table>
 {total === 0 && (
 <div className="p-8 text-center text-ink-dim text-sm">
 {t("players.noMatch")}
 </div>
 )}
 </div>
 {totalPages > 1 && (
 <div className="flex items-center justify-between px-4 py-3 border-t border-slate-line-soft">
 <p className="text-xs text-ink-faint font-heading">
 {t("players.showingRange", {
 from: (page - 1) * pageSize + 1,
 to: Math.min(page * pageSize, total),
 total,
 })}
 </p>
 <div className="flex items-center gap-1">
 <button
 onClick={() => patchQuery({ page: 1 })}
 disabled={page === 1}
 className="p-1.5 rounded text-ink-faint hover:text-ink hover:text-ink hover:bg-carbon-2 hover:bg-carbon-3 disabled:opacity-30 disabled:pointer-events-none transition-colors"
 >
 <ChevronsLeft className="w-4 h-4" />
 </button>
 <button
 onClick={() => patchQuery({ page: Math.max(1, page - 1) })}
 disabled={page === 1}
 className="p-1.5 rounded text-ink-faint hover:text-ink hover:text-ink hover:bg-carbon-2 hover:bg-carbon-3 disabled:opacity-30 disabled:pointer-events-none transition-colors"
 >
 <ChevronLeft className="w-4 h-4" />
 </button>
 <span className="px-3 py-1 text-xs font-heading font-bold text-ink-dim">
 {page} / {totalPages}
 </span>
 <button
 onClick={() => patchQuery({ page: Math.min(totalPages, page + 1) })}
 disabled={page === totalPages}
 className="p-1.5 rounded text-ink-faint hover:text-ink hover:text-ink hover:bg-carbon-2 hover:bg-carbon-3 disabled:opacity-30 disabled:pointer-events-none transition-colors"
 >
 <ChevronRight className="w-4 h-4" />
 </button>
 <button
 onClick={() => patchQuery({ page: totalPages })}
 disabled={page === totalPages}
 className="p-1.5 rounded text-ink-faint hover:text-ink hover:text-ink hover:bg-carbon-2 hover:bg-carbon-3 disabled:opacity-30 disabled:pointer-events-none transition-colors"
 >
 <ChevronsRight className="w-4 h-4" />
 </button>
 </div>
 </div>
 )}
 </CardBody>
 </Card>
 {bidTarget && (
 <TransferBidModal
 bidTarget={bidTarget}
 teams={gameState.teams}
 bidAmount={bidAmount}
 onBidAmountChange={setBidAmount}
 myTeam={myTeam}
 bidFee={bidFee}
 bidProjection={bidProjection}
 bidFeedback={bidFeedback}
 activeBidOffer={activeBidOffer}
 hasExistingOffer={hasExistingOffer}
 bidResult={bidResult}
 bidLoading={bidLoading}
 bidSubmitDisabled={bidSubmitDisabled}
 onSubmit={handleMakeBid}
 onClose={closeBidNegotiation}
 />
 )}
 {freeAgentTarget && (
 <FreeAgentContractModal
 player={freeAgentTarget}
 teams={gameState.teams}
 wage={contractWage}
 onWageChange={setContractWage}
 contractLength={contractLength}
 onContractLengthChange={setContractLength}
 projection={contractProjection}
 feedback={contractFeedback}
 statusMessage={contractStatusMessage(t)}
 statusClassName={contractStatusClassName}
 submitting={contractSubmitting}
 submitDisabled={contractSubmitDisabled}
 onSubmit={submitFreeAgentContract}
 onClose={closeFreeAgentContract}
 />
 )}
 </div>
 );
}

function SortHeader({
 label,
 sortKey,
 current,
 onClick,
}: {
 label: string;
 sortKey: PlayerSortKey;
 current: PlayerSortKey;
 asc: boolean;
 onClick: (k: PlayerSortKey) => void;
}) {
 const isActive = current === sortKey;
 return (
 <th
 onClick={() => onClick(sortKey)}
 className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-ink-dim cursor-pointer hover:text-ink hover:text-ink transition-colors select-none"
 >
 <span className="flex items-center gap-1">
 {label}
 <ArrowUpDown
 className={`w-3 h-3 ${isActive ? "text-primary-500" : "text-ink-faint dark:text-navy-600"}`}
 />
 </span>
 </th>
 );
}
