import { useMediaMeaning } from "../../store/meaningStore";
import { Card, CardHeader, CardBody, Badge } from "../ui";
import { useTranslation } from "react-i18next";

/**
 * MediaPulseCard — shows the current media narrative around the user's club.
 *
 * Displays: active story count, top headline, pundit disagreement flag,
 * betting sentiment trend. Pairs with SquadPulseCard on the Home dashboard
 * to give the "pulse of your club" (squad + media).
 */
export function MediaPulseCard() {
 const { snapshot } = useMediaMeaning();
 const { t } = useTranslation();

 if (!snapshot) {
 return (
 <Card accent="accent">
 <CardHeader>{t("meaning.media.title")}</CardHeader>
 <CardBody>
 <div className="text-sm text-ink-dim">
 {t("meaning.loading")}
 </div>
 </CardBody>
 </Card>
 );
 }

 const storyCount = snapshot.active_story_count;
 const headline = snapshot.top_headline;
 const disagreement = snapshot.pundit_disagreement_active;
 const bettingTrend = snapshot.betting_sentiment_trend;

 return (
 <Card accent="accent">
 <CardHeader
 action={
 <Badge variant={storyCount > 3 ? "danger" : storyCount > 0 ? "accent" : "neutral"}>
 {storyCount} {t("meaning.media.activeStories")}
 </Badge>
 }
 >
 {t("meaning.media.title")}
 </CardHeader>
 <CardBody>
 {/* Top headline */}
 {headline ? (
 <div className="mb-3">
 <div className="text-xs uppercase tracking-wide text-ink-dim mb-1">
 {t("meaning.media.topHeadline")}
 </div>
 <div className="text-sm font-serif italic text-ink leading-snug">
 "{headline}"
 </div>
 </div>
 ) : (
 <div className="mb-3 text-sm text-ink-dim">
 {t("meaning.media.noActiveStories")}
 </div>
 )}

 {/* Media signals grid */}
 <div className="grid grid-cols-2 gap-3 text-sm">
 <div>
 <div className="text-xs uppercase text-ink-dim">
 {t("meaning.media.punditDisagreement")}
 </div>
 <div className="font-semibold text-ink">
 {disagreement ? (
 <span className="text-accent-600 dark:text-accent-400">
 {t("meaning.media.disagreementActive")}
 </span>
 ) : (
 <span className="text-success-600 dark:text-success-400">
 {t("meaning.media.disagreementCalm")}
 </span>
 )}
 </div>
 </div>
 <div>
 <div className="text-xs uppercase text-ink-dim">
 {t("meaning.media.bettingTrend")}
 </div>
 <div className="font-semibold text-ink">
 {bettingTrend}
 </div>
 </div>
 </div>
 </CardBody>
 </Card>
 );
}
