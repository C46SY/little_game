import Phaser from 'phaser';
import { PLAYFIELD_HEIGHT, PLAYFIELD_WIDTH } from '../constants';
import {
    DifficultyConfig,
    DifficultyDefinition,
    loadDifficultyConfig
} from '../utils/contentManager';

export class MainMenu extends Phaser.Scene {
    private background!: Phaser.GameObjects.Image;
    private logo!: Phaser.GameObjects.Image;
    private title!: Phaser.GameObjects.Text;
    private startButton!: Phaser.GameObjects.Text;
    private difficultyButton!: Phaser.GameObjects.Text;
    private difficultyInfo!: Phaser.GameObjects.Text;
    private loadingText!: Phaser.GameObjects.Text;
    private difficultyPanel?: Phaser.GameObjects.Container;
    private difficultyOptionTexts: Phaser.GameObjects.Text[] = [];

    private difficultyConfig?: DifficultyConfig;
    private difficulties: DifficultyDefinition[] = [];
    private selectedDifficultyId = '';
    private panelVisible = false;

    constructor() {
        super('MainMenu');
    }

    create(): void {
        const centerX = PLAYFIELD_WIDTH / 2;
        const centerY = PLAYFIELD_HEIGHT / 2;

        this.background = this.add.image(centerX, centerY, 'playfield');
        this.background.setDepth(0);

        this.logo = this.add.image(centerX, centerY - 220, 'logo');
        this.logo.setDepth(1);

        this.title = this.add.text(centerX, centerY - 40, '快乐小蛇', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 64,
            color: '#2c3e50',
            align: 'center'
        }).setOrigin(0.5);
        this.title.setShadow(4, 4, 'rgba(154, 208, 245, 0.6)', 0, true, true);
        this.title.setStroke('#ffffff', 12);
        this.title.setDepth(2);

        this.startButton = this.createMenuButton(centerX, centerY + 80, '开始游戏', () => {
            this.startSelectedDifficulty();
        });
        this.startButton.disableInteractive();

        this.difficultyButton = this.createMenuButton(centerX, centerY + 160, '难度选择', () => {
            this.toggleDifficultyPanel();
        });
        this.difficultyButton.disableInteractive();

