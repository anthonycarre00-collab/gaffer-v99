import { useState } from 'react';
import { usePlayerMeaning } from '../../store/meaningStore';
import { Card } from './Card';
import { Badge } from './Badge';
import { useTranslation } from 'react-i18next';

export function PlayerMeaningCard({ playerId }: { playerId: string | null | undefined }) {
 const { snapshot, loading } = usePlayerMeaning(playerId);
 const { t } = useTranslation();
 const [exp, setExp] = useState<string | null>(null);

 if (!playerId) {
 return (
 <Card className="p-4 text-center text-sm text-ink-dim">
 {t('meaning.noPlayerSelected')}
 </Card>
 );
 }
 if (loading || !snapshot) {
 return (
 <Card className="p-4 text-center text-sm text-ink-dim">
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
 <h2 className="text-xl font-bold text-ink">{snapshot.display_name}</h2>
 <span className="text-xs text-ink-dim">{snapshot.club}</span>
 </div>
 <div className="mt-1 flex flex-wrap gap-2">
 <Badge variant="primary">{snapshot.archetype_label}</Badge>
 <Badge variant="neutral">{snapshot.role_identity_label}</Badge>
 {scoutingBadge}
 </div>
 </div>

 <div
 className="rounded border border-slate-line p-3 border-slate-line cursor-help"
 onClick={() => setExp(exp === 'stability' ? null : 'stability')}
 >
 <div className="flex justify-between">
 <span className="text-xs uppercase text-ink-dim">{t('meaning.stability')}</span>
 <span className="text-sm font-semibold text-ink">{snapshot.stability_label}</span>
 </div>
 <p className="mt-1 text-xs text-ink-dim">{snapshot.stability_description}</p>
 {exp === 'stability' &&
 snapshot.stability_explanation.entries.map((e, i) => (
 <div key={i} className="text-xs text-ink-faint mt-1">• {e.reason}</div>
 ))}
 </div>

 <div className="grid grid-cols-2 gap-3 text-sm">
 <div>
 <div className="text-xs uppercase text-ink-dim">{t('meaning.form')}</div>
 <div className="font-medium text-ink">{snapshot.current_form_label}</div>
 </div>
 <div>
 <div className="text-xs uppercase text-ink-dim">{t('meaning.confidence')}</div>
 <div className="font-medium text-ink">{snapshot.confidence_label}</div>
 </div>
 <div>
 <div className="text-xs uppercase text-ink-dim">{t('meaning.fatigue')}</div>
 <div className="font-medium text-ink">{snapshot.fatigue_label}</div>
 </div>
 <div>
 <div className="text-xs uppercase text-ink-dim">{t('meaning.morale')}</div>
 <div className="font-medium text-ink">{snapshot.morale_state}</div>
 </div>
 </div>

 <div
 className="rounded border border-slate-line p-3 border-slate-line cursor-help"
 onClick={() => setExp(exp === 'pressure' ? null : 'pressure')}
 >
 <div className="text-xs uppercase text-ink-dim">{t('meaning.pressureResponse')}</div>
 <div className="mt-1 text-sm font-medium text-ink">{pressureLabel}</div>
 {exp === 'pressure' &&
 snapshot.pressure_response_explanation.entries.map((e, i) => (
 <div key={i} className="text-xs text-ink-faint mt-1">• {e.reason}</div>
 ))}
 </div>

 {/* Gaffer Phase 2 — Relationship panel */}
 {(snapshot.strongest_positive_link || snapshot.strongest_negative_link) && (
 <div className="rounded border border-slate-line p-3 border-slate-line">
 <div className="text-xs uppercase text-ink-dim">{t('meaning.relationships')}</div>
 <div className="mt-1 space-y-1 text-xs">
 {snapshot.strongest_positive_link && (
 <div className="flex items-center gap-2">
 <span className="text-success-600 dark:text-success-400">★</span>
 <span className="text-ink-dim">{t('meaning.closestAlly')}</span>
 <span className="font-medium text-ink">{snapshot.strongest_positive_link}</span>
 </div>
 )}
 {snapshot.strongest_negative_link && (
 <div className="flex items-center gap-2">
 <span className="text-danger-600 dark:text-danger-400">⚠</span>
 <span className="text-ink-dim">{t('meaning.tensionWith')}</span>
 <span className="font-medium text-ink">{snapshot.strongest_negative_link}</span>
 </div>
 )}
 {snapshot.chemistry_score !== 0 && (
 <div className="flex items-center gap-2">
 <span className="text-ink-faint">◆</span>
 <span className="text-ink-dim">{t('meaning.chemistry')}</span>
 <span className="font-medium text-ink">
 {snapshot.chemistry_score > 0 ? '+' : ''}{snapshot.chemistry_score}
 </span>
 </div>
 )}
 {snapshot.clique_membership.length > 0 && (
 <div className="flex items-center gap-2">
 <span className="text-primary-600 dark:text-primary-400">●</span>
 <span className="text-ink-dim">{t('meaning.clique')}</span>
 <span className="font-medium text-ink">{snapshot.clique_membership.join(', ')}</span>
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

 {/* V99.1: Removed the "Show the numbers" / advanced section that displayed
     raw attribute values. This violated the Gaffer constitution which
     states players should NEVER see raw attribute numbers. The
     interpretation layer in PlayerProfileAttributesCard is the only
     place attributes should be displayed, and only as Gaffer-voice
     descriptions (not numbers). */}

 </Card>
 );
}
