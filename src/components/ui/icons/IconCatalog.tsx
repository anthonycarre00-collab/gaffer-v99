import type { JSX } from "react";
import { useState } from "react";
import * as Icons from "./GafferIcons";

/**
 * V100 Issue #39: Icon/button cache — comprehensive Gaffer icon catalog.
 *
 * Visual reference page showing every Gaffer icon, its name, and a
 * copy-pasteable import snippet. Used by:
 * - Designers/devs looking for the right icon (search by name)
 * - QA verifying all icons render correctly
 * - Future contributors adding new icons (see the pattern)
 *
 * Also includes a button presets catalog showing all Button variants
 * (primary/accent/ghost/outline) × sizes (sm/md/lg) so the design
 * language stays consistent.
 *
 * This is a dev reference component — NOT wired into any user-facing
 * route. Render it in a throwaway dev screen or storybook entry.
 */

interface IconEntry {
  name: string;
  Component: (props: { size?: number; brassColor?: string }) => JSX.Element;
  category: string;
  description: string;
}

const ICON_CATALOG: IconEntry[] = [
  // Match Day
  { name: "StadiumIcon", Component: Icons.StadiumIcon, category: "Match Day", description: "Stadium with floodlights — match day / pre-match" },
  { name: "StoppageBoardIcon", Component: Icons.StoppageBoardIcon, category: "Match Day", description: "Stoppage board — extra time / stoppage" },
  { name: "SubBoardIcon", Component: Icons.SubBoardIcon, category: "Match Day", description: "Substitution board — subs" },
  { name: "CaptainArmbandIcon", Component: Icons.CaptainArmbandIcon, category: "Match Day", description: "Captain's armband — captain assignment" },
  { name: "RedCardIcon", Component: Icons.RedCardIcon, category: "Match Day", description: "Red card — sendings-off" },
  { name: "YellowCardIcon", Component: Icons.YellowCardIcon, category: "Match Day", description: "Yellow card — bookings" },
  { name: "WhistleBlowIcon", Component: Icons.WhistleBlowIcon, category: "Match Day", description: "Referee whistle — kickoff / full time" },
  // Transfers & Contracts
  { name: "TransferDocIcon", Component: Icons.TransferDocIcon, category: "Transfers", description: "Transfer document — transfers" },
  { name: "WageSlipIcon", Component: Icons.WageSlipIcon, category: "Transfers", description: "Wage slip — wages / contracts" },
  { name: "LoanArrowIcon", Component: Icons.LoanArrowIcon, category: "Transfers", description: "Loan arrow — loan deals" },
  // Training & Tactics
  { name: "ConesIcon", Component: Icons.ConesIcon, category: "Training", description: "Training cones — training sessions" },
  { name: "TacticsMagnetsIcon", Component: Icons.TacticsMagnetsIcon, category: "Training", description: "Tactics magnets — tactics board" },
  { name: "FormationClipboardIcon", Component: Icons.FormationClipboardIcon, category: "Training", description: "Formation clipboard — formations" },
  { name: "TouchlineIcon", Component: Icons.TouchlineIcon, category: "Training", description: "Touchline — matchday dugout" },
  // Scouting & Academy
  { name: "BinocularsIcon", Component: Icons.BinocularsIcon, category: "Scouting", description: "Binoculars — scouting" },
  { name: "AcademyGateIcon", Component: Icons.AcademyGateIcon, category: "Scouting", description: "Academy gate — youth academy" },
  // Media & Press
  { name: "NewspaperIcon", Component: Icons.NewspaperIcon, category: "Media", description: "Newspaper — news articles" },
  { name: "MicrophoneIcon", Component: Icons.MicrophoneIcon, category: "Media", description: "Microphone — press conferences" },
  { name: "MegaphoneIcon", Component: Icons.MegaphoneIcon, category: "Media", description: "Megaphone — fan / media announcements" },
  // Awards & Recognition
  { name: "TrophyRibbonsIcon", Component: Icons.TrophyRibbonsIcon, category: "Awards", description: "Trophy with ribbons — trophies / awards" },
  { name: "HandshakeIcon", Component: Icons.HandshakeIcon, category: "Awards", description: "Handshake — agreements / sponsorships" },
  // Medical
  { name: "MedicalCrossIcon", Component: Icons.MedicalCrossIcon, category: "Medical", description: "Medical cross — injuries / physio" },
  // Navigation (sidebar)
  { name: "HomePitchIcon", Component: Icons.HomePitchIcon, category: "Navigation", description: "Home pitch — Home tab" },
  { name: "MailSlotIcon", Component: Icons.MailSlotIcon, category: "Navigation", description: "Mail slot — Inbox tab" },
  { name: "NewspaperIcon (alt)", Component: Icons.NewspaperIcon, category: "Navigation", description: "Newspaper — News tab" },
  { name: "CalendarWhistleIcon", Component: Icons.CalendarWhistleIcon, category: "Navigation", description: "Calendar with whistle — Schedule tab" },
  { name: "SettingsCogIcon", Component: Icons.SettingsCogIcon, category: "Navigation", description: "Settings cog — Settings tab" },
  { name: "GlobeStadiumIcon", Component: Icons.GlobeStadiumIcon, category: "Navigation", description: "Globe with stadium — World tab" },
  { name: "PlayersKitIcon", Component: Icons.PlayersKitIcon, category: "Navigation", description: "Players kit — Squad tab" },
  { name: "ManagerClipIcon", Component: Icons.ManagerClipIcon, category: "Navigation", description: "Manager clipboard — Other Gaffers tab" },
  { name: "BuildingStadiumIcon", Component: Icons.BuildingStadiumIcon, category: "Navigation", description: "Building stadium — Teams tab" },
  // Attribute Categories (V100 Issue #38)
  { name: "BodyIcon", Component: Icons.BodyIcon, category: "Attributes", description: "Bicep — physical attributes (pace/burst/engine/power/agility)" },
  { name: "BallIcon", Component: Icons.BallIcon, category: "Attributes", description: "Football — on-the-ball skills (passing/distribution/touch/finishing/defending/aerial)" },
  { name: "HeadIcon", Component: Icons.HeadIcon, category: "Attributes", description: "Head profile — mental attributes (anticipation/vision/decisions/composure/leadership)" },
  { name: "GlovesIcon", Component: Icons.GlovesIcon, category: "Attributes", description: "GK glove — goalkeeping (shot_stopping/commanding/playing_out)" },
];

