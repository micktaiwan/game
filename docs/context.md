# Game

## Meta

- The user speaks in French; always reply to the user in French.
- All project code and technical artifacts must be in English: file names, code, comments, identifiers, and commit messages. This `context.md` is also in English and must remain code‑free.
- Keep this document succinct and up to date; prefer lists and clear headings.
- Use backticks for file and directory names only; do not include code samples in this file.
- Maintain exactly one trailing newline at end of file and avoid multiple consecutive blank lines (MD012).

## Other important docs to read

- Plan (gameplay/milestones): `docs/plan.md`
- TODO (engineering tasks): `docs/todo.md`
- Learnings (errors log and decisions): `docs/learnings.md`
- Journal (build log): `docs/journal.txt`
- README (install/run): `../README.md`
- Markdown rules: `docs/markdown-rules.md`

## Purpose & Scope

- 3D real‑time strategy and exploration on a hex world.
- Client‑side rendering and gameplay; server used only when strictly necessary.
- This document is a stable brief: it records intent and decisions. Execution details live in `docs/plan.md` and `docs/todo.md`.

## Design decisions & Constraints

- UI
  - 2D HTML overlay for system UI (HUD, controls, notifications).
  - 3D used for diegetic elements (tiles, bases, units).
  - Pointer interactions are tile-first: clicks always resolve to a tile, then UI decides based on what sits on that tile (resource/unit/CC) for mode switching or selection.
- Map
  - Flat‑top axial hex grid on XZ plane; current map radius is 4 so bottom row has odd count (centered placement possible).
  - Player base (Command Center) is a contained 3D object. Current design: “Tri‑pod capacitors” (three capacitors around a central reactor) with breathing animation and energy spikes on spawn.
- Camera
  - Orbit/pan/zoom with quick reset; camera framed to show the whole map at start.
  - Starfield rendered as distant particles; slow parallax; unaffected by pan translation.
- Notifications
  - Fixed width; newest at bottom; timestamped; fade darker over time; hover restores brightness; capped at 5 with animated removal.
  - Visual polish backlog tracked in `docs/todo.md` (shadows, fog/skybox, FXAA/SSAO, hover glow, trails, impact sparks, camera micro‑shake, HUD icons). A live GFX panel allows runtime tuning of exposure, ambient, fog, bloom, FXAA, tiles brightness/emissive, outlines, and light azimuth/orbit.

## Non‑Goals (V1)

- No external map editor; map generated in code.
- No advanced pathfinding beyond basic A* for scouts; richer heuristics later.

Note: Minimal persistence is used for development (tiles, units, resources, base stockpile). This is not multiplayer nor a long‑term save system.

## Current interfaces

- Scene API
  - A scene mounting function attaches the 3D world to a container, accepts tiles and callbacks, and returns controls to reset the view, clean up, and update units/resources. The precise signature lives in code; keep this document code‑free.
  - Emits events for command center selection (providing tile data and pointer) and unit selection.
- Server methods (development only)
  - Reset tiles and resources (destructive) with a radius parameter; also clears units.
  - Spawn a scout near the given base position; consumes metal from the base stockpile.
- Collections
  - tiles (q, r)
  - units (type, q, r, hp, energy, createdAt)
  - resources (kind: energy|metal, q, r, amount, createdAt)
  - bases (id: player, energy, metal, updatedAt)

## Economy & Movement (V1)

- Base stockpile is global: `energy` and `metal` live on `bases('player')`.
- Movement across one tile costs 1 Energy (shared electricity model across all units).
- Production costs Metal (Scout: 20 Metal).
- Resources:
  - `energy` nodes add to base Energy when harvested.
  - `metal` nodes add to base Metal when harvested.
  - At most one resource per tile.
  - Rare random spawning over time: low probability per interval and global cap to keep resources scarce.

## Unit behavior & Pathfinding

- Pathfinding: A* on hex axial grid with Manhattan-like hex distance heuristic.
- Harvest: scouts target nearest resource; on arrival they enter a harvest hold (~900 ms), then the resource is removed and the base stockpile is credited.
- Explore: units step tile-by-tile; if the neighbor does not exist, the tile is created (10 energy) and the unit waits during a build hold (~1200 ms) before moving.
- Energy: 1 energy per move; insufficient energy stops movement; Explore build requires 10 energy.
- Rendering: client snaps to server positions for movement (no interpolation). Interpolation remains an optional development feature.

## Glossary

- Hex axial coordinates: `(q, r)` for flat‑top grid; mapped to world `(x, z)`.
- Command center: player base mesh anchored to a single tile.
- Starfield: far background particle sphere; visual only.