        this.difficultyInfo = this.add.text(centerX, centerY + 240, '正在加载难度列表...', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 28,
            color: '#2c3e50',
            align: 'center'
        }).setOrigin(0.5);
        this.difficultyInfo.setDepth(2);

        this.loadingText = this.add.text(centerX, centerY + 300, '', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 24,
            color: '#ff6b81',
            align: 'center'
        }).setOrigin(0.5);
        this.loadingText.setDepth(2);

        this.input.keyboard?.on('keydown-ESC', () => {
            if (this.panelVisible) {
                this.hideDifficultyPanel();
            }
        });

        void this.loadDifficultyOptions();
    }

    private createMenuButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
        const button = this.add.text(x, y, label, {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 40,
            color: '#ffffff',
            align: 'center',
            backgroundColor: 'rgba(126, 201, 255, 0.95)'
        }).setOrigin(0.5);
        button.setPadding(32, 18, 32, 18);
        button.setShadow(4, 4, 'rgba(110, 179, 245, 0.65)', 0, true, true);
        button.setStroke('#4a90e2', 6);
        button.setDepth(2);

        button.setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                button.setStyle({ backgroundColor: 'rgba(104, 188, 255, 0.95)' });
            })
            .on('pointerout', () => {
                button.setStyle({ backgroundColor: 'rgba(126, 201, 255, 0.95)' });
            })
            .on('pointerup', () => {
                onClick();
            });

        return button;
    }

    private async loadDifficultyOptions(): Promise<void> {
        this.setLoadingMessage('正在读取难度配置...');
        try {
            this.difficultyConfig = await loadDifficultyConfig();
            this.difficulties = this.difficultyConfig.items;

            const registryDifficulty = this.registry.get('difficultyId') as string | undefined;
            const availableIds = new Set(this.difficulties.map((item) => item.id));
            const defaultId = registryDifficulty && availableIds.has(registryDifficulty)
                ? registryDifficulty
                : this.difficultyConfig.defaultDifficulty && availableIds.has(this.difficultyConfig.defaultDifficulty)
                    ? this.difficultyConfig.defaultDifficulty
                    : this.difficulties[0]?.id;

            if (!defaultId) {
                throw new Error('难度列表为空，无法开始游戏。');
            }

            this.selectedDifficultyId = defaultId;
            this.registry.set('difficultyId', this.selectedDifficultyId);

            this.buildDifficultyPanel();
            this.updateDifficultyInfo();

            this.startButton.setInteractive({ useHandCursor: true });
            this.difficultyButton.setInteractive({ useHandCursor: true });
            this.setLoadingMessage('');
        } catch (error) {
            console.error(error);
            this.setLoadingMessage('读取难度配置失败，请检查资源文件。');
            this.difficultyInfo.setText('无法读取难度配置，请检查资源文件。');
            this.startButton.disableInteractive();
            this.difficultyButton.disableInteractive();
        }
    }

    private buildDifficultyPanel(): void {
        this.difficultyPanel?.destroy(true);
        this.difficultyOptionTexts = [];

        const container = this.add.container(0, 0);
        container.setDepth(10);
        container.setVisible(false);
        container.setActive(false);

        const overlay = this.add.rectangle(PLAYFIELD_WIDTH / 2, PLAYFIELD_HEIGHT / 2, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT, 0x000000, 0.35);
        overlay.setInteractive({ useHandCursor: false });
        overlay.on('pointerup', () => this.hideDifficultyPanel());
        container.add(overlay);

        const panelWidth = 560;
        const panelHeight = 420;
        const panelBackground = this.add.rectangle(PLAYFIELD_WIDTH / 2, PLAYFIELD_HEIGHT / 2, panelWidth, panelHeight, 0xffffff, 0.95);
        panelBackground.setStrokeStyle(4, 0x7ec9ff, 1);
        container.add(panelBackground);

        const title = this.add.text(PLAYFIELD_WIDTH / 2, PLAYFIELD_HEIGHT / 2 - panelHeight / 2 + 60, '选择难度', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 40,
            color: '#2c3e50',
            align: 'center'
        }).setOrigin(0.5);
        container.add(title);

        const startY = PLAYFIELD_HEIGHT / 2 - panelHeight / 2 + 120;
        const gap = 72;

        this.difficulties.forEach((definition, index) => {
            const y = startY + index * gap;
            const button = this.add.text(PLAYFIELD_WIDTH / 2, y, definition.label, {
                fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
                fontSize: 30,
                color: '#2c3e50',
                align: 'center',
                backgroundColor: 'rgba(248, 251, 255, 0.95)'
            }).setOrigin(0.5);
            button.setPadding(24, 12, 24, 12);
            button.setStroke('#c8e6ff', 4);
            button.setShadow(2, 2, 'rgba(154, 208, 245, 0.5)', 0, true, true);
            button.setData('difficultyId', definition.id);
            button.setInteractive({ useHandCursor: true })
                .on('pointerover', () => {
                    button.setStyle({ backgroundColor: 'rgba(222, 239, 255, 0.95)' });
                })
                .on('pointerout', () => {
                    const id = button.getData('difficultyId') as string | undefined;
                    this.updateDifficultyButtonStyle(button, id);
                })
                .on('pointerup', () => {
                    this.selectDifficulty(definition.id);
                });

            container.add(button);
            this.difficultyOptionTexts.push(button);

            if (definition.description) {
                const desc = this.add.text(PLAYFIELD_WIDTH / 2, y + 34, definition.description, {
                    fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
                    fontSize: 20,
                    color: '#5f6d7a',
                    align: 'center'
                }).setOrigin(0.5);
                container.add(desc);
            }
        });

        this.difficultyPanel = container;
        this.updateDifficultyPanelHighlight();
    }

    private updateDifficultyInfo(): void {
        const definition = this.difficulties.find((item) => item.id === this.selectedDifficultyId);
        if (!definition) {
            this.difficultyInfo.setText('未找到难度配置');
            return;
        }

        const modeText = definition.mode === 'poem' ? '古诗词模式' : '数字顺序模式';
        const lines: string[] = [`当前难度：${definition.label}`, `玩法：${modeText}`];
        if (definition.description) {
            lines.push(definition.description);
        } else if (definition.mode === 'poem') {
            lines.push('提示：按诗句的顺序收集汉字');
        }

        this.difficultyInfo.setText(lines.join('\n'));
    }

    private updateDifficultyPanelHighlight(): void {
        this.difficultyOptionTexts.forEach((text) => {
            const id = text.getData('difficultyId') as string | undefined;
            this.updateDifficultyButtonStyle(text, id);
        });
    }

    private updateDifficultyButtonStyle(button: Phaser.GameObjects.Text, buttonId?: string): void {
        const isActive = buttonId === this.selectedDifficultyId;
        button.setStyle({
            color: isActive ? '#ff6b81' : '#2c3e50',
            backgroundColor: isActive ? 'rgba(255, 235, 241, 0.95)' : 'rgba(248, 251, 255, 0.95)'
        });
    }

    private selectDifficulty(id: string): void {
        if (this.selectedDifficultyId === id) {
            this.hideDifficultyPanel();
            return;
        }

        this.selectedDifficultyId = id;
        this.registry.set('difficultyId', this.selectedDifficultyId);
        this.updateDifficultyInfo();

        this.difficultyOptionTexts.forEach((text) => {
            const optionId = text.getData('difficultyId') as string | undefined;
            this.updateDifficultyButtonStyle(text, optionId);
        });

        this.hideDifficultyPanel();
    }

    private toggleDifficultyPanel(): void {
        if (this.panelVisible) {
            this.hideDifficultyPanel();
        } else {
            this.showDifficultyPanel();
        }
    }

    private showDifficultyPanel(): void {
        if (!this.difficultyPanel) {
            return;
        }

        this.panelVisible = true;
        this.difficultyPanel.setVisible(true);
        this.difficultyPanel.setActive(true);
        this.children.bringToTop(this.difficultyPanel);
    }

    private hideDifficultyPanel(): void {
        if (!this.difficultyPanel) {
            return;
        }

        this.panelVisible = false;
        this.difficultyPanel.setVisible(false);
        this.difficultyPanel.setActive(false);
    }

    private setLoadingMessage(message: string): void {
        this.loadingText.setText(message);
    }

    private startSelectedDifficulty(): void {
        if (!this.selectedDifficultyId) {
            return;
        }

        this.scene.start('Game', { difficultyId: this.selectedDifficultyId });
    }
}
