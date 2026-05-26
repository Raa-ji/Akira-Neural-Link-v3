"use strict";

/**
 * Effects - Manages visual feedback and UI updates for game state
 * Handles HUD updates, infection effects, and rule timer displays
 */
export default class Effects {
    constructor() {
        // DOM element references
        this.healthDisplay = document.getElementById('health-display');
        this.healthBar = document.getElementById('health-bar');
        this.nodesSecureDisplay = document.getElementById('nodes-secure-display');
        this.virusesActiveDisplay = document.getElementById('viruses-active-display');
        
        // Capture status elements
        this.captureStatus = document.getElementById('capture-status');
        this.captureText = document.querySelector('.capture-text');
        this.captureHint = document.querySelector('.capture-hint');
        
        // Rule UI elements for toggle rules with timers
        this.ruleRows = {
            1: document.getElementById('rule1-row'),
            2: document.getElementById('rule2-row')
        };
        
        this.ruleStates = {
            1: document.getElementById('rule1-state'),
            2: document.getElementById('rule2-state')
        };
        
        this.ruleTimers = {
            1: document.getElementById('rule1-timer'),
            2: document.getElementById('rule2-timer')
        };
        
        // Duration rule elements (3, 4, 5)
        this.ruleRowsDuration = {
            3: document.getElementById('rule3-row'),
            4: document.getElementById('rule4-row'),
            5: document.getElementById('rule5-row')
        };
        
        this.ruleTimersDuration = {
            3: document.getElementById('rule3-timer'),
            4: document.getElementById('rule4-timer'),
            5: document.getElementById('rule5-timer')
        };
        
        // All rule rows for easy access
        this.allRuleRows = {
            1: document.getElementById('rule1-row'),
            2: document.getElementById('rule2-row'),
            3: document.getElementById('rule3-row'),
            4: document.getElementById('rule4-row'),
            5: document.getElementById('rule5-row')
        };
        
        this.allRuleTimers = {
            1: document.getElementById('rule1-timer'),
            2: document.getElementById('rule2-timer'),
            3: document.getElementById('rule3-timer'),
            4: document.getElementById('rule4-timer'),
            5: document.getElementById('rule5-timer')
        };
        
        // HUD rule names for reference
        this.ruleNames = {
            1: 'FIREWALL IS WALL',
            2: 'NODES ARE LOCKED',
            3: 'VIRUS IS STOP',
            4: 'VIRUS IS SLOW',
            5: 'COOLANT IS SAFE'
        };
        
        // Infection effect classes
        this.INFECTION_CLASSES = {
            1: 'infection-visual',  // Visual Processor - screen shake
            2: 'infection-auditory', // Auditory Processing - RGB static overlay
            3: 'infection-neural',   // Neural Link - delay indicator
            4: 'infection-life'      // Life Support - HP drain indicator
        };
        
        // Current infection effects state
        this.activeInfectionEffects = new Set();
        
        // Screen shake state
        this.shakeTimer = 0;
        this.shakeInterval = 0.05; // Shake every 50ms
        
        // Capture status state
        this.virusNearby = false;
    }
    
    /**
     * Update visual effects based on game state
     * @param {number} dt - Delta time in seconds
     * @param {Player} player - Player object
     * @param {RulesManager} rulesManager - Rule state manager
     * @param {HTMLElement} canvasElement - Canvas element for effects
     */
    update(dt, player, rulesManager, canvasElement) {
        // Update basic HUD
        this._updateHealthHUD(player.health);
        this._updateObjectiveHUD(player, rulesManager);
        
        // Update rule UI
        this._updateRuleUI(rulesManager);
        
        // Update infection effects
        this._updateInfectionEffects(player, canvasElement);
        
        // Update screen shake if Visual Processor infection active
        this._updateScreenShake(dt, player);
    }
    
    /**
     * Update health display with color coding
     * @param {number} health - Player health percentage (0-100)
     */
    _updateHealthHUD(health) {
        // Update text
        this.healthDisplay.textContent = `${Math.round(health)}%`;
        
        // Update bar width
        this.healthBar.style.width = `${health}%`;
        
        // Update color based on health level
        if (health <= 30) {
            this.healthDisplay.parentElement.classList.add('critical');
        } else {
            this.healthDisplay.parentElement.classList.remove('critical');
        }
    }
    
    /**
     * Update objective displays (nodes secure, viruses active)
     * @param {Player} player - Player object
     * @param {RulesManager} rulesManager - Rule state manager
     */
    _updateObjectiveHUD(player, rulesManager) {
        // This will be implemented when we have node and virus management
        // For now, use placeholder values
        this.nodesSecureDisplay.textContent = "1/5";
        this.virusesActiveDisplay.textContent = "3";
        
        // Rule [2] NODES ARE LOCKED affects node interaction
        if (rulesManager.isRuleActive(2)) {
            this.nodesSecureDisplay.style.opacity = '0.5';
        } else {
            this.nodesSecureDisplay.style.opacity = '1';
        }
    }
    
