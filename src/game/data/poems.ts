import Phaser from 'phaser';
import { DifficultyKey, getDifficultyDataPath } from './difficulty';

export type PoemMeter = 5 | 7;

export interface PoemDefinition {
    id: string;
    title: string;
    author?: string;
    meter: PoemMeter;
    lines: string[];
}

const PUNCTUATION_REGEXP = /[，,。\.！!？?、；;：:\-\s“”"'‘’()（）《》<>·…—\u3000]/g;

export function loadPoemsFromCache(scene: Phaser.Scene, difficulty: DifficultyKey): PoemDefinition[] {
    const dataPath = getDifficultyDataPath(difficulty);
    if (!dataPath) {
        return [];
    }

    const cacheKey = getPoemCacheKey(difficulty);
    const raw = scene.cache.text.get(cacheKey) as string | undefined;
    if (!raw) {
        console.warn(`[poems] 未能在缓存中找到诗词数据：${cacheKey}`);
        return [];
    }

    return parsePoemCsv(raw);
}

export function getPoemCacheKey(difficulty: DifficultyKey): string {
    return `poems-${difficulty}`;
}

export function parsePoemCsv(raw: string): PoemDefinition[] {
    const lines = raw.replace(/\ufeff/g, '').split(/\r?\n/).map((line) => line.trim());
    if (lines.length === 0) {
        return [];
    }

    const result: PoemDefinition[] = [];

    let startIndex = 0;
    if (lines.length > 0 && lines[0].toLowerCase().startsWith('title')) {
        startIndex = 1;
    }

    let poemIndex = 0;

    for (let index = startIndex; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line || line.startsWith('#')) {
            continue;
        }

        const values = parseCsvLine(line);
        if (values.length < 4) {
            continue;
        }

        const [title, authorOrMeter, maybeMeter, ...content] = values;
        let author = '';
        let meterValue: number | null = null;
        let lineValues: string[] = [];

        if (isMeter(authorOrMeter)) {
            meterValue = Number.parseInt(authorOrMeter, 10);
            lineValues = [maybeMeter, ...content];
        } else {
            author = authorOrMeter;
            if (isMeter(maybeMeter)) {
                meterValue = Number.parseInt(maybeMeter, 10);
                lineValues = content;
            } else {
                lineValues = [maybeMeter, ...content];
            }
        }

        if (!meterValue) {
            const inferred = inferMeterFromLine(lineValues[0]);
            meterValue = inferred ?? 5;
        }

        const sanitizedLines = lineValues
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
            .map((value) => value.replace(/\s+/g, ''));

        if (sanitizedLines.length === 0) {
            continue;
        }

        const id = createPoemId(title, author, poemIndex);
        poemIndex += 1;

        result.push({
            id,
            title: title || '未命名',
            author: author || undefined,
            meter: (meterValue === 7 ? 7 : 5),
            lines: sanitizedLines
        });
    }

    return result;
}

function createPoemId(title: string, author: string | undefined, index: number): string {
    const safeTitle = sanitizeIdentifier(title || 'untitled');
    const safeAuthor = sanitizeIdentifier(author || 'unknown');
    return `${safeTitle}-${safeAuthor}-${index}`;
}

function sanitizeIdentifier(raw: string): string {
    if (!raw) {
        return 'unknown';
    }
    return raw
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'unknown';
}

function parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    if (current.length > 0 || line.endsWith(',')) {
        values.push(current.trim());
    }

    return values;
}

function isMeter(value: string | undefined): value is '5' | '7' {
    return value === '5' || value === '7';
}

function inferMeterFromLine(line: string | undefined): PoemMeter | null {
    if (!line) {
        return null;
    }
    const characters = Array.from(line.replace(PUNCTUATION_REGEXP, ''));
    if (characters.length === 7) {
        return 7;
    }
    if (characters.length === 5) {
        return 5;
    }
    return null;
}

export function extractCharacters(line: string, meter: PoemMeter): string[] {
    const characters = Array.from(line.replace(PUNCTUATION_REGEXP, ''));
    if (characters.length === 0) {
        return [];
    }
    if (characters.length !== meter) {
        return characters;
    }
    return characters;
}
