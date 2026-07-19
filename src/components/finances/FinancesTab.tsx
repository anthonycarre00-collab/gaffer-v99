import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FinanceCashFlowChart } from "./FinanceCashFlowChart";
import {
 GameStateData,
 MessageAction,
 MessageData,
 PlayerSelectionOptions,
} from "../../store/gameStore";
import { Card, CardHeader, CardBody, Badge, ProgressBar, Button, Checkbox } from "../ui";
import { useSortableTable, SortableHeader } from "../ui/SortableTable";
import { User } from "lucide-react";
import {
 formatExactMoney,
 formatVal,
 formatWeeklyAmount,
 getContractRiskBadgeVariant,
 getContractRiskLevel,
 getContractYearsRemaining,
 positionBadgeVariant,
} from "../../lib/helpers";
import {
 annualAmountToWeeklyCommitment,
 getTeamFinanceSnapshot,
} from "../../lib/finance";
import {
 getFinanceSnapshot,
 type FinanceSnapshotData,
 type TeamFinanceSnapshotData,
} from "../../services/financeService";
import { useTranslation } from "react-i18next";
import ContextMenu from "../ContextMenu";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import { resolveBackendError, resolveMessage } from "../../utils/backendI18n";

type FacilityId = "Training" | "Medical" | "Scouting";

interface FacilityUpgradeErrorState {
 facilityId: FacilityId;
 message: string;
}

interface FacilityDefinition {
 effectKey: string;
 id: FacilityId;
 levelKey: "training" | "medical" | "scouting";
 titleKey: string;
}

const DEFAULT_FACILITIES = {
 training: 1,
 medical: 1,
 scouting: 1,
};

const FACILITY_DEFINITIONS: FacilityDefinition[] = [
 {
 id: "Training",
 levelKey: "training",
 titleKey: "finances.facilityTraining",
 effectKey: "finances.facilityTrainingEffect",
 },
 {
 id: "Medical",
 levelKey: "medical",
 titleKey: "finances.facilityMedical",
 effectKey: "finances.facilityMedicalEffect",
 },
 {
 id: "Scouting",
 levelKey: "scouting",
 titleKey: "finances.facilityScouting",
 effectKey: "finances.facilityScoutingEffect",
 },
];

function getFacilityUpgradeCost(level: number): number {
 return level * 250_000;
}

function formatSignedAmount(value: number): string {
 const formatted = formatVal(Math.abs(value));
 return value < 0 ? `-${formatted}` : formatted;
}

function facilityUpgradeBlockReason(
 snapshot: TeamFinanceSnapshotData,
): string | null {
 if (snapshot.currentlyOverBudget) {
 return "be.error.finance.facilityUpgradeOverBudget";
 }

 if (
 snapshot.overallStatus === "warning" ||
 snapshot.overallStatus === "critical"
 ) {
 return "be.error.finance.facilityUpgradeCritical";
 }

 return null;
}

function boardSupportAvailable(snapshot: TeamFinanceSnapshotData): boolean {
 return (
 snapshot.currentlyInDebt ||
 snapshot.runwayStatus === "warning" ||
 snapshot.runwayStatus === "critical"
 );
}

function sponsorPitchAvailable(snapshot: TeamFinanceSnapshotData): boolean {
 return (
 snapshot.currentlyOverBudget ||
 snapshot.currentlyInDebt ||
 snapshot.wageBudgetStatus === "warning" ||
 snapshot.wageBudgetStatus === "critical" ||
 snapshot.runwayStatus === "warning" ||
 snapshot.runwayStatus === "critical"
 );
}

function marketingCampaignAvailable(snapshot: TeamFinanceSnapshotData): boolean {
 return sponsorPitchAvailable(snapshot);
}

function mapLocalFinanceSnapshot(
 team: GameStateData["teams"][number],
 snapshot: ReturnType<typeof getTeamFinanceSnapshot>,
): TeamFinanceSnapshotData {
 return {
 annualWageBill: snapshot.annualWageBill,
 weeklyWageSpend: snapshot.weeklyWageSpend,
 weeklyWageBudget: snapshot.weeklyWageBudget,
 weeklyRecurringIncome: snapshot.weeklySponsorIncome,
 weeklySponsorIncome: snapshot.weeklySponsorIncome,
 projectedWeeklyNet: snapshot.projectedWeeklyNet,
 cashRunwayWeeks: snapshot.cashRunwayWeeks,
 wageBudgetUsagePercent: snapshot.wageBudgetUsagePercent,
 currentlyInDebt: team.finance < 0,
 currentlyOverBudget: snapshot.annualWageBill > team.wage_budget,
 wageBudgetStatus: snapshot.wageBudgetStatus,
 runwayStatus: snapshot.runwayStatus,
 overallStatus: snapshot.overallStatus,
 marketingCampaignCooldownDaysRemaining:
 snapshot.marketingCampaignCooldownDaysRemaining,
 };
}

interface ResolveMessageActionResult {
 game: GameStateData;
 effect: string | null;
 effect_i18n_key?: string | null;
 effect_i18n_params?: Record<string, string> | null;
}

interface DelegatedRenewalResponseData {
 game: GameStateData;
 report: {
 success_count: number;
 failure_count: number;
 stalled_count: number;
 };
}

interface TaggedFinanceSnapshotData {
 key: string;
 data: FinanceSnapshotData;
}

interface BoardSupportResponseData {
 game: GameStateData;
 result: {
 support_amount: number;
 transfer_budget_reduction: number;
 satisfaction_penalty: number;
 };
}

interface SponsorPitchResponseData {
 game: GameStateData;
 result: {
 message_id: string;
 sponsor_name: string;
 weekly_amount: number;
 duration_weeks: number;
 };
}

interface MarketingCampaignResponseData {
 game: GameStateData;
 result: {
 message_id: string;
 gross_revenue: number;
 campaign_cost: number;
 net_income: number;
 cooldown_days: number;
 };
}

