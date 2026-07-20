# Gaffer Icon & Button Cache

V100 Issue #39: A comprehensive, searchable catalog of every Gaffer-stylised
icon and button preset, saved to the repo for future use.

## What's here

### `src/components/ui/icons/GafferIcons.tsx`
The canonical source for all 34 Gaffer icons. Each icon:
- 24x24 viewBox
- 1.5px stroke weight (consistent design language)
- Uses `currentColor` so it inherits text color
- Accepts `brassColor` prop (defaults to `#c9972e`) for two-tone accents
- Accepts `size` prop (defaults to 20) plus all standard SVG props

### `src/components/ui/icons/IconCatalog.tsx`
Visual reference page showing every icon, its name, and a description.
Search by name/description, filter by category. **Dev reference only —
not wired into any user route.**

### `src/components/ui/ButtonPresetsCatalog.tsx`
Visual reference showing every Button variant × size combination plus
icon-left, icon-right, and disabled states. **Dev reference only.**

### `public/icons/gaffer/*.svg`
34 standalone SVG files (one per icon) for use outside React:
- Favicons / app icons
- Static HTML pages (landing, error)
- OpenGraph / social preview images
- Email / PDF embeds
- Designer handoff

**Regenerate after adding new icons:**
```bash
npx tsx scripts/export_gaffer_icons.mjs
```

## Icon categories

| Category | Count | Examples |
|----------|-------|----------|
| Match Day | 7 | StadiumIcon, StoppageBoardIcon, SubBoardIcon, CaptainArmbandIcon, RedCardIcon, YellowCardIcon, WhistleBlowIcon |
| Transfers | 3 | TransferDocIcon, WageSlipIcon, LoanArrowIcon |
| Training | 4 | ConesIcon, TacticsMagnetsIcon, FormationClipboardIcon, TouchlineIcon |
| Scouting | 2 | BinocularsIcon, AcademyGateIcon |
| Media | 3 | NewspaperIcon, MicrophoneIcon, MegaphoneIcon |
| Awards | 2 | TrophyRibbonsIcon, HandshakeIcon |
| Medical | 1 | MedicalCrossIcon |
| Navigation | 9 | HomePitchIcon, MailSlotIcon, CalendarWhistleIcon, SettingsCogIcon, GlobeStadiumIcon, PlayersKitIcon, ManagerClipIcon, BuildingStadiumIcon (+ NewspaperIcon shared with Media) |
| Attributes | 4 | BodyIcon, BallIcon, HeadIcon, GlovesIcon |
| **Total** | **34** | |

## Button variants

| Variant | Use case | className |
|---------|----------|-----------|
| `primary` | Default action (confirm, save, submit) | `bg-primary-500 hover:bg-primary-600` |
| `accent` | Secondary CTA (highlight, feature) | `bg-accent-500 hover:bg-accent-600` |
| `ghost` | Tertiary action (cancel, dismiss) | `bg-transparent hover:bg-carbon-2` |
| `outline` | Neutral action (filter, toggle) | `border border-slate-line` |

### Sizes
| Size | Padding | Font | Use case |
|------|---------|------|----------|
| `sm` | px-3 py-1.5 | text-xs | Inline / table rows |
| `md` | px-5 py-2.5 | text-sm | Default / most contexts |
| `lg` | px-7 py-3.5 | text-base | Hero / modal primary |

## Adding a new icon

1. Add the icon function to `src/components/ui/icons/GafferIcons.tsx`
   (follow the existing pattern — same `base()` helper, same props).
2. Add an entry to `ICON_CATALOG` in `IconCatalog.tsx` with name, category,
   and description.
3. Run `npx tsx scripts/export_gaffer_icons.mjs` to regenerate the static
   SVG files in `public/icons/gaffer/`.
4. Add a test to `GafferIcons.attribute.test.tsx` for the new icon
   (render + viewBox check).

## Adding a new button variant

1. Add the variant to `variants` map in `src/components/ui/Button.tsx`.
2. Add the variant name to `VARIANTS` array in `ButtonPresetsCatalog.tsx`.
3. Add a description to `VARIANT_DESCRIPTIONS`.
4. Add a test case to `ButtonPresetsCatalog.test.tsx`.
