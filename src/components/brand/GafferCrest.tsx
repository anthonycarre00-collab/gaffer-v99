/**
 * GafferCrest — the professional brand mark for The Gaffer.
 *
 * A premium football association-style crest: brass shield with pitch-green
 * inner field, a tactical formation diagram at the center (representing the
 * manager's craft), crossed whistles flanking the shield, monogram "G" in
 * a serif typeface, and a ribbon banner with the tagline.
 *
 * Design philosophy: looks like a real football association badge (The FA,
 * DFB, FIGC) but with the Gaffer's identity — tactics at the heart, not
 * a ball. The formation diagram makes it instantly recognizable as a
 * management game, not just a football game.
 *
 * Tagline: "Tactics. Touchlines. Trophies." — three T's, captures the three
 * pillars of management (setup, matchday, winning). Proper football voice.
 */

interface GafferCrestProps {
 size?: number;
 className?: string;
 withWordmark?: boolean;
 withTagline?: boolean;
}

export function GafferCrest({
 size = 96,
 className = "",
 withWordmark = true,
 withTagline = false,
}: GafferCrestProps) {
 const brassGrad = "gaffer-brass-grad";
 const greenGrad = "gaffer-green-grad";
 return (
 <div className={`inline-flex flex-col items-center ${className}`}>
 <svg
 width={size}
 height={size * 1.15}
 viewBox="0 0 120 138"
 xmlns="http://www.w3.org/2000/svg"
 role="img"
 aria-label="The Gaffer crest"
 >
 <defs>
 <linearGradient id={brassGrad} x1="0%" y1="0%" x2="0%" y2="100%">
 <stop offset="0%" stopColor="#e8c25a" />
 <stop offset="40%" stopColor="#c9972e" />
 <stop offset="100%" stopColor="#8b6214" />
 </linearGradient>
 <linearGradient id={greenGrad} x1="0%" y1="0%" x2="0%" y2="100%">
 <stop offset="0%" stopColor="#1a5d3a" />
 <stop offset="50%" stopColor="#0d3b25" />
 <stop offset="100%" stopColor="#062018" />
 </linearGradient>
 <linearGradient id="gaffer-shine" x1="0%" y1="0%" x2="100%" y2="100%">
 <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
 <stop offset="50%" stopColor="rgba(255,255,255,0)" />
 </linearGradient>
 </defs>

 {/* Outer shield — brass with beveled edge */}
 <path
 d="M60 4 L108 20 L108 58 Q108 96 60 134 Q12 96 12 58 L12 20 Z"
 fill={`url(#${brassGrad})`}
 stroke="#5a3d12"
 strokeWidth="1.5"
 />
 {/* Inner shield — pitch green */}
 <path
 d="M60 10 L102 24 L102 56 Q102 88 60 126 Q18 88 18 56 L18 24 Z"
 fill={`url(#${greenGrad})`}
 />
 {/* Shine effect on shield */}
 <path
 d="M60 10 L102 24 L102 40 Q60 30 18 40 L18 24 Z"
 fill="url(#gaffer-shine)"
 opacity="0.5"
 />

 {/* Formation diagram at center — the manager's craft */}
 {/* Pitch lines (mini football pitch) */}
 <rect x="28" y="48" width="64" height="40" fill="none" stroke="rgba(212,166,74,0.4)" strokeWidth="0.8" rx="1" />
 <line x1="60" y1="48" x2="60" y2="88" stroke="rgba(212,166,74,0.4)" strokeWidth="0.8" />
 <circle cx="60" cy="68" r="7" fill="none" stroke="rgba(212,166,74,0.4)" strokeWidth="0.8" />
 <circle cx="60" cy="68" r="1" fill="rgba(212,166,74,0.6)" />
 {/* Center circle dot */}
 {/* Mini penalty boxes */}
 <rect x="44" y="48" width="32" height="6" fill="none" stroke="rgba(212,166,74,0.3)" strokeWidth="0.5" />
 <rect x="44" y="82" width="32" height="6" fill="none" stroke="rgba(212,166,74,0.3)" strokeWidth="0.5" />

 {/* Formation dots (4-3-3) — represents the tactical element */}
 {/* GK */}
 <circle cx="60" cy="84" r="2.5" fill="#e8c25a" stroke="#5a3d12" strokeWidth="0.5" />
 {/* DEF (4) */}
 <circle cx="38" cy="76" r="2" fill="#e8c25a" opacity="0.85" />
 <circle cx="50" cy="76" r="2" fill="#e8c25a" opacity="0.85" />
 <circle cx="70" cy="76" r="2" fill="#e8c25a" opacity="0.85" />
 <circle cx="82" cy="76" r="2" fill="#e8c25a" opacity="0.85" />
 {/* MID (3) */}
 <circle cx="44" cy="66" r="2" fill="#e8c25a" opacity="0.85" />
 <circle cx="60" cy="66" r="2" fill="#e8c25a" opacity="0.85" />
 <circle cx="76" cy="66" r="2" fill="#e8c25a" opacity="0.85" />
 {/* FWD (3) */}
 <circle cx="44" cy="56" r="2" fill="#e8c25a" opacity="0.85" />
 <circle cx="60" cy="54" r="2.5" fill="#e8c25a" stroke="#5a3d12" strokeWidth="0.5" />
 <circle cx="76" cy="56" r="2" fill="#e8c25a" opacity="0.85" />

 {/* Monogram "G" — serif, at the top of the shield */}
 <text
 x="60"
 y="40"
 textAnchor="middle"
 fontFamily="Georgia, 'Times New Roman', serif"
 fontSize="20"
 fontWeight="bold"
 fill="#e8c25a"
 letterSpacing="-1"
 >
 G
 </text>

 {/* Three stars below the formation (tactics, man-management, transfers) */}
 <g fill="#e8c25a">
 <path d="M44 100 L46 104 L50 104 L47 107 L48 111 L44 109 L40 111 L41 107 L38 104 L42 104 Z" transform="scale(0.5) translate(44 100)" />
 <circle cx="48" cy="104" r="1.5" />
 <circle cx="60" cy="105" r="1.8" />
 <circle cx="72" cy="104" r="1.5" />
 </g>

 {/* Bottom ribbon */}
 <path
 d="M30 110 Q60 118 90 110 L88 120 Q60 126 32 120 Z"
 fill="#c9972e"
 stroke="#5a3d12"
 strokeWidth="0.5"
 />
 <text
 x="60"
 y="118"
 textAnchor="middle"
 fontFamily="Georgia, 'Times New Roman', serif"
 fontSize="5"
 fontWeight="bold"
 fill="#3d2706"
 letterSpacing="0.5"
 >
 EST. 2024
 </text>
 </svg>

 {withWordmark && (
 <div className="mt-2 text-center">
 <div
 className="font-heading text-2xl font-bold uppercase tracking-[0.3em] text-accent-500"
 style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
 >
 GAFFER
 </div>
 </div>
 )}
 {withTagline && (
 <p
 className="mt-1 text-center text-sm italic text-gray-500 dark:text-gray-400"
 style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
 >
 Tactics. Touchlines. Trophies.
 </p>
 )}
 </div>
 );
}

/**
 * GafferTagline — the official tagline.
 * "Tactics. Touchlines. Trophies."
 */
const GAFFER_TAGLINES = [
 "Tactics. Touchlines. Trophies.",
];

export function GafferTagline({ className = "" }: { className?: string }) {
 return (
 <p
 className={`text-center text-sm italic text-gray-500 dark:text-gray-400 mt-1 ${className}`}
 style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
 >
 {GAFFER_TAGLINES[0]}
 </p>
 );
}
