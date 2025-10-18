import Phaser from 'phaser';
import {
    CELL_SIZE,
    GAME_HEIGHT,
    GAME_WIDTH,
    GRID_HEIGHT,
    GRID_WIDTH,
    PLAYFIELD_HEIGHT,
    PLAYFIELD_PADDING_X,
    PLAYFIELD_PADDING_Y,
    PLAYFIELD_WIDTH
} from '../constants';

export function createGameTextures(scene: Phaser.Scene): void {
    createPlayfieldTexture(scene);
    createSnakeBodyTexture(scene);
    createSnakeHeadTexture(scene);
    createBeanTexture(scene);
}

function createPlayfieldTexture(scene: Phaser.Scene): void {
    const key = 'playfield';
    if (scene.textures.exists(key)) {
        return;
    }

    const texture = ensureCanvasTexture(scene.textures.createCanvas(key, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT), key);
    const ctx = texture.context;

    ctx.fillStyle = '#d4f0ff';
    ctx.fillRect(0, 0, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT);

    drawRoundedRect(ctx, PLAYFIELD_PADDING_X - 24, PLAYFIELD_PADDING_Y - 24, GAME_WIDTH + 48, GAME_HEIGHT + 48, 48, '#ffffff', '#9dd7ff', 6);
    drawRoundedRect(ctx, PLAYFIELD_PADDING_X, PLAYFIELD_PADDING_Y, GAME_WIDTH, GAME_HEIGHT, 36, '#f8fbff', '#7ec9ff', 4);

    ctx.strokeStyle = 'rgba(126, 201, 255, 0.35)';
    ctx.lineWidth = 2;
    for (let gx = 1; gx < GRID_WIDTH; gx += 1) {
        const x = PLAYFIELD_PADDING_X + gx * CELL_SIZE;
        ctx.beginPath();
        ctx.moveTo(x, PLAYFIELD_PADDING_Y + 8);
        ctx.lineTo(x, PLAYFIELD_PADDING_Y + GAME_HEIGHT - 8);
        ctx.stroke();
    }

    for (let gy = 1; gy < GRID_HEIGHT; gy += 1) {
        const y = PLAYFIELD_PADDING_Y + gy * CELL_SIZE;
        ctx.beginPath();
        ctx.moveTo(PLAYFIELD_PADDING_X + 8, y);
        ctx.lineTo(PLAYFIELD_PADDING_X + GAME_WIDTH - 8, y);
        ctx.stroke();
    }

    drawCloud(ctx, 120, 120, 70, '#ffffff');
    drawCloud(ctx, PLAYFIELD_WIDTH - 160, 200, 90, '#ffffff');
    drawStar(ctx, 160, PLAYFIELD_HEIGHT - 150, 30, '#ffd166');
    drawStar(ctx, PLAYFIELD_WIDTH - 120, PLAYFIELD_HEIGHT - 200, 26, '#ffd166');

    texture.refresh();
}

function createSnakeBodyTexture(scene: Phaser.Scene): void {
    const key = 'snake-body';
    if (scene.textures.exists(key)) {
        return;
    }

    const texture = ensureCanvasTexture(scene.textures.createCanvas(key, CELL_SIZE, CELL_SIZE), key);
    const ctx = texture.context;

    drawRoundedRect(ctx, 0, 0, CELL_SIZE, CELL_SIZE, CELL_SIZE * 0.35, '#5ad776', '#2f9e56', 4);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(CELL_SIZE * 0.2, CELL_SIZE * 0.3);
    ctx.quadraticCurveTo(CELL_SIZE * 0.5, CELL_SIZE * 0.1, CELL_SIZE * 0.8, CELL_SIZE * 0.3);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(CELL_SIZE * 0.2, CELL_SIZE * 0.6);
    ctx.quadraticCurveTo(CELL_SIZE * 0.5, CELL_SIZE * 0.8, CELL_SIZE * 0.8, CELL_SIZE * 0.6);
    ctx.stroke();

    texture.refresh();
}

function createSnakeHeadTexture(scene: Phaser.Scene): void {
    const key = 'snake-head';
    if (scene.textures.exists(key)) {
        return;
    }

    const texture = ensureCanvasTexture(scene.textures.createCanvas(key, CELL_SIZE, CELL_SIZE), key);
    const ctx = texture.context;

    drawRoundedRect(ctx, 0, 0, CELL_SIZE, CELL_SIZE, CELL_SIZE * 0.42, '#77e39a', '#3fba6e', 5);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(CELL_SIZE * 0.35, CELL_SIZE * 0.4, CELL_SIZE * 0.16, CELL_SIZE * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(CELL_SIZE * 0.65, CELL_SIZE * 0.4, CELL_SIZE * 0.16, CELL_SIZE * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(CELL_SIZE * 0.37, CELL_SIZE * 0.41, CELL_SIZE * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CELL_SIZE * 0.63, CELL_SIZE * 0.41, CELL_SIZE * 0.07, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.moveTo(CELL_SIZE * 0.5, CELL_SIZE * 0.7);
    ctx.lineTo(CELL_SIZE * 0.45, CELL_SIZE * 0.9);
    ctx.lineTo(CELL_SIZE * 0.55, CELL_SIZE * 0.9);
    ctx.closePath();
    ctx.fill();

    texture.refresh();
}

function createBeanTexture(scene: Phaser.Scene): void {
    const key = 'bean';
    if (scene.textures.exists(key)) {
        return;
    }

    const size = Math.floor(CELL_SIZE * 0.85);
    const texture = ensureCanvasTexture(scene.textures.createCanvas(key, size, size), key);
    const ctx = texture.context;

    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, '#ffdd8a');
    gradient.addColorStop(1, '#ffb347');

    drawRoundedRect(ctx, 0, 0, size, size, size * 0.35, gradient, '#f08a24', 4);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(size * 0.35, size * 0.35, size * 0.18, size * 0.12, -0.6, 0, Math.PI * 2);
    ctx.fill();

    texture.refresh();
}

function ensureCanvasTexture(
    texture: Phaser.Textures.CanvasTexture | null,
    key: string
): Phaser.Textures.CanvasTexture {
    if (!texture) {
        throw new Error(`Failed to create canvas texture: ${key}`);
    }
    return texture;
}

function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill: string | CanvasGradient,
    stroke?: string,
    strokeWidth = 0
): void {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fillStyle = fill;
    ctx.fill();

    if (stroke && strokeWidth > 0) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
    }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
    ctx.arc(x + radius * 0.6, y - radius * 0.2, radius * 0.5, 0, Math.PI * 2);
    ctx.arc(x + radius * 1.1, y + radius * 0.1, radius * 0.65, 0, Math.PI * 2);
    ctx.arc(x + radius * 0.3, y + radius * 0.3, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
    const spikes = 5;
    const outerRadius = radius;
    const innerRadius = radius * 0.45;
    let rot = Math.PI / 2 * 3;
    let cx = x;
    let cy = y;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i += 1) {
        cx = x + Math.cos(rot) * outerRadius;
        cy = y + Math.sin(rot) * outerRadius;
        ctx.lineTo(cx, cy);
        rot += Math.PI / spikes;

        cx = x + Math.cos(rot) * innerRadius;
        cy = y + Math.sin(rot) * innerRadius;
        ctx.lineTo(cx, cy);
        rot += Math.PI / spikes;
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}
