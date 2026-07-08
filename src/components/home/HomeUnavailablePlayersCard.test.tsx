import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PlayerData } from "../../store/gameStore";
import HomeUnavailablePlayersCard from "./HomeUnavailablePlayersCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number | undefined>) => {
      if (key === "dashboard.squad") return "Squad";
      if (key === "home.unavailablePlayers") return "Unavailable Players";
      if (key === "common.injured") return "Injured";
      if (key === "home.daysUnavailable") return `${params?.count} days out`;
      if (key === "common.positions.Forward") return "Forward";
      return key;
    },
  }),
}));

function createPlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    id: "player-1",
    match_name: "J. Smith",
    full_name: "John Smith",
    date_of_birth: "2000-01-01",
    nationality: "BR",
    position: "Forward",
    natural_position: "Forward",
    alternate_positions: [],
    training_focus: null,
    attributes: {
      pace: 10,
      engine: 10,
      power: 10,
      agility: 10,
      passing: 10,
      finishing: 10,
      defending: 10,
      touch: 10,
      anticipation: 10,
      vision: 10,
      decisions: 10,
      composure: 10,
      leadership: 10,
      shot_stopping: 10,
      aerial: 10,
      burst: 50,
      distribution: 50,
      commanding: 50,
      playing_out: 50,
},
    condition: 80,
    morale: 80,
    injury: {
      name: "Hamstring",
      days_remaining: 6,
    },
    team_id: "team-1",
    retired: false,
    contract_end: null,
    wage: 0,
    market_value: 0,
    stats: {
      appearances: 0,
      goals: 0,
      assists: 0,
      clean_sheets: 0,
      yellow_cards: 0,
      red_cards: 0,
      avg_rating: 0,
      minutes_played: 0,
    },
    career: [],
    transfer_listed: false,
    loan_listed: false,
    transfer_offers: [],
    traits: [],
    ...overrides,
  };
}

describe("HomeUnavailablePlayersCard", () => {
  it("renders unavailable players with injury details", () => {
    render(
      <HomeUnavailablePlayersCard
        players={[createPlayer()]}
        resolveInjuryName={(name) => name}
      />,
    );

    expect(screen.getByText("Unavailable Players")).toBeInTheDocument();
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("Injured")).toBeInTheDocument();
    expect(screen.getByText(/Hamstring/)).toBeInTheDocument();
    expect(screen.getByText(/6 days out/)).toBeInTheDocument();
  });
});