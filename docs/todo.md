# TODO

## Framework

- [ ] Create placeholder assets in `public/` (hex, bases, unit)

## Map and data

- [ ] Implement tile state (discovered, resource, occupancy)
- [ ] Prepare chunking boundaries for future scaling

## Economy and units

- [ ] HUD resources panel and stats (panel OK; delta feedback TBD)
- [ ] Pathfinding A* (OK scouts); soldiers: Defend/Attack modes (UI only; behavior TBD)
- [ ] Server tick (OK) + client interpolation (TODO) + movement FX (TODO)

## Combat and collisions

- [ ] Simple collision detection and damage over time
- [ ] Unit destruction and cleanup
- [ ] Enemy baseline: minimal enemy model/collection; periodic edge spawns; seek base

## AI

- [ ] Periodic production based on resources
- [ ] Attack waves toward player base (after combat foundations + enemy baseline)
- [ ] Server modules: `enemies` blackboard/actions/utility/hfsm/think
- [ ] Integrate `runEnemyAiTick` into server tick with per‑tick budget

## Quality and docs

- [ ] Explanatory comments/docstrings in scene and UI (partial)

## Core loop stabilization plan

### Diagnostics

- [ ] Optional small dev overlay (client) showing `energy`, active holds count.

### Success criteria

- [ ] All manual tests pass consistently across reloads.

## Visual/UI backlog

- [ ] Subtle trails on unit movement
- [ ] Impact sparks on harvest (resource consumed)
- [ ] Camera micro‑shake on key events (spawn/harvest/STOP)
- [ ] HUD icons (energy/metal) + typography polish
- [ ] Materials: tile micro‑variation; PBR for resources
- [ ] Instancing tiles/resources; LOD/billboards for distant props

## Refactor and modularization

### UI (`imports/ui/App.jsx` → components/hooks)

- [ ] `state/gfxUI.js` (or TS) centralized shape

### Shared

- [ ] JSDoc typings (or TS) for `Unit`, `Tile`, `Resource`, `Base`

### Strategy and criteria

- [ ] Incremental refactor in 5 steps with no behavior change
- [ ] Stable manual tests (tiles/units/GFX, gizmo off by default)
- [ ] Optional: unit tests for `server/sim/tick` and `pathfinding`
      (pathfinding tests present; tick tests missing)
