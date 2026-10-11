# Neural Link v3 — Virus AI & Game Mechanics Enhancement Plan

## Overview

This document outlines the step-by-step plan to implement the missing virus AI behavior and supporting game mechanics that will make the virus pursuit challenging and engaging. The core issue is that viruses currently have no node-seeking behavior and no awareness of the player carrying a captured virus.

## Architecture Decisions

### Virus Pathfinding Approach

Viruses will use a **hybrid pathfinding model**:

1. **Exploration Mode (Seeking Nodes)**: Viruses do NOT have full map awareness. They use a **local exploration** approach where they:
   - Know the positions of all nodes (this is game-state knowledge, not map knowledge)
   - Know which nodes are infected/uninfected (game state)
   - Do NOT know the path to unvisited nodes — they must explore to find routes
   - Use a **fog-of-war style memory** to track explored areas and previously visited nodes

2. **Memory System**: Each virus maintains its own memory:
   - **Visited nodes**: A set of node IDs the virus has physically reached
   - **Explored map areas**: A grid tracking which tiles the virus has traversed
   - **Known paths**: Cached paths to previously visited nodes (so they can return efficiently)
   - Memory persists for the virus's lifetime (until captured/quarantined)

3. **Pursuit Mode (Player Carrying Virus)**: When the player is carrying a captured virus:
   - Viruses temporarily gain **full pathfinding awareness** to the player's position
   - They use A\* or similar to find the most direct route to the player
   - This is a temporary, aggressive state — not their normal behavior

### Technical Implementation of "Searching"

To make viruses seem like they're searching rather than teleporting to nodes:

- Viruses use a **wander-and-discover** approach when seeking unvisited nodes
- They move toward the general direction of the closest unvisited node
- When they encounter obstacles, they navigate around them using wall-following or local pathfinding
- Once they reach a node, they "remember" the path back
- If a node is cleansed, they can return to it using their remembered path

## Step-by-Step Implementation Plan

### Phase 1: Core Infrastructure

#### Step 1: Add Node Array to Virus Update

**File**: `game.js`, `virus.js`

- Modify `virus.update()` signature to accept the `nodes` array
- Pass `this.nodes` from `game.js` when calling `virus.update()`

#### Step 2: Add Player Carrying State to Game

**File**: `game.js`

- Add `this.playerCarryingVirus = false` to Game constructor
- Add `this.carryingVirusId = null` to track which virus is carried
- Add methods:
  - `setPlayerCarryingVirus(virusId)` — sets carrying state
  - `clearPlayerCarryingVirus()` — clears carrying state (on quarantine)
  - `isPlayerCarryingVirus()` — returns boolean

#### Step 3: Add Quarantine System

**File**: `game.js`, `virus.js`

- Add quarantine timer to Game: `this.quarantineTimer = 0`
- Add quarantine duration constant: `QUARANTINE_DURATION = 2.0` (seconds, adjustable)
- Add quarantine progress tracking
- When player presses `V` while carrying a virus and stationary:
  - Start quarantine timer
  - If player moves, reset timer
  - On completion: increment `virusesQuarantined`, clear carrying state, remove virus from active list

### Phase 2: Virus Memory System

#### Step 4: Add Memory to Virus Class

**File**: `virus.js`

Add to Virus constructor:

```javascript
// Memory system
this.memory = {
  visitedNodes: new Set(), // Node IDs this virus has reached
  exploredTiles: new Set(), // Tiles this virus has traversed (as "x,y" strings)
  knownPaths: new Map(), // nodeId -> path array for remembered routes
  lastNodeId: null, // Last node this virus interacted with
};
```

#### Step 5: Implement Memory Methods

**File**: `virus.js`

Add methods:

- `recordNodeVisit(nodeId)` — adds node to visitedNodes, stores path
- `hasVisitedNode(nodeId)` — checks if node is in memory
- `getKnownPath(nodeId)` — returns cached path if available
- `recordExploredTile(x, y)` — adds tile to exploredTiles
- `hasExploredTile(x, y)` — checks if tile has been explored
- `clearMemory()` — resets memory (on capture)

