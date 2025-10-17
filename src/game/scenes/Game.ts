import Phaser from 'phaser';

type Cell = { x: number; y: number };

enum GameState {
    Running = 'running',
    Dead = 'dead'
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

export class Game extends Phaser.Scene {
    private graphics!: Phaser.GameObjects.Graphics;
    private scoreText!: Phaser.GameObjects.Text;
    private gameOverText!: Phaser.GameObjects.Text;
    private stepEvent?: Phaser.Time.TimerEvent;

    private snake: Cell[] = [];
    private direction: Cell = { x: 1, y: 0 };
    private directionQueue: Cell[] = [];
    private pendingGrowth = 0;
    private food: Cell = { x: 0, y: 0 };
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

        const startX = Math.floor(GRID_WIDTH / 2);
        const startY = Math.floor(GRID_HEIGHT / 2);

        for (let i = 0; i < INITIAL_LENGTH; i += 1) {
            const segment: Cell = { x: startX - i, y: startY };
            this.snake.push(segment);
            this.occupancy.add(this.cellKey(segment));
        }

        this.spawnFood();
        this.updateScoreText();
        this.draw();
    }

    private handleKeyDown(event: KeyboardEvent): void {
        if (event.code === 'Space') {
            if (this.state === GameState.Dead) {
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
        const tail = this.snake[this.snake.length - 1];
        const willRemoveTail = this.pendingGrowth === 0;
        const tailKey = this.cellKey(tail);

        if (this.occupancy.has(nextKey)) {
            const movingIntoTail = willRemoveTail && nextKey === tailKey;
            if (!movingIntoTail) {
                this.endGame();
                return;
            }
        }

        this.snake.unshift(nextHead);
        this.occupancy.add(nextKey);

        const consumedFood = nextHead.x === this.food.x && nextHead.y === this.food.y;
        if (consumedFood) {
            this.pendingGrowth += 1;
            this.score += 1;
            if (this.score > this.bestScore) {
                this.bestScore = this.score;
                this.saveBestScore(this.bestScore);
            }
            this.spawnFood();
            this.updateScoreText();
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

    private endGame(): void {
        this.state = GameState.Dead;
        this.gameOverText.setVisible(true);
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            this.saveBestScore(this.bestScore);
            this.updateScoreText();
        }
    }

    private spawnFood(): void {
        if (this.occupancy.size >= GRID_WIDTH * GRID_HEIGHT) {
            this.food = { x: -1, y: -1 };
            return;
        }

        const freeCells: Cell[] = [];
        for (let x = 0; x < GRID_WIDTH; x += 1) {
            for (let y = 0; y < GRID_HEIGHT; y += 1) {
                const candidate: Cell = { x, y };
                if (!this.occupancy.has(this.cellKey(candidate))) {
                    freeCells.push(candidate);
                }
            }
        }

        const index = this.rng.between(0, freeCells.length - 1);
        this.food = freeCells[index];
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

        // Draw food (if available)
        if (this.food.x >= 0 && this.food.y >= 0) {
            this.graphics.fillStyle(FOOD_COLOR, 1);
            this.graphics.fillRect(this.food.x * CELL_SIZE, this.food.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
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
        this.scoreText.setText(`Score: ${this.score} (Best: ${this.bestScore})`);
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
