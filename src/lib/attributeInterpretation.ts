/**
 * Attribute Interpretation Layer — the heart of the Gaffer voice.
 *
 * Players don't see raw attribute numbers (e.g. "Pace: 87"). They see short,
 * personality-laden descriptions that vary by tier AND by attribute — so a
 * pace-87 winger is "electric, leaves fullbacks for dead" while a
 * composure-87 striker is "ice-cold in front of the roaring away end".
 *
 * Each attribute has 7 tiered descriptions (elite / strong / capable /
 * solid / average / weak / poor) plus a "hidden" descriptor used when
 * the attribute is one the manager can't see (scouting incomplete).
 *
 * The interpretation also drives the SHORT label shown in tight UI (like
 * pitch tokens) — e.g. "Electric" rather than the full phrase.
 *
 * Designed to be reactive: drop into any existing attribute display by
 * swapping `value: 87` for `interpretAttribute('pace', 87)`.
 */

export type AttributeKey =
 | "pace" | "burst" | "engine" | "power" | "agility"
 | "passing" | "distribution" | "touch" | "finishing" | "defending" | "aerial"
 | "anticipation" | "vision" | "decisions" | "composure" | "leadership"
 | "aggression" | "teamwork" | "stability" | "morale"
 | "shot_stopping" | "commanding" | "playing_out";

export interface AttrTier {
 /** 0-100 numeric threshold (>= threshold => this tier). */
 min: number;
 /** Short label — 1-2 words for tight UI. */
 short: string;
 /** Full description in Gaffer voice — shown in player profile. */
 description: string;
}

export interface AttrSpec {
 /** Display name of the attribute (footie term, not clinical). */
 label: string;
 /** Footie-friendly name for the group it belongs to. */
 group: "body" | "ball" | "head" | "gloves" | "hidden";
 /** Whether this attribute is hidden from the manager by default. */
 hiddenByDefault?: boolean;
 /** Per-tier descriptions, ordered from highest to lowest threshold. */
 tiers: AttrTier[];
}

/**
 * The full attribute registry.
 *
 * Note on "The Head": previously this group showed raw personality terms
 * (Neuroticism, Agreeableness) which read like a clinical psychological
 * report. The Gaffer voice reframes them as football traits:
 *   - neuroticism  → "Edge"     (the fire, the temper, the will to win)
 *   - agreeableness → "Team Ethic" (willingness to track back, work for the shirt)
 * These are derived values, not the raw personality scores — same engine
 * underneath, but the player sees football language.
 *
 * Hidden attributes (stability, morale are visible; aggression/teamwork are
 * derived; "commanding" / "playing_out" only show for GKs).
 */
