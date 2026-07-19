import { Shield } from "lucide-react";
import { countryName } from "../../lib/countries";
import { positionBadgeVariant } from "../../lib/helpers";
import type { PlayerData } from "../../store/gameStore";
import ContextMenu from "../ContextMenu";
import { buildViewTeamMenuItem } from "../playerActions/playerContextMenuItems";
import { translatePositionLabel } from "../squad/SquadTab.helpers";
import { formatPlayerAnnualWage, formatPlayerMarketValue } from "./PlayerProfile.helpers";
import type {
 PlayerProfileScoutStatus,
 ScoutAvailability,
} from "./PlayerProfile.scouting";
import PlayerProfileScoutAction from "./PlayerProfileScoutAction";
import { TraitList } from "../TraitBadge";
import { Badge, Card, CountryFlag, JerseyIcon, PlayerAvatar } from "../ui";
import { shortOvrLabel, interpretOvr } from "../../lib/ovrInterpretation";
import type { TeamData } from "../../store/types";

type TranslateFn = (
 key: string,
 options?: Record<string, string | number>,
) => string;

interface PlayerProfileHeroCardProps {
 player: PlayerData;
 ovr: number;
 primaryPosition: string;
 age: number;
 teamName: string;
 footednessLabel: string;
 weakFootValue: number;
 annualSuffix: string;
 language: string;
 isOwnClub: boolean;
 scoutAvailability: ScoutAvailability;
 scoutStatus: PlayerProfileScoutStatus;
 scoutError: string | null;
 onScout: () => void;
 onSelectTeam?: (id: string) => void;
 team?: TeamData;
 t: TranslateFn;
}

