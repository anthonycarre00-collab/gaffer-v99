import { useState } from 'react';
import { usePlayerMeaning } from '../../store/meaningStore';
import { Card } from './Card';
import { Badge } from './Badge';
import { ProgressBar } from './ProgressBar';

export function PlayerMeaningCard({ playerId }: { playerId: string | null | undefined }) {
  const { snapshot, loading } = usePlayerMeaning(playerId);
  const [show, setShow] = useState(false);
  const [exp, setExp] = useState<string | null>(null);
  if (!playerId) return <Card className="p-4 text-center text-sm text-gray-500">No player selected.</Card>;
  if (loading || !snapshot) return <Card className="p-4 text-center text-sm text-gray-500">Loading...</Card>;
  return (
    <Card className="p-5 space-y-4">
      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{snapshot.display_name}</h2>
          <span className="text-xs text-gray-500">{snapshot.club}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-2">
          <Badge variant="primary">{snapshot.archetype_label}</Badge>
          <Badge variant="neutral">{snapshot.role_identity_label}</Badge>
        </div>
      </div>
      <div className="rounded border border-gray-200 p-3 dark:border-gray-700 cursor-help" onClick={() => setExp(exp === 'stability' ? null : 'stability')}>
        <div className="flex justify-between"><span className="text-xs uppercase text-gray-500">Stability</span><span className="text-sm font-semibold text-gray-900 dark:text-white">{snapshot.stability_label}</span></div>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{snapshot.stability_description}</p>
        {exp === 'stability' && snapshot.stability_explanation.entries.map((e,i) => <div key={i} className="text-xs text-gray-400 mt-1">• {e.reason}</div>)}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><div className="text-xs uppercase text-gray-500">Form</div><div className="font-medium text-gray-900 dark:text-white">{snapshot.current_form_label}</div></div>
        <div><div className="text-xs uppercase text-gray-500">Confidence</div><div className="font-medium text-gray-900 dark:text-white">{snapshot.confidence_label}</div></div>
        <div><div className="text-xs uppercase text-gray-500">Fatigue</div><div className="font-medium text-gray-900 dark:text-white">{snapshot.fatigue_label}</div></div>
        <div><div className="text-xs uppercase text-gray-500">Morale</div><div className="font-medium text-gray-900 dark:text-white">{snapshot.morale_state}</div></div>
      </div>
      <div className="rounded border border-gray-200 p-3 dark:border-gray-700 cursor-help" onClick={() => setExp(exp === 'pressure' ? null : 'pressure')}>
        <div className="text-xs uppercase text-gray-500">Pressure Response</div>
        <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{snapshot.pressure_response_type === 'Thrives' ? 'Thrives under pressure' : snapshot.pressure_response_type === 'Channels' ? 'Channels pressure' : snapshot.pressure_response_type === 'Folds' ? 'Folds under pressure' : 'Escalates (high risk)'}</div>
        {exp === 'pressure' && snapshot.pressure_response_explanation.entries.map((e,i) => <div key={i} className="text-xs text-gray-400 mt-1">• {e.reason}</div>)}
      </div>
      <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
        <button onClick={() => setShow(!show)} className="text-xs text-blue-600 hover:underline">{show ? 'Hide' : 'Show'} Advanced View</button>
        {show && (
          <div className="mt-3 space-y-3 text-xs">
            {[
              {label:'The Body',avg:snapshot.spreadsheet_attributes.body_avg,attrs:[['Pace',snapshot.spreadsheet_attributes.pace],['Burst',snapshot.spreadsheet_attributes.burst],['Engine',snapshot.spreadsheet_attributes.engine],['Power',snapshot.spreadsheet_attributes.power],['Agility',snapshot.spreadsheet_attributes.agility]]},
              {label:'The Ball',avg:snapshot.spreadsheet_attributes.ball_avg,attrs:[['Passing',snapshot.spreadsheet_attributes.passing],['Distribution',snapshot.spreadsheet_attributes.distribution],['Touch',snapshot.spreadsheet_attributes.touch],['Finishing',snapshot.spreadsheet_attributes.finishing],['Defending',snapshot.spreadsheet_attributes.defending],['Aerial',snapshot.spreadsheet_attributes.aerial]]},
              {label:'The Head',avg:snapshot.spreadsheet_attributes.head_avg,attrs:[['Anticipation',snapshot.spreadsheet_attributes.anticipation],['Vision',snapshot.spreadsheet_attributes.vision],['Decisions',snapshot.spreadsheet_attributes.decisions],['Composure',snapshot.spreadsheet_attributes.composure],['Leadership',snapshot.spreadsheet_attributes.leadership]]},
              {label:'The Gloves',avg:snapshot.spreadsheet_attributes.gloves_avg,attrs:[['Shot Stopping',snapshot.spreadsheet_attributes.shot_stopping],['Commanding',snapshot.spreadsheet_attributes.commanding],['Playing Out',snapshot.spreadsheet_attributes.playing_out]]},
            ].map(g => (
              <div key={g.label}>
                <div className="flex justify-between mb-1"><span className="font-semibold text-gray-700 dark:text-gray-300">{g.label}</span><span className="text-gray-500">avg {g.avg}</span></div>
                {g.attrs.map(([n,v]) => (
                  <div key={n} className="flex items-center gap-2 mb-1">
                    <span className="w-24 text-gray-600 dark:text-gray-400">{n}</span>
                    <ProgressBar value={Math.round((v as number / 99) * 100)} className="flex-1" />
                    <span className="w-8 text-right font-mono text-gray-900 dark:text-white">{v}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between"><span className="font-semibold">Overall</span><span className="font-bold">{snapshot.spreadsheet_attributes.overall}</span></div>
          </div>
        )}
      </div>
    </Card>
  );
}
