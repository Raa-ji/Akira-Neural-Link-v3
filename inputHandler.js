"use strict";

/**
 * InputHandler - Manages keyboard input for the game
 * 
 * Tracks key states for movement, combat, and UI controls
 * All key states are stored in a map for easy querying
 */
export default class InputHandler {
    constructor() {
        // Key state tracking: key code -> boolean (pressed/released)
        this.keys = new Map();
        
        // Input mapping - maps logical actions to key codes
        this.INPUT_MAP = {
            // Movement
            FORWARD: 'w',
            BACKWARD: 's',
            STRAFE_LEFT: 'a',
            STRAFE_RIGHT: 'd',
            
            // Actions
            CAPTURE_VIRUS: 'c',
            QUARANTINE: 'v',
            DEBUG_OVERLAY: 'F1',
            
            // Rule hotkeys
            RULE_1: '1',
            RULE_2: '2',
            RULE_3: '3',
            RULE_4: '4',
            RULE_5: '5',
            
            // Alternative keys
            MOVE_UP: 'ArrowUp',
            MOVE_DOWN: 'ArrowDown',
            JUMP: ' ',
        };
        
        // Mouse movement tracking for pointer lock
        this.mouseDeltaX = 0;
        
        // Bind event listeners
        this._bindEvents();
        this._bindPointerLockEvents();
    }
    
    /**
     * Initialize and bind keyboard event listeners
     * Prevents default browser behavior for game-critical keys
     */
    _bindEvents() {
        // Key down event
        window.addEventListener('keydown', (e) => {
            // Prevent default behavior for game-critical keys
            if (this._shouldPreventDefault(e.key)) {
                e.preventDefault();
            }
            
            // Record key state
            this.keys.set(e.key, true);
            this.keys.set(e.code, true);
        });
        
        // Key up event
        window.addEventListener('keyup', (e) => {
            // Record key state
            this.keys.set(e.key, false);
            this.keys.set(e.code, false);
        });
    }
    
    /**
     * Bind pointer lock event listeners
     */
    _bindPointerLockEvents() {
        // Handle mouse movement when pointer is locked
        window.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        // Handle pointer lock change events
        document.addEventListener('pointerlockchange', () => {
            console.log('Pointer lock state:', this.isPointerLocked() ? 'locked' : 'unlocked');
        });
    }

    /**
     * Determine if default browser behavior should be prevented
     * for a given key
     */
    _shouldPreventDefault(key) {
        const preventKeys = [
            'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
            ' ', 'Spacebar', // Space
            'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
            '1', '2', '3', '4', '5'
        ];
        
        return preventKeys.includes(key);
    }
    
    /**
     * Check if a key is currently pressed
     */
    isPressed(key) {
        // Check both key name and key code
        return this.keys.get(key) || this.keys.get(this._getKeyCode(key));
    }
    /**
     * Get the key code for a key name (for lookup purposes)
     */
    _getKeyCode(key) {
        const keyMap = {
            // Movement keys
            'w': 'KeyW', 's': 'KeyS', 'a': 'KeyA', 'd': 'KeyD',
            'q': 'KeyQ', 'e': 'KeyE',
            // Action keys
            'c': 'KeyC', 'v': 'KeyV', 'f': 'KeyF',
            // Number keys (including rule hotkeys)
            '1': 'Digit1', '2': 'Digit2', '3': 'Digit3', '4': 'Digit4', '5': 'Digit5',
            '6': 'Digit6', '7': 'Digit7', '8': 'Digit8', '9': 'Digit9', '0': 'Digit0',
            // Function keys
            'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4', 'F5': 'F5',
            'F6': 'F6', 'F7': 'F7', 'F8': 'F8', 'F9': 'F9', 'F10': 'F10',
            'F11': 'F11', 'F12': 'F12',
            // Arrow keys
            'ArrowUp': 'ArrowUp', 'ArrowDown': 'ArrowDown',
            'ArrowLeft': 'ArrowLeft', 'ArrowRight': 'ArrowRight',
            // Special keys
            ' ': 'Space', 'Spacebar': 'Space', 'Enter': 'Enter', 'Escape': 'Escape',
            'Tab': 'Tab', 'Shift': 'ShiftLeft', 'Control': 'ControlLeft',
            'Alt': 'AltLeft', 'CapsLock': 'CapsLock'
        };
        
        return keyMap[key] || key;
    }
    
    /**
     * Check for combined key states (e.g., Q + ArrowLeft for turning)
     */
    isCombinedPressed(key1, key2) {
        return this.isPressed(key1) && this.isPressed(key2);
    }
    
    /**
     * Reset all key states and mouse delta (useful for debugging or state reset)
     */
    reset() {
        this.keys.clear();
        this.mouseDeltaX = 0;
    }
    
    /**
     * Get all currently pressed keys (for debugging or advanced input handling)
     */
    getPressedKeys() {
        const pressed = [];
        for (const [key, value] of this.keys) {
            if (value) {
                pressed.push(key);
            }
        }
        return pressed;
    }

    /**
     * Request pointer lock on a target element
     * @param {HTMLElement} element - Element to lock pointer to
     */
    requestPointerLock(element) {
        if (element.requestPointerLock) {
            element.requestPointerLock();
        } else if (element.mozRequestPointerLock) {
            element.mozRequestPointerLock();
        }
    }

    /**
     * Check if pointer is currently locked
     */
    isPointerLocked() {
        return !!document.pointerLockElement ||
               !!document.mozPointerLockElement;
    }

    /**
     * Handle mouse movement when pointer is locked
     * Accumulates horizontal mouse delta (only x-axis for look)
     */
    handleMouseMove(e) {
        if (this.isPointerLocked()) {
            // Accumulate horizontal mouse delta
            this.mouseDeltaX += e.movementX || e.mozMovementX || e.webkitMovementX || 0;
        }
    }

    /**
     * Reset mouse delta after frame processing
     */
    resetMouseDelta() {
        this.mouseDeltaX = 0;
    }
}

