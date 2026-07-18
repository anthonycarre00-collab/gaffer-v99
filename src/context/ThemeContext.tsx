import { createContext, useContext, useEffect, type ReactNode } from "react";

// V99.11: Dark-first per UI spec §0.5. Theme is permanently "dark".
// The ThemeToggle is hidden in the UI. The toggleTheme function is kept
// as a no-op for backward compat with components that reference it.

type Theme = "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // V99.11: Always add .dark class — dark-first per UI spec.
    const root = document.documentElement;
    root.classList.add("dark");
    localStorage.setItem("ofm-theme", "dark");
  }, []);

  // V99.11: toggleTheme is a no-op — dark is the only theme.
  const toggleTheme = () => {};

  return (
    <ThemeContext.Provider value={{ theme: "dark", toggleTheme, isDark: true }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
