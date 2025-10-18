import Phaser from 'phaser';
import {
    createDemoRuntime,
    createPoemRuntime,
    DifficultyDefinition,
    DifficultyRuntime,
    loadDifficultyDefinitions
} from '../utils/difficultyLoader';
import { createGameTextures } from '../utils/textureFactory';
import { PLAYFIELD_HEIGHT, PLAYFIELD_WIDTH } from '../constants';

interface DifficultyItem {
    definition: DifficultyDefinition;
    label: Phaser.GameObjects.Text;
}

type DifficultyMap = Map<string, DifficultyDefinition>;

export class MainMenu extends Phaser.Scene {
    private title!: Phaser.GameObjects.Text;
    private startButton!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private difficultyItems: DifficultyItem[] = [];
    private definitions: DifficultyMap = new Map();
    private selectedKey = 'demo';
    private loadingPromise: Promise<void> | null = null;
    private poemCache: Map<string, DifficultyRuntime> = new Map();

    constructor() {
        super('MainMenu');
    }

    public create(): void {
        createGameTextures(this);

        const centerX = PLAYFIELD_WIDTH / 2;
        const centerY = PLAYFIELD_HEIGHT / 2;

        this.add.image(centerX, centerY, 'playfield');

        this.title = this.add.text(centerX, centerY - 240, '快乐小蛇', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 72,
            color: '#2c3e50',
            align: 'center'
        }).setOrigin(0.5);
        this.title.setShadow(4, 4, 'rgba(154, 208, 245, 0.6)', 0, true, true);
        this.title.setStroke('#ffffff', 10);

        const menuPanel = this.add.rectangle(centerX, centerY + 40, 640, 520, 0xffffff, 0.92);
        menuPanel.setStrokeStyle(6, 0x7ec9ff);
        menuPanel.setDepth(1);