export const ATTRIBUTE_SPECS: Record<AttributeKey, AttrSpec> = {
 // ───────────────────────── THE BODY ─────────────────────────
 pace: {
 label: "Pace",
 group: "body",
 tiers: [
 { min: 85, short: "Electric", description: "Electric top speed — leaves fullbacks eating turf in a footrace." },
 { min: 75, short: "Rapid", description: "Rapid — quick over 30 yards, will win most chases." },
 { min: 65, short: "Handy", description: "Handy in a sprint, will win his share." },
 { min: 55, short: "Steady", description: "Steady enough, won't embarrass himself in a chase." },
 { min: 45, short: "Pedestrian", description: "Pedestrian — top speed is nothing special." },
 { min: 30, short: "Slow", description: "Slow — caught from behind too often." },
 { min: 0, short: "Lead-footed", description: "Lead-footed — the kind of pace that gets strikers mocked." },
 ],
 },
 burst: {
 label: "Burst",
 group: "body",
 tiers: [
 { min: 85, short: "Explosive", description: "Explosive first step — beats his man in the first 5 yards, before top speed matters." },
 { min: 75, short: "Sharp", description: "Sharp acceleration — gets half a yard instantly." },
 { min: 65, short: "Lively", description: "Lively off the mark — quick first step." },
 { min: 55, short: "Decent", description: "Decent burst — no slouch but no threat either." },
 { min: 45, short: "Sluggish", description: "Sluggish off the mark — needs a head start." },
 { min: 30, short: "Laboured", description: "Laboured — the first 5 yards take forever." },
 { min: 0, short: "Stationary", description: "Stationary — like a van trying to overtake on a hill." },
 ],
 },
 engine: {
 label: "Engine",
 group: "body",
 tiers: [
 { min: 85, short: "Diesel", description: "Proper diesel — runs all day, never stops." },
 { min: 75, short: "Workhorse", description: "Workhorse — box-to-box for 90 minutes, no issue." },
 { min: 65, short: "Fit", description: "Fit enough, lasts the match comfortably." },
 { min: 55, short: "Average", description: "Average stamina. Will need managing in extra time." },
 { min: 45, short: "Tires", description: "Tires badly after 70 minutes." },
 { min: 30, short: "Gassed", description: "Gassed by the hour mark. A 60-minute footballer." },
 { min: 0, short: "Puffing", description: "Puffing after 30 minutes. The physio's going to earn his wage." },
 ],
 },
 power: {
 label: "Power",
 group: "body",
 tiers: [
 { min: 85, short: "Bulldozer", description: "Bulldozer — defenders bounce off him." },
 { min: 75, short: "Strong", description: "Strong as an ox. Wins his battles." },
 { min: 65, short: "Sturdy", description: "Sturdy enough, holds his ground." },
 { min: 55, short: "Wirey", description: "Wirey. Can be shoved off the ball." },
 { min: 45, short: "Lightweight", description: "Lightweight. Needs to avoid the physical battle." },
 { min: 30, short: "Pushover", description: "Pushover. Gets brushed aside too easily." },
 { min: 0, short: "Featherweight", description: "Featherweight. A stiff breeze knocks him over." },
 ],
 },
 agility: {
 label: "Agility",
 group: "body",
 tiers: [
 { min: 85, short: "Cat-like", description: "Cat-like — turns on a sixpence, impossible to mark." },
 { min: 75, short: "Nimble", description: "Nimble feet, twists defenders inside out." },
 { min: 65, short: "Spry", description: "Spry, gets through tight spaces." },
 { min: 55, short: "Adequate", description: "Adequate movement, no dancer but no statue." },
 { min: 45, short: "Stiff", description: "Stiff in the hips. Struggles to change direction." },
 { min: 30, short: "Wooden", description: "Wooden. Turns like a cargo ship." },
 { min: 0, short: "Rigid", description: "Rigid. Any sudden movement and he's on the deck." },
 ],
 },

 // ───────────────────────── THE BALL ─────────────────────────
 passing: {
 label: "Passing",
 group: "ball",
 tiers: [
 { min: 85, short: "Puppeteer", description: "Puppeteer — pulls every string on the pitch." },
 { min: 75, short: "Pinpoint", description: "Pinpoint passing, finds angles others don't see." },
 { min: 65, short: "Tidy", description: "Tidy distributor, keeps the ball moving." },
 { min: 55, short: "Decent", description: "Decent passer, finds his man at the back." },
 { min: 45, short: "Wayward", description: "Wayward. Drifts too many into touch." },
 { min: 30, short: "Loose", description: "Loose. Loses the ball trying to play out." },
 { min: 0, short: "Hospital", description: "Hospital passes. His teammates won't thank him." },
 ],
 },
 distribution: {
 label: "Distribution",
 group: "ball",
 tiers: [
 { min: 85, short: "Quarterback", description: "Quarterback range — switches play like he's got a map." },
 { min: 75, short: "Rangey", description: "Rangey. Picks out the long diagonal every time." },
 { min: 65, short: "Useful", description: "Useful distributor, finds the forwards consistently." },
 { min: 55, short: "Basic", description: "Basic. Does the simple things, doesn't try the clever." },
 { min: 45, short: "Limited", description: "Limited range. Anything over 30 yards is a guess." },
 { min: 30, short: "Hospital", description: "Hospital. Long balls go anywhere but to a teammate." },
 { min: 0, short: "Sieve", description: "Sieve. Every long ball is a 50-50 at best." },
 ],
 },
 touch: {
 label: "Touch",
 group: "ball",
 tiers: [
 { min: 85, short: "Velvet", description: "Velvet — kills anything into his feet, instant control." },
 { min: 75, short: "Soft", description: "Soft touch, never gives the defender a sniff." },
 { min: 65, short: "Clean", description: "Clean first touch, sets himself properly." },
 { min: 55, short: "Workable", description: "Workable touch, takes a second to bring it down." },
 { min: 45, short: "Heavy", description: "Heavy touch. Gives defenders a chance to nip in." },
 { min: 30, short: "Clunky", description: "Clunky. The ball bounces off him like a trampoline." },
 { min: 0, short: "Trampoline", description: "Trampoline. Every touch is a 50-50 for the opposition." },
 ],
 },
 finishing: {
 label: "Finishing",
 group: "ball",
 tiers: [
 { min: 85, short: "Predator", description: "Predator — chance is half a chance with him." },
 { min: 75, short: "Clinical", description: "Clinical finisher, doesn't waste openings." },
 { min: 65, short: "Reliable", description: "Reliable in front of goal, takes the right option." },
 { min: 55, short: "Patchy", description: "Patchy. Scores the easy ones, misses the hard." },
 { min: 45, short: "Wayward", description: "Wayward. Snatches at chances, hits the stand too often." },
 { min: 30, short: "Profligate", description: "Profligate. You'd back the keeper over him most weeks." },
 { min: 0, short: "Goal-shy", description: "Goal-shy. Forwards are paid to score — this one isn't earning it." },
 ],
 },
 defending: {
 label: "Defending",
 group: "ball",
 tiers: [
 { min: 85, short: "Wall", description: "A wall. Reads it, nicks it, plays it simple." },
 { min: 75, short: "Solid", description: "Solid defender, holds his line and wins his duels." },
 { min: 65, short: "Steady", description: "Steady at the back, does the basics right." },
 { min: 55, short: "Beatable", description: "Beatable. Good wingers will have a field day." },
 { min: 45, short: "Leaky", description: "Leaky. Loses his man at the wrong moment." },
 { min: 30, short: "Liability", description: "Liability. The kind of defender managers drop after a fortnight." },
 { min: 0, short: "Turnstile", description: "Turnstile. Anyone can walk through him." },
 ],
 },
 aerial: {
 label: "Aerial",
 group: "ball",
 tiers: [
 { min: 85, short: "Spring-heeled", description: "Spring-heeled — wins everything in the air." },
 { min: 75, short: "Dominant", description: "Dominant in the air, attacks and defends set pieces." },
 { min: 65, short: "Decent", description: "Decent in the air, wins his share of headers." },
 { min: 55, short: "Average", description: "Average. Doesn't lose them but doesn't dominate." },
 { min: 45, short: "Weak", description: "Weak aerially. Gets bullied by bigger forwards." },
 { min: 30, short: "Bypassed", description: "Bypassed in the air. Long balls go straight over him." },
 { min: 0, short: "Grounded", description: "Grounded. Might as well not jump." },
 ],
 },

 // ───────────────────────── THE HEAD ─────────────────────────
 // Reframed from clinical personality terms into footie language.
 anticipation: {
 label: "Reading",
 group: "head",
 tiers: [
 { min: 85, short: "Seer", description: "Reads the game three passes ahead — seems to know where the ball is going before it does." },
 { min: 75, short: "Sharp", description: "Sharp reader, intercepts danger before it develops." },
 { min: 65, short: "Aware", description: "Aware of his surroundings, spots danger early." },
 { min: 55, short: "Average", description: "Average reader, gets caught ball-watching." },
 { min: 45, short: "Reactive", description: "Reactive. Has to see it to react to it." },
 { min: 30, short: "Flat-footed", description: "Flat-footed. Always a step behind the play." },
 { min: 0, short: "Lost", description: "Looks lost. Like a fan who's wandered onto the pitch." },
 ],
 },
 vision: {
 label: "Vision",
 group: "head",
 tiers: [
 { min: 85, short: "360°", description: "Sees the whole pitch — plays passes others don't even know are on." },
 { min: 75, short: "Perceptive", description: "Perceptive. Spots the run before the runner does." },
 { min: 65, short: "Aware", description: "Aware of options, picks the right one most of the time." },
 { min: 55, short: "Narrow", description: "Narrow vision. Sees what's in front of him, nothing else." },
 { min: 45, short: "Tunnel", description: "Tunnel vision. Plays the obvious ball every time." },
 { min: 30, short: "Blunt", description: "Blunt. Misses runners in acres of space." },
 { min: 0, short: "Blind", description: "Blind to anything not directly at his feet." },
 ],
 },
 decisions: {
 label: "Decisions",
 group: "head",
 tiers: [
 { min: 85, short: "Ice-cold", description: "Ice-cold decisions under pressure — always picks the right option." },
 { min: 75, short: "Sound", description: "Sound decision-maker, rarely makes the wrong call." },
 { min: 65, short: "Sensible", description: "Sensible. Plays the percentages, doesn't gamble stupidly." },
 { min: 55, short: "Average", description: "Average. Gets it right more than wrong." },
 { min: 45, short: "Rash", description: "Rash. Chooses the wrong option at key moments." },
 { min: 30, short: "Headless", description: "Headless. Decisions all over the shop." },
 { min: 0, short: "Reckless", description: "Reckless. The kind that gets sent off or concedes penalties." },
 ],
 },
 composure: {
 label: "Composure",
 group: "head",
 tiers: [
 { min: 85, short: "Ice", description: "Ice-cold in front of the roaring away end. Pressure bounces off him." },
 { min: 75, short: "Calm", description: "Calm under pressure, doesn't rush his decisions." },
 { min: 65, short: "Steady", description: "Steady when it matters, holds his nerve." },
 { min: 55, short: "Workable", description: "Workable. Will fold occasionally in the big moments." },
 { min: 45, short: "Twitchy", description: "Twitchy under pressure. Snatches at things." },
 { min: 30, short: "Brittle", description: "Brittle. Goes missing when the heat is on." },
 { min: 0, short: "Bottle-able", description: "Bottle-able. The kind you don't trust with a penalty in injury time." },
 ],
 },
 leadership: {
 label: "Captaincy",
 group: "head",
 tiers: [
 { min: 85, short: "Skipper", description: "Natural skipper — drags the team up by its shirt collar when they need it." },
 { min: 75, short: "Vocal", description: "Vocal leader, organises the lads and demands standards." },
 { min: 65, short: "Steadying", description: "Steadying presence, the kind you want next to the kids." },
 { min: 55, short: "Quiet", description: "Quiet. Leads by example if at all." },
 { min: 45, short: "Silent", description: "Silent. Says nothing, does nothing." },
 { min: 30, short: "Detached", description: "Detached from the group. His own man, for better or worse." },
 { min: 0, short: "Lonewolf", description: "Lonewolf. Wouldn't say a word if the dressing room was on fire." },
 ],
 },
 aggression: {
 label: "Edge",
 group: "head",
 tiers: [
 { min: 85, short: "Snarling", description: "Snarling — leaves a bit on every tackle. Defenders hate playing against him." },
 { min: 75, short: "Tenacious", description: "Tenacious, harries defenders into mistakes." },
 { min: 65, short: "Sprited", description: "Spirited, won't be pushed around." },
 { min: 55, short: "Polite", description: "Polite. Doesn't impose himself physically." },
 { min: 45, short: "Soft", description: "Soft. Won't put a foot in when it matters." },
 { min: 30, short: "Timid", description: "Timid. Pulls out of challenges." },
 { min: 0, short: "Gentle", description: "Gentle. A nice lad, wrong sport." },
 ],
 },
 teamwork: {
 label: "Team Ethic",
 group: "head",
 tiers: [
 { min: 85, short: "Selfless", description: "Selfless — runs through brick walls for the shirt, never hides." },
 { min: 75, short: "Committed", description: "Committed team player, tracks back, does the dirty work." },
 { min: 65, short: "Willing", description: "Willing. Plays for the team, not himself." },
 { min: 55, short: "Average", description: "Average. Does his job, doesn't do extra." },
 { min: 45, short: "Selfish", description: "Selfish. Doesn't track back, doesn't pass when he should." },
 { min: 30, short: "Lazy", description: "Lazy out of possession. Lets teammates do the running." },
 { min: 0, short: "Pasenger", description: "Passenger. The other ten are carrying him." },
 ],
 },

 // ───────────────────────── THE HIDDEN ─────────────────────────
 // These are intentionally hidden from the manager by default — they're
 // "show your work" attributes that reveal themselves over time through
 // behaviour, not raw numbers. Visible only via scouting + observation.
 stability: {
 label: "Stability",
 group: "hidden",
 hiddenByDefault: true,
 tiers: [
 { min: 85, short: "Ice Man", description: "Ice Man — never lets a mistake compound, never loses his head. Big-game player." },
 { min: 75, short: "Composed", description: "Composed in big moments — the kind you trust with a penalty in the 93rd minute." },
 { min: 65, short: "Steady", description: "Steady Hand. Bounces back from setbacks quickly." },
 { min: 55, short: "Mixed", description: "Runs Hot and Cold — brilliant one week, anonymous the next." },
 { min: 45, short: "Volatile", description: "Volatile. Form fluctuates wildly with confidence." },
 { min: 30, short: "Fragile", description: "Fragile. One mistake and he's gone for the afternoon." },
 { min: 0, short: "Roll of the Dice", description: "Roll of the Dice — you never know which version turns up." },
 ],
 },
 morale: {
 label: "Morale",
 group: "hidden",
 hiddenByDefault: true,
 tiers: [
 { min: 85, short: "Flying", description: "Flying — bouncing into training, can't wait for matchday." },
 { min: 75, short: "Buzzing", description: "Buzzing. Confident, sharp, loving his football." },
 { min: 65, short: "Upbeat", description: "Upbeat. Settled and happy in his work." },
 { min: 55, short: "Mixed", description: "Mixed. Some weeks good, some weeks moody." },
 { min: 45, short: "Flat", description: "Flat. Body language is poor, head's down." },
 { min: 30, short: "Unhappy", description: "Unhappy. Wants out, or wants more minutes, or wants the gaffer sacked." },
 { min: 0, short: "Toxic", description: "Toxic. Spreading misery through the dressing room." },
 ],
 },

 // ───────────────────────── THE GLOVES (GK only) ─────────────────────────
 shot_stopping: {
 label: "Shot Stopping",
 group: "gloves",
 tiers: [
 { min: 85, short: "Wall", description: "Wall between the sticks — saves things he has no right to." },
 { min: 75, short: "Reliable", description: "Reliable keeper, makes the saves he should and a few he shouldn't." },
 { min: 65, short: "Solid", description: "Solid shot-stopper, doesn't make howlers." },
 { min: 55, short: "Average", description: "Average. Beats more than he saves." },
 { min: 45, short: "Leaky", description: "Leaky. Lets too many through him." },
 { min: 30, short: "Calamity", description: "Calamity. You hold your breath every shot." },
 { min: 0, short: "Sieve", description: "Sieve. Defenders don't trust him — and rightly so." },
 ],
 },
 commanding: {
 label: "Commanding",
 group: "gloves",
 tiers: [
 { min: 85, short: "Authoritative", description: "Authoritative — owns his box, defenders get out of his way." },
 { min: 75, short: "Assertive", description: "Assertive. Comes for crosses, claims his ball." },
 { min: 65, short: "Decent", description: "Decent on crosses, takes the simple ones." },
 { min: 55, short: "Hesitant", description: "Hesitant. Stays on his line when he should come." },
 { min: 45, short: "Rooted", description: "Rooted to the line. Defenders deal with everything aerial." },
 { min: 30, short: "Nervy", description: "Nervy. Flaps at crosses, drops the easy ones." },
 { min: 0, short: "Rabbit", description: "Rabbit in headlights when the ball comes in high." },
 ],
 },
 playing_out: {
 label: "Playing Out",
 group: "gloves",
 tiers: [
 { min: 85, short: "Sweeper-keeper", description: "Sweeper-keeper — plays the ball out like a quarter-back, comes off his line like an extra defender." },
 { min: 75, short: "Comfortable", description: "Comfortable with the ball at his feet, picks the right pass." },
 { min: 65, short: "Adequate", description: "Adequate distributor, doesn't make mistakes playing out." },
 { min: 55, short: "Basic", description: "Basic. Plays it short, never tries anything clever." },
 { min: 45, short: "Limited", description: "Limited. Best to just hoof it." },
 { min: 30, short: "Risky", description: "Risky. Tries to play out and gets caught too often." },
 { min: 0, short: "Liability", description: "Liability with his feet. Defenders hide when he has the ball." },
 ],
 },
};

