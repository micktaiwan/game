# Learnings (errors log and decisions)

This document records recurring issues we hit during development, why they happened, and how we permanently fixed them. The goal is to avoid repeating mistakes.

Each entry includes:

- Problem summary and user-visible symptoms
- Root cause analysis (technical and process)
- Fix implemented (code and design)
- Preventive actions and rules we will follow next time
- Status (open/fixed) and date

We will append new entries whenever we loop on a problem. When you tell us a problem is resolved, we will mark it as fixed and capture the lessons here.

---

## 1) Command Center placement: “south” ambiguity and flash on reset

- Problem
  - The Command Center (CC) appeared at the wrong place (north-east) and sometimes flashed to another position on reset. The expected “south” (visually bottom) did not match what the engine picked.

- Root cause
  - Two contradictory sources of truth for base position:
    - Client computed “south” using camera heuristics.
    - Server also tried to compute “south” at startup/reset using a world-space heuristic.
  - Camera orientation and world-space axes are not equivalent; “south” is a screen-space notion depending on camera, so server-side computation diverged from client.
  - During reset, the scene briefly showed a default placement before re-syncing, causing a visible flash.

- Fix implemented (revised)
  - Hybrid authority model:
    - On reset only: client picks the position once (camera-based) and writes to DB.
    - As soon as `baseQ/baseR` exist in DB, the server is the durable source; the scene reads and displays strictly that position, including after reload.
  - The scene emits `onBaseCandidate(q,r)` if no explicit base is provided, to allow the client to persist the position exactly once.
  - The reset flow destroys the scene before reconstruction to avoid intermediate frames.
  - Final simplification: align camera azimuth (−90°) and server picks bottom‑center deterministically so “south world == south screen”.

- Preventive rules
  - Avoid double sources of truth. Server stores; client decides only on initial reset.
  - Do not change base position if `baseQ/baseR` exist in DB.
  - On destructive resets, tear down then rebuild the scene to remove flicker.

- Status: fixed
  - Follow-ups: n/a (camera −90° + server bottom‑center)

### 2) Double write on client (flash reintroduced)

- Problem
  - A UI fallback wrote `base.setPosition` to the “first tile” concurrently with `onBaseCandidate`, causing jumps.

- Cause
  - Two concurrent write paths when `baseQ/baseR` were missing.

- Fix
  - Remove arbitrary fallback; exactly one write via `onBaseCandidate` or (now) server reset.

- Preventive rule
  - Only one authoritative writer per decision; all other paths read-only.

### 3) Timings/GFX drift: constants changed without holistic impact review

- Problem
  - Directional light auto-orbit and gizmo were visible on page reload when they should be gated by the GFX panel.
  - Movement/hold timings regressed after adjusting constants (unexpected stepping cadence, premature/blocked actions).

- Root cause
  - Scattered defaults and duplicated constants across files:
    - Scene (`imports/game/scene/createThreeApp.js`) had `showLightGizmo: true` and `dirLightAutoOrbit: true` by default while UI intended to control visibility.
    - Server timings (`MOVE_PERIOD_MS`, `HARVEST_ANIM_MS`, `BUILD_TIME_MS`) were defined inside the tick function, encouraging silent divergence.
    - An early global energy gate prevented harvest/build holds from completing when energy was low.
  - No explicit checklist to assess cross-cutting impact when changing timings/GFX defaults.

- Fix implemented
  - Single source of truth for timings at the top of `server/main.js` with clear comments; removed early-return on low energy; debit build energy immediately; debit move energy after the batch.
  - UI now drives scene state: `showGfx` toggles both `showLightGizmo` and `dirLightAutoOrbit` via `applyGfxSettings`.
  - Scene defaults changed to safe values: `showLightGizmo=false`, `dirLightAutoOrbit=false` so nothing shows/spins until the panel opens.

- Preventive actions and rules
  - Centralize constants; avoid magic numbers and duplicates. When a timing changes, update the single definition and re-run manual tests listed in `docs/todo.md` (Movement & Timing).
  - For feature toggles (e.g., gizmos, auto-orbit), default to off at boot; UI explicitly enables them.
  - PR checklist: include a “Timings/GFX impacts” section confirming updates to server constants, client interpolation assumptions, and docs (`docs/plan.md`, `docs/todo.md`).
  - Add debug logs around holds start/end and energy gating while DEBUG is on.

- Status: fixed
  - Date: 2025-08-16
