"use strict";

/**
 * Player - Manages player state, movement, and infection effects
 * Handles position, rotation, collision detection, and debuff stacking
 */
export default class Player {
    constructor(startX, startY, startAngle) {
        // Position and orientation
        this.x = startX;
        this.y = startY;
        this.angle = startAngle; // Radians, 0 = East, PI/2 = South
        
        // Movement properties
        this.BASE_SPEED = 5.0; // Tiles per second
        this.TURN_SPEED = 2.0; // Radians per second (keyboard turning - deprecated)
        this.MOUSE_SENSITIVITY = 0.002; // Mouse turning sensitivity
        this.BOUNDING_RADIUS = 0.25; // Prevents clipping through walls
        
        // Health and status
        this.health = 100.0;
        this.isDead = false;
        
        // Infection debuffs - stores active node effects
        // Each infected node ID adds its effect to this array
        this.activeDebuffs = [];
        
        // Movement state
        this.isMoving = false;
        this.movementVector = { x: 0, y: 0 };
    }
    
    /**
     * Update player state based on input and game time
     * @param {number} dt - Delta time in seconds
     * @param {InputHandler} inputHandler - Input state manager
     * @param {Array} mapData - 2D map array for collision detection
     */
    update(dt, inputHandler, mapData) {
        if (this.isDead) return;
        
        // Reset movement vector
        this.movementVector = { x: 0, y: 0 };
        
        // Apply mouse turning (horizontal only)
        this.angle += inputHandler.mouseDeltaX * this.MOUSE_SENSITIVITY;
        
        // Reset mouse delta for next frame
        inputHandler.mouseDeltaX = 0;
        
        // Calculate current movement speed with debuff adjustments
        let currentSpeed = this.BASE_SPEED;
        if (this.activeDebuffs.includes(0)) {
            // Motor Control infection: 50% speed reduction
            currentSpeed *= 0.5;
        }
        
        // Calculate speed adjusted for frame rate
        const moveDist = currentSpeed * dt;
        
        // Calculate movement direction
        const dirX = Math.cos(this.angle);
        const dirY = Math.sin(this.angle);
        const rightX = Math.cos(this.angle + Math.PI / 2);
        const rightY = Math.sin(this.angle + Math.PI / 2);
        
        // Handle movement
        let dx = 0;
        let dy = 0;
        
        // Forward/Backward movement
        if (inputHandler.isPressed('w')) {
            dx += dirX * moveDist;
            dy += dirY * moveDist;
            this.isMoving = true;
        }
        if (inputHandler.isPressed('s')) {
            dx -= dirX * moveDist;
            dy -= dirY * moveDist;
            this.isMoving = true;
        }
        
        // Strafe left/right
        if (inputHandler.isPressed('a')) {
            dx -= rightX * moveDist;
            dy -= rightY * moveDist;
            this.isMoving = true;
        }
        if (inputHandler.isPressed('d')) {
            dx += rightX * moveDist;
            dy += rightY * moveDist;
            this.isMoving = true;
        }
        
        if (dx !== 0 || dy !== 0) {
            this.movementVector = { x: dx, y: dy };
            
            // Check for collisions before applying movement
            const nextX = this.x + dx;
            const nextY = this.y + dy;
            
            if (!this._checkCollision(nextX, nextY, mapData)) {
                this.x = nextX;
                this.y = nextY;
            }
        } else {
            this.isMoving = false;
        }
        
        // Normalize angle to [0, 2π)
        this.angle = this.angle % (2 * Math.PI);
        if (this.angle < 0) {
            this.angle += 2 * Math.PI;
        }
    }
    
    /**
     * Check if the given position would collide with a wall
     * Uses bounding box approach for collision detection
     */
    _checkCollision(x, y, mapData) {
        // Check four corners of the player's bounding box
        const positions = [
            { x: x + this.BOUNDING_RADIUS, y: y + this.BOUNDING_RADIUS },
            { x: x + this.BOUNDING_RADIUS, y: y - this.BOUNDING_RADIUS },
            { x: x - this.BOUNDING_RADIUS, y: y + this.BOUNDING_RADIUS },
            { x: x - this.BOUNDING_RADIUS, y: y - this.BOUNDING_RADIUS }
        ];
        
        for (const pos of positions) {
            const mapX = Math.floor(pos.x);
            const mapY = Math.floor(pos.y);
            
            // Check bounds
            if (mapX < 0 || mapX >= mapData[0].length || mapY < 0 || mapY >= mapData.length) {
                return true;
            }
            
            // Check for solid tiles (1 = WALL, 2 = FIREWALL, 6-8 = WALL_VARIANTS)
            const tileId = mapData[mapY][mapX];
            if (tileId === 1 || tileId === 2 || (tileId >= 6 && tileId <= 8)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Apply an infection debuff from a node
     * @param {number} nodeId - ID of the infected node (0-4)
     */
    addDebuff(nodeId) {
        if (!this.activeDebuffs.includes(nodeId)) {
            this.activeDebuffs.push(nodeId);
        }
    }
    
    /**
     * Remove an infection debuff when node is cleaned
     * @param {number} nodeId - ID of the cleaned node
     */
    removeDebuff(nodeId) {
        const index = this.activeDebuffs.indexOf(nodeId);
        if (index > -1) {
            this.activeDebuffs.splice(index, 1);
        }
    }
    
    /**
     * Apply damage to the player
     * @param {number} amount - Damage amount
     */
    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        if (this.health <= 0) {
            this.isDead = true;
        }
    }
    
    /**
     * Heal the player
     * @param {number} amount - Heal amount
     */
    heal(amount) {
        this.health = Math.min(100, this.health + amount);
    }
    
    /**
     * Get player state for other systems
     */
    getState() {
        return {
            x: this.x,
            y: this.y,
            angle: this.angle,
            health: this.health,
            isDead: this.isDead,
            activeDebuffs: [...this.activeDebuffs],
            isMoving: this.isMoving,
            movementVector: { ...this.movementVector }
        };
    }
    
    /**
     * Reset player to starting position
     */
    reset(startX, startY, startAngle) {
        this.x = startX;
        this.y = startY;
        this.angle = startAngle;
        this.health = 100;
        this.isDead = false;
        this.activeDebuffs = [];
        this.isMoving = false;
    }
    
    /**
     * Check if player is within range of a target
     * @param {number} targetX - Target X coordinate
     * @param {number} targetY - Target Y coordinate
     * @param {number} range - Range in tiles
     */
    isInRange(targetX, targetY, range = 2.0) {
        const dx = this.x - targetX;
        const dy = this.y - targetY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= range;
    }
}