/**
 * Look up the tier description for a given attribute + value.
 * Falls back to a generic description if the attribute isn't found.
 */
export function interpretAttribute(key: AttributeKey, value: number): AttrTier {
 const spec = ATTRIBUTE_SPECS[key];
 if (!spec) {
 return {
 min: 0,
 short: "Unknown",
 description: "Unknown attribute.",
 };
 }
 for (const tier of spec.tiers) {
 if (value >= tier.min) return tier;
 }
 return spec.tiers[spec.tiers.length - 1];
}

/**
 * Position-dependent attribute overrides.
 *
 * Some attributes don't apply to certain positions — a GK's finishing is
 * irrelevant, a striker's shot stopping is meaningless. For those
 * combinations, we return "Not their role" instead of a tier description.
 *
 * For other attributes, the description may vary by position — e.g. a
 * CB's "pace" is described differently than a winger's "pace" because
 * the same number means different things in context.
 */
const POSITION_ATTRIBUTE_OVERRIDES: Record<string, Partial<Record<AttributeKey, { short: string; description: string }>>> = {
 Goalkeeper: {
 finishing: { short: "N/A", description: "Not his job — he's there to stop them, not score them." },
 defending: { short: "N/A", description: "Not his role — that's what the back four's for." },
 aerial: { short: "Claiming", description: "Comes for crosses and claims the ball under pressure." },
 pace: { short: "Off the Line", description: "How quick he is off his line to sweep up." },
 burst: { short: "Reactions", description: "First-step reactions to shots — getting down quickly." },
 },
 Defender: {
 // Defenders' finishing is a nice-to-have but not critical
 finishing: { short: "For Set Pieces", description: "Useful at set pieces — not relied upon in open play." },
 },
 Midfielder: {
 // Midfielders' aerial is mainly for defensive headers
 aerial: { short: "Aerial Duels", description: "Wins his share of headers in midfield battles." },
 },
 Forward: {
 // Forwards' defending is press-and-harass, not block-and-tackle
 defending: { short: "Pressing", description: "Pressing from the front — harries defenders into mistakes." },
 shot_stopping: { short: "N/A", description: "Not his job — he's at the other end." },
 commanding: { short: "N/A", description: "Not his role." },
 playing_out: { short: "N/A", description: "Not his role." },
 },
};

