"use strict";

// Import all necessary modules
import Player from "./player.js";
import Raycaster from "./raycaster.js";
import RulesManager from "./rulesManager.js";
import Node from "./node.js";
import Virus from "./virus.js";
import Effects from "./effects.js";
import InputHandler from "./inputHandler.js";
import { levelMap } from "./mapData.js";

/**
 * Game - Central game manager and main game loop
 * Handles initialization, game loop, and coordinates between subsystems
 */
export default class Game {
    constructor(canvas, inputHandler) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.inputHandler = inputHandler;
        
        // Game loop timing
        this.lastTime = 0;
        this.isRunning = false;
        
        // Game state
        this.gameTime = 0;
        this.mapData = levelMap;
        
        // Subsystems
        this.player = null;
        this.raycaster = null;
        this.rulesManager = null;
        this.nodes = [];
        this.viruses = [];
        this.effects = null;
        
        // Game state tracking
        this.virusesQuarantined = 0;
        this.nodesSecure = 1; // Starting with 1 secure node
        this.nodesInfected = 4; // 4 nodes start uninfected initially
        this.gameOver = false;
    }
    
    /**
     * Initialize game systems
     * Sets up initial state and prepares subsystems
     */
    init() {
        // Initialize subsystems
        // Player starts at position (7.5, 1.5) looking East (0 radians)
        this.player = new Player(7.5, 1.5, 0);
        
        // Raycaster for 3D rendering
        this.raycaster = new Raycaster(this.canvas, this.ctx, this.mapData);
        
        // Rules manager for game mechanics
        this.rulesManager = new RulesManager();
        
        // Initialize nodes (IDs 0-4 at specific positions)
        // Node 0 (Motor Control) at (32, 32)
        this.nodes.push(new Node(0, 'Motor Control', 32, 32));
        // Node 1 (Visual Processor) at (20, 20)
        this.nodes.push(new Node(1, 'Visual Processor', 20, 20));
        // Node 2 (Auditory Processing) at (44, 20)
        this.nodes.push(new Node(2, 'Auditory Processing', 44, 20));
        // Node 3 (Neural Link) at (32, 12)
        this.nodes.push(new Node(3, 'Neural Link', 32, 12));
        // Node 4 (Life Support) at (32, 44)
        this.nodes.push(new Node(4, 'Life Support', 32, 44));
        
        // Initialize viruses (3 viruses at positions away from player)
        // Virus 1 at (48, 32)
        this.viruses.push(new Virus(48, 32));
        // Virus 2 at (16, 48)
        this.viruses.push(new Virus(16, 48));
        // Virus 3 at (48, 48)
        this.viruses.push(new Virus(48, 48));
        
        // Initialize effects handler
        this.effects = new Effects();
        
        // Add click-to-play pointer lock listener
        this.canvas.addEventListener('click', () => {
            this.inputHandler.requestPointerLock(this.canvas);
        });
        
        // Rule [1] is ON by default (Firewalls solid), no need to toggle
        
        // Reset game state
        this.gameTime = 0;
        this.isRunning = false;
        this.virusesQuarantined = 0;
        this.nodesSecure = 1;
        this.nodesInfected = 4;
        this.gameOver = false;
        
        // Set Neural Link debuff state in rules manager
        // Check if player has the debuff
        this.rulesManager.setNeuralLinkDebuff(this.player.activeDebuffs.includes(3));
    }
    
    /**
     * Start the game loop
     * Begins the requestAnimationFrame cycle
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastTime = performance.now();
        
        // Start the game loop
        requestAnimationFrame((timestamp) => this._gameLoop(timestamp));
    }
    
    /**
     * Main game loop - calculates delta time and updates game state
     * @param {number} timestamp - Current timestamp from requestAnimationFrame
     */
 _gameLoop(timestamp) {
    if (!this.isRunning) return;
    
    // Calculate delta time in seconds for frame-rate independent updates
    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    
    // Update game logic (without resetting mouse delta first)
    this.update(dt);
    
    // Render game
    this.render(this.ctx);
    
    // Reset mouse delta after frame processing (not at the beginning)
    this.inputHandler.resetMouseDelta();
    
    // Continue the game loop
    requestAnimationFrame((timestamp) => this._gameLoop(timestamp));
}
    
    /**
     * Update game logic
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        // Update game time
        this.gameTime += dt;
        
        // Update player movement and state
        this.player.update(dt, this.inputHandler, this.mapData, this.rulesManager);
        
        // Update rule timers
        this.rulesManager.update(dt);
        
        // Update node states
        for (const node of this.nodes) {
            node.update(dt, this.player.x, this.player.y);
        }
        
        // Update virus states and AI
        for (const virus of this.viruses) {
            virus.update(dt, this.player, this.rulesManager, this.mapData);
            
            // Check if virus is near a rule block tile
            const tileInteraction = virus.checkTileInteraction(this.mapData);
            if (tileInteraction) {
                // Rule [1] OFF for RULE_BLOCK (4) and OVERRIDE (9)
                // These tiles force Rule [1] to be inactive while virus is on them
                if (tileInteraction.tileId === 4 || tileInteraction.tileId === 9) {
                    this.rulesManager.activateRule(1);
                }
            }
            
            // Check if virus is near player for capture
            virus.checkPlayerProximity(this.player, this.inputHandler);
        }
        
        // Update effects
        this.effects.update(dt, this.player, this.rulesManager, this.canvas);
        
        // Update Neural Link debuff state in rules manager
        this.rulesManager.setNeuralLinkDebuff(this.player.activeDebuffs.includes(3));
        
        // Check for infection effects
        this._checkInfectionEffects(dt);
        
        // Check for healing from coolant tiles
        this._checkCoolantHealing(dt);
        
        // Handle rule hotkeys
        this._handleRuleHotkeys();
        
        // Check win/loss conditions
        this._checkWinLossConditions();
    }
    
    /**
     * Handle rule hotkeys
     */
    _handleRuleHotkeys() {
        // Rule 1: FIREWALL IS WALL
        if (this.inputHandler.isPressed('1')) {
            this.rulesManager.activateRule(1);
        }
        
        // Rule 2: NODES ARE LOCKED
        if (this.inputHandler.isPressed('2')) {
            this.rulesManager.activateRule(2);
        }
        
        // Rule 3: VIRUS IS STOP
        if (this.inputHandler.isPressed('3')) {
            this.rulesManager.activateRule(3);
        }
        
        // Rule 4: VIRUS IS SLOW
        if (this.inputHandler.isPressed('4')) {
            this.rulesManager.activateRule(4);
        }
        
        // Rule 5: COOLANT IS SAFE
        if (this.inputHandler.isPressed('5')) {
            this.rulesManager.activateRule(5);
        }
    }
    
    /**
     * Check for infection debuff effects
     * @param {number} dt - Delta time in seconds
     */
    _checkInfectionEffects(dt) {
        // Apply Life Support debuff (Node 4) - -0.5 HP/sec drain
        if (this.player.activeDebuffs.includes(4)) {
            this.player.takeDamage(0.5 * dt);
        }
    }
    
    /**
     * Check for healing from coolant tiles
     * @param {number} dt - Delta time in seconds
     */
    _checkCoolantHealing(dt) {
        // Get player position in tile coordinates
        const playerMapX = Math.floor(this.player.x);
        const playerMapY = Math.floor(this.player.y);
        
        // Check if player is on a coolant tile (tile ID 3)
        if (playerMapY >= 0 && playerMapY < this.mapData.length && 
            playerMapX >= 0 && playerMapX < this.mapData[0].length) {
            const tileId = this.mapData[playerMapY][playerMapX];
            
            // If Rule [5] is active and player is on coolant tile, heal
            if (tileId === 3 && this.rulesManager.isRuleActive(5)) {
                // Heal +2 HP/s while standing on coolant
                this.player.heal(2 * dt);
            }
        }
    }
    
    /**
     * Check win/loss conditions and update game state
     */
    _checkWinLossConditions() {
        // Update virus counts
        let activeViruses = 0;
        let quarantinedViruses = 0;
        
        for (const virus of this.viruses) {
            if (!virus.isCaptured) {
                activeViruses++;
            } else {
                quarantinedViruses++;
            }
        }
        
        this.virusesQuarantined = quarantinedViruses;
        
        // Update node counts
        let secureNodes = 0;
        let infectedNodes = 0;
        
        for (const node of this.nodes) {
            if (node.isSecure()) {
                secureNodes++;
            } else if (node.isInfected()) {
                infectedNodes++;
            }
        }
        
        this.nodesSecure = secureNodes;
        this.nodesInfected = infectedNodes;
        
        // Check win condition: Quarantine all 3 viruses AND ≥4 nodes remain uninfected
        if (activeViruses === 0 && secureNodes >= 4) {
            this.gameOver = true;
            this.effects.showMessage('MISSION ACCOMPLISHED', 'All viruses quarantined and 4+ nodes secured. System stable.');
            this.stop();
            return;
        }
        
        // Check lose conditions:
        // 1. All nodes infected
        // 2. Player HP ≤ 0
        
        // Count total nodes that are not secure
        const totalNodes = this.nodes.length;
        const nonSecureNodes = totalNodes - secureNodes;
        
        if (nonSecureNodes === totalNodes) {
            this.gameOver = true;
            this.effects.showMessage('SYSTEM COMPROMISED', 'All nodes have been infected. Critical failure.');
            this.stop();
            return;
        }
        
        if (this.player.health <= 0) {
            this.gameOver = true;
            this.effects.showMessage('CRITICAL FAILURE', 'Player systems offline. Mission failed.');
            this.stop();
            return;
        }
    }
    
    /**
     * Render the game
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    render(ctx) {
        // Clear canvas with background color (sky/floor gradient from raycaster)
        this.raycaster.render(this.player.x, this.player.y, this.player.angle);
        
        // Update effects (HUD)
        // This will be handled by the effects system in the update loop
        
        // Draw debug information if F1 is pressed
        if (this.inputHandler.isPressed('F1')) {
            this.effects.toggleDebugOverlay(true);
            
            const debugInfo = {
                player: this.player.getState(),
                rules: this.rulesManager.getAllRuleStates(),
                nodes: this.nodes.map(node => node.getState()),
                viruses: this.viruses.map(virus => virus.getState()),
                gameTime: this.gameTime.toFixed(1)
            };
            
            this.effects.updateDebugInfo(debugInfo);
        } else {
            this.effects.toggleDebugOverlay(false);
        }
    }
    
    /**
     * Stop the game loop
     */
    stop() {
        this.isRunning = false;
    }
    
    /**
     * Check if the game is currently running
     */
    isGameRunning() {
        return this.isRunning;
    }
    
    /**
     * Get current game time in seconds
     */
    getGameTime() {
        return this.gameTime;
    }
    
    /**
     * Get game state information
     */
    getGameState() {
        return {
            gameTime: this.gameTime,
            player: this.player.getState(),
            rules: this.rulesManager.getAllRuleStates(),
            nodes: this.nodes.map(node => node.getState()),
            viruses: this.viruses.map(virus => virus.getState()),
            virusesQuarantined: this.virusesQuarantined,
            nodesSecure: this.nodesSecure,
            nodesInfected: this.nodesInfected,
            gameOver: this.gameOver
        };
    }
    
    /**
     * Reset game to initial state
     */
    reset() {
        // Re-initialize the game
        this.init();
        this.start();
    }
}