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
 *
 * V100 FIX (forensic): Previously cached null on ANY backend error, which
 * meant the user saw "Pundit:" (no name) for the entire match if the first
 * fetch failed (e.g. transient Tauri invoke issue). Now we DON'T cache
 * errors — we return null for this call but allow retry on the next call.
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
    // Only cache successful results (including null names from empty db).
    // Don't cache errors — allow retry.
    if (info.id !== null || info.name !== null) {
      punditNameCache.set(fixtureId, name);
    }
    return name;
  } catch {
    // V100 FIX: Don't cache the error — just return null for this call.
    // The next call will retry the fetch.
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
