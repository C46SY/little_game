import Phaser from 'phaser';
import {
    CELL_SIZE,
    GAME_WIDTH,
    GRID_HEIGHT,
    GRID_WIDTH,
    MAX_SNAKE_LENGTH,
    PLAYFIELD_HEIGHT,
    PLAYFIELD_PADDING_X,
    PLAYFIELD_PADDING_Y,
    PLAYFIELD_WIDTH
} from '../constants';
import {
    DifficultyMode,
    SequenceToken,
    loadDifficultyContent
} from '../utils/contentManager';
import { createGameTextures } from '../utils/textureFactory';

type Cell = { x: number; y: number };
type Bean = { cell: Cell; value: number; label: string };

enum GameState {
    Running = 'running',
    Dead = 'dead',
    Win = 'win'
}

const STEP_DELAY = 150; // milliseconds, ~6.5 ticks per second
const INITIAL_LENGTH = 3;
const BEST_SCORE_KEY_BASE = 'snake-best-score';
const INITIAL_BEAN_COUNT = 3;

export class Game extends Phaser.Scene {
    private snakeSprites: Phaser.GameObjects.Sprite[] = [];
    private beanSprites: Phaser.GameObjects.Sprite[] = [];
    private beanLabels: Phaser.GameObjects.Text[] = [];
    private scoreText!: Phaser.GameObjects.Text;
    private gameOverText!: Phaser.GameObjects.Text;
    private stepEvent?: Phaser.Time.TimerEvent;

    private snake: Cell[] = [];
    private direction: Cell = { x: 1, y: 0 };
    private directionQueue: Cell[] = [];
    private pendingGrowth = 0;
    private beans: Bean[] = [];
    private nextValue = 1;
    private maxValue = 0;
    private occupancy: Set<string> = new Set();
    private score = 0;
    private bestScore = 0;
    private state: GameState = GameState.Running;
    private rng!: Phaser.Math.RandomDataGenerator;

    private mode: DifficultyMode = 'numeric';
    private sequenceTokens: SequenceToken[] = [];
    private groupedTokens: SequenceToken[][] = [];
    private nextSpawnIndex = 0;
    private currentGroupIndex = 0;
    private requestedDifficultyId?: string;
    private loadTask?: Promise<void>;
    private contentReady = false;
    private difficultyLabel = '';
    private poemLines: string[] = [];
    private bestScoreKey = BEST_SCORE_KEY_BASE;

    constructor() {
        super('Game');
    }

    public init(data?: { difficultyId?: string }): void {
        this.requestedDifficultyId = data?.difficultyId;
        this.rng = new Phaser.Math.RandomDataGenerator([Date.now().toString()]);
        this.bestScore = 0;
        this.score = 0;
        this.contentReady = false;
        this.loadTask = undefined;
        this.sequenceTokens = [];
        this.groupedTokens = [];
        this.poemLines = [];
        this.nextSpawnIndex = 0;
        this.currentGroupIndex = 0;
        this.nextValue = 1;
        this.difficultyLabel = '';
        this.bestScoreKey = BEST_SCORE_KEY_BASE;
        this.maxValue = 0;
    }

    public create(): void {
        createGameTextures(this);

        this.add.image(PLAYFIELD_WIDTH / 2, PLAYFIELD_HEIGHT / 2, 'playfield').setDepth(0);

        this.scoreText = this.add.text(0, 0, '', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: '30px',
            color: '#2c3e50',
            align: 'left'
        });
        this.scoreText.setPadding(18, 12, 18, 12);
        this.scoreText.setBackgroundColor('rgba(255,255,255,0.85)');
        this.scoreText.setShadow(2, 2, 'rgba(154, 208, 245, 0.6)', 0, true, true);
        this.scoreText.setDepth(5);
        this.scoreText.setText('正在加载素材...');

