# TODO

## Framework

- [x] Add 3D engine (`three`) and bootstrap the render loop
- [x] Set up camera controls (pan/zoom) and resize handling
- [ ] Create placeholder assets in `public/` (hex, bases, unit)

## Map and data

- [x] Generate a small hex grid and map it to 3D positions
- [x] Persist tiles in a collection (`tiles`) and publish/subscribe
- [x] Render tiles with a slight gap and clear borders
- [x] Place command center on visually bottom‑center tile
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

- [x] Create project docs (`docs/`) and move context/rules
- [x] Extract actionable checklist into `docs/todo.md`
- [x] Add high‑level plan in `docs/plan.md`
- [ ] Explanatory comments/docstrings in scene and UI (partial)
- [ ] README with install and run instructions

## Movement and timing (server/client)

- [x] Client interpolation uses `prevQ/prevR/lastMoveAt` and `lerpDuration ~900ms`.
- [x] Server harvest hold `harvestHoldUntil ~900ms`, removal after hold.
- [x] Explore tile creation: cost 10 energy, `buildHoldUntil ~1200ms`.
- [x] Add debug logs for holds start/end and energy gating.
- [x] Option: auto‑Idle when no energy to build after N ticks.

## Core loop stabilization plan

### 1. Server invariants

- [x] Single source of truth for timings: `MOVE_PERIOD_MS=1100`, `HARVEST_ANIM_MS=900`, `BUILD_TIME_MS=1200` (comment clearly at top of simulation).
- [x] Holds preempt movement: if `buildHoldUntil` or `harvestHoldUntil` in the future → skip stepping this tick.
- [x] Energy gating: `>=1` to move, `>=10` to build; debit build immediately, debit moves after the batch per tick.
- [x] Harvest‑on‑arrival: set `harvestHoldUntil` and defer resource removal to the end of the hold; if the resource disappears meanwhile, gracefully clear hold.
- [x] ID‑safe comparisons: compare `String(_id)` when matching `pendingHarvestResourceId`.
- [x] Path fallback: if no path to resource for N ticks → switch to Idle or retarget nearest (N configurable).

### 2. Client rendering and input

- [x] Simplify movement rendering (snap to server positions; no interpolation).
- [x] Tile‑first input invariant: always resolve a tile, then UI interprets (resource/unit/CC) for mode/selection.
- [ ] Guard Explore after Harvest click: temporarily ignore Explore tile clicks for ~500 ms to avoid accidental overrides (optional UX).
- [ ] Hover glow for the targeted tile to strengthen intent.

### 3. Tests (manual, reproducible)

- [ ] Harvest (adjacent): expect 1 step, ~900 ms hold, resource removed, base +Δ.
- [ ] Harvest (already on resource): expect immediate hold, removal after ~900 ms.
- [ ] Explore without energy (energy < 10): no build; with energy: build + hold then step.
- [ ] Energy 0: no movement at all in any mode.
- [ ] Tile‑first: click resource → harvest; click empty tile → explore (if a scout selected).

### 4. Diagnostics

- [x] Add DEBUG flag (server) to log holds, gating, and moves; default OFF.
- [ ] Optional small dev overlay (client) showing `energy`, active holds count.

### 5. Success criteria

- [ ] Zero premature resource removal (always after hold).
- [ ] No unintended movement when energy is insufficient.
- [ ] No accidental Explore overriding a recent Harvest click.
- [ ] All manual tests pass consistently across reloads.

## Visual/UI backlog

- [x] ACES tonemapping + sRGB; light bloom (partial)
- [ ] Animated selection ring + tile edge glow on hover (hover glow)
- [x] Gradient skybox + subtle fog (toggle/slider)
- [x] Tile‑spawn sparks (partial; randomness/decay tuned)
- [x] Volumetric goal columns (scroll texture + embers) (partial)
- [ ] Subtle trails on unit movement
- [ ] Impact sparks on harvest (resource consumed)
- [ ] Camera micro‑shake on key events (spawn/harvest/STOP)
- [ ] HUD icons (energy/metal) + typography polish
- [ ] Materials: tile micro‑variation; PBR for resources
- [x] Postprocess: FXAA (toggle); SSAO (off by default)
- [ ] Instancing tiles/resources; LOD/billboards for distant props

## Command Center (CC)

- [x] New visual “Tri‑pod capacitors” (3 capacitors + core)
- [x] “Breathing” animation (halo pulse, core rotate/intensity)
- [x] Energy spikes on spawn

## Refactor and modularization

### 1. Scene (`imports/game/scene/createThreeApp.js` → modules)

- [x] `core/createScene.js` (scene/camera/renderer/resize; returns refs)
- [x] `core/gfxSettings.js` (defaults + `applyGfxSettings`)
- [x] `core/postprocess.js` (composer, Bloom/FXAA/SSAO)
- [x] `core/input.js` (pointer down/move/up, wheel)
- [ ] `math/axial.js` (conversions and helpers)
  - [x] `math/axial.js` (conversions and helpers)
- [x] `tiles/index.js` (build/update, materials, outline)
- [x] `units/index.js` (setUnits + selection) with:
  - [x] `units/buildScout.js`
  - [x] `units/buildSoldier.js`
  - [x] `units/animate.js`
- [x] `resources/index.js`
- [x] `indicators/goalIndicator.js`
- [ ] `effects/tileBurst.js`
- [x] `gizmos/lightGizmo.js`
- [ ] Keep `createThreeApp.js` as a façade (unchanged API)

### 2. Server (`server/main.js` → modules)

- [ ] `server/sim/constants.js` (timings/costs/thresholds)
- [ ] `server/sim/pathfinding.js` (A*)
- [ ] `server/sim/tick.js` (pure simulation loop)
- [ ] `server/sim/spawnResources.js` (rare spawns + loop)
- [ ] `server/api/methods.js`
- [ ] `server/api/publications.js`
- [ ] `server/startup.js` (seeds, timers)
- [ ] `server/db/indexes.js`

### 3. UI (`imports/ui/App.jsx` → components/hooks)

- [ ] `components/GfxPanel.jsx`
- [ ] `components/TopBar.jsx`
- [ ] `components/UnitPanel.jsx`
- [ ] `components/ResourcePanel.jsx`
- [ ] `components/SelectionInfo.jsx`
- [ ] `hooks/useSceneBridge.js` (scene API bridge)
- [ ] `hooks/useCollections.js` (subs + mapping)
- [ ] `hooks/useUnitHotkeys.js`
- [ ] `state/gfxUI.js` (or TS) centralized shape

### 4. Shared

- [ ] `imports/shared/constants.js` (timings, costs, caps)
- [ ] `imports/shared/colors.js` (`colorForGoal` + palette)
- [ ] `imports/shared/log.js` (dlog/flags)
- [ ] JSDoc typings (or TS) for `Unit`, `Tile`, `Resource`, `Base`

### 5. Strategy and criteria

- [ ] Incremental refactor in 5 steps with no behavior change
- [ ] Stable manual tests (tiles/units/GFX, gizmo off by default)
- [ ] Optional: unit tests for `server/sim/tick` and `pathfinding`