function isChooseOptionAction(
 actionType: MessageAction["action_type"],
): actionType is {
 ChooseOption: {
 options: Array<{ id: string; label: string; description: string }>;
 };
} {
 return typeof actionType === "object" && "ChooseOption" in actionType;
}

function isPendingSponsorOffer(message: MessageData): boolean {
 return (
 message.id.startsWith("sponsor_") &&
 message.category === "Finance" &&
 message.actions.some(
 (action) => !action.resolved && isChooseOptionAction(action.action_type),
 )
 );
}

interface FinancesTabProps {
 gameState: GameStateData;
 onGameUpdate?: (state: GameStateData) => void;
 onSelectPlayer?: (id: string, options?: PlayerSelectionOptions) => void;
}

export default function FinancesTab({
 gameState,
 onGameUpdate,
 onSelectPlayer,
}: FinancesTabProps) {
 const { t } = useTranslation();
 const myTeam = gameState.teams.find(
 (tm) => tm.id === gameState.manager.team_id,
 );
 if (!myTeam)
 return (
 <p className="text-ink-dim">{t("common.noTeam")}</p>
 );
 const weeklySuffix = t("finances.perWeekSuffix");
 const [actionLoading, setActionLoading] = useState<string | null>(null);
 const [delegatedRenewalsSummary, setDelegatedRenewalsSummary] = useState<
 string | null
 >(null);
 const [selectedRiskPlayerIds, setSelectedRiskPlayerIds] = useState<string[]>(
 [],
 );
 const [remoteFinanceData, setRemoteFinanceData] =
 useState<TaggedFinanceSnapshotData | null>(null);
 const [facilityUpgradeError, setFacilityUpgradeError] =
 useState<FacilityUpgradeErrorState | null>(null);
 const [boardSupportFeedback, setBoardSupportFeedback] = useState<{
 tone: "success" | "error";
 text: string;
 } | null>(null);
 const [sponsorPitchFeedback, setSponsorPitchFeedback] = useState<{
 tone: "success" | "error";
 text: string;
 } | null>(null);
 const [marketingCampaignFeedback, setMarketingCampaignFeedback] = useState<{
 tone: "success" | "error";
 text: string;
 } | null>(null);

 // V100 P2 (Issue #36): Talk to Board state.
 const [talkToBoardLoading, setTalkToBoardLoading] = useState(false);
 const [talkToBoardResult, setTalkToBoardResult] = useState<{
 approved: boolean;
 board_reply: string;
 amount_granted: number;
 } | null>(null);

 const roster = gameState.players.filter((p) => p.team_id === myTeam.id);

 // Sortable payroll table — show top earners, but allow sorting by any column.
 const payrollRows = roster.map((p) => ({
 id: p.id,
 name: p.full_name || p.match_name,
 position: p.position,
 wage: p.wage,
 marketValue: p.market_value,
 contractEnd: p.contract_end ?? "",
 }));
 const {
 sortKey: payrollSortKey,
 sortDir: payrollSortDir,
 toggleSort: togglePayrollSort,
 sortedRows: sortedPayrollRows,
 } = useSortableTable(payrollRows, { initialKey: "wage", initialDir: "desc" });
 const topPayrollRows = sortedPayrollRows.slice(0, 10);
 const financePlayers = gameState.players.filter(
 (player) =>
 player.team_id === myTeam.id ||
 player.active_loan?.parent_team_id === myTeam.id ||
 player.active_loan?.loan_team_id === myTeam.id,
 );
 const teamStaff = gameState.staff.filter(
 (staffMember) => staffMember.team_id === myTeam.id,
 );
 const financeSnapshotKey = [
 myTeam.id,
 gameState.clock.current_date,
 myTeam.finance,
 myTeam.wage_budget,
 myTeam.transfer_budget,
 myTeam.season_income,
 myTeam.season_expenses,
 myTeam.facilities?.training ?? DEFAULT_FACILITIES.training,
 myTeam.facilities?.medical ?? DEFAULT_FACILITIES.medical,
 myTeam.facilities?.scouting ?? DEFAULT_FACILITIES.scouting,
 myTeam.sponsorship?.sponsor_name ?? "",
 myTeam.sponsorship?.base_value ?? 0,
 myTeam.sponsorship?.remaining_weeks ?? 0,
 financePlayers
 .map(
 (player) =>
 [
 player.id,
 player.team_id ?? "",
 player.wage,
 player.contract_end ?? "",
 player.active_loan?.parent_team_id ?? "",
 player.active_loan?.loan_team_id ?? "",
 player.active_loan?.wage_contribution_pct ?? "",
 player.active_loan?.end_date ?? "",
 ].join(":"),
 )
 .join("|"),
 teamStaff
 .map((staffMember) => `${staffMember.id}:${staffMember.wage}`)
 .join("|"),
 gameState.messages
 .filter(isPendingSponsorOffer)
 .map((message) => message.id)
 .join("|"),
 ].join("::");
 const isRemoteFinanceDataCurrent = remoteFinanceData?.key === financeSnapshotKey;
 const localFinanceSnapshot = mapLocalFinanceSnapshot(
 myTeam,
 getTeamFinanceSnapshot(
 myTeam,
 financePlayers,
 teamStaff,
 gameState.clock.current_date,
 ),
 );
 const financeSnapshot = isRemoteFinanceDataCurrent
 ? remoteFinanceData.data.snapshot
 : localFinanceSnapshot;
 const recoveryPreviews = isRemoteFinanceDataCurrent
 ? remoteFinanceData.data.previews
 : null;
 const totalWages = financeSnapshot.weeklyWageSpend;
 const totalValue = roster.reduce((s, p) => s + p.market_value, 0);
 const facilities = myTeam.facilities ?? DEFAULT_FACILITIES;
 const activeSponsorship = myTeam.sponsorship ?? null;
 const weeklySponsorIncome = financeSnapshot.weeklySponsorIncome;
 const projectedWeeklyNet = financeSnapshot.projectedWeeklyNet;
 const cashRunwayWeeks = financeSnapshot.cashRunwayWeeks;
 const wageBudgetUsagePercent = financeSnapshot.wageBudgetUsagePercent;
 const weeklyWageBudget = financeSnapshot.weeklyWageBudget;
 const sponsorOffers = gameState.messages
 .filter(isPendingSponsorOffer)
 .map(resolveMessage);
 const hasPendingSponsorOffer = sponsorOffers.length > 0;
 const hasActiveSponsor = Boolean(
 activeSponsorship && activeSponsorship.remaining_weeks > 0,
 );
 const previewsLoaded = recoveryPreviews !== null;
 const previewBoardSupportAvailable = recoveryPreviews
 ? Boolean(recoveryPreviews.boardSupport)
 : null;
 const previewSponsorPitchAvailable = recoveryPreviews
 ? Boolean(recoveryPreviews.sponsorPitch)
 : null;
 const previewMarketingCampaignAvailable = recoveryPreviews
 ? Boolean(recoveryPreviews.marketingCampaign)
 : null;
 const canRequestBoardSupport = previewsLoaded
 ? previewBoardSupportAvailable ?? false
 : boardSupportAvailable(financeSnapshot);
 const canRequestSponsorPitch =
 (previewsLoaded
 ? previewSponsorPitchAvailable ?? false
 : sponsorPitchAvailable(financeSnapshot)) &&
 !hasPendingSponsorOffer &&
 !hasActiveSponsor;
 const canRequestMarketingCampaign =
 (previewsLoaded
 ? previewMarketingCampaignAvailable ?? false
 : marketingCampaignAvailable(financeSnapshot)) &&
 financeSnapshot.marketingCampaignCooldownDaysRemaining === 0;
 const sponsorPitchDisabledReason = hasActiveSponsor
 ? t("finances.sponsorPitchActiveSponsor")
 : hasPendingSponsorOffer
 ? t("finances.sponsorPitchPendingOffer")
 : !(previewsLoaded
 ? previewSponsorPitchAvailable ?? false
 : sponsorPitchAvailable(financeSnapshot))
 ? t("finances.sponsorPitchUnavailable")
 : null;
 const marketingCampaignDisabledReason =
 financeSnapshot.marketingCampaignCooldownDaysRemaining > 0
 ? t("finances.marketingCampaignCoolingDown", {
 days: financeSnapshot.marketingCampaignCooldownDaysRemaining,
 })
 : !(previewsLoaded
 ? previewMarketingCampaignAvailable ?? false
 : marketingCampaignAvailable(financeSnapshot))
 ? t("finances.marketingCampaignUnavailable")
 : null;
 const boardSupportPreviewText = recoveryPreviews?.boardSupport
 ? t("finances.boardSupportSummary", {
 amount: formatExactMoney(recoveryPreviews.boardSupport.supportAmount),
 transferBudgetReduction: formatExactMoney(
 recoveryPreviews.boardSupport.transferBudgetReduction,
 ),
 satisfactionPenalty: recoveryPreviews.boardSupport.satisfactionPenalty,
 })
 : null;
 const sponsorPitchPreviewText = recoveryPreviews?.sponsorPitch
 ? t("finances.sponsorPitchSummary", {
 sponsor: recoveryPreviews.sponsorPitch.sponsorName,
 amount: formatExactMoney(recoveryPreviews.sponsorPitch.weeklyAmount),
 weeks: recoveryPreviews.sponsorPitch.durationWeeks,
 })
 : null;
 const marketingCampaignPreviewText = recoveryPreviews?.marketingCampaign
 ? t("finances.marketingCampaignSummary", {
 netIncome: formatExactMoney(recoveryPreviews.marketingCampaign.netIncome),
 grossRevenue: formatExactMoney(
 recoveryPreviews.marketingCampaign.grossRevenue,
 ),
 cost: formatExactMoney(recoveryPreviews.marketingCampaign.campaignCost),
 campaignCost: formatExactMoney(
 recoveryPreviews.marketingCampaign.campaignCost,
 ),
 days: recoveryPreviews.marketingCampaign.cooldownDays,
 })
 : null;
 const contractRiskPlayers = roster
 .map((player) => {
 const riskLevel = getContractRiskLevel(
 player.contract_end,
 gameState.clock.current_date,
 );

 return {
 player,
 riskLevel,
 };
 })
 .filter(
 ({ riskLevel, player }) => player.contract_end && riskLevel !== "stable",
 )
 .sort((left, right) => {
 const leftDate = left.player.contract_end ?? "9999-12-31";
 const rightDate = right.player.contract_end ?? "9999-12-31";
 return leftDate.localeCompare(rightDate);
 });
 const atRiskWages = contractRiskPlayers.reduce(
 (sum, { player }) => sum + annualAmountToWeeklyCommitment(player.wage),
 0,
 );
 const selectedRiskPlayers = contractRiskPlayers.filter(({ player }) =>
 selectedRiskPlayerIds.includes(player.id),
 );
 const allRiskPlayerIds = contractRiskPlayers.map(({ player }) => player.id);

 useEffect(() => {
 let cancelled = false;
 const requestKey = financeSnapshotKey;

 setRemoteFinanceData(null);

 void getFinanceSnapshot(myTeam.id)
 .then((financeData) => {
 if (!cancelled) {
 setRemoteFinanceData({ key: requestKey, data: financeData });
 }
 })
 .catch((error) => {
 console.error("Failed to load finance snapshot:", error);
 if (!cancelled) {
 setRemoteFinanceData(null);
 }
 });

 return () => {
 cancelled = true;
 };
 }, [financeSnapshotKey, myTeam.id]);

 useEffect(() => {
 setSelectedRiskPlayerIds((currentIds) => {
 const availableIdSet = new Set(allRiskPlayerIds);
 const nextIds = currentIds.filter((playerId) =>
 availableIdSet.has(playerId),
 );

 if (nextIds.length > 0) {
 return nextIds;
 }

 return allRiskPlayerIds;
 });
 }, [allRiskPlayerIds.join("|")]);

 function handleToggleRiskPlayer(playerId: string): void {
 setSelectedRiskPlayerIds((currentIds) => {
 if (currentIds.includes(playerId)) {
 return currentIds.filter((currentId) => currentId !== playerId);
 }

 return [...currentIds, playerId];
 });
 }

 function handleToggleAllRiskPlayers(): void {
 setSelectedRiskPlayerIds((currentIds) => {
 if (currentIds.length === allRiskPlayerIds.length) {
 return [];
 }

 return allRiskPlayerIds;
 });
 }

 async function handleUpgradeFacility(facility: FacilityId): Promise<void> {
 setFacilityUpgradeError(null);
 setActionLoading(facility);
 try {
 const updated = await invoke<GameStateData>("upgrade_facility", {
 facility,
 });
 onGameUpdate?.(updated);
 } catch (error) {
 console.error("Failed to upgrade facility:", error);
 setFacilityUpgradeError({
 facilityId: facility,
 message: resolveBackendError(error),
 });
 } finally {
 setActionLoading(null);
 }
 }

 async function handleRequestBoardSupport(): Promise<void> {
 const loadingKey = "board-support";
 setBoardSupportFeedback(null);
 setActionLoading(loadingKey);

 try {
 const response = await invoke<BoardSupportResponseData>(
 "request_board_support",
 );
 onGameUpdate?.(response.game);
 setBoardSupportFeedback({
 tone: "success",
 text: t("finances.boardSupportSummary", {
 amount: formatExactMoney(response.result.support_amount),
 transferBudgetReduction: formatExactMoney(
 response.result.transfer_budget_reduction,
 ),
 satisfactionPenalty: response.result.satisfaction_penalty,
 }),
 });
 } catch (error) {
 console.error("Failed to request board support:", error);
 setBoardSupportFeedback({
 tone: "error",
 text: resolveBackendError(error),
 });
 } finally {
 setActionLoading(null);
 }
 }

 // V100 P2 (Issue #36): Talk to Board handler.
 async function handleTalkToBoard(
 request: "requestMoreTime" | "requestTransferFunds" | "requestStadiumExpansion",
 ): Promise<void> {
 setTalkToBoardLoading(true);
 setTalkToBoardResult(null);
 try {
 const response = await invoke<{
 game: GameStateData;
 approved: boolean;
 board_reply: string;
 amount_granted: number;
 }>("talk_to_board", { request });
 onGameUpdate?.(response.game);
 setTalkToBoardResult({
 approved: response.approved,
 board_reply: response.board_reply,
 amount_granted: response.amount_granted,
 });
 } catch (error) {
 setTalkToBoardResult({
 approved: false,
 board_reply: String(error),
 amount_granted: 0,
 });
 } finally {
 setTalkToBoardLoading(false);
 }
 }

 async function handleRequestSponsorPitch(): Promise<void> {
 const loadingKey = "sponsor-pitch";
 setSponsorPitchFeedback(null);
 setActionLoading(loadingKey);

 try {
 const response = await invoke<SponsorPitchResponseData>(
 "request_sponsor_pitch",
 );
 onGameUpdate?.(response.game);
 setSponsorPitchFeedback({
 tone: "success",
 text: t("finances.sponsorPitchSummary", {
 sponsor: response.result.sponsor_name,
 amount: formatExactMoney(response.result.weekly_amount),
 weeks: response.result.duration_weeks,
 }),
 });
 } catch (error) {
 console.error("Failed to pitch sponsors:", error);
 setSponsorPitchFeedback({
 tone: "error",
 text: resolveBackendError(error),
 });
 } finally {
 setActionLoading(null);
 }
 }

 async function handleRequestMarketingCampaign(): Promise<void> {
 const loadingKey = "marketing-campaign";
 setMarketingCampaignFeedback(null);
 setActionLoading(loadingKey);

 try {
 const response = await invoke<MarketingCampaignResponseData>(
 "request_marketing_campaign",
 );
 onGameUpdate?.(response.game);
 setMarketingCampaignFeedback({
 tone: "success",
 text: t("finances.marketingCampaignSummary", {
 netIncome: formatExactMoney(response.result.net_income),
 grossRevenue: formatExactMoney(response.result.gross_revenue),
 cost: formatExactMoney(response.result.campaign_cost),
 days: response.result.cooldown_days,
 }),
 });
 } catch (error) {
 console.error("Failed to launch marketing campaign:", error);
 setMarketingCampaignFeedback({
 tone: "error",
 text: resolveBackendError(error),
 });
 } finally {
 setActionLoading(null);
 }
 }

 async function handleDelegateRenewals(): Promise<void> {
 if (selectedRiskPlayers.length === 0) {
 return;
 }

 const loadingKey = "delegate-renewals";
 setActionLoading(loadingKey);
 setDelegatedRenewalsSummary(null);

 try {
 const result = await invoke<DelegatedRenewalResponseData>(
 "delegate_renewals",
 {
 playerIds: selectedRiskPlayers.map(({ player }) => player.id),
 maxWageIncreasePct: 35,
 maxContractYears: 3,
 },
 );
 onGameUpdate?.(result.game);
 setDelegatedRenewalsSummary(
 t("finances.delegatedRenewalsSummary", {
 successes: result.report.success_count,
 stalled: result.report.stalled_count,
 failures: result.report.failure_count,
 }),
 );
 } catch (error) {
 console.error("Failed to delegate renewals:", error);
 } finally {
 setActionLoading(null);
 }
 }

 async function handleSponsorOption(
 messageId: string,
 actionId: string,
 optionId: string,
 ): Promise<void> {
 const loadingKey = `sponsor:${messageId}:${optionId}`;
 setActionLoading(loadingKey);
 try {
 const result = await invoke<ResolveMessageActionResult>(
 "resolve_message_action",
 {
 messageId,
 actionId,
 optionId,
 },
 );
 onGameUpdate?.(result.game);
 } catch (error) {
 console.error("Failed to resolve sponsor offer:", error);
 } finally {
 setActionLoading(null);
 }
 }

 const financeItems = [
 {
 label: t("finances.clubBalance"),
 value: myTeam.finance,
 color: myTeam.finance >= 0 ? "text-primary-500" : "text-danger-500",
 },
 {
 label: t("finances.wageBudget"),
 value: myTeam.wage_budget,
 color: "text-ink",
 },
 {
 label: t("finances.transferBudget"),
 value: myTeam.transfer_budget,
 color: "text-ink",
 },
 {
 label: t("finances.seasonIncome"),
 value: myTeam.season_income,
 color: "text-primary-500",
 },
 {
 label: t("finances.seasonExpenses"),
 value: myTeam.season_expenses,
 color: "text-danger-500",
 },
 ];

 return (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
 {/* Financial overview */}
 <Card accent="accent" className="lg:col-span-2">
 <CardHeader>{t("finances.overview")}</CardHeader>
 <CardBody>
 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
 {financeItems.map((item) => (
 <div
 key={item.label}
 className="bg-carbon-2 rounded p-4 text-center"
 >
 <p className="text-xs font-heading font-bold uppercase tracking-wider text-ink-faint mb-1">
 {item.label}
 </p>
 <p className={`font-heading font-bold text-xl ${item.color}`}>
 {formatVal(item.value)}
 </p>
 </div>
 ))}
 <div className="bg-carbon-2 rounded p-4 text-center">
 <p className="text-xs font-heading font-bold uppercase tracking-wider text-ink-faint mb-1">
 {t("finances.squadValue")}
 </p>
 <p className="font-heading font-bold text-xl text-ink">
 {formatVal(totalValue)}
 </p>
 </div>
 </div>
 </CardBody>
 </Card>

 {/* Wage summary */}
 <Card>
 <CardHeader>{t("finances.wageBill")}</CardHeader>
 <CardBody>
 <div className="text-center mb-4">
 <p className="text-xs font-heading font-bold uppercase tracking-wider text-ink-faint">
 {t("finances.weeklyTotal")}
 </p>
 <p className="font-heading font-bold text-2xl text-ink mt-1">
 {formatWeeklyAmount(formatVal(totalWages), weeklySuffix)}
 </p>
 <p className="text-xs text-ink-faint mt-1">
 {t("finances.budget")}:{" "}
 {formatWeeklyAmount(formatVal(weeklyWageBudget), weeklySuffix)}{" "}
 —{" "}
 {totalWages <= weeklyWageBudget ? (
 <span className="text-primary-500">
 {t("finances.underBudget")}
 </span>
 ) : (
 <span className="text-danger-500">{t("finances.overBudget")}</span>
 )}
 </p>
 </div>
 <ProgressBar
 value={Math.min(
 100,
 Math.round((totalWages / Math.max(1, weeklyWageBudget)) * 100),
 )}
 variant={totalWages <= weeklyWageBudget ? "success" : "danger"}
 size="md"
 showLabel
 />
 </CardBody>
 </Card>

 <Card className="lg:col-span-3">
 <CardHeader>{t("finances.cashFlow")}</CardHeader>
 <CardBody>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div className="rounded border border-slate-line bg-carbon-2 p-4 text-center">
 <p className="text-xs font-heading font-bold uppercase tracking-wider text-ink-dim mb-1">
 {t("finances.weeklyWageSpend")}
 </p>
 <p className="font-heading font-bold text-xl text-danger-500">
 {formatWeeklyAmount(
 formatSignedAmount(-totalWages),
 weeklySuffix,
 )}
 </p>
 </div>
 <div className="rounded border border-slate-line bg-carbon-2 p-4 text-center">
 <p className="text-xs font-heading font-bold uppercase tracking-wider text-ink-dim mb-1">
 {t("finances.weeklySponsorIncome")}
 </p>
 <p className="font-heading font-bold text-xl text-primary-500">
 {formatWeeklyAmount(
 formatSignedAmount(weeklySponsorIncome),
 weeklySuffix,
 )}
 </p>
 </div>
 <div className="rounded border border-slate-line bg-carbon-2 p-4 text-center">
 <p className="text-xs font-heading font-bold uppercase tracking-wider text-ink-dim mb-1">
 {t("finances.projectedWeeklyNet")}
 </p>
 <p
 className={`font-heading font-bold text-xl ${projectedWeeklyNet >= 0 ? "text-primary-500" : "text-danger-500"}`}
 >
 {formatWeeklyAmount(
 formatSignedAmount(projectedWeeklyNet),
 weeklySuffix,
 )}
 </p>
 </div>
 <div className="rounded border border-slate-line bg-carbon-2 p-4 text-center">
 <p className="text-xs font-heading font-bold uppercase tracking-wider text-ink-dim mb-1">
 {t("finances.cashRunway")}
 </p>
 <p className="font-heading font-bold text-base text-ink">
 {cashRunwayWeeks === null
 ? t("finances.runwayStable")
 : t("finances.runwayWeeks", { count: cashRunwayWeeks })}
 </p>
 </div>
 </div>
 {(myTeam.financial_ledger?.length ?? 0) > 0 && (
 <div className="mt-4">
 <FinanceCashFlowChart
 ledger={myTeam.financial_ledger ?? []}
 incomeLabel={t("finances.seasonIncome")}
 expensesLabel={t("finances.seasonExpenses")}
 />
 </div>
 )}
 <div className="mt-4 rounded border border-slate-line bg-carbon-2 p-4 space-y-3">
 <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
 <div className="space-y-1">
 <p className="text-xs font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("finances.boardSupport")}
 </p>
 <p className="text-sm text-ink-dim">
 {t("finances.boardSupportDescription")}
 </p>
 {boardSupportPreviewText ? (
 <p className="text-xs text-ink-dim">
 {boardSupportPreviewText}
 </p>
 ) : null}
 </div>
 <Button
 disabled={!canRequestBoardSupport || actionLoading === "board-support"}
 onClick={() => void handleRequestBoardSupport()}
 size="sm"
 >
 {t("finances.requestBoardSupport")}
 </Button>
 </div>
 {boardSupportFeedback ? (
 <p
 className={`text-sm ${boardSupportFeedback.tone === "error" ? "text-danger-500" : "text-primary-500"}`}
 >
 {boardSupportFeedback.text}
 </p>
 ) : null}
 {!canRequestBoardSupport ? (
 <p className="text-xs text-ink-dim">
 {t("finances.boardSupportUnavailable")}
 </p>
 ) : null}
 </div>
 </CardBody>
 </Card>

 {/* V100 P2 (Issue #36): Talk to Board — 3 request options with Gaffer-voice responses. */}
 <Card className="lg:col-span-3">
 <CardHeader>
 <div className="flex items-center gap-2">
 <span className="inline-block w-[3px] h-[11px] bg-accent-500" />
 {t("finances.talkToBoard")}
 </div>
 </CardHeader>
 <CardBody>
 <p className="text-xs text-ink-dim mb-3">
 {t("finances.talkToBoardDescription")}
 </p>
 <div className="flex flex-wrap gap-2 mb-3">
 <Button
 size="sm"
 variant="outline"
 disabled={talkToBoardLoading}
 onClick={() => void handleTalkToBoard("requestMoreTime")}
 >
 {t("finances.talkToBoardRequestMoreTime")}
 </Button>
 <Button
 size="sm"
 variant="outline"
 disabled={talkToBoardLoading}
 onClick={() => void handleTalkToBoard("requestTransferFunds")}
 >
 {t("finances.talkToBoardRequestTransferFunds")}
 </Button>
 <Button
 size="sm"
 variant="outline"
 disabled={talkToBoardLoading}
 onClick={() => void handleTalkToBoard("requestStadiumExpansion")}
 >
 {t("finances.talkToBoardRequestStadiumExpansion")}
 </Button>
 </div>
 {talkToBoardResult ? (
 <div className={`rounded border p-3 ${talkToBoardResult.approved ? "border-green-500/30 bg-green-950/20" : "border-red-500/30 bg-red-950/20"}`}>
 <p className="text-xs font-heading font-bold uppercase tracking-wider mb-1">
 {talkToBoardResult.approved ? t("finances.talkToBoardApproved") : t("finances.talkToBoardDenied")}
 </p>
 <p className="text-sm text-ink-dim italic">"{talkToBoardResult.board_reply}"</p>
 </div>
 ) : null}
 </CardBody>
 </Card>

 <Card className="lg:col-span-3">
 <CardHeader>{t("finances.wagePressure")}</CardHeader>
 <CardBody>
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <div className="rounded border border-slate-line bg-carbon-2 p-4 space-y-3">
 <p className="text-xs font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("finances.wagePressure")}
 </p>
 <p className="font-heading font-bold text-2xl text-ink">
 {t("finances.wageBudgetUsed", {
 percent: wageBudgetUsagePercent,
 })}
 </p>
 <ProgressBar
 value={Math.min(100, wageBudgetUsagePercent)}
 variant={
 totalWages <= weeklyWageBudget ? "success" : "danger"
 }
 size="md"
 showLabel
 />
 </div>

 <div className="rounded border border-slate-line bg-carbon-2 p-4 space-y-3">
 <div className="flex items-center justify-between gap-3">
 <div className="space-y-1">
 <p className="text-xs font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("finances.contractRisk")}
 </p>
 {delegatedRenewalsSummary ? (
 <p className="text-xs text-ink-dim">
 {delegatedRenewalsSummary}
 </p>
 ) : null}
 </div>
 <div className="flex items-center gap-2">
 <p className="text-sm font-semibold text-ink-dim">
 {t("finances.atRiskWages", {
 amount: formatExactMoney(atRiskWages),
 })}
 </p>
 {contractRiskPlayers.length > 0 ? (
 <div className="flex items-center gap-2">
 <Button
 size="sm"
 variant="outline"
 onClick={handleToggleAllRiskPlayers}
 >
 {t("finances.selectAllAtRisk")}
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => void handleDelegateRenewals()}
 disabled={
 actionLoading === "delegate-renewals" ||
 selectedRiskPlayers.length === 0
 }
 >
 {t("finances.delegateSelectedRenewals")}
 </Button>
 </div>
 ) : null}
 </div>
 </div>

 {contractRiskPlayers.length > 0 ? (
 <div className="space-y-3">
 {contractRiskPlayers.map(({ player, riskLevel }) => (
 <div
 key={player.id}
 className="rounded border border-slate-line bg-carbon-2 p-3 flex items-start justify-between gap-3"
 >
 <div className="flex items-start gap-3">
 <Checkbox
 checked={selectedRiskPlayerIds.includes(player.id)}
 onChange={() => handleToggleRiskPlayer(player.id)}
 aria-label={t("finances.selectRiskPlayer", {
 player: player.full_name,
 })}
 className="mt-1"
 />
 <div className="space-y-1">
 <p className="font-semibold text-sm text-ink">
 {player.full_name}
 </p>
 <p className="text-xs text-ink-dim">
 {t("finances.contractExpiresOn", {
 date: player.contract_end,
 })}
 </p>
 <p className="text-xs text-ink-dim">
 {t("playerProfile.yearsRemaining")}:{" "}
 {getContractYearsRemaining(
 player.contract_end,
 gameState.clock.current_date,
 )}
 </p>
 </div>
 </div>
 <div className="flex flex-col items-end gap-2">
 <Badge variant={getContractRiskBadgeVariant(riskLevel)}>
 {riskLevel === "critical"
 ? t("finances.contractRiskCritical")
 : t("finances.contractRiskWarning")}
 </Badge>
 <span className="text-xs font-semibold text-ink-dim">
 {formatWeeklyAmount(
 formatExactMoney(
 annualAmountToWeeklyCommitment(player.wage),
 ),
 weeklySuffix,
 )}
 </span>
 {onSelectPlayer ? (
 <Button
 size="sm"
 variant="outline"
 onClick={(event) => {
 event.stopPropagation();
 onSelectPlayer(player.id, {
 openRenewal: true,
 });
 }}
 >
 {t("common.renewContract")}
 </Button>
 ) : null}
 </div>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-sm text-ink-dim">
 {t("finances.noContractRisks")}
 </p>
 )}
 </div>
 </div>
 </CardBody>
 </Card>

 <Card className="lg:col-span-3">
 <CardHeader>{t("finances.sponsors")}</CardHeader>
 <CardBody>
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <div className="rounded border border-slate-line bg-carbon-2 p-4 space-y-2">
 <p className="text-xs font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("finances.activeSponsor")}
 </p>
 {activeSponsorship ? (
 <>
 <h3 className="font-heading font-bold text-base text-ink uppercase tracking-wide">
 {activeSponsorship.sponsor_name}
 </h3>
 <p className="text-sm text-ink-dim">
 {t("finances.sponsorWeeklyValue", {
 amount: formatExactMoney(activeSponsorship.base_value),
 })}
 </p>
 <p className="text-sm text-ink-dim">
 {t("finances.sponsorRemainingWeeks", {
 count: activeSponsorship.remaining_weeks,
 })}
 </p>
 </>
 ) : (
 <p className="text-sm text-ink-dim">
 {t("finances.noActiveSponsor")}
 </p>
 )}
 </div>

 <div className="rounded border border-slate-line bg-carbon-2 p-4 space-y-3">
 <p className="text-xs font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("finances.pendingSponsorOffers")}
 </p>
 <div className="rounded border border-slate-line bg-carbon-2 p-4 space-y-3">
 <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
 <div className="space-y-1">
 <h3 className="font-semibold text-sm text-ink">
 {t("finances.pitchSponsor")}
 </h3>
 <p className="text-sm text-ink-dim">
 {t("finances.sponsorPitchDescription")}
 </p>
 {sponsorPitchPreviewText ? (
 <p className="text-xs text-ink-dim">
 {sponsorPitchPreviewText}
 </p>
 ) : null}
 </div>
 <Button
 size="sm"
 onClick={() => void handleRequestSponsorPitch()}
 disabled={
 actionLoading === "sponsor-pitch" ||
 !canRequestSponsorPitch
 }
 >
 {t("finances.pitchSponsor")}
 </Button>
 </div>
 {sponsorPitchDisabledReason ? (
 <p className="text-xs text-ink-dim">
 {sponsorPitchDisabledReason}
 </p>
 ) : null}
 {sponsorPitchFeedback ? (
 <p
 className={
 sponsorPitchFeedback.tone === "error"
 ? "text-sm text-danger-500"
 : "text-sm text-primary-500"
 }
 >
 {sponsorPitchFeedback.text}
 </p>
 ) : null}
 </div>
 <div className="rounded border border-slate-line bg-carbon-2 p-4 space-y-3">
 <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
 <div className="space-y-1">
 <h3 className="font-semibold text-sm text-ink">
 {t("finances.marketingCampaign")}
 </h3>
 <p className="text-sm text-ink-dim">
 {t("finances.marketingCampaignDescription")}
 </p>
 {marketingCampaignPreviewText ? (
 <p className="text-xs text-ink-dim">
 {marketingCampaignPreviewText}
 </p>
 ) : null}
 </div>
 <Button
 size="sm"
 onClick={() => void handleRequestMarketingCampaign()}
 disabled={
 actionLoading === "marketing-campaign" ||
 !canRequestMarketingCampaign
 }
 >
 {t("finances.launchMarketingCampaign")}
 </Button>
 </div>
 {marketingCampaignDisabledReason ? (
 <p className="text-xs text-ink-dim">
 {marketingCampaignDisabledReason}
 </p>
 ) : null}
 {marketingCampaignFeedback ? (
 <p
 className={
 marketingCampaignFeedback.tone === "error"
 ? "text-sm text-danger-500"
 : "text-sm text-primary-500"
 }
 >
 {marketingCampaignFeedback.text}
 </p>
 ) : null}
 </div>
 {sponsorOffers.length > 0 ? (
 sponsorOffers.map((message) => {
 const sponsorAction = message.actions.find(
 (action) =>
 !action.resolved &&
 isChooseOptionAction(action.action_type),
 );

 if (
 !sponsorAction ||
 !isChooseOptionAction(sponsorAction.action_type)
 ) {
 return null;
 }

 return (
 <div
 key={message.id}
 className="rounded border border-slate-line bg-carbon-2 p-4 space-y-3"
 >
 <div className="space-y-1">
 <h3 className="font-semibold text-sm text-ink">
 {message.subject}
 </h3>
 <p className="text-sm text-ink-dim">
 {message.body}
 </p>
 </div>
 <div className="flex flex-wrap gap-2">
 {sponsorAction.action_type.ChooseOption.options.map(
 (option) => {
 const optionLoadingKey = `sponsor:${message.id}:${option.id}`;
 return (
 <div
 key={option.id}
 className="min-w-55 flex-1 rounded border border-slate-line bg-carbon-2 p-3 space-y-2"
 >
 <p className="text-xs text-ink-dim">
 {option.description}
 </p>
 <Button
 disabled={actionLoading === optionLoadingKey}
 onClick={() =>
 void handleSponsorOption(
 message.id,
 sponsorAction.id,
 option.id,
 )
 }
 size="sm"
 variant={
 option.id === "decline"
 ? "outline"
 : "primary"
 }
 >
 {option.label}
 </Button>
 </div>
 );
 },
 )}
 </div>
 </div>
 );
 })
 ) : (
 <p className="text-sm text-ink-dim">
 {t("finances.noPendingSponsorOffers")}
 </p>
 )}
 </div>
 </div>
 </CardBody>
 </Card>

 <Card className="lg:col-span-3">
 <CardHeader>{t("finances.facilities")}</CardHeader>
 <CardBody>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {FACILITY_DEFINITIONS.map((facility) => {
 const level = facilities[facility.levelKey];
 const nextUpgradeCost = getFacilityUpgradeCost(level);
 const financeBlockReason = facilityUpgradeBlockReason(financeSnapshot);
 const canAffordUpgrade = myTeam.finance >= nextUpgradeCost;
 const canUpgrade = canAffordUpgrade && !financeBlockReason;
 const isLoading = actionLoading === facility.id;
 const upgradeReason = financeBlockReason
 ? resolveBackendError(financeBlockReason)
 : facilityUpgradeError?.facilityId === facility.id
 ? facilityUpgradeError.message
 : null;

 return (
 <div
 key={facility.id}
 className="rounded border border-slate-line bg-carbon-2 p-4 flex flex-col gap-4"
 >
 <div className="space-y-1">
 <h3 className="font-heading font-bold text-base text-ink uppercase tracking-wide">
 {t(facility.titleKey)}
 </h3>
 <p className="text-sm text-ink-dim">
 {t("finances.facilityLevel", { level })}
 </p>
 <p className="text-sm text-ink-dim">
 {t(facility.effectKey)}
 </p>
 </div>

 <div className="space-y-2 mt-auto">
 <p className="text-xs font-heading font-bold uppercase tracking-wider text-ink-dim">
 {t("finances.nextUpgradeCost", {
 amount: formatExactMoney(nextUpgradeCost),
 })}
 </p>
 <Button
 disabled={!canUpgrade || isLoading}
 onClick={() => void handleUpgradeFacility(facility.id)}
 size="sm"
 >
 {t("finances.upgradeFacility")}
 </Button>
 {!canAffordUpgrade && !upgradeReason && (
 <p className="text-xs text-danger-500">
 {t("finances.insufficientFunds")}
 </p>
 )}
 {upgradeReason && (
 <p className="text-xs text-danger-500">{upgradeReason}</p>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </CardBody>
 </Card>

 {/* Payroll */}
 <Card className="lg:col-span-3">
 <CardHeader>{t("finances.payroll")}</CardHeader>
 <CardBody className="p-0">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-carbon-2 border-b border-slate-line text-xs">
 <SortableHeader label={t("common.player")} columnKey="name" sortKey={payrollSortKey} sortDir={payrollSortDir} onSort={togglePayrollSort} />
 <SortableHeader label={t("common.position")} columnKey="position" sortKey={payrollSortKey} sortDir={payrollSortDir} onSort={togglePayrollSort} />
 <SortableHeader label={t("finances.wagePerWeek")} columnKey="wage" sortKey={payrollSortKey} sortDir={payrollSortDir} onSort={togglePayrollSort} numeric />
 <SortableHeader label={t("finances.marketValue")} columnKey="marketValue" sortKey={payrollSortKey} sortDir={payrollSortDir} onSort={togglePayrollSort} numeric />
 <SortableHeader label={t("common.contract")} columnKey="contractEnd" sortKey={payrollSortKey} sortDir={payrollSortDir} onSort={togglePayrollSort} />
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-line-soft dark:divide-slate-line">
 {topPayrollRows.map((row) => {
 const p = roster.find((rp) => rp.id === row.id);
 if (!p) return null;
 const contextItems = onSelectPlayer
 ? [
 {
 label: t("squad.viewProfile"),
 icon: <User className="w-4 h-4" />,
 onClick: () => onSelectPlayer(p.id),
 },
 ]
 : [];

 const tableRow = (
 <tr
 key={p.id}
 onClick={() => onSelectPlayer?.(p.id)}
 className={`hover:bg-carbon-2 hover:bg-carbon-3/50 transition-colors ${onSelectPlayer ? "cursor-pointer group" : ""}`}
 >
 <td className="py-3 px-5 font-semibold text-sm text-ink">
 <span className="group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
 {p.full_name}
 </span>
 </td>
 <td className="py-3 px-5">
 <Badge variant={positionBadgeVariant(p.position)}>
 {translatePositionAbbreviation(t, p.position)}
 </Badge>
 </td>
 <td className="py-3 px-5 text-sm font-medium text-ink-dim text-right font-mono">
 {formatExactMoney(
 annualAmountToWeeklyCommitment(p.wage),
 )}
 </td>
 <td className="py-3 px-5 text-sm text-ink-dim text-right font-mono">
 {formatVal(p.market_value)}
 </td>
 <td className="py-3 px-5 text-sm text-ink-dim">
 {p.contract_end
 ? t("finances.until", {
 year: p.contract_end.substring(0, 4),
 })
 : "—"}
 </td>
 </tr>
 );

 if (!onSelectPlayer) {
 return tableRow;
 }

 return (
 <ContextMenu items={contextItems} key={p.id}>
 {tableRow}
 </ContextMenu>
 );
 })}
 </tbody>
 </table>
 </div>
 </CardBody>
 </Card>
 </div>
 );
}
