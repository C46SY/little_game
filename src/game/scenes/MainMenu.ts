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
    private poemListTexts: Phaser.GameObjects.Text[] = [];
    private poemListTitle!: Phaser.GameObjects.Text;
    private poemData: Map<DifficultyKey, PoemDefinition[]> = new Map();
    private selectedPoemIndex: number | null = null;

    constructor() {
        super('MainMenu');
    }

    public create(): void {
        const { width, height } = this.scale;

        const storedDifficulty = this.registry.get('difficulty') as DifficultyKey | undefined;
        this.selectedDifficulty = storedDifficulty ?? 'easy';
        this.registry.set('difficulty', this.selectedDifficulty);
        this.loadPoemData();

        this.add.image(width / 2, height / 2, 'playfield');

        this.add.text(width / 2, height * 0.18, 'Making Studio', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 36,
            color: '#2c3e50',
            align: 'center'
        })
            .setOrigin(0.5)
            .setShadow(3, 3, 'rgba(154, 208, 245, 0.4)', 0, true, true)
            .setStroke('#ffffff', 6);

        this.add.text(width / 2, height * 0.42, '快乐小蛇', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 64,
            color: '#2c3e50',
            align: 'center'
        }).setOrigin(0.5)
            .setShadow(4, 4, 'rgba(154, 208, 245, 0.6)', 0, true, true)
            .setStroke('#ffffff', 12);

        this.createMenuButton(width / 2, height * 0.58, '开始游戏', () => this.startSelectedGame());

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
        this.createPoemList(optionY + 20);
        this.showPoemListForDifficulty(this.selectedDifficulty);

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

    private loadPoemData(): void {
        DIFFICULTY_ORDER.forEach((difficulty) => {
            this.poemData.set(difficulty, loadPoemsFromCache(this, difficulty));
        });
    }

    private createPoemList(top: number): void {
        const { width } = this.scale;
        this.poemListTitle = this.add.text(width / 2, top, '', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 30,
            color: '#2c3e50',
            align: 'center',
            backgroundColor: 'rgba(255,255,255,0.9)'
        }).setOrigin(0.5);
        this.poemListTitle.setPadding(28, 12, 28, 12);
        this.poemListTitle.setShadow(3, 3, 'rgba(154, 208, 245, 0.4)', 0, true, true);
    }

    private getPoemsForDifficulty(difficulty: DifficultyKey): PoemDefinition[] {
        return this.poemData.get(difficulty) ?? [];
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
        const storedPoemIndex = this.registry.get(this.getPoemRegistryKey(key));
        this.selectedPoemIndex = Number.isInteger(storedPoemIndex) ? (storedPoemIndex as number) : null;
        this.updateDifficultyHighlights();
        this.showPoemListForDifficulty(key);
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

    private showPoemListForDifficulty(difficulty: DifficultyKey): void {
        this.poemListTexts.forEach((item) => item.destroy());
        this.poemListTexts = [];

        const poems = this.getPoemsForDifficulty(difficulty);
        const { width } = this.scale;
        const baseY = this.poemListTitle.y + 70;

        if (difficulty === 'demo') {
            this.poemListTitle.setText('数字顺序练习模式');
            this.selectedPoemIndex = null;
            return;
        }

        if (poems.length === 0) {
            this.poemListTitle.setText('诗词列表（等待添加素材）');
            this.selectedPoemIndex = null;
            return;
        }

        if (!Number.isInteger(this.selectedPoemIndex) || (this.selectedPoemIndex as number) >= poems.length) {
            this.selectedPoemIndex = 0;
            this.registry.set(this.getPoemRegistryKey(difficulty), 0);
        }

        this.poemListTitle.setText('请选择诗词');

        poems.forEach((poem, index) => {
            const label = poem.author ? `《${poem.title}》 · ${poem.author}` : `《${poem.title}》`;
            const item = this.add.text(width / 2, baseY + index * 56, label, {
                fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
                fontSize: 26,
                color: '#2c3e50',
                align: 'center',
                backgroundColor: 'rgba(255,255,255,0.85)'
            }).setOrigin(0.5);
            item.setPadding(26, 10, 26, 10);
            item.setShadow(2, 2, 'rgba(154, 208, 245, 0.35)', 0, true, true);
            item.setInteractive({ useHandCursor: true });
            item.on('pointerdown', () => this.selectPoem(index));
            item.on('pointerover', () => item.setStyle({ backgroundColor: 'rgba(255, 241, 214, 0.95)' }));
            item.on('pointerout', () => this.updatePoemListHighlights());
            this.poemListTexts.push(item);
        });

        this.updatePoemListHighlights();
    }

    private selectPoem(index: number): void {
        if (this.selectedDifficulty === 'demo') {
            return;
        }
        this.selectedPoemIndex = index;
        this.registry.set(this.getPoemRegistryKey(this.selectedDifficulty), index);
        this.updatePoemListHighlights();
    }

    private updatePoemListHighlights(): void {
        this.poemListTexts.forEach((item, index) => {
            if (index === this.selectedPoemIndex) {
                item.setStyle({
                    color: '#d35400',
                    backgroundColor: 'rgba(255, 241, 214, 0.95)'
                });
            } else {
                item.setStyle({
                    color: '#2c3e50',
                    backgroundColor: 'rgba(255,255,255,0.85)'
                });
            }
        });
    }

    private getPoemRegistryKey(difficulty: DifficultyKey): string {
        return `poemIndex-${difficulty}`;
    }

    private startSelectedGame(): void {
        let poemIndex: number | undefined;
        if (this.selectedDifficulty !== 'demo') {
            const poems = this.getPoemsForDifficulty(this.selectedDifficulty);
            if (poems.length === 0) {
                this.poemListTitle.setText('当前难度暂无诗词，请稍后添加');
                return;
            }
            if (poems.length > 0 && Number.isInteger(this.selectedPoemIndex)) {
                poemIndex = this.selectedPoemIndex as number;
            }
        }
        this.scene.start('Game', { difficulty: this.selectedDifficulty, poemIndex });
    }
}
