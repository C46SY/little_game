import { invoke } from '@tauri-apps/api/core';
import StartGame from './game/main';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await invoke('greet', { name: 'Phaser Game' });
    } catch (error) {
        console.warn('Unable to invoke greet command:', error);
    }

    StartGame('game-container');
});
