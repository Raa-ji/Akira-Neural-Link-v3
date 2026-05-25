"use strict";

/**
 * Virus - Manages individual virus AI behavior and state
 * Handles movement, targeting, and rule interactions
 */
export default class Virus {
    constructor(startX, startY, baseSpeed = 2.0) {
        // Position and movement
        this.x = startX;
        this.y = startY;
        this.baseSpeed = baseSpeed;
        this.currentSpeed = baseSpeed;
        
        // Target state
        this.target = null;
        this.targetType = 'player'; // 'player' or 'node'
        this.targetX = startX;
        this.targetY = startY;
        
        // Behavior states
        this.STATE = {
            WANDERING: 'wandering',
            CHASING: 'chasing',
            STAYING: 'staying'
        };
        this.state = this.STATE.WANDERING;
        
        // Virus properties
        this.isCaptured = false;
        this.capturedTimer = 0.0;
        this.captureDuration = 2.0; // Seconds to capture (held 'V' for 2s)
        
        // Movement direction
        this.direction = { x: 0, y: 0 };
        this.moveAngle = Math.random() * Math.PI * 2;
        
        // State timers
        this.stateTimer = 0;
        this.wanderDuration = 3 + Math.random() * 5; // 3-8 seconds
    }
    
    /**
     * Update virus state based on game time and conditions
     * @param {number} dt - Delta time in seconds
     * @param {Player} player - Player object
     * @param {RulesManager} rulesManager - Rule state manager
     * @param {Array} mapData - 2D map array for collision detection
     */
    update(dt, player, rulesManager, mapData) {
        if (this.isCaptured) {
            this._updateCaptureState(dt);
            return;
        }
        
        // Check active rules
        const rule3Active = rulesManager.isRuleActive(3); // VIRUS IS STOP
        const rule4Active = rulesManager.isRuleActive(4); // VIRUS IS SLOW
        
        // Apply rule effects
        if (rule3Active) {
            // Rule [3]: VIRUS IS STOP - freeze completely
            this.currentSpeed = 0;
        } else if (rule4Active) {
            // Rule [4]: VIRUS IS SLOW - 60% speed
            this.currentSpeed = this.baseSpeed * 0.6;
        } else {
            // Normal speed
            this.currentSpeed = this.baseSpeed;
        }
        
        // Update behavior state if not moving
        this._updateState(dt);
        
        // Calculate movement vector based on state
        this._calculateMovementVector();
        
        // Apply movement with collision detection
        this._applyMovement(dt, mapData);
        
        // Update target tracking
        if (this.targetType === 'player') {
            this.targetX = player.x;
            this.targetY = player.y;
        }
    }
    
    /**
     * Update virus behavior state
     */
    _updateState(dt) {
        this.stateTimer += dt;
        
        if (this.stateTimer >= this.wanderDuration) {
            // Time to change state
            const rand = Math.random();
            
            if (rand < 0.5) {
                this.state = this.STATE.CHASING;
                this.wanderDuration = 5 + Math.random() * 5; // Chase for 5-10s
            } else if (rand < 0.7) {
                this.state = this.STATE.STAYING;
                this.wanderDuration = 3 + Math.random() * 4; // Stay for 3-7s
            } else {
                this.state = this.STATE.WANDERING;
                this.wanderDuration = 3 + Math.random() * 5; // Wander for 3-8s
            }
            
            this.stateTimer = 0;
        }
        
        // Update target based on state
        if (this.state === this.STATE.CHASING) {
            this.targetType = 'player';
        } else if (this.state === this.STATE.STAYING) {
            // Stay at current position, but can be forced to chase if player is close
            this.targetType = 'current';
        } else {
            // WANDERING - random wandering
            this.targetType = 'random';
        }
    }
    
