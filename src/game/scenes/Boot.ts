import Phaser, { Scene } from 'phaser';

export class Boot extends Scene
{
    constructor ()
    {
        super('Boot');
    }

    preload ()
    {
        this.createPreloaderBackground();
    }

    create ()
    {
        this.scene.start('Preloader');
    }
    private createPreloaderBackground(): void
    {
        const key = 'background';
        if (this.textures.exists(key))
        {
            return;
        }

        const texture = this.textures.createCanvas(key, 1024, 768) as Phaser.Textures.CanvasTexture | null;
        if (!texture)
        {
            throw new Error('Unable to create preloader background texture');
        }

        const ctx = texture.context;

        const gradient = ctx.createLinearGradient(0, 0, 0, texture.height);
        gradient.addColorStop(0, '#b3e5fc');
        gradient.addColorStop(1, '#e3f2fd');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, texture.width, texture.height);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        for (let i = 0; i < 6; i += 1)
        {
            const radius = 70 + i * 12;
            const x = 160 + i * 120;
            const y = 140 + (i % 2) * 28;
            this.drawCloud(ctx, x, y, radius);
        }

        texture.refresh();
    }

    private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void
    {
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
        ctx.arc(x + radius * 0.6, y - radius * 0.2, radius * 0.5, 0, Math.PI * 2);
        ctx.arc(x + radius * 1.1, y + radius * 0.1, radius * 0.65, 0, Math.PI * 2);
        ctx.arc(x - radius * 0.2, y + radius * 0.1, radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
    }
}
