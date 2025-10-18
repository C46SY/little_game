import Phaser from 'phaser';
import {
    DIFFICULTY_ORDER,
    DifficultyKey,
    getDifficultyDescription,
    getDifficultyLabel
} from '../data/difficulty';
import { loadPoemsFromCache, PoemDefinition } from '../data/poems';

interface StoredPoemSelection {
    difficulty: DifficultyKey;
    title: string;
    author?: string;
}

export class MainMenu extends Phaser.Scene {
    private difficultyTexts: Map<DifficultyKey, Phaser.GameObjects.Text> = new Map();
    private selectedDifficulty: DifficultyKey = 'easy';
    private startButton!: Phaser.GameObjects.Text;
    private poemsByDifficulty: Map<DifficultyKey, PoemDefinition[]> = new Map();
    private selectedPoems: Map<DifficultyKey, PoemDefinition | null> = new Map();
    private poemOptionTexts: Phaser.GameObjects.Text[] = [];
    private currentPoemOptions: PoemDefinition[] = [];
    private poemListTitle!: Phaser.GameObjects.Text;
    private poemListStartY = 0;

    constructor() {
        super('MainMenu');
    }

    public create(): void {
        const { width, height } = this.scale;

        const storedDifficulty = this.registry.get('difficulty') as DifficultyKey | undefined;
        const storedSelection = this.registry.get('poemSelection') as StoredPoemSelection | undefined | null;

        this.loadAvailablePoems();

        if (storedSelection && storedSelection.difficulty) {
            const match = this.findStoredPoem(storedSelection);
            if (match) {
                this.selectedDifficulty = storedSelection.difficulty;
                this.selectedPoems.set(storedSelection.difficulty, match);
            }
        }

        if (!storedSelection && storedDifficulty) {
            this.selectedDifficulty = storedDifficulty;
        }

        this.registry.set('difficulty', this.selectedDifficulty);

        this.add.image(width / 2, height / 2, 'playfield');

        this.add.text(width / 2, height * 0.2, 'Making Studio', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 36,
            color: '#5d6d7e',
            align: 'center'
        })
            .setOrigin(0.5)
            .setShadow(3, 3, 'rgba(154, 208, 245, 0.45)', 0, true, true)
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