/**
 * Interpret an attribute for a SPECIFIC player position.
 *
 * This is the position-aware version of `interpretAttribute()` — it
 * returns "Not their role" for irrelevant attribute/position combinations
 * (e.g. a GK's finishing), and returns position-specific descriptions
 * for attributes that mean different things in different positions
 * (e.g. a CB's pace vs a winger's pace).
 *
 * Falls back to the standard interpretation when no position override
 * exists.
 */
export function interpretAttributeForPosition(
 key: AttributeKey,
 value: number,
 position?: string | null,
): AttrTier {
 // Check for position-specific override.
 const posKey = normalisePositionKey(position);
 const override = POSITION_ATTRIBUTE_OVERRIDES[posKey]?.[key];
 if (override) {
 return {
 min: 0,
 short: override.short,
 description: override.description,
 };
 }
 // Standard interpretation.
 return interpretAttribute(key, value);
}

/** Normalise a position string to a key in POSITION_ATTRIBUTE_OVERRIDES. */
function normalisePositionKey(position?: string | null): string {
 if (!position) return "";
 const p = position.toLowerCase().trim();
 if (p.includes("gk") || p.includes("goal")) return "Goalkeeper";
 if (p.includes("def") || p.includes("back") || p.includes("centre half")) return "Defender";
 if (p.includes("mid") || p.includes("centre")) return "Midfielder";
 if (p.includes("fwd") || p.includes("forward") || p.includes("str") || p.includes("wing")) return "Forward";
 return "";
}

