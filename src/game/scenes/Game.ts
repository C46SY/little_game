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
import { DifficultyDefinition, DifficultyId, getDifficulty } from '../utils/difficulty';
import { PoemContent, parsePoemText } from '../utils/poemLoader';
import { createGameTextures } from '../utils/textureFactory';

type Cell = { x: number; y: number };
type Bean = { cell: Cell; tokenIndex: number; label: string };

enum GameState {
    Running = 'running',
    Dead = 'dead',
    Win = 'win'
}

const STEP_DELAY = 150; // milliseconds, ~6.5 ticks per second
const INITIAL_LENGTH = 3;
const BEST_SCORE_KEY = 'snake-best-score';
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
    private nextTokenIndex = 0;
    private nextSpawnIndex = 0;
    private totalTokens = 20;
    private spawnBatchSize = INITIAL_BEAN_COUNT;
    private difficultyId: DifficultyId = 'demo';
    private difficulty?: DifficultyDefinition;
    private mode: 'numbers' | 'poem' = 'numbers';
    private poemContent?: PoemContent;
    private poemLineSpawnIndex = 0;
    private occupancy: Set<string> = new Set();
    private score = 0;
    private bestScore = 0;
    private state: GameState = GameState.Running;
    private rng!: Phaser.Math.RandomDataGenerator;

    constructor() {
        super('Game');
    }

    public init(data?: { difficulty?: DifficultyId }): void {
        if (data?.difficulty) {
            this.difficultyId = data.difficulty;
        }
        this.rng = new Phaser.Math.RandomDataGenerator([Date.now().toString()]);
        this.bestScore = this.loadBestScore();
        this.difficulty = getDifficulty(this, this.difficultyId);
    }

    public preload(): void {
        if (this.difficulty?.mode === 'poem' && this.difficulty.resource) {
            this.load.setPath('assets');
            this.load.text(this.getPoemCacheKey(), this.difficulty.resource);
        }
    }

    public create(): void {
        createGameTextures(this);

        this.add.image(PLAYFIELD_WIDTH / 2, PLAYFIELD_HEIGHT / 2, 'playfield').setDepth(0);

        this.scoreText = this.add.text(0, 0, '', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: '28px',
            color: '#2c3e50',
            align: 'left'
        });
        this.scoreText.setPadding(18, 12, 18, 12);
        this.scoreText.setBackgroundColor('rgba(255,255,255,0.85)');
        this.scoreText.setShadow(2, 2, 'rgba(154, 208, 245, 0.6)', 0, true, true);
        this.scoreText.setDepth(5);

        this.gameOverText = this.add.text(PLAYFIELD_WIDTH / 2, PLAYFIELD_HEIGHT / 2, 'Game Over\nPress SPACE to restart', {
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

        this.configureDifficulty();
        this.resetGame();

        this.stepEvent = this.time.addEvent({
            delay: STEP_DELAY,
            loop: true,
            callback: this.step,
            callbackScope: this
        });
    }

    private configureDifficulty(): void {
        this.mode = this.difficulty?.mode ?? 'numbers';
        this.spawnBatchSize = this.difficulty?.initialBeans ?? INITIAL_BEAN_COUNT;
        this.poemContent = undefined;
        this.totalTokens = this.difficulty?.maxValue ?? 20;
        this.nextTokenIndex = 0;
        this.nextSpawnIndex = 0;
        this.poemLineSpawnIndex = 0;

        if (this.mode === 'poem') {
            const cacheKey = this.getPoemCacheKey();
            const raw = this.cache.text.get(cacheKey) as string | undefined;
            if (!raw || raw.length === 0) {
                console.warn(`未能加载难度 "${this.difficultyId}" 的诗词资源。`);
                this.totalTokens = 0;
                return;
            }
            this.poemContent = parsePoemText(raw, this.difficulty?.meterHint);
            this.totalTokens = this.poemContent.totalCharacters;
        }
    }

    private resetGame(): void {
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
        this.nextTokenIndex = 0;
        this.nextSpawnIndex = 0;
        this.poemLineSpawnIndex = 0;
        this.totalTokens = this.mode === 'numbers'
            ? (this.difficulty?.maxValue ?? this.totalTokens)
            : (this.poemContent?.totalCharacters ?? this.totalTokens);

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
            if (bean.tokenIndex !== this.nextTokenIndex) {
                this.endGame('顺序错误');
                return;
            }
            this.occupancy.delete(nextKey);
        }

        this.snake.unshift(nextHead);
        this.occupancy.add(nextKey);

        if (beanIndex !== -1) {
            this.beans.splice(beanIndex, 1);
            if (this.snake.length + this.pendingGrowth < MAX_SNAKE_LENGTH) {
                this.pendingGrowth += 1;
            }
            this.score += 1;
            this.nextTokenIndex += 1;
            if (this.score > this.bestScore) {
                this.bestScore = this.score;
                this.saveBestScore(this.bestScore);
            }
            this.updateScoreText();
            this.refillBeans();
            if (this.state !== GameState.Running) {
                return;
            }
            if (this.nextTokenIndex >= this.totalTokens && this.beans.length === 0) {
                this.handleWin();
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
            this.gameOverText.setText(`${reason}\nPress SPACE to restart`);
        } else {
            this.gameOverText.setText('Game Over\nPress SPACE to restart');
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
        this.gameOverText.setText('You Win!\nPress SPACE to restart');
        this.gameOverText.setVisible(true);
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            this.saveBestScore(this.bestScore);
        }
        this.updateScoreText();
    }

    private refillBeans(): void {
        if (this.state !== GameState.Running) {
            return;
        }

        if (this.mode === 'poem') {
            this.refillPoemBeans();
        } else {
            this.refillNumberBeans();
        }
    }

    private refillNumberBeans(): void {
        while (this.beans.length < this.spawnBatchSize && this.nextSpawnIndex < this.totalTokens) {
            const cell = this.randomFreeCell();
            if (!cell) {
                this.handleWin();
                return;
            }

            const tokenIndex = this.nextSpawnIndex;
            const label = (tokenIndex + 1).toString();
            this.beans.push({ cell, tokenIndex, label });
            this.occupancy.add(this.cellKey(cell));
            this.nextSpawnIndex += 1;
        }
    }

    private refillPoemBeans(): void {
        if (!this.poemContent) {
            return;
        }
        if (this.beans.length > 0) {
            return;
        }
        if (this.poemLineSpawnIndex >= this.poemContent.lines.length) {
            return;
        }

        const line = this.poemContent.lines[this.poemLineSpawnIndex];
        for (let i = 0; i < line.length; i += 1) {
            const cell = this.randomFreeCell();
            if (!cell) {
                this.handleWin();
                return;
            }
            const tokenIndex = this.nextSpawnIndex;
            const label = line[i];
            this.beans.push({ cell, tokenIndex, label });
            this.occupancy.add(this.cellKey(cell));
            this.nextSpawnIndex += 1;
        }

        this.poemLineSpawnIndex += 1;
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
                fontSize: '22px',
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
        const difficultyLabel = this.difficulty?.label ?? this.difficultyId;
        const tokensTotal = Math.max(this.totalTokens, 1);
        const header = `得分: ${this.score} (最佳: ${this.bestScore})`;

        if (this.mode === 'poem') {
            const poemTitle = this.difficulty?.title ?? '诗词模式';
            const poemAuthor = this.difficulty?.author ? ` · ${this.difficulty?.author}` : '';
            const poemInfo = `诗词: ${poemTitle}${poemAuthor}`;
            if (!this.poemContent || this.totalTokens === 0) {
                this.scoreText.setText(`${header}\n难度: ${difficultyLabel}\n${poemInfo}\n进度: 未能加载诗词内容`);
            } else {
                const progressText = this.getPoemProgressText();
                const nextLabel = this.getNextTokenLabel();
                const stepInfo = `${Math.min(this.nextTokenIndex + 1, tokensTotal)} / ${tokensTotal}`;
                this.scoreText.setText(`${header}\n难度: ${difficultyLabel}\n${poemInfo}\n${progressText}\n下一字: ${nextLabel} (${stepInfo})`);
            }
        } else {
            const nextLabel = this.getNextTokenLabel();
            const stepInfo = `${Math.min(this.nextTokenIndex + 1, tokensTotal)} / ${tokensTotal}`;
            this.scoreText.setText(`${header}\n难度: ${difficultyLabel}\n下一个: ${nextLabel} (${stepInfo})`);
        }
        this.updateScoreLayout();
    }

    private updateScoreLayout(): void {
        const width = this.scoreText.displayWidth;
        const height = this.scoreText.displayHeight;
        const x = Math.floor(PLAYFIELD_PADDING_X + (GAME_WIDTH - width) / 2);
        const y = Math.max(16, Math.floor(PLAYFIELD_PADDING_Y - height - 16));
        this.scoreText.setPosition(x, y);
    }

    private getPoemProgressText(): string {
        if (!this.poemContent || this.poemContent.lines.length === 0) {
            return '进度: 暂无可用诗句';
        }
        if (this.totalTokens === 0) {
            return '进度: 0 / 0';
        }

        const totalLines = this.poemContent.lines.length;
        const isComplete = this.nextTokenIndex >= this.totalTokens;
        const targetIndex = isComplete ? this.totalTokens - 1 : this.nextTokenIndex;
        const clampedIndex = Math.max(targetIndex, 0);
        const { lineIndex, charIndex } = this.getPoemLineInfo(clampedIndex);
        const lineNumber = Math.min(lineIndex + 1, totalLines);
        const line = this.poemContent.lines[lineIndex] ?? [];
        const lineLength = line.length > 0 ? line.length : this.poemContent.lineLength;
        const charPosition = isComplete ? line.length : charIndex + 1;
        const charText = lineLength > 0 ? `• 第${Math.min(charPosition, lineLength)}字 / ${lineLength}字` : '';
        return `进度: 第${lineNumber}行 / ${totalLines}行 ${charText}`.trim();
    }

    private getNextTokenLabel(): string {
        if (this.nextTokenIndex >= this.totalTokens) {
            return '完成';
        }
        if (this.mode === 'poem' && this.poemContent) {
            const { lineIndex, charIndex } = this.getPoemLineInfo(this.nextTokenIndex);
            const line = this.poemContent.lines[lineIndex];
            if (line && charIndex >= 0 && charIndex < line.length) {
                return line[charIndex];
            }
            return '完成';
        }
        return (this.nextTokenIndex + 1).toString();
    }

    private getPoemLineInfo(tokenIndex: number): { lineIndex: number; charIndex: number } {
        if (!this.poemContent || this.poemContent.lines.length === 0) {
            return { lineIndex: 0, charIndex: 0 };
        }

        let remaining = tokenIndex;
        for (let lineIndex = 0; lineIndex < this.poemContent.lines.length; lineIndex += 1) {
            const line = this.poemContent.lines[lineIndex];
            if (remaining < line.length) {
                return { lineIndex, charIndex: Math.max(0, remaining) };
            }
            remaining -= line.length;
        }

        const lastIndex = this.poemContent.lines.length - 1;
        const lastLine = this.poemContent.lines[lastIndex];
        return {
            lineIndex: lastIndex,
            charIndex: Math.max(0, (lastLine?.length ?? 1) - 1)
        };
    }

    private getPoemCacheKey(): string {
        return `poem-${this.difficultyId}`;
    }

    private loadBestScore(): number {
        if (typeof window === 'undefined' || !window.localStorage) {
            return 0;
        }

        const raw = window.localStorage.getItem(BEST_SCORE_KEY);
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

        window.localStorage.setItem(BEST_SCORE_KEY, value.toString());
    }
}