        this.poemListTitle = this.add.text(width / 2, optionY + 30, '', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 30,
            color: '#2c3e50',
            align: 'center',
            backgroundColor: 'rgba(255,255,255,0.92)'
        }).setOrigin(0.5);
        this.poemListTitle.setPadding(24, 12, 24, 12);
        this.poemListTitle.setShadow(3, 3, 'rgba(154, 208, 245, 0.45)', 0, true, true);

        this.poemListStartY = this.poemListTitle.y + 64;

        this.updateDifficultyHighlights();
        this.renderPoemList();
        this.updateStartButtonState();

        const keyboard = this.input.keyboard;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Enter' || event.code === 'Space') {
                if (this.canStartCurrentSelection()) {
                    this.startSelectedGame();
                }
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
        button.setData('enabled', true);
        button.setInteractive({ useHandCursor: true });
        button.on('pointerdown', () => {
            if (button.getData('enabled')) {
                callback();
            }
        });
        button.on('pointerover', () => {
            if (button.getData('enabled')) {
                button.setStyle({ backgroundColor: '#ffad86' });
            }
        });
        button.on('pointerout', () => {
            const enabled = button.getData('enabled');
            button.setStyle({ backgroundColor: enabled ? '#ff8c69' : '#d0d3d4', color: enabled ? '#ffffff' : '#7f8c8d' });
        });
        return button;
    }

    private selectDifficulty(key: DifficultyKey): void {
        this.selectedDifficulty = key;
        this.registry.set('difficulty', key);
        this.updateDifficultyHighlights();
        this.renderPoemList();
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

    private startSelectedGame(): void {
        if (!this.canStartCurrentSelection()) {
            return;
        }

        const selectedPoem = this.selectedPoems.get(this.selectedDifficulty) ?? undefined;
        if (selectedPoem) {
            const stored: StoredPoemSelection = {
                difficulty: this.selectedDifficulty,
                title: selectedPoem.title,
                author: selectedPoem.author
            };
            this.registry.set('poemSelection', stored);
        } else {
            this.registry.remove('poemSelection');
        }

        this.scene.start('Game', { difficulty: this.selectedDifficulty, poem: selectedPoem ?? undefined });
    }

    private loadAvailablePoems(): void {
        DIFFICULTY_ORDER.forEach((difficulty) => {
            if (difficulty === 'demo') {
                this.poemsByDifficulty.set(difficulty, []);
                this.selectedPoems.set(difficulty, null);
                return;
            }

            const poems = loadPoemsFromCache(this, difficulty);
            this.poemsByDifficulty.set(difficulty, poems);
            this.selectedPoems.set(difficulty, poems.length > 0 ? poems[0] : null);
        });
    }

    private findStoredPoem(selection: StoredPoemSelection): PoemDefinition | null {
        const poems = this.poemsByDifficulty.get(selection.difficulty) ?? [];
        return poems.find((poem) => {
            const sameTitle = poem.title === selection.title;
            const sameAuthor = poem.author === selection.author || (!poem.author && !selection.author);
            return sameTitle && sameAuthor;
        }) ?? null;
    }

    private renderPoemList(): void {
        this.poemOptionTexts.forEach((text) => text.destroy());
        this.poemOptionTexts = [];
        this.currentPoemOptions = [];

        if (!this.poemListTitle) {
            return;
        }

        if (this.selectedDifficulty === 'demo') {
            this.selectedPoems.set('demo', null);
            this.poemListTitle.setText('练习模式：无需选择诗词');
            this.poemListTitle.setVisible(true);
            return;
        }

        const poems = this.poemsByDifficulty.get(this.selectedDifficulty) ?? [];
        this.currentPoemOptions = poems;

        if (poems.length === 0) {
            this.selectedPoems.set(this.selectedDifficulty, null);
            this.poemListTitle.setText('当前难度暂无古诗词，请稍后在配置中添加');
            this.poemListTitle.setVisible(true);
            return;
        }

        const selected = this.selectedPoems.get(this.selectedDifficulty) ?? poems[0];
        this.selectedPoems.set(this.selectedDifficulty, selected);

        this.poemListTitle.setText('请选择想要练习的诗词：');
        this.poemListTitle.setVisible(true);

        const style = {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 28,
            color: '#2c3e50',
            align: 'center',
            backgroundColor: 'rgba(255,255,255,0.88)'
        } as Phaser.Types.GameObjects.Text.TextStyle;

        const centerX = this.scale.width / 2;
        let currentY = this.poemListStartY;

        poems.forEach((poem, index) => {
            const label = poem.author ? `《${poem.title}》 · ${poem.author}` : `《${poem.title}》`;
            const option = this.add.text(centerX, currentY, label, style).setOrigin(0.5);
            option.setPadding(24, 10, 24, 10);
            option.setShadow(2, 2, 'rgba(154, 208, 245, 0.4)', 0, true, true);
            option.setInteractive({ useHandCursor: true });
            option.on('pointerdown', () => this.selectPoem(index));
            option.on('pointerover', () => {
                option.setStyle({ backgroundColor: 'rgba(255, 241, 214, 0.95)' });
            });
            option.on('pointerout', () => this.updatePoemOptionHighlights());
            this.poemOptionTexts.push(option);
            currentY += 52;
        });

        this.updatePoemOptionHighlights();
    }

    private selectPoem(index: number): void {
        const poem = this.currentPoemOptions[index];
        if (!poem) {
            return;
        }
        this.selectedPoems.set(this.selectedDifficulty, poem);
        this.updatePoemOptionHighlights();
        this.updateStartButtonState();
    }

    private updatePoemOptionHighlights(): void {
        const selected = this.selectedPoems.get(this.selectedDifficulty);
        this.poemOptionTexts.forEach((text, index) => {
            const poem = this.currentPoemOptions[index];
            if (selected && poem && poem.title === selected.title && poem.author === selected.author) {
                text.setStyle({
                    color: '#d35400',
                    backgroundColor: 'rgba(255, 241, 214, 0.95)'
                });
            } else {
                text.setStyle({
                    color: '#2c3e50',
                    backgroundColor: 'rgba(255,255,255,0.88)'
                });
            }
        });
    }

    private canStartCurrentSelection(): boolean {
        if (this.selectedDifficulty === 'demo') {
            return true;
        }

        const poems = this.poemsByDifficulty.get(this.selectedDifficulty) ?? [];
        if (poems.length === 0) {
            return false;
        }

        const selected = this.selectedPoems.get(this.selectedDifficulty);
        return !!selected;
    }

    private updateStartButtonState(): void {
        if (!this.startButton) {
            return;
        }
        const enabled = this.canStartCurrentSelection();
        this.setButtonEnabled(this.startButton, enabled);
    }

    private setButtonEnabled(button: Phaser.GameObjects.Text, enabled: boolean): void {
        button.setData('enabled', enabled);
        button.setStyle({
            backgroundColor: enabled ? '#ff8c69' : '#d0d3d4',
            color: enabled ? '#ffffff' : '#7f8c8d'
        });
        button.setAlpha(enabled ? 1 : 0.8);
        if (enabled) {
            button.setInteractive({ useHandCursor: true });
        } else {
            button.disableInteractive();
        }
    }
}
