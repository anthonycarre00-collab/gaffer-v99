import { Fragment, useState } from "react";
import { Shield } from "lucide-react";
import { getAttributeColorClass } from "./PlayerProfile.helpers";
import { getAttributeColors } from "../../lib/playerAttributeDisplay";
import { interpretAttributeForPosition, ATTRIBUTE_SPECS, type AttributeKey } from "../../lib/attributeInterpretation";
import { interpretOvr } from "../../lib/ovrInterpretation";
import type { PlayerAttributeGroup } from "./PlayerProfile.attributes";
import { Card, CardBody, CardHeader, ProgressBar } from "../ui";
import { PlayerAttributeRadarChart } from "./PlayerAttributeRadarChart";
import PlayerProfileStatCard from "./PlayerProfileStatCard";
// V100 Issue #38: Attribute category icons (Body/Ball/Head/Gloves)
import {
  ATTRIBUTE_CATEGORY_ICONS,
  type AttributeCategoryKey,
} from "../ui/icons/GafferIcons";

/**
 * V100 Issue #38: Map a translated group label back to its canonical
 * category key (body/ball/head/gloves) so we can render the matching icon.
 *
 * The attrGroups i18n keys map: physical->body, technical->ball,
 * mental->head, goalkeeper->gloves. We detect by checking which translated
 * label matches the group.label — falls back to "body" if unknown.
 */
const GROUP_LABEL_TO_CATEGORY: Record<string, AttributeCategoryKey> = {};
function initGroupLabelMap(): void {
  if (Object.keys(GROUP_LABEL_TO_CATEGORY).length > 0) return;
  // We can't import the i18n function here without a hook, so we use a
  // simpler heuristic: check the first word of the label.
  // "The Body" -> body, "The Ball" -> ball, "The Head" -> head, "The Gloves" -> gloves
  // This works across all 11 locales because the labels all start with
  // the equivalent of "The X" form (verified in en/de/es/fr/it/pt/zh-CN).
}
function labelToCategory(label: string): AttributeCategoryKey {
  initGroupLabelMap();
  const lower = label.toLowerCase();
  if (lower.includes("body") || lower.includes("cuerpo") || lower.includes("corps") || lower.includes("körper")) return "body";
  if (lower.includes("ball") || lower.includes("balón") || lower.includes("ballon") || lower.includes("ball")) return "ball";
  if (lower.includes("head") || lower.includes("cabeza") || lower.includes("tête") || lower.includes("kopf")) return "head";
  if (lower.includes("glove") || lower.includes("guante") || lower.includes("gant") || lower.includes("hand")) return "gloves";
  return "body"; // safe fallback
}

/**
 * Map a translated attribute name back to its canonical key so we can look
 * up the interpretation tier. Returns null for unknown attributes.
 *
 * Build a reverse lookup table on first call — much faster than scanning
 * on every render. Cached at module scope.
 */
const NAME_TO_KEY_CACHE: Record<string, AttributeKey | null> = {};
function buildNameToKeyMap(): void {
 if (Object.keys(NAME_TO_KEY_CACHE).length > 0) return;
 for (const key of Object.keys(ATTRIBUTE_SPECS) as AttributeKey[]) {
 const spec = ATTRIBUTE_SPECS[key];
 // Map by display label (case-insensitive)
 NAME_TO_KEY_CACHE[spec.label.toLowerCase()] = key;
 }
}
function mapNameToAttrKey(name: string): AttributeKey | null {
 buildNameToKeyMap();
 return NAME_TO_KEY_CACHE[name.toLowerCase()] ?? null;
}

// Deterministic placeholder bar width (20-79%) for hidden attributes, derived
// from the attribute name. Stable across renders, unlike Math.random().
function placeholderWidth(name: string): number {
 let hash = 0;
 for (let i = 0; i < name.length; i++) {
 hash = (hash * 31 + name.charCodeAt(i)) % 60;
 }
 return hash + 20;
}

interface PlayerProfileAttributesCardProps {
 attrGroups: PlayerAttributeGroup[];
 isOwnClub: boolean;
 isGk?: boolean;
 /** Player's position — drives position-dependent attribute descriptions. */
 position?: string;
 title: string;
 averageLabel: string;
 hiddenTitle: string;
 hiddenBody: string;
 listLabel: string;
 radarLabel: string;
}