    /**
     * Calculate movement vector based on current state
     */
    _calculateMovementVector() {
        let targetX = this.x;
        let targetY = this.y;
        
        // Select target based on state
        if (this.state === this.STATE.CHASING) {
            // Target player
            // targetX, targetY already set in update()
        } else if (this.state === this.STATE.STAYING) {
            // Don't move
            this.direction.x = 0;
            this.direction.y = 0;
            return;
        } else if (this.state === this.STATE.WANDERING) {
            // Wander in a random direction
            targetX = this.x + Math.cos(this.moveAngle) * 3;
            targetY = this.y + Math.sin(this.moveAngle) * 3;
        }
        
        // Calculate direction toward target
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0.1) {
            this.direction.x = dx / distance;
            this.direction.y = dy / distance;
        } else {
            // Randomize direction when reaching target
            this.moveAngle = Math.random() * Math.PI * 2;
            this.direction.x = 0;
            this.direction.y = 0;
        }
    }
    
    /**
     * Apply movement with wall collision detection
     */
    _applyMovement(dt, mapData) {
        if (this.currentSpeed <= 0 || this.state === this.STATE.STAYING) {
            return;
        }
        
        const moveDist = this.currentSpeed * dt;
        
        // Try X movement first
        let nextX = this.x + this.direction.x * moveDist;
        if (!this._checkCollision(nextX, this.y, mapData)) {
            this.x = nextX;
        } else {
            // Slide along wall - try Y movement instead
            let nextY = this.y + this.direction.y * moveDist;
            if (!this._checkCollision(this.x, nextY, mapData)) {
                this.y = nextY;
            }
        }
        
        // Try Y movement (in case X movement worked)
        let nextY = this.y + this.direction.y * moveDist;
        if (!this._checkCollision(this.x, nextY, mapData)) {
            this.y = nextY;
        }
    }
    
    /**
     * Check if the given position would collide with a wall
     */
    _checkCollision(x, y, mapData) {
        const mapX = Math.floor(x);
        const mapY = Math.floor(y);
        
        // Check bounds
        if (mapX < 0 || mapX >= mapData[0].length || mapY < 0 || mapY >= mapData.length) {
            return true;
        }
        
        // Check for solid tiles (1 = WALL, 2 = FIREWALL, 6-8 = WALL_VARIANTS)
        const tileId = mapData[mapY][mapX];
        return [1, 2, 6, 7, 8].includes(tileId);
    }
    
    /**
     * Check if player is within capture range
     * @param {Player} player - Player object
     * @param {InputHandler} inputHandler - Input state manager
     */
    checkPlayerProximity(player, inputHandler) {
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if player is within 2 tiles
        if (distance <= 2.0) {
            // If player presses 'C' while holding 'V', capture the virus
            if (inputHandler.isPressed('c') && inputHandler.isPressed('v')) {
                this.attemptCapture();
            } else if (inputHandler.isPressed('c')) {
                // Just proximity check for UI feedback
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Attempt to capture this virus
     */
    attemptCapture() {
        if (!this.isCaptured) {
            this.isCaptured = true;
            this.state = this.STATE.STAYING;
            this.direction.x = 0;
            this.direction.y = 0;
            this.capturedTimer = 0;
        }
    }
    
    /**
     * Update capture state
     */
    _updateCaptureState(dt) {
        this.capturedTimer += dt;
        
        if (this.capturedTimer >= this.captureDuration) {
            // Virus captured successfully
            // This will be handled by game logic
            this.isCaptured = false;
            this.capturedTimer = 0;
        }
    }
    
    /**
     * Check interaction with special tiles (RULE_BLOCK, OVERRIDE)
     * @param {Array} mapData - 2D map array
     */
    checkTileInteraction(mapData) {
        const mapX = Math.floor(this.x);
        const mapY = Math.floor(this.y);
        
        // Check bounds
        if (mapX < 0 || mapX >= mapData[0].length || mapY < 0 || mapY >= mapData.length) {
            return null;
        }
        
        const tileId = mapData[mapY][mapX];
        
        // RULE_BLOCK (4) and OVERRIDE (9) force Rule [1] OFF
        if (tileId === 4 || tileId === 9) {
            return { type: 'rule_block', tileId: tileId };
        }
        
        return null;
    }
    
    /**
     * Set virus position (e.g., for initialization)
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }
    
    /**
     * Get virus state for debugging
     */
    getState() {
        return {
            x: this.x,
            y: this.y,
            state: this.state,
            isCaptured: this.isCaptured,
            capturedTimer: this.capturedTimer.toFixed(1),
            speed: this.currentSpeed.toFixed(1)
        };
    }
}