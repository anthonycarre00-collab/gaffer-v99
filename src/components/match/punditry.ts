/**
 * Pundit Commentary — a second-voice layer on top of the main commentary.
 *
 * The main `commentary.ts` gives you the play-by-play call. This module
 * gives you the co-commentator / pundit's reaction — the "Oooh, big moment!"
 * or "He'll be disappointed with that" or "The gaffer will be furious"
 * layered on top, the way real TV commentary works (lead commentator calls
 * the action, co-commentator adds colour and opinion).
 *
 * Picks one line per event based on a stable hash so the same event always
 * gets the same pundit reaction (deterministic replays). Includes context-
 * aware lines for big moments: hat-tricks, red cards, late winners, etc.
 */

import type { MatchEvent, MatchSnapshot } from "./types";
import { getPlayerName } from "./helpers";

export interface PunditLine {
 /** The pundit's reaction. */
 line: string;
 /** Tone: positive / neutral / negative / amazed / furious — drives styling. */
 tone: "positive" | "neutral" | "negative" | "amazed" | "furious";
 /**
  * V100 P1 (Issue #12): The pundit's display name (e.g. "Roy Keano-type").
  * When set, the UI should prefix the line with "{name}:" to attribute it.
  * When null, the line is from the default (unnamed) co-commentator.
  */
 speaker?: string | null;
}

/** Stable hash so the same event always gets the same pundit line. */
function hashEvent(evt: MatchEvent): number {
 const key = `${evt.minute}|${evt.event_type}|${evt.player_id ?? ""}`;
 let h = 5381;
 for (let i = 0; i < key.length; i++) {
 h = ((h << 5) + h + key.charCodeAt(i)) | 0;
 }
 return Math.abs(h);
}

/**
 * Pick a pundit reaction for the given event. Returns null if no pundit
 * line applies (e.g. kick-off, half-time — those don't need colour).
 */
