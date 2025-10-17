import { invoke } from '@tauri-apps/api/core';
import StartGame from './game/main';

document.addEventListener('DOMContentLoaded', async () => {

    // Call the Rust function from Tauri
    // This is just an example, you can remove it if not needed
    invoke('greet', { name: 'Phaser Game' });

    StartGame('game-container');

});