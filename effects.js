"use strict";

/**
 * Effects - Manages visual feedback and UI updates for game state
 * Handles HUD updates, infection effects, and rule timer displays
 */
export default class Effects {
    constructor() {
        // DOM element references
        this.healthDisplay = document.getElementById('health-display');
        this.nodesSecureDisplay = document.getElementById('nodes-secure-display');
        this.virusesActiveDisplay = document.getElementById('viruses-active-display');
        
        // Rule UI elements
        this.ruleToggles = {
            1: document.getElementById('rule1-toggle'),
            2: document.getElementById('rule2-toggle')
        };
        
        this.ruleTimers = {
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
        // Update toggle rules (1, 2)
        for (const ruleId of [1, 2]) {
            const ruleState = rulesManager.getRuleState(ruleId);
            if (ruleState) {
                const toggleButton = this.ruleToggles[ruleId];
                if (toggleButton) {
                    toggleButton.textContent = ruleState.active ? 'ON' : 'OFF';
                    toggleButton.classList.toggle('active', ruleState.active);
                    toggleButton.disabled = false;
                }
            }
        }
        
        // Update duration rules (3, 4, 5)
        for (const ruleId of [3, 4, 5]) {
            const ruleState = rulesManager.getRuleState(ruleId);
            if (ruleState) {
                const timerElement = this.ruleTimers[ruleId];
                if (timerElement) {
                    if (ruleState.active) {
                        // Show active timer (format: MM:SS)
                        const minutes = Math.floor(ruleState.timer / 60);
                        const seconds = Math.floor(ruleState.timer % 60);
                        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                        timerElement.style.color = '#00ff00'; // Active = green
                    } else if (ruleState.cooldownTimer > 0) {
                        // Show cooldown timer
                        const minutes = Math.floor(ruleState.cooldownTimer / 60);
                        const seconds = Math.floor(ruleState.cooldownTimer % 60);
                        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                        timerElement.style.color = '#ff0000'; // Cooldown = red
                    } else {
                        // Ready to activate
                        timerElement.textContent = 'READY';
                        timerElement.style.color = '#00ffff'; // Ready = cyan
                    }
                }
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
}