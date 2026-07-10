# Gaffer V99+ — Ideas for Future Builds

This file captures ideas for future development after the V99 overhaul phases are complete. These are NOT commitments — they're suggestions to explore when the time is right.

---

## Match Experience

### 1. Match Highlights Packages (Gaffer Style)
**Concept:** After each match, generate a "highlights package" — a short textual replay of the key moments, told in the Gaffer's voice.

**How it would work:**
- The match engine already emits events (Goal, ShotSaved, Tackle, RedCard, etc.)
- After full-time, select the 5-8 most "notable" events (goals, big chances, red cards, late winners, great saves)
- Generate a narrative summary connecting them: "The lads started brightly, Smith finding the top corner on 12 minutes. But the red card on 35 changed everything..."
- Show this as a "Match Highlights" card on the post-match screen + in the news feed
- Different voice for wins vs losses vs draws

**Why it's cool:** Makes each match feel like a story, not just a scoreline. The Gaffer voice makes it feel like the manager is reliving the game in the pub afterward.

**Effort:** Medium — requires a narrative generator that chains events together. Engine events already exist.

---

### 2. Match Events Using Player Images (Pre-loaded)
**Concept:** Show player avatars alongside match events in the live commentary feed, with images pre-loaded before the match for performance.

**How it would work:**
- Before kick-off, pre-generate/cache portraits for all 22 starters + bench players
- During the match, each event in the feed shows the player's avatar next to the commentary line
- Goals show the scorer's face big; tackles show the tackler's face small
- Pre-loading means no lag during the match — images are already in memory

**Why it's cool:** Makes the match feel more visual and personal. You see the lad scoring, not just his name. FM does this with their 2D match view; we can do it with just portraits.

**Effort:** Medium — portrait generation already exists, just needs pre-loading + UI integration.

---

### 3. TV-Style Match Intro
**Concept:** Before each match, show a TV-style intro sequence — team lineups overlaying the stadium background, formation graphics, "today's fixture" branding.

**How it would work:**
- Use the existing stadium background + team colors
- Show both formations side by side with player names
- "Welcome to [stadium name]" in Gaffer voice
- 5-10 second animated transition into the match
- Skippable for repeat players

**Why it's cool:** Builds anticipation. Makes each match feel like an event, not just a screen.

**Effort:** Medium-High — requires animation work + stadium assets.

---

## Player Development & World Simulation

### 4. Reputation / Fame Levels for Players, Leagues, and Countries
**Concept:** A multi-tier reputation system that drives AI behavior, contract negotiations, and media coverage.

**How it would work:**
- **Player fame tiers:** Unknown → Prospect → Known → Established → Star → World Class → Legend
- **League prestige tiers:** Sunday League → Semi-Pro → Lower Division → Top Division → Continental → Elite
- **Country football prestige:** Drives national team strength + youth generation quality
- Fame affects:
  - Contract demands (stars want more money, unknowns will sign for less)
  - Transfer interest (AI clubs chase stars, not unknowns)
  - Media coverage (stars get more press, unknowns get none)
  - Sponsor deals (marquee signings boost sponsor income)
  - Fan morale (signing a star excites fans, selling one upsets them)

**Why it's cool:** Creates a living world where Haaland is treated differently than a League Two striker. Makes transfers + contracts feel realistic.

**Effort:** High — requires new data model + AI logic updates + contract negotiation rework. But the audit showed `reputation` already exists on teams; we'd extend it to players + leagues + countries.

---

### 5. Player Career Stories
**Concept:** Each player builds a unique career story over their playing days — international caps, milestone goals, long service, big-match performances.

**How it would work:**
- Track career events: debut, first goal, international cap, trophy wins, milestone appearances (100th, 250th, 500th)
- Generate narrative summaries: "After 8 years at the club, Smith has become a cult hero — 250 appearances, 2 relegation battles survived, 1 promotion secured"
- View on player profile "Career Story" tab
- Different stories for different player types:
  - **Journeymen:** "Played for 12 clubs, never quite settled, but always did a job"
  - **One-club legends:** "Spent his entire career at [club], through thick and thin"
  - **Wonderkids:** "Burst onto the scene at 17, the world was his oyster..."
  - **Late bloomers:** "Didn't break through until 26, but what a 5 years he had"

**Why it's cool:** Makes players feel like real people with arcs, not just stat sheets. You get attached to the lads.

**Effort:** Medium — requires career event tracking + narrative generator.

---

### 6. Player Partnerships
**Concept:** Certain players develop on-pitch partnerships over time — passing pairs, goal combinations, defensive duos — that give a slight match engine boost when they play together.

