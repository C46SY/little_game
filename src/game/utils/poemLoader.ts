const PUNCTUATION_REGEX = /[，。、“”"'‘’？！；：,\.\s]/gu;

export interface PoemData {
    lines: string[][];
    originalLines: string[];
    meter: number;
}

function splitLineToCharacters(line: string): string[] {
    const cleaned = line.replace(PUNCTUATION_REGEX, '');
    return Array.from(cleaned);
}

export async function loadPoemFromSource(source: string, expectedMeter?: number): Promise<PoemData> {
    const response = await fetch(source);
    if (!response.ok) {
        throw new Error(`无法加载诗词素材: ${response.status}`);
    }

    const text = await response.text();
    const rawLines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (rawLines.length === 0) {
        throw new Error('诗词文件为空');
    }

    const characterLines = rawLines.map((line) => splitLineToCharacters(line));
    const meter = expectedMeter ?? characterLines[0].length;

    if (meter !== 5 && meter !== 7) {
        throw new Error(`无法判定诗词是五言还是七言（检测到 ${meter} 个字）`);
    }

    characterLines.forEach((characters, index) => {
        if (characters.length !== meter) {
            throw new Error(`第 ${index + 1} 行字数 (${characters.length}) 与预期的 ${meter} 字不一致`);
        }
    });

    return {
        lines: characterLines,
        originalLines: rawLines,
        meter
    };
}
