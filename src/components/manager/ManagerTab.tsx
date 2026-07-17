import { GameStateData } from "../../store/gameStore";
import { Card, CardHeader, CardBody, ProgressBar, CountryFlag } from "../ui";
import { ManagerCareerChart } from "./ManagerCareerChart";
import { formatDate } from "../../lib/helpers";
import { useTranslation } from "react-i18next";
import { countryName } from "../../lib/countries";
import ContextMenu from "../ContextMenu";
import { buildViewTeamMenuItem } from "../playerActions/playerContextMenuItems";

interface ManagerTabProps {
 gameState: GameStateData;
 onSelectTeam?: (id: string) => void;
}

export default function ManagerTab({ gameState, onSelectTeam }: ManagerTabProps) {
 const { t, i18n } = useTranslation();
 const mgr = gameState.manager;
 const myTeam = gameState.teams.find(tm => tm.id === mgr.team_id);
 const stats = mgr.career_stats;

 return (
 <div className="gaffer-card-texture grid grid-cols-1 md:grid-cols-3 gap-5">
 {/* Profile card */}
 <Card accent="primary" className="md:col-span-3">
 <div className="bg-navy-700 p-6 rounded-t-xl flex items-center gap-6">
 <div className="w-20 h-20 rounded bg-primary-500/20 flex items-center justify-center font-heading font-bold text-3xl text-primary-400 border-2 border-primary-500/30">
 {mgr.first_name.charAt(0)}{mgr.last_name.charAt(0)}
 </div>
 <div>
 <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-wide">{mgr.first_name} {mgr.last_name}</h2>
 <p className="text-ink-faint text-sm mt-1">
 <CountryFlag code={mgr.nationality} locale={i18n.language} className="mr-1 text-sm leading-none" />
 {countryName(mgr.nationality, i18n.language)} • {t('manager.born')} {formatDate(mgr.date_of_birth, i18n.language)}
 </p>
 {myTeam && onSelectTeam ? (
 <ContextMenu
 items={[buildViewTeamMenuItem(t, () => onSelectTeam(myTeam.id))]}
 >
 <button
 data-testid="manager-current-team"
 onClick={() => onSelectTeam(myTeam.id)}
 className="text-primary-400 text-sm font-semibold mt-0.5 hover:text-primary-300 transition-colors"
 >
 {t('manager.managerOf', { team: myTeam.name })}
 </button>
 </ContextMenu>
 ) : myTeam ? (
 <p className="text-primary-400 text-sm font-semibold mt-0.5">{t('manager.managerOf', { team: myTeam.name })}</p>
 ) : null}
 </div>
 <div className="ml-auto text-right">
 <p className="text-xs text-ink-faint font-heading uppercase tracking-wider">{t('manager.reputation')}</p>
 <p className="font-heading font-bold text-2xl text-accent-400">{mgr.reputation}</p>
 </div>
 </div>
 </Card>

 {/* Career stats */}
 <Card accent="accent" className="md:col-span-2">
 <CardHeader>{t('manager.careerStats')}</CardHeader>
 <CardBody>
 <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
 <StatBlock label={t('manager.matches')} value={stats.matches_managed} />
 <StatBlock label={t('manager.wins')} value={stats.wins} />
 <StatBlock label={t('manager.draws')} value={stats.draws} />
 <StatBlock label={t('manager.losses')} value={stats.losses} />
 <StatBlock label={t('manager.trophies')} value={stats.trophies} />
 <StatBlock label={t('manager.winPercent')} value={stats.matches_managed > 0 ? `${(stats.wins / stats.matches_managed * 100).toFixed(0)}%` : "—"} />
 </div>
 </CardBody>
 </Card>

 {/* Board satisfaction + Fan approval */}
 <Card>
 <CardHeader>{t('manager.boardStatus')}</CardHeader>
 <CardBody>
 <div className="grid grid-cols-2 gap-4">
 {/* Board */}
 <div>
 <div className="text-center mb-2">
 <p className="font-heading font-bold text-3xl text-ink">{mgr.satisfaction}%</p>
 <p className="text-[10px] text-ink-faint font-heading uppercase tracking-wider mt-0.5">{t('manager.board')}</p>
 </div>
 <ProgressBar value={mgr.satisfaction} variant="auto" size="md" />
 <p className="text-[10px] text-ink-faint text-center mt-2">
 {mgr.satisfaction >= 80 ? t('manager.boardVeryPleased') :
 mgr.satisfaction >= 50 ? t('manager.boardSatisfied') :
 mgr.satisfaction >= 30 ? t('manager.boardConcerns') :
 t('manager.boardThreat')}
 </p>
 </div>
 {/* Fans */}
 <div>
 <div className="text-center mb-2">
 <p className="font-heading font-bold text-3xl text-ink">{mgr.fan_approval ?? 50}%</p>
 <p className="text-[10px] text-ink-faint font-heading uppercase tracking-wider mt-0.5">{t('manager.fans')}</p>
 </div>
 <ProgressBar value={mgr.fan_approval ?? 50} variant="auto" size="md" />
 <p className="text-[10px] text-ink-faint text-center mt-2">
 {(mgr.fan_approval ?? 50) >= 80 ? t('manager.fanAdore') :
 (mgr.fan_approval ?? 50) >= 60 ? t('manager.fanBehind') :
 (mgr.fan_approval ?? 50) >= 40 ? t('manager.fanMixed') :
 (mgr.fan_approval ?? 50) >= 20 ? t('manager.fanRestless') :
 t('manager.fanUnrest')}
 </p>
 </div>
 </div>
 </CardBody>
 </Card>

 {/* Career history */}
 {mgr.career_history.length > 0 && (
 <Card className="md:col-span-3">
 <CardHeader>{t('manager.careerHistory')}</CardHeader>
 <CardBody className="p-0">
 <div className="px-4 pt-4 pb-2">
 <ManagerCareerChart
 history={mgr.career_history}
 wonLabel={t('manager.wins')}
 drawnLabel={t('manager.draws')}
 lostLabel={t('manager.losses')}
 />
 </div>
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-carbon-2 border-b border-slate-line text-xs">
 <th className="py-3 px-5 font-heading font-bold uppercase tracking-wider text-ink-dim">{t('manager.club')}</th>
 <th className="py-3 px-5 font-heading font-bold uppercase tracking-wider text-ink-dim">{t('manager.period')}</th>
 <th className="py-3 px-5 font-heading font-bold uppercase tracking-wider text-ink-dim text-center">{t('common.played')}</th>
 <th className="py-3 px-5 font-heading font-bold uppercase tracking-wider text-ink-dim text-center">{t('common.won')}</th>
 <th className="py-3 px-5 font-heading font-bold uppercase tracking-wider text-ink-dim text-center">{t('common.drawn')}</th>
 <th className="py-3 px-5 font-heading font-bold uppercase tracking-wider text-ink-dim text-center">{t('common.lost')}</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-line-soft dark:divide-slate-line">
 {mgr.career_history.map((entry, i) => {
 const canSelectTeam =
 !!onSelectTeam &&
 gameState.teams.some((team) => team.id === entry.team_id);
 const historyRow = (
 <tr
 key={i}
 data-testid={`manager-history-${entry.team_id}`}
 onClick={canSelectTeam ? () => onSelectTeam(entry.team_id) : undefined}
 onKeyDown={canSelectTeam ? (event) => {
 if (event.key === "Enter" || event.key === " ") {
 event.preventDefault();
 onSelectTeam(entry.team_id);
 }
 } : undefined}
 role={canSelectTeam ? "button" : undefined}
 tabIndex={canSelectTeam ? 0 : undefined}
 className={canSelectTeam ? "cursor-pointer hover:bg-carbon-2 hover:bg-carbon-3/30 transition-colors" : undefined}
 >
 <td className="py-3 px-5 font-semibold text-sm text-ink text-ink">{entry.team_name}</td>
 <td className="py-3 px-5 text-sm text-ink-dim">{entry.start_date.substring(0, 4)} — {entry.end_date?.substring(0, 4) || t('common.present')}</td>
 <td className="py-3 px-5 text-center text-sm text-ink-dim tabular-nums">{entry.matches}</td>
 <td className="py-3 px-5 text-center text-sm text-ink-dim tabular-nums">{entry.wins}</td>
 <td className="py-3 px-5 text-center text-sm text-ink-dim tabular-nums">{entry.draws}</td>
 <td className="py-3 px-5 text-center text-sm text-ink-dim tabular-nums">{entry.losses}</td>
 </tr>
 );

 if (!canSelectTeam) {
 return historyRow;
 }

 return (
 <ContextMenu
 items={[buildViewTeamMenuItem(t, () => onSelectTeam(entry.team_id))]}
 key={i}
 >
 {historyRow}
 </ContextMenu>
 );
 })}
 </tbody>
 </table>
 </CardBody>
 </Card>
 )}
 </div>
 );
}

function StatBlock({ label, value }: { label: string; value: number | string }) {
 return (
 <div className="text-center p-3 bg-carbon-2 rounded">
 <p className="font-heading font-bold text-xl text-ink tabular-nums">{value}</p>
 <p className="text-xs text-ink-faint font-heading uppercase tracking-wider mt-0.5">{label}</p>
 </div>
 );
}
