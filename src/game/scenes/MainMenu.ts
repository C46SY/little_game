import Phaser from 'phaser';
import {
    DIFFICULTY_ORDER,
    DifficultyKey,
    getDifficultyDescription,
    getDifficultyLabel
} from '../data/difficulty';
import { loadPoemsFromCache, PoemDefinition } from '../data/poems';

export class MainMenu extends Phaser.Scene {
    private difficultyTexts: Map<DifficultyKey, Phaser.GameObjects.Text> = new Map();
    private selectedDifficulty: DifficultyKey = 'easy';
    private poemSelectionTexts: Phaser.GameObjects.Text[] = [];
    private poemSelections: Map<DifficultyKey, number | null> = new Map();
    private poemsByDifficulty: Map<DifficultyKey, PoemDefinition[]> = new Map();
    private poemListTitle!: Phaser.GameObjects.Text;
    private poemListHint!: Phaser.GameObjects.Text;
    private startButton!: Phaser.GameObjects.Text;

    constructor() {
        super('MainMenu');
    }

    public create(): void {
        const { width, height } = this.scale;

        const storedDifficulty = this.registry.get('difficulty') as DifficultyKey | undefined;
        this.selectedDifficulty = storedDifficulty ?? 'easy';
        this.registry.set('difficulty', this.selectedDifficulty);

        this.initializePoemData();

        this.add.image(width / 2, height / 2, 'playfield');

        this.add.text(width / 2, height * 0.22, 'Making Studio', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 48,
            color: '#2c3e50',
            align: 'center'
        }).setOrigin(0.5)
            .setShadow(3, 3, 'rgba(154, 208, 245, 0.6)', 0, true, true)
            .setStroke('#ffffff', 8);

