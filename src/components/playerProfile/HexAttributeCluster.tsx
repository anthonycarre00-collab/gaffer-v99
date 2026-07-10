import { useState } from "react";
import { useTranslation } from "react-i18next";
import { shortOvrLabel, interpretOvr } from "../../lib/ovrInterpretation";

/**
 * HexAttributeCluster — signature attribute visualization for Player Detail.
 *
 * Shows 4 hexagons (Body / Ball / Head / Gloves), each displaying the group
 * average. Click a hex to expand and see individual attributes as bars.
 *
 * This replaces the unreadable 19-axis radar with a clean, scannable hierarchy.
 * All numbers use IBM Plex Mono with tabular-nums.
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

export function HexAttributeCluster({ attributes }: HexAttributeClusterProps) {
 const { t } = useTranslation();
 const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

 const groups: AttributeGroup[] = [
 {
 label: t("playerProfile.attrGroups.body") || "The Body",
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
 label: t("playerProfile.attrGroups.ball") || "The Ball",
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
 label: t("playerProfile.attrGroups.head") || "The Head",
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
 label: t("playerProfile.attrGroups.gloves") || "The Gloves",
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
 {/* Hex cluster — 4 hexagons in a row */}
 <div className="grid grid-cols-4 gap-3">
 {groups.map((group) => {
 const color = GROUP_COLORS[group.label] || "#2d5a3d";
 const isExpanded = expandedGroup === group.label;
 return (
 <button
 key={group.label}
 onClick={() => setExpandedGroup(isExpanded ? null : group.label)}
 className="flex flex-col items-center p-3 rounded transition-colors hover:bg-gray-100 dark:hover:bg-navy-700"
 style={{ borderBottom: `3px solid ${color}` }}
 >
 {/* Hexagon SVG */}
 <svg width="60" height="56" viewBox="0 0 60 56" fill="none">
 <polygon
 points="30,4 54,18 54,38 30,52 6,38 6,18"
 fill={color}
 fillOpacity={0.15}
 stroke={color}
 strokeWidth="2"
 />
 <text
 x="30" y="34"
 textAnchor="middle"
 fill={color}
 fontFamily="IBM Plex Mono, monospace"
 fontSize="18"
 fontWeight="600"
 >
 {group.avg}
 </text>
 </svg>
 <span className="mt-1 text-xs font-heading font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
 {group.label}
 </span>
 </button>
 );
 })}
 </div>

 {/* Expanded attribute bars */}
 {expandedGroup && (
 <div className="tab-enter rounded border border-gray-200 dark:border-navy-600 p-4 bg-white dark:bg-navy-700">
 <div className="flex items-center justify-between mb-3">
 <h4 className="font-heading font-bold uppercase tracking-wide text-sm" style={{ color: GROUP_COLORS[expandedGroup] }}>
 {expandedGroup}
 </h4>
 <span className="text-xs text-gray-500 dark:text-gray-400">
 Avg <span className="font-mono font-bold">{groups.find(g => g.label === expandedGroup)?.avg}</span>
 </span>
 </div>
 {groups.find(g => g.label === expandedGroup)?.attrs.map(([name, val]) => (
 <div key={name} className="flex items-center gap-3 mb-2">
 <span className="w-28 text-xs text-gray-600 dark:text-gray-400">{name}</span>
 <div className="flex-1 h-2 bg-gray-200 dark:bg-navy-600 rounded-sm overflow-hidden">
 <div
 className="h-full transition-all duration-300"
 style={{ width: `${(val / 99) * 100}%`, backgroundColor: getAttrColor(val) }}
 />
 </div>
 <span className="w-8 text-right font-mono text-sm font-bold" style={{ color: getAttrColor(val) }}>
 {val}
 </span>
 </div>
 ))}
 </div>
 )}

 {/* Overall — always visible, shown as Gaffer interpretation (not raw number) */}
 <div className="flex items-center justify-between border-t border-gray-200 dark:border-navy-600 pt-3">
 <span className="font-heading font-bold uppercase tracking-wide text-sm text-gray-700 dark:text-gray-300">
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