export default function PlayerProfileHeroCard({
 player,
 ovr,
 primaryPosition,
 age,
 teamName,
 footednessLabel,
 weakFootValue,
 annualSuffix,
 language,
 isOwnClub,
 scoutAvailability,
 scoutStatus,
 scoutError,
 onScout,
 onSelectTeam,
 team,
 t,
}: PlayerProfileHeroCardProps) {
 const teamContextItems = player.team_id && onSelectTeam
 ? [buildViewTeamMenuItem(t, () => onSelectTeam(player.team_id!))]
 : [];

 return (
 <Card accent="primary" className="hero-panel mb-5">
 <div className="dossier-panel p-8 rounded-t-xl">
 <div className="flex items-start gap-6">
 <PlayerAvatar
 player={player}
 className={`w-24 h-24 rounded flex items-center justify-center font-heading font-bold text-lg border-2 overflow-hidden ${interpretOvr(ovr, player.natural_position || player.position).colorClass} bg-carbon-3 border-current/30`}
 fallback={<span className="text-center px-1 leading-tight">{shortOvrLabel(ovr, player.natural_position || player.position)}</span>}
 />
 {player.jersey_number != null && team != null && (
 <JerseyIcon
 primaryColor={team.colors.primary}
 secondaryColor={team.colors.secondary}
 pattern={team.kit_pattern ?? "Solid"}
 number={player.jersey_number}
 size="lg"
 className="flex-shrink-0 self-center"
 />
 )}
 <div className="flex-1">
 <h2 className="text-3xl font-heading font-bold text-ink uppercase tracking-wide">
 {player.full_name}
 </h2>
 <div className="flex items-center gap-3 mt-2">
 <Badge variant={positionBadgeVariant(primaryPosition)}>
 {translatePositionLabel(t, primaryPosition)}
 </Badge>
 {player.alternate_positions?.map((alternatePosition) => (
 <Badge key={alternatePosition} variant="neutral">
 {translatePositionLabel(t, alternatePosition)}
 </Badge>
 ))}
 <span className="text-ink-faint text-sm">
 <CountryFlag
 code={player.nationality}
 locale={language}
 className="mr-1 text-sm leading-none"
 />
 {countryName(player.nationality, language)}
 </span>
 <span className="text-ink-faint">•</span>
 <span className="text-ink-faint text-sm">
 {t("common.age")} {age}
 </span>
 <span className="text-ink-faint">•</span>
 <span className="text-ink-faint text-sm">
 {t("common.footednessLabel")}: {" "}
 {footednessLabel}
 </span>
 <span className="text-ink-faint">•</span>
 <span className="text-ink-faint text-sm">
 {t("common.weakFoot")}: {" "}
 {weakFootValue}/5
 </span>
 {/* V100 P1 (Issue #1): Display height/weight when available (>0). */}
 {player.height_cm ? (
 <>
 <span className="text-ink-faint">•</span>
 <span className="text-ink-faint text-sm font-mono">
 {player.height_cm}cm / {player.weight_kg}kg
 </span>
 </>
 ) : null}
 </div>
 <p className="text-ink-faint text-sm mt-2 flex items-center gap-1.5">
 <Shield className="w-4 h-4" />
 {player.team_id && onSelectTeam ? (
 <ContextMenu items={teamContextItems}>
 <button
 data-testid="player-profile-team-link"
 onClick={() => onSelectTeam(player.team_id!)}
 className="hover:text-primary-400 transition-colors underline underline-offset-2"
 >
 {teamName}
 </button>
 </ContextMenu>
 ) : (
 <span>{teamName}</span>
 )}
 </p>
 {player.traits && player.traits.length > 0 ? (
 <div className="mt-3">
 <TraitList traits={player.traits} size="sm" />
 </div>
 ) : null}
 </div>

 {!isOwnClub ? (
 <div className="mt-3">
 <PlayerProfileScoutAction
 availability={scoutAvailability}
 scoutStatus={scoutStatus}
 scoutError={scoutError}
 onScout={onScout}
 />
 </div>
 ) : null}

 <div className="hidden md:grid grid-cols-2 gap-3">
 <QuickStat
 label={t("common.condition")}
 value={`${player.condition}%`}
 color={player.condition >= 70 ? "text-primary-400" : "text-danger-400"}
 />
 <QuickStat
 label={t("common.morale")}
 value={`${player.morale}%`}
 color={player.morale >= 70 ? "text-primary-400" : "text-accent-400"}
 />
 <QuickStat
 label={t("common.value")}
 value={formatPlayerMarketValue(player.market_value)}
 color="text-ink"
 />
 <QuickStat
 label={t("common.wage")}
 value={formatPlayerAnnualWage(player.wage, annualSuffix)}
 color="text-ink"
 />
 </div>
 </div>
 </div>

 <div className="grid grid-cols-4 gap-px bg-carbon-3 md:hidden">
 <MobileQuickStat
 label={t("common.condition")}
 value={`${player.condition}%`}
 color={player.condition >= 70 ? "text-primary-500" : "text-danger-500"}
 />
 <MobileQuickStat
 label={t("common.morale")}
 value={`${player.morale}%`}
 color={player.morale >= 70 ? "text-primary-500" : "text-accent-500"}
 />
 <MobileQuickStat
 label={t("common.value")}
 value={formatPlayerMarketValue(player.market_value)}
 color="text-ink"
 />
 <MobileQuickStat
 label={t("common.wage")}
 value={formatPlayerAnnualWage(player.wage, annualSuffix)}
 color="text-ink"
 />
 </div>
 </Card>
 );
}

function QuickStat({
 label,
 value,
 color,
}: {
 label: string;
 value: string;
 color: string;
}) {
 return (
 <div className="bg-ink/5 rounded px-5 py-3 text-center min-w-25">
 <p className="text-xs text-ink-faint font-heading uppercase tracking-wider">
 {label}
 </p>
 <p className={`font-heading font-bold text-xl mt-0.5 ${color}`}>
 {value}
 </p>
 </div>
 );
}

function MobileQuickStat({
 label,
 value,
 color,
}: {
 label: string;
 value: string;
 color: string;
}) {
 return (
 <div className="bg-carbon-1 p-3 text-center">
 <p className="text-xs text-ink-faint font-heading uppercase tracking-wider">
 {label}
 </p>
 <p className={`font-heading font-bold text-lg mt-0.5 ${color}`}>
 {value}
 </p>
 </div>
 );
}
