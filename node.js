"use strict";

/**
 * Node - Manages individual system node state and infection mechanics
 * Tracks node status, infection progress, cleaning progress, and debuff effects
 */
export default class Node {
    constructor(nodeId, name, tileX, tileY) {
        // Node identification
        this.id = nodeId;
        this.name = name;
        this.tileX = tileX;
        this.tileY = tileY;
        
        // Node state
        this.STATUS = {
            SECURE: 'secure',
            UNINFECTED: 'uninfected',
            INFECTED: 'infected'
        };
        this.status = this.STATUS.SECURE; // Start secure
        
        // Progress tracking
        this.infectionProgress = 0.0; // 0-100% for infection
        this.purgeProgress = 0.0; // 0-100% for cleaning
        
        // Infection debuff effect mapping (from bible)
        // Node ID → Debuff type mapping:
        // 0: Motor Control (movement speed -50%)
        // 1: Visual Processor (screen shake + chromatic aberration)
        // 2: Auditory Processing (RGB static overlay, mini-map corruption)
        // 3: Neural Link (rule toggle delay ~500ms)
        // 4: Life Support (-0.5 HP/sec, healing blocked)
        this.infectionDebuff = this._getDebuffForNode(nodeId);
        
        // Player state tracking
        this.playerOnNode = false;
        this.playerMoved = false;
    }
    
    /**
     * Get the debuff ID associated with this node's infection
     * @param {number} nodeId - Node ID (0-4)
     * @returns {number} Debuff ID to apply to player
     */
    _getDebuffForNode(nodeId) {
        // Mapping from bible: Node ID is the debuff ID
        return nodeId;
    }
    
    /**
     * Update node state based on player position and time
     * @param {number} dt - Delta time in seconds
     * @param {number} playerX - Player X coordinate
     * @param {number} playerY - Player Y coordinate
     */
    update(dt, playerX, playerY) {
        // Check if player is on this node's tile
        const isOnTile = Math.floor(playerX) === this.tileX && Math.floor(playerY) === this.tileY;
        
        if (isOnTile) {
            // Player is on the node tile
            this.playerOnNode = true;
            
            // If infected, check if player is stationary to clean
            if (this.status === this.STATUS.INFECTED) {
                // Track movement to break cleaning
                // In a real implementation, you'd compare player position from last frame
                // For now, assume stationary if player hasn't moved significantly
                
                // Increment purge progress (8 seconds to clean = 100% / 8 seconds)
                this.purgeProgress += (100.0 / 8.0) * dt;
                
                // Cap at 100%
                if (this.purgeProgress >= 100.0) {
                    this.purgeProgress = 100.0;
                    this.status = this.STATUS.SECURE; // Fully cleaned
                    this.infectionProgress = 0.0;
                }
            }
        } else {
            // Player has moved off the node
            if (this.playerOnNode) {
                this.playerMoved = true;
                // Reset or pause purge progress
                if (this.status === this.STATUS.INFECTED) {
                    // Pause cleaning - could implement partial progress retention
                    // For now, we'll reset (harder game mechanic)
                    this.purgeProgress = 0.0;
                }
            }
            this.playerOnNode = false;
        }
        
        // Reset movement flag (would be set by game logic to detect movement)
        this.playerMoved = false;
    }
    
    /**
     * Trigger infection for this node
     * @param {number} initialInfection - Starting infection progress (0-100)
     */
    infect(initialInfection = 0) {
        if (this.status === this.STATUS.SECURE) {
            // Secure nodes can become uninfected first, then infected
            this.status = this.STATUS.UNINFECTED;
        }
        
        this.status = this.STATUS.INFECTED;
        this.infectionProgress = Math.min(100, Math.max(0, initialInfection));
        this.purgeProgress = 0.0;
    }
    
    /**
     * Get the current debuff effect for this node
     * @returns {object|null} Debuff information or null if not infected
     */
    getDebuff() {
        if (this.status !== this.STATUS.INFECTED) {
            return null;
        }
        
        return {
            nodeId: this.id,
            debuffId: this.infectionDebuff,
            name: this._getDebuffName(this.id)
        };
    }
    
    /**
     * Get the name of the debuff based on node ID
     * @param {number} nodeId - Node ID (0-4)
     * @returns {string} Name of the debuff
     */
    _getDebuffName(nodeId) {
        const debuffNames = {
            0: 'Motor Control',
            1: 'Visual Processor',
            2: 'Auditory Processing',
            3: 'Neural Link',
            4: 'Life Support'
        };
        
        return debuffNames[nodeId] || 'Unknown';
    }
    
    /**
     * Get the specific effect description of this node's infection
     * @returns {string} Effect description
     */
    getEffectDescription() {
        if (this.status !== this.STATUS.INFECTED) {
            return '';
        }
        
        const descriptions = {
            0: 'Movement speed reduced by 50%',
            1: 'Screen shake + chromatic aberration',
            2: 'RGB static overlay on HUD; mini-map corrupted',
            3: 'Rule toggle activation delayed by ~500ms',
            4: '-0.5 HP/sec drain AND healing blocked'
        };
        
        return descriptions[this.id] || 'Unknown effect';
    }
    
    /**
     * Check if node is infected
     */
    isInfected() {
        return this.status === this.STATUS.INFECTED;
    }
    
    /**
     * Check if node is secure
     */
    isSecure() {
        return this.status === this.STATUS.SECURE;
    }
    
    /**
     * Get node state for debugging/UI
     */
    getState() {
        return {
            id: this.id,
            name: this.name,
            tileX: this.tileX,
            tileY: this.tileY,
            status: this.status,
            infectionProgress: this.infectionProgress.toFixed(1),
            purgeProgress: this.purgeProgress.toFixed(1),
            debuff: this.getDebuff()
        };
    }
    
    /**
     * Reset node to initial state
     */
    reset() {
        this.status = this.STATUS.SECURE;
        this.infectionProgress = 0.0;
        this.purgeProgress = 0.0;
    }
}