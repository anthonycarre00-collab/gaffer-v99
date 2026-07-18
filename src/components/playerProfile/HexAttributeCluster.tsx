import { useState } from "react";
import { useTranslation } from "react-i18next";
import { shortOvrLabel, interpretOvr } from "../../lib/ovrInterpretation";
import { interpretAttributeForPosition, ATTRIBUTE_SPECS, type AttributeKey } from "../../lib/attributeInterpretation";

/**
 * HexAttributeCluster — signature attribute visualization for Player Detail.
 *
 * Shows 4 hexagons (Body / Ball / Head / Gloves), each displaying the group
 * average as a Gaffer-voice label (NOT a raw number). Click a hex to expand
 * and see individual attributes as bars with their tier short labels.
 *
 * Per the Gaffer constitution: raw attribute numbers are NEVER displayed.
 * Every value is interpreted into a short tier label ("ELT", "EXC", "STL",
 * etc.) backed by a full Gaffer-voice description on hover.
 */

interface AttributeGroup {
 label: string;
 avg: number;
 attrs: [string, number][];
}

interface HexAttributeClusterProps {
 attributes: {
 pace: number; burst: number; engine: number; power: number; agility: number;
 passing: number; distribution: number; touch: number; finishing: number;
 defending: number; aerial: number;
 anticipation: number; vision: number; decisions: number;
 composure: number; leadership: number;
 shot_stopping: number; commanding: number; playing_out: number;
 body_avg: number; ball_avg: number; head_avg: number; gloves_avg: number; overall: number;
 };
 /** Player's position — drives position-dependent attribute descriptions. */
 position?: string;
}

const GROUP_COLORS: Record<string, string> = {
 "The Body": "#2d5a3d", // Pitch Green
 "The Ball": "#b8924a", // Brass
 "The Head": "#3b5998", // Blue
 "The Gloves": "#7a2e1f", // Mahogany
};

function getAttrColor(val: number): string {
 if (val >= 80) return "#2d5a3d"; // Pitch Green — elite
 if (val >= 65) return "#4a7b5e"; // Light green — good
 if (val >= 50) return "#b8924a"; // Brass — average
 if (val >= 35) return "#c06f5e"; // Light mahogany — weak
 return "#7a2e1f"; // Mahogany — poor
}

/**
 * Map a translated attribute display name back to its canonical key so we can
 * look up the interpretation tier. Reverse lookup table cached at module scope.
 */
const NAME_TO_KEY_CACHE: Record<string, AttributeKey | null> = {};
function buildNameToKeyMap(): void {
 if (Object.keys(NAME_TO_KEY_CACHE).length > 0) return;
 for (const key of Object.keys(ATTRIBUTE_SPECS) as AttributeKey[]) {
 const spec = ATTRIBUTE_SPECS[key];
 NAME_TO_KEY_CACHE[spec.label.toLowerCase()] = key;
 }
}

/** Lookup the canonical attr key for a hex bar's display name. */
const HEX_ATTR_KEY_MAP: Record<string, AttributeKey> = {
 "Pace": "pace",
 "Burst": "burst",
 "Engine": "engine",
 "Power": "power",
 "Agility": "agility",
 "Passing": "passing",
 "Distribution": "distribution",
 "Touch": "touch",
 "Finishing": "finishing",
 "Defending": "defending",
 "Aerial": "aerial",
 "Anticipation": "anticipation",
 "Vision": "vision",
 "Decisions": "decisions",
 "Composure": "composure",
 "Leadership": "leadership",
 "Shot Stopping": "shot_stopping",
 "Commanding": "commanding",
 "Playing Out": "playing_out",
};

function shortAttrLabel(name: string, val: number, position?: string): string {
 buildNameToKeyMap();
 const key = HEX_ATTR_KEY_MAP[name] ?? NAME_TO_KEY_CACHE[name.toLowerCase()];
 if (!key) return shortOvrLabel(val, position);
 return interpretAttributeForPosition(key, val, position).short;
}

function attrDescription(name: string, val: number, position?: string): string {
 buildNameToKeyMap();
 const key = HEX_ATTR_KEY_MAP[name] ?? NAME_TO_KEY_CACHE[name.toLowerCase()];
 if (!key) return interpretOvr(val, position).description;
 return interpretAttributeForPosition(key, val, position).description;
}

