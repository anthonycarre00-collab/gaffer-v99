import { describe, expect, it } from "vitest";
import type { PlayerData } from "../../store/gameStore";
import { buildPlayerAttributeGroups } from "./PlayerProfile.attributes";

function createPlayer(overrides: Partial<PlayerData> = {}): PlayerData {
    return {
        id: "player-1",
        match_name: "J. Smith",
        full_name: "John Smith",
        date_of_birth: "2000-01-01",
        nationality: "GB",
        position: "Forward",
        natural_position: "Forward",
        alternate_positions: [],
        training_focus: null,
        attributes: {
            pace: 60,
            engine: 61,
            power: 62,
            agility: 63,
            passing: 64,
            finishing: 65,
            defending: 66,
            touch: 67,
            anticipation: 69,
            vision: 70,
            decisions: 71,
            composure: 72,
            leadership: 75,
            shot_stopping: 76,
            aerial: 78,
            burst: 50,
            distribution: 50,
            commanding: 50,
            playing_out: 50,
},
        condition: 80,
        morale: 75,
        injury: null,
        team_id: "team-1",
        retired: false,
        contract_end: "2026-10-15",
        wage: 12000,
        market_value: 350000,
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

describe("PlayerProfile.attributes", () => {
    it("builds the standard outfield attribute groups with averages", () => {
        const groups = buildPlayerAttributeGroups(createPlayer(), (key) => key);

        expect(groups.map((group) => group.label)).toEqual([
            "common.attrGroups.physical",
            "common.attrGroups.technical",
            "common.attrGroups.mental",
        ]);
        // Physical: pace, burst, engine, power, agility (5 attrs)
        expect(groups[0]?.attrs).toHaveLength(5);
        expect(groups[0]?.average).toBe(59);
        // Technical: passing, distribution, touch, finishing, defending, aerial (6 attrs)
        expect(groups[1]?.attrs).toHaveLength(6);
        expect(groups[1]?.average).toBe(65);
        // Mental (The Head): anticipation, vision, decisions, composure,
        // edge, team_ethic, leadership, stability, morale (9 attrs)
        expect(groups[2]?.attrs).toHaveLength(9);
        expect(groups[2]?.average).toBe(65);
    });

    it("adds the goalkeeper-specific group for goalkeepers", () => {
        const groups = buildPlayerAttributeGroups(
            createPlayer({ position: "Goalkeeper", natural_position: "Goalkeeper" }),
            (key) => key,
        );

        expect(groups).toHaveLength(4);
        expect(groups[3]).toMatchObject({
            label: "common.attrGroups.goalkeeper",
        });
        // GK group: shot_stopping, commanding, playing_out (3 attrs, no
        // more duplicate shot_stopping).
        expect(groups[3]?.attrs.map((attr) => attr.name)).toEqual([
            "common.attributes.shot_stopping",
            "common.attributes.commanding",
            "common.attributes.playing_out",
        ]);
        // Average = (76 + 50 + 50) / 3 = 58.67 → 59
        expect(groups[3]?.average).toBe(59);
    });

    it("uses stability_modifier + morale from the player for the hidden attributes", () => {
        const groups = buildPlayerAttributeGroups(
            createPlayer({ stability_modifier: 88, morale: 30 }),
            (key) => key,
        );
        const mental = groups[2]?.attrs ?? [];
        const stability = mental.find((a) => a.name === "common.attributes.stability");
        const morale = mental.find((a) => a.name === "common.attributes.morale");
        expect(stability?.value).toBe(88);
        expect(morale?.value).toBe(30);
    });

    it("uses personality.neuroticism + agreeableness for Edge + Team Ethic", () => {
        const groups = buildPlayerAttributeGroups(
            createPlayer({
                personality: {
                    openness: 50,
                    conscientiousness: 50,
                    extraversion: 50,
                    agreeableness: 80,
                    neuroticism: 25,
                    confidence: 60,
                },
            }),
            (key) => key,
        );
        const mental = groups[2]?.attrs ?? [];
        const edge = mental.find((a) => a.name === "common.attributes.edge");
        const teamEthic = mental.find((a) => a.name === "common.attributes.team_ethic");
        expect(edge?.value).toBe(25);
        expect(teamEthic?.value).toBe(80);
    });
});