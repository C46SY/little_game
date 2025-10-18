export interface PoemContent {
    lines: string[][];
    lineLength: number;
    totalCharacters: number;
}

const STRIP_REGEX = /[，。！？；、,.\s]/g;

export function parsePoemText(raw: string, meterHint?: number): PoemContent {
    const rawLines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const sanitizedLines = rawLines.map((line) => line.replace(STRIP_REGEX, ''));
    const lines = sanitizedLines
        .filter((line) => line.length > 0)
        .map((line) => Array.from(line));

    const defaultMeter = lines.length > 0 ? lines[0].length : 0;
    const lineLength = meterHint && meterHint > 0 ? meterHint : defaultMeter;
    const totalCharacters = lines.reduce((sum, line) => sum + line.length, 0);

    return {
        lines,
        lineLength,
        totalCharacters
    };
}
