import { Calendar, Users } from "lucide-react";

import { Card, TeamLocation, TeamLogo } from "../ui";
import type { TeamProfileTranslate } from "./TeamProfile.types";
import { QuickStat } from "./TeamProfile.primitives";
import type { TeamProfileViewModel } from "./TeamProfile.types";
import { interpretReputation, shortOvrLabel } from "../../lib/gafferEngine";
import type { TeamData } from "../../store/gameStore";

interface TeamProfileHeroCardProps {
 team: TeamData;
 viewModel: TeamProfileViewModel;
 locale: string;
 t: TeamProfileTranslate;
}

export default function TeamProfileHeroCard({
 team,
 viewModel,
 locale,
 t,
}: TeamProfileHeroCardProps) {
 return (
 <Card className="mb-5 overflow-hidden">
 <div
 className="p-8 relative"
 style={{
 background: `linear-gradient(135deg, ${team.colors.primary}, ${team.colors.secondary}40)`,
 }}
 >
 <div className="flex items-start gap-6">
 <TeamLogo
 team={team}
 className="w-24 h-24 rounded flex items-center justify-center font-heading font-bold text-3xl text-ink border-2 border-ink/30 overflow-hidden"
 imageClassName="h-20 w-20 object-contain drop-shadow"
 style={{ backgroundColor: team.colors.primary }}
 />
 <div className="flex-1">
 <h2 className="text-3xl font-heading font-bold text-ink uppercase tracking-wide drop-shadow">
 {team.name}
 </h2>
 <div className="flex items-center gap-4 mt-2 text-ink/80 text-sm">
 <TeamLocation
 city={team.city}
 countryCode={team.country}
 locale={locale}
 className="text-ink/80"
 />
 <span className="flex items-center gap-1.5">
 <Calendar className="w-4 h-4" /> {t("teams.est")} {team.founded_year}
 </span>
 </div>
 {viewModel.manager && (
 <p className="text-ink/70 text-sm mt-1 flex items-center gap-1.5">
 <Users className="w-4 h-4" /> {t("teamProfile.managerLabel")} {viewModel.manager.first_name} {viewModel.manager.last_name}
 </p>
 )}
 </div>

 <div className="hidden md:grid grid-cols-2 gap-3">
 <QuickHeroStat label={t("teams.avgOvr")} value={shortOvrLabel(viewModel.avgOvr)} />
 <QuickHeroStat
 label={t("manager.reputation")}
 value={interpretReputation(team.reputation).short}
 valueClassName={interpretReputation(team.reputation).colorClass}
 />
 <QuickHeroStat
 label={t("teamProfile.leaguePos")}
 value={viewModel.leaguePos > 0 ? `#${viewModel.leaguePos}` : "—"}
 />
 <QuickHeroStat
 label={t("teams.squad")}
 value={String(viewModel.roster.length)}
 />
 </div>
 </div>
 </div>

 <div className="grid grid-cols-4 gap-px bg-carbon-3 md:hidden">
 <QuickStat
 label={t("teams.avgOvr")}
 value={String(viewModel.avgOvr)}
 color="text-primary-500"
 />
 <QuickStat
 label={t("teams.rep")}
 // V100 (Issue #26): Use Gaffer voice for reputation.
 value={interpretReputation(team.reputation).short}
 color="text-accent-500"
 />
 <QuickStat
 label={t("common.position")}
 value={viewModel.leaguePos > 0 ? `#${viewModel.leaguePos}` : "—"}
 color="text-ink"
 />
 <QuickStat
 label={t("teams.squad")}
 value={String(viewModel.roster.length)}
 color="text-ink"
 />
 </div>
 </Card>
 );
}

function QuickHeroStat({
 label,
 value,
 valueClassName = "text-ink",
}: {
 label: string;
 value: string;
 valueClassName?: string;
}) {
 return (
 <div className="bg-black/20 backdrop-blur rounded px-5 py-3 text-center min-w-[100px]">
 <p className="text-xs text-ink/60 font-heading uppercase tracking-wider">
 {label}
 </p>
 <p className={`font-heading font-bold text-2xl mt-0.5 ${valueClassName}`}>
 {value}
 </p>
 </div>
 );
}
