/**
 * Social Media Feed — IDEAS #14
 *
 * A "social media" style feed showing fan reactions, pundit opinions, and
 * player posts — in addition to the formal news wire. All content is in
 * Gaffer voice.
 *
 * Different voices:
 * - Die-hard fans: passionate, emotional, hyperbolic
 * - Casual fans: laid-back, meme-y, supportive
 * - Pundits: analytical, critical, name-dropping
 * - Journalists: factual, transfer-focused, clickbait-y
 */

import type { MatchSnapshot } from "../match/types";

export type SocialMediaType =
  | "fan_diehard"
  | "fan_casual"
  | "pundit"
  | "journalist"
  | "player_post";

export interface SocialMediaPost {
  id: string;
  type: SocialMediaType;
  author: string;
  handle: string;
  avatar: string; // emoji
  content: string;
  timestamp: string;
  likes: number;
  reposts: number;
  replies: number;
}

interface FanNamePool {
  diehard: string[];
  casual: string[];
}

const FAN_NAMES: FanNamePool = {
  diehard: [
    "DazzaGaffer", "TrueBlue_92", "SeasonTicketSince99", "AwayDaysEveryWeek",
    "InTheBlood", "GafferLoyal", "TerraceLegend", "StandUpIfYouLove",
  ],
  casual: [
    "FootyFanDan", "SundayLeagueHero", "MOTDWatcher", "FantasyFlop",
    "CasualGooner", "WeekendWarrior", "PubTeamPundit", "CheekyChip",
  ],
};

const PUNDIT_NAMES = [
  { name: "Gary Neville", handle: "@GNev2", avatar: "🎙️" },
  { name: "Jamie Carragher", handle: "@Carra23", avatar: "🎙️" },
  { name: "Rio Ferdinand", handle: "@rioferdy5", avatar: "🎙️" },
  { name: "Micah Richards", handle: "@MicahRichards", avatar: "🎙️" },
  { name: "Alan Shearer", handle: "@alanshearer", avatar: "🎙️" },
];

const JOURNALIST_NAMES = [
  { name: "Fabrizio Romano", handle: "@FabrizioRomano", avatar: "📰" },
  { name: "David Ornstein", handle: "@David_Ornstein", avatar: "📰" },
  { name: "Transfer Wire", handle: "@TransferWire", avatar: "📰" },
  { name: "Football Insider", handle: "@InsiderFootball", avatar: "📰" },
];

const AVATARS = ["⚽", "🏆", "🔥", "💪", "🎯", "⚡", "🤩", "😤", "👏", "🤔"];

function randomFrom<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function randomInt(min: number, max: number, seed: number): number {
  return min + (seed % (max - min + 1));
}

/**
 * Generate social media posts after a match.
 */
export function generateMatchSocialPosts(
  snapshot: MatchSnapshot,
  userTeamName: string,
  isUserHome: boolean,
  seed: number,
): SocialMediaPost[] {
  const posts: SocialMediaPost[] = [];
  const userScore = isUserHome ? snapshot.home_score : snapshot.away_score;
  const oppScore = isUserHome ? snapshot.away_score : snapshot.home_score;
  const won = userScore > oppScore;
  const lost = userScore < oppScore;

  // Die-hard fan reactions (2-3 posts)
  const diehardCount = randomInt(2, 3, seed);
  for (let i = 0; i < diehardCount; i++) {
    const s = seed + i * 7;
    const author = randomFrom(FAN_NAMES.diehard, s);
    const content = won
      ? randomFrom([
          `WHAT A WIN! ${userTeamName} are DIFFERENT CLASS today! 🔥🔥🔥`,
          `That's more like it! Proper performance from the lads. Gaffer got it spot on.`,
          `THREE POINTS! Get in! That's how you play for the shirt!`,
          `I've said it all season — this team has CHARACTER. Today proved it.`,
        ], s)
      : lost
        ? randomFrom([
            `Absolutely FUMING. That was embarrassing. The board need to act NOW.`,
            `Same old story. Week in, week out. Something has to change.`,
            `I've seen pub teams defend better than that. Shocking.`,
            `The gaffer's lost the dressing room. You can see it in the body language.`,
          ], s)
        : randomFrom([
            `A point's a point I suppose. But we should be beating these at home.`,
            `Frustrating. Dominated the game and couldn't find the winner.`,
            `Not good enough, not terrible either. Mid-table mentality.`,
          ], s);

    posts.push({
      id: `social_diehard_${seed}_${i}`,
      type: "fan_diehard",
      author,
      handle: `@${author}`,
      avatar: randomFrom(AVATARS, s),
      content,
      timestamp: snapshot.current_minute ? `${90}' FT` : "FT",
      likes: randomInt(50, 500, s),
      reposts: randomInt(5, 50, s),
      replies: randomInt(10, 100, s),
    });
  }

  // Casual fan reactions (1-2 posts)
  const casualCount = randomInt(1, 2, seed + 3);
  for (let i = 0; i < casualCount; i++) {
    const s = seed + i * 11 + 3;
    const author = randomFrom(FAN_NAMES.casual, s);
    const content = won
      ? randomFrom([
          `Easy money on ${userTeamName} today 😎 fantasy team looking good`,
          `Love watching this team play. Gaffer ball is back baby 🤩`,
          `That's my captain! Carrying my fantasy team this week 🔥`,
        ], s)
      : lost
        ? randomFrom([
          `Well that's ruined my weekend 🙃`,
          `Transferring their striker OUT of my fantasy team immediately`,
          `Gutted. But also kind of expected it tbh 🤷`,
        ], s)
        : randomFrom([
          `Boring game tbh. Switched over to the other match`,
          `Meh. A draw. Moving on.`,
        ], s);

    posts.push({
      id: `social_casual_${seed}_${i}`,
      type: "fan_casual",
      author,
      handle: `@${author}`,
      avatar: randomFrom(AVATARS, s),
      content,
      timestamp: "FT",
      likes: randomInt(20, 200, s),
      reposts: randomInt(2, 20, s),
      replies: randomInt(5, 50, s),
    });
  }

  // Pundit reaction (0-1 post)
  if (randomInt(0, 2, seed + 5) === 0) {
    const s = seed + 5;
    const pundit = randomFrom(PUNDIT_NAMES, s);
    const content = won
      ? randomFrom([
          `Impressive performance from ${userTeamName}. The tactical setup was spot on — you can see the manager's philosophy coming through.`,
          `What I liked today was the intensity. ${userTeamName} pressed high, won the ball back quickly, and punished them. That's proper football.`,
          `The difference-maker today was the midfield. Controlled the tempo, won the battles. That's how you win football matches.`,
        ], s)
      : lost
        ? randomFrom([
          `Disappointing from ${userTeamName}. Too slow in possession, no urgency pressing. The manager has questions to answer.`,
          `I've been saying it for weeks — the defensive shape is all wrong. You can't concede those kind of goals at this level.`,
          `The body language tells you everything. The players don't look like they believe in what they're doing.`,
        ], s)
        : randomFrom([
          `A fair result in the end. Neither side did enough to win it.`,
          `${userTeamName} had their moments but lacked that cutting edge. Need more quality in the final third.`,
        ], s);

    posts.push({
      id: `social_pundit_${seed}`,
      type: "pundit",
      author: pundit.name,
      handle: pundit.handle,
      avatar: pundit.avatar,
      content,
      timestamp: "FT",
      likes: randomInt(200, 2000, s),
      reposts: randomInt(50, 300, s),
      replies: randomInt(100, 500, s),
    });
  }

  // Journalist reaction (0-1 post — usually transfer-related)
  if (randomInt(0, 3, seed + 7) === 0) {
    const s = seed + 7;
    const journo = randomFrom(JOURNALIST_NAMES, s);
    const content = randomFrom([
      `🚨 EXCLUSIVE: ${userTeamName} are lining up a move for a new signing in the upcoming window. Sources say the manager has identified his top target. More to follow. 🚨`,
      `Understanding ${userTeamName} are considering their managerial options. No decision yet, but the board is "concerned" about recent form.`,
      `${userTeamName} scouts were spotted at last night's match. The club is monitoring several targets ahead of the window.`,
    ], s);

    posts.push({
      id: `social_journo_${seed}`,
      type: "journalist",
      author: journo.name,
      handle: journo.handle,
      avatar: journo.avatar,
      content,
      timestamp: "FT",
      likes: randomInt(500, 5000, s),
      reposts: randomInt(100, 1000, s),
      replies: randomInt(200, 800, s),
    });
  }

  return posts;
}

