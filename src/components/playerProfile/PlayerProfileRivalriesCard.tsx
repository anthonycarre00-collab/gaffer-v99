import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";

/**
 * V100 Issue #30 (rework): Player rivalry card — READ-ONLY display.
 *
 * Rivalries are now AUTO-CREATED by the engine in
 * `trigger_cross_team_rivalries` (post_match.rs). The manager never adds
 * or removes them — they emerge from match flashpoints (Hard/Reckless
 * fouls, red cards, dribbles tackled, headers won/lost, goals scored
 * against, "nemesis" pattern from losing to the same player).
 *
 * This card just displays whatever the engine has created. Fetches from
 * the new `get_player_rivalries` Tauri command.
 */

interface PlayerRivalryInfo {
  rival_id: string;
  rival_name: string;
  rival_position: string;
  rival_team_name: string;
  /** -100 (hatred) to 0 (cool) — engine only sets this for actual rivalries */
  intensity: number;
  narrative_tags: string[];
  started_date: string | null;
}

interface PlayerProfileRivalriesCardProps {
  player: { id: string };
}

/** Map intensity (-100..0) to a label + tone class. */
function intensityTone(intensity: number): {
  label: string;
  tone: string;
} {
  if (intensity <= -75) {
    return {
      label: "Seething",
      tone: "text-danger-600 bg-danger-500/15 border-danger-400/60",
    };
  }
  if (intensity <= -50) {
    return {
      label: "Bitter",
      tone: "text-danger-600 bg-danger-500/10 border-danger-400/40",
    };
  }
  if (intensity <= -25) {
    return {
      label: "Heated",
      tone: "text-accent-600 bg-accent-500/10 border-accent-300/60",
    };
  }
  return {
    label: "Simmering",
    tone: "text-ink-dim bg-carbon-2 border-slate-line",
  };
}

/** Convert a narrative tag like "Reckless Foul" into a friendly label. */
function tagLabel(tag: string): string {
  const map: Record<string, string> = {
    "Reckless Foul": "Reckless foul",
    "Hard Foul": "Hard foul",
    "Soft Foul": "Soft foul",
    "Tackled Hard": "Tackled hard",
    "Aerial Battle": "Aerial battle",
    "Red Card Flashpoint": "Red card flashpoint",
    Nemesis: "Nemesis",
    Partnership: "Partnership",
  };
  return map[tag] ?? tag;
}

export default function PlayerProfileRivalriesCard({
  player,
}: PlayerProfileRivalriesCardProps): JSX.Element {
  const { t } = useTranslation();
  const [rivalries, setRivalries] = useState<PlayerRivalryInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // V100: Defensive — invoke may be undefined in test env. Wrap with
    // Promise.resolve so undefined → rejected promise → .catch handles
    // cleanly without throwing "Cannot read properties of undefined".
    const fetchPromise = invoke<PlayerRivalryInfo[]>("get_player_rivalries", {
      playerId: player.id,
    });
    Promise.resolve(fetchPromise)
      .then((data) => {
        if (cancelled) return;
        setRivalries(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setRivalries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [player.id]);

  return (
    <div className="rounded border border-slate-line bg-carbon-1">
      <div className="border-b border-slate-line-soft px-3 py-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-heading font-bold uppercase tracking-[0.22em] text-ink-faint">
          <Flame className="h-3.5 w-3.5 text-danger-500" />
          {t("playerProfile.rivalries", { defaultValue: "Rivalries" })}
        </h3>
      </div>

      <div className="p-3 space-y-2">
        {loading && (
          <p className="py-3 text-center text-xs text-ink-faint italic">
            {t("common.loading", { defaultValue: "Loading..." })}
          </p>
        )}

        {!loading && rivalries.length === 0 && (
          <p className="py-3 text-center text-xs text-ink-faint italic">
            {t("playerProfile.noRivalries", {
              defaultValue:
                "No notable rivalries yet. These emerge from match flashpoints — bad tackles, red cards, derby heat.",
            })}
          </p>
        )}

        {!loading &&
          rivalries.map((rivalry) => {
            const tone = intensityTone(rivalry.intensity);
            return (
              <div
                key={rivalry.rival_id}
                className={`flex items-start gap-2 rounded border ${tone.tone} px-2 py-1.5`}
              >
                <Flame className="mt-0.5 h-3 w-3 shrink-0 opacity-80" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-ink truncate">
                      {rivalry.rival_name}
                    </span>
                    <span className="text-[10px] text-ink-faint">
                      {rivalry.rival_position} · {rivalry.rival_team_name}
                    </span>
                    <span className="text-[9px] font-heading font-bold uppercase tracking-wider opacity-80">
                      {tone.label}
                    </span>
                  </div>
                  {rivalry.narrative_tags.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {rivalry.narrative_tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-carbon-1/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-dim"
                        >
                          {tagLabel(tag)}
                        </span>
                      ))}
                    </div>
                  )}
                  {rivalry.started_date && (
                    <p className="mt-0.5 text-[9px] text-ink-faint italic">
                      {t("playerProfile.since", { defaultValue: "Since" })}{" "}
                      {rivalry.started_date}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

        {!loading && rivalries.length > 0 && (
          <p className="pt-1 text-[9px] text-ink-faint italic">
            {t("playerProfile.rivalriesAutoGenerated", {
              defaultValue:
                "Rivalries form automatically from match flashpoints. The manager cannot create or remove them.",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
