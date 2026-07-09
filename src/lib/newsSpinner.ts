/**
 * Sensationalist news spinner — takes a basic news template and "spins" it
 * into a more attention-grabbing headline the way real tabloids do.
 *
 * Real football journalism takes a quote, an event, or a stat and frames
 * it through a lens: CONFIDENCE, CRISIS, RUMOUR, OUTRAGE, GLORY, FLOP.
 * The same 1-0 win can be:
 *   - "Brave {{team}} grind out vital three points"
 *   - "{{team}} steal it — opponents robbed, claims rival boss"
 *   - "CONTROVERSY: {{team}} benefit from soft penalty"
 *   - "{{scorer}} writes his name into {{team}} folklore"
 *
 * This module picks a "spin" deterministically from the article seed so
 * the same article always renders the same way (no flickering on re-render),
 * but different articles get different spins — so the news feed feels
 * alive and varied rather than templated.
 */

/** The narrative angle applied to a story. */
export type NewsSpin =
 | "straight" // factual, neutral
 | "crisis" // doom, gloom, knives out
 | "glory" // praise, triumph, hero worship
 | "controversy" // referee, scandal, injustice
 | "rumour" // whispers, sources, "understood to"
 | "outrage" // moral panic, fans furious
 | "whisper" // dressing room unrest, quiet speculation
 | "fairytale" // underdog, romantic, against-the-odds;

const SPIN_BY_CATEGORY: Record<string, NewsSpin[]> = {
 // Default rotations — most stories should get straight or one mild spin.
 default: ["straight", "glory", "crisis", "controversy", "rumour"],
 // Big wins / losses get more extreme spins.
 win: ["glory", "fairytale", "straight", "controversy"],
 loss: ["crisis", "outrage", "straight", "rumour"],
 draw: ["straight", "whisper", "rumour"],
 // Managerial changes always get a strong spin.
 managerSacked: ["outrage", "crisis", "straight"],
 managerHired: ["glory", "rumour", "straight"],
 // Transfer stories get rumour-heavy treatment.
 transfer: ["rumour", "controversy", "straight"],
 recordFee: ["glory", "outrage", "straight"],
 // Form stories.
 winningStreak: ["glory", "fairytale", "straight"],
 losingStreak: ["crisis", "outrage", "rumour"],
 // Cup upsets get the romance angle.
 cupUpset: ["fairytale", "glory", "controversy"],
 // Dressing room stories always whisper.
 dressingRoom: ["whisper", "crisis", "rumour"],
};

/**
 * Apply a spin to a base headline. Returns the original headline for the
 * "straight" spin. For other spins, wraps/transforms the headline with
 * tabloid-style framing.
 *
 * The transformations are deliberately clichéd — that's the point. Real
 * tabloid headlines lean on the same tired phrases week after week, and
 * matching that voice is what makes the news feed feel authentic.
 */
export function spinHeadline(
 baseHeadline: string,
 category: string,
 seed: string,
): { headline: string; spin: NewsSpin } {
 const rotations = SPIN_BY_CATEGORY[category] ?? SPIN_BY_CATEGORY.default;
 const idx = stableHash(seed) % rotations.length;
 const spin = rotations[idx];

 return { headline: applySpin(baseHeadline, spin), spin };
}

function applySpin(headline: string, spin: NewsSpin): string {
 switch (spin) {
 case "straight":
 return headline;
 case "crisis":
 // Prefix with crisis-laden adjectives if not already shouty.
 if (/[A-Z]{4,}/.test(headline)) return headline; // already has caps
 return `CRISIS: ${headline}`;
 case "glory":
 // Add a triumphant suffix — but only if it doesn't already end with punctuation.
 if (/[.!?]$/.test(headline)) return headline;
 return `${headline} — and the fans are loving it`;
 case "controversy":
 return `CONTROVERSY: ${headline}`;
 case "rumour":
 return `${headline} (sources claim)`;
 case "outrage":
 return `OUTRAGE: ${headline}`;
 case "whisper":
 return `${headline} — whispers from inside the club`;
 case "fairytale":
 return `ROMANCE: ${headline}`;
 default:
 return headline;
 }
}

/** Stable string hash — same input always produces same output. */
function stableHash(s: string): number {
 let h = 5381;
 for (let i = 0; i < s.length; i++) {
 h = ((h << 5) + h + s.charCodeAt(i)) | 0;
 }
 return Math.abs(h);
}

/**
 * Get a CSS class for styling a news headline based on its spin.
 * Tabloid-style spins get bolder/coloured treatment; straight news stays
 * neutral. This lets the news feed have visual variety that mirrors the
 * editorial framing.
 */
export function spinClassName(spin: NewsSpin): string {
 switch (spin) {
 case "crisis":
 case "outrage":
 return "text-danger-700 dark:text-danger-400 font-bold";
 case "glory":
 case "fairytale":
 return "text-primary-700 dark:text-primary-400 font-bold";
 case "controversy":
 return "text-accent-700 dark:text-accent-400 font-bold";
 case "rumour":
 case "whisper":
 return "text-gray-600 dark:text-gray-400 italic";
 default:
 return "text-gray-900 dark:text-gray-100";
 }
}