        const difficultyTitle = this.add.text(centerX, centerY - 140, '难度选择', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 36,
            color: '#1a2a3a',
            align: 'center'
        }).setOrigin(0.5);
        difficultyTitle.setDepth(2);

        this.startButton = this.add.text(centerX, centerY + 200, '开始游戏', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 40,
            color: '#ffffff',
            align: 'center',
            backgroundColor: '#5ad776'
        }).setOrigin(0.5);
        this.startButton.setPadding(36, 18, 36, 18);
        this.startButton.setShadow(3, 3, 'rgba(0,0,0,0.25)', 0, true, true);
        this.startButton.setDepth(2);
        this.startButton.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.handleStart())
            .on('pointerover', () => this.startButton.setScale(1.04))
            .on('pointerout', () => this.startButton.setScale(1));

        this.statusText = this.add.text(centerX, centerY + 260, '正在加载难度配置…', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 24,
            color: '#2c3e50',
            align: 'center'
        }).setOrigin(0.5);
        this.statusText.setDepth(2);

        this.loadDifficulties();
        this.registerKeyboardEvents();

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.keyboard?.off('keydown', this.handleKeyDown, this);
        });
    }

    private async loadDifficulties(): Promise<void> {
        try {
            this.loadingPromise = loadDifficultyDefinitions()
                .then((definitions) => {
                    this.definitions = new Map(definitions.map((def) => [def.key, def]));
                    if (!this.definitions.has(this.selectedKey) && this.definitions.size > 0) {
                        const firstKey = definitions[0]?.key;
                        if (firstKey) {
                            this.selectedKey = firstKey;
                        }
                    }
                    this.createDifficultyList(definitions);
                    this.updateStatusText();
                })
                .catch((error) => {
                    console.error(error);
                    this.statusText.setText('加载难度配置失败，请检查 assets/data/difficulties.json');
                })
                .finally(() => {
                    this.loadingPromise = null;
                });
            await this.loadingPromise;
        } catch (error) {
            console.error(error);
        }
    }

    private createDifficultyList(definitions: DifficultyDefinition[]): void {
        this.difficultyItems.forEach((item) => item.label.destroy());
        this.difficultyItems = [];

        const baseX = PLAYFIELD_WIDTH / 2;
        const startY = PLAYFIELD_HEIGHT / 2 - 70;
        const gapY = 70;

        definitions.forEach((definition, index) => {
            const label = this.add.text(baseX, startY + index * gapY, this.createDifficultyLabel(definition), {
                fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
                fontSize: 32,
                color: '#2c3e50',
                align: 'center',
                backgroundColor: 'rgba(255,255,255,0.6)'
            }).setOrigin(0.5);
            label.setPadding(28, 12, 28, 12);
            label.setDepth(2);
            label.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.selectDifficulty(definition.key))
                .on('pointerover', () => label.setScale(1.03))
                .on('pointerout', () => label.setScale(1));

            this.difficultyItems.push({ definition, label });
        });

        this.highlightSelection();
    }

    private createDifficultyLabel(definition: DifficultyDefinition): string {
        if (definition.type === 'demo') {
            return `<${definition.label}> 演示`; 
        }
        return `<${definition.label}> 诗词`;
    }

    private selectDifficulty(key: string): void {
        if (this.selectedKey === key) {
            this.updateStatusText();
            return;
        }
        this.selectedKey = key;
        this.highlightSelection();
        this.updateStatusText();
    }

    private highlightSelection(): void {
        this.difficultyItems.forEach((item) => {
            const isSelected = item.definition.key === this.selectedKey;
            item.label.setStyle({
                backgroundColor: isSelected ? '#9dd7ff' : 'rgba(255,255,255,0.6)',
                color: isSelected ? '#1a2a3a' : '#2c3e50'
            });
            item.label.setScale(isSelected ? 1.05 : 1);
        });
    }

    private registerKeyboardEvents(): void {
        this.input.keyboard?.on('keydown', this.handleKeyDown, this);
    }

    private handleKeyDown(event: KeyboardEvent): void {
        if (event.code === 'Enter' || event.code === 'Space') {
            this.handleStart();
            return;
        }

        if (event.code === 'ArrowUp' || event.code === 'KeyW') {
            this.moveSelection(-1);
        } else if (event.code === 'ArrowDown' || event.code === 'KeyS') {
            this.moveSelection(1);
        }
    }

    private moveSelection(offset: number): void {
        if (this.difficultyItems.length === 0) {
            return;
        }

        const currentIndex = this.difficultyItems.findIndex((item) => item.definition.key === this.selectedKey);
        const nextIndex = (currentIndex + offset + this.difficultyItems.length) % this.difficultyItems.length;
        this.selectedKey = this.difficultyItems[nextIndex].definition.key;
        this.highlightSelection();
        this.updateStatusText();
    }

    private updateStatusText(): void {
        const definition = this.definitions.get(this.selectedKey);
        if (!definition) {
            this.statusText.setText('请选择可用的难度');
            return;
        }

        const description = definition.description
            ? `${definition.description}`
            : definition.type === 'demo'
                ? '按数字顺序吃豆的示例模式'
                : '按诗词字序依次吃豆';

        this.statusText.setText(`当前难度：${definition.label}\n${description}`);
    }

    private async handleStart(): Promise<void> {
        if (this.loadingPromise) {
            return;
        }

        const definition = this.definitions.get(this.selectedKey);
        if (!definition) {
            this.statusText.setText('尚未加载到该难度配置');
            return;
        }

        if (definition.type === 'demo') {
            const runtime = createDemoRuntime(definition);
            this.startGame(runtime);
            return;
        }

        const cached = this.poemCache.get(definition.key);
        if (cached) {
            this.startGame(cached);
            return;
        }

        this.statusText.setText('正在载入诗词素材…');
        try {
            const runtime = await createPoemRuntime(definition);
            this.poemCache.set(definition.key, runtime);
            this.startGame(runtime);
        } catch (error) {
            console.error(error);
            this.statusText.setText('诗词素材加载失败，请检查文件路径或格式');
        }
    }

    private startGame(runtime: DifficultyRuntime): void {
        this.scene.start('Game', { difficulty: runtime });
    }
}
