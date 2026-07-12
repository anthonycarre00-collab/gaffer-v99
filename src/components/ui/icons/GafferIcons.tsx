/**
 * Gaffer Icon Set v2 — Custom football-specific SVG icons
 *
 * Replaces ALL remaining generic lucide-react icons with unique
 * Gaffer-styled alternatives. Design language:
 * - 1.5px stroke weight (consistent with existing Gaffer icons)
 * - Football-specific imagery (no generic UI shapes)
 * - Brass accent color (#c9972e) for highlights
 * - Pitch green (#1a5d3a) for primary fills
 * - 24x24 viewBox, rounded line caps
 *
 * Color: uses currentColor so icons inherit text color.
 * Accent: optional brassColor prop for two-tone icons.
 */

import type { SVGProps } from "react";

type GafferIconProps = SVGProps<SVGSVGElement> & {
 size?: number;
 /** Optional brass accent color (defaults to #c9972e) */
 brassColor?: string;
};

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

// ─── Match Day Icons ────────────────────────────────────────────────

/** Stadium with floodlights — for match day / pre-match screens */
export function StadiumIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 {/* Floodlight pylons */}
 <line x1="4" y1="3" x2="4" y2="9" />
 <line x1="20" y1="3" x2="20" y2="9" />
 {/* Floodlight heads */}
 <path d="M2 3h4M18 3h4" stroke={brassColor} />
 {/* Light rays */}
 <line x1="4" y1="5" x2="8" y2="11" stroke={brassColor} strokeWidth="0.8" opacity="0.5" />
 <line x1="20" y1="5" x2="16" y2="11" stroke={brassColor} strokeWidth="0.8" opacity="0.5" />
 {/* Stadium bowl */}
 <path d="M3 21c0-4 4-7 9-7s9 3 9 7" />
 {/* Pitch */}
 <rect x="8" y="16" width="8" height="4" rx="0.5" stroke={brassColor} strokeWidth="0.8" opacity="0.6" />
 <line x1="12" y1="16" x2="12" y2="20" stroke={brassColor} strokeWidth="0.6" opacity="0.6" />
 </svg>
 );
}

/** Stoppage board — for extra time / stoppage */
export function StoppageBoardIcon({ size = 20, ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 <rect x="5" y="4" width="14" height="10" rx="1" />
 <line x1="5" y1="9" x2="19" y2="9" />
 <text x="12" y="8" textAnchor="middle" fontSize="5" fill="currentColor" stroke="none" fontFamily="monospace">90</text>
 <text x="12" y="13" textAnchor="middle" fontSize="5" fill="currentColor" stroke="none" fontFamily="monospace">+4</text>
 {/* Handle */}
 <line x1="12" y1="14" x2="12" y2="18" />
 <circle cx="12" cy="20" r="1.5" />
 </svg>
 );
}

/** Substitution board — for subs */
export function SubBoardIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 <rect x="3" y="5" width="18" height="14" rx="1" />
 <line x1="3" y1="12" x2="21" y2="12" />
 {/* Off number (red) */}
 <text x="8" y="10" textAnchor="middle" fontSize="5" fill="currentColor" stroke="none" fontFamily="monospace" opacity="0.5">9</text>
 {/* On number (green/brass) */}
 <text x="16" y="17" textAnchor="middle" fontSize="5" fill={brassColor} stroke="none" fontFamily="monospace">10</text>
 {/* Arrow */}
 <path d="M8 14L16 10" stroke={brassColor} strokeWidth="1" markerEnd="url(#arrowhead)" />
 <defs>
 <marker id="arrowhead" markerWidth="3" markerHeight="3" refX="2" refY="1.5" orient="auto">
 <polygon points="0 0, 3 1.5, 0 3" fill={brassColor} />
 </marker>
 </defs>
 </svg>
 );
}

/** Captain's armband — for captain designation */
export function CaptainArmbandIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 {/* Armband shape */}
 <path d="M4 12c0-2 1.5-4 4-4h8c2.5 0 4 2 4 4s-1.5 4-4 4H8c-2.5 0-4-2-4-4z" />
 {/* "C" letter */}
 <text x="12" y="14.5" textAnchor="middle" fontSize="6" fill={brassColor} stroke="none" fontFamily="Georgia, serif" fontWeight="bold">C</text>
 </svg>
 );
}

