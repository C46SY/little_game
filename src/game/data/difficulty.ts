export type DifficultyKey = 'demo' | 'easy' | 'medium' | 'hard';

export interface DifficultyInfo {
    key: DifficultyKey;
    label: string;
    description: string;
    dataPath: string | null;
}

const difficultyDetails: Record<DifficultyKey, DifficultyInfo> = {
    demo: {
        key: 'demo',
        label: 'Demo',
        description: '数字顺序练习模式',
        dataPath: null
    },
    easy: {
        key: 'easy',
        label: '简单',
        description: '五言古诗练习',
        dataPath: 'poems/easy/index.json'
    },
    medium: {
        key: 'medium',
        label: '中等',
        description: '七言古诗挑战',
        dataPath: 'poems/medium/index.json'
    },
    hard: {
        key: 'hard',
        label: '困难',
        description: '多句长篇诗词',
        dataPath: 'poems/hard/index.json'
    }
};

export const DIFFICULTY_ORDER: DifficultyKey[] = ['demo', 'easy', 'medium', 'hard'];

export function getDifficultyInfo(key: DifficultyKey): DifficultyInfo {
    return difficultyDetails[key];
}

export function getDifficultyLabel(key: DifficultyKey): string {
    return difficultyDetails[key].label;
}

export function getDifficultyDescription(key: DifficultyKey): string {
    return difficultyDetails[key].description;
}

export function getDifficultyDataPath(key: DifficultyKey): string | null {
    return difficultyDetails[key].dataPath;
}
