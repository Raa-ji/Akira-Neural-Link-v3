"use strict";

/**
 * RulesManager - Centralized rule state machine for game mechanics
 * Handles rule toggles, duration timers, cooldowns, and activation logic
 */
export default class RulesManager {
    constructor() {
        // Rule definitions with their properties
        this.RULES = {
            // Toggle rules with cooldowns
            1: {
                name: 'FIREWALL IS WALL',
                type: 'toggle',
                active: true,       // ON by default as per spec
                default: true,
                cooldown: 10.0,     // 10s cooldown
                cooldownTimer: 0.0
            },
            2: {
                name: 'NODES ARE LOCKED',
                type: 'duration',
                duration: 5.0,      // 5s active
                cooldown: 55.0,     // 55s cooldown (5 + 55 = 60s total)
                activeTimer: 0.0,
                cooldownTimer: 0.0,
                active: false
            },
            // Duration rules (timed activation with cooldown)
            3: {
                name: 'VIRUS IS STOP',
                type: 'duration',
                duration: 3.5,      // 3.5s active
                cooldown: 52.5,     // 52.5s cooldown
                activeTimer: 0.0,
                cooldownTimer: 0.0,
                active: false
            },
            4: {
                name: 'VIRUS IS SLOW',
                type: 'duration',
                duration: 8.0,      // 8s active
                cooldown: 20.0,     // 20s cooldown
                activeTimer: 0.0,
                cooldownTimer: 0.0,
                active: false
            },
            5: {
                name: 'COOLANT IS SAFE',
                type: 'duration',
                duration: 6.0,      // 6s active
                cooldown: 12.0,     // 12s cooldown
                activeTimer: 0.0,
                cooldownTimer: 0.0,
                active: false
            }
        };
        
        // Infection flag for Neural Link (rule activation delay)
        this.hasNeuralLinkDebuff = false;
    }
    
    /**
     * Update rule timers based on elapsed time
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        // Update all rules
        for (const ruleId in this.RULES) {
            const rule = this.RULES[ruleId];
            
            if (rule.type === 'duration') {
                if (rule.active) {
                    // Decrement active timer
                    rule.activeTimer -= dt;
                    
                    if (rule.activeTimer <= 0) {
                        // Duration ended, start cooldown
                        rule.active = false;
                        rule.activeTimer = 0;
                        rule.cooldownTimer = rule.cooldown;
                    }
                } else if (rule.cooldownTimer > 0) {
                    // Decrement cooldown timer
                    rule.cooldownTimer -= dt;
                    
                    if (rule.cooldownTimer <= 0) {
                        // Cooldown complete
                        rule.cooldownTimer = 0;
                    }
                }
            } else if (rule.type === 'toggle') {
                // Toggle rules (Rule 1) only have cooldown timer
                if (rule.cooldownTimer > 0) {
                    rule.cooldownTimer -= dt;
                    
                    if (rule.cooldownTimer <= 0) {
                        rule.cooldownTimer = 0;
                    }
                }
            }
        }
    }
    
    /**
     * Attempt to activate/toggle a rule
     * @param {number} ruleId - Rule ID (1-5)
     * @param {boolean} hasNeuralLinkDebuff - Whether Neural Link infection is active
     * @returns {object} Result object with success status and message
     */
    activateRule(ruleId, hasNeuralLinkDebuff = false) {
        const rule = this.RULES[ruleId];
        
        if (!rule) {
            return {
                success: false,
                message: `Invalid rule ID: ${ruleId}`
            };
        }
        
        // Toggle rules with cooldown (1)
        if (rule.type === 'toggle') {
            // Cannot toggle if on cooldown
            if (rule.cooldownTimer > 0) {
                return {
                    success: false,
                    message: `Rule [${ruleId}] is on cooldown (${rule.cooldownTimer.toFixed(1)}s remaining)`
                };
            }
            
            // Toggle state
            rule.active = !rule.active;
            
            // Start cooldown
            rule.cooldownTimer = rule.cooldown;
            
            return {
                success: true,
                message: `Rule [${ruleId}] ${rule.name}: ${rule.active ? 'ON' : 'OFF'}`,
                newActiveState: rule.active
            };
        }
        
        // Duration rules (2, 3, 4, 5)
        if (rule.type === 'duration') {
            // Cannot activate if already active
            if (rule.active) {
                return {
                    success: false,
                    message: `Rule [${ruleId}] is already active (${rule.activeTimer.toFixed(1)}s remaining)`
                };
            }
            
            // Cannot activate if on cooldown
            if (rule.cooldownTimer > 0) {
                return {
                    success: false,
                    message: `Rule [${ruleId}] is on cooldown (${rule.cooldownTimer.toFixed(1)}s remaining)`
                };
            }
            
            // Apply activation with potential delay if Neural Link infection active
            let activationDelay = 0;
            if (hasNeuralLinkDebuff) {
                activationDelay = 0.5; // 500ms delay
            }
            
            // Set active state
            rule.active = true;
            rule.activeTimer = rule.duration - activationDelay;
            rule.cooldownTimer = rule.cooldown;
            
            return {
                success: true,
                message: `Rule [${ruleId}] ${rule.name}: ACTIVATED`,
                activationDelay: activationDelay,
                newActiveState: true
            };
        }
        
        return {
            success: false,
            message: `Unknown rule type for rule [${ruleId}]`
        };
    }
    
