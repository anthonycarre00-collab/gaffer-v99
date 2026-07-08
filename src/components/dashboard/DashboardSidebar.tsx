import { useTranslation } from "react-i18next";
import type { JSX, ReactNode } from "react";
import {
  HomeIcon,
  UsersIcon,
  MailIcon,
  SettingsIcon,
  CrosshairIcon,
  Dumbbell,
  DollarSign,
  Eye,
  TrophyIcon,
  GlobeIcon,
  ClipboardIcon,
  UserCog,
  Building2,
  LogOut,
  GraduationCap,
  PanelLeftClose,
  PanelLeftOpen,
  StarIcon,
  TrendingUp,
  User,
} from "../ui/icons";

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
  const buttonClassName = collapsed
    ? `relative flex w-full items-center justify-center rounded p-3 transition-colors duration-150 ${active
      ? "bg-primary-500 text-white"
      : "text-gray-400 hover:bg-white/5 hover:text-white"
    }`
    : `relative flex w-full items-center justify-between rounded p-3 transition-colors duration-150 ${active
      ? "bg-primary-500 text-white"
      : "text-gray-400 hover:bg-white/5 hover:text-white"
    }`;

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
              ? "absolute right-1.5 top-1.5 min-w-[1.1rem] rounded-full bg-primary-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white"
              : "min-w-5 rounded-full bg-primary-500 px-2 py-0.5 text-center text-xs font-bold text-white"
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
}: DashboardSidebarProps): JSX.Element {
  const { t } = useTranslation();

  const clubItems: Array<{ icon: JSX.Element; label: string; tab: string }> = [
    { icon: <UsersIcon />, label: t("dashboard.squad"), tab: "Squad" },
    { icon: <CrosshairIcon />, label: t("dashboard.tactics"), tab: "Tactics" },
    { icon: <Dumbbell />, label: t("dashboard.training"), tab: "Training" },
    { icon: <UserCog />, label: t("dashboard.staff"), tab: "Staff" },
    { icon: <Eye />, label: t("dashboard.scouting"), tab: "Scouting" },
    {
      icon: <GraduationCap />,
      label: t("dashboard.youthAcademy"),
      tab: "Youth",
    },
    { icon: <DollarSign />, label: t("dashboard.finances"), tab: "Finances" },
    { icon: <TrendingUp />, label: t("dashboard.transfers"), tab: "Transfers" },
  ];
  const worldItems: Array<{ icon: JSX.Element; label: string; tab: string }> = [
    { icon: <GlobeIcon />, label: t("transfers.centre"), tab: "TransferCentre" },
    { icon: <StarIcon />, label: t("dashboard.hallOfFame"), tab: "HallOfFame" },
    { icon: <UsersIcon />, label: t("dashboard.players"), tab: "Players" },
    { icon: <User />, label: t("dashboard.managers"), tab: "Managers" },
    { icon: <Building2 />, label: t("dashboard.teams"), tab: "Teams" },
    {
      icon: <TrophyIcon />,
      label: t("dashboard.tournaments"),
      tab: "Tournaments",
    },
  ];
  const toggleSidebarLabel = collapsed
    ? t("dashboard.expandSidebar")
    : t("dashboard.collapseSidebar");

  return (
    <aside
      className={`bg-navy-800 dark:bg-navy-800 border-r border-navy-700 text-white flex h-screen sticky top-0 shrink-0 flex-col transition-[width] duration-200 ${collapsed ? "w-20" : "w-64"
        }`}
    >
      {/* Brand — Gaffer logo */}
      <div
        className={`border-b border-navy-700 ${collapsed ? "px-3 py-4" : "p-5"}`}
      >
        <div
          className={`flex ${collapsed ? "flex-col items-center gap-3" : "items-center justify-between gap-3"}`}
        >
          <div
            className={`flex items-center ${collapsed ? "justify-center" : "gap-2"}`}
          >
            <div className="w-8 h-8 flex items-center justify-center">
              <img
                src="/gaffer-icon.svg"
                alt="Gaffer"
                className="w-8 h-8"
              />
            </div>
            {collapsed ? null : (
              <div>
                <h1 className="text-sm font-heading font-bold text-accent-400 uppercase tracking-wider">
                  Gaffer
                </h1>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            title={toggleSidebarLabel}
            aria-label={toggleSidebarLabel}
            className="rounded p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
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
          className={`hover:bg-white/5 mt-3 w-full rounded transition-colors hover:cursor-pointer ${collapsed
              ? "flex justify-center px-0 py-2 text-gray-300"
              : "-mx-1 border-t border-navy-700 px-1 py-1 pt-3 text-left"
            }`}
        >
          {collapsed ? (
            <User className="h-5 w-5" />
          ) : (
            <>
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                {t("dashboard.manager")}
              </p>
              <p className="text-sm font-semibold text-white mt-0.5">
                {managerName}
              </p>
              {teamName && (
                <p className="text-xs text-primary-400 mt-0.5">{teamName}</p>
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
            <hr className="my-2 border-navy-700" />
            {collapsed ? null : (
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-heading px-3 pt-1 pb-1">
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

        <hr className="my-2 border-navy-700" />
        {collapsed ? null : (
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-heading px-3 pt-1 pb-1">
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
        className={`border-t border-navy-700 flex flex-col gap-1 ${collapsed ? "p-2" : "p-3"
          }`}
      >
        <button
          onClick={onNavigateSettings}
          title={collapsed ? t("dashboard.settings") : undefined}
          aria-label={t("dashboard.settings")}
          className={`w-full rounded p-3 text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300 ${collapsed
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
          className={`w-full rounded p-3 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400 ${collapsed
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
