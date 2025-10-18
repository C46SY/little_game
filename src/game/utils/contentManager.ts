export type DifficultyMode = 'numeric' | 'poem';

export interface DifficultyDefinition {
    id: string;
    label: string;
    mode: DifficultyMode;
    source?: string;
    title?: string;
    description?: string;
}

export interface DifficultyConfig {
    defaultDifficulty?: string;
    items: DifficultyDefinition[];
}

export interface PoemLine {
    original: string;
    characters: string[];
}

export interface PoemContent {
    title?: string;
    lines: PoemLine[];
    lineLength: number;
}

export interface SequenceToken {
    order: number;
    label: string;
    group: number;
    indexInGroup: number;
}

export interface DifficultyContent {
    definition: DifficultyDefinition;
    mode: DifficultyMode;
    tokens: SequenceToken[];
    groups: SequenceToken[][];
    poem?: PoemContent;
}

const CONFIG_PATH = 'assets/content/difficulties.json';
const NUMERIC_TARGET_TOTAL = 20;

let configCache: DifficultyConfig | null = null;
let configPromise: Promise<DifficultyConfig> | null = null;
const poemCache = new Map<string, Promise<PoemContent>>();

export async function loadDifficultyConfig(): Promise<DifficultyConfig> {
    if (configCache) {
        return configCache;
    }

    if (!configPromise) {
        configPromise = fetch(CONFIG_PATH)
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`无法加载难度配置：${response.status} ${response.statusText}`);
                }

                const data = await response.json() as DifficultyConfig;
                if (!data.items || !Array.isArray(data.items)) {
                    throw new Error('难度配置文件格式错误：缺少 items 列表');
                }

                configCache = {
                    defaultDifficulty: data.defaultDifficulty,
                    items: data.items.map(normalizeDefinition)
                };

                return configCache;
            })
            .catch((error) => {
                configPromise = null;
                throw error;
            });
    }

    if (!configPromise) {
        throw new Error('未能加载难度配置');
    }

    return configPromise;
}

export async function loadDifficultyContent(requestedId?: string): Promise<DifficultyContent> {
    const config = await loadDifficultyConfig();
    const fallbackId = config.defaultDifficulty ?? config.items[0]?.id;
    if (!fallbackId) {
        throw new Error('难度配置为空，请先在资源目录中添加配置。');
    }

    const definition = findDifficultyDefinition(config.items, requestedId) ?? findDifficultyDefinition(config.items, fallbackId);
    if (!definition) {
        throw new Error(`无法找到指定难度：${requestedId ?? '(未指定)'}`);
    }

    if (definition.mode === 'numeric') {
        return buildNumericContent(definition);
    }

    return buildPoemContent(definition);
}

function findDifficultyDefinition(definitions: DifficultyDefinition[], id?: string): DifficultyDefinition | undefined {
    if (!id) {
        return undefined;
    }
    return definitions.find((item) => item.id === id);
}

function normalizeDefinition(input: DifficultyDefinition): DifficultyDefinition {
    const label = input.label?.trim() || input.id;
    const mode = input.mode === 'poem' ? 'poem' : 'numeric';
    return {
        id: input.id,
        label,
        mode,
        source: input.source,
        title: input.title?.trim() || undefined,
        description: input.description?.trim() || undefined
    };
}

function buildNumericContent(definition: DifficultyDefinition): DifficultyContent {
    const tokens: SequenceToken[] = [];
    for (let order = 1; order <= NUMERIC_TARGET_TOTAL; order += 1) {
        tokens.push({
            order,
            label: order.toString(),
            group: 0,
            indexInGroup: order - 1
        });
    }

    return {
        definition,
        mode: 'numeric',
        tokens,
        groups: []
    };
}

async function buildPoemContent(definition: DifficultyDefinition): Promise<DifficultyContent> {
    if (!definition.source) {
        throw new Error(`难度 ${definition.id} 缺少诗词资源文件路径 source`);
    }

    const poem = await loadPoem(definition.source, definition.title ?? definition.label);
    const tokens: SequenceToken[] = [];
    const groups: SequenceToken[][] = [];

    let order = 1;
    poem.lines.forEach((line, lineIndex) => {
        const group: SequenceToken[] = [];
        line.characters.forEach((char, charIndex) => {
            const token: SequenceToken = {
                order,
                label: char,
                group: lineIndex,
                indexInGroup: charIndex
            };
            tokens.push(token);
            group.push(token);
            order += 1;
        });
        if (group.length > 0) {
            groups.push(group);
        }
    });

    return {
        definition,
        mode: 'poem',
        tokens,
        groups,
        poem
    };
}

async function loadPoem(path: string, title?: string): Promise<PoemContent> {
    let promise = poemCache.get(path);
    if (!promise) {
        promise = fetch(path)
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`无法加载诗词文件 ${path}：${response.status} ${response.statusText}`);
                }
                const text = await response.text();
                return parsePoemCsv(text, title);
            })
            .catch((error) => {
                poemCache.delete(path);
                throw error;
            });
        poemCache.set(path, promise);
    }

    return promise;
}

function parsePoemCsv(raw: string, title?: string): PoemContent {
    const lines: PoemLine[] = [];
    const rawLines = raw.split(/\r?\n/);
    rawLines.forEach((entry) => {
        const trimmed = entry.trim();
        if (!trimmed) {
            return;
        }

        const withoutBom = trimmed.replace(/^\ufeff/, '');
        const withoutQuotes = withoutBom.replace(/^"|"$/g, '');
        const withoutTrailingCommas = withoutQuotes.replace(/[，,]+$/g, '');
        const cleaned = withoutTrailingCommas.replace(/[，,。．\.！？!？；;：:、\s]+/g, '');

        if (!cleaned) {
            return;
        }

        const characters = Array.from(cleaned);
        lines.push({
            original: cleaned,
            characters
        });
    });

    if (lines.length === 0) {
        throw new Error('诗词文件内容为空或格式不正确');
    }

    const lineLength = lines[0].characters.length;

    return {
        title,
        lines,
        lineLength
    };
}
