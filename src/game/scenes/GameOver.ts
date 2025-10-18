import { Scene } from 'phaser';

export class GameOver extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameover_text : Phaser.GameObjects.Text;

    constructor ()
    {
        super('GameOver');
    }

    create ()
    {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0xfdf6ff);

        this.background = this.add.image(512, 384, 'playfield');
        this.background.setAlpha(0.7);

        this.gameover_text = this.add.text(512, 360, '游戏结束', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 64,
            color: '#ff6b81',
            align: 'center',
            backgroundColor: 'rgba(255,255,255,0.9)'
        });
        this.gameover_text.setOrigin(0.5);
        this.gameover_text.setPadding(24, 16, 24, 16);
        this.gameover_text.setShadow(3, 3, 'rgba(255, 166, 201, 0.5)', 0, true, true);
        this.gameover_text.setStroke('#ffe3e3', 6);

        const hint = this.add.text(512, 450, '轻触或按任意键返回主菜单', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 28,
            color: '#2c3e50',
            align: 'center',
            backgroundColor: 'rgba(255,255,255,0.85)'
        }).setOrigin(0.5);
        hint.setPadding(20, 12, 20, 12);
        hint.setShadow(2, 2, 'rgba(154, 208, 245, 0.6)', 0, true, true);

        this.input.once('pointerdown', () => {

            this.scene.start('MainMenu');

        });
        this.input.keyboard?.once('keydown', () => {
            this.scene.start('MainMenu');
        });
    }
}