    /**
     * Get current state of all rules
     */
    getAllRuleStates() {
        const states = {};
        
        for (const [ruleId, rule] of Object.entries(this.RULES)) {
            states[ruleId] = {
                ...rule,
                timer: rule.active ? rule.activeTimer : rule.cooldownTimer
            };
        }
        
        return states;
    }
    
    /**
     * Get specific rule state
     * @param {number} ruleId - Rule ID
     */
    getRuleState(ruleId) {
        const rule = this.RULES[ruleId];
        if (!rule) return null;
        
        return {
            ...rule,
            timer: rule.active ? rule.activeTimer : rule.cooldownTimer
        };
    }
    
    /**
     * Set Neural Link infection state
     * @param {boolean} hasDebuff - Whether Neural Link infection is active
     */
    setNeuralLinkDebuff(hasDebuff) {
        this.hasNeuralLinkDebuff = hasDebuff;
    }
    
    /**
     * Check if a rule is currently active
     * @param {number} ruleId - Rule ID
     */
    isRuleActive(ruleId) {
        const rule = this.RULES[ruleId];
        if (!rule) return false;
        
        return rule.active;
    }
    
    /**
     * Check if a duration rule can be activated (not active and not on cooldown)
     * @param {number} ruleId - Rule ID
     */
    canActivateRule(ruleId) {
        const rule = this.RULES[ruleId];
        if (!rule) return false;
            
        // Toggle rules (1) - check if not on cooldown
        if (rule.type === 'toggle') {
            return rule.cooldownTimer <= 0;
        }
        
        // Duration rules (2-5) - check if not active and not on cooldown
        return !rule.active && rule.cooldownTimer <= 0;
    }
    
    /**
     * Force Rule 1 state (used for RULE_BLOCK and OVERRIDE tiles)
     * @param {boolean} newState - Force Rule 1 to this state
     */
    forceRule1State(newState) {
        const rule = this.RULES[1];
        if (!rule) return;
        
        rule.active = newState;
        
        // Reset cooldown to allow immediate toggle back
        rule.cooldownTimer = 0;
    }
    
    /**
     * Reset all rules to defaults
     */
    reset() {
        for (const ruleId in this.RULES) {
            const rule = this.RULES[ruleId];
            
            if (rule.type === 'toggle') {
                rule.active = rule.default;
                rule.cooldownTimer = 0;
            } else {
                rule.active = false;
                rule.activeTimer = 0;
                rule.cooldownTimer = 0;
            }
        }
    }
}