### Phase 3: Virus State Machine Redesign

#### Step 6: Redesign Virus States

**File**: `virus.js`

Replace the current state machine with:

```javascript
this.STATE = {
  SEEKING_NODE: "seeking_node", // Looking for closest unvisited/uninfected node
  INFECTING_NODE: "infecting_node", // Stationary, infecting a node (2s timer)
  RETURNING_TO_NODE: "returning", // Going back to a previously visited node
  PURSUING_PLAYER: "pursuing", // Aggressive pursuit when player carries a virus
  WANDERING: "wandering", // Random exploration when no clear goal
};
```

#### Step 7: Implement Node Selection Logic

**File**: `virus.js`

Add method `_findTargetNode(nodes)`:

- Find closest **uninfected** node that the virus has **not visited**
- If all uninfected nodes have been visited, find closest **cleansed** node (re-infect priority)
- If no valid targets, return to wandering

#### Step 8: Implement Exploration Movement

**File**: `virus.js`

Add method `_calculateExplorationMovement(targetNode, mapData)`:

- Move toward the general direction of the target node
- Use local obstacle avoidance (wall-following behavior)
- Record explored tiles as the virus moves
- When reaching the node, record it in memory and switch to INFECTING_NODE

#### Step 9: Implement Node Infection

**File**: `virus.js`, `game.js`

Add to Virus:

- `infectNode(node, dt)` — 2-second infection timer
- `infectionProgress` — tracks infection progress (0-100%)
- On completion: call `node.infect()`, switch to WANDERING or RETURNING

Add to Game:

- When virus finishes infecting a node, apply the node's debuff to the player

### Phase 4: Pursuit Mode

#### Step 10: Implement Pursuit Mode

**File**: `virus.js`

Add method `_calculatePursuitMovement(player, mapData)`:

- Use A\* pathfinding to find the most direct route to the player
- Temporarily grant full pathfinding awareness
- Move at normal speed (no speed buff needed — the direct path is the advantage)
- Switch back to SEEKING_NODE when player quarantines the virus

#### Step 11: Integrate Pursuit Mode into State Machine

**File**: `virus.js`

In `_updateState()`:

- Check if `game.playerCarryingVirus` is true
- If so, switch to PURSUING_PLAYER state
- If the player quarantines the virus, switch back to SEEKING_NODE

### Phase 5: Game Integration

#### Step 12: Update Game Loop

**File**: `game.js`

Modify the virus update section:

```javascript
for (const virus of this.viruses) {
  virus.update(
    dt,
    this.player,
    this.rulesManager,
    this.mapData,
    this.nodes,
    this.playerCarryingVirus,
  );

  // Handle node infection
  if (virus.isInfectingNode()) {
    const node = virus.getCurrentTargetNode();
    if (node && !node.isInfected()) {
      virus.infectNode(node, dt);
      if (virus.infectionComplete()) {
        node.infect();
        this.player.addDebuff(node.id);
      }
    }
  }

  // Handle capture
  if (virus.checkPlayerProximity(this.player, this.inputHandler)) {
    // ... existing capture logic
  }
}
```

#### Step 13: Add Quarantine Input Handling

**File**: `game.js`

In `_handleRuleHotkeys()` or a new method:

```javascript
if (this.inputHandler.isPressed("v") && this.playerCarryingVirus) {
  if (this.player.isStationary()) {
    this.quarantineTimer += dt;
    if (this.quarantineTimer >= QUARANTINE_DURATION) {
      this.virusesQuarantined++;
      this.clearPlayerCarryingVirus();
      this.quarantineTimer = 0;
    }
  } else {
    this.quarantineTimer = 0; // Reset if player moves
  }
}
```

#### Step 14: Update Win/Loss Conditions

**File**: `game.js`

Update `_checkWinLossConditions()`:

- Win: All viruses quarantined AND ≥4 nodes secure
- Loss: All nodes infected OR player HP ≤ 0
- Add check: if player is carrying a virus and all other viruses are pursuing, increase tension

### Phase 6: UI/UX Updates

