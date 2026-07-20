import type { JSX } from "react";
import { useMemo, useState } from "react";
import { Flame, Plus, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PlayerData } from "../../store/gameStore";
import {
  RIVALRY_INTENSITY_META,
  useRivalryStore,
  type PlayerRivalry,
  type RivalryIntensity,
} from "../../store/rivalryStore";
import { Button } from "../ui";

/**
 * V100 Issue #30: Player rivalry card.
 *
 * Surfaces on the PlayerProfile under the meaning snapshot card. Shows:
 * - Active rivalries involving this player (with rival name, intensity,
 *   reason, remove button)
 * - "Add Rivalry" button that opens an inline form to pick a squad-mate
 *   or opponent, set intensity (Spark/Simmer/Boil), and add a reason
 *
 * Rivalries are stored client-side via rivalryStore (localStorage). They
 * drive future match commentary hooks ("X settles the score with Y")
 * and news story triggers — backend wiring comes later, the data layer
 * is in place now.
 */

interface PlayerProfileRivalriesCardProps {
  player: PlayerData;
  squad: PlayerData[];
}

const INTENSITY_OPTIONS: RivalryIntensity[] = ["spark", "simmer", "boil"];

function intensityIcon(intensity: RivalryIntensity): JSX.Element {
  const className = "h-3 w-3";
  switch (intensity) {
    case "boil":
      return <Flame className={`${className} text-danger-500`} />;
    case "simmer":
      return <Flame className={`${className} text-accent-500`} />;
    case "spark":
    default:
      return <Flame className={`${className} text-ink-faint`} />;
  }
}

