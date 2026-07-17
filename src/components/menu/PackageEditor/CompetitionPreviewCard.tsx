import { useTranslation } from "react-i18next";
import { Trophy } from "lucide-react";
import type { CompetitionDef } from "./types";

interface CompetitionPreviewCardProps {
 competition: CompetitionDef;
 logoDataUrl: string | null;
}

const MONTH_NAMES = [
 "Jan", "Feb", "Mar", "Apr", "May", "Jun",
 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function CompetitionPreviewCard({ competition, logoDataUrl }: CompetitionPreviewCardProps) {
 const { t } = useTranslation();

 const participantCount =
 competition.participants.explicit?.length ??
 competition.participants.selector?.count ??
 null;

 return (
 <div className="rounded border border-slate-line overflow-hidden bg-white bg-carbon-2 shadow-sm select-none">
 {/* Header banner */}
 <div className="h-20 to-primary-800 flex items-center justify-center">
 {logoDataUrl ? (
 <img
 src={logoDataUrl}
 alt=""
 className="w-14 h-14 object-contain drop-"
 />
 ) : (
 <div className="w-14 h-14 rounded bg-white/10 border border-white/20 flex items-center justify-center">
 <Trophy className="w-7 h-7 text-white/70" />
 </div>
 )}
 </div>

 <div className="p-3 flex flex-col gap-2.5">
 {/* Name */}
 <div>
 <p className="font-heading font-bold text-sm uppercase tracking-wide text-ink leading-tight">
 {competition.name || <span className="text-ink-faint italic">New Competition</span>}
 </p>
 {competition.id && (
 <p className="text-[10px] text-ink-faint font-mono mt-0.5">
 {competition.id}
 </p>
 )}
 </div>

 {/* Type + Scope */}
 <div className="flex gap-1.5 flex-wrap">
 <span className="text-[10px] font-heading font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400">
 {t(`teamSelect.kinds.${competition.type}`, { defaultValue: competition.type })}
 </span>
 <span className="text-[10px] font-heading font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-carbon-2 bg-carbon-3 text-ink-dim">
 {t(`teamSelect.scopes.${competition.scope}`, { defaultValue: competition.scope })}
 </span>
 </div>

 {/* Format */}
 <div className="text-[11px] text-ink-dim">
 <span className="uppercase tracking-wide">{t("worldEditor.competitionFormat")} </span>
 <span className="text-ink">
 {t(`worldEditor.competitionFormats.${competition.format.kind}`, { defaultValue: competition.format.kind })}
 </span>
 </div>

 {/* Participants */}
 {participantCount !== null && (
 <div className="text-[11px] text-ink-dim">
 <span className="uppercase tracking-wide">{t("worldEditor.competitionExplicitTeams")} </span>
 <span className="text-ink font-mono">{participantCount}</span>
 </div>
 )}

 {/* Region / Country */}
 {(competition.regionId || competition.countryId) && (
 <div className="text-[11px] text-ink-dim">
 <span className="uppercase tracking-wide">
 {competition.regionId
 ? t("worldEditor.competitionRegionId")
 : t("worldEditor.competitionCountryId")}{" "}
 </span>
 <span className="text-ink font-mono">
 {competition.regionId ?? competition.countryId}
 </span>
 </div>
 )}

 {/* Season start */}
 {competition.seasonStartMonth && (
 <div className="text-[11px] text-ink-dim">
 <span className="uppercase tracking-wide">{t("worldEditor.competitionSeasonMonth")} </span>
 <span className="text-ink">
 {MONTH_NAMES[(competition.seasonStartMonth - 1) % 12]}
 {competition.seasonStartDay ? ` ${competition.seasonStartDay}` : ""}
 </span>
 </div>
 )}

 {/* Priority */}
 <div className="text-[11px] text-ink-dim">
 <span className="uppercase tracking-wide">{t("worldEditor.competitionPriority")} </span>
 <span className="text-ink font-mono">{competition.priority}</span>
 </div>
 </div>
 </div>
 );
}