#### Step 15: Add Carrying Status UI

**File**: `effects.js`

- Add visual indicator when player is carrying a virus
- Add quarantine progress bar/timer
- Add warning when viruses are in pursuit mode

#### Step 16: Update Debug Overlay

**File**: `effects.js`

- Show virus memory state (visited nodes, explored tiles)
- Show current virus state (SEEKING, INFECTING, PURSUING, etc.)
- Show infection progress for each virus

### Phase 7: Balancing & Tuning

#### Step 17: Add Configurable Constants

**File**: `virus.js`

```javascript
// Easy-to-adjust constants for balancing
const VIRUS_BASE_SPEED = 2.0; // Tiles per second
const INFECTION_DURATION = 2.0; // Seconds to infect a node
const QUARANTINE_DURATION = 2.0; // Seconds to quarantine
const PURSUIT_SPEED_MULTIPLIER = 1.0; // No speed change, just better pathfinding
const WANDER_DURATION_MIN = 3.0; // Min seconds between state changes
const WANDER_DURATION_MAX = 8.0; // Max seconds between state changes
```

#### Step 18: Playtesting Notes

- Start with infection duration at 2.0s — may need to increase if too easy
- Consider adding a brief "vulnerability window" after quarantine where viruses don't immediately pursue
- The 2-second quarantine timer may need adjustment based on how safe players can find spots

## Memory Reset on Game Restart

When the player fails and restarts the game, all virus memory must be cleared. This is handled automatically because:

- `Game.reset()` calls `this.init()`, which creates **new** `Virus` instances
- Each new `Virus` instance starts with an empty memory object
- No memory is persisted to `localStorage` or any other persistent storage

This ensures that each game session starts fresh with no carryover from previous attempts.

## Technical Considerations

### Pathfinding Implementation

For the exploration behavior, we'll use a simplified approach:

- Viruses move toward the general direction of their target
- Local obstacle avoidance using wall-following (right-hand or left-hand rule)
- No full A\* pathfinding during exploration (to maintain the "searching" feel)

For pursuit mode, we'll implement a basic A\* pathfinding:

- Full map awareness granted temporarily
- Direct path to player position
- Can be implemented with a simple A\* library or hand-written

### Memory Storage

Each virus's memory will be lightweight:

- `visitedNodes`: Set of node IDs (small memory footprint)
- `exploredTiles`: Set of "x,y" strings (bounded by map size, 64×64 = 4096 max entries)
- `knownPaths`: Map of nodeId → path array (only for visited nodes, typically 1-5 entries)

### Performance

- Memory checks are O(1) for Sets and Maps
- Pathfinding only runs during pursuit mode (not every frame)
- Exploration movement uses simple vector math, no pathfinding overhead

## File Change Summary

| File              | Changes                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `virus.js`        | Complete state machine redesign, memory system, node targeting, pursuit mode                     |
| `game.js`         | Player carrying state, quarantine system, node infection integration, updated virus update calls |
| `player.js`       | Add `isStationary()` method, add carrying-related debuff handling                                |
| `effects.js`      | Carrying status UI, quarantine progress, pursuit mode warning, debug overlay updates             |
| `node.js`         | No changes needed (infection mechanics already exist)                                            |
| `rulesManager.js` | No changes needed                                                                                |
| `inputHandler.js` | No changes needed (V key already mapped)                                                         |

## Testing Checklist

- [ ] Viruses seek and infect nodes when not carrying player attention
- [ ] Viruses remember visited nodes and can return to cleansed nodes
- [ ] Viruses pursue player aggressively when player carries a captured virus
- [ ] Viruses return to normal behavior after player quarantines a virus
- [ ] Node infection takes 2 seconds and can be interrupted by capture
- [ ] Quarantine requires 2 seconds of standing still
- [ ] Moving during quarantine resets the timer
- [ ] Win condition: all viruses quarantined + 4+ nodes secure
- [ ] Loss condition: all nodes infected or player HP ≤ 0
- [ ] Debug overlay shows virus memory and state
- [ ] UI shows carrying status and quarantine progress