// ─── Transfer & Finance Icons ────────────────────────────────────────

/** Transfer document with stamp — for transfer offers */
export function TransferDocIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 {/* Document */}
 <path d="M5 3h10l4 4v14H5z" />
 <path d="M15 3v4h4" />
 {/* Text lines */}
 <line x1="8" y1="10" x2="16" y2="10" strokeWidth="0.8" opacity="0.5" />
 <line x1="8" y1="13" x2="16" y2="13" strokeWidth="0.8" opacity="0.5" />
 {/* Stamp circle */}
 <circle cx="16" cy="18" r="3" stroke={brassColor} strokeWidth="1.2" />
 <text x="16" y="19" textAnchor="middle" fontSize="3" fill={brassColor} stroke="none" fontFamily="sans-serif">OK</text>
 </svg>
 );
}

/** Wage slip — for contract negotiations */
export function WageSlipIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 {/* Paper */}
 <rect x="5" y="2" width="14" height="20" rx="1" />
 {/* Header bar */}
 <line x1="5" y1="7" x2="19" y2="7" stroke={brassColor} strokeWidth="1.5" />
 {/* Coin symbol */}
 <circle cx="12" cy="13" r="3" stroke={brassColor} />
 <text x="12" y="14.5" textAnchor="middle" fontSize="4" fill={brassColor} stroke="none">£</text>
 {/* Lines */}
 <line x1="8" y1="18" x2="16" y2="18" strokeWidth="0.8" opacity="0.5" />
 <line x1="8" y1="20" x2="14" y2="20" strokeWidth="0.8" opacity="0.5" />
 </svg>
 );
}

/** Loan arrow — for loan deals */
export function LoanArrowIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 {/* Curved arrow from one club to another */}
 <path d="M4 8c0-3 3-5 8-5s8 2 8 5" />
 <path d="M18 6l2 2-2 2" />
 {/* Return arrow (dashed) */}
 <path d="M20 16c0 3-3 5-8 5s-8-2-8-5" strokeDasharray="2 2" opacity="0.5" />
 <path d="M6 18l-2-2 2-2" opacity="0.5" />
 {/* Club dots */}
 <circle cx="4" cy="8" r="1.5" fill={brassColor} stroke="none" />
 <circle cx="20" cy="16" r="1.5" fill={brassColor} stroke="none" />
 </svg>
 );
}

// ─── Training & Development Icons ────────────────────────────────────

/** Cones drill — for training sessions */
export function ConesIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 {/* Three cones */}
 <path d="M5 20l2-8h1l2 8z" />
 <path d="M10 20l2-10h1l2 10z" />
 <path d="M15 20l2-8h1l2 8z" />
 {/* Cone tips */}
 <circle cx="6.5" cy="11" r="0.5" fill={brassColor} stroke="none" />
 <circle cx="11.5" cy="9" r="0.5" fill={brassColor} stroke="none" />
 <circle cx="16.5" cy="11" r="0.5" fill={brassColor} stroke="none" />
 {/* Ground line */}
 <line x1="3" y1="20" x2="21" y2="20" strokeWidth="0.8" opacity="0.4" />
 </svg>
 );
}

/** Tactics board with magnets — for tactical planning */
export function TacticsMagnetsIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 {/* Board */}
 <rect x="3" y="3" width="18" height="18" rx="1" />
 {/* Pitch lines */}
 <line x1="3" y1="12" x2="21" y2="12" strokeWidth="0.6" opacity="0.4" />
 <circle cx="12" cy="12" r="3" strokeWidth="0.6" opacity="0.4" />
 {/* Player magnets (brass dots) */}
 <circle cx="7" cy="7" r="1.5" fill={brassColor} stroke="none" />
 <circle cx="12" cy="7" r="1.5" fill={brassColor} stroke="none" />
 <circle cx="17" cy="7" r="1.5" fill={brassColor} stroke="none" />
 <circle cx="7" cy="17" r="1.5" fill="currentColor" stroke="none" opacity="0.5" />
 <circle cx="17" cy="17" r="1.5" fill="currentColor" stroke="none" opacity="0.5" />
 </svg>
 );
}

// ─── Scouting & Youth Icons ──────────────────────────────────────────

