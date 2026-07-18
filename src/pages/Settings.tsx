import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useSettingsStore, AppSettings } from "../store/settingsStore";
import { useTheme } from "../context/ThemeContext";
import { ThemeToggle, Select } from "../components/ui";
import { SUPPORTED_LANGUAGES, changeAppLanguage } from "../i18n";
import {
 ArrowLeft,
 Monitor,
 Moon,
 Sun,
 Sliders,
 Save,
 Zap,
 Trash2,
 Download,
 Globe,
 Type,
 Maximize,
 Minimize,
 Package,
 ChevronRight,
} from "lucide-react";

const CURRENCY_OPTIONS = [
 { value: "EUR", labelKey: "settings.currencyOptions.eur", symbol: "€" },
 { value: "GBP", labelKey: "settings.currencyOptions.gbp", symbol: "£" },
 { value: "USD", labelKey: "settings.currencyOptions.usd", symbol: "$" },
] as const;

const THEME_OPTION_KEYS = ["light", "dark", "system"] as const;
const MATCH_MODE_KEYS = ["live", "spectator", "delegate"] as const;
const MATCH_SPEED_KEYS = ["slow", "normal", "fast"] as const;
const UI_SCALE_KEYS = ["small", "normal", "large", "xlarge"] as const;

export default function Settings() {
 const navigate = useNavigate();
 const location = useLocation();
 const { t, i18n } = useTranslation();
 const { settings, loaded, loadSettings, updateSettings } = useSettingsStore();
 const { theme, toggleTheme } = useTheme();
 const [confirmClear, setConfirmClear] = useState(false);
 const [clearSuccess, setClearSuccess] = useState(false);
 const [exportPath, setExportPath] = useState<string | null>(null);
 const [isFullscreen, setIsFullscreen] = useState(
 !!document.fullscreenElement,
 );

 // Where to go back to
 const returnTo = (location.state as { from?: string })?.from || "/";

 useEffect(() => {
 if (!loaded) loadSettings();
 }, [loaded, loadSettings]);

 // Track fullscreen state
 useEffect(() => {
 const handler = () => setIsFullscreen(!!document.fullscreenElement);
 document.addEventListener("fullscreenchange", handler);
 return () => document.removeEventListener("fullscreenchange", handler);
 }, []);

 const toggleFullscreen = async () => {
 if (document.fullscreenElement) {
 await document.exitFullscreen();
 } else {
 await document.documentElement.requestFullscreen();
 }
 };

 // Sync language with i18n when settings are loaded
 useEffect(() => {
 if (loaded && settings.language && settings.language !== i18n.language) {
 void changeAppLanguage(settings.language);
 }
 }, [loaded, settings.language, i18n]);

 const handleUpdate = (partial: Partial<AppSettings>) => {
 updateSettings(partial);

 // Sync theme with ThemeContext
 if (partial.theme) {
 const desired =
 partial.theme === "system"
 ? window.matchMedia("(prefers-color-scheme: dark)").matches
 ? "dark"
 : "light"
 : partial.theme;
 if (desired !== theme) toggleTheme();
 }

 // Sync language with i18n
 if (partial.language) {
 void changeAppLanguage(partial.language);
 }
 };

 const handleClearSaves = async () => {
 try {
 await invoke("clear_all_saves");
 setClearSuccess(true);
 setConfirmClear(false);
 setTimeout(() => setClearSuccess(false), 3000);
 } catch (err) {
 console.error("Failed to clear saves:", err);
 }
 };

 const handleExportWorld = async () => {
 try {
 // Simple export to app data dir
 const path = await invoke<string>("export_world_database", {
 exportPath: "exported_world.json",
 });
 setExportPath(path);
 setTimeout(() => setExportPath(null), 5000);
 } catch (err) {
 console.error("Failed to export world:", err);
 }
 };

 if (!loaded) {
 return (
 <div className="min-h-screen bg-carbon-2 bg-carbon-0 flex items-center justify-center transition-colors">
 <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-carbon-2 bg-carbon-0 transition-colors duration-300">
 {/* Header */}
 <header className="bg-carbon-1 border-b border-slate-line shadow-sm">
 <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <button
 onClick={() => navigate(returnTo)}
 className="p-2 rounded text-ink-faint hover:text-ink hover:bg-carbon-2 hover:bg-carbon-3 transition-colors"
 >
 <ArrowLeft className="w-5 h-5" />
 </button>
 <h1 className="text-xl font-heading font-bold uppercase tracking-wide text-ink">
 {t("settings.title")}
 </h1>
 </div>
 <ThemeToggle />
 </div>
 </header>

 {/* Content */}
 <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-8">
 {/* ─── Display ─── */}
 <Section
 title={t("settings.display")}
 icon={<Monitor className="w-5 h-5" />}
 >
 <SettingRow
 label={t("settings.theme")}
 description={t("settings.themeDesc")}
 >
 <SegmentedControl
 options={THEME_OPTION_KEYS.map((key) => ({
 value: key,
 label: t(`settings.themeOptions.${key}`),
 icon:
 key === "light" ? (
 <Sun className="w-4 h-4" />
 ) : key === "dark" ? (
 <Moon className="w-4 h-4" />
 ) : (
 <Monitor className="w-4 h-4" />
 ),
 }))}
 value={settings.theme}
 onChange={(v) =>
 handleUpdate({ theme: v as AppSettings["theme"] })
 }
 />
 </SettingRow>

 <SettingRow
 label={t("settings.language")}
 description={t("settings.languageDesc")}
 >
 <Select
 value={settings.language}
 onChange={(e) => handleUpdate({ language: e.target.value })}
 icon={<Globe className="w-4 h-4" />}
 className="min-w-48"
 >
 {SUPPORTED_LANGUAGES.map((lang) => (
 <option key={lang.code} value={lang.code}>
 {t(lang.labelKey)}
 </option>
 ))}
 </Select>
 </SettingRow>

 <SettingRow
 label={t("settings.currency")}
 description={t("settings.currencyDesc")}
 >
 <Select
 value={settings.currency}
 onChange={(e) =>
 handleUpdate({
 currency: e.target.value as AppSettings["currency"],
 })
 }
 className="min-w-48"
 >
 {CURRENCY_OPTIONS.map((c) => (
 <option key={c.value} value={c.value}>
 {c.symbol} {t(c.labelKey)}
 </option>
 ))}
 </Select>
 </SettingRow>

 <SettingRow
 label={t("settings.uiScale")}
 description={t("settings.uiScaleDesc")}
 >
 <div className="flex items-center gap-2">
 <Type className="w-4 h-4 text-ink-faint" />
 <SegmentedControl
 options={UI_SCALE_KEYS.map((key) => ({
 value: key,
 label: t(`settings.uiScaleOptions.${key}`),
 }))}
 value={settings.ui_scale}
 onChange={(v) =>
 handleUpdate({ ui_scale: v as AppSettings["ui_scale"] })
 }
 />
 </div>
 </SettingRow>

 <SettingRow
 label={t("settings.highContrast")}
 description={t("settings.highContrastDesc")}
 >
 <Toggle
 checked={settings.high_contrast}
 onChange={(v) => handleUpdate({ high_contrast: v })}
 />
 </SettingRow>

 <SettingRow
 label={t("settings.fullscreen")}
 description={t("settings.fullscreenDesc")}
 >
 <button
 onClick={toggleFullscreen}
 className="flex items-center gap-2 px-4 py-2 rounded bg-carbon-2 text-ink-dim hover:bg-carbon-3 hover:bg-carbon-3 text-sm font-heading font-bold uppercase tracking-wider transition-colors"
 >
 {isFullscreen ? (
 <Minimize className="w-4 h-4" />
 ) : (
 <Maximize className="w-4 h-4" />
 )}
 {isFullscreen
 ? t("settings.exitFullscreen")
 : t("settings.enterFullscreen")}
 </button>
 </SettingRow>
 </Section>

 {/* ─── Gameplay ─── */}
 <Section
 title={t("settings.gameplay")}
 icon={<Sliders className="w-5 h-5" />}
 >
 <SettingRow
 label={t("settings.defaultMatchMode")}
 description={t("settings.defaultMatchModeDesc")}
 >
 <Select
 value={settings.default_match_mode}
 onChange={(e) =>
 handleUpdate({
 default_match_mode: e.target
 .value as AppSettings["default_match_mode"],
 })
 }
 className="min-w-48"
 >
 {MATCH_MODE_KEYS.map((k) => (
 <option key={k} value={k}>
 {t(`settings.matchModes.${k}`)}
 </option>
 ))}
 </Select>
 </SettingRow>

 <SettingRow
 label={t("settings.matchSpeed")}
 description={t("settings.matchSpeedDesc")}
 >
 <SegmentedControl
 options={MATCH_SPEED_KEYS.map((k) => ({
 value: k,
 label: t(`settings.speeds.${k}`),
 }))}
 value={settings.match_speed}
 onChange={(v) =>
 handleUpdate({ match_speed: v as AppSettings["match_speed"] })
 }
 />
 </SettingRow>

 <SettingRow
 label={t("settings.matchCommentary")}
 description={t("settings.matchCommentaryDesc")}
 >
 <Toggle
 checked={settings.show_match_commentary}
 onChange={(v) => handleUpdate({ show_match_commentary: v })}
 />
 </SettingRow>

 <SettingRow
 label={t("settings.confirmAdvance")}
 description={t("settings.confirmAdvanceDesc")}
 >
 <Toggle
 checked={settings.confirm_advance}
 onChange={(v) => handleUpdate({ confirm_advance: v })}
 />
 </SettingRow>

 <SettingRow
 label={t("settings.continueToNextEvent")}
 description={t("settings.continueToNextEventDesc")}
 >
 <Toggle
 checked={settings.continue_to_next_event}
 onChange={(v) => handleUpdate({ continue_to_next_event: v })}
 />
 </SettingRow>

 {/* V99: Inbox frequency — controls how many non-urgent messages appear */}
 <SettingRow
 label={t("settings.inboxFrequency", { defaultValue: "Inbox Frequency" })}
 description={t("settings.inboxFrequencyDesc", { defaultValue: "How many messages you want landing on your desk." })}
 >
 <Select
 value={settings.inbox_frequency}
 onChange={(e) => handleUpdate({ inbox_frequency: e.target.value as AppSettings["inbox_frequency"] })}
 className="min-w-48"
 >
 <option value="all">{t("settings.inboxFreqAll", { defaultValue: "Everything" })}</option>
 <option value="important">{t("settings.inboxFreqImportant", { defaultValue: "Important Only" })}</option>
 <option value="critical">{t("settings.inboxFreqCritical", { defaultValue: "Critical Only" })}</option>
 </Select>
 </SettingRow>
 </Section>

 {/* ─── Saves & Data ─── */}
 <Section
 title={t("settings.savesData")}
 icon={<Save className="w-5 h-5" />}
 >
 <SettingRow
 label={t("settings.autoSave")}
 description={t("settings.autoSaveDesc")}
 >
 <Toggle
 checked={settings.auto_save}
 onChange={(v) => handleUpdate({ auto_save: v })}
 />
 </SettingRow>

 <SettingRow
 label={t("settings.exportWorld")}
 description={t("settings.exportWorldDesc")}
 >
 <button
 onClick={handleExportWorld}
 className="flex items-center gap-2 px-4 py-2 rounded bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 text-sm font-heading font-bold uppercase tracking-wider transition-colors"
 >
 <Download className="w-4 h-4" />
 {t("settings.export")}
 </button>
 </SettingRow>
 {exportPath && (
 <p className="text-xs text-primary-500 -mt-2 ml-1">
 {t("settings.exportedTo", { path: exportPath })}
 </p>
 )}

 <div className="border-t border-slate-line pt-4 mt-2">
 <SettingRow
 label={t("settings.clearSaves")}
 description={t("settings.clearSavesDesc")}
 danger
 >
 {confirmClear ? (
 <div className="flex items-center gap-2">
 <button
 onClick={handleClearSaves}
 className="px-4 py-2 rounded bg-danger-500 text-ink text-sm font-heading font-bold uppercase tracking-wider hover:bg-danger-600 transition-colors"
 >
 {t("common.confirm")}
 </button>
 <button
 onClick={() => setConfirmClear(false)}
 className="px-4 py-2 rounded bg-carbon-3 text-ink-dim text-sm font-heading font-bold uppercase tracking-wider hover:bg-carbon-3 dark:hover:bg-navy-500 transition-colors"
 >
 {t("common.cancel")}
 </button>
 </div>
 ) : clearSuccess ? (
 <span className="text-sm text-primary-500 font-heading font-bold uppercase tracking-wider">
 {t("settings.savesCleared")}
 </span>
 ) : (
 <button
 onClick={() => setConfirmClear(true)}
 className="flex items-center gap-2 px-4 py-2 rounded bg-danger-500/10 text-danger-500 hover:bg-danger-500/20 text-sm font-heading font-bold uppercase tracking-wider transition-colors"
 >
 <Trash2 className="w-4 h-4" />
 {t("settings.clear")}
 </button>
 )}
 </SettingRow>
 </div>
 </Section>

 {/* ─── Advanced ─── */}
 <Section title={t("settings.advanced")} icon={<Package className="w-5 h-5" />}>
 <SettingRow
 label={t("settings.worldEditor")}
 description={t("settings.worldEditorDesc")}
 >
 <button
 onClick={() => navigate("/world-editor")}
 className="flex items-center gap-2 px-4 py-2 rounded bg-primary-500/10 text-primary-600 dark:text-primary-300 hover:bg-primary-500/20 text-sm font-heading font-bold uppercase tracking-wider transition-colors"
 >
 {t("settings.open")}
 <ChevronRight className="w-4 h-4" />
 </button>
 </SettingRow>
 </Section>

 {/* ─── About ─── */}
 <Section title={t("settings.about")} icon={<Zap className="w-5 h-5" />}>
 <div className="flex justify-between items-center">
 <div>
 <p className="text-sm font-medium text-ink">
 {t("app.name")}
 </p>
 <p className="text-xs text-ink-dim mt-0.5">
 {t("app.version")}
 </p>
 </div>
 <span className="text-[10px] font-heading uppercase tracking-widest text-ink-faint">
 {t("app.publisher")}
 </span>
 </div>
 </Section>
 </div>
 </div>
 );
}

// ── Reusable sub-components ──

function Section({
 title,
 icon,
 children,
}: {
 title: string;
 icon: React.ReactNode;
 children: React.ReactNode;
}) {
 return (
 <div className="bg-carbon-1 rounded border border-slate-line shadow-sm overflow-hidden">
 <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-line-soft">
 <span className="text-primary-500">{icon}</span>
 <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-ink">
 {title}
 </h2>
 </div>
 <div className="px-6 py-4 flex flex-col gap-5">{children}</div>
 </div>
 );
}

function SettingRow({
 label,
 description,
 danger,
 children,
}: {
 label: string;
 description: string;
 danger?: boolean;
 children: React.ReactNode;
}) {
 return (
 <div className="flex items-center justify-between gap-4">
 <div className="flex-1 min-w-0">
 <p
 className={`text-sm font-medium ${danger ? "text-danger-500" : "text-ink"}`}
 >
 {label}
 </p>
 <p className="text-xs text-ink-dim mt-0.5">
 {description}
 </p>
 </div>
 <div className="flex-shrink-0">{children}</div>
 </div>
 );
}

function Toggle({
 checked,
 onChange,
}: {
 checked: boolean;
 onChange: (v: boolean) => void;
}) {
 return (
 <button
 onClick={() => onChange(!checked)}
 className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? "bg-primary-500" : "bg-carbon-3 bg-carbon-3"
 }`}
 >
 <div
 className={`absolute top-0.5 w-5 h-5 bg-carbon-1 rounded-full shadow-sm transition-transform duration-200 ${checked ? "translate-x-[22px]" : "translate-x-0.5"
 }`}
 />
 </button>
 );
}

function SegmentedControl({
 options,
 value,
 onChange,
}: {
 options: Array<{ value: string; label?: string; icon?: React.ReactNode }>;
 value: string;
 onChange: (v: string) => void;
}) {
 return (
 <div className="flex rounded bg-carbon-2 p-0.5 border border-slate-line">
 {options.map((opt) => (
 <button
 key={opt.value}
 onClick={() => onChange(opt.value)}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-heading font-bold uppercase tracking-wider transition-all ${value === opt.value
 ? "bg-carbon-1 bg-carbon-3 text-primary-600 dark:text-primary-400 shadow-sm"
 : "text-ink-dim hover:text-ink-dim"
 }`}
 >
 {opt.icon}
 {opt.label || opt.value}
 </button>
 ))}
 </div>
 );
}
