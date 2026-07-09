import type { PlayerData } from "../../store/gameStore";

type TranslateFn = (key: string) => string;

export interface PlayerAttributeEntry {
    name: string;
    value: number;
}

export interface PlayerAttributeGroup {
    label: string;
    attrs: PlayerAttributeEntry[];
    average: number;
}

function createAttributeGroup(
    label: string,
    attrs: PlayerAttributeEntry[],
): PlayerAttributeGroup {
    return {
        label,
        attrs,
        average: Math.round(
            attrs.reduce((sum, attribute) => sum + attribute.value, 0) / attrs.length,
        ),
    };
}

export function buildPlayerAttributeGroups(
    player: PlayerData,
    translate: TranslateFn,
): PlayerAttributeGroup[] {
    const groups: PlayerAttributeGroup[] = [
        createAttributeGroup(translate("common.attrGroups.physical"), [
            { name: translate("common.attributes.pace"), value: player.attributes.pace },
            {
                name: translate("common.attributes.burst"),
                value: player.attributes.burst,
            },
            {
                name: translate("common.attributes.engine"),
                value: player.attributes.engine,
            },
            {
                name: translate("common.attributes.power"),
                value: player.attributes.power,
            },
            {
                name: translate("common.attributes.agility"),
                value: player.attributes.agility,
            },
        ]),
        createAttributeGroup(translate("common.attrGroups.technical"), [
            {
                name: translate("common.attributes.passing"),
                value: player.attributes.passing,
            },
            {
                name: translate("common.attributes.distribution"),
                value: player.attributes.distribution,
            },
            {
                name: translate("common.attributes.touch"),
                value: player.attributes.touch,
            },
            {
                name: translate("common.attributes.finishing"),
                value: player.attributes.finishing,
            },
            {
                name: translate("common.attributes.defending"),
                value: player.attributes.defending,
            },
            {
                name: translate("common.attributes.aerial"),
                value: player.attributes.aerial,
            },
        ]),
        createAttributeGroup(translate("common.attrGroups.mental"), [
            // "The Head" — reframed from clinical personality terms into
            // footie language. The underlying attribute values are the
            // same engine values; only the display name changes.
            {
                name: translate("common.attributes.anticipation"),
                value: player.attributes.anticipation,
            },
            {
                name: translate("common.attributes.vision"),
                value: player.attributes.vision,
            },
            {
                name: translate("common.attributes.decisions"),
                value: player.attributes.decisions,
            },
            {
                name: translate("common.attributes.composure"),
                value: player.attributes.composure,
            },
            // The Head — rebranded from clinical personality terms:
            //   - "Edge" was "Neuroticism" → now the player's fire, temper,
            //     will-to-win. The engine derives aggression from neuroticism
            //     on the Rust side; we display the raw value with new framing.
            //   - "Team Ethic" was "Agreeableness" → willingness to track
            //     back, work for the shirt, put the team first.
            {
                name: translate("common.attributes.edge"),
                value: player.personality?.neuroticism ?? 50,
            },
            {
                name: translate("common.attributes.team_ethic"),
                value: player.personality?.agreeableness ?? 50,
            },
            {
                name: translate("common.attributes.leadership"),
                value: player.attributes.leadership,
            },
            // Stability + Morale — the "hidden" attributes. The manager
            // can see them on their own players but scouting reports
            // obscure them for rivals. The Gaffer voice reframes them
            // as observable behaviour (ice-cold, flying, etc.) not
            // clinical scores.
            {
                name: translate("common.attributes.stability"),
                value: player.stability_modifier ?? 50,
            },
            {
                name: translate("common.attributes.morale"),
                value: player.morale ?? 75,
            },
        ]),
    ];

    if (player.position === "Goalkeeper") {
        groups.push(
            createAttributeGroup(translate("common.attrGroups.goalkeeper"), [
                {
                    name: translate("common.attributes.shot_stopping"),
                    value: player.attributes.shot_stopping,
                },
                {
                    name: translate("common.attributes.commanding"),
                    value: player.attributes.commanding,
                },
                {
                    name: translate("common.attributes.playing_out"),
                    value: player.attributes.playing_out,
                },
            ]),
        );
    }

    return groups;
}