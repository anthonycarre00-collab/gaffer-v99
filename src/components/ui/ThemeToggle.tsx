import { Sun, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";

interface ThemeToggleProps {
 className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
 const { t } = useTranslation();
 const { isDark, toggleTheme } = useTheme();
 const toggleThemeLabel = isDark
 ? t("settings.switchToLightMode")
 : t("settings.switchToDarkMode");

 return (
 <button
 onClick={toggleTheme}
 className={`p-2 rounded text-ink-faint hover:text-ink hover:bg-carbon-3 hover:bg-carbon-3 hover:cursor-pointer transition-all duration-200 ${className}`}
 title={toggleThemeLabel}
 aria-label={toggleThemeLabel}
 >
 {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
 </button>
 );
}