/**
 * Generate social media posts for a transfer event.
 */
export function generateTransferSocialPosts(
  playerName: string,
  fromTeam: string,
  toTeam: string,
  fee: number,
  seed: number,
): SocialMediaPost[] {
  const posts: SocialMediaPost[] = [];
  const feeStr = fee >= 1_000_000 ? `£${(fee / 1_000_000).toFixed(1)}M` : `£${(fee / 1000).toFixed(0)}k`;

  // Fabrizio Romano style
  posts.push({
    id: `social_transfer_romano_${seed}`,
    type: "journalist",
    author: "Fabrizio Romano",
    handle: "@FabrizioRomano",
    avatar: "📰",
    content: `🚨 HERE WE GO! ${playerName} to ${toTeam}, confirmed! ${feeStr} fee agreed with ${fromTeam}. Medical scheduled. Contract being finalized. Exclusive — done deal! 🚨`,
    timestamp: "now",
    likes: randomInt(1000, 10000, seed),
    reposts: randomInt(500, 5000, seed),
    replies: randomInt(300, 2000, seed),
  });

  // Fan reactions
  const diehardAuthor = randomFrom(FAN_NAMES.diehard, seed);
  posts.push({
    id: `social_transfer_fan_${seed}`,
    type: "fan_diehard",
    author: diehardAuthor,
    handle: `@${diehardAuthor}`,
    avatar: randomFrom(AVATARS, seed),
    content: randomFrom([
      `${feeStr} for ${playerName}?! You're having a laugh. Absolute robbery.`,
      `GET IN! What a signing! ${playerName} is exactly what we needed!`,
      `Don't know much about him but the gaffer clearly sees something. Trust the process.`,
      `${feeStr} is daylight robbery. We've mugged them off proper.`,
    ], seed),
    timestamp: "now",
    likes: randomInt(50, 500, seed + 1),
    reposts: randomInt(5, 50, seed + 2),
    replies: randomInt(10, 100, seed + 3),
  });

  return posts;
}

/**
 * Get the display label for a social media type.
 */
export function getSocialTypeLabel(type: SocialMediaType): string {
  switch (type) {
    case "fan_diehard": return "Die-hard Fan";
    case "fan_casual": return "Fan";
    case "pundit": return "Pundit";
    case "journalist": return "Journalist";
    case "player_post": return "Player";
  }
}

/**
 * Get the colour class for a social media type.
 */
export function getSocialTypeColor(type: SocialMediaType): string {
  switch (type) {
    case "fan_diehard": return "text-primary-600 dark:text-primary-400";
    case "fan_casual": return "text-accent-600 dark:text-accent-400";
    case "pundit": return "text-accent-700 dark:text-accent-500";
    case "journalist": return "text-gray-700 dark:text-gray-300";
    case "player_post": return "text-primary-500 dark:text-primary-300";
  }
}
