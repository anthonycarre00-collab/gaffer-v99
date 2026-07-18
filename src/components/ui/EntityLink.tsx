import type { JSX, MouseEvent } from "react";
import { useTranslation } from "react-i18next";

/**
 * V100 P1 (Issue #35): Reusable entity hyperlink component.
 *
 * Renders a clickable player or team name that navigates to the relevant
 * profile. Used in news articles, match reports, and UI labels to make
 * every mention of a player or team navigable.
 *
 * Styling: subtle brass underline on hover, no underline by default.
 * This matches the Gaffer UI spec (links shouldn't look like web links).
 */

interface EntityLinkProps {
  /** Display name of the entity (player or team). */
  label: string;
  /** Click handler — receives the entity id. */
  onClick: (id: string) => void;
  /** Entity id to pass to onClick. */
  id: string;
  /** Optional extra className for custom styling. */
  className?: string;
  /** Whether to stop propagation on click (useful inside context menus). */
  stopPropagation?: boolean;
}

export function EntityLink({
  label,
  onClick,
  id,
  className = "",
  stopPropagation = true,
}: EntityLinkProps): JSX.Element {
  const { t } = useTranslation();
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) {
      event.stopPropagation();
    }
    onClick(id);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`text-ink hover:text-accent-400 hover:underline underline-offset-2 decoration-accent-500/50 transition-colors cursor-pointer font-medium ${className}`}
      title={t("common.clickToView", { defaultValue: "Click to view profile" })}
      aria-label={`${label} — ${t("common.clickToView", { defaultValue: "Click to view profile" })}`}
    >
      {label}
    </button>
  );
}

/**
 * V100 P1 (Issue #35): Helper to render a player name as a hyperlink.
 * Falls back to plain text when no onSelectPlayer handler is provided.
 */
export function PlayerLink({
  name,
  playerId,
  onSelectPlayer,
  className,
}: {
  name: string;
  playerId: string;
  onSelectPlayer?: (id: string) => void;
  className?: string;
}): JSX.Element {
  if (!onSelectPlayer) {
    return <span className={className}>{name}</span>;
  }
  return (
    <EntityLink
      label={name}
      id={playerId}
      onClick={onSelectPlayer}
      className={className}
    />
  );
}

/**
 * V100 P1 (Issue #35): Helper to render a team name as a hyperlink.
 * Falls back to plain text when no onSelectTeam handler is provided.
 */
export function TeamLink({
  name,
  teamId,
  onSelectTeam,
  className,
}: {
  name: string;
  teamId: string;
  onSelectTeam?: (id: string) => void;
  className?: string;
}): JSX.Element {
  if (!onSelectTeam) {
    return <span className={className}>{name}</span>;
  }
  return (
    <EntityLink
      label={name}
      id={teamId}
      onClick={onSelectTeam}
      className={className}
    />
  );
}
