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

- [ ] HUD resources panel and stats (feedback +/− sur Energy/Metal)
- [ ] Resource nodes et harvesting (scouts) → base stockpile
- [ ] Movement costs (Energy partagé), Explore=10 (OK)
- [ ] HUD: stockpile + production buttons Scout(20)/Soldier(30) (UI partiellement OK)
- [ ] Pathfinding A* (OK scouts); soldiers: modes Defend/Attack (wip)
- [ ] Tick serveur (OK) + interpolation client (OK) + FX déplacement

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

## Movement & Timing (server/client)

- [x] Client interpolation uses `prevQ/prevR/lastMoveAt` and `lerpDuration ~900ms`.
- [x] Server harvest hold `harvestHoldUntil ~900ms`, removal after hold.
- [x] Explore tile creation: cost 10 energy, `buildHoldUntil ~1200ms`.
- [ ] Add debug logs for holds start/end and energy gating.
- [ ] Option: auto‑Idle when no energy to build after N ticks.

## Visual/UI backlog

- [x] Tonemapping ACES + sRGB; light bloom (partial)
- [ ] Anneau de sélection animé + glow bordure tuile au survol (hover glow)
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

- [x] Nouveau visuel “Tri‑pod capacitors” (3 condensateurs + noyau)
- [x] Animation “breathing” (halo pulse, core rotate/intensity)
- [x] Spikes d’énergie au spawn
