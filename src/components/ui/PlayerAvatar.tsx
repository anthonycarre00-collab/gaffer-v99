import { useEffect, useMemo, useState, type ReactNode } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { resolveLocalMediaPath } from "../../lib/mediaAssets";
import {
 canGenerateRuntimePlayerPortraits,
 getRuntimeGeneratedPlayerPortrait,
 runtimePortraitIdentityKey,
 type PlayerPortraitIdentity,
} from "../../services/portraitService";
import AssetImage from "./AssetImage";
import GeneratedAvatar from "./GeneratedAvatar";

interface PlayerAvatarPlayer extends PlayerPortraitIdentity {
 full_name: string;
 match_name: string;
 media?: {
 face?: string;
 };
}

interface PlayerAvatarProps {
 player: PlayerAvatarPlayer;
 className?: string;
 imageClassName?: string;
 fallback?: ReactNode;
 enableRuntimePortrait?: boolean;
}

function playerInitials(player: PlayerAvatarPlayer): string {
 const source = player.match_name || player.full_name;
 return source.slice(0, 2).toUpperCase();
}

function RuntimePortraitFallback({
 player,
 imageClassName,
 fallback,
}: {
 player: PlayerAvatarPlayer;
 imageClassName: string;
 fallback: ReactNode;
}) {
 const portraitIdentity = useMemo<PlayerPortraitIdentity>(
 () => ({
 id: player.id ?? null,
 full_name: player.full_name,
 match_name: player.match_name,
 nationality: player.nationality ?? null,
 date_of_birth: player.date_of_birth ?? null,
 }),
 [
 player.id,
 player.full_name,
 player.match_name,
 player.nationality,
 player.date_of_birth,
 ],
 );
 const identityKey = useMemo(
 () => runtimePortraitIdentityKey(portraitIdentity),
 [portraitIdentity],
 );
 const [runtimeSrc, setRuntimeSrc] = useState<string | null>(null);
 const [failedSrc, setFailedSrc] = useState<string | null>(null);
 const [runtimeImageLoaded, setRuntimeImageLoaded] = useState(false);
 const shouldShowImage = Boolean(runtimeSrc && runtimeSrc !== failedSrc);

 useEffect(() => {
 let cancelled = false;
 setRuntimeSrc(null);
 setFailedSrc(null);
 setRuntimeImageLoaded(false);

 if (!canGenerateRuntimePlayerPortraits()) {
 return () => {
 cancelled = true;
 };
 }

 getRuntimeGeneratedPlayerPortrait(portraitIdentity).then((portrait) => {
 if (!cancelled) {
 setRuntimeSrc(portrait?.imageUrl ?? null);
 }
 });

 return () => {
 cancelled = true;
 };
 }, [identityKey, portraitIdentity]);

 if (shouldShowImage && runtimeSrc) {
 return (
 <div className="relative h-full w-full overflow-hidden">
 <div
 aria-hidden={runtimeImageLoaded ? "true" : undefined}
 className={`h-full w-full transition-opacity duration-200 ease-out ${runtimeImageLoaded ? "opacity-0" : "opacity-100"}`}
 >
 {fallback}
 </div>
 <img
 src={runtimeSrc}
 alt={player.full_name}
 className={`${imageClassName} absolute inset-0 transition-opacity duration-200 ease-out ${runtimeImageLoaded ? "opacity-100" : "opacity-0"}`}
 loading="lazy"
 decoding="async"
 onLoad={() => setRuntimeImageLoaded(true)}
 onError={() => {
 setFailedSrc(runtimeSrc);
 setRuntimeImageLoaded(false);
 }}
 />
 </div>
 );
 }

 return <>{fallback}</>;
}

export function PlayerAvatar({
 player,
 className = "h-9 w-9 shrink-0 overflow-hidden rounded bg-carbon-2 flex items-center justify-center text-xs font-heading font-bold text-ink-dim",
 imageClassName = "h-full w-full object-cover",
 fallback,
 enableRuntimePortrait = true,
}: PlayerAvatarProps) {
 const defaultFallback =
 fallback ?? (
 <GeneratedAvatar
 name={player.full_name || player.match_name}
 initials={playerInitials(player)}
 className="h-full w-full"
 />
 );

 // V99: Check for community face pack image first.
 // This is a synchronous check that caches the result — if a community
 // face exists, it's used instead of the procedural portrait.
 const communityFaceSrc = useCommunityFace(player.id ?? null);

 return (
 <div className={className}>
 <AssetImage
 src={communityFaceSrc ?? resolveLocalMediaPath(player.media?.face)}
 alt={player.full_name}
 className={imageClassName}
 fallback={
 enableRuntimePortrait ? (
 <RuntimePortraitFallback
 player={player}
 imageClassName="h-full w-full object-contain object-bottom"
 fallback={defaultFallback}
 />
 ) : (
 defaultFallback
 )
 }
 />
 </div>
 );
}

/**
 * V99: Community Face Pack hook.
 *
 * Checks for a community-provided face image via the get_community_face
 * Tauri command. Returns the file path if found, null otherwise.
 * Result is cached per player ID so we don't check the filesystem every render.
 */
const communityFaceCache = new Map<string, string | null>();

function useCommunityFace(playerId: string | null | undefined): string | null {
 const [faceSrc, setFaceSrc] = useState<string | null>(null);

 useEffect(() => {
 if (!playerId) {
 setFaceSrc(null);
 return;
 }

 // Check cache first.
 if (communityFaceCache.has(playerId)) {
 setFaceSrc(communityFaceCache.get(playerId) ?? null);
 return;
 }

 // Check Tauri for community face pack.
 // V100: Defensive — invoke may be undefined in test env or non-Tauri
 // contexts (e.g. Storybook). Guard with optional chaining + nullish
 // coalescing so the hook never throws "Cannot read properties of
 // undefined (reading 'then')".
 let cancelled = false;
 const facePromise = invoke<string | null>("get_community_face", { playerId });
 Promise.resolve(facePromise)
 .then((path) => {
 if (cancelled) return;
 const src = path ? convertFileSrc(path) : null;
 communityFaceCache.set(playerId, src);
 setFaceSrc(src);
 })
 .catch(() => {
 if (cancelled) return;
 communityFaceCache.set(playerId, null);
 setFaceSrc(null);
 });

 return () => {
 cancelled = true;
 };
 }, [playerId]);

 return faceSrc;
}
