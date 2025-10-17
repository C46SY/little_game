import { invoke } from '@tauri-apps/api/core';
import Phaser from 'phaser';
import { Game as SnakeGame } from './game/scenes/Game';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await invoke('greet', { name: 'Phaser Game' });
    } catch (error) {
        console.warn('Unable to invoke greet command:', error);
    }

    const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'game-container',
        backgroundColor: '#101018',
        pixelArt: true,
        roundPixels: true,
        scene: [SnakeGame]
    };

    new Phaser.Game(config);
});