export function HexAttributeCluster({ attributes, position }: HexAttributeClusterProps) {
 const { t } = useTranslation();
 const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

 const groups: AttributeGroup[] = [
 {
 label: t("common.attrGroups.body"),
 avg: attributes.body_avg,
 attrs: [
 ["Pace", attributes.pace],
 ["Burst", attributes.burst],
 ["Engine", attributes.engine],
 ["Power", attributes.power],
 ["Agility", attributes.agility],
 ],
 },
 {
 label: t("common.attrGroups.ball"),
 avg: attributes.ball_avg,
 attrs: [
 ["Passing", attributes.passing],
 ["Distribution", attributes.distribution],
 ["Touch", attributes.touch],
 ["Finishing", attributes.finishing],
 ["Defending", attributes.defending],
 ["Aerial", attributes.aerial],
 ],
 },
 {
 label: t("common.attrGroups.head"),
 avg: attributes.head_avg,
 attrs: [
 ["Anticipation", attributes.anticipation],
 ["Vision", attributes.vision],
 ["Decisions", attributes.decisions],
 ["Composure", attributes.composure],
 ["Leadership", attributes.leadership],
 ],
 },
 {
 label: t("common.attrGroups.gloves"),
 avg: attributes.gloves_avg,
 attrs: [
 ["Shot Stopping", attributes.shot_stopping],
 ["Commanding", attributes.commanding],
 ["Playing Out", attributes.playing_out],
 ],
 },
 ];

 return (
 <div className="space-y-4">
 {/* Hex cluster — 4 hexagons in a row.
 Each hex shows the Gaffer-voice tier label for the group average,
 NOT the raw number. The number is hidden behind a tooltip. */}
 <div className="grid grid-cols-4 gap-3">
 {groups.map((group) => {
 const color = GROUP_COLORS[group.label] || "#2d5a3d";
 const isExpanded = expandedGroup === group.label;
 const tierLabel = shortOvrLabel(group.avg, position);
 const tierDesc = interpretOvr(group.avg, position).description;
 return (
 <button
 key={group.label}
 onClick={() => setExpandedGroup(isExpanded ? null : group.label)}
 className="flex flex-col items-center p-3 rounded transition-colors hover:bg-carbon-2 hover:bg-carbon-3"
 style={{ borderBottom: `3px solid ${color}` }}
 title={tierDesc}
 >
 {/* Hexagon SVG */}
 <svg width="64" height="60" viewBox="0 0 64 60" fill="none">
 <polygon
 points="32,4 58,18 58,42 32,56 6,42 6,18"
 fill={color}
 fillOpacity={0.15}
 stroke={color}
 strokeWidth="2"
 />
 <text
 x="32" y="36"
 textAnchor="middle"
 fill={color}
 fontFamily="IBM Plex Sans, system-ui, sans-serif"
 fontSize="13"
 fontWeight="700"
 letterSpacing="0.5"
 >
 {tierLabel}
 </text>
 </svg>
 <span className="mt-1 text-xs font-heading font-semibold uppercase tracking-wide text-ink-dim">
 {group.label}
 </span>
 </button>
 );
 })}
 </div>

 {/* Expanded attribute bars — uses short tier label (e.g. "EXC", "STL")
 instead of the raw number. Bar colour still reflects the underlying value. */}
 {expandedGroup && (
 <div className="tab-enter rounded border border-slate-line p-4 bg-carbon-2">
 <div className="flex items-center justify-between mb-3">
 <h4
 className="font-heading font-bold uppercase tracking-wide text-sm"
 style={{ color: GROUP_COLORS[expandedGroup] }}
 >
 {expandedGroup}
 </h4>
 <span
 className="text-xs text-ink-dim"
 title={interpretOvr(groups.find(g => g.label === expandedGroup)?.avg ?? 50, position).description}
 >
 Group <span className="font-heading font-bold">{shortOvrLabel(groups.find(g => g.label === expandedGroup)?.avg ?? 50, position)}</span>
 </span>
 </div>
 {groups.find(g => g.label === expandedGroup)?.attrs.map(([name, val]) => {
 const tierLabel = shortAttrLabel(name, val, position);
 const tierDesc = attrDescription(name, val, position);
 return (
 <div key={name} className="flex items-center gap-3 mb-2">
 <span className="w-28 text-xs text-ink-dim">{name}</span>
 <div className="flex-1 h-2 bg-carbon-3 rounded-sm overflow-hidden">
 <div
 className="h-full transition-all duration-300"
 style={{ width: `${(val / 99) * 100}%`, backgroundColor: getAttrColor(val) }}
 />
 </div>
 <span
 className="w-12 text-right font-heading text-sm font-bold tracking-wide"
 style={{ color: getAttrColor(val) }}
 title={tierDesc}
 >
 {tierLabel}
 </span>
 </div>
 );
 })}
 </div>
 )}

 {/* Overall — always visible, shown as Gaffer interpretation (not raw number) */}
 <div className="flex items-center justify-between border-t border-slate-line pt-3">
 <span className="font-heading font-bold uppercase tracking-wide text-sm text-ink-dim">
 {t("common.overall") || "Overall"}
 </span>
 <span
 className="font-heading text-lg font-bold"
 style={{ color: getAttrColor(attributes.overall) }}
 title={interpretOvr(attributes.overall).description}
 >
 {shortOvrLabel(attributes.overall)}
 </span>
 </div>
 </div>
 );
}
