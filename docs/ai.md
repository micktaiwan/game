# AI Architecture

## Purpose

Define an evolvable AI approach for enemies and neutral actors that fits the
current single‑player, server‑driven simulation. Keep the design modular,
data‑driven, and testable. Client remains visual only; server owns all AI.

## Constraints and context

- Hex flat‑top grid, axial `(q, r)` coordinates.
- Server simulation tick (`server/sim/tick`) every 500 ms.
- Pathfinding: A* already available.
- Player units exist in `units`; enemies will be separate for clarity.
- Economy: base energy/metal stockpiles; base coordinates known.

## Goals (near‑term)

1) Enemy baseline: simple hostile agents that spawn on edges and seek the base.
2) Combat foundations: collisions, damage‑over‑time, destruction/cleanup.
3) Soldiers behaviors: defend/attack modes that react to enemy presence.
4) Pacing: light wave scheduler and difficulty ramps.

## Data model (server‑side)

- Collection `enemies` (new):
  - `_id`, `type` (e.g., `grunt`, `ranged`)
  - `q`, `r` (position), `hp`, `goal`, `goalData`
  - `aggro` (target id or base), `lastThinkAt`, `createdAt`, `updatedAt`
- Optional `ai_state` (new, small): global caches and director state
  (next wave time, spawn budget, difficulty level).

Rationale: do not mix with `units` to avoid client subscriptions rendering
enemy meshes until the visual layer is ready. Keep fields parallel to minimize
join logic.

## Runtime architecture

- Server‑only AI loop runs inside the existing tick:
  - Build a lightweight blackboard once per tick:
    - `tileSet`, `occupied`, base position, nearest targets map.
  - Schedule per‑agent thinking with a budget:
    - Re‑think every N ticks; stagger by `_id` to avoid bursts.
  - Apply actions as DB updates (same pattern used for units).

### Concrete modules (server)

- `imports/api/enemies.js`: `EnemiesCollection` (Mongo)
- `server/sim/enemies/blackboard.js`: blackboard assembly and helpers
- `server/sim/enemies/actions.js`: pure actions (step/attack/retarget/flee)
- `server/sim/enemies/utility.js`: scoring for state choice
- `server/sim/enemies/hfsm.js`: state resolution + transitions
- `server/sim/enemies/think.js`: main per‑tick scheduler/runner
- `server/sim/spawnEnemies.js`: baseline spawns; Director later

### Blackboard (per tick)

- Map occupancy: tiles, player units, enemies, resources, base tile.
- Utility helpers: `hexDistance`, neighbor enumeration, passable predicate.
- Query helpers: `nearestPlayerUnit(from)`, `nearestBaseTile(from)`.

### Behavior controller (per agent)

- Start with a Hierarchical Finite State Machine (HFSM):
  - States: `seek_base`, `seek_unit`, `attack`, `flee`, `idle`, `wander`.
  - Transitions driven by distance, line‑of‑sight approximation, HP thresholds.
- Upgrade path:
  - Utility AI layer selects state (`seek_base` vs `seek_unit` vs `flee`)
    via scores (distance, local density, HP, timers).
  - Behavior Tree (BT) for sequencing inside a state (`attack_sequence`).
  - GOAP is optional later; likely overkill for scope.

### Actions (pure, small, testable)

- `stepToward(target)` → uses A* with throttled recompute.
- `tryAttack(target)` → apply DoT tick if in range; start/maintain a hold.
- `retarget()` → pick base or nearest unit based on utility scores.
- `panicFlee()` → step away when HP < threshold.

### Scheduling and budgets

- `THINK_PERIOD_MS` per agent (e.g., 800–1500 ms, jittered).
- Cap thinking per tick (e.g., 50 agents) and carry over remainder.
- Pathfinding cache optional: memoize last path target and reuse until stale.

## Spawning and pacing (director)

- New server module `server/sim/spawnEnemies`:
  - Random edge tile selection; avoid base/occupied tiles.
  - Budget by time: ramp `mean_delay` down or `count` up over minutes.
- Wave scaffold:
  - `ai_state`: `nextWaveAt`, `waveIndex`, `budget`.
  - On trigger, spawn N enemies in small clusters around 2–3 angles.

## Combat foundations (shared rules)

- Collision: only one agent (unit or enemy) per tile; path blocks if occupied.
- Damage: DoT ticks during `attack_hold`; configurable DPS per type.
- Death: remove doc, spawn a short‑lived FX marker (client visual only).
- Targeting: melee range is same‑tile adjacency; ranged can attack from 2–3
  tiles with a cooldown.

## Soldiers behavior alignment

- `defend`: prefer nearest enemy within a guard radius of the base; otherwise
  patrol around base.
- `attack`: hunt nearest enemy; fallback to `explore` direction if none.
- Energy costs: keep unit move cost consistent; combat actions do not spend
  energy in V1 (tune later if needed).

## Extensibility and configuration

- Types and tuning in `server/sim/constants` or `imports/shared/constants`:
  - Speeds, hold durations, DPS, aggro radius, think period.
- Behaviors are registered functions operating on `(agent, blackboard)` and
  returning a small update payload.
- Feature flags per type: `hasRanged`, `isCoward`, `isTank`.

## Testing strategy

- Unit tests:
  - Target selection edge cases, flee threshold behavior, DoT timing.
  - Path recompute throttling and blocked path fallback.
- Simulation tests:
  - Small map with 1–3 enemies vs one soldier in defend/attack.

## Performance and scale

- Early: rely on small maps, modest spawn caps, staggered thinking.
- Later: chunked perception (query smaller neighborhoods), influence fields
  for coarse guidance, and pooled enemy docs to reduce churn.