export function getPunditLine(
 evt: MatchEvent,
 snapshot: MatchSnapshot,
 isUserEvent: boolean,
): PunditLine | null {
 const player = getPlayerName(snapshot, evt.player_id);
 const minute = evt.minute;
 const isLate = minute >= 80;
 const hash = hashEvent(evt);
 // Determine user's score for context-aware full-time / half-time lines.
 // The caller passes isUserEvent per event; for the overall match context
 // we infer the user's side by checking which team has scored the user's
 // goals — but at full-time we just compare scores relative to isUserEvent.
 const userIsHome = evt.side === "Home" ? isUserEvent : !isUserEvent;
 const userScore = userIsHome ? snapshot.home_score : snapshot.away_score;
 const oppScore = userIsHome ? snapshot.away_score : snapshot.home_score;

 switch (evt.event_type) {
 case "Goal":
 case "PenaltyGoal": {
 // Tally goals for special reactions.
 const tally = snapshot.events.filter(
 (e) =>
 (e.event_type === "Goal" || e.event_type === "PenaltyGoal") &&
 e.player_id === evt.player_id &&
 e.minute <= minute,
 ).length;
 if (tally === 3) {
 const lines = [
 `${player} has got his hat-trick — what a night for the lad!`,
 `Three for ${player}! You don't see that very often — special, special talent.`,
 `Match ball for ${player}. The gaffer's going to be waxing lyrical about that one for weeks.`,
 ];
 return {
 line: lines[hash % lines.length],
 tone: "amazed",
 };
 }
 if (isUserEvent) {
 if (isLate) {
 const lines = [
 `HUGE goal! The gaffer's gone wild on the touchline — that could be the winner!`,
 `Late drama! ${player} has won it — the fans are going to be talking about that for years!`,
 `You beauty! ${player} in the dying minutes — that's a priceless three points!`,
 `Get in! The bench has emptied — ${player} has snatched it at the death!`,
 ];
 return { line: lines[hash % lines.length], tone: "amazed" };
 }
 const lines = [
 `Class finish. The gaffer will be delighted with that.`,
 `That's what ${player} is in the team for — ice-cold when it matters.`,
 `The stadium is rocking — ${player} has given them exactly what they came for.`,
 `${player} thrives on moments like this. Big-game player.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }
 if (isLate) {
 const lines = [
 `That's a sickener. ${player} has stolen it at the death — the gaffer's fuming on the touchline.`,
 `Oh no. ${player} in the dying minutes — that's going to hurt for a week.`,
 `Late heartbreak. ${player} has won it and the away bench has gone berserk.`,
 `The kind of goal that gets managers the sack. ${player} with the dagger.`,
 ];
 return { line: lines[hash % lines.length], tone: "furious" };
 }
 const lines = [
 `That's poor defending. ${player} given all the time in the world.`,
 `The gaffer will be furious with that — ${player} was completely unmarked.`,
 `Soft goal to concede. ${player} barely had to break a sweat.`,
 `You can't give ${player} that kind of space — he'll punish you every time.`,
 ];
 return { line: lines[hash % lines.length], tone: "negative" };
 }

 case "RedCard":
 case "SecondYellow": {
 if (isUserEvent) {
 const lines = [
 `That's a disaster. Down to ten — the gaffer's going to rip into him in the dressing room.`,
 `Off! ${player} walks. The gaffer is going absolutely spare on the touchline.`,
 `Red card — and the gaffer's tactical plan goes out the window.`,
 `${player} has let everyone down there. The fans are not happy.`,
 ];
 return { line: lines[hash % lines.length], tone: "furious" };
 }
 const lines = [
 `He's off! ${player} walks — and the gaffer's got a decision to make now.`,
 `Red card. ${player} — the referee had no choice. The numbers game changes everything.`,
 `That's been coming. ${player} has been living on the edge all afternoon.`,
 `Off! The numerical advantage is huge now — the opposition are there for the taking.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }

 case "YellowCard": {
 if (isUserEvent) {
 const lines = [
 `${player} needs to calm down — one more and he's off.`,
 `Silly booking. The gaffer won't be happy with that.`,
 `${player} is walking a tightrope now.`,
 ];
 return { line: lines[hash % lines.length], tone: "negative" };
 }
 const lines = [
 `That's a foul too far. ${player} goes in the book.`,
 `The referee's had enough. ${player} — yellow card.`,
 `Cynical. ${player} — he had to bring him down.`,
 ];
 return { line: lines[hash % lines.length], tone: "neutral" };
 }

 case "ShotSaved": {
 if (isUserEvent) {
 const lines = [
 `Top save — that's why he's between the sticks.`,
 `The keeper has denied ${player} — great stop.`,
 `${player} will be shaking his head — he had to score there.`,
 ];
 return { line: lines[hash % lines.length], tone: "neutral" };
 }
 const lines = [
 `Brilliant stop. ${player} was certain he'd scored.`,
 `The keeper has bailed them out — that was a certain goal.`,
 `How did he keep that out?! ${player} couldn't believe it.`,
 ];
 return { line: lines[hash % lines.length], tone: "amazed" };
 }

 case "ShotOffTarget":
 case "ShotBlocked": {
 if (isUserEvent) {
 const lines = [
 `He should've done better there. ${player} will know it too.`,
 `Half a chance — ${player} couldn't quite wrap his foot around it.`,
 `The crowd groaned — they sensed that was on.`,
 ];
 return { line: lines[hash % lines.length], tone: "negative" };
 }
 const lines = [
 `${player} dragged it wide — he'll be having nightmares.`,
 `That's a let-off. ${player} should've hit the target.`,
 `Poor finish. ${player} snatched at it.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }

 case "PenaltyAwarded": {
 if (isUserEvent) {
 const lines = [
 `Penalty! The ref's pointed to the spot — huge moment.`,
 `Stonewaller. The gaffer's been screaming for it and finally gets the call.`,
 `He's given it! ${player} brought down — the place has erupted.`,
 ];
 return { line: lines[hash % lines.length], tone: "amazed" };
 }
 const lines = [
 `Penalty! That's soft — but the ref's given it.`,
 `Oh no. ${player} — clumsy challenge, and the ref's pointed straight at the spot.`,
 `The gaffer's going ballistic. ${player} has cost them a penalty.`,
 ];
 return { line: lines[hash % lines.length], tone: "furious" };
 }

 case "PenaltyMiss": {
 if (isUserEvent) {
 const lines = [
 `He's blown it! ${player} from the spot — the gaffer's holding his head.`,
 `SAVED! Oh no. ${player} — that's a huge moment gone begging.`,
 `Off the post! ${player} — you've got to bury those.`,
 ];
 return { line: lines[hash % lines.length], tone: "furious" };
 }
 const lines = [
 `MISS! ${player} has fluffed his lines from 12 yards.`,
 `Saved! The keeper guesses right — huge moment.`,
 `That's criminal. ${player} skied it — the gaffer will be seething.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }

 case "Injury": {
 if (isUserEvent) {
 const lines = [
 `That doesn't look good. ${player} — the physio's on. The gaffer's preparing a sub.`,
 `Injury concern. ${player} is down — could be a long one.`,
 `The gaffer will be hoping that's not as bad as it looks. ${player} — nasty.`,
 ];
 return { line: lines[hash % lines.length], tone: "negative" };
 }
 const lines = [
 `He's staying down. ${player} — could be a problem for them.`,
 `Injury. ${player} — they'll need to make a change.`,
 `The physio's called for the stretcher. ${player} — that's the night over.`,
 ];
 return { line: lines[hash % lines.length], tone: "neutral" };
 }

 case "Substitution": {
 if (isUserEvent) {
 const lines = [
 `Tactical change. The gaffer's rolling the dice.`,
 `Fresh legs. The bench is being used — game state demanding it.`,
 `Bold substitution. The gaffer's going for it.`,
 ];
 return { line: lines[hash % lines.length], tone: "neutral" };
 }
 const lines = [
 `Change for them. The gaffer's reacting to what he's seen.`,
 `Substitution — they're shaking things up.`,
 `Fresh impetus off the bench.`,
 ];
 return { line: lines[hash % lines.length], tone: "neutral" };
 }

 case "FullTime": {
 if (userScore > oppScore) {
 const lines = [
 `Full-time. The gaffer will be pleased with that — three points, job done.`,
 `That's the kind of result that buys you a quiet week. Top performance.`,
 `The fans go home happy. The gaffer walks down the tunnel with a smile.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }
 if (userScore < oppScore) {
 const lines = [
 `Full-time. Bitter pill — the gaffer's got some explaining to do.`,
 `That's a defeat that stings. The board will be asking questions.`,
 `The boos ring around the ground. The gaffer's under pressure now.`,
 ];
 return { line: lines[hash % lines.length], tone: "furious" };
 }
 const lines = [
 `Honours even. The gaffer will take that on a different day.`,
 `A point apiece — probably fair on the balance of play.`,
 `Stalemate. The gaffer shrugs on the touchline.`,
 ];
 return { line: lines[hash % lines.length], tone: "neutral" };
 }

 case "HalfTime": {
 if (userScore > oppScore) {
 const lines = [
 `Half-time. The gaffer will be saying "more of the same" in there.`,
 `One-nil up at the break — the gaffer's got his tactics right so far.`,
 `Strong first half. The gaffer has to manage this now.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }
 if (userScore < oppScore) {
 const lines = [
 `Half-time. The gaffer's got work to do — and he knows it.`,
 `Behind at the break. Expect some choice words in the dressing room.`,
 `The gaffer's got 15 minutes to sort this out.`,
 ];
 return { line: lines[hash % lines.length], tone: "negative" };
 }
 const lines = [
 `All square at the break. The gaffer's got his tactics board out.`,
 `Goalless at half-time — the gaffer will be looking to shake things up.`,
 `Half-time. Time for a breather and a rethink.`,
 ];
 return { line: lines[hash % lines.length], tone: "neutral" };
 }

 case "Tackle": {
 if (isUserEvent) {
 const lines = [
 `Proper tackle that — sets the tone for the lads.`,
 `The gaffer loves a tackle like that. Wins the ball back, gets the crowd up.`,
 `${player} putting a shift in. That's what the gaffer asks for.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }
 const lines = [
 `That's a proper tackle — they're not getting anything easy today.`,
 `${player} reads it brilliantly — that's why he's in the team.`,
 `Big defensive moment. ${player} with the tackle that breaks it up.`,
 ];
 return { line: lines[hash % lines.length], tone: "negative" };
 }

 case "Interception": {
 const lines = [
 `Reading the danger — ${player} cuts it out. Smart.`,
 `Vital interception. ${player} was alive to that.`,
 `Proper defending — reads the pass and steps in.`,
 ];
 return { line: lines[hash % lines.length], tone: "neutral" };
 }

 case "PassCompleted": {
 // Passes are frequent — only show pundit reaction occasionally (1 in 4)
 if (hash % 4 !== 0) return null;
 const lines = [
 `Good ball — keeps the move alive.`,
 `Patient buildup — the gaffer will be happy with that.`,
 `${player} finding his man. The shape's holding.`,
 ];
 return { line: lines[hash % lines.length], tone: "neutral" };
 }

 case "PassIntercepted": {
 if (isUserEvent) {
 const lines = [
 `Cut out — that's sloppy from us.`,
 `Reads it and nicks it. We've given that away cheaply.`,
 `${player} tries the pass but it's cut out. Pressure off for them.`,
 ];
 return { line: lines[hash % lines.length], tone: "negative" };
 }
 const lines = [
 `Great anticipation — picks the pass off.`,
 `Sniffs out the danger. That's proper defending.`,
 `Reading the game well — cuts the move out.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }

 case "Dribble": {
 if (isUserEvent) {
 const lines = [
 `Lovely feet! ${player} beats his man.`,
 `That's why the gaffer picks him — magic feet.`,
 `${player} with a sudden burst — the crowd's on their feet.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }
 const lines = [
 `He's gone past him — dangerous.`,
 `${player} beats his man — we need to deal with this.`,
 `Trickery from ${player} — that's a real threat.`,
 ];
 return { line: lines[hash % lines.length], tone: "negative" };
 }

 case "DribbleTackled": {
 if (isUserEvent) {
 const lines = [
 `He's lost it! ${player} tries one too many.`,
 `Robbed of the ball — sloppy from ${player}.`,
 `${player} dispossessed — that was a risky dribble.`,
 ];
 return { line: lines[hash % lines.length], tone: "negative" };
 }
 const lines = [
 `Wins it cleanly off him — proper defending.`,
 `Reads the dribble and wins the ball — class.`,
 `The tackle comes in — that's why he's in the team.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }

 case "Cross": {
 if (isUserEvent) {
 const lines = [
 `Whips it in — looking for the head in the middle.`,
 `Dangerous delivery from ${player}.`,
 `The big lads are up — proper cross that.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }
 const lines = [
 `Dangerous ball in — we need to deal with this.`,
 `${player} arcs it in — that's begging to be attacked.`,
 `Into the mixer — the gaffer won't be happy with that.`,
 ];
 return { line: lines[hash % lines.length], tone: "negative" };
 }

 case "Clearance": {
 if (isUserEvent) {
 const lines = [
 `Gets rid of it — relief for the defence.`,
 `${player} hacks it clear — sometimes simple is best.`,
 `Big clearance — the danger's gone for now.`,
 ];
 return { line: lines[hash % lines.length], tone: "neutral" };
 }
 const lines = [
 `They've cleared it — pressure's off for them.`,
 `${player} smashes it away — we'll have to build again.`,
 `Headed clear — the chance is gone.`,
 ];
 return { line: lines[hash % lines.length], tone: "neutral" };
 }

 case "Corner": {
 if (isUserEvent) {
 const lines = [
 `Corner to us — chance to put them under pressure.`,
 `The big lads go forward — real opportunity here.`,
 `Ref points to the corner flag. Let's make this count.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }
 const lines = [
 `Corner to them — we need to defend this properly.`,
 `They've won a corner — the gaffer will want focus.`,
 `Dangerous moment. Set piece to deal with.`,
 ];
 return { line: lines[hash % lines.length], tone: "negative" };
 }

 case "FreeKick": {
 if (isUserEvent) {
 const lines = [
 `Free kick to us — in a dangerous position.`,
 `${player} stands over it — this is a real chance.`,
 `Set piece won — the gaffer will have a routine for this.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }
 const lines = [
 `Free kick against us — dangerous spot.`,
 `${player} to take — the wall needs to be spot on.`,
 `Conceded a free kick — silly foul to give away.`,
 ];
 return { line: lines[hash % lines.length], tone: "negative" };
 }

 case "GoalKick": {
 // Goal kicks are frequent and not very dramatic — only react 1 in 5
 if (hash % 5 !== 0) return null;
 const lines = [
 `Goal kick — back to square one for the attack.`,
 `Playing out from the back — the gaffer's way.`,
 `Long ball — direct approach.`,
 ];
 return { line: lines[hash % lines.length], tone: "neutral" };
 }

 case "ShootoutGoal": {
 if (isUserEvent) {
 const lines = [
 `SCORED! ${player} — ice in the veins!`,
 `That's why he takes them — cool as you like from ${player}.`,
 `${player} sends the keeper the wrong way — huge goal!`,
 ];
 return { line: lines[hash % lines.length], tone: "amazed" };
 }
 const lines = [
 `${player} scores — the keeper had no chance.`,
 `Penalty converted — pressure's back on us.`,
 `${player} slots it home — that's class under pressure.`,
 ];
 return { line: lines[hash % lines.length], tone: "furious" };
 }

 case "ShootoutMiss": {
 if (isUserEvent) {
 const lines = [
 `MISSED! ${player} — the gaffer can't watch!`,
 `Saved! That's a huge moment — and it's gone against us!`,
 `${player} drags it wide — the gaffer's holding his head!`,
 ];
 return { line: lines[hash % lines.length], tone: "furious" };
 }
 const lines = [
 `Missed! That's a massive let-off for us!`,
 `Saved! The keeper guesses right — huge moment!`,
 `${player} skied it — we're still in this!`,
 ];
 return { line: lines[hash % lines.length], tone: "amazed" };
 }

 case "HeaderWon": {
 if (isUserEvent) {
 const lines = [
 `Proper header that — ${player} dominates in the air.`,
 `The gaffer loves a big lad. ${player} wins it clean.`,
 `${player} rises highest — that's why he's in the team.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }
 const lines = [
 `Dangerous — ${player} wins the header.`,
 `${player} dominates in the air — we need to deal with that.`,
 `The defender couldn't compete — ${player} too strong.`,
 ];
 return { line: lines[hash % lines.length], tone: "negative" };
 }

 case "HeaderLost": {
 if (isUserEvent) {
 const lines = [
 `Beaten in the air — ${player} couldn't get there.`,
 `Lost the header — ${player} mistimed it.`,
 `The defender outjumps him — ${player} loses out.`,
 ];
 return { line: lines[hash % lines.length], tone: "negative" };
 }
 const lines = [
 `Good defending — wins the header against ${player}.`,
 `${player} beaten in the air — proper defending.`,
 `The defender dominates — ${player} couldn't compete.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }

 case "Offside": {
 if (isUserEvent) {
 const lines = [
 `Flag's up — ${player} timed the run too early.`,
 `Offside. ${player} a yard ahead — the gaffer's frustrated.`,
 `Linesman's flag. ${player} caught napping.`,
 ];
 return { line: lines[hash % lines.length], tone: "negative" };
 }
 const lines = [
 `Offside! ${player} caught — the line held well.`,
 `Flag goes up — ${player} a step too early.`,
 `Good defensive line — ${player} offside.`,
 ];
 return { line: lines[hash % lines.length], tone: "positive" };
 }

 default:
 return null;
 }
}
