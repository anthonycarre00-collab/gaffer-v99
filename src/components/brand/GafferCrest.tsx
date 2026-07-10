/**
 * GafferCrest — the primary brand mark for The Gaffer.
 *
 * A brass-and-pitch-green football manager's badge: shield outline, crossed
 * tactical bars, monogram "G", whistle at the heart. Designed to feel like a
 * football association crest (proportions inspired by The FA / DFB badges)
 * but with the Gaffer voice — a manager's whistle at the heart, not a ball.
 *
 * Pure SVG so it scales crisply at any size and renders identically in
 * light and dark mode (uses currentColor + the Gaffer palette).
 */

interface GafferCrestProps {
 size?: number;
 className?: string;
 /** Show the wordmark "GAFFER" beneath the crest. Default true. */
 withWordmark?: boolean;
}

export function GafferCrest({
 size = 96,
 className = "",
 withWordmark = true,
}: GafferCrestProps) {
 const id = "gaffer-crest-gradient";
 return (
 <div className={`inline-flex flex-col items-center ${className}`}>
 <svg
 width={size}
 height={size}
 viewBox="0 0 100 110"
 xmlns="http://www.w3.org/2000/svg"
 role="img"
 aria-label="The Gaffer crest"
 >
 <defs>
 <linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
 <stop offset="0%" stopColor="#d4a64a" />
 <stop offset="50%" stopColor="#b8862e" />
 <stop offset="100%" stopColor="#8b5e1c" />
 </linearGradient>
 <linearGradient id={`${id}-dark`} x1="0%" y1="0%" x2="0%" y2="100%">
 <stop offset="0%" stopColor="#0d3b25" />
 <stop offset="100%" stopColor="#072018" />
 </linearGradient>
 </defs>

 {/* Outer brass ring */}
 <path
 d="M50 4 L92 18 L92 56 Q92 86 50 106 Q8 86 8 56 L8 18 Z"
 fill={`url(#${id})`}
 stroke="#5a3d12"
 strokeWidth="1.2"
 />

 {/* Inner pitch-green shield */}
 <path
 d="M50 10 L86 22 L86 55 Q86 80 50 98 Q14 80 14 55 L14 22 Z"
 fill={`url(#${id}-dark)`}
 />

 {/* Crossed tactical bars (representing the tactics board) */}
 <rect
 x="20"
 y="48"
 width="60"
 height="3"
 transform="rotate(-15 50 50)"
 fill="#d4a64a"
 opacity="0.85"
 />
 <rect
 x="20"
 y="48"
 width="60"
 height="3"
 transform="rotate(15 50 50)"
 fill="#d4a64a"
 opacity="0.85"
 />

 {/* Whistle circle at center (manager's whistle — the Gaffer's instrument) */}
 <circle cx="50" cy="50" r="9" fill="#d4a64a" stroke="#5a3d12" strokeWidth="1" />
 <circle cx="50" cy="50" r="4" fill="#5a3d12" />
 {/* Whistle mouthpiece to the right */}
 <rect x="58" y="48" width="8" height="4" fill="#d4a64a" stroke="#5a3d12" strokeWidth="0.6" />

 {/* Monogram G above the whistle */}
 <text
 x="50"
 y="38"
 textAnchor="middle"
 fontFamily="Georgia, 'Times New Roman', serif"
 fontSize="22"
 fontWeight="bold"
 fill="#d4a64a"
 letterSpacing="-1"
 >
 G
 </text>

 {/* Three small stars below (representing the three pillars: tactics, man-management, transfers) */}
 <g fill="#d4a64a">
 <circle cx="38" cy="72" r="1.6" />
 <circle cx="50" cy="74" r="1.8" />
 <circle cx="62" cy="72" r="1.6" />
 </g>

 {/* Bottom ribbon */}
 <path
 d="M30 84 Q50 92 70 84 L70 90 Q50 98 30 90 Z"
 fill="#d4a64a"
 stroke="#5a3d12"
 strokeWidth="0.6"
 />
 </svg>

 {withWordmark && (
 <div className="mt-2 text-center">
 <div
 className="font-heading text-2xl font-bold uppercase tracking-[0.25em] text-accent-500"
 style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
 >
 GAFFER
 </div>
 </div>
 )}
 </div>
 );
}

/**
 * GafferTagline — the rotating tagline component.
 *
 * Shows one of several taglines that capture the Gaffer voice: the manager's
 * perspective on football — tactics, pressure, dressing rooms, touchline
 * drama. Picks deterministically by day so it stays consistent within a
 * session but doesn't feel stale across launches.
 */
const GAFFER_TAGLINES = [
 "Picks the team. Takes the flak.",
 "Eleven men. One whistle. No excuses.",
 "The gaffer's word is law.",
 "From the dugout to the hall of fame.",
];

export function GafferTagline({ className = "" }: { className?: string }) {
 // Deterministic pick by day so it stays stable in a session.
 const dayIndex = new Date().getDate() % GAFFER_TAGLINES.length;
 return (
 <p
 className={`text-center text-sm italic text-gray-500 dark:text-gray-400 mt-1 ${className}`}
 style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
 >
 {GAFFER_TAGLINES[dayIndex]}
 </p>
 );
}
