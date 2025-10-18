import Phaser from 'phaser';

export type DifficultyId = string;

type DifficultyMode = 'numbers' | 'poem';

export interface DifficultyDefinition {
    id: DifficultyId;
    label: string;
    mode: DifficultyMode;
    maxValue: number;
    initialBeans: number;
    resource?: string;
    title?: string;
    author?: string;
    description?: string;
    meterHint?: number;
}

interface RawDifficultyDefinition {
    label?: string;
    mode?: DifficultyMode;
    maxValue?: number;
    initialBeans?: number;
    resource?: string;
    title?: string;
    author?: string;
    description?: string;
    meter?: number;
}

interface DifficultyConfigFile {
    order?: DifficultyId[];
    difficulties?: Record<string, RawDifficultyDefinition>;
}

function getConfig(scene: Phaser.Scene): DifficultyConfigFile {
    const raw = scene.cache.json.get('difficulty-config') as DifficultyConfigFile | undefined;
    if (!raw) {
        throw new Error('Difficulty configuration is missing. Ensure difficulties.json is loaded in the Preloader scene.');
    }
    return raw;
}

function normaliseDefinition(id: DifficultyId, raw: RawDifficultyDefinition | undefined): DifficultyDefinition {
    if (!raw) {
        throw new Error(`Difficulty definition for "${id}" is missing.`);
    }

    const mode = raw.mode ?? 'numbers';
    const label = raw.label ?? id;
    const maxValue = raw.maxValue ?? 20;
    const initialBeans = raw.initialBeans ?? 3;
    const meterHint = raw.meter;

    return {
        id,
        label,
        mode,
        maxValue,
        initialBeans,
        resource: raw.resource,
        title: raw.title,
        author: raw.author,
        description: raw.description,
        meterHint
    };
}

export function getDifficultyList(scene: Phaser.Scene): DifficultyDefinition[] {
    const config = getConfig(scene);
    const entries = config.difficulties ?? {};
    const order = config.order && config.order.length > 0 ? config.order : Object.keys(entries);

    const seen = new Set<string>();
    const result: DifficultyDefinition[] = [];

    for (const id of order) {
        if (seen.has(id)) {
            continue;
        }
        const definition = entries[id];
        if (!definition) {
            continue;
        }
        result.push(normaliseDefinition(id, definition));
        seen.add(id);
    }

    for (const [id, definition] of Object.entries(entries)) {
        if (!seen.has(id)) {
            result.push(normaliseDefinition(id, definition));
        }
    }

    return result;
}

export function getDifficulty(scene: Phaser.Scene, id: DifficultyId): DifficultyDefinition {
    const config = getConfig(scene);
    const definition = config.difficulties?.[id];
    return normaliseDefinition(id, definition);
}
