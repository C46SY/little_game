import { invoke } from '@tauri-apps/api/core';
import Phaser from 'phaser';
import { PLAYFIELD_HEIGHT, PLAYFIELD_WIDTH } from './game/constants';
import { Game as GameScene } from './game/scenes/Game';
import { MainMenu } from './game/scenes/MainMenu';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await invoke('greet', { name: 'Phaser Game' });
    } catch (error) {
        console.warn('Unable to invoke greet command:', error);
    }

    const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: PLAYFIELD_WIDTH,
        height: PLAYFIELD_HEIGHT,
        parent: 'game-container',
        backgroundColor: '#cfe8ff',
        pixelArt: true,
        roundPixels: true,
        scene: [MainMenu, GameScene]
    };

    new Phaser.Game(config);
});
