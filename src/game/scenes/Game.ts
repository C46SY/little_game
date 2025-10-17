import Phaser from 'phaser';

const WIDTH = 800;
const HEIGHT = 600;
const CELL = 32;
const GRID_WIDTH = WIDTH / CELL;
const GRID_HEIGHT = HEIGHT / CELL;
const STEP_DELAY = 100; // milliseconds (TPS = 10)
const INITIAL_LENGTH = 3;
const BEST_SCORE_KEY = 'snake-best-score';

type Direction = { x: number; y: number };
type Cell = { x: number; y: number };

enum GameState {
    Running = 'running',
    Dead = 'dead'
}

export class Game extends Phaser.Scene {
    private graphics!: Phaser.GameObjects.Graphics;
    private scoreText!: Phaser.GameObjects.Text;
    private overlayText!: Phaser.GameObjects.Text;

    private snake: Cell[] = [];
    private occupancy: Set<string> = new Set();
    private direction: Direction = { x: 1, y: 0 };
    private inputQueue: Direction[] = [];
    private food: Cell | null = null;
    private pendingGrowth = 0;
    private score = 0;
    private bestScore = 0;
    private state: GameState = GameState.Running;

    constructor() {
        super('Game');
    }

    public init(): void {
        try {
            const stored = window.localStorage.getItem(BEST_SCORE_KEY);
            if (stored) {
                const parsed = Number.parseInt(stored, 10);
                if (!Number.isNaN(parsed)) {
                    this.bestScore = parsed;
                }
            }
        } catch (error) {
            // Access to localStorage may fail in certain environments (e.g. private mode)
            // Keep the best score at the default value when that happens.
            this.bestScore = 0;
        }
    }

    public create(): void {
        this.cameras.main.setBackgroundColor('#101018');

        this.graphics = this.add.graphics();
        this.graphics.setDepth(0);

        this.scoreText = this.add.text(16, 16, '', {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#ffffff'
        });
        this.scoreText.setDepth(1);

        this.overlayText = this.add.text(WIDTH / 2, HEIGHT / 2, 'Game Over\nPress SPACE to restart', {
            fontFamily: 'monospace',
            fontSize: '32px',
            color: '#ffffff',
            align: 'center'
        });
        this.overlayText.setOrigin(0.5);
        this.overlayText.setDepth(2);
        this.overlayText.setVisible(false);

        this.input.keyboard?.on('keydown', this.handleDirectionalInput, this);
        this.input.keyboard?.on('keydown-SPACE', this.handleRestart, this);

        this.time.addEvent({
            delay: STEP_DELAY,
            callback: this.step,
            callbackScope: this,
            loop: true
        });

        this.reset();
    }

    private reset(): void {
        this.snake = [];
        this.occupancy.clear();
        this.direction = { x: 1, y: 0 };
        this.inputQueue = [];
        this.pendingGrowth = 0;
        this.score = 0;
        this.state = GameState.Running;
        this.overlayText.setVisible(false);

        const startX = Math.floor(GRID_WIDTH / 2);
        const startY = Math.floor(GRID_HEIGHT / 2);
        for (let i = 0; i < INITIAL_LENGTH; i += 1) {
            const cell = { x: startX - i, y: startY };
            this.snake.push(cell);
            this.occupancy.add(this.key(cell.x, cell.y));
        }

        this.updateScoreText();
        this.spawnFood();
        this.draw();
    }

    private handleDirectionalInput(event: KeyboardEvent): void {
        if (this.state === GameState.Dead) {
            return;
        }

        const direction = this.directionFromKey(event.code);
        if (!direction) {
            return;
        }

        const lastQueued = this.inputQueue[this.inputQueue.length - 1] ?? this.direction;
        if (this.isOpposite(direction, lastQueued)) {
            return;
        }

        if (direction.x === lastQueued.x && direction.y === lastQueued.y) {
            return;
        }

        this.inputQueue.push(direction);
    }

    private handleRestart(): void {
        if (this.state === GameState.Dead) {
            this.reset();
        }
    }

    private step(): void {
        if (this.state !== GameState.Running) {
            return;
        }

        if (this.inputQueue.length > 0) {
            this.direction = this.inputQueue.shift()!;
        }

        const head = this.snake[0];
        const nextHead = { x: head.x + this.direction.x, y: head.y + this.direction.y };

        if (!this.inBounds(nextHead.x, nextHead.y)) {
            this.handleDeath();
            return;
        }

        const nextKey = this.key(nextHead.x, nextHead.y);
        const tail = this.snake[this.snake.length - 1];
        const tailKey = this.key(tail.x, tail.y);
        const eating = this.food !== null && nextHead.x === this.food.x && nextHead.y === this.food.y;
        const willGrow = this.pendingGrowth > 0 || eating;

        if (this.occupancy.has(nextKey) && !( !willGrow && nextKey === tailKey)) {
            this.handleDeath();
            return;
        }

        this.snake.unshift(nextHead);
        this.occupancy.add(nextKey);

        if (eating) {
            this.pendingGrowth += 1;
            this.score += 1;
            if (this.score > this.bestScore) {
                this.bestScore = this.score;
                try {
                    window.localStorage.setItem(BEST_SCORE_KEY, this.bestScore.toString());
                } catch (error) {
                    // Ignore write errors silently.
                }
            }
            this.updateScoreText();
            this.spawnFood();
        }

        let grewThisStep = false;
        if (this.pendingGrowth > 0) {
            this.pendingGrowth -= 1;
            grewThisStep = true;
        }

        if (!grewThisStep) {
            const removed = this.snake.pop();
            if (removed) {
                this.occupancy.delete(this.key(removed.x, removed.y));
            }
        }

        this.draw();
    }

    private handleDeath(): void {
        this.state = GameState.Dead;
        this.overlayText.setVisible(true);
    }

    private spawnFood(): void {
        const freeCells: Cell[] = [];
        for (let y = 0; y < GRID_HEIGHT; y += 1) {
            for (let x = 0; x < GRID_WIDTH; x += 1) {
                const key = this.key(x, y);
                if (!this.occupancy.has(key)) {
                    freeCells.push({ x, y });
                }
            }
        }

        if (freeCells.length === 0) {
            this.food = null;
            return;
        }

        const index = Phaser.Math.Between(0, freeCells.length - 1);
        this.food = freeCells[index];
    }

    private draw(): void {
        this.graphics.clear();

        if (this.food) {
            this.graphics.fillStyle(0xff4f5a, 1);
            this.graphics.fillRect(this.food.x * CELL, this.food.y * CELL, CELL, CELL);
        }

        if (this.snake.length > 0) {
            const head = this.snake[0];
            this.graphics.fillStyle(0x9bfca9, 1);
            this.graphics.fillRect(head.x * CELL, head.y * CELL, CELL, CELL);

            this.graphics.fillStyle(0x3ad37a, 1);
            for (let i = 1; i < this.snake.length; i += 1) {
                const segment = this.snake[i];
                this.graphics.fillRect(segment.x * CELL, segment.y * CELL, CELL, CELL);
            }
        }
    }

    private updateScoreText(): void {
        this.scoreText.setText(`Score: ${this.score}\nBest: ${this.bestScore}`);
    }

    private inBounds(x: number, y: number): boolean {
        return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
    }

    private key(x: number, y: number): string {
        return `${x},${y}`;
    }

    private directionFromKey(code: string): Direction | null {
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

    private isOpposite(a: Direction, b: Direction): boolean {
        return a.x === -b.x && a.y === -b.y;
    }
}
