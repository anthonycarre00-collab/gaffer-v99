// Gaffer Icon System — custom SVG icons, football-specific
// Replaces lucide-react defaults with a consistent line-weight (1.5px) set

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function BootIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M4 20V10l3-4h8l3 4h2v6l-3 4H4z" />
      <line x1="9" y1="8" x2="14" y2="8" />
      <line x1="9" y1="11" x2="14" y2="11" />
      <line x1="9" y1="14" x2="14" y2="14" />
    </svg>
  );
}

export function WhistleIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M3 12a6 6 0 0 1 6-6h8l4 4v2a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6z" />
      <circle cx="9" cy="12" r="2" />
      <line x1="17" y1="6" x2="17" y2="2" />
    </svg>
  );
}

export function ClipboardIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="4" y="4" width="16" height="18" rx="2" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="12" y2="16" />
    </svg>
  );
}

export function TacticsBoardIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <line x1="12" y1="5" x2="12" y2="19" />
      <circle cx="6" cy="10" r="1.5" />
      <circle cx="6" cy="14" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function DugoutIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M3 18l9-12 9 12" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <line x1="6" y1="14" x2="18" y2="14" />
    </svg>
  );
}

export function FloodlightIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="6" r="3" />
      <line x1="12" y1="9" x2="12" y2="22" />
      <line x1="6" y1="4" x2="4" y2="2" />
      <line x1="18" y1="4" x2="20" y2="2" />
      <line x1="12" y1="3" x2="12" y2="1" />
    </svg>
  );
}

export function ShieldIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z" />
    </svg>
  );
}

export function TrophyIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M6 4h12v6a6 6 0 0 1-12 0V4z" />
      <line x1="6" y1="6" x2="3" y2="6" />
      <line x1="3" y1="6" x2="3" y2="8" />
      <line x1="3" y1="8" x2="6" y2="8" />
      <line x1="18" y1="6" x2="21" y2="6" />
      <line x1="21" y1="6" x2="21" y2="8" />
      <line x1="21" y1="8" x2="18" y2="8" />
      <line x1="12" y1="16" x2="12" y2="20" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </svg>
  );
}

export function BallIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="12,7 15,9 14,13 10,13 9,9" />
      <line x1="12" y1="3" x2="12" y2="7" />
      <line x1="19" y1="9" x2="15" y2="9" />
      <line x1="5" y1="9" x2="9" y2="9" />
      <line x1="8" y1="18" x2="10" y2="13" />
      <line x1="16" y1="18" x2="14" y2="13" />
    </svg>
  );
}

export function UsersIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M15 20c0-2 2-4 4-4s3 2 3 4" />
    </svg>
  );
}

export function MailIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

export function DollarIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <line x1="12" y1="3" x2="12" y2="21" />
      <path d="M16 7c0-2-2-3-4-3s-4 1-4 3 2 3 4 3 4 1 4 3-2 3-4 3-4-1-4-3" />
    </svg>
  );
}

export function SettingsIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M21 12h-3M6 12H3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7L5.6 5.6" />
    </svg>
  );
}

export function SearchIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16" y1="16" x2="21" y2="21" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <polyline points="9,6 3,12 9,18" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <polyline points="9,6 15,12 9,18" />
    </svg>
  );
}

export function StarIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <polygon points="12,3 14.5,9 21,9 16,13 18,20 12,16 6,20 8,13 3,9 9.5,9" />
    </svg>
  );
}

export function HomeIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M3 12l9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <line x1="10" y1="20" x2="10" y2="14" />
      <line x1="14" y1="20" x2="14" y2="14" />
    </svg>
  );
}

export function CrosshairIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

export function UserCogIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="10" cy="8" r="3" />
      <path d="M4 20c0-3 3-5 6-5s6 2 6 5" />
      <circle cx="18" cy="14" r="2" />
      <line x1="18" y1="11" x2="18" y2="13" />
      <line x1="18" y1="15" x2="18" y2="17" />
    </svg>
  );
}

export function ScaleIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="6" y1="6" x2="18" y2="6" />
      <path d="M6 6l-3 6h6l-3-6z" />
      <path d="M18 6l-3 6h6l-3-6z" />
    </svg>
  );
}

export function FeatherIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M20 4c-8 0-14 6-14 14" />
      <path d="M20 4c0 6-4 10-10 10" />
      <line x1="6" y1="18" x2="10" y2="14" />
      <line x1="12" y1="12" x2="16" y2="8" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8,12 11,15 16,9" />
    </svg>
  );
}

export function CircleIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function LoaderIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

export function FlameIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 3c0 3-3 4-3 8a3 3 0 0 0 6 0c0-1-1-2-1-3 2 1 3 3 3 5a5 5 0 0 1-10 0c0-5 5-7 5-10z" />
    </svg>
  );
}

export function GlobeIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}

export function LandmarkIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <line x1="3" y1="8" x2="21" y2="8" />
      <line x1="3" y1="8" x2="3" y2="20" />
      <line x1="21" y1="8" x2="21" y2="20" />
      <line x1="7" y1="8" x2="7" y2="20" />
      <line x1="12" y1="8" x2="12" y2="20" />
      <line x1="17" y1="8" x2="17" y2="20" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}

export function TargetIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

// ===== Additional icons needed by sidebar =====

export function UserCog({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="10" cy="8" r="3" />
      <path d="M4 20c0-3 3-5 6-5s6 2 6 5" />
      <circle cx="18" cy="14" r="2" />
      <line x1="18" y1="11" x2="18" y2="13" />
      <line x1="18" y1="15" x2="18" y2="17" />
    </svg>
  );
}

export function Dumbbell({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12" />
    </svg>
  );
}

export function DollarSign({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <line x1="12" y1="3" x2="12" y2="21" />
      <path d="M16 7c0-2-2-3-4-3s-4 1-4 3 2 3 4 3 4 1 4 3-2 3-4 3-4-1-4-3" />
    </svg>
  );
}

export function Eye({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function GraduationCap({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v5c0 1 3 3 6 3s6-2 6-3v-5" />
    </svg>
  );
}

export function Building2({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="4" y="4" width="16" height="18" rx="1" />
      <line x1="8" y1="8" x2="10" y2="8" />
      <line x1="14" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="10" y2="12" />
      <line x1="14" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="10" y2="16" />
      <line x1="14" y1="16" x2="16" y2="16" />
    </svg>
  );
}

export function LogOut({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function PanelLeftClose({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <polyline points="15,10 13,12 15,14" />
    </svg>
  );
}

export function PanelLeftOpen({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <polyline points="13,10 15,12 13,14" />
    </svg>
  );
}

export function TrendingUp({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <polyline points="3,17 9,11 13,15 21,7" />
      <polyline points="14,7 21,7 21,14" />
    </svg>
  );
}

export function User({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