/**
 * Get the human-readable label for an attribute.
 */
export function getAttributeLabel(key: AttributeKey): string {
 return ATTRIBUTE_SPECS[key]?.label ?? key;
}

/**
 * Get the group for an attribute (body / ball / head / gloves / hidden).
 */
export function getAttributeGroup(key: AttributeKey): AttrSpec["group"] {
 return ATTRIBUTE_SPECS[key]?.group ?? "head";
}

/**
 * Should this attribute be visible to the manager by default?
 *
 * Hidden attributes (stability, morale) are revealed only through scouting
 * and observation — they're the "show your work" attributes that the
 * manager has to discover over time, not raw numbers on day one.
 */
export function isAttributeHiddenByDefault(key: AttributeKey): boolean {
 return ATTRIBUTE_SPECS[key]?.hiddenByDefault === true;
}

/**
 * Returns all attribute keys belonging to a given group, in display order.
 */
export function getAttributesByGroup(group: AttrSpec["group"]): AttributeKey[] {
 return (Object.keys(ATTRIBUTE_SPECS) as AttributeKey[]).filter(
 (key) => ATTRIBUTE_SPECS[key].group === group,
 );
}

/**
 * Short label for a value (e.g. "Electric") — for tight UI like pitch tokens.
 */
export function shortAttrLabel(key: AttributeKey, value: number): string {
 return interpretAttribute(key, value).short;
}
