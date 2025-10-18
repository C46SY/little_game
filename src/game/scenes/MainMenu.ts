import { Scene, GameObjects } from 'phaser';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        this.background = this.add.image(512, 384, 'playfield');

        this.logo = this.add.image(512, 280, 'logo');

        this.title = this.add.text(512, 440, '快乐小蛇', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 56,
            color: '#2c3e50',
            align: 'center'
        }).setOrigin(0.5);
        this.title.setShadow(3, 3, 'rgba(154, 208, 245, 0.6)', 0, true, true);
        this.title.setStroke('#ffffff', 10);

        const prompt = this.add.text(512, 520, '点击或按任意键开始冒险！', {
            fontFamily: '"Fredoka", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif',
            fontSize: 28,
            color: '#ff6b81',
            align: 'center',
            backgroundColor: 'rgba(255,255,255,0.9)'
        }).setOrigin(0.5);
        prompt.setPadding(20, 12, 20, 12);
        prompt.setShadow(2, 2, 'rgba(255, 166, 201, 0.5)', 0, true, true);

        this.input.once('pointerdown', () => {

            this.scene.start('Game');

        });
        this.input.keyboard?.once('keydown', () => {
            this.scene.start('Game');
        });
    }
}