        this.add.text(width / 2, height * 0.42, '快乐小蛇', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 64,
            color: '#2c3e50',
            align: 'center'
        }).setOrigin(0.5)
            .setShadow(4, 4, 'rgba(154, 208, 245, 0.6)', 0, true, true)
            .setStroke('#ffffff', 12);

        this.startButton = this.createMenuButton(width / 2, height * 0.58, '开始游戏', () => {
            if (this.canStartGame()) {
                this.startSelectedGame();
            }
        });

        const difficultyHeader = this.add.text(width / 2, height * 0.68, '难度选择', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 36,
            color: '#2c3e50',
            align: 'center',
            backgroundColor: 'rgba(255,255,255,0.9)'
        }).setOrigin(0.5);
        difficultyHeader.setPadding(24, 14, 24, 14);
        difficultyHeader.setShadow(3, 3, 'rgba(154, 208, 245, 0.5)', 0, true, true);

        let optionY = difficultyHeader.y + 70;
        DIFFICULTY_ORDER.forEach((key) => {
            const label = `${getDifficultyLabel(key)}｜${getDifficultyDescription(key)}`;
            const option = this.add.text(width / 2, optionY, label, {
                fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
                fontSize: 28,
                color: '#2c3e50',
                align: 'center',
                backgroundColor: 'rgba(255,255,255,0.8)'
            }).setOrigin(0.5);
            option.setPadding(24, 10, 24, 10);
            option.setShadow(2, 2, 'rgba(154, 208, 245, 0.4)', 0, true, true);
            option.setInteractive({ useHandCursor: true });
            option.on('pointerdown', () => this.selectDifficulty(key));
            option.on('pointerover', () => option.setStyle({ backgroundColor: 'rgba(255, 241, 214, 0.95)' }));
            option.on('pointerout', () => this.updateDifficultyHighlights());
            this.difficultyTexts.set(key, option);
            optionY += 56;
        });

        this.updateDifficultyHighlights();

        this.poemListTitle = this.add.text(width / 2, height * 0.68 + 220, '古诗词选择', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 34,
            color: '#2c3e50',
            align: 'center',
            backgroundColor: 'rgba(255,255,255,0.9)'
        }).setOrigin(0.5);
        this.poemListTitle.setPadding(28, 16, 28, 16);
        this.poemListTitle.setShadow(3, 3, 'rgba(154, 208, 245, 0.5)', 0, true, true);

        this.poemListHint = this.add.text(width / 2, this.poemListTitle.y + 64, '', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 26,
            color: '#2c3e50',
            align: 'center',
            backgroundColor: 'rgba(255,255,255,0.85)'
        }).setOrigin(0.5);
        this.poemListHint.setPadding(24, 12, 24, 12);
        this.poemListHint.setShadow(2, 2, 'rgba(154, 208, 245, 0.4)', 0, true, true);

        const keyboard = this.input.keyboard;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Enter' || event.code === 'Space') {
                if (this.canStartGame()) {
                    this.startSelectedGame();
                }
            }
        };
        keyboard?.on('keydown', handleKeyDown);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            keyboard?.off('keydown', handleKeyDown);
        });

        this.updatePoemList();
        this.updateStartButtonState();
    }

    private createMenuButton(x: number, y: number, text: string, callback: () => void): Phaser.GameObjects.Text {
        const button = this.add.text(x, y, text, {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 40,
            color: '#ffffff',
            align: 'center',
            backgroundColor: '#ff8c69'
        }).setOrigin(0.5);
        button.setPadding(36, 18, 36, 18);
        button.setShadow(3, 3, 'rgba(255, 166, 201, 0.6)', 0, true, true);
        button.setStroke('#ffced6', 6);
        button.setInteractive({ useHandCursor: true });
        button.on('pointerdown', callback);
        button.on('pointerover', () => button.setStyle({ backgroundColor: '#ffad86' }));
        button.on('pointerout', () => button.setStyle({ backgroundColor: '#ff8c69' }));
        return button;
    }

    private selectDifficulty(key: DifficultyKey): void {
        this.selectedDifficulty = key;
        this.registry.set('difficulty', key);
        this.updateDifficultyHighlights();
        this.updatePoemList();
        this.updateStartButtonState();
    }

    private updateDifficultyHighlights(): void {
        this.difficultyTexts.forEach((text, key) => {
            if (key === this.selectedDifficulty) {
                text.setStyle({
                    color: '#d35400',
                    backgroundColor: 'rgba(255, 241, 214, 0.95)'
                });
            } else {
                text.setStyle({
                    color: '#2c3e50',
                    backgroundColor: 'rgba(255,255,255,0.8)'
                });
            }
        });
    }

    private updatePoemList(): void {
        this.poemSelectionTexts.forEach((text) => text.destroy());
        this.poemSelectionTexts = [];

        const { width } = this.scale;
        const poems = this.poemsByDifficulty.get(this.selectedDifficulty) ?? [];
        const storedIndex = this.poemSelections.get(this.selectedDifficulty) ?? null;

        if (this.selectedDifficulty === 'demo') {
            this.poemListHint.setText('数字练习模式无需选择古诗词。');
            this.poemSelections.set('demo', null);
            this.savePoemSelections();
            this.updateStartButtonState();
            return;
        }

        if (poems.length === 0) {
            this.poemListHint.setText('暂未添加古诗词，请稍后在配置中补充。');
            this.poemSelections.set(this.selectedDifficulty, null);
            this.savePoemSelections();
            this.updateStartButtonState();
            return;
        }

        this.poemListHint.setText('请选择想要挑战的古诗词：');

        let baseY = this.poemListHint.y + 70;
        const centerX = width / 2;

        const activeIndex = storedIndex !== null && storedIndex >= 0 && storedIndex < poems.length
            ? storedIndex
            : 0;
        this.poemSelections.set(this.selectedDifficulty, activeIndex);
        this.savePoemSelections();

        poems.forEach((poem, index) => {
            const label = poem.author
                ? `《${poem.title}》 · ${poem.author}`
                : `《${poem.title}》`;
            const option = this.add.text(centerX, baseY, label, {
                fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
                fontSize: 28,
                color: '#2c3e50',
                align: 'center',
                backgroundColor: 'rgba(255,255,255,0.85)'
            }).setOrigin(0.5);
            option.setPadding(24, 10, 24, 10);
            option.setShadow(2, 2, 'rgba(154, 208, 245, 0.4)', 0, true, true);
            option.setInteractive({ useHandCursor: true });
            option.on('pointerdown', () => this.selectPoem(index));
            option.on('pointerover', () => option.setStyle({ backgroundColor: 'rgba(255, 241, 214, 0.95)' }));
            option.on('pointerout', () => this.updatePoemHighlights());
            this.poemSelectionTexts.push(option);
            baseY += 56;
        });

        this.updatePoemHighlights();
        this.updateStartButtonState();
    }

    private updatePoemHighlights(): void {
        const selected = this.poemSelections.get(this.selectedDifficulty);
        this.poemSelectionTexts.forEach((text, index) => {
            if (index === selected) {
                text.setStyle({
                    color: '#d35400',
                    backgroundColor: 'rgba(255, 241, 214, 0.95)'
                });
            } else {
                text.setStyle({
                    color: '#2c3e50',
                    backgroundColor: 'rgba(255,255,255,0.85)'
                });
            }
        });
    }

    private selectPoem(index: number): void {
        this.poemSelections.set(this.selectedDifficulty, index);
        this.savePoemSelections();
        this.updatePoemHighlights();
        this.updateStartButtonState();
    }

    private canStartGame(): boolean {
        if (this.selectedDifficulty === 'demo') {
            return true;
        }
        const selection = this.poemSelections.get(this.selectedDifficulty);
        if (selection === null || selection === undefined) {
            return false;
        }
        const poems = this.poemsByDifficulty.get(this.selectedDifficulty) ?? [];
        return selection >= 0 && selection < poems.length;
    }

    private updateStartButtonState(): void {
        const enabled = this.canStartGame();
        this.startButton.setAlpha(enabled ? 1 : 0.6);
        this.startButton.setStyle({
            backgroundColor: enabled ? '#ff8c69' : '#d7d7d7',
            color: enabled ? '#ffffff' : '#7f8c8d'
        });
        this.startButton.disableInteractive();
        if (enabled) {
            this.startButton.setInteractive({ useHandCursor: true });
        }
    }

    private initializePoemData(): void {
        const storedSelections = this.registry.get('poemSelections') as Record<string, number> | undefined;
        DIFFICULTY_ORDER.forEach((difficulty) => {
            const poems = loadPoemsFromCache(this, difficulty);
            this.poemsByDifficulty.set(difficulty, poems);
            const storedIndex = storedSelections?.[difficulty] ?? null;
            if (storedIndex !== null && storedIndex >= 0 && storedIndex < poems.length) {
                this.poemSelections.set(difficulty, storedIndex);
            } else if (poems.length > 0) {
                this.poemSelections.set(difficulty, 0);
            } else {
                this.poemSelections.set(difficulty, null);
            }
        });
        this.savePoemSelections();
    }

    private startSelectedGame(): void {
        const selection = this.poemSelections.get(this.selectedDifficulty);
        const poems = this.poemsByDifficulty.get(this.selectedDifficulty) ?? [];
        const poem = selection !== null && selection !== undefined ? poems[selection] : undefined;
        this.scene.start('Game', { difficulty: this.selectedDifficulty, poem });
    }

    private savePoemSelections(): void {
        this.registry.set('poemSelections', Object.fromEntries(this.poemSelections));
    }
}
