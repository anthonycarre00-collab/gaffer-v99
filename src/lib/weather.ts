/**
 * Weather Conditions — IDEAS #9
 *
 * Weather affects match play — rain makes passing harder, wind affects
 * long balls, heat tires players faster, fog makes long balls more
 * effective (can't see to defend).
 *
 * The modifier system already exists in the engine; this module provides
 * the weather data + the specific modifiers per weather type.
 */

export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "rain"
  | "heavy_rain"
  | "snow"
  | "fog"
  | "hot"
  | "cold"
  | "windy";

export interface WeatherModifiers {
  /** Multiplier for pass success rate (1.0 = normal). Rain: ~0.95 */
  passSuccessMod: number;
  /** Multiplier for cross accuracy (1.0 = normal). Wind: ~0.90 */
  crossAccuracyMod: number;
  /** Multiplier for fatigue rate (1.0 = normal). Heat: ~1.20 */
  fatigueMod: number;
  /** Multiplier for long ball effectiveness (1.0 = normal). Fog: ~1.10 */
  longBallMod: number;
  /** Multiplier for goal conversion (1.0 = normal). */
  goalConversionMod: number;
}

export interface WeatherInfo {
  condition: WeatherCondition;
  label: string;
  description: string;
  icon: string;
  modifiers: WeatherModifiers;
}

const WEATHER_INFOS: Record<WeatherCondition, WeatherInfo> = {
  clear: {
    condition: "clear",
    label: "Clear",
    description: "A lovely day for football. Perfect conditions.",
    icon: "☀️",
    modifiers: {
      passSuccessMod: 1.0,
      crossAccuracyMod: 1.0,
      fatigueMod: 1.0,
      longBallMod: 1.0,
      goalConversionMod: 1.0,
    },
  },
  cloudy: {
    condition: "cloudy",
    label: "Cloudy",
    description: "Overcast but dry. Standard conditions.",
    icon: "☁️",
    modifiers: {
      passSuccessMod: 1.0,
      crossAccuracyMod: 1.0,
      fatigueMod: 1.0,
      longBallMod: 1.0,
      goalConversionMod: 1.0,
    },
  },
  rain: {
    condition: "rain",
    label: "Rain",
    description: "Rain. The ball will skid about — passing gets trickier.",
    icon: "🌧️",
    modifiers: {
      passSuccessMod: 0.95,
      crossAccuracyMod: 0.92,
      fatigueMod: 1.05,
      longBallMod: 1.05,
      goalConversionMod: 0.97,
    },
  },
  heavy_rain: {
    condition: "heavy_rain",
    label: "Heavy Rain",
    description: "Heavy rain. A proper slog — mistakes will be punished.",
    icon: "⛈️",
    modifiers: {
      passSuccessMod: 0.88,
      crossAccuracyMod: 0.85,
      fatigueMod: 1.10,
      longBallMod: 1.10,
      goalConversionMod: 0.92,
    },
  },
  snow: {
    condition: "snow",
    label: "Snow",
    description: "Snow. The pitch is heavy — old-fashioned football weather.",
    icon: "🌨️",
    modifiers: {
      passSuccessMod: 0.90,
      crossAccuracyMod: 0.88,
      fatigueMod: 1.15,
      longBallMod: 1.08,
      goalConversionMod: 0.90,
    },
  },
  fog: {
    condition: "fog",
    label: "Fog",
    description: "Fog. Can't see the back four — long balls are on.",
    icon: "🌫️",
    modifiers: {
      passSuccessMod: 0.93,
      crossAccuracyMod: 0.90,
      fatigueMod: 1.0,
      longBallMod: 1.15,
      goalConversionMod: 1.0,
    },
  },
  hot: {
    condition: "hot",
    label: "Hot",
    description: "Hot day. Legs will go heavy in the second half.",
    icon: "🔥",
    modifiers: {
      passSuccessMod: 0.98,
      crossAccuracyMod: 0.98,
      fatigueMod: 1.25,
      longBallMod: 1.0,
      goalConversionMod: 1.02,
    },
  },
  cold: {
    condition: "cold",
    label: "Cold",
    description: "Bitterly cold. Takes a while to get going.",
    icon: "🥶",
    modifiers: {
      passSuccessMod: 0.97,
      crossAccuracyMod: 0.97,
      fatigueMod: 1.08,
      longBallMod: 1.03,
      goalConversionMod: 0.98,
    },
  },
  windy: {
    condition: "windy",
    label: "Windy",
    description: "Strong wind. Crosses will swirl about.",
    icon: "💨",
    modifiers: {
      passSuccessMod: 0.96,
      crossAccuracyMod: 0.88,
      fatigueMod: 1.03,
      longBallMod: 1.08,
      goalConversionMod: 0.98,
    },
  },
};

/**
 * Get weather info for a given condition.
 */
export function getWeatherInfo(condition: WeatherCondition): WeatherInfo {
  return WEATHER_INFOS[condition] ?? WEATHER_INFOS.clear;
}

/**
 * Generate a weather condition for a fixture based on the month + a random
 * roll. Winter months favour snow/cold/fog; summer months favour hot/clear;
 * spring/autumn favour rain/wind.
 */
export function generateWeather(month: number, seed: number): WeatherCondition {
  // Simple deterministic "random" based on seed.
  const roll = (seed * 9301 + 49297) % 233280;
  const r = roll / 233280; // 0..1

  // Winter: Dec(12), Jan(1), Feb(2)
  if (month === 12 || month <= 2) {
    if (r < 0.15) return "snow";
    if (r < 0.30) return "fog";
    if (r < 0.45) return "cold";
    if (r < 0.60) return "heavy_rain";
    if (r < 0.75) return "rain";
    if (r < 0.90) return "cloudy";
    return "clear";
  }

  // Summer: Jun(6), Jul(7), Aug(8)
  if (month >= 6 && month <= 8) {
    if (r < 0.20) return "hot";
    if (r < 0.50) return "clear";
    if (r < 0.70) return "cloudy";
    if (r < 0.85) return "rain";
    if (r < 0.95) return "windy";
    return "heavy_rain";
  }

  // Spring/Autumn: Mar-May, Sep-Nov
  if (r < 0.25) return "rain";
  if (r < 0.35) return "cloudy";
  if (r < 0.50) return "clear";
  if (r < 0.60) return "windy";
  if (r < 0.70) return "fog";
  if (r < 0.80) return "cold";
  if (r < 0.90) return "heavy_rain";
  return "cloudy";
}

/**
 * Generate a Gaffer-voice commentary line about the weather for the
 * pre-match screen.
 */
export function weatherCommentaryLine(condition: WeatherCondition): string {
  switch (condition) {
    case "clear":
      return "A lovely day for football — the pitch is perfect.";
    case "cloudy":
      return "Overcast but dry — should be a decent game of football.";
    case "rain":
      return "It's raining out there. The ball will skid about — careful at the back.";
    case "heavy_rain":
      return "Heavy rain. It's going to be a slog — mistakes will be punished.";
    case "snow":
      return "Snowing. Old-fashioned football weather. Get it forward early.";
    case "fog":
      return "Foggy. Can't see the back four — long balls are on.";
    case "hot":
      return "Hot out there. Legs will go heavy in the second half — pace yourselves.";
    case "cold":
      return "Bitterly cold. Takes a while to get going — don't get caught cold.";
    case "windy":
      return "Strong wind. Crosses will swirl about — don't over-commit.";
    default:
      return "Decent conditions for a game.";
  }
}
