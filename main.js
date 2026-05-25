"use strict";

// Import modules
import InputHandler from './inputHandler.js';
import Game from './game.js';

/**
 * Main entry point for the Akira - Neural Link game
 * Initializes the game engine when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    // Get canvas and context
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match the window size for rendering
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    // Instantiate input handler
    const inputHandler = new InputHandler();
    
    // Instantiate game engine
    const game = new Game(canvas, inputHandler);
    
    // Initialize and start the game
    game.init();
    game.start();
});