export default function PlayerProfileRivalriesCard({
  player,
  squad,
}: PlayerProfileRivalriesCardProps): JSX.Element {
  const { t } = useTranslation();
  const rivalries = useRivalryStore((s) => s.rivalries);
  const addRivalry = useRivalryStore((s) => s.addRivalry);
  const removeRivalry = useRivalryStore((s) => s.removeRivalry);

  const [isAdding, setIsAdding] = useState(false);
  const [draftRivalId, setDraftRivalId] = useState("");
  const [draftIntensity, setDraftIntensity] =
    useState<RivalryIntensity>("simmer");
  const [draftReason, setDraftReason] = useState("");

  const playerRivalries = useMemo(
    () =>
      rivalries.filter(
        (r) => r.player_a_id === player.id || r.player_b_id === player.id,
      ),
    [rivalries, player.id],
  );

  const squadById = useMemo(
    () => new Map(squad.map((p) => [p.id, p])),
    [squad],
  );

  const eligibleRivals = useMemo(
    () => squad.filter((p) => p.id !== player.id),
    [squad, player.id],
  );

  function resolveRival(rivalry: PlayerRivalry): { id: string; name: string } | null {
    const otherId =
      rivalry.player_a_id === player.id
        ? rivalry.player_b_id
        : rivalry.player_a_id;
    const other = squadById.get(otherId);
    if (other) {
      return {
        id: other.id,
        name: other.match_name || other.full_name,
      };
    }
    return { id: otherId, name: t("playerProfile.unknownRival", { defaultValue: "Unknown player" }) };
  }

  function handleSave(): void {
    if (!draftRivalId) return;
    addRivalry(player.id, draftRivalId, draftIntensity, draftReason);
    setDraftRivalId("");
    setDraftIntensity("simmer");
    setDraftReason("");
    setIsAdding(false);
  }

  function handleCancel(): void {
    setDraftRivalId("");
    setDraftIntensity("simmer");
    setDraftReason("");
    setIsAdding(false);
  }

  return (
    <div className="rounded border border-slate-line bg-carbon-1">
      <div className="border-b border-slate-line-soft px-3 py-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[11px] font-heading font-bold uppercase tracking-[0.22em] text-ink-faint">
          <Flame className="h-3.5 w-3.5 text-accent-500" />
          {t("playerProfile.rivalries", { defaultValue: "Rivalries" })}
        </h3>
        {!isAdding && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsAdding(true)}
            className="!px-2 !py-0.5 !text-[10px]"
          >
            <Plus className="h-3 w-3" />
            {t("playerProfile.addRivalry", { defaultValue: "Add" })}
          </Button>
        )}
      </div>

      <div className="p-3 space-y-2">
        {playerRivalries.length === 0 && !isAdding && (
          <p className="py-3 text-center text-xs text-ink-faint italic">
            {t("playerProfile.noRivalries", {
              defaultValue: "No noted rivalries yet.",
            })}
          </p>
        )}

        {playerRivalries.map((rivalry) => {
          const rival = resolveRival(rivalry);
          if (!rival) return null;
          const meta = RIVALRY_INTENSITY_META[rivalry.intensity];
          return (
            <div
              key={rivalry.id}
              className={`flex items-start gap-2 rounded border ${meta.tone} px-2 py-1.5`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {intensityIcon(rivalry.intensity)}
                  <span className="text-sm font-semibold text-ink truncate">
                    {rival.name}
                  </span>
                  <span className="text-[9px] font-heading font-bold uppercase tracking-wider opacity-80">
                    {meta.label}
                  </span>
                </div>
                {rivalry.reason && (
                  <p className="mt-0.5 text-[11px] text-ink-dim italic line-clamp-2">
                    "{rivalry.reason}"
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeRivalry(rivalry.id)}
                aria-label={t("common.remove", { defaultValue: "Remove" })}
                className="shrink-0 rounded p-1 text-ink-faint hover:bg-danger-500/10 hover:text-danger-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        {isAdding && (
          <div className="rounded border border-accent-300/60 bg-carbon-2 p-2 space-y-2">
            <div>
              <label className="text-[10px] font-heading font-bold uppercase tracking-wider text-ink-faint block mb-1">
                {t("playerProfile.rivalPlayer", { defaultValue: "Rival player" })}
              </label>
              <select
                value={draftRivalId}
                onChange={(e) => setDraftRivalId(e.target.value)}
                className="w-full rounded border border-slate-line bg-carbon-1 px-2 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent-500/30"
              >
                <option value="">
                  {t("playerProfile.selectRival", { defaultValue: "Select..." })}
                </option>
                {eligibleRivals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.match_name || p.full_name} ({p.position})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-heading font-bold uppercase tracking-wider text-ink-faint block mb-1">
                {t("playerProfile.intensity", { defaultValue: "Intensity" })}
              </label>
              <div className="flex gap-1">
                {INTENSITY_OPTIONS.map((opt) => {
                  const meta = RIVALRY_INTENSITY_META[opt];
                  const isActive = draftIntensity === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setDraftIntensity(opt)}
                      className={`flex-1 rounded border px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                        isActive
                          ? "border-accent-400 bg-accent-500/15 text-accent-600 dark:text-accent-300"
                          : "border-slate-line-soft bg-carbon-1 text-ink-dim hover:border-accent-300/60"
                      }`}
                      title={meta.description}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-heading font-bold uppercase tracking-wider text-ink-faint block mb-1">
                {t("playerProfile.reason", { defaultValue: "Reason (optional)" })}
              </label>
              <textarea
                value={draftReason}
                onChange={(e) => setDraftReason(e.target.value)}
                rows={2}
                maxLength={140}
                placeholder={t("playerProfile.reasonPlaceholder", {
                  defaultValue: "e.g. scored winner in cup final",
                })}
                className="w-full rounded border border-slate-line bg-carbon-1 px-2 py-1 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent-500/30"
              />
              <p className="mt-0.5 text-right text-[9px] text-ink-faint">
                {draftReason.length}/140
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                className="!text-[11px]"
              >
                <X className="h-3 w-3" />
                {t("common.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleSave}
                disabled={!draftRivalId}
                className="!text-[11px]"
              >
                {t("common.save", { defaultValue: "Save" })}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