    /**
     * Update rule UI elements
     * @param {RulesManager} rulesManager - Rule state manager
     */
    _updateRuleUI(rulesManager) {
        // Get all rule states
        const ruleStates = rulesManager.getAllRuleStates();
        
        // Update Rules 1-2 (toggle with cooldown and duration)
        for (const ruleId of [1, 2]) {
            const rowElement = this.allRuleRows[ruleId];
            const timerElement = this.allRuleTimers[ruleId];
            
            if (!rowElement || !timerElement) continue;
            
            // Update active state class
            rowElement.classList.toggle('active', ruleStates[ruleId].active);
            
            // Update state text and timer
            if (ruleStates[ruleId].active) {
                rowElement.classList.remove('cooldown', 'ready');
                rowElement.classList.add('active');
                
                if (ruleId === 1) {
                    timerElement.textContent = 'ON';
                } else {
                    timerElement.textContent = ruleStates[ruleId].activeTimer.toFixed(1) + 's';
                    timerElement.className = 'rule-timer duration';
                }
            } else if (ruleId === 1 && ruleStates[ruleId].cooldownTimer > 0) {
                // Rule 1 is toggle with cooldown
                rowElement.classList.remove('active', 'ready');
                rowElement.classList.add('cooldown');
                timerElement.textContent = ruleStates[ruleId].cooldownTimer.toFixed(1) + 's';
                timerElement.className = 'rule-timer cooldown';
            } else if (ruleId === 2 && ruleStates[ruleId].cooldownTimer > 0) {
                // Rule 2 is duration with cooldown
                rowElement.classList.remove('active', 'ready');
                rowElement.classList.add('cooldown');
                timerElement.textContent = ruleStates[ruleId].cooldownTimer.toFixed(1) + 's';
                timerElement.className = 'rule-timer cooldown';
            } else if (ruleId === 2 && ruleStates[ruleId].activeTimer > 0) {
                // Rule 2 is duration with active timer
                rowElement.classList.remove('cooldown', 'ready');
                rowElement.classList.add('active');
                timerElement.textContent = ruleStates[ruleId].activeTimer.toFixed(1) + 's';
                timerElement.className = 'rule-timer duration';
            } else {
                // Rule is ready
                rowElement.classList.remove('active', 'cooldown');
                rowElement.classList.add('ready');
                
                if (ruleId === 1) {
                    timerElement.textContent = 'READY';
                } else {
                    timerElement.textContent = 'READY';
                }
            }
        }
        
        // Update Rules 3-5 (duration only)
        for (const ruleId of [3, 4, 5]) {
            const rowElement = this.ruleRowsDuration[ruleId];
            const timerElement = this.ruleTimersDuration[ruleId];
            
            if (!rowElement || !timerElement) continue;
            
            if (ruleStates[ruleId].active) {
                rowElement.classList.remove('cooldown', 'ready');
                rowElement.classList.add('active');
                timerElement.textContent = ruleStates[ruleId].activeTimer.toFixed(1) + 's';
                timerElement.className = 'duration-value active';
            } else if (ruleStates[ruleId].cooldownTimer > 0) {
                rowElement.classList.remove('active', 'ready');
                rowElement.classList.add('cooldown');
                timerElement.textContent = ruleStates[ruleId].cooldownTimer.toFixed(1) + 's';
                timerElement.className = 'duration-value cooldown';
            } else {
                rowElement.classList.remove('active', 'cooldown');
                rowElement.classList.add('ready');
                timerElement.textContent = 'READY';
                timerElement.className = 'duration-value ready';
            }
        }
    }
    
    /**
     * Update infection effect classes on DOM elements
     * @param {Player} player - Player object
     * @param {HTMLElement} canvasElement - Canvas element for effects
     */
    _updateInfectionEffects(player, canvasElement) {
        // Get current infection debuffs
        const currentDebuffs = new Set(player.activeDebuffs);
        
        // Remove effects that are no longer active
        for (const effect of this.activeInfectionEffects) {
            if (!currentDebuffs.has(effect)) {
                this._removeInfectionEffect(effect);
            }
        }
        
        // Add new effects
        for (const debuff of currentDebuffs) {
            if (!this.activeInfectionEffects.has(debuff)) {
                this._addInfectionEffect(debuff);
            }
        }
        
        // Update active effects set
        this.activeInfectionEffects = currentDebuffs;
    }
    
    /**
     * Add infection effect class to appropriate elements
     * @param {number} debuffId - ID of the infection debuff
     */
    _addInfectionEffect(debuffId) {
        // Visual Processor (ID 1) - screen shake + chromatic aberration
        if (debuffId === 1) {
            document.body.classList.add('infection-visual');
            // Note: screen shake is handled separately via timer
        }
        
        // Auditory Processing (ID 2) - RGB static overlay
        if (debuffId === 2) {
            document.body.classList.add('infection-auditory');
        }
        
        // Neural Link (ID 3) - rule toggle delay indicator
        if (debuffId === 3) {
            document.body.classList.add('infection-neural');
            // Could add a visual indicator for delayed rule toggles
        }
        
        // Life Support (ID 4) - HP drain indicator
        if (debuffId === 4) {
            document.body.classList.add('infection-life');
        }
    }
    
