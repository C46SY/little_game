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
    private poemListHeader!: Phaser.GameObjects.Text;
    private poemListTexts: Phaser.GameObjects.Text[] = [];
    private selectedPoemId: string | null = null;
    private poemSelections: Map<DifficultyKey, string | null> = new Map();
    private startButton!: Phaser.GameObjects.Text;
    private startButtonEnabled = true;

    constructor() {
        super('MainMenu');
    }

    public create(): void {
        const { width, height } = this.scale;

        const storedDifficulty = this.registry.get('difficulty') as DifficultyKey | undefined;
        const storedPoemId = this.registry.get('poemId') as string | null | undefined;
        this.selectedDifficulty = storedDifficulty ?? 'easy';
        this.registry.set('difficulty', this.selectedDifficulty);
        if (storedPoemId) {
            this.selectedPoemId = storedPoemId;
            this.poemSelections.set(this.selectedDifficulty, storedPoemId);
        }

        this.add.image(width / 2, height / 2, 'playfield');

        this.add.text(width / 2, height * 0.18, 'Making Studio', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 36,
            color: '#4a6fa5',
            align: 'center'
        })
            .setOrigin(0.5)
            .setShadow(3, 3, 'rgba(154, 208, 245, 0.5)', 0, true, true)
            .setStroke('#ffffff', 6);

        this.add.text(width / 2, height * 0.42, '快乐小蛇', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 64,
            color: '#2c3e50',
            align: 'center'
        }).setOrigin(0.5)
            .setShadow(4, 4, 'rgba(154, 208, 245, 0.6)', 0, true, true)
            .setStroke('#ffffff', 12);

        this.startButton = this.createMenuButton(width / 2, height * 0.58, '开始游戏', () => this.startSelectedGame());

        const difficultyX = width * 0.32;
        const poemsX = width * 0.68;
        const columnTop = height * 0.48;

        const difficultyHeader = this.add.text(difficultyX, columnTop, '难度选择', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 36,
            color: '#2c3e50',
            align: 'center',
            backgroundColor: 'rgba(255,255,255,0.9)'
        }).setOrigin(0.5);
        difficultyHeader.setPadding(24, 14, 24, 14);
        difficultyHeader.setShadow(3, 3, 'rgba(154, 208, 245, 0.5)', 0, true, true);

        this.poemListHeader = this.add.text(poemsX, columnTop, '诗词选择', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 36,
            color: '#2c3e50',
            align: 'center',
            backgroundColor: 'rgba(255,255,255,0.9)'
        }).setOrigin(0.5);
        this.poemListHeader.setPadding(24, 14, 24, 14);
        this.poemListHeader.setShadow(3, 3, 'rgba(154, 208, 245, 0.5)', 0, true, true);

        let optionY = difficultyHeader.y + 70;
        DIFFICULTY_ORDER.forEach((key) => {
            const label = `${getDifficultyLabel(key)}｜${getDifficultyDescription(key)}`;
            const option = this.add.text(difficultyX, optionY, label, {
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
        this.updatePoemList();

        const keyboard = this.input.keyboard;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Enter' || event.code === 'Space') {
                this.startSelectedGame();
            }
        };
        keyboard?.on('keydown', handleKeyDown);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            keyboard?.off('keydown', handleKeyDown);
        });
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
        button.on('pointerdown', () => {
            if (!this.startButtonEnabled) {
                return;
            }
            callback();
        });
        button.on('pointerover', () => {
            if (!this.startButtonEnabled) {
                return;
            }
            button.setStyle({ backgroundColor: '#ffad86' });
        });
        button.on('pointerout', () => {
            if (!this.startButtonEnabled) {
                return;
            }
            button.setStyle({ backgroundColor: '#ff8c69' });
        });
        return button;
    }

    private selectDifficulty(key: DifficultyKey): void {
        this.selectedDifficulty = key;
        this.registry.set('difficulty', key);
        this.selectedPoemId = this.poemSelections.get(key) ?? null;
        this.updateDifficultyHighlights();
        this.updatePoemList();
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

    private startSelectedGame(): void {
        if (!this.startButtonEnabled) {
            this.flashPoemList();
            return;
        }

        if (this.selectedDifficulty !== 'demo' && !this.selectedPoemId) {
            this.flashPoemList();
            return;
        }

        const data: { difficulty: DifficultyKey; poemId?: string | null } = {
            difficulty: this.selectedDifficulty
        };

        if (this.selectedDifficulty !== 'demo') {
            data.poemId = this.selectedPoemId;
        } else {
            data.poemId = null;
        }

        this.scene.start('Game', data);
    }

    private updatePoemList(): void {
        this.clearPoemList();

        const x = this.poemListHeader.x;
        const startY = this.poemListHeader.y + 60;

        if (this.selectedDifficulty === 'demo') {
            this.selectedPoemId = null;
            this.poemSelections.set('demo', null);
            this.setStartButtonEnabled(true);
            const message = this.add.text(x, startY, '数字顺序练习无需选择诗词', {
                fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
                fontSize: 26,
                color: '#2c3e50',
                align: 'center',
                backgroundColor: 'rgba(255,255,255,0.85)'
            }).setOrigin(0.5);
            message.setPadding(20, 10, 20, 10);
            message.setShadow(2, 2, 'rgba(154, 208, 245, 0.4)', 0, true, true);
            this.poemListTexts.push(message);
            this.registry.set('poemId', null);
            return;
        }

        const poems = loadPoemsFromCache(this, this.selectedDifficulty);

        if (poems.length === 0) {
            this.selectedPoemId = null;
            this.poemSelections.set(this.selectedDifficulty, null);
            this.setStartButtonEnabled(false);
            const message = this.add.text(x, startY, '暂无可选诗词，请稍后添加', {
                fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
                fontSize: 26,
                color: '#a0a0a0',
                align: 'center',
                backgroundColor: 'rgba(255,255,255,0.85)'
            }).setOrigin(0.5);
            message.setPadding(20, 10, 20, 10);
            message.setShadow(2, 2, 'rgba(154, 208, 245, 0.25)', 0, true, true);
            this.poemListTexts.push(message);
            this.registry.set('poemId', null);
            return;
        }

        this.setStartButtonEnabled(true);
        const storedSelection = this.poemSelections.get(this.selectedDifficulty);
        const defaultPoem = storedSelection
            ? poems.find((poem) => poem.id === storedSelection) ?? poems[0]
            : poems[0];
        this.selectedPoemId = defaultPoem.id;
        this.poemSelections.set(this.selectedDifficulty, this.selectedPoemId);
        this.registry.set('poemId', this.selectedPoemId);

        poems.forEach((poem, index) => {
            const label = formatPoemLabel(poem);
            const text = this.add.text(x, startY + index * 56, label, {
                fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
                fontSize: 26,
                color: '#2c3e50',
                align: 'center',
                backgroundColor: 'rgba(255,255,255,0.8)'
            }).setOrigin(0.5);
            text.setPadding(24, 10, 24, 10);
            text.setShadow(2, 2, 'rgba(154, 208, 245, 0.4)', 0, true, true);
            text.setData('poemId', poem.id);
            text.setInteractive({ useHandCursor: true });
            text.on('pointerdown', () => this.selectPoem(poem));
            text.on('pointerover', () => text.setStyle({ backgroundColor: 'rgba(255, 241, 214, 0.95)' }));
            text.on('pointerout', () => this.updatePoemHighlights());
            this.poemListTexts.push(text);
        });

        this.updatePoemHighlights();
    }

    private selectPoem(poem: PoemDefinition): void {
        this.selectedPoemId = poem.id;
        this.poemSelections.set(this.selectedDifficulty, poem.id);
        this.registry.set('poemId', poem.id);
        this.updatePoemHighlights();
    }

    private updatePoemHighlights(): void {
        this.poemListTexts.forEach((text) => {
            const poemId = text.getData('poemId') as string | undefined;
            if (!poemId) {
                return;
            }
            if (poemId === this.selectedPoemId) {
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

    private clearPoemList(): void {
        this.poemListTexts.forEach((text) => text.destroy());
        this.poemListTexts = [];
    }

    private setStartButtonEnabled(enabled: boolean): void {
        this.startButtonEnabled = enabled;
        if (enabled) {
            this.startButton.setAlpha(1);
            this.startButton.setStyle({ backgroundColor: '#ff8c69', color: '#ffffff' });
            this.startButton.setInteractive({ useHandCursor: true });
        } else {
            this.startButton.setAlpha(0.6);
            this.startButton.disableInteractive();
            this.startButton.setStyle({ backgroundColor: '#d3d3d3', color: '#ffffff' });
        }
    }

    private flashPoemList(): void {
        const targets = [this.poemListHeader, ...this.poemListTexts];
        this.tweens.add({
            targets,
            alpha: 0.4,
            duration: 120,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
                targets.forEach((target) => target.setAlpha(1));
            }
        });
    }
}

function formatPoemLabel(poem: PoemDefinition): string {
    return poem.author ? `《${poem.title}》 · ${poem.author}` : `《${poem.title}》`;
}
