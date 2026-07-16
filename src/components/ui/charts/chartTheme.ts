import { useContext } from "react";
import { ThemeContext } from "../../../context/ThemeContext";

export interface ChartTheme {
  primary: string;
  secondary: string;
  danger: string;
  success: string;
  gridColor: string;
  axisColor: string;
  textColor: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

// V99.10 UI-2: Replaced Tailwind emerald/indigo with Gaffer palette:
//   primary   = Pitch Green (--color-primary-500 = #2d5a3d)
//   secondary = Brass       (--color-accent-500  = #b8924a)
//   danger    = Mahogany    (--color-danger-500  = #7a2e1f)
//   success   = Pitch Green (lighter shade)
// Previously used #10b981 (Tailwind emerald) and #6366f1 (Tailwind indigo)
// which made every chart look like a generic SaaS dashboard instead of a
// Gaffer dugout broadsheet.
const DARK_THEME: ChartTheme = {
  primary: "#2d5a3d",   // Pitch Green (primary-500)
  secondary: "#b8924a", // Brass (accent-500)
  danger: "#7a2e1f",    // Mahogany (danger-500)
  success: "#4a7b5e",   // Pitch Green lighter (primary-400)
  gridColor: "#2a3530", // navy-600 equivalent
  axisColor: "#6b6660", // concrete
  textColor: "#e8e4dc", // chalk
  tooltipBg: "#1d2620", // navy-700
  tooltipBorder: "#2a3530",
  tooltipText: "#e8e4dc", // chalk
};

const LIGHT_THEME: ChartTheme = {
  primary: "#2d5a3d",   // Pitch Green (primary-500)
  secondary: "#b8924a", // Brass (accent-500)
  danger: "#7a2e1f",    // Mahogany (danger-500)
  success: "#4a7b5e",   // Pitch Green lighter (primary-400)
  gridColor: "#e8e4dc", // chalk
  axisColor: "#6b6660", // concrete
  textColor: "#1a1a1a", // ink
  tooltipBg: "#ffffff",
  tooltipBorder: "#e8e4dc", // chalk
  tooltipText: "#1a1a1a",   // ink
};

export function useChartTheme(): ChartTheme {
  const ctx = useContext(ThemeContext);
  const isDark = ctx?.isDark ?? true;
  return isDark ? DARK_THEME : LIGHT_THEME;
}
