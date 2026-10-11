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
            SEEKING_NODE: 'seeking_node',     // Looking for closest unvisited/uninfected node
            INFECTING_NODE: 'infecting_node', // Stationary, infecting a node (2s timer)
            RETURNING_TO_NODE: 'returning',   // Going back to a previously visited node
            PURSUING_PLAYER: 'pursuing',      // Aggressive pursuit when player carries a virus
            WANDERING: 'wandering'            // Random exploration when no clear goal
        };
        this.state = this.STATE.SEEKING_NODE;
        
        // Virus properties
        this.isCaptured = false;
        this.capturedTimer = 0.0;
        this.captureDuration = 2.0; // Seconds to quaratine (held 'V' for 2s)
        
        // Movement direction
        this.direction = { x: 0, y: 0 };
        this.moveAngle = Math.random() * Math.PI * 2;
        
        // State timers
        this.stateTimer = 0;
        this.wanderDuration = 3 + Math.random() * 5; // 3-8 seconds
        
        // Infection system
        this.infectionProgress = 0.0; // 0-100% for infecting a node
        this.INFECTION_DURATION = 2.0; // Seconds to infect a node (adjustable)
        this.currentTargetNode = null; // Current node being targeted
        
        // Memory system - tracks explored areas and visited nodes
        this.memory = {
            visitedNodes: new Set(),           // Node IDs this virus has reached
            exploredTiles: new Set(),          // Tiles this virus has traversed (as "x,y" strings)
            knownPaths: new Map(),             // nodeId -> path array for remembered routes
            lastNodeId: null                   // Last node this virus interacted with
        };
    }
    
    /**
     * Update virus state based on game time and conditions
     * @param {number} dt - Delta time in seconds
     * @param {Player} player - Player object
     * @param {RulesManager} rulesManager - Rule state manager
     * @param {Array} mapData - 2D map array for collision detection
     * @param {Array} nodes - Array of Node objects for targeting
     * @param {boolean} playerCarryingVirus - Whether the player is carrying a captured virus
     */
    update(dt, player, rulesManager, mapData, nodes, playerCarryingVirus) {
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
        
        // Update behavior state
        this._updateState(dt, player, nodes, playerCarryingVirus);
        
        // Calculate movement vector based on state
        this._calculateMovementVector(dt, player, nodes, mapData);
        
        // Apply movement with collision detection
        this._applyMovement(dt, mapData, rulesManager);
        
        // Record explored tile
        this.recordExploredTile(this.x, this.y);
    }
    
    /**
     * Update virus behavior state based on game conditions
     * @param {number} dt - Delta time in seconds
     * @param {Player} player - Player object
     * @param {Array} nodes - Array of Node objects
     * @param {boolean} playerCarryingVirus - Whether player is carrying a virus
     */
    _updateState(dt, player, nodes, playerCarryingVirus) {
        this.stateTimer += dt;
        
        // Check if player is carrying a virus - switch to pursuit mode
        if (playerCarryingVirus && this.state !== this.STATE.PURSUING_PLAYER) {
            this.state = this.STATE.PURSUING_PLAYER;
            this.stateTimer = 0;
            return;
        }
        
        // If in pursuit mode and player no longer carrying, return to seeking
        if (!playerCarryingVirus && this.state === this.STATE.PURSUING_PLAYER) {
            this.state = this.STATE.SEEKING_NODE;
            this.stateTimer = 0;
            this._selectTargetNode(nodes);
            return;
        }
        
        // Handle state transitions based on current state
        switch (this.state) {
            case this.STATE.SEEKING_NODE:
                // Find a target node if we don't have one
                if (!this.currentTargetNode) {
                    this._selectTargetNode(nodes);
                }
                
                // Check if we've reached the target node
                if (this.currentTargetNode) {
                    const dx = this.x - this.currentTargetNode.tileX;
                    const dy = this.y - this.currentTargetNode.tileY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance <= 1.5) {
                        // Reached the node - start infecting
                        this.state = this.STATE.INFECTING_NODE;
                        this.infectionProgress = 0;
                        this.stateTimer = 0;
                        this.recordNodeVisit(this.currentTargetNode.id);
                    }
                }
                
                // Occasionally wander if no target found
                if (!this.currentTargetNode && this.stateTimer >= this.wanderDuration) {
                    this.state = this.STATE.WANDERING;
                    this.wanderDuration = 3 + Math.random() * 5;
                    this.stateTimer = 0;
                }
                break;
                
            case this.STATE.INFECTING_NODE:
                // Infection progress is handled in _calculateMovementVector
                // Check if infection is complete
                if (this.infectionProgress >= 100) {
                    // Infection complete - check if node is still uninfected
                    if (this.currentTargetNode && !this.currentTargetNode.isInfected()) {
                        this.currentTargetNode.infect();
                    }
                    
                    // Switch to wandering or seeking next node
                    this.currentTargetNode = null;
                    this.infectionProgress = 0;
                    
                    // 50% chance to seek another node, 50% to wander
                    if (Math.random() < 0.5) {
                        this.state = this.STATE.SEEKING_NODE;
                        this._selectTargetNode(nodes);
                    } else {
                        this.state = this.STATE.WANDERING;
                        this.wanderDuration = 3 + Math.random() * 5;
                    }
                    this.stateTimer = 0;
                }
                break;
                
            case this.STATE.WANDERING:
                if (this.stateTimer >= this.wanderDuration) {
                    // Switch to seeking a node
                    this.state = this.STATE.SEEKING_NODE;
                    this._selectTargetNode(nodes);
                    this.stateTimer = 0;
                }
                break;
                
            case this.STATE.RETURNING_TO_NODE:
                // Check if we've reached the node
                if (this.currentTargetNode) {
                    const dx = this.x - this.currentTargetNode.tileX;
                    const dy = this.y - this.currentTargetNode.tileY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance <= 1.5) {
                        // Reached the node - start infecting
                        this.state = this.STATE.INFECTING_NODE;
                        this.infectionProgress = 0;
                        this.stateTimer = 0;
                    }
                }
                break;
        }
    }
    
    /**
     * Select the closest target node based on memory and node state
     * @param {Array} nodes - Array of Node objects
     */
    _selectTargetNode(nodes) {
        let closestNode = null;
        let closestDistance = Infinity;
        
        for (const node of nodes) {
            // Skip secure nodes (already secured)
            if (node.isSecure()) {
                continue;
            }
            
            // Skip nodes we've already visited and are currently infected
            if (this.hasVisitedNode(node.id) && node.isInfected()) {
                continue;
            }
            
            const dx = this.x - node.tileX;
            const dy = this.y - node.tileY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestNode = node;
            }
        }
        
        // If no uninfected/unvisited node found, look for cleansed nodes to re-infect
        if (!closestNode) {
            for (const node of nodes) {
                // Look for nodes we've visited that are no longer infected (cleansed)
                if (this.hasVisitedNode(node.id) && !node.isInfected() && !node.isSecure()) {
                    const dx = this.x - node.tileX;
                    const dy = this.y - node.tileY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestNode = node;
                    }
                }
            }
        }
        
        this.currentTargetNode = closestNode;
    }
    
    /**
     * Calculate movement vector based on current state
     * @param {number} dt - Delta time in seconds
     * @param {Player} player - Player object
     * @param {Array} nodes - Array of Node objects
     * @param {Array} mapData - 2D map array for collision detection
     */
    _calculateMovementVector(dt, player, nodes, mapData) {
        let targetX = this.x;
        let targetY = this.y;
        
        // Select target based on state
        if (this.state === this.STATE.PURSUING_PLAYER) {
            // Direct pursuit - target player position
            targetX = player.x;
            targetY = player.y;
        } else if (this.state === this.STATE.INFECTING_NODE) {
            // Don't move while infecting
            this.direction.x = 0;
            this.direction.y = 0;
            
            // Increment infection progress
            this.infectionProgress += (100.0 / this.INFECTION_DURATION) * dt;
            if (this.infectionProgress > 100) {
                this.infectionProgress = 100;
            }
            return;
        } else if (this.state === this.STATE.SEEKING_NODE || this.state === this.STATE.RETURNING_TO_NODE) {
            // Move toward target node
            if (this.currentTargetNode) {
                targetX = this.currentTargetNode.tileX;
                targetY = this.currentTargetNode.tileY;
            } else {
                // No target - wander
                targetX = this.x + Math.cos(this.moveAngle) * 3;
                targetY = this.y + Math.sin(this.moveAngle) * 3;
            }
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
     * @param {RulesManager} rulesManager - Rule state manager (optional)
     */
    _applyMovement(dt, mapData, rulesManager) {
        if (this.currentSpeed <= 0 || this.state === this.STATE.INFECTING_NODE) {
            return;
        }
        
        const moveDist = this.currentSpeed * dt;
        
        // Try X movement first
        let nextX = this.x + this.direction.x * moveDist;
        if (!this._checkCollision(nextX, this.y, mapData, rulesManager)) {
            this.x = nextX;
        } else {
            // Slide along wall - try Y movement instead
            let nextY = this.y + this.direction.y * moveDist;
            if (!this._checkCollision(this.x, nextY, mapData, rulesManager)) {
                this.y = nextY;
            }
        }
        
        // Try Y movement (in case X movement worked)
        let nextY = this.y + this.direction.y * moveDist;
        if (!this._checkCollision(this.x, nextY, mapData, rulesManager)) {
            this.y = nextY;
        }
    }
    
    /**
     * Check if the given position would collide with a wall
     * @param {Array} mapData - 2D map array
     * @param {RulesManager} rulesManager - Rule state manager (optional)
     */
    _checkCollision(x, y, mapData, rulesManager) {
        const mapX = Math.floor(x);
        const mapY = Math.floor(y);
        
        // Check bounds
        if (mapX < 0 || mapX >= mapData[0].length || mapY < 0 || mapY >= mapData.length) {
            return true;
        }
        
        // Check for solid tiles (1 = WALL, 6-8 = WALL_VARIANTS)
        const tileId = mapData[mapY][mapX];
        if ([1, 6, 7, 8].includes(tileId)) {
            return true;
        }
        
        // Check for Firewall tiles (2) based on Rule 1 state
        if (tileId === 2) {
            // If Rule 1 is active (ON), firewalls are solid
            // If Rule 1 is inactive (OFF), firewalls are passable
            if (rulesManager && rulesManager.isRuleActive(1)) {
                return true;
            }
        }
        
        return false;
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
     * Record that this virus has visited a node
     * @param {number} nodeId - ID of the node visited
     * @param {Array} path - Path taken to reach the node (array of {x, y} positions)
     */
    recordNodeVisit(nodeId, path = null) {
        this.memory.visitedNodes.add(nodeId);
        this.memory.lastNodeId = nodeId;
        if (path) {
            this.memory.knownPaths.set(nodeId, path);
        }
    }
    
    /**
     * Check if this virus has visited a node
     * @param {number} nodeId - ID of the node to check
     * @returns {boolean}
     */
    hasVisitedNode(nodeId) {
        return this.memory.visitedNodes.has(nodeId);
    }
    
    /**
     * Get the known path to a previously visited node
     * @param {number} nodeId - ID of the node
     * @returns {Array|null} Path array or null if not known
     */
    getKnownPath(nodeId) {
        return this.memory.knownPaths.get(nodeId) || null;
    }
    
    /**
     * Record that this virus has explored a tile
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    recordExploredTile(x, y) {
        const tileKey = `${Math.floor(x)},${Math.floor(y)}`;
        this.memory.exploredTiles.add(tileKey);
    }
    
    /**
     * Check if this virus has explored a tile
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean}
     */
    hasExploredTile(x, y) {
        const tileKey = `${Math.floor(x)},${Math.floor(y)}`;
        return this.memory.exploredTiles.has(tileKey);
    }
    
    /**
     * Clear all memory (called on capture or game reset)
     */
    clearMemory() {
        this.memory.visitedNodes.clear();
        this.memory.exploredTiles.clear();
        this.memory.knownPaths.clear();
        this.memory.lastNodeId = null;
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
            speed: this.currentSpeed.toFixed(1),
            visitedNodes: Array.from(this.memory.visitedNodes),
            exploredTileCount: this.memory.exploredTiles.size,
            lastNodeId: this.memory.lastNodeId,
            targetNodeId: this.currentTargetNode ? this.currentTargetNode.id : null,
            infectionProgress: this.infectionProgress.toFixed(1)
        };
    }
}