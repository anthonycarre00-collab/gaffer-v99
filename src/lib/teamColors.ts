/**
 * V99.1 Team Color Theming System.
 *
 * When the user selects a club, this system extracts the team's primary
 * and secondary colors and applies them as accent colors throughout the UI.
 *
 * The theming is subtle — it changes the sidebar accent, button hover
 * colors, and card top-borders to match the team's identity. It does NOT
 * override the core Gaffer palette (brass/pitch-green) — it layers the
 * team color on top as a secondary accent.
 *
 * Usage:
 *   import { useTeamColors } from "../lib/teamColors";
 *   const { primaryColor, secondaryColor, accentClass } = useTeamColors();
 *
 * The hook reads the current game state from the zustand store and
 * extracts the user's team colors. If no team is selected or colors
 * are missing, it falls back to the Gaffer defaults.
 */

import { useMemo } from "react";
import { useGameStore } from "../store/gameStore";

export interface TeamColors {
 primary: string;
 secondary: string;
 /** CSS class for primary color accent (e.g. text, border) */
 primaryTextClass: string;
 /** CSS class for primary background */
 primaryBgClass: string;
 /** Whether team colors are available */
 hasTeamColors: boolean;
}

const DEFAULT_COLORS: TeamColors = {
 primary: "#1a5d3a",
 secondary: "#c9972e",
 primaryTextClass: "text-primary-500",
 primaryBgClass: "bg-primary-500",
 hasTeamColors: false,
};

/**
 * Convert a hex color to a CSS RGB string for inline styles.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
 const cleaned = hex.replace("#", "");
 if (cleaned.length !== 6) return null;
 const r = parseInt(cleaned.slice(0, 2), 16);
 const g = parseInt(cleaned.slice(2, 4), 16);
 const b = parseInt(cleaned.slice(4, 6), 16);
 if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
 return { r, g, b };
}

/**
 * Determine if a color is light or dark (for contrast).
 */
function isLight(hex: string): boolean {
 const rgb = hexToRgb(hex);
 if (!rgb) return false;
 const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
 return luminance > 0.5;
}

export function useTeamColors(): TeamColors {
 const gameState = useGameStore((s) => s.gameState);

 return useMemo(() => {
 if (!gameState) return DEFAULT_COLORS;

 const userTeamId = gameState.manager?.team_id;
 if (!userTeamId) return DEFAULT_COLORS;

 const team = gameState.teams.find((t) => t.id === userTeamId);
 if (!team || !team.colors) return DEFAULT_COLORS;

 const primary = team.colors.primary || "#1a5d3a";
 const secondary = team.colors.secondary || "#c9972e";

 return {
 primary,
 secondary,
 primaryTextClass: "", // Use inline styles for custom colors
 primaryBgClass: "",
 hasTeamColors: true,
 };
 }, [gameState]);
}

/**
 * Get an inline style object for the team's primary color.
 * Use this when the Tailwind color classes don't apply (custom colors).
 */
export function useTeamColorStyles() {
 const colors = useTeamColors();

 return useMemo(
 () => ({
 primaryColor: colors.primary,
 secondaryColor: colors.secondary,
 primaryStyle: { color: colors.primary },
 primaryBgStyle: { backgroundColor: colors.primary },
 primaryBorderStyle: { borderColor: colors.primary },
 secondaryStyle: { color: colors.secondary },
 secondaryBgStyle: { backgroundColor: colors.secondary },
 isPrimaryLight: isLight(colors.primary),
 }),
 [colors],
 );
}
