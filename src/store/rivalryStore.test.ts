import { beforeEach, describe, expect, it } from "vitest";
import { useRivalryStore } from "./rivalryStore";

/**
 * V100 Issue #30: Player rivalry store tests.
 *
 * Covers add/get/remove/duplicate-update semantics + the
 * hasRivalryBetween helper used by future match commentary hooks.
 */

beforeEach(() => {
  useRivalryStore.setState({ rivalries: [] });
});

describe("rivalryStore", () => {
  it("adds a new rivalry", () => {
    useRivalryStore
      .getState()
      .addRivalry("p1", "p2", "simmer", "scored winner in cup final");
    const list = useRivalryStore.getState().getRivalriesForPlayer("p1");
    expect(list).toHaveLength(1);
    expect(list[0].player_a_id).toBe("p1");
    expect(list[0].player_b_id).toBe("p2");
    expect(list[0].intensity).toBe("simmer");
    expect(list[0].reason).toBe("scored winner in cup final");
  });

  it("is symmetric — rivalry visible from both players", () => {
    useRivalryStore.getState().addRivalry("p1", "p2", "boil", "");
    expect(useRivalryStore.getState().getRivalriesForPlayer("p1")).toHaveLength(1);
    expect(useRivalryStore.getState().getRivalriesForPlayer("p2")).toHaveLength(1);
  });

  it("updates existing rivalry instead of duplicating", () => {
    useRivalryStore.getState().addRivalry("p1", "p2", "spark", "initial");
    useRivalryStore.getState().addRivalry("p2", "p1", "boil", "escalation");
    const list = useRivalryStore.getState().rivalries;
    expect(list).toHaveLength(1);
    expect(list[0].intensity).toBe("boil");
    expect(list[0].reason).toBe("escalation");
  });

  it("rejects self-rivalry", () => {
    useRivalryStore.getState().addRivalry("p1", "p1", "simmer", "self");
    expect(useRivalryStore.getState().rivalries).toHaveLength(0);
  });

  it("removes a rivalry by id", () => {
    useRivalryStore.getState().addRivalry("p1", "p2", "simmer", "");
    const [r] = useRivalryStore.getState().rivalries;
    useRivalryStore.getState().removeRivalry(r.id);
    expect(useRivalryStore.getState().rivalries).toHaveLength(0);
  });

  it("hasRivalryBetween detects both directions", () => {
    useRivalryStore.getState().addRivalry("p1", "p2", "boil", "");
    expect(useRivalryStore.getState().hasRivalryBetween("p1", "p2")).toBe(true);
    expect(useRivalryStore.getState().hasRivalryBetween("p2", "p1")).toBe(true);
    expect(useRivalryStore.getState().hasRivalryBetween("p1", "p3")).toBe(false);
  });

  it("clearAll wipes the store", () => {
    useRivalryStore.getState().addRivalry("p1", "p2", "simmer", "");
    useRivalryStore.getState().addRivalry("p3", "p4", "boil", "");
    useRivalryStore.getState().clearAll();
    expect(useRivalryStore.getState().rivalries).toHaveLength(0);
  });
});
