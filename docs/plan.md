# Game Plan

## Vision

- Real-time strategy and exploration on a 3D hex world. The player expands from a command center, harvests resources, and manages units while defending against threats added later.

## Core gameplay loops

- Explore: move the camera, reveal the map, inspect tiles and resource nodes.
- Economy: capture and harvest resource nodes; movement consumes Energy; unit production consumes Metal; return resources to base to grow stockpiles.
- Combat: produce units with distinct roles (Scout/Soldier/Tank); auto-engage enemies; protect the base while pushing outward.

## Milestones

- M1: Readable map and interaction
  - Hover/click tiles with clear feedback
  - HUD panel shows selected tile info (coords, type, resource)
  - Notification system communicates events

- M2: Resources and ownership
  - Seed a few resource node types on tiles (Energy, Metal)
  - Simple capture/ownership rules (center influence or click-claim prototype)
  - HUD shows base stockpile (Energy/Metal); movement costs affect Energy

- M3: Units and movement
  - Spawn units from the command center via three buttons (Scout/Soldier/Tank)
  - Production costs Metal (Scout 20, Soldier 30)
  - Tile-to-tile movement with A* pathfinding on hex grid (Scouts harvest / Soldiers defend/attack)
  - Basic collisions and damage-over-time; cleanup after death

- M4: Opposition and objectives
  - Add an enemy base and periodic waves
  - Win/lose conditions (destroy base / base HP hits 0)

## Design principles

- Keep rendering and game state separate; systems tick the simulation, scene only renders.
- Prefer 2D overlay for UI/HUD; reserve 3D for diegetic elements.
- Small map first; scale with chunking and lightweight pathing later.
- Parameterize speeds, costs, damage for quick tuning.

## Technical pillars

- Map: flat-top axial coordinates mapped to XZ; small, odd bottom row for centered placement.
- Camera: orbit/pan/zoom with sensible limits and quick reset; initial azimuth -90° to align world −Z with screen bottom.
- Systems: movement, combat, economy; central update loop with dt.
- Notifications: fixed-width, timestamped, fades over time; capped queue.

### Movement & Holds timing

- Server tick every 500 ms; per-step `MOVE_PERIOD_MS` ~1100 ms to throttle unit stepping.
- Client rendering currently snaps to server positions (no interpolation). Interpolation (e.g., ~900 ms lerp with easing) is an optional future enhancement.
- Harvest flow:
  - On arrival on a resource tile, server sets `harvestHoldUntil` (~900 ms) and defers resource removal.
  - When hold elapses, resource is removed and base stockpile is credited.
  - If already standing on resource when switching to Harvest, hold starts immediately.
- Explore/build flow:
  - Move cost is 1 energy per step (all modes).
  - Creating a new tile during Explore costs 10 energy and sets `buildHoldUntil` (~1200 ms). No movement this tick.
- Energy gating:
  - Movement requires >=1 energy; Explore build requires >=10 energy.
  - If insufficient, unit waits (optional future: auto‑Idle after N ticks).

## Visual roadmap

- Quick wins: ACES tonemapping + sRGB, light bloom, selection ring/edge glow, improved palette/materials.
- Lighting/shadows: soft shadows, subtle fog/skybox.
- FX: tile spawn sparks, volumetric light columns, movement bobbing/sway, unit trails, harvest impact sparks, camera micro‑shake.
- Postprocess: simple chain (FXAA → Bloom → SSAO), optional vignette later.
- Materials/UI: micro‑variation per tile, richer PBR for resources, hover glow, HUD icons for Energy/Metal.
- Performance: instancing for tiles/resources when counts grow; LOD/billboards for distant props.

### Implemented visual features (current)

- GFX control panel with live sliders/toggles (exposure, ambient, fog, bloom, FXAA, tiles brightness/emissive, outlines) and JSON export.
- Directional light gizmo + left/right azimuth control; optional auto‑orbit (daylight‑like loop).
- Command Center: “Tri‑pod capacitors” design with breathing animation (halo/core) and energy spikes on spawn.
- Tile discovery sparks and unit goal columns with continuous animation.
