import { invoke } from '@tauri-apps/api/core';
import Phaser from 'phaser';
import { Game as SnakeGame } from './game/scenes/Game';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#101018',
    scene: [SnakeGame]
};

document.addEventListener('DOMContentLoaded', async () => {
    invoke('greet', { name: 'Phaser Game' });
    new Phaser.Game(config);
});