    /**
     * Remove infection effect class from DOM elements
     * @param {number} debuffId - ID of the infection debuff
     */
    _removeInfectionEffect(debuffId) {
        // Visual Processor
        if (debuffId === 1) {
            document.body.classList.remove('infection-visual');
            // Stop screen shake
            document.getElementById('game-canvas').style.transform = 'none';
        }
        
        // Auditory Processing
        if (debuffId === 2) {
            document.body.classList.remove('infection-auditory');
        }
        
        // Neural Link
        if (debuffId === 3) {
            document.body.classList.remove('infection-neural');
        }
        
        // Life Support
        if (debuffId === 4) {
            document.body.classList.remove('infection-life');
        }
    }
    
    /**
     * Update screen shake effect for Visual Processor infection
     * @param {number} dt - Delta time in seconds
     * @param {Player} player - Player object
     */
    _updateScreenShake(dt, player) {
        // Visual Processor infection (ID 1) causes screen shake
        if (player.activeDebuffs.includes(1)) {
            this.shakeTimer += dt;
            
            if (this.shakeTimer >= this.shakeInterval) {
                this.shakeTimer = 0;
                
                // Apply random shake offset
                const canvas = document.getElementById('game-canvas');
                const shakeAmount = 2; // pixels
                const offsetX = (Math.random() - 0.5) * shakeAmount;
                const offsetY = (Math.random() - 0.5) * shakeAmount;
                
                canvas.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
            }
        } else {
            // Reset shake
            this.shakeTimer = 0;
            const canvas = document.getElementById('game-canvas');
            canvas.style.transform = 'none';
        }
    }
    
    /**
     * Show game over or win message
     * @param {string} title - Message title
     * @param {string} message - Message content
     */
    showMessage(title, message) {
        const messageOverlay = document.getElementById('game-message');
        const titleElement = document.getElementById('game-message-title');
        const contentElement = document.getElementById('game-message-content');
        
        titleElement.textContent = title;
        contentElement.textContent = message;
        
        messageOverlay.classList.remove('hidden');
    }
    
    /**
     * Hide game message overlay
     */
    hideMessage() {
        document.getElementById('game-message').classList.add('hidden');
    }
    
    /**
     * Toggle debug overlay visibility
     * @param {boolean} visible - Whether to show the overlay
     */
    toggleDebugOverlay(visible) {
        const debugOverlay = document.getElementById('debug-overlay');
        if (visible) {
            debugOverlay.classList.add('visible');
        } else {
            debugOverlay.classList.remove('visible');
        }
    }
    
    /**
     * Update debug info display
     * @param {object} info - Debug information object
     */
    updateDebugInfo(info) {
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            debugInfo.innerHTML = this._formatDebugInfo(info);
        }
    }
    
    /**
     * Format debug info for display
     * @param {object} info - Debug information object
     * @returns {string} Formatted HTML
     */
    _formatDebugInfo(info) {
        let html = '<div class="debug-section">Player State</div>';
        html += `<div>Position: ${info.player?.x.toFixed(2)}, ${info.player?.y.toFixed(2)}</div>`;
        html += `<div>Angle: ${info.player?.angle.toFixed(2)} rad</div>`;
        html += `<div>Health: ${info.player?.health.toFixed(0)}%</div>`;
        html += `<div>Debuffs: ${info.player?.activeDebuffs.join(', ') || 'None'}</div>`;
        
        html += '<div class="debug-section">Rule States</div>';
        for (const [ruleId, rule] of Object.entries(info.rules)) {
            const active = rule.active ? 'ON' : 'OFF';
            const timer = rule.timer.toFixed(1);
            html += `<div>[${ruleId}] ${active} (${timer}s)</div>`;
        }
        
        return html;
    }
    
    /**
     * Update capture status display
     * @param {boolean} nearby - Whether virus is within capture range
     * @param {string} status - Status text to display
     */
    updateCaptureStatus(nearby, status) {
        this.virusNearby = nearby;
        
        if (nearby) {
            this.captureStatus.classList.add('nearby');
            this.captureStatus.classList.remove('ready');
            this.captureText.textContent = status || 'VIRUS NEARBY - READY TO CAPTURE [C]';
            this.captureHint.textContent = 'READY [C]';
        } else {
            this.captureStatus.classList.remove('nearby');
            this.captureStatus.classList.add('ready');
            this.captureText.textContent = 'NO ENEMIES NEARBY';
            this.captureHint.textContent = '[C]';
        }
    }
}