/** Binoculars — for scouting */
export function BinocularsIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 {/* Two lenses */}
 <circle cx="8" cy="10" r="4" />
 <circle cx="16" cy="10" r="4" />
 {/* Lens reflections */}
 <circle cx="7" cy="9" r="1" stroke={brassColor} strokeWidth="0.8" opacity="0.6" />
 <circle cx="15" cy="9" r="1" stroke={brassColor} strokeWidth="0.8" opacity="0.6" />
 {/* Bridge */}
 <path d="M12 10v-3M10 7h4" />
 {/* Eyepieces */}
 <path d="M5 14l-1 3M19 14l1 3" />
 </svg>
 );

}

/** Youth academy gate — for youth academy */
export function AcademyGateIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 {/* Gate posts */}
 <line x1="6" y1="3" x2="6" y2="21" />
 <line x1="18" y1="3" x2="18" y2="21" />
 {/* Gate arch */}
 <path d="M6 6c0-2 3-3 6-3s6 1 6 3" />
 {/* Academy emblem (star) */}
 <path d="M12 9l1 2 2 .5-1.5 1.5.5 2-2-1-2 1 .5-2L9 11.5l2-.5z" stroke={brassColor} strokeWidth="1" fill="none" />
 {/* Ground */}
 <line x1="3" y1="21" x2="21" y2="21" strokeWidth="0.8" opacity="0.4" />
 </svg>
 );
}

// ─── Status & Feedback Icons ─────────────────────────────────────────

/** Red card — for sendings off */
export function RedCardIcon({ size = 20, ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 <rect x="6" y="3" width="12" height="18" rx="1" fill="#dc2626" stroke="#991b1b" strokeWidth="1" />
 </svg>
 );
}

/** Yellow card — for bookings */
export function YellowCardIcon({ size = 20, ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 <rect x="6" y="3" width="12" height="18" rx="1" fill="#eab308" stroke="#a16207" strokeWidth="1" />
 </svg>
 );
}

/** Medical cross — for injuries */
export function MedicalCrossIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 <rect x="4" y="4" width="16" height="16" rx="2" />
 <path d="M12 8v8M8 12h8" stroke={brassColor} strokeWidth="2" />
 </svg>
 );
}

/** Whistle blow — for fouls / referee decisions */
export function WhistleBlowIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 {/* Whistle body */}
 <path d="M3 12a5 5 0 0 1 5-5h6l4 3v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z" />
 {/* Pea hole */}
 <circle cx="8" cy="12" r="1.5" stroke={brassColor} />
 {/* Lanyard */}
 <path d="M18 7c1-2 2-3 3-3" strokeWidth="0.8" opacity="0.5" />
 {/* Sound waves */}
 <path d="M21 10c.5-1 1-1.5 1.5-2" stroke={brassColor} strokeWidth="0.8" opacity="0.6" />
 </svg>
 );
}

// ─── Media & News Icons ──────────────────────────────────────────────

/** Newspaper — for news feed */
export function NewspaperIcon({ size = 20, ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 <rect x="3" y="4" width="18" height="16" rx="1" />
 <line x1="7" y1="8" x2="17" y2="8" strokeWidth="1" />
 <line x1="7" y1="11" x2="17" y2="11" strokeWidth="0.6" opacity="0.5" />
 <line x1="7" y1="14" x2="17" y2="14" strokeWidth="0.6" opacity="0.5" />
 <line x1="7" y1="17" x2="13" y2="17" strokeWidth="0.6" opacity="0.5" />
 {/* Photo box */}
 <rect x="7" y="5.5" width="4" height="2" strokeWidth="0.6" opacity="0.4" />
 </svg>
 );
}

/** Microphone — for press conferences */
export function MicrophoneIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 {/* Mic head */}
 <rect x="9" y="3" width="6" height="9" rx="3" />
 {/* Sound grill lines */}
 <line x1="11" y1="6" x2="13" y2="6" strokeWidth="0.5" stroke={brassColor} />
 <line x1="11" y1="8" x2="13" y2="8" strokeWidth="0.5" stroke={brassColor} />
 <line x1="11" y1="10" x2="13" y2="10" strokeWidth="0.5" stroke={brassColor} />
 {/* Stand */}
 <path d="M7 12c0 3 2 5 5 5s5-2 5-5" />
 <line x1="12" y1="17" x2="12" y2="21" />
 <line x1="9" y1="21" x2="15" y2="21" />
 </svg>
 );
}

