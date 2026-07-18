import { invoke } from "@tauri-apps/api/core";

/**
 * V100 P2 (Issue #12): Pundit service — fetches the active pundit for a fixture.
 * The backend picks a pundit deterministically from the fixture id, so the same
 * match always gets the same co-commentator.
 */

export interface PunditInfo {
  id: string | null;
  name: string | null;
  archetype: string | null;
  catchphrase: string | null;
}

/**
 * Fetch the pundit for a fixture. Returns null fields if no pundit is assigned
 * (e.g. the database is empty).
 */
export async function getPunditForFixture(
  fixtureId: string,
  eventKey?: string,
): Promise<PunditInfo> {
  return invoke<PunditInfo>("get_pundit_for_fixture", {
    fixtureId,
    eventKey: eventKey ?? null,
  });
}

/**
 * V100 P2 (Issue #12): In-memory pundit name cache. The backend picks a pundit
 * deterministically from the fixture id, so we only need to fetch once per
 * fixture. Subsequent calls return the cached name.
 * Cache is keyed by fixtureId.
 */
const punditNameCache = new Map<string, string | null>();

/**
 * Get the pundit's display name for a fixture. Fetches from backend on first
 * call, then returns cached value. Returns null if no pundit is assigned.
 */
export async function getPunditNameForFixture(
  fixtureId: string,
): Promise<string | null> {
  if (punditNameCache.has(fixtureId)) {
    return punditNameCache.get(fixtureId) ?? null;
  }
  try {
    const info = await getPunditForFixture(fixtureId);
    const name = info.name;
    punditNameCache.set(fixtureId, name);
    return name;
  } catch {
    // Backend error — cache null so we don't retry every event.
    punditNameCache.set(fixtureId, null);
    return null;
  }
}

/**
 * Clear the pundit name cache. Call this when starting a new match so the
 * new fixture's pundit gets fetched.
 */
export function clearPunditCache(): void {
  punditNameCache.clear();
}
