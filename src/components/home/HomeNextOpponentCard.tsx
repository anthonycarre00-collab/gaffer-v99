import { useTranslation } from "react-i18next";

import { formatDateShort } from "../../lib/helpers";
import { Badge, Card, CardBody, CardHeader, TeamLogo } from "../ui";
import type { NextOpponentWidgetData } from "./HomeTab.helpers";

interface HomeNextOpponentCardProps {
 nextOpponent: NextOpponentWidgetData | null;
 lang: string;
 onNavigate?: (tab: string) => void;
}

export default function HomeNextOpponentCard({
 nextOpponent,
 lang,
 onNavigate,
}: HomeNextOpponentCardProps) {
 const { t } = useTranslation();

 return (
 <Card className="hero-panel">
 <CardHeader
 action={
 <button
 onClick={() => onNavigate?.("Schedule")}
 className="text-primary-500 dark:text-primary-400 text-xs font-heading font-bold uppercase tracking-wider hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
 >
 {t("dashboard.schedule")}
 </button>
 }
 >
 {t("home.nextOpponent")}
 </CardHeader>
 <CardBody>
 {nextOpponent ? (
 <div className="flex flex-col gap-3">
 {(() => {
 const fixtureLabel =
 nextOpponent.fixture.competition === "League"
 ? t("home.matchdayN", {
 n: nextOpponent.fixture.matchday,
 })
 : nextOpponent.fixture.competition === "PreseasonTournament"
 ? t("season.preseasonTournament")
 : t("season.friendly");

 return (
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0 flex items-center gap-3">
 <TeamLogo
 team={nextOpponent.opponent}
 className="h-11 w-11 shrink-0 overflow-hidden rounded bg-carbon-2 flex items-center justify-center text-xs font-heading font-bold text-ink-dim"
 imageClassName="h-9 w-9 object-contain drop-shadow"
 />
 <div className="min-w-0">
 <p className="text-lg font-heading font-bold text-ink truncate">
 {nextOpponent.opponent.name}
 </p>
 <p className="text-xs text-ink-dim mt-1">
 {fixtureLabel} - {formatDateShort(nextOpponent.fixture.date, lang)}
 </p>
 </div>
 </div>
 <Badge
 variant={nextOpponent.isHome ? "success" : "accent"}
 size="sm"
 >
 {nextOpponent.isHome ? t("home.home") : t("home.away")}
 </Badge>
 </div>
 );
 })()}

 {(nextOpponent.standingPosition !== null ||
 nextOpponent.standingPoints !== null) && (
 <div className="flex items-center gap-2 text-xs text-ink-dim">
 {nextOpponent.standingPosition !== null && (
 <Badge variant="neutral" size="sm">
 #{nextOpponent.standingPosition}
 </Badge>
 )}
 {nextOpponent.standingPoints !== null && (
 <span className="font-heading font-bold text-ink-dim">
 {nextOpponent.standingPoints} {t("common.pts")}
 </span>
 )}
 </div>
 )}

 {nextOpponent.recentForm.length > 0 && (
 <div className="flex gap-1.5">
 {nextOpponent.recentForm.map((result, index) => (
 <span
 key={`${nextOpponent.opponent.id}-${index}`}
 className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-heading font-bold text-ink ${
 result === "W"
 ? "bg-success-500"
 : result === "L"
 ? "bg-danger-500"
 : "bg-carbon-3"
 }`}
 >
 {result}
 </span>
 ))}
 </div>
 )}
 </div>
 ) : (
 <p className="text-sm text-ink-dim py-4 text-center">
 {t("home.noUpcomingOpponent")}
 </p>
 )}
 </CardBody>
 </Card>
 );
}