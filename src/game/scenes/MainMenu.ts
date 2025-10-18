import Phaser from 'phaser';
import {
    DIFFICULTY_ORDER,
    DifficultyKey,
    getDifficultyDescription,
    getDifficultyLabel
} from '../data/difficulty';

export class MainMenu extends Phaser.Scene {
    private difficultyTexts: Map<DifficultyKey, Phaser.GameObjects.Text> = new Map();
    private selectedDifficulty: DifficultyKey = 'easy';

    constructor() {
        super('MainMenu');
    }

    public create(): void {
        const { width, height } = this.scale;

        const storedDifficulty = this.registry.get('difficulty') as DifficultyKey | undefined;
        this.selectedDifficulty = storedDifficulty ?? 'easy';
        this.registry.set('difficulty', this.selectedDifficulty);

        this.add.image(width / 2, height / 2, 'playfield');
        this.add.image(width / 2, height * 0.26, 'logo');

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
        button.on('pointerdown', callback);
        button.on('pointerover', () => button.setStyle({ backgroundColor: '#ffad86' }));
        button.on('pointerout', () => button.setStyle({ backgroundColor: '#ff8c69' }));
        return button;
    }

    private selectDifficulty(key: DifficultyKey): void {
        this.selectedDifficulty = key;
        this.registry.set('difficulty', key);
        this.updateDifficultyHighlights();
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
        this.scene.start('Game', { difficulty: this.selectedDifficulty });
    }
}
