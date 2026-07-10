import { useState } from "react";
import { useSquadMeaning } from "../../store/meaningStore";
import { Card, CardHeader, CardBody, Badge } from "../ui";
import { useTranslation } from "react-i18next";

/**
 * SquadPulseCard — signature Home-tab visual showing the squad's harmony state.
 *
 * Displays the SquadPulse score (0-100 composite of 7 factors), pressure level,
 * dressing room tension flag, emerging story threads, and fatigue risk band.
 * Click to expand the 7-factor harmony explanation chain.
 *
 * This is the "this is Gaffer, not Football Manager" visual differentiator.
 */
export function SquadPulseCard() {
 const { snapshot, loading } = useSquadMeaning();
 const { t } = useTranslation();
 const [showBreakdown, setShowBreakdown] = useState(false);

 if (loading || !snapshot) {
 return (
 <Card accent="primary">
 <CardHeader>{t("meaning.squadPulse.title")}</CardHeader>
 <CardBody>
 <div className="text-sm text-gray-500 dark:text-gray-400">
 {t("meaning.loading")}
 </div>
 </CardBody>
 </Card>
 );
 }

 const harmonyScore = snapshot.squad_harmony_score;
 const pressureLevel = snapshot.pressure_level;
 const tensionFlag = snapshot.dressing_room_tension_flag;
 const fatigueBand = snapshot.fatigue_risk_band;
 const storyThreads = snapshot.emerging_story_threads;
 const tacticalCoherence = snapshot.tactical_coherence_score;
 const mediaHeat = snapshot.media_heat;

 // Color the harmony bar by score: red < 40, amber 40-65, green > 65
 const harmonyColor =
 harmonyScore < 40
 ? "#7a2e1f" // Mahogany
 : harmonyScore < 65
 ? "#b8924a" // Brass
 : "#2d5a3d"; // Pitch Green

 // Pressure level accent
 const pressureAccent =
 pressureLevel === "Crushing"
 ? "danger"
 : pressureLevel === "High"
 ? "danger"
 : pressureLevel === "Moderate"
 ? "accent"
 : "success";

 return (
 <Card accent={pressureAccent as "primary" | "accent" | "success" | "danger"}>
 <CardHeader
 action={
 <div className="flex items-center gap-2">
 {tensionFlag && (
 <Badge variant="danger">{t("meaning.squadPulse.tensionFlag")}</Badge>
 )}
 <span className="text-sm font-bold font-heading text-gray-900 dark:text-white">
 {harmonyScore >= 75 ? "Buzzing" : harmonyScore >= 55 ? "Steady" : harmonyScore >= 35 ? "Restless" : "Toxic"}
 </span>
 </div>
 }
 >
 {t("meaning.squadPulse.title")}
 </CardHeader>
 <CardBody>
 {/* Harmony score bar */}
 <div className="mb-4">
 <div className="flex justify-between items-baseline mb-1">
 <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
 {t("meaning.squadPulse.harmonyScore")}
 </span>
 <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
 {t(`meaning.squadPulse.pressureLevel`)}: {pressureLevel}
 </span>
 </div>
 <div className="w-full h-4 bg-gray-200 dark:bg-navy-600 rounded-sm overflow-hidden">
 <div
 className="h-full pulse-bar transition-all duration-500"
 style={{ width: `${harmonyScore}%`, backgroundColor: harmonyColor }}
 />
 </div>
 </div>

 {/* Secondary metrics grid */}
 <div className="grid grid-cols-2 gap-3 text-sm mb-4">
 <div>
 <div className="text-xs uppercase text-gray-500 dark:text-gray-400">
 {t("meaning.squadPulse.tacticalCoherence")}
 </div>
 <div className="font-heading font-semibold text-gray-900 dark:text-white">
 {tacticalCoherence >= 70 ? "In Sync" : tacticalCoherence >= 40 ? "Gelling" : "All Over the Shop"}
 </div>
 </div>
 <div>
 <div className="text-xs uppercase text-gray-500 dark:text-gray-400">
 {t("meaning.squadPulse.mediaHeat")}
 </div>
 <div className="font-heading font-semibold text-gray-900 dark:text-white">
 {mediaHeat >= 70 ? "Front Page News" : mediaHeat >= 30 ? "Under the Radar" : "Quiet"}
 </div>
 </div>
 <div>
 <div className="text-xs uppercase text-gray-500 dark:text-gray-400">
 {t("meaning.squadPulse.fatigueRisk")}
 </div>
 <div className="font-semibold text-gray-900 dark:text-white">
 {fatigueBand}
 </div>
 </div>
 <div>
 <div className="text-xs uppercase text-gray-500 dark:text-gray-400">
 {t("meaning.squadPulse.identityAlignment")}
 </div>
 <div className="font-semibold text-gray-900 dark:text-white">
 {snapshot.identity_alignment_label}
 </div>
 </div>
 </div>

 {/* Story threads */}
 {storyThreads.length > 0 && (
 <div className="mb-3">
 <div className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
 {t("meaning.squadPulse.storyThreads")}
 </div>
 <div className="flex flex-wrap gap-2">
 {storyThreads.slice(0, 3).map((thread, i) => (
 <Badge key={i} variant="accent">
 {thread}
 </Badge>
 ))}
 </div>
 </div>
 )}

 {/* Expandable breakdown */}
 <div className="border-t border-gray-200 dark:border-navy-600 pt-3">
 <button
 onClick={() => setShowBreakdown(!showBreakdown)}
 className="text-xs text-primary-600 hover:underline dark:text-primary-400"
 >
 {showBreakdown
 ? t("meaning.hideBreakdown")
 : t("meaning.showBreakdown")}
 </button>
 {showBreakdown && (
 <div className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
 {snapshot.harmony_explanation.entries.map((entry, i) => (
 <div key={i} className="flex gap-2">
 <span className="text-gray-400">•</span>
 <span>{entry.reason}</span>
 </div>
 ))}
 </div>
 )}
 </div>
 </CardBody>
 </Card>
 );
}