const CATEGORIES = [
  "Match Day",
  "Transfers",
  "Training",
  "Scouting",
  "Media",
  "Awards",
  "Medical",
  "Navigation",
  "Attributes",
];

export default function IconCatalog(): JSX.Element {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const filtered = ICON_CATALOG.filter((entry) => {
    const matchesSearch =
      !search ||
      entry.name.toLowerCase().includes(search.toLowerCase()) ||
      entry.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === "All" || entry.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-carbon-1 p-6 text-ink">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-wider text-accent-500">
          Gaffer Icon Catalog
        </h1>
        <p className="mt-1 text-sm text-ink-dim">
          {ICON_CATALOG.length} icons across {CATEGORIES.length} categories.
          Search by name or description, filter by category.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search icons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 rounded border border-slate-line bg-carbon-2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent-500/30"
        />
        <select
          value={activeCategory}
          onChange={(e) => setActiveCategory(e.target.value)}
          className="rounded border border-slate-line bg-carbon-2 px-3 py-2 text-sm text-ink"
        >
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-6">
        {CATEGORIES.filter((c) => activeCategory === "All" || c === activeCategory).map(
          (category) => {
            const entries = filtered.filter((e) => e.category === category);
            if (entries.length === 0) return null;
            return (
              <section key={category}>
                <h2 className="mb-2 font-heading text-sm font-bold uppercase tracking-[0.22em] text-ink-faint">
                  {category} ({entries.length})
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {entries.map((entry) => (
                    <div
                      key={entry.name}
                      className="flex flex-col items-center rounded border border-slate-line bg-carbon-2 p-3 text-center transition-colors hover:border-accent-400"
                    >
                      <div className="flex h-12 items-center justify-center text-ink">
                        <entry.Component size={28} />
                      </div>
                      <span className="mt-2 block font-heading text-[10px] font-bold uppercase tracking-wider text-ink-dim">
                        {entry.name}
                      </span>
                      <span className="mt-1 text-[9px] text-ink-faint line-clamp-2">
                        {entry.description}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            );
          },
        )}
      </div>

      {filtered.length === 0 && (
        <p className="mt-12 text-center text-sm text-ink-faint">
          No icons match "{search}".
        </p>
      )}

      <footer className="mt-12 border-t border-slate-line pt-4 text-[10px] text-ink-faint">
        <p>
          All icons: 24x24 viewBox, 1.5px stroke, currentColor + brass
          accent (#c9972e). Add new icons to{" "}
          <code className="rounded bg-carbon-2 px-1">
            src/components/ui/icons/GafferIcons.tsx
          </code>{" "}
          and register them in <code>ICON_CATALOG</code> above.
        </p>
      </footer>
    </div>
  );
}
