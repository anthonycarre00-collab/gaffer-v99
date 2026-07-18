import { useTranslation } from "react-i18next";
import type { JSX, ReactNode } from "react";
import {
 UsersIcon,
 CrosshairIcon,
 TrophyIcon,
 UserCog,
 LogOut,
 PanelLeftClose,
 PanelLeftOpen,
 StarIcon,
 User,
 HomeIcon,
 MailIcon,
 ClipboardIcon,
 SettingsIcon,
} from "../ui/icons";
// Gaffer custom icons — football-specific replacements for generic lucide icons
import {
 ConesIcon as GafferConesIcon,
 BinocularsIcon as GafferBinocularsIcon,
 AcademyGateIcon as GafferAcademyIcon,
 WageSlipIcon as GafferWageIcon,
 TransferDocIcon as GafferTransferIcon,
 TrophyRibbonsIcon as GafferTrophyIcon,
 // V99.11 B6: New icons replacing remaining lucide-react
 GlobeStadiumIcon as GafferGlobeIcon,
 PlayersKitIcon as GafferPlayersIcon,
 ManagerClipIcon as GafferManagerIcon,
 BuildingStadiumIcon as GafferTeamsIcon,
} from "../ui/icons/GafferIcons";

interface DashboardSidebarProps {
 activeTab: string;
 collapsed: boolean;
 onNavClick: (tab: string) => void;
 onToggleCollapse: () => void;
 unreadMessagesCount: number;
 todayHasMatch?: boolean;
 managerName: string | null;
 teamName: string | null;
 onNavigateSettings: () => void;
 onExitClick: () => void;
 isUnemployed: boolean;
 /** V99.1: Team primary color for sidebar accent theming */
 teamColor?: string;
}

interface NavItemProps {
 active?: boolean;
 badge?: number | string;
 collapsed: boolean;
 icon: ReactNode;
 label: string;
 onClick?: () => void;
}

function NavItem({
 active,
 badge,
 collapsed,
 icon,
 label,
 onClick,
}: NavItemProps): JSX.Element {
 // V99.11 B2: Active state per UI spec §2.1 — 2px brass left border +
 // faint brass-tinted bg gradient. Inactive: ink-dim text, hover brightens.
 const activeClass = active
 ? "border-l-2 border-accent-500 text-ink bg-accent-500/5"
 : "border-l-2 border-transparent text-ink-dim hover:bg-ink/5 hover:text-ink";
 const buttonClassName = collapsed
 ? `relative flex w-full items-center justify-center p-3 transition-colors duration-150 ${activeClass}`
 : `relative flex w-full items-center justify-between p-3 transition-colors duration-150 ${activeClass}`;

 return (
 <button
 onClick={onClick}
 title={collapsed ? label : undefined}
 aria-label={
 badge !== undefined && badge !== 0 && badge !== ""
 ? `${label} (${badge})`
 : label
 }
 className={buttonClassName}
 >
 <div
 className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}
 >
 <div className="[&>svg]:w-5 [&>svg]:h-5">{icon}</div>
 {collapsed ? null : (
 <span className="font-heading font-semibold text-sm uppercase tracking-wider">
 {label}
 </span>
 )}
 </div>
 {badge !== undefined && badge !== 0 && badge !== "" && (
 <span
 className={
 collapsed
 ? "absolute right-1.5 top-1.5 min-w-[1.1rem] rounded-full bg-danger-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-ink"
 : "min-w-5 rounded-full bg-danger-500 px-2 py-0.5 text-center text-xs font-bold text-ink"
 }
 >
 {badge}
 </span>
 )}
 </button>
 );
}

