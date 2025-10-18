import Phaser, { GameObjects, Scene } from 'phaser';
import { DifficultyDefinition, getDifficultyList } from '../utils/difficulty';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    private difficultyButton!: GameObjects.Text;
    private descriptionText!: GameObjects.Text;
    private options: DifficultyDefinition[] = [];
    private selectedIndex = 0;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        this.background = this.add.image(512, 384, 'playfield');

        this.logo = this.add.image(512, 280, 'logo');

        this.title = this.add.text(512, 440, '快乐小蛇', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 56,
            color: '#2c3e50',
            align: 'center'
        }).setOrigin(0.5);
        this.title.setShadow(3, 3, 'rgba(154, 208, 245, 0.6)', 0, true, true);
        this.title.setStroke('#ffffff', 10);

        this.options = getDifficultyList(this);
        this.selectedIndex = Math.max(0, this.options.findIndex((option) => option.id === 'easy'));
        if (this.selectedIndex === -1) {
            this.selectedIndex = 0;
        }

        this.createButton(512, 520, '开始游戏', () => this.startGame());
        this.difficultyButton = this.createButton(512, 600, '', () => this.cycleDifficulty(1));

        this.descriptionText = this.add.text(512, 660, '', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 22,
            color: '#2c3e50',
            align: 'center',
            backgroundColor: 'rgba(255,255,255,0.85)'
        }).setOrigin(0.5);
        this.descriptionText.setPadding(18, 12, 18, 12);
        this.descriptionText.setShadow(2, 2, 'rgba(154, 208, 245, 0.6)', 0, true, true);

        this.updateDifficultyDisplay();

        this.input.keyboard?.on('keydown', this.handleKeyDown, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.keyboard?.off('keydown', this.handleKeyDown, this);
        });
    }

    private createButton(x: number, y: number, text: string, onClick: () => void): GameObjects.Text {
        const button = this.add.text(x, y, text, {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 32,
            color: '#ff6b81',
            align: 'center',
            backgroundColor: 'rgba(255,255,255,0.95)'
        }).setOrigin(0.5);
        button.setPadding(26, 14, 26, 14);
        button.setShadow(3, 3, 'rgba(255, 166, 201, 0.5)', 0, true, true);
        button.setStroke('#ffe3e3', 6);
        button.setInteractive({ useHandCursor: true })
            .on('pointerover', () => button.setStyle({ color: '#ff4757' }))
            .on('pointerout', () => button.setStyle({ color: '#ff6b81' }))
            .on('pointerdown', onClick);
        return button;
    }

    private handleKeyDown(event: KeyboardEvent): void {
        switch (event.code) {
            case 'Enter':
            case 'Space':
                this.startGame();
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.cycleDifficulty(-1);
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.cycleDifficulty(1);
                break;
            default:
                break;
        }
    }

    private cycleDifficulty(direction: number): void {
        if (this.options.length === 0) {
            return;
        }
        const length = this.options.length;
        this.selectedIndex = (this.selectedIndex + direction + length) % length;
        this.updateDifficultyDisplay();
    }

    private updateDifficultyDisplay(): void {
        const current = this.options[this.selectedIndex];
        if (!current) {
            this.difficultyButton.setText('难度：未配置');
            this.descriptionText.setText('无法读取难度配置');
            return;
        }

        this.difficultyButton.setText(`难度：${current.label}`);
        const poemInfo = current.mode === 'poem'
            ? [current.title, current.author].filter(Boolean).join(' · ')
            : '按数字顺序吃豆的演示模式';
        const description = current.description ?? poemInfo;
        this.descriptionText.setText(description);
    }

    private startGame(): void {
        const current = this.options[this.selectedIndex];
        if (!current) {
            return;
        }
        this.scene.start('Game', { difficulty: current.id });
    }
}
