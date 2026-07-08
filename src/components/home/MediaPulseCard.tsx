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
          <div className="text-sm text-gray-500 dark:text-gray-400">
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
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              {t("meaning.media.topHeadline")}
            </div>
            <div className="text-sm font-serif italic text-gray-900 dark:text-white leading-snug">
              "{headline}"
            </div>
          </div>
        ) : (
          <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            {t("meaning.media.noActiveStories")}
          </div>
        )}

        {/* Media signals grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs uppercase text-gray-500 dark:text-gray-400">
              {t("meaning.media.punditDisagreement")}
            </div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {disagreement ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {t("meaning.media.disagreementActive")}
                </span>
              ) : (
                <span className="text-green-600 dark:text-green-400">
                  {t("meaning.media.disagreementCalm")}
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-gray-500 dark:text-gray-400">
              {t("meaning.media.bettingTrend")}
            </div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {bettingTrend}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
