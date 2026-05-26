"use strict";

/**
 * Raycaster - Implements 2.5D raycasting engine using DDA algorithm
 * Projects walls onto canvas based on player position and angle
 */
export default class Raycaster {
    constructor(canvas, ctx, mapData, rulesManager) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.mapData = mapData;
        this.rulesManager = rulesManager;
        
        // Raycasting parameters
        this.FOV = Math.PI / 3; // 60 degrees
        this.NUM_RAYS = this.canvas.width; // Matches canvas width (1:1 pixel-to-ray ratio)
        this.DIST_PROJ_PLANE = this.canvas.width / (2 * Math.tan(this.FOV / 2));
        
        // Tile properties
        this.TILE_SIZE = 64;
        this.MAP_WIDTH = this.mapData[0].length;
        this.MAP_HEIGHT = this.mapData.length;
        
        // Wall colors based on tile ID
        this.wallColors = {
            1: '#00ff00',    // WALL - Green neon
            2: '#ff00ff',    // FIREWALL - Purple neon
            6: '#00ffff',    // WALL_VARIANTS - Cyan neon
            7: '#ffff00',    // WALL_VARIANTS - Yellow neon
            8: '#ff0000'     // WALL_VARIANTS - Red neon
        };
    }
    
    /**
     * Check if a map coordinate is a solid wall
     * @param {number} x - X coordinate in tiles
     * @param {number} y - Y coordinate in tiles
     * @returns {boolean} True if this tile should block rays
     */
    isWall(x, y) {
        // Bounds checking
        if (x < 0 || x >= this.MAP_WIDTH || y < 0 || y >= this.MAP_HEIGHT) {
            return true; // Treat out-of-bounds as wall
        }
        
        const tileId = this.mapData[Math.floor(y)][Math.floor(x)];
        
        // Walls (1, 6-8) are always solid
        // Firewall (2) becomes solid when Rule [1] is active
        if (tileId === 2) {
            // Firewall is solid only when Rule [1] is active
            return this.rulesManager && this.rulesManager.isRuleActive(1);
        }
        return [1, 6, 7, 8].includes(tileId);
    }
    
    /**
     * Cast a single ray and return distance to wall hit
     * Uses DDA algorithm for efficient wall detection
     */
    castRay(angle, playerX, playerY) {
        // Ray direction
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        
        // Current cell coordinates
        let mapX = Math.floor(playerX);
        let mapY = Math.floor(playerY);
        
        // Length of ray from current position to next x or y-side
        let sideDistX;
        let sideDistY;
        
        // Length of ray from one x or y-side to next x or y-side
        const deltaDistX = Math.abs(1 / dirX);
        const deltaDistY = Math.abs(1 / dirY);
        
        // Step direction
        let stepX;
        let stepY;
        
        // Calculate step and initial sideDist
        if (dirX < 0) {
            stepX = -1;
            sideDistX = (playerX - mapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (mapX + 1.0 - playerX) * deltaDistX;
        }
        
        if (dirY < 0) {
            stepY = -1;
            sideDistY = (playerY - mapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (mapY + 1.0 - playerY) * deltaDistY;
        }
        
        // Perform DDA
        let hit = 0; // Was there a wall hit?
        let side;    // Was a NS or a EW wall hit?
        let hitTileId = 0; // Tile ID that was hit
        
        while (hit === 0) {
            // Jump to next map square, OR in x-direction, OR in y-direction
            if (sideDistX < sideDistY) {
                sideDistX += deltaDistX;
                mapX += stepX;
                side = 0; // Hit vertical wall edge
            } else {
                sideDistY += deltaDistY;
                mapY += stepY;
                side = 1; // Hit horizontal wall edge
            }
            
            // Check if ray has hit a wall
            if (this.isWall(mapX, mapY)) {
                hit = 1;
                hitTileId = this.mapData[Math.floor(mapY)][Math.floor(mapX)];
            }
        }
        
        // Calculate distance projected on camera direction
        let perpWallDist;
        if (side === 0) {
            perpWallDist = (mapX - playerX + (1 - stepX) / 2) / dirX;
        } else {
            perpWallDist = (mapY - playerY + (1 - stepY) / 2) / dirY;
        }
        
        return {
            distance: perpWallDist,
            tileId: hitTileId,
            side: side
        };
    }
    
    /**
     * Render the 3D scene using raycasting
     * @param {number} playerX - Player X position in tiles
     * @param {number} playerY - Player Y position in tiles
     * @param {number} playerAngle - Player viewing angle in radians
     */
    render(playerX, playerY, playerAngle) {
        // Clear canvas with background color (sky/floor gradient)
        this._drawBackground();
        
        // Cast rays for each column
        const startAngle = playerAngle - this.FOV / 2;
        const angleStep = this.FOV / this.NUM_RAYS;
        
        for (let i = 0; i < this.NUM_RAYS; i++) {
            const rayAngle = startAngle + i * angleStep;
            
            // Cast ray and get information (now returns object with distance, tileId, and side)
            const hitInfo = this.castRay(rayAngle, playerX, playerY);
            const dist = hitInfo.distance;
            const tileId = hitInfo.tileId;
            const side = hitInfo.side;
            
            // Fix fisheye distortion by using perpendicular distance
            const fixedDist = dist * Math.cos(rayAngle - playerAngle);
            
            // Calculate wall height (inverse projection)
                    const wallHeight = this.canvas.height / fixedDist;
            
            // Calculate top and bottom positions for wall strip
            const ceiling = (this.canvas.height - wallHeight) / 2;
            const floor = ceiling + wallHeight;
            
            // Determine wall color based on tile type at hit point
            let wallColor = this.wallColors[tileId] || '#00ff00'; // Default to WALL color
            
            // If Rule [1] is OFF and this is a firewall (tile ID 2), skip rendering (invisible)
            if (tileId === 2 && this.rulesManager && !this.rulesManager.isRuleActive(1)) {
                // Skip this ray - make firewall invisible when rule is OFF
                continue;
            }
            
            // Apply side shading for texture effect
            if (side === 1) {
                // Darken horizontal wall edges slightly
                wallColor = this._darkenColor(wallColor, 0.9);
            }
            
            // Draw wall strip
            this.ctx.fillStyle = wallColor;
            this.ctx.fillRect(i, ceiling, 1, wallHeight);
            
            // Add shading for distance (fog effect)
            const distanceFade = Math.max(0.1, 1 - fixedDist / 32); // Fade out at ~32 tiles
            this.ctx.fillStyle = `rgba(0,0,0,${1 - distanceFade})`;
            this.ctx.fillRect(i, ceiling, 1, wallHeight);
        }
    }
    
    /**
     * Draw background (sky and floor)
     */
    _drawBackground() {
        // Ceiling gradient - light grey near player to dark grey at edges
        const ceilingGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height / 2);
        ceilingGradient.addColorStop(0, '#4a4a4a');  // Light grey near player
        ceilingGradient.addColorStop(1, '#1a1a1a'); // Dark grey at edges
        
        this.ctx.fillStyle = ceilingGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height / 2);
        
        // Floor gradient with vaporwave grid aesthetic
        const floorYStart = this.canvas.height / 2;
        const floorGradient = this.ctx.createLinearGradient(0, floorYStart, 0, this.canvas.height);
        floorGradient.addColorStop(0, '#121214'); // Dark charcoal at horizon
        floorGradient.addColorStop(1, '#2c0054');  // Deep neon violet at bottom
        
        this.ctx.fillStyle = floorGradient;
        this.ctx.fillRect(0, floorYStart, this.canvas.width, this.canvas.height / 2);
        
        // Draw vaporwave perspective grid lines
        this._drawFloorGrid(floorYStart);
    }
    
    /**
     * Draw retro-cyberpunk perspective grid on the floor
     * Uses static 2D calculations for performance
     */
    _drawFloorGrid(horizonY) {
        const ctx = this.ctx;
        const screenWidth = this.canvas.width;
        const screenHeight = this.canvas.height;
        const centerX = screenWidth / 2;
        const centerY = horizonY;
        
        // Store original alpha and set cyan grid lines
        const originalAlpha = ctx.globalAlpha;
        ctx.globalAlpha = 0.3; // Subtle glowing effect
        ctx.strokeStyle = '#00f0ff'; // Neon cyan
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        
        // Draw vertical vanishing lines (14 lines)
        const numVerticalLines = 14;
        for (let i = 0; i < numVerticalLines; i++) {
            // Calculate angle for each line
            const angle = (i / (numVerticalLines - 1)) * Math.PI / 2 - Math.PI / 4;
            
            // Calculate endpoint at bottom of screen
            const slope = Math.tan(angle);
            const endX = centerX + (screenHeight - centerY) * slope;
            
            // Draw line from vanishing point to bottom of screen
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(endX, screenHeight);
        }
        
        // Draw horizontal faux-perspective lines
        // Exponential spacing for depth compression
        const numHorizontalLines = 16;
        const minSpacing = 2; // Minimum pixel spacing near horizon
        const maxSpacing = 8; // Maximum pixel spacing at bottom
        
        for (let i = 1; i <= numHorizontalLines; i++) {
            // Calculate spacing with exponential compression
            const t = i / numHorizontalLines;
            const spacing = minSpacing + (maxSpacing - minSpacing) * Math.pow(t, 3); // Cubic compression
            
            // Calculate Y position from horizon
            const y = centerY + spacing * 10 * i; // Scale factor for visibility
            
            // Only draw lines that are within the floor area
            if (y >= centerY && y <= screenHeight) {
                ctx.moveTo(0, y);
                ctx.lineTo(screenWidth, y);
            }
        }
        
        ctx.stroke();
        
        // Restore original alpha to avoid affecting wall rendering
        ctx.globalAlpha = originalAlpha;
    }
    
    /**
     * Darken a hex color by a factor
     */
    _darkenColor(color, factor) {
        // Convert hex to RGB
        let r = parseInt(color.substring(1, 3), 16);
        let g = parseInt(color.substring(3, 5), 16);
        let b = parseInt(color.substring(5, 7), 16);
        
        // Apply darkening factor
        r = Math.floor(r * factor);
        g = Math.floor(g * factor);
        b = Math.floor(b * factor);
        
        // Convert back to hex
        return `rgb(${r},${g},${b})`;
    }
    
    /**
     * Get map dimensions
     */
    getMapDimensions() {
        return {
            width: this.MAP_WIDTH,
            height: this.MAP_HEIGHT,
            tileSize: this.TILE_SIZE
        };
    }
}