export default function DashboardSidebar({
 activeTab,
 collapsed,
 onNavClick,
 onToggleCollapse,
 unreadMessagesCount,
 todayHasMatch,
 managerName,
 teamName,
 onNavigateSettings,
 onExitClick,
 isUnemployed,
 teamColor,
}: DashboardSidebarProps): JSX.Element {
 const { t } = useTranslation();

 const clubItems: Array<{ icon: JSX.Element; label: string; tab: string }> = [
 { icon: <UsersIcon />, label: t("dashboard.squad"), tab: "Squad" },
 { icon: <CrosshairIcon />, label: t("dashboard.tactics"), tab: "Tactics" },
 { icon: <GafferConesIcon />, label: t("dashboard.training"), tab: "Training" },
 { icon: <UserCog />, label: t("dashboard.staff"), tab: "Staff" },
 { icon: <GafferBinocularsIcon />, label: t("dashboard.scouting"), tab: "Scouting" },
 {
 icon: <GafferAcademyIcon />,
 label: t("dashboard.youthAcademy"),
 tab: "Youth",
 },
 { icon: <GafferWageIcon />, label: t("dashboard.finances"), tab: "Finances" },
 { icon: <GafferTransferIcon />, label: t("dashboard.transfers"), tab: "Transfers" },
 ];
 const worldItems: Array<{ icon: JSX.Element; label: string; tab: string }> = [
 // V99.11 B6: Using Gaffer icons instead of lucide-react
 { icon: <GafferGlobeIcon size={16} />, label: t("transfers.centre"), tab: "TransferCentre" },
 { icon: <StarIcon />, label: t("dashboard.hallOfFame"), tab: "HallOfFame" },
 { icon: <GafferPlayersIcon size={16} />, label: t("dashboard.players"), tab: "Players" },
 { icon: <GafferManagerIcon size={16} />, label: t("dashboard.managers"), tab: "Managers" },
 { icon: <GafferTeamsIcon size={16} />, label: t("dashboard.teams"), tab: "Teams" },
 {
 icon: <GafferTrophyIcon />,
 label: t("dashboard.tournaments"),
 tab: "Tournaments",
 },
 ];
 const toggleSidebarLabel = collapsed
 ? t("dashboard.expandSidebar")
 : t("dashboard.collapseSidebar");

 return (
 <aside
 // V99.11 B2: Sidebar per UI spec §2.1 — 208px (w-52), carbon gradient bg,
 // no leather texture. Brass left-border active state (not bg-primary-500).
 className={`border-r border-slate-line text-ink flex h-screen sticky top-0 shrink-0 flex-col transition-[width] duration-200 ${collapsed ? "w-20" : "w-52"
 }`}
 style={{
 // V99.11 B2: Vertical gradient carbon-1 → carbon-0 (spec §2.1)
 background: "linear-gradient(180deg, var(--color-carbon-1) 0%, var(--color-carbon-0) 100%)",
 }}
 >
 {/* V99.1: Team color accent bar at the very top of the sidebar */}
 {teamColor && (
 <div className="h-1.5 w-full" style={{ backgroundColor: teamColor }} />
 )}
 {/* Brand — Gaffer crest */}
 <div
 className={`border-b border-slate-line ${collapsed ? "px-3 py-4" : "p-5"}`}
 >
 <div
 className={`flex ${collapsed ? "flex-col items-center gap-3" : "items-center justify-between gap-3"}`}
 >
 <div
 className={`flex items-center ${collapsed ? "justify-center" : "gap-2"}`}
 >
 {/* V99.11: New Gaffer logo (webp) replaces old inline SVG crest */}
 <img
 src="/src/assets/gaffer-logo-pro.webp"
 alt="Gaffer"
 className={collapsed ? "w-8 h-8" : "w-10 h-10"}
 />
 {collapsed ? null : (
 <div>
 <h1 className="text-sm font-heading font-bold text-accent-400 uppercase tracking-wider">
 Gaffer
 </h1>
 {/* V100 P1 (Issue #10): New tagline — "Every Result Tells a Story" */}
 <p className="text-[9px] text-ink-faint font-heading uppercase tracking-widest">
 Every Result Tells a Story
 </p>
 </div>
 )}
 </div>
 <button
 type="button"
 onClick={onToggleCollapse}
 title={toggleSidebarLabel}
 aria-label={toggleSidebarLabel}
 className="rounded p-2 text-ink-dim transition-colors hover:bg-ink/5 hover:text-ink"
 >
 {collapsed ? (
 <PanelLeftOpen className="h-5 w-5" />
 ) : (
 <PanelLeftClose className="h-5 w-5" />
 )}
 </button>
 </div>
 <button
 onClick={() => onNavClick("Manager")}
 title={collapsed ? t("dashboard.manager") : undefined}
 aria-label={t("dashboard.manager")}
 className={`hover:bg-ink/5 mt-3 w-full rounded transition-colors hover:cursor-pointer ${collapsed
 ? "flex justify-center px-0 py-2 text-ink"
 : "-mx-1 border-t border-slate-line px-1 py-1 pt-3 text-left"
 }`}
 >
 {collapsed ? (
 <User className="h-5 w-5" />
 ) : (
 <>
 <p className="text-xs text-ink-dim uppercase tracking-wider">
 {t("dashboard.manager")}
 </p>
 <p className="text-sm font-semibold text-ink mt-0.5">
 {managerName}
 </p>
 {teamName && (
 <p className="text-xs mt-0.5" style={{ color: teamColor || "#5cb389" }}>{teamName}</p>
 )}
 </>
 )}
 </button>
 </div>

 {/* Navigation */}
 <nav
 className={`scrollbar-thin scrollbar-thumb-navy-600 scrollbar-track-transparent flex flex-1 flex-col gap-1 overflow-y-auto py-4 ${collapsed ? "px-2" : "px-3"
 }`}
 >
 <NavItem
 icon={<HomeIcon />}
 label={t("dashboard.home")}
 badge={undefined}
 active={activeTab === "Home"}
 collapsed={collapsed}
 onClick={() => onNavClick("Home")}
 />
 <NavItem
 icon={<MailIcon />}
 label={t("dashboard.inbox")}
 badge={unreadMessagesCount > 0 ? unreadMessagesCount : undefined}
 active={activeTab === "Inbox"}
 collapsed={collapsed}
 onClick={() => onNavClick("Inbox")}
 />
 <NavItem
 icon={<ClipboardIcon />}
 label={t("dashboard.news")}
 active={activeTab === "News"}
 collapsed={collapsed}
 onClick={() => onNavClick("News")}
 />
 <NavItem
 icon={<TrophyIcon />}
 label={t("dashboard.schedule")}
 badge={todayHasMatch ? "!" : undefined}
 active={activeTab === "Schedule"}
 collapsed={collapsed}
 onClick={() => onNavClick("Schedule")}
 />

 {!isUnemployed && (
 <>
 <hr className="my-2 border-slate-line" />
 {collapsed ? null : (
 <p className="text-[10px] text-ink-faint uppercase tracking-widest font-heading px-3 pt-1 pb-1">
 {t("dashboard.sectionClub")}
 </p>
 )}
 {clubItems.map((item) => (
 <NavItem
 key={item.tab}
 icon={item.icon}
 label={item.label}
 active={activeTab === item.tab}
 collapsed={collapsed}
 onClick={() => onNavClick(item.tab)}
 />
 ))}
 </>
 )}

 <hr className="my-2 border-slate-line" />
 {collapsed ? null : (
 <p className="text-[10px] text-ink-faint uppercase tracking-widest font-heading px-3 pt-1 pb-1">
 {t("dashboard.sectionWorld")}
 </p>
 )}
 {worldItems.map((item) => (
 <NavItem
 key={item.tab}
 icon={item.icon}
 label={item.label}
 active={activeTab === item.tab}
 collapsed={collapsed}
 onClick={() => onNavClick(item.tab)}
 />
 ))}
 </nav>

 {/* Settings & Exit */}
 <div
 className={`border-t border-slate-line flex flex-col gap-1 ${collapsed ? "p-2" : "p-3"
 }`}
 >
 <button
 onClick={onNavigateSettings}
 title={collapsed ? t("dashboard.settings") : undefined}
 aria-label={t("dashboard.settings")}
 className={`w-full rounded p-3 text-ink-faint transition-colors hover:bg-ink/5 hover:text-ink ${collapsed
 ? "flex items-center justify-center"
 : "flex items-center gap-3"
 }`}
 >
 <SettingsIcon className="w-5 h-5" />
 {collapsed ? null : (
 <span className="font-heading text-sm uppercase tracking-wider">
 {t("dashboard.settings")}
 </span>
 )}
 </button>
 <button
 onClick={onExitClick}
 title={collapsed ? t("dashboard.exitToMenu") : undefined}
 aria-label={t("dashboard.exitToMenu")}
 className={`w-full rounded p-3 text-ink-faint transition-colors hover:bg-danger-500/10 hover:text-danger-400 ${collapsed
 ? "flex items-center justify-center"
 : "flex items-center gap-3"
 }`}
 >
 <LogOut className="w-5 h-5" />
 {collapsed ? null : (
 <span className="font-heading text-sm uppercase tracking-wider">
 {t("dashboard.exitToMenu")}
 </span>
 )}
 </button>
 </div>
 </aside>
 );
}
