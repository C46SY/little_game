import { DifficultyKey } from '../data/difficulty';
import { PoemDefinition, PoemMeter, extractCharacters } from '../data/poems';

export interface BeanToken {
    id: number;
    label: string;
    lineIndex: number;
    indexInLine: number;
    lineLength: number;
}

export interface BeanSequence {
    readonly difficulty: DifficultyKey;
    readonly totalTokens: number;
    readonly summary: string;
    reset(): void;
    requestTokens(currentBeansCount: number): BeanToken[];
    consume(token: BeanToken): boolean;
    isComplete(): boolean;
    getNextTokenLabel(): string | null;
    getLineProgress(): string | null;
    getConsumedCount(): number;
}

export class DemoSequence implements BeanSequence {
    public readonly difficulty: DifficultyKey = 'demo';
    public readonly totalTokens: number;
    public readonly summary: string;

    private readonly maxActiveTokens: number;
    private nextSpawnId = 1;
    private nextExpectedId = 1;
    private consumed = 0;

    constructor(totalTokens = 20, maxActiveTokens = 3) {
        this.totalTokens = totalTokens;
        this.maxActiveTokens = maxActiveTokens;
        this.summary = '数字顺序练习';
    }

    reset(): void {
        this.nextSpawnId = 1;
        this.nextExpectedId = 1;
        this.consumed = 0;
    }

    requestTokens(currentBeansCount: number): BeanToken[] {
        const tokens: BeanToken[] = [];
        while (currentBeansCount + tokens.length < this.maxActiveTokens && this.nextSpawnId <= this.totalTokens) {
            const id = this.nextSpawnId;
            tokens.push({
                id,
                label: id.toString(),
                lineIndex: 0,
                indexInLine: id - 1,
                lineLength: 1
            });
            this.nextSpawnId += 1;
        }
        return tokens;
    }

    consume(token: BeanToken): boolean {
        if (token.id !== this.nextExpectedId) {
            return false;
        }
        this.nextExpectedId += 1;
        this.consumed += 1;
        return true;
    }

    isComplete(): boolean {
        return this.consumed >= this.totalTokens;
    }

    getNextTokenLabel(): string | null {
        if (this.nextExpectedId > this.totalTokens) {
            return null;
        }
        return this.nextExpectedId.toString();
    }

    getLineProgress(): string | null {
        return null;
    }

    getConsumedCount(): number {
        return this.consumed;
    }
}

export class PoemSequence implements BeanSequence {
    public readonly difficulty: DifficultyKey;
    public readonly totalTokens: number;
    public readonly summary: string;

    private readonly meter: PoemMeter;
    private readonly tokensByLine: BeanToken[][];
    private readonly flatTokens: BeanToken[];

    private nextLineToSpawn = 0;
    private nextExpectedId = 1;
    private consumed = 0;
    private completedLines = 0;

    constructor(difficulty: DifficultyKey, poem: PoemDefinition) {
        this.difficulty = difficulty;
        this.meter = poem.meter;
        this.tokensByLine = buildTokens(poem);
        this.flatTokens = this.tokensByLine.flat();
        this.totalTokens = this.flatTokens.length;
        this.summary = poem.author
            ? `《${poem.title}》 · ${poem.author}`
            : `《${poem.title}》`;
    }

    reset(): void {
        this.nextLineToSpawn = 0;
        this.nextExpectedId = 1;
        this.consumed = 0;
        this.completedLines = 0;
    }

    requestTokens(currentBeansCount: number): BeanToken[] {
        if (currentBeansCount > 0) {
            return [];
        }
        if (this.nextLineToSpawn >= this.tokensByLine.length) {
            return [];
        }
        const tokens = this.tokensByLine[this.nextLineToSpawn];
        this.nextLineToSpawn += 1;
        return tokens.map((token) => ({ ...token }));
    }

    consume(token: BeanToken): boolean {
        if (token.id !== this.nextExpectedId) {
            return false;
        }
        this.nextExpectedId += 1;
        this.consumed += 1;
        if (token.indexInLine === token.lineLength - 1) {
            this.completedLines = Math.max(this.completedLines, token.lineIndex + 1);
        }
        return true;
    }

    isComplete(): boolean {
        return this.consumed >= this.totalTokens;
    }

    getNextTokenLabel(): string | null {
        const index = this.nextExpectedId - 1;
        if (index < 0 || index >= this.flatTokens.length) {
            return null;
        }
        return this.flatTokens[index].label;
    }

    getLineProgress(): string | null {
        if (this.tokensByLine.length === 0) {
            return null;
        }
        const currentLine = Math.min(this.completedLines + 1, this.tokensByLine.length);
        return `第${currentLine}句 / 共${this.tokensByLine.length}句 · ${this.meter}言`;
    }

    getConsumedCount(): number {
        return this.consumed;
    }
}

function buildTokens(poem: PoemDefinition): BeanToken[][] {
    const result: BeanToken[][] = [];
    let id = 1;
    for (let lineIndex = 0; lineIndex < poem.lines.length; lineIndex += 1) {
        const rawLine = poem.lines[lineIndex];
        const characters = extractCharacters(rawLine, poem.meter);
        const tokens: BeanToken[] = [];
        const lineLength = characters.length;
        for (let indexInLine = 0; indexInLine < characters.length; indexInLine += 1) {
            tokens.push({
                id,
                label: characters[indexInLine],
                lineIndex,
                indexInLine,
                lineLength
            });
            id += 1;
        }
        if (tokens.length > 0) {
            result.push(tokens);
        }
    }
    return result;
}
