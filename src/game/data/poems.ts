import Phaser from 'phaser';
import { DIFFICULTY_ORDER, DifficultyKey, getDifficultyDataPath } from './difficulty';

export type PoemMeter = 5 | 7;

export interface PoemDefinition {
    id: string;
    title: string;
    author?: string;
    meter: PoemMeter;
    lines: string[];
}

interface PoemMetadata {
    title: string;
    author?: string;
    content: string;
    meter?: number;
}

interface PoemIndexFile {
    poems?: PoemMetadata[];
}

const PUNCTUATION_REGEXP = /[，,。\.！!？?、；;：:\-\s“”"'‘’()（）《》<>·…—\u3000]/g;

const poemCache: Map<DifficultyKey, PoemDefinition[]> = new Map();
const loadingCache: Map<DifficultyKey, Promise<PoemDefinition[]>> = new Map();

export function loadPoemsFromCache(_scene: Phaser.Scene, difficulty: DifficultyKey): PoemDefinition[] {
    return poemCache.get(difficulty) ?? [];
}

export async function ensureAllPoemsLoaded(scene: Phaser.Scene): Promise<void> {
    const tasks = DIFFICULTY_ORDER.map((difficulty) => ensurePoemsLoaded(scene, difficulty));
    await Promise.all(tasks);
}

async function ensurePoemsLoaded(_scene: Phaser.Scene, difficulty: DifficultyKey): Promise<PoemDefinition[]> {
    if (poemCache.has(difficulty)) {
        return poemCache.get(difficulty)!;
    }

    const existingPromise = loadingCache.get(difficulty);
    if (existingPromise) {
        return existingPromise;
    }

    const promise = loadPoemsForDifficulty(_scene, difficulty)
        .finally(() => {
            loadingCache.delete(difficulty);
        });
    loadingCache.set(difficulty, promise);
    return promise;
}

async function loadPoemsForDifficulty(_scene: Phaser.Scene, difficulty: DifficultyKey): Promise<PoemDefinition[]> {
    const dataPath = getDifficultyDataPath(difficulty);
    if (!dataPath) {
        poemCache.set(difficulty, []);
        return [];
    }

    try {
        const meta = await fetchPoemIndex(dataPath);
        const basePath = extractBasePath(dataPath);
        const poems = meta.poems ?? [];
        const definitions: PoemDefinition[] = [];
        let poemIndex = 0;

        for (const entry of poems) {
            if (!entry.content) {
                console.warn(`[poems] 诗词内容路径缺失：${entry.title ?? '未命名'}`);
                continue;
            }

            const contentPath = resolveContentPath(basePath, entry.content);
            try {
                const text = await fetchPoemText(contentPath);
                const lines = parsePoemText(text);
                if (lines.length === 0) {
                    continue;
                }

                const meter = normalizeMeter(entry.meter, lines[0]);
                const id = createPoemId(entry.title, entry.author, poemIndex);
                poemIndex += 1;
                definitions.push({
                    id,
                    title: entry.title || '未命名',
                    author: entry.author || undefined,
                    meter,
                    lines
                });
            } catch (error) {
                console.warn(`[poems] 读取诗词内容失败：${contentPath}`, error);
            }
        }

        poemCache.set(difficulty, definitions);
        return definitions;
    } catch (error) {
        console.warn(`[poems] 读取诗词索引失败：${dataPath}`, error);
        poemCache.set(difficulty, []);
        return [];
    }
}

async function fetchPoemIndex(path: string): Promise<PoemIndexFile> {
    const response = await fetch(resolveAssetUrl(path));
    if (!response.ok) {
        throw new Error(`Failed to fetch poem index: ${response.status}`);
    }
    return response.json();
}

async function fetchPoemText(path: string): Promise<string> {
    const response = await fetch(resolveAssetUrl(path));
    if (!response.ok) {
        throw new Error(`Failed to fetch poem content: ${response.status}`);
    }
    return response.text();
}

function resolveAssetUrl(path: string): string {
    if (/^https?:\/\//.test(path)) {
        return path;
    }

    if (path.startsWith('/')) {
        return path;
    }

    const normalizedPath = path.replace(/^\/+/, '');
    const base = (import.meta.env.BASE_URL ?? '/');
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    return `${normalizedBase}assets/${normalizedPath}`;
}

function extractBasePath(path: string): string {
    const index = path.lastIndexOf('/');
    if (index === -1) {
        return '';
    }
    return path.slice(0, index + 1);
}

function resolveContentPath(basePath: string, content: string): string {
    if (!content) {
        return basePath;
    }

    if (/^https?:\/\//.test(content) || content.startsWith('/')) {
        return content;
    }

    return `${basePath}${content}`;
}

function parsePoemText(raw: string): string[] {
    return raw
        .replace(/\ufeff/g, '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => line.replace(/\s+/g, ''));
}

function normalizeMeter(meter: number | undefined, firstLine: string | undefined): PoemMeter {
    if (meter === 5 || meter === 7) {
        return meter;
    }
    const inferred = inferMeterFromLine(firstLine);
    return inferred ?? 5;
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

export async function preloadPoems(scene: Phaser.Scene, difficulty: DifficultyKey): Promise<void> {
    await ensurePoemsLoaded(scene, difficulty);
}

export async function preloadAllPoems(scene: Phaser.Scene): Promise<void> {
    await ensureAllPoemsLoaded(scene);
}