**How it would work:**
- Track passing combinations + goal partnerships over matches
- When a partnership exceeds a threshold (e.g. 20+ combined goals), apply a +1-2% boost to their interactions
- Generate news stories when partnerships form: "The new [Neville-Beckham] / [MSN]"
- Show partnership strength on player profiles
- Partnerships decay if players don't play together (loaned out, sold, injured)

**Why it's cool:** Makes team-building feel meaningful. You want to keep partnerships together. Creates emotional attachment.

**Effort:** Medium — requires combination tracking + match engine modifier + news generator.

---

## Match Engine

### 7. Match Engine Visual Representation
**Concept:** A simple 2D top-down pitch view showing player positions + ball movement during live matches.

**How it would work:**
- The engine already tracks ball_zone + possession
- Render a simple green pitch with dots for players (colored by team)
- Ball moves between zones with a small animation
- Goals show the ball in the net
- Doesn't need to be FM-quality — just enough to give visual context

**Why it's cool:** The text commentary is good but a visual makes it 10x more engaging. Even a simple dot-and-ball view would be a massive upgrade.

**Effort:** High — requires a canvas/SVG renderer + animation loop. But the engine data already exists.

---

### 8. Manager Touchline Reactions
**Concept:** During live matches, show the manager's (your) reaction options at key moments — not full team talks, just quick touchline shouts.

**How it would work:**
- At big moments (goal conceded, red card, late winner chance), show 2-3 quick options:
  - "Calm them down" / "Get into them" / "Change the shape"
- Each gives a tiny morale/composure modifier for the next 10 minutes
- The AI manager on the other side does the same
- Adds agency without interrupting the flow

**Why it's cool:** Makes you feel like you're on the touchline, not just watching. Quick decisions, not long menus.

**Effort:** Medium — UI + modifier application. Engine already supports modifiers.

---

### 9. Weather Conditions
**Concept:** Weather affects match play — rain makes passing harder, wind affects long balls, heat tires players faster.