/** Trophy with ribbons — for hall of fame / awards */
export function TrophyRibbonsIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 {/* Cup */}
 <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
 {/* Handles */}
 <path d="M7 5c-2 0-3 1-3 3s1 3 3 3" />
 <path d="M17 5c2 0 3 1 3 3s-1 3-3 3" />
 {/* Stem */}
 <line x1="12" y1="13" x2="12" y2="17" />
 {/* Base */}
 <path d="M9 17h6l1 3H8z" stroke={brassColor} />
 {/* Ribbons */}
 <path d="M9 4l-2 6M15 4l2 6" strokeWidth="0.8" stroke={brassColor} opacity="0.6" />
 </svg>
 );
}

// ─── Navigation & Layout Icons ───────────────────────────────────────

/** Clipboard with formation — for tactics tab */
export function FormationClipboardIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 <rect x="4" y="4" width="16" height="18" rx="1" />
 {/* Clip */}
 <rect x="9" y="2" width="6" height="3" rx="0.5" />
 {/* Mini pitch */}
 <line x1="6" y1="12" x2="18" y2="12" strokeWidth="0.6" opacity="0.3" />
 <circle cx="12" cy="12" r="2" strokeWidth="0.6" opacity="0.3" />
 {/* Formation dots (4-3-3) */}
 <circle cx="8" cy="8" r="0.8" fill={brassColor} stroke="none" />
 <circle cx="12" cy="8" r="0.8" fill={brassColor} stroke="none" />
 <circle cx="16" cy="8" r="0.8" fill={brassColor} stroke="none" />
 <circle cx="8" cy="17" r="0.6" fill="currentColor" stroke="none" opacity="0.4" />
 <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" opacity="0.4" />
 <circle cx="16" cy="17" r="0.6" fill="currentColor" stroke="none" opacity="0.4" />
 </svg>
 );
}

/** Touchline — for match day / dugout */
export function TouchlineIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 {/* Pitch touchline */}
 <rect x="3" y="6" width="18" height="12" rx="0.5" strokeWidth="0.8" />
 {/* Center line */}
 <line x1="3" y1="12" x2="21" y2="12" strokeWidth="0.6" opacity="0.4" />
 {/* Center circle */}
 <circle cx="12" cy="12" r="2.5" strokeWidth="0.6" opacity="0.4" />
 {/* Technical area (dugout box) */}
 <rect x="8" y="3" width="8" height="2" stroke={brassColor} strokeWidth="0.8" />
 {/* Manager figure */}
 <circle cx="12" cy="2" r="0.8" fill={brassColor} stroke="none" />
 </svg>
 );
}

// ─── Social & Community Icons ────────────────────────────────────────

/** Megaphone — for fan reactions / social media */
export function MegaphoneIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 {/* Megaphone body */}
 <path d="M3 10v4l8 3V7z" />
 {/* Horn opening */}
 <path d="M11 7l6-3v16l-6-3" />
 {/* Sound waves */}
 <path d="M19 8c1 1 1.5 3 1.5 4s-.5 3-1.5 4" stroke={brassColor} strokeWidth="0.8" />
 <path d="M21 6c2 2 2.5 4 2.5 6s-.5 4-2.5 6" stroke={brassColor} strokeWidth="0.6" opacity="0.5" />
 {/* Handle */}
 <path d="M5 14v3M7 14v4" strokeWidth="0.8" opacity="0.5" />
 </svg>
 );
}

/** Handshake — for contract signings */
export function HandshakeIcon({ size = 20, brassColor = "#c9972e", ...props }: GafferIconProps) {
 return (
 <svg {...base(size)} {...props}>
 {/* Two hands clasping */}
 <path d="M3 12l3-2 3 1 3-1 3 2 3-1" />
 <path d="M6 10l2 2M9 11l2 2M12 10l2 2M15 11l2 2" strokeWidth="0.8" />
 {/* Cuffs */}
 <path d="M3 12v3M21 11v3" strokeWidth="1" />
 {/* Sparkle on clasp */}
 <circle cx="12" cy="11" r="0.5" fill={brassColor} stroke="none" />
 </svg>
 );
}
