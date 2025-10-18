import { loadPoemFromSource, PoemData } from './poemLoader';

export const DEFAULT_DIFFICULTY_CONFIG_PATH = 'assets/data/difficulties.json';

export type DifficultyType = 'demo' | 'poem';

export interface BaseDifficultyDefinition {
    key: string;
    label: string;
    type: DifficultyType;
    description?: string;
}

export interface DemoDifficultyDefinition extends BaseDifficultyDefinition {
    type: 'demo';
    maxNumber?: number;
    initialBeans?: number;
}

export interface PoemDifficultyDefinition extends BaseDifficultyDefinition {
    type: 'poem';
    title?: string;
    source: string;
    meter?: number;
    author?: string;
}

export type DifficultyDefinition = DemoDifficultyDefinition | PoemDifficultyDefinition;

export interface DemoDifficultyRuntime extends BaseDifficultyDefinition {
    type: 'demo';
    maxNumber: number;
    initialBeans: number;
}

export interface PoemDifficultyRuntime extends BaseDifficultyDefinition {
    type: 'poem';
    title: string;
    meter: number;
    lines: string[][];
    originalLines: string[];
}

export type DifficultyRuntime = DemoDifficultyRuntime | PoemDifficultyRuntime;

interface DifficultyConfigFileEntry {
    label?: string;
    type: DifficultyType;
    description?: string;
    maxNumber?: number;
    initialBeans?: number;
    title?: string;
    source?: string;
    meter?: number;
    author?: string;
}

export async function loadDifficultyDefinitions(
    path: string = DEFAULT_DIFFICULTY_CONFIG_PATH
): Promise<DifficultyDefinition[]> {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`无法加载难度配置: ${response.status}`);
    }

    const raw = (await response.json()) as Record<string, DifficultyConfigFileEntry>;
    return Object.entries(raw).map(([key, entry]) => {
        const label = entry.label ?? key;
        if (entry.type === 'poem') {
            if (!entry.source) {
                throw new Error(`诗词难度“${label}”缺少素材文件路径`);
            }
            const definition: PoemDifficultyDefinition = {
                key,
                type: 'poem',
                label,
                description: entry.description ?? entry.author,
                title: entry.title ?? label,
                source: entry.source,
                meter: entry.meter
            };
            return definition;
        }

        const definition: DemoDifficultyDefinition = {
            key,
            type: 'demo',
            label,
            description: entry.description,
            maxNumber: entry.maxNumber,
            initialBeans: entry.initialBeans
        };
        return definition;
    });
}

export function createDemoRuntime(definition: DemoDifficultyDefinition): DemoDifficultyRuntime {
    return {
        ...definition,
        maxNumber: Math.max(1, definition.maxNumber ?? 20),
        initialBeans: Math.max(1, definition.initialBeans ?? 3)
    };
}

export async function createPoemRuntime(
    definition: PoemDifficultyDefinition
): Promise<PoemDifficultyRuntime> {
    const poemData: PoemData = await loadPoemFromSource(definition.source, definition.meter);
    return {
        ...definition,
        title: definition.title ?? definition.label,
        meter: poemData.meter,
        lines: poemData.lines,
        originalLines: poemData.originalLines
    };
}

export function isPoemDifficulty(
    definition: DifficultyDefinition
): definition is PoemDifficultyDefinition {
    return definition.type === 'poem';
}

export function isDemoDifficulty(
    definition: DifficultyDefinition
): definition is DemoDifficultyDefinition {
    return definition.type === 'demo';
}

export function createDefaultDemoRuntime(): DemoDifficultyRuntime {
    return {
        key: 'demo',
        type: 'demo',
        label: '演示',
        description: '按数字顺序吃豆的原始模式',
        maxNumber: 20,
        initialBeans: 3
    };
}
