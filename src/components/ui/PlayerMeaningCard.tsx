import { useState } from 'react';
import { usePlayerMeaning } from '../../store/meaningStore';
import { Card } from './Card';
import { Badge } from './Badge';
import { ProgressBar } from './ProgressBar';
import { shortOvrLabel, interpretOvr } from '../../lib/ovrInterpretation';
import { useTranslation } from 'react-i18next';

export function PlayerMeaningCard({ playerId }: { playerId: string | null | undefined }) {
 const { snapshot, loading } = usePlayerMeaning(playerId);
 const { t } = useTranslation();
 const [show, setShow] = useState(false);
 const [exp, setExp] = useState<string | null>(null);

 if (!playerId) {
 return (
 <Card className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
 {t('meaning.noPlayerSelected')}
 </Card>
 );
 }
 if (loading || !snapshot) {
 return (
 <Card className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
 {t('meaning.loading')}
 </Card>
 );
 }

 const pressureLabel = t(`meaning.pressureResponseTypes.${snapshot.pressure_response_type}`, {
 defaultValue: snapshot.pressure_response_type,
 });

 // Scouting knowledge — show reveal tier badge if player has been scouted
 const scoutingTier = snapshot.scouting_knowledge?.reveal_tier;
 const scoutingBadge = scoutingTier ? (
 <Badge variant={scoutingTier === 'Complete' ? 'success' : scoutingTier === 'Detailed' ? 'accent' : 'neutral'}>
 Scout: {scoutingTier}
 </Badge>
 ) : null;

 return (
 <Card className="p-5 space-y-4">
 <div>
 <div className="flex items-baseline justify-between">
 <h2 className="text-xl font-bold text-gray-900 dark:text-white">{snapshot.display_name}</h2>
 <span className="text-xs text-gray-500 dark:text-gray-400">{snapshot.club}</span>
 </div>
 <div className="mt-1 flex flex-wrap gap-2">
 <Badge variant="primary">{snapshot.archetype_label}</Badge>
 <Badge variant="neutral">{snapshot.role_identity_label}</Badge>
 {scoutingBadge}
 </div>
 </div>

 <div
 className="rounded border border-gray-200 p-3 dark:border-navy-600 cursor-help"
 onClick={() => setExp(exp === 'stability' ? null : 'stability')}
 >
 <div className="flex justify-between">
 <span className="text-xs uppercase text-gray-500 dark:text-gray-400">{t('meaning.stability')}</span>
 <span className="text-sm font-semibold text-gray-900 dark:text-white">{snapshot.stability_label}</span>
 </div>
 <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{snapshot.stability_description}</p>
 {exp === 'stability' &&
 snapshot.stability_explanation.entries.map((e, i) => (
 <div key={i} className="text-xs text-gray-400 mt-1">• {e.reason}</div>
 ))}
 </div>

 <div className="grid grid-cols-2 gap-3 text-sm">
 <div>
 <div className="text-xs uppercase text-gray-500 dark:text-gray-400">{t('meaning.form')}</div>
 <div className="font-medium text-gray-900 dark:text-white">{snapshot.current_form_label}</div>
 </div>
 <div>
 <div className="text-xs uppercase text-gray-500 dark:text-gray-400">{t('meaning.confidence')}</div>
 <div className="font-medium text-gray-900 dark:text-white">{snapshot.confidence_label}</div>
 </div>
 <div>
 <div className="text-xs uppercase text-gray-500 dark:text-gray-400">{t('meaning.fatigue')}</div>
 <div className="font-medium text-gray-900 dark:text-white">{snapshot.fatigue_label}</div>
 </div>
 <div>
 <div className="text-xs uppercase text-gray-500 dark:text-gray-400">{t('meaning.morale')}</div>
 <div className="font-medium text-gray-900 dark:text-white">{snapshot.morale_state}</div>
 </div>
 </div>

 <div
 className="rounded border border-gray-200 p-3 dark:border-navy-600 cursor-help"
 onClick={() => setExp(exp === 'pressure' ? null : 'pressure')}
 >
 <div className="text-xs uppercase text-gray-500 dark:text-gray-400">{t('meaning.pressureResponse')}</div>
 <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{pressureLabel}</div>
 {exp === 'pressure' &&
 snapshot.pressure_response_explanation.entries.map((e, i) => (
 <div key={i} className="text-xs text-gray-400 mt-1">• {e.reason}</div>
 ))}
 </div>

 {/* Gaffer Phase 2 — Relationship panel */}
 {(snapshot.strongest_positive_link || snapshot.strongest_negative_link) && (
 <div className="rounded border border-gray-200 p-3 dark:border-navy-600">
 <div className="text-xs uppercase text-gray-500 dark:text-gray-400">{t('meaning.relationships')}</div>
 <div className="mt-1 space-y-1 text-xs">
 {snapshot.strongest_positive_link && (
 <div className="flex items-center gap-2">
 <span className="text-success-600 dark:text-success-400">★</span>
 <span className="text-gray-600 dark:text-gray-300">{t('meaning.closestAlly')}</span>
 <span className="font-medium text-gray-900 dark:text-white">{snapshot.strongest_positive_link}</span>
 </div>
 )}
 {snapshot.strongest_negative_link && (
 <div className="flex items-center gap-2">
 <span className="text-danger-600 dark:text-danger-400">⚠</span>
 <span className="text-gray-600 dark:text-gray-300">{t('meaning.tensionWith')}</span>
 <span className="font-medium text-gray-900 dark:text-white">{snapshot.strongest_negative_link}</span>
 </div>
 )}
 {snapshot.chemistry_score !== 0 && (
 <div className="flex items-center gap-2">
 <span className="text-gray-400">◆</span>
 <span className="text-gray-600 dark:text-gray-300">{t('meaning.chemistry')}</span>
 <span className="font-medium text-gray-900 dark:text-white">
 {snapshot.chemistry_score > 0 ? '+' : ''}{snapshot.chemistry_score}
 </span>
 </div>
 )}
 {snapshot.clique_membership.length > 0 && (
 <div className="flex items-center gap-2">
 <span className="text-primary-600 dark:text-primary-400">●</span>
 <span className="text-gray-600 dark:text-gray-300">{t('meaning.clique')}</span>
 <span className="font-medium text-gray-900 dark:text-white">{snapshot.clique_membership.join(', ')}</span>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Narrative traits */}
 {snapshot.narrative_status_tag && snapshot.narrative_status_tag !== 'None' && (
 <div className="flex flex-wrap gap-2">
 <Badge variant="accent">{snapshot.narrative_status_tag}</Badge>
 </div>
 )}

 <div className="border-t border-gray-200 pt-3 dark:border-navy-600">
 <button onClick={() => setShow(!show)} className="text-xs text-primary-600 hover:underline dark:text-primary-400">
 {show ? t('meaning.hideAdvanced') : t('meaning.showAdvanced')}
 </button>
 {show && (
 <div className="mt-3 space-y-3 text-xs">
 {[
 { label: t('playerProfile.attrGroups.body') || 'The Body', avg: snapshot.spreadsheet_attributes.body_avg, attrs: [['Pace', snapshot.spreadsheet_attributes.pace], ['Burst', snapshot.spreadsheet_attributes.burst], ['Engine', snapshot.spreadsheet_attributes.engine], ['Power', snapshot.spreadsheet_attributes.power], ['Agility', snapshot.spreadsheet_attributes.agility]] },
 { label: t('playerProfile.attrGroups.ball') || 'The Ball', avg: snapshot.spreadsheet_attributes.ball_avg, attrs: [['Passing', snapshot.spreadsheet_attributes.passing], ['Distribution', snapshot.spreadsheet_attributes.distribution], ['Touch', snapshot.spreadsheet_attributes.touch], ['Finishing', snapshot.spreadsheet_attributes.finishing], ['Defending', snapshot.spreadsheet_attributes.defending], ['Aerial', snapshot.spreadsheet_attributes.aerial]] },
 { label: t('playerProfile.attrGroups.head') || 'The Head', avg: snapshot.spreadsheet_attributes.head_avg, attrs: [['Anticipation', snapshot.spreadsheet_attributes.anticipation], ['Vision', snapshot.spreadsheet_attributes.vision], ['Decisions', snapshot.spreadsheet_attributes.decisions], ['Composure', snapshot.spreadsheet_attributes.composure], ['Leadership', snapshot.spreadsheet_attributes.leadership]] },
 { label: t('playerProfile.attrGroups.gloves') || 'The Gloves', avg: snapshot.spreadsheet_attributes.gloves_avg, attrs: [['Shot Stopping', snapshot.spreadsheet_attributes.shot_stopping], ['Commanding', snapshot.spreadsheet_attributes.commanding], ['Playing Out', snapshot.spreadsheet_attributes.playing_out]] },
 ].map((g) => (
 <div key={g.label}>
 <div className="flex justify-between mb-1">
 <span className="font-semibold text-gray-700 dark:text-gray-300">{g.label}</span>
 <span className="text-gray-500 dark:text-gray-400">avg {g.avg}</span>
 </div>
 {g.attrs.map(([n, v]) => (
 <div key={n} className="flex items-center gap-2 mb-1">
 <span className="w-24 text-gray-600 dark:text-gray-400">{n}</span>
 <ProgressBar value={Math.round(((v as number) / 99) * 100)} className="flex-1" />
 <span className="w-8 text-right font-mono text-gray-900 dark:text-white">{v}</span>
 </div>
 ))}
 </div>
 ))}
 <div className="border-t pt-2 flex justify-between">
 <span className="font-semibold">{t('common.overall') || 'Overall'}</span>
 <span
 className={`font-bold ${interpretOvr(snapshot.spreadsheet_attributes.overall).colorClass}`}
 title={interpretOvr(snapshot.spreadsheet_attributes.overall).description}
 >
 {shortOvrLabel(snapshot.spreadsheet_attributes.overall)}
 </span>
 </div>
 </div>
 )}
 </div>
 </Card>
 );
}
