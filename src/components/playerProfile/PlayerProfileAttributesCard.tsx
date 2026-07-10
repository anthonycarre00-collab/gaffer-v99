import { Fragment, useState } from "react";
import { Shield } from "lucide-react";
import { getAttributeColorClass } from "./PlayerProfile.helpers";
import { getAttributeColors } from "../../lib/playerAttributeDisplay";
import { interpretAttributeForPosition, ATTRIBUTE_SPECS, type AttributeKey } from "../../lib/attributeInterpretation";
import type { PlayerAttributeGroup } from "./PlayerProfile.attributes";
import { Card, CardBody, CardHeader, ProgressBar } from "../ui";
import { PlayerAttributeRadarChart } from "./PlayerAttributeRadarChart";
import PlayerProfileStatCard from "./PlayerProfileStatCard";

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
 <div className="flex rounded overflow-hidden border border-gray-200 dark:border-navy-600 text-[10px] font-heading font-bold uppercase tracking-wider">
 <button
 type="button"
 aria-pressed={view === "list"}
 onClick={() => setView("list")}
 className={`px-3 py-1 transition-colors ${view === "list" ? "bg-primary-500 text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-navy-700"}`}
 >
 {listLabel}
 </button>
 <button
 type="button"
 aria-pressed={view === "radar"}
 onClick={() => setView("radar")}
 className={`px-3 py-1 transition-colors ${view === "radar" ? "bg-primary-500 text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-navy-700"}`}
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
 {attrGroups.map((group) => (
 <PlayerProfileStatCard
 key={group.label}
 label={group.label}
 headerRight={
 <span
 title={averageLabel}
 className={`font-mono font-bold text-sm tabular-nums ${getAttributeColorClass(group.average)}`}
 >
 {group.average}
 </span>
 }
 >
 {/* Each attribute is now a vertical stack: name + tier label on top,
 description in the middle (Gaffer voice), thin bar at bottom. */}
 <div className="flex flex-col gap-2.5">
 {group.attrs.map((attr) => {
 // Look up the description. Falls back to undefined if the
 // attribute name doesn't match a known key (rare).
 const attrKey = mapNameToAttrKey(attr.name);
 const tier = attrKey
 ? interpretAttributeForPosition(attrKey, attr.value, position)
 : null;
 return (
 <div key={attr.name} className="flex flex-col gap-0.5">
 <div className="flex items-baseline justify-between gap-2">
 <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">
 {attr.name}
 </span>
 {tier ? (
 <span
 className={`text-xs font-bold tabular-nums ${getAttributeColorClass(attr.value)}`}
 >
 {tier.short}
 </span>
 ) : (
 <span
 className={`font-mono font-bold text-xs text-right tabular-nums ${getAttributeColorClass(attr.value)}`}
 >
 {attr.value}
 </span>
 )}
 </div>
 {tier ? (
 <p className="text-[11px] leading-tight text-gray-700 dark:text-gray-300 italic">
 {tier.description}
 </p>
 ) : null}
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
 ))}
 </div>
 ) : (
 <div className="text-center py-8">
 <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-navy-700 flex items-center justify-center mx-auto mb-4">
 <Shield className="w-7 h-7 text-gray-400 dark:text-gray-500" />
 </div>
 <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
 {hiddenTitle}
 </p>
 <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">
 {hiddenBody}
 </p>
 <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:auto-rows-fr text-left">
 {attrGroups.map((group) => (
 <PlayerProfileStatCard
 key={group.label}
 label={group.label}
 labelClassName="text-gray-400 dark:text-gray-500"
 headerRight={
 <span className="font-heading font-bold text-sm text-gray-400 dark:text-gray-500">
 ??
 </span>
 }
 >
 <div className="grid grid-cols-[auto_1fr_1.75rem] items-center gap-x-3 gap-y-2.5">
 {group.attrs.map((attr) => (
 <Fragment key={attr.name}>
 <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
 {attr.name}
 </span>
 <ProgressBar
 value={placeholderWidth(attr.name)}
 variant="muted"
 size="sm"
 className="min-w-0"
 />
 <span className="text-xs text-gray-400 dark:text-gray-500 text-right">
 ??
 </span>
 </Fragment>
 ))}
 </div>
 </PlayerProfileStatCard>
 ))}
 </div>
 </div>
 )}
 </CardBody>
 </Card>
 );
}
