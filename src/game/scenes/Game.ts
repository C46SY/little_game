import Phaser from 'phaser';

type Cell = { x: number; y: number };
type Bean = { cell: Cell; value: number };

enum GameState {
    Running = 'running',
    Dead = 'dead',
    Win = 'win'
}

const CELL_SIZE = 32;
const GRID_WIDTH = 25;
const GRID_HEIGHT = 18;
const GAME_WIDTH = GRID_WIDTH * CELL_SIZE;
const GAME_HEIGHT = GRID_HEIGHT * CELL_SIZE;
const STEP_DELAY = 100; // milliseconds, 10 ticks per second
const INITIAL_LENGTH = 3;
const BEST_SCORE_KEY = 'snake-best-score';
const HEAD_COLOR = 0x7af077;
const BODY_COLOR = 0x3a9b3a;
const FOOD_COLOR = 0xf04e4e;
const INITIAL_BEAN_COUNT = 3;

export class Game extends Phaser.Scene {
    private graphics!: Phaser.GameObjects.Graphics;
    private scoreText!: Phaser.GameObjects.Text;
    private gameOverText!: Phaser.GameObjects.Text;
    private stepEvent?: Phaser.Time.TimerEvent;

    private snake: Cell[] = [];
    private direction: Cell = { x: 1, y: 0 };
    private directionQueue: Cell[] = [];
    private pendingGrowth = 0;
    private beans: Bean[] = [];
    private nextValue = 1;
    private nextSpawnValue = 1;
    private maxValue = 20;
    private beanTexts: Phaser.GameObjects.Text[] = [];
    private occupancy: Set<string> = new Set();
    private score = 0;
    private bestScore = 0;
    private state: GameState = GameState.Running;
    private rng!: Phaser.Math.RandomDataGenerator;

    constructor() {
        super('Game');
    }

    public init(): void {
        this.rng = new Phaser.Math.RandomDataGenerator([Date.now().toString()]);
        this.bestScore = this.loadBestScore();
    }

    public create(): void {
        this.graphics = this.add.graphics();
        this.graphics.setDepth(1);

        this.scoreText = this.add.text(16, 16, '', {
            fontFamily: 'monospace',
            fontSize: '24px',
            color: '#ffffff'
        });

        this.gameOverText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Game Over\nPress SPACE to restart', {
            fontFamily: 'monospace',
            fontSize: '48px',
            color: '#ff9d9d',
            align: 'center'
        });
        this.gameOverText.setOrigin(0.5);
        this.gameOverText.setVisible(false);

        const keyboard = this.input.keyboard;
        keyboard?.on('keydown', this.handleKeyDown, this);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            keyboard?.off('keydown', this.handleKeyDown, this);
            this.stepEvent?.destroy();
            this.clearBeanTexts();
        });

        this.resetGame();

        this.stepEvent = this.time.addEvent({
            delay: STEP_DELAY,
            loop: true,
            callback: this.step,
            callbackScope: this
        });
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
        this.clearBeanTexts();
        this.nextValue = 1;
        this.nextSpawnValue = 1;
        this.maxValue = 20;

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
            this.refreshBeanTexts();
            this.pendingGrowth += 1;
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

        let added = false;
        while (this.beans.length < INITIAL_BEAN_COUNT && this.nextSpawnValue <= this.maxValue) {
            const cell = this.randomFreeCell();
            if (!cell) {
                this.handleWin();
                return;
            }

            this.beans.push({ cell, value: this.nextSpawnValue });
            this.occupancy.add(this.cellKey(cell));
            this.nextSpawnValue += 1;
            added = true;
        }

        if (added) {
            this.refreshBeanTexts();
        }

        if (this.nextValue > this.maxValue && this.beans.length === 0) {
            this.handleWin();
        }
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

    private clearBeanTexts(): void {
        this.beanTexts.forEach((text) => text.destroy());
        this.beanTexts = [];
    }

    private refreshBeanTexts(): void {
        this.clearBeanTexts();
        this.beans.forEach((bean) => {
            const label = this.add.text(
                bean.cell.x * CELL_SIZE + CELL_SIZE / 2,
                bean.cell.y * CELL_SIZE + CELL_SIZE / 2,
                bean.value.toString(),
                {
                    fontFamily: 'monospace',
                    fontSize: '18px',
                    color: '#ffffff'
                }
            );
            label.setOrigin(0.5);
            label.setDepth(2);
            label.setScrollFactor(0);
            this.beanTexts.push(label);
        });
    }

    private draw(): void {
        this.graphics.clear();

        // Draw snake body
        for (let i = this.snake.length - 1; i >= 0; i -= 1) {
            const segment = this.snake[i];
            const color = i === 0 ? HEAD_COLOR : BODY_COLOR;
            this.graphics.fillStyle(color, 1);
            this.graphics.fillRect(segment.x * CELL_SIZE, segment.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }

        // Draw beans
        this.beans.forEach((bean) => {
            this.graphics.fillStyle(FOOD_COLOR, 1);
            this.graphics.fillRect(bean.cell.x * CELL_SIZE, bean.cell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        });
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
        const progress = this.nextValue <= this.maxValue
            ? `Next: ${this.nextValue} / ${this.maxValue}`
            : `Completed: ${this.maxValue} / ${this.maxValue}`;
        this.scoreText.setText(`Score: ${this.score} (Best: ${this.bestScore})\n${progress}`);
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