**How it would work:**
- Each match has a weather condition (clear, rain, heavy rain, snow, fog, hot, cold)
- Weather modifies:
  - Pass success rate (rain: -5%)
  - Cross accuracy (wind: -10%)
  - Fatigue rate (heat: +20%)
  - Long ball effectiveness (fog: +10% — can't see to defend)
- Weather shown in pre-match + commentary mentions it

**Why it's cool:** Adds variety to matches. A rainy Tuesday night at Stoke should feel different to a sunny Saturday at the Emirates.

**Effort:** Low-Medium — modifier system already exists, just needs weather data + modifiers.

---

## Transfers & Contracts

### 10. Transfer Deadline Day Drama
**Concept:** The final day of the transfer window has special mechanics — panic buys, late bids, "medical scheduled" news, last-minute hijacks.

**How it would work:**
- On deadline day, AI clubs become more aggressive (higher chance of late bids)
- News feed shows "DEADLINE DAY" branding
- "Medical scheduled" / "Personal terms agreed" / "Club-to-club talks" status updates
- Last-hour countdown timer
- More likely to overpay or undersell as the clock ticks

**Why it's cool:** Deadline day is the most exciting day of the season. The game should reflect that.

**Effort:** Medium — AI behavior tweaks + news generation + UI countdown.

---

### 11. Player Release Clauses
**Concept:** Some players have release clauses in their contracts — if a bid meets the clause, the club can't refuse.

**How it would work:**
- When offering a contract, option to include a release clause
- Higher clause = lower wage demands (player accepts less for the security)
- If a bid meets the clause, the player is automatically allowed to talk to the bidding club
- AI clubs can have clauses too — you can trigger them

**Why it's cool:** Adds realism + strategy to contract negotiation. Do you risk a low clause to save wages?

**Effort:** Medium — contract model extension + AI logic.

---

## Youth & Academy

### 12. Youth Intake Day
**Concept:** Once a season, the academy produces a new batch of youth players — shown as a special "intake day" event with narrative.

**How it would work:**
- Once per season (pre-season), generate 3-5 new youth players
- Each comes with a short Gaffer-voice description: "Lad's got pace to burn but can't finish his dinner"
- Show as an inbox message + youth academy event
- Players can promote, loan, or release immediately

**Why it's cool:** Youth intake day is a FM classic — the excitement of "what did we get this year?"

**Effort:** Low — youth generation already exists, just needs the event + narrative wrapper.

---

### 13. Loan System Improvements
**Concept:** Better loan mechanics — loan fees, wage contribution negotiation, recall clauses, performance-based extensions.

**How it would work:**
- When loaning a player, negotiate:
  - Wage contribution % (already exists)
  - Loan fee (one-time payment to parent club)
  - Recall clause (can recall in January)
  - Play-time guarantee (player must start X% of games)
- AI clubs send loan offers for your young players
- Loan performance affects development

**Why it's cool:** Loans are how you develop young players. Making them feel real matters.

**Effort:** Medium — loan model extension + AI logic.

---

## Media & News

### 14. Social Media Feed
**Concept:** A "social media" style feed showing fan reactions, pundit opinions, and player posts — in addition to the formal news wire.

**How it would work:**
- After matches, generate 5-10 "fan tweets" reacting to the result
- Pundits give opinions on big signings/sackings
- Players occasionally "post" about milestones
- Different voices: die-hard fans, casual fans, pundits, journalists
- Gaffer voice throughout — "The fans are buzzing", "Pundits are piling on"

**Why it's cool:** Makes the world feel alive. You're not just managing a team, you're managing a brand.

**Effort:** Medium — content generation + new feed type.

---

### 15. Rival Manager Mind Games
**Concept:** Before big matches, rival managers can "play mind games" in the press — praising you (false), criticising you, or making bold predictions.

**How it would work:**
- Before derby/rivalry matches, AI manager may:
  - Praise your team (lowers pressure on them)
  - Criticise your tactics (winds you up)
  - Predict they'll win (raises stakes)
- You can respond via press conference options
- Responses affect fan + board morale slightly

**Why it's cool:** Adds personality to AI managers. The Wenger-Ferguson, Klopp-Guardiola dynamics.

**Effort:** Medium — AI manager personality + news generation + press conference integration.

---

## Long-Term / Ambitious

### 16. Multi-Season Career Mode with Board Types
**Concept:** Different clubs have different board types — sugar daddy, sensible, penny-pinching, ambitious — that affect what you can do.

**How it would work:**
- Board types: Sugar Daddy (big money, high expectations), Sensible (balanced), Penny-Pinching (low budget, patient), Ambitious (medium budget, high expectations)
- Board type affects: transfer budget, wage budget, patience threshold, facility investment
- Board type can change over time (new owner takes over)

**Why it's cool:** Managing at a sugar daddy club should feel different to managing at a penny-pincher.

**Effort:** High — new data model + AI logic + event generation.

---

### 17. International Management
**Concept:** After establishing yourself at club level, you can get offered international jobs — World Cup cycles, qualifying campaigns, tournament squads.

**How it would work:**
- International jobs offered based on club reputation + nationality
- International duty: pick squad from eligible players, play qualifiers + tournaments
- World Cup every 4 years (code already exists in `world_cup.rs`)
- International matches use simplified engine (less time pressure)

**Why it's cool:** The pinnacle of management. World Cup glory is the ultimate achievement.

**Effort:** High — but the national team code already exists, just needs the management layer.

---

### 18. Modding Support
**Concept:** Open up the game for community modding — custom leagues, custom players, custom face packs, custom commentary.

**How it would work:**
- Document the world DB JSON format
- Provide a world editor (already partially exists)
- Support community face packs (drop images in a folder)
- Support custom commentary lines (drop JSON in a folder)
- Steam Workshop integration (if we ever go Steam)

**Why it's cool:** Community content extends the game's lifespan indefinitely. FM has a massive modding community.

**Effort:** Medium — mostly documentation + file loading hooks.

---

## Technical Debt

### 19. Unify Resolution Modules
The audit found two parallel resolution modules (`engine/resolution.rs` + `live_match/zone_resolution.rs`) with subtle drift. Unifying them into a single module both simulators call would eliminate drift + reduce maintenance burden.

### 20. Commentary i18n Structure Fix
The commentary system has a pre-existing i18n structure mismatch (arrays vs expected object form) causing 7 test failures. Fixing this properly would require either restructuring the en.json commentary section or updating pickLine() to handle all cases.

### 21. Persist ScoutingKnowledge to SQLite
Currently `ScoutingKnowledge` relies on JSON-blob save path. Adding a proper SQLite table would future-proof against save format migrations.

---

## Priority Suggestions

If I had to rank these for the next major build after V99:

1. **Match Highlights Packages** (#1) — highest impact for lowest effort, makes every match feel like a story
2. **Player Career Stories** (#5) — creates emotional attachment to players
3. **Reputation/Fame Levels** (#4) — drives realistic AI behavior across transfers + contracts
4. **Weather Conditions** (#9) — low effort, high variety
5. **Player Partnerships** (#6) — makes team-building meaningful
6. **Match Events with Player Images** (#2) — visual upgrade for the match feed
7. **Youth Intake Day** (#12) — low effort, classic FM feature
8. **Transfer Deadline Day Drama** (#10) — adds excitement to the window
9. **Manager Touchline Reactions** (#8) — adds agency during matches
10. **Social Media Feed** (#14) — makes the world feel alive

The visual ones (#3 TV intro, #7 2D match view) are higher effort but high impact — worth considering for a "V100 visual overhaul" if we ever do one.

---

*This file is a living document — add ideas as they come up during testing.*