        this.gameOverText = this.add.text(PLAYFIELD_WIDTH / 2, PLAYFIELD_HEIGHT / 2, '游戏结束\n按 SPACE 键重新开始', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: '48px',
            color: '#ff6b81',
            align: 'center',
            backgroundColor: 'rgba(255,255,255,0.9)'
        });
        this.gameOverText.setOrigin(0.5);
        this.gameOverText.setDepth(6);
        this.gameOverText.setStroke('#ffe3e3', 6);
        this.gameOverText.setShadow(3, 3, 'rgba(255, 166, 201, 0.5)', 0, true, true);
        this.gameOverText.setVisible(false);

        const keyboard = this.input.keyboard;
        keyboard?.on('keydown', this.handleKeyDown, this);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            keyboard?.off('keydown', this.handleKeyDown, this);
            this.stepEvent?.destroy();
            this.snakeSprites.forEach((sprite) => sprite.destroy());
            this.beanSprites.forEach((sprite) => sprite.destroy());
            this.beanLabels.forEach((label) => label.destroy());
            this.snakeSprites = [];
            this.beanSprites = [];
            this.beanLabels = [];
        });

        void this.initializeGame();
    }

    private async initializeGame(): Promise<void> {
        try {
            await this.ensureContentLoaded();
            this.resetGame();
            if (!this.stepEvent) {
                this.stepEvent = this.time.addEvent({
                    delay: STEP_DELAY,
                    loop: true,
                    callback: this.step,
                    callbackScope: this
                });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : '素材加载失败';
            this.showLoadingError(message);
        }
    }

    private async ensureContentLoaded(): Promise<void> {
        if (this.contentReady) {
            return;
        }

        if (!this.loadTask) {
            this.loadTask = (async () => {
                try {
                    const registryDifficulty = this.registry.get('difficultyId') as string | undefined;
                    const targetId = this.requestedDifficultyId ?? registryDifficulty;
                    const content = await loadDifficultyContent(targetId);

                    this.mode = content.mode;
                    this.sequenceTokens = content.tokens;
                    this.groupedTokens = content.groups;
                    this.difficultyLabel = content.definition.label;
                    this.poemLines = content.poem ? content.poem.lines.map((line) => line.original) : [];
                    this.maxValue = content.tokens.length;
                    this.registry.set('difficultyId', content.definition.id);
                    this.bestScoreKey = `${BEST_SCORE_KEY_BASE}-${content.definition.id}`;
                    this.bestScore = this.loadBestScore();
                    this.contentReady = true;
                } catch (error) {
                    this.loadTask = undefined;
                    throw error;
                }
            })();
        }

        await this.loadTask;
    }

    private showLoadingError(message: string): void {
        this.scoreText.setText(`素材加载失败\n${message}`);
        this.updateScoreLayout();
    }

    private resetGame(): void {
        if (!this.contentReady) {
            return;
        }

        this.state = GameState.Running;
        this.gameOverText.setVisible(false);
        this.snake = [];
        this.directionQueue = [];
        this.occupancy.clear();
        this.pendingGrowth = 0;
        this.score = 0;
        this.direction = { x: 1, y: 0 };
        this.beans = [];
        this.hideSnakeSprites();
        this.hideBeanViews();
        this.nextValue = 1;
        this.nextSpawnIndex = 0;
        this.currentGroupIndex = 0;

        const startX = Math.floor(GRID_WIDTH / 2);
        const startY = Math.floor(GRID_HEIGHT / 2);

        for (let i = 0; i < INITIAL_LENGTH; i += 1) {
            const segment: Cell = { x: startX - i, y: startY };
            this.snake.push(segment);
            this.occupancy.add(this.cellKey(segment));
        }

        this.refillBeans();
        this.updateScoreText();
        this.draw();
    }

    private handleKeyDown(event: KeyboardEvent): void {
        if (event.code === 'Space') {
            if (this.state === GameState.Dead || this.state === GameState.Win) {
                this.resetGame();
            }
            return;
        }

        if (this.state !== GameState.Running) {
            return;
        }

        const direction = this.directionFromKey(event.code);
        if (!direction) {
            return;
        }

        this.enqueueDirection(direction);
    }

    private directionFromKey(code: string): Cell | null {
        switch (code) {
            case 'ArrowUp':
            case 'KeyW':
                return { x: 0, y: -1 };
            case 'ArrowDown':
            case 'KeyS':
                return { x: 0, y: 1 };
            case 'ArrowLeft':
            case 'KeyA':
                return { x: -1, y: 0 };
            case 'ArrowRight':
            case 'KeyD':
                return { x: 1, y: 0 };
            default:
                return null;
        }
    }

    private enqueueDirection(direction: Cell): void {
        const last = this.directionQueue.length > 0
            ? this.directionQueue[this.directionQueue.length - 1]
            : this.direction;

        if (this.isSameDirection(direction, last) || this.isOpposite(direction, last)) {
            return;
        }

        this.directionQueue.push(direction);
    }

    private step(): void {
        if (this.state !== GameState.Running) {
            return;
        }

        if (this.directionQueue.length > 0) {
            this.direction = this.directionQueue.shift() as Cell;
        }

        const head = this.snake[0];
        const nextHead: Cell = { x: head.x + this.direction.x, y: head.y + this.direction.y };

        if (!this.inBounds(nextHead)) {
            this.endGame();
            return;
        }

        const nextKey = this.cellKey(nextHead);
        const beanIndex = this.findBeanIndex(nextHead);
        const tail = this.snake[this.snake.length - 1];
        const willRemoveTail = this.pendingGrowth === 0;
        const tailKey = this.cellKey(tail);

        if (this.occupancy.has(nextKey)) {
            const movingIntoTail = willRemoveTail && nextKey === tailKey;
            const movingIntoBean = beanIndex !== -1;
            if (!movingIntoTail && !movingIntoBean) {
                this.endGame();
                return;
            }
        }

        if (beanIndex !== -1) {
            const bean = this.beans[beanIndex];
            if (bean.value !== this.nextValue) {
                this.endGame('顺序错误');
                return;
            }
            this.occupancy.delete(nextKey);
        }

        this.snake.unshift(nextHead);
        this.occupancy.add(nextKey);

        if (beanIndex !== -1) {
            this.beans.splice(beanIndex, 1);
            const remainingCapacity = Math.max(0, MAX_SNAKE_LENGTH - this.snake.length);
            if (remainingCapacity > 0) {
                this.pendingGrowth += 1;
                if (this.pendingGrowth > remainingCapacity) {
                    this.pendingGrowth = remainingCapacity;
                }
            } else {
                this.pendingGrowth = 0;
            }
            this.score += 1;
            this.nextValue += 1;
            if (this.score > this.bestScore) {
                this.bestScore = this.score;
                this.saveBestScore(this.bestScore);
            }
            this.updateScoreText();
            if (this.nextValue > this.maxValue && this.beans.length === 0) {
                this.handleWin();
                return;
            }
            this.refillBeans();
            if (this.state !== GameState.Running) {
                return;
            }
        }

        if (this.pendingGrowth > 0) {
            this.pendingGrowth -= 1;
        } else {
            const removed = this.snake.pop();
            if (removed) {
                this.occupancy.delete(this.cellKey(removed));
            }
        }

        this.draw();
    }

    private inBounds(cell: Cell): boolean {
        return cell.x >= 0 && cell.x < GRID_WIDTH && cell.y >= 0 && cell.y < GRID_HEIGHT;
    }

    private endGame(reason?: string): void {
        if (this.state !== GameState.Running) {
            return;
        }
        this.state = GameState.Dead;
        if (reason) {
            this.gameOverText.setText(`${reason}\n按 SPACE 键重新开始`);
        } else {
            this.gameOverText.setText('游戏结束\n按 SPACE 键重新开始');
        }
        this.gameOverText.setVisible(true);
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            this.saveBestScore(this.bestScore);
        }
        this.updateScoreText();
    }

    private handleWin(): void {
        if (this.state !== GameState.Running) {
            return;
        }
        this.state = GameState.Win;
        this.gameOverText.setText('挑战成功！\n按 SPACE 键重新开始');
        this.gameOverText.setVisible(true);
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            this.saveBestScore(this.bestScore);
        }
        this.updateScoreText();
    }

    private refillBeans(): void {
        if (this.state !== GameState.Running || !this.contentReady) {
            return;
        }

        if (this.maxValue === 0) {
            this.handleWin();
            return;
        }

        if (this.mode === 'numeric') {
            while (this.beans.length < INITIAL_BEAN_COUNT && this.nextSpawnIndex < this.sequenceTokens.length) {
                const token = this.sequenceTokens[this.nextSpawnIndex];
                this.spawnBean(token);
                this.nextSpawnIndex += 1;
                if (this.state !== GameState.Running) {
                    return;
                }
            }

            if (this.nextValue > this.maxValue && this.beans.length === 0) {
                this.handleWin();
            }
            return;
        }

        if (this.beans.length > 0) {
            return;
        }

        if (this.currentGroupIndex >= this.groupedTokens.length) {
            if (this.nextValue > this.maxValue) {
                this.handleWin();
            }
            return;
        }

        const group = this.groupedTokens[this.currentGroupIndex];
        group.forEach((token) => this.spawnBean(token));
        this.currentGroupIndex += 1;
    }

    private spawnBean(token: SequenceToken): void {
        const cell = this.randomFreeCell();
        if (!cell) {
            this.handleWin();
            return;
        }

        const bean: Bean = { cell, value: token.order, label: token.label };
        this.beans.push(bean);
        this.occupancy.add(this.cellKey(cell));
    }

    private randomFreeCell(): Cell | null {
        const freeCells: Cell[] = [];
        for (let x = 0; x < GRID_WIDTH; x += 1) {
            for (let y = 0; y < GRID_HEIGHT; y += 1) {
                const candidate: Cell = { x, y };
                if (!this.occupancy.has(this.cellKey(candidate))) {
                    freeCells.push(candidate);
                }
            }
        }

        if (freeCells.length === 0) {
            return null;
        }

        const index = this.rng.between(0, freeCells.length - 1);
        return freeCells[index];
    }

    private findBeanIndex(cell: Cell): number {
        return this.beans.findIndex((bean) => bean.cell.x === cell.x && bean.cell.y === cell.y);
    }

    private draw(): void {
        this.updateSnakeSprites();
        this.updateBeanSprites();
    }

    private updateSnakeSprites(): void {
        const offsetX = PLAYFIELD_PADDING_X + CELL_SIZE / 2;
        const offsetY = PLAYFIELD_PADDING_Y + CELL_SIZE / 2;
        for (let i = 0; i < this.snake.length; i += 1) {
            const segment = this.snake[i];
            const sprite = this.getSnakeSprite(i);
            sprite.setTexture(i === 0 ? 'snake-head' : 'snake-body');
            sprite.setPosition(segment.x * CELL_SIZE + offsetX, segment.y * CELL_SIZE + offsetY);
            sprite.setVisible(true);
            sprite.setActive(true);
        }

        for (let i = this.snake.length; i < this.snakeSprites.length; i += 1) {
            const sprite = this.snakeSprites[i];
            sprite.setVisible(false);
            sprite.setActive(false);
        }
    }

    private updateBeanSprites(): void {
        const offsetX = PLAYFIELD_PADDING_X + CELL_SIZE / 2;
        const offsetY = PLAYFIELD_PADDING_Y + CELL_SIZE / 2;
        for (let i = 0; i < this.beans.length; i += 1) {
            const bean = this.beans[i];
            const sprite = this.getBeanSprite(i);
            const centerX = bean.cell.x * CELL_SIZE + offsetX;
            const centerY = bean.cell.y * CELL_SIZE + offsetY;
            sprite.setPosition(centerX, centerY);
            sprite.setVisible(true);
            sprite.setActive(true);

            const label = this.getBeanLabel(i);
            label.setPosition(centerX, centerY + 2);
            label.setText(bean.label);
            label.setVisible(true);
            label.setActive(true);
        }

        for (let i = this.beans.length; i < this.beanSprites.length; i += 1) {
            const sprite = this.beanSprites[i];
            sprite.setVisible(false);
            sprite.setActive(false);
        }

        for (let i = this.beans.length; i < this.beanLabels.length; i += 1) {
            const label = this.beanLabels[i];
            label.setVisible(false);
            label.setActive(false);
        }
    }

    private hideSnakeSprites(): void {
        this.snakeSprites.forEach((sprite) => {
            sprite.setVisible(false);
            sprite.setActive(false);
        });
    }

    private hideBeanViews(): void {
        this.beanSprites.forEach((sprite) => {
            sprite.setVisible(false);
            sprite.setActive(false);
        });
        this.beanLabels.forEach((label) => {
            label.setVisible(false);
            label.setActive(false);
        });
    }

    private getSnakeSprite(index: number): Phaser.GameObjects.Sprite {
        let sprite = this.snakeSprites[index];
        if (!sprite) {
            sprite = this.add.sprite(0, 0, 'snake-body');
            sprite.setOrigin(0.5);
            sprite.setDisplaySize(CELL_SIZE, CELL_SIZE);
            sprite.setDepth(3);
            sprite.setVisible(false);
            sprite.setActive(false);
            this.snakeSprites[index] = sprite;
        }
        return sprite;
    }

    private getBeanSprite(index: number): Phaser.GameObjects.Sprite {
        let sprite = this.beanSprites[index];
        if (!sprite) {
            sprite = this.add.sprite(0, 0, 'bean');
            sprite.setOrigin(0.5);
            sprite.setDisplaySize(CELL_SIZE * 0.85, CELL_SIZE * 0.85);
            sprite.setDepth(4);
            sprite.setVisible(false);
            sprite.setActive(false);
            this.beanSprites[index] = sprite;
        }
        return sprite;
    }

    private getBeanLabel(index: number): Phaser.GameObjects.Text {
        let label = this.beanLabels[index];
        if (!label) {
            label = this.add.text(0, 0, '', {
                fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
                fontSize: '26px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#b65b1f',
                strokeThickness: 6,
                align: 'center'
            });
            label.setOrigin(0.5);
            label.setDepth(5);
            label.setShadow(2, 2, 'rgba(0,0,0,0.25)', 0, true, true);
            this.beanLabels[index] = label;
        }
        return label;
    }

    private isSameDirection(a: Cell, b: Cell): boolean {
        return a.x === b.x && a.y === b.y;
    }

    private isOpposite(a: Cell, b: Cell): boolean {
        return a.x === -b.x && a.y === -b.y;
    }

    private cellKey(cell: Cell): string {
        return `${cell.x},${cell.y}`;
    }

    private updateScoreText(): void {
        if (!this.contentReady) {
            this.scoreText.setText('正在加载素材...');
            this.updateScoreLayout();
            return;
        }

        const lines: string[] = [];
        lines.push(`难度：${this.difficultyLabel || '未知'}`);
        lines.push(`得分：${this.score} (最佳：${this.bestScore})`);

        if (this.maxValue === 0) {
            lines.push('暂无可收集的目标');
        } else {
            const nextToken = this.getNextToken();
            const progressCount = Math.min(this.nextValue - 1, this.maxValue);
            const progressText = `进度：${progressCount} / ${this.maxValue}`;

            if (nextToken) {
                if (this.mode === 'poem') {
                    const lineNo = nextToken.group + 1;
                    const charNo = nextToken.indexInGroup + 1;
                    lines.push(`下一目标：${nextToken.label}（第${lineNo}行第${charNo}字）`);
                    const currentLine = this.poemLines[nextToken.group];
                    if (currentLine) {
                        lines.push(`当前诗句：${currentLine}`);
                    }
                    lines.push(progressText);
                } else {
                    lines.push(`下一目标：${nextToken.label}`);
                    lines.push(progressText);
                }
            } else {
                lines.push('古诗全部收集完成！');
                lines.push(progressText);
            }
        }

        this.scoreText.setText(lines.join('\n'));
        this.updateScoreLayout();
    }

    private getNextToken(): SequenceToken | undefined {
        if (!this.contentReady) {
            return undefined;
        }
        if (this.nextValue < 1 || this.nextValue > this.sequenceTokens.length) {
            return undefined;
        }
        return this.sequenceTokens[this.nextValue - 1];
    }

    private updateScoreLayout(): void {
        const width = this.scoreText.displayWidth;
        const height = this.scoreText.displayHeight;
        const x = Math.floor(PLAYFIELD_PADDING_X + (GAME_WIDTH - width) / 2);
        const y = Math.max(16, Math.floor(PLAYFIELD_PADDING_Y - height - 16));
        this.scoreText.setPosition(x, y);
    }

    private loadBestScore(): number {
        if (typeof window === 'undefined' || !window.localStorage) {
            return 0;
        }

        const key = this.bestScoreKey;
        const raw = key ? window.localStorage.getItem(key) : null;
        if (!raw) {
            return 0;
        }

        const value = Number.parseInt(raw, 10);
        return Number.isFinite(value) ? value : 0;
    }

    private saveBestScore(value: number): void {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }

        if (!this.bestScoreKey) {
            return;
        }

        window.localStorage.setItem(this.bestScoreKey, value.toString());
    }
}
