# TODO

## Framework

- [ ] Create placeholder assets in `public/` (hex, bases, unit)

## Map and data

- [ ] Implement tile state (discovered, resource, occupancy)
- [ ] Prepare chunking boundaries for future scaling

## Economy and units

- [ ] HUD resources panel and stats (feedback +/− on Energy/Metal)
- [ ] Resource nodes and harvesting (scouts) → base stockpile
- [ ] Movement costs (shared Energy), Explore = 10 (OK)
- [ ] HUD: stockpile + production buttons Scout(20)/Soldier(30) (UI partially OK)
- [ ] Pathfinding A* (OK scouts); soldiers: Defend/Attack modes (WIP)
- [ ] Server tick (OK) + client interpolation (OK) + movement FX

## Combat and collisions

- [ ] Simple collision detection and damage over time
- [ ] Unit destruction and cleanup

## AI

- [ ] Periodic production based on resources
- [ ] Attack waves toward player base

## Quality and docs

- [ ] Explanatory comments/docstrings in scene and UI (partial)
- [ ] README with install and run instructions

## Core loop stabilization plan

### 1. Tests (manual, reproducible)

- [ ] Harvest (adjacent): expect 1 step, ~900 ms hold, resource removed, base +Δ.
- [ ] Harvest (already on resource): expect immediate hold, removal after ~900 ms.
- [ ] Explore without energy (energy < 10): no build; with energy: build + hold then step.
- [ ] Energy 0: no movement at all in any mode.
- [ ] Tile‑first: click resource → harvest; click empty tile → explore (if a scout selected).

### 2. Diagnostics

- [ ] Optional small dev overlay (client) showing `energy`, active holds count.

### 3. Success criteria

- [ ] Zero premature resource removal (always after hold).
- [ ] No unintended movement when energy is insufficient.
- [ ] No accidental Explore overriding a recent Harvest click.
- [ ] All manual tests pass consistently across reloads.

## Visual/UI backlog

- [ ] Animated selection ring + tile edge glow on hover (hover glow)
- [ ] Subtle trails on unit movement
- [ ] Impact sparks on harvest (resource consumed)
- [ ] Camera micro‑shake on key events (spawn/harvest/STOP)
- [ ] HUD icons (energy/metal) + typography polish
- [ ] Materials: tile micro‑variation; PBR for resources
- [ ] Instancing tiles/resources; LOD/billboards for distant props

## Refactor and modularization

### 1. UI (`imports/ui/App.jsx` → components/hooks)

- [ ] `hooks/useCollections.js` (subs + mapping)
- [ ] `hooks/useUnitHotkeys.js`
- [ ] `state/gfxUI.js` (or TS) centralized shape

### 2. Shared

- [ ] JSDoc typings (or TS) for `Unit`, `Tile`, `Resource`, `Base`

### 3. Strategy and criteria

- [ ] Incremental refactor in 5 steps with no behavior change
- [ ] Stable manual tests (tiles/units/GFX, gizmo off by default)
- [ ] Optional: unit tests for `server/sim/tick` and `pathfinding`