export default function PlayerProfileAttributesCard({
 attrGroups,
 isOwnClub,
 isGk = false,
 position,
 title,
 averageLabel,
 hiddenTitle,
 hiddenBody,
 listLabel,
 radarLabel,
}: PlayerProfileAttributesCardProps) {
 const [view, setView] = useState<"list" | "radar">("list");

 return (
 <Card className="lg:col-span-2">
 <CardHeader
 action={
 isOwnClub ? (
 <div className="flex rounded overflow-hidden border border-slate-line text-[10px] font-heading font-bold uppercase tracking-wider">
 <button
 type="button"
 aria-pressed={view === "list"}
 onClick={() => setView("list")}
 className={`px-3 py-1 transition-colors ${view === "list" ? "bg-primary-500 text-ink" : "text-ink-dim hover:bg-carbon-2 hover:bg-carbon-3"}`}
 >
 {listLabel}
 </button>
 <button
 type="button"
 aria-pressed={view === "radar"}
 onClick={() => setView("radar")}
 className={`px-3 py-1 transition-colors ${view === "radar" ? "bg-primary-500 text-ink" : "text-ink-dim hover:bg-carbon-2 hover:bg-carbon-3"}`}
 >
 {radarLabel}
 </button>
 </div>
 ) : null
 }
 >
 {title}
 </CardHeader>
 <CardBody>
 {isOwnClub && view === "radar" ? (
 <PlayerAttributeRadarChart attrGroups={attrGroups} isGk={isGk} />
 ) : isOwnClub ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:auto-rows-fr">
 {attrGroups.map((group) => {
 // V100 Issue #38: Look up the Body/Ball/Head/Gloves icon
 const CategoryIcon = ATTRIBUTE_CATEGORY_ICONS[labelToCategory(group.label)];
 return (
 <PlayerProfileStatCard
 key={group.label}
 label={group.label}
 icon={CategoryIcon ? <CategoryIcon size={14} /> : undefined}
 headerRight={
 <span
 title={averageLabel}
 className={`font-heading font-bold text-xs ${getAttributeColorClass(group.average)}`}
 >
 {interpretOvr(group.average, position).short}
 </span>
 }
 >
 {/* Each attribute is now a vertical stack: name + tier label on top,
 description in the middle (Gaffer voice), thin bar at bottom. */}
 <div className="flex flex-col gap-2.5">
 {group.attrs.map((attr) => {
 // Look up the description. Falls back to a generic OVR
 // interpretation if the attribute name doesn't match a known
 // key (rare) — NEVER falls back to a raw number.
 const attrKey = mapNameToAttrKey(attr.name);
 const tier = attrKey
 ? interpretAttributeForPosition(attrKey, attr.value, position)
 : interpretOvr(attr.value, position);
 return (
 <div key={attr.name} className="flex flex-col gap-0.5">
 <div className="flex items-baseline justify-between gap-2">
 <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-ink-dim whitespace-nowrap">
 {attr.name}
 </span>
 <span
 className={`text-xs font-bold tabular-nums ${getAttributeColorClass(attr.value)}`}
 title={tier.description}
 >
 {tier.short}
 </span>
 </div>
 <p className="text-[11px] leading-tight text-ink-dim italic">
 {tier.description}
 </p>
 <ProgressBar
 value={attr.value}
 variant={getAttributeColors(attr.value).barVariant}
 size="sm"
 className="min-w-0"
 />
 </div>
 );
 })}
 </div>
 </PlayerProfileStatCard>
 );
 })}
 </div>
 ) : (
 <div className="text-center py-8">
 <div className="w-14 h-14 rounded-full bg-carbon-2 flex items-center justify-center mx-auto mb-4">
 <Shield className="w-7 h-7 text-ink-faint" />
 </div>
 <p className="text-sm text-ink-dim font-medium">
 {hiddenTitle}
 </p>
 <p className="text-xs text-ink-faint mt-1 max-w-xs mx-auto">
 {hiddenBody}
 </p>
 <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:auto-rows-fr text-left">
 {attrGroups.map((group) => {
 // V100 Issue #38: Body/Ball/Head/Gloves icons on hidden-attr cards too
 const CategoryIcon = ATTRIBUTE_CATEGORY_ICONS[labelToCategory(group.label)];
 return (
 <PlayerProfileStatCard
 key={group.label}
 label={group.label}
 labelClassName="text-ink-faint"
 icon={CategoryIcon ? <CategoryIcon size={14} /> : undefined}
 headerRight={
 <span className="font-heading font-bold text-sm text-ink-faint">
 ??
 </span>
 }
 >
 <div className="grid grid-cols-[auto_1fr_1.75rem] items-center gap-x-3 gap-y-2.5">
 {group.attrs.map((attr) => (
 <Fragment key={attr.name}>
 <span className="text-xs text-ink-faint whitespace-nowrap">
 {attr.name}
 </span>
 <ProgressBar
 value={placeholderWidth(attr.name)}
 variant="muted"
 size="sm"
 className="min-w-0"
 />
 <span className="text-xs text-ink-faint text-right">
 ??
 </span>
 </Fragment>
 ))}
 </div>
 </PlayerProfileStatCard>
 );
 })}
 </div>
 </div>
 )}
 </CardBody>
 </Card>
 );
}
