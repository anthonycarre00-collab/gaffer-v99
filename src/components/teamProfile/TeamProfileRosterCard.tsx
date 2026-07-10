import { countryName } from "../../lib/countries";
import {
 calcAge,
 formatVal,
 getPlayerOvr,
 positionBadgeVariant,
} from "../../lib/helpers";
import type { PlayerData } from "../../store/gameStore";
import ContextMenu from "../ContextMenu";
import { buildViewProfileMenuItem } from "../playerActions/playerContextMenuItems";
import { Badge, Card, CardBody, CardHeader, CountryFlag, PlayerAvatar, ProgressBar } from "../ui";
import { useSortableTable, SortableHeader } from "../ui/SortableTable";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import { shortOvrLabel, interpretOvr } from "../../lib/ovrInterpretation";
import type { TeamProfileTranslate } from "./TeamProfile.types";

interface TeamProfileRosterCardProps {
 roster: PlayerData[];
 isOwnTeam: boolean;
 locale: string;
 t: TeamProfileTranslate;
 onSelectPlayer?: (id: string) => void;
}

export default function TeamProfileRosterCard({
 roster,
 isOwnTeam,
 locale,
 t,
 onSelectPlayer,
}: TeamProfileRosterCardProps) {
 // Sortable roster table.
 const sortableRows = roster.map((player) => ({
 id: player.id,
 player,
 position: player.natural_position || player.position,
 name: player.full_name || player.match_name,
 age: calcAge(player.date_of_birth),
 nationality: player.nationality ?? "",
 value: player.market_value,
 condition: player.condition,
 ovr: getPlayerOvr(player),
 }));
 const {
 sortKey,
 sortDir,
 toggleSort,
 sortedRows,
 } = useSortableTable(sortableRows, { initialKey: "ovr", initialDir: "desc" });

 return (
 <Card className="lg:col-span-3">
 <CardHeader>
 {t("teams.squad")} ({roster.length})
 </CardHeader>
 <CardBody className="p-0">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-gray-50 dark:bg-navy-800 border-b border-gray-200 dark:border-navy-600 text-xs">
 <SortableHeader label={t("common.position")} columnKey="position" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
 <SortableHeader label={t("common.name")} columnKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
 <SortableHeader label={t("common.age")} columnKey="age" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} numeric />
 <th className="py-3 px-5 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
 {t("common.nationality")}
 </th>
 <SortableHeader label={t("common.value")} columnKey="value" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} numeric />
 {isOwnTeam && (
 <SortableHeader label={t("common.condition")} columnKey="condition" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} numeric />
 )}
 <SortableHeader label={t("common.ovr")} columnKey="ovr" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} numeric />
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100 dark:divide-navy-600">
 {sortedRows.map(({ player }) => {
 const ovr = getPlayerOvr(player);
 const age = calcAge(player.date_of_birth);
 const contextItems = onSelectPlayer
 ? [buildViewProfileMenuItem(t, () => onSelectPlayer(player.id))]
 : [];
 const playerRow = (
 <tr
 key={player.id}
 data-testid={`team-profile-roster-${player.id}`}
 onClick={() => onSelectPlayer?.(player.id)}
 className={`group transition-colors ${onSelectPlayer
 ? "hover:bg-gray-50 dark:hover:bg-navy-700/50 cursor-pointer"
 : ""
 }`}
 >
 <td className="py-3 px-5">
 <Badge
 variant={positionBadgeVariant(
 player.natural_position || player.position,
 )}
 >
 {translatePositionAbbreviation(
 t,
 player.natural_position || player.position,
 )}
 </Badge>
 </td>
 <td className="py-3 px-5">
 <div className="flex items-center gap-3 min-w-0">
 <PlayerAvatar player={player} />
 <span className="block truncate font-semibold text-sm text-gray-800 dark:text-gray-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
 {player.full_name}
 </span>
 </div>
 </td>
 <td className="py-3 px-5 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
 {age}
 </td>
 <td className="py-3 px-5 text-sm text-gray-500 dark:text-gray-400">
 <div className="flex items-center gap-1">
 <CountryFlag
 code={player.nationality}
 locale={locale}
 className="text-lg leading-none"
 />
 <span>{countryName(player.nationality, locale)}</span>
 </div>
 </td>
 <td className="py-3 px-5 text-sm text-gray-600 dark:text-gray-400">
 {formatVal(player.market_value)}
 </td>
 {isOwnTeam && (
 <td className="py-3 px-5">
 <ProgressBar
 value={player.condition}
 variant="auto"
 size="sm"
 showLabel
 className="max-w-[100px]"
 />
 </td>
 )}
 <td className="py-3 px-5">
 <span
 className={`font-heading font-bold text-xs ${isOwnTeam
 ? interpretOvr(ovr, player.natural_position || player.position).colorClass
 : "text-gray-400 dark:text-gray-500"
 }`}
 title={isOwnTeam ? interpretOvr(ovr, player.natural_position || player.position).description : "Scout this player to reveal their rating"}
 >
 {isOwnTeam
 ? shortOvrLabel(ovr, player.natural_position || player.position)
 : "??"}
 </span>
 </td>
 </tr>
 );

 if (contextItems.length > 0) {
 return (
 <ContextMenu items={contextItems} key={player.id}>
 {playerRow}
 </ContextMenu>
 );
 }

 return playerRow;
 })}
 </tbody>
 </table>
 </div>
 </CardBody>
 </Card>
 );
}
