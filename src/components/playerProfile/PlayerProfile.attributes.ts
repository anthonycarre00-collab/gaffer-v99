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
                name: translate("common.attributes.finishing"),
                value: player.attributes.finishing,
            },
            {
                name: translate("common.attributes.defending"),
                value: player.attributes.defending,
            },
            {
                name: translate("common.attributes.touch"),
                value: player.attributes.touch,
            },
            {
                name: translate("common.attributes.defending"),
                value: player.attributes.defending,
            },
        ]),
        createAttributeGroup(translate("common.attrGroups.mental"), [
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
            {
                name: translate("common.personality.neuroticism"),
                value: player.personality?.neuroticism ?? 50,
            },
            {
                name: translate("common.personality.agreeableness"),
                value: player.personality?.agreeableness ?? 50,
            },
            {
                name: translate("common.attributes.leadership"),
                value: player.attributes.leadership,
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
                    name: translate("common.attributes.shot_stopping"),
                    value: player.attributes.shot_stopping,
                },
                {
                    name: translate("common.attributes.aerial"),
                    value: player.attributes.aerial,
                },
            ]),
        );
    }

    return groups;
}