## Roadmap (phased)

1) Baseline enemy + combat foundations (seek base, DoT, death, cleanup).
2) Soldiers defend/attack functional vs baseline enemies.
3) Director: waves and difficulty ramps; ranged enemy type.
4) Utility AI scoring for retargeting; minimal BT for attack sequences.
5) Performance passes (chunked perception, caches, spawn pools).

## What kind of AI?

- Start with HFSM for clarity and speed to first playable.
- Add a thin Utility AI layer to select the active state with tunable scores.
- Use BTs only for local action sequencing where it adds readability.
- Defer GOAP unless emergent planning becomes a core design goal.

## Learning & Adaptation

Design the AI to adapt during a run and across runs while staying predictable.

### Signals (telemetry)

- Time to first contact with the base
- Base HP damage over time and per wave
- Player losses (units destroyed) per phase
- Enemy blockage ratio (ticks spent blocked vs moving)
- Wave success flag (any agent reached base tile or dealt damage)

Collect lightweight aggregates each wave and at fixed time checkpoints.

### In‑session adaptation (DDA)

- Spawn angles as a multi‑armed bandit problem
  - Maintain a score per arc; update with UCB or Thompson Sampling.
  - Reward signal: inverse of defenders present and base damage dealt.
- Composition selection via softmax
  - Keep a small vector of candidate mixes; sample with temperature τ.
  - Decrease τ slowly as confidence increases; never reach zero.
- Utility weights nudging
  - Adjust small deltas to `seek_base` vs `seek_unit` weights using an EWMA
    of observed blocking and success rates.
- Exploration budget
  - Keep an epsilon probability to try a non‑greedy angle or composition.

### Cross‑session persistence

- `ai_learnings` document stores EWMA aggregates and timestamps.
- On startup, seed `ai_state` from `ai_learnings` with decay on old data.
- EWMA update: `m <- α * obs + (1 - α) * m` with α in `0.15–0.3`.

### Safeguards

- Clamp all tunables to safe ranges (min/max)
- Rate‑limit adjustments (at most once per wave and small step size)
- Cooldowns after sharp defeats or large wins to avoid oscillations
- Structured logs for adjustments; reset on map reset

### Algorithms at a glance

- Angles: UCB1 or Thompson Sampling on per‑arc reward
- Compositions: softmax sampling with temperature and optional Dirichlet prior
- Weights: EWMA‑based gradient‑free nudges (no backprop needed)

### Implementation plan (phases)

1) Instrumentation: emit basic telemetry at end of wave and every 60 s
2) Bandit for angles + softmax for compositions; store in `ai_state`
3) Persist `ai_learnings` and warm‑start on server boot with time decay
4) Add guarded nudges to Utility weights; tune clamps and cooldowns
5) Expand reward shaping and add per‑map or per‑seed buckets if needed

## Objectives and win/lose conditions

- Game objective for enemies: destroy the player's base.
- Add base HP to the `bases('player')` document, e.g., `hp: 1000`.
- Lose condition: base HP reaches 0.
- Win condition (later): survive N waves or destroy enemy spawners/base.
  The first milestone can be survival for T minutes without defeat.

Rationale: the AI will prioritize actions that maximize progress toward the
lose condition for the player (pressure on the base), while allocating a
portion of forces to neutralize nearby blockers (player soldiers).

## Priority model and scoring (Utility AI)

At each think step, compute scores and pick a top‑level state.

- `seek_base` score
  - High when distance to base is large but path is clear.
  - Decreases with local defender density.
- `seek_unit` score
  - High when a player soldier is within aggro radius or blocking a path.
  - Increases when the agent has ranged advantage.
- `attack` score
  - Only valid if in range; increases with target value and recent damage.
- `flee` score
  - High when HP is below a threshold and enemies outnumber allies nearby.
- `idle/wander` score
  - Fallback when nothing else is actionable.

Example weights (tunable, dimensionless):

- Distance to base: `w_dist_base = 1.0` (normalized inverse distance).
- Defender density: `w_threat = 0.7` (penalize `seek_base`).
- Blocker presence: `w_block = 0.9` (favor `seek_unit`).
- Low HP: `w_low_hp = 1.2` (favor `flee`).
- In‑range target: `w_in_range = 1.0` (favor `attack`).

Keep scores simple and clamp to `[0, 1]` before weighting. Persist only the
chosen state and small cooldowns in the agent document, never the raw scores.

## Director strategy (macro priorities)

Waves ramp difficulty while probing defenses. Three repeating phases:

1) Probe
   - Small, cheap enemies from two angles. Goal: map the player's response.
   - Director records where soldiers gather; treat that side as defended.
2) Pressure
   - Mixed wave that fixes defenders on the strong side while spawning a
     bypass on a weaker arc.
3) Push
   - Heavier group biased toward the weakest side; includes a ranged type.

Spawn logic per wave:

- Prefer edges farther from the base tile but with passable routes.
- Avoid spawning on occupied tiles; cluster spawns within a small radius.
- Stagger spawn times within a short window to create flow, not bursts.

## Default tuning (initial values)

- Think period per enemy: `1200 ms` ± `300 ms` jitter.
- Aggro radius: `3` tiles for melee, `4` tiles for ranged.
- Ranged attack: range `3` tiles, cooldown `1500 ms`, DPS low but steady.
- Flee threshold: `25%` HP; flee for `2` steps, cooldown `4` s.
- Wave cadence: start every `45–60 s`, scale count linearly with time.

These values live in `server/sim/constants` once implemented.
