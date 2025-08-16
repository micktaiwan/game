import { Meteor } from 'meteor/meteor';
import { TilesCollection } from '/imports/api/tiles';
import { UnitsCollection } from '/imports/api/units';
import { ResourcesCollection } from '/imports/api/resources';
import { BasesCollection } from '/imports/api/bases';

// --- Debug logging ---------------------------------------------------------
const DEBUG_MOVE = true; // set to false to silence movement logs
function dlog(...args) {
  if (DEBUG_MOVE) console.log('[SIM]', ...args);
}

function axialNeighbors(q, r) {
  return [
    [q + 1, r],
    [q - 1, r],
    [q, r + 1],
    [q, r - 1],
    [q + 1, r - 1],
    [q - 1, r + 1],
  ];
}

function generateSmallHexMap(radius = 4) {
  const tiles = [];
  for (let q = -radius; q <= radius; q += 1) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r += 1) {
      tiles.push({ q, r, neighbors: axialNeighbors(q, r) });
    }
  }
  return tiles;
}

Meteor.publish('tiles', function publishTiles() {
  return TilesCollection.find({}, { fields: { q: 1, r: 1 } });
});

Meteor.publish('units', function publishUnits() {
  return UnitsCollection.find({}, { fields: { type: 1, q: 1, r: 1, prevQ: 1, prevR: 1, lastMoveAt: 1, buildHoldUntil: 1, harvestHoldUntil: 1, pendingHarvestResourceId: 1, goal: 1, goalData: 1, hp: 1, energy: 1, createdAt: 1, updatedAt: 1 } });
});

Meteor.publish('resources', function publishResources() {
  return ResourcesCollection.find({}, { fields: { kind: 1, q: 1, r: 1, amount: 1, createdAt: 1 } });
});

Meteor.publish('bases', function publishBases() {
  return BasesCollection.find({ _id: 'player' }, { fields: { energy: 1, metal: 1, baseQ: 1, baseR: 1, updatedAt: 1 } });
});

Meteor.startup(async () => {
  if (await TilesCollection.find().countAsync() === 0) {
    const tiles = generateSmallHexMap(4); // ~61 tiles, bottom row has odd count
    await TilesCollection.rawCollection().insertMany(
      tiles.map((t) => ({ ...t, createdAt: new Date() }))
    );
  }
  // Ensure an index for quick lookup
  await UnitsCollection.rawCollection().createIndex({ q: 1, r: 1 });
  await ensureUniqueIndex(ResourcesCollection, { q: 1, r: 1 }, 'q_1_r_1');
  await BasesCollection.rawCollection().createIndex({ _id: 1 });
  // Seed resources if none
  if (await ResourcesCollection.find().countAsync() === 0) {
    const tiles = await TilesCollection.find({}, { fields: { q: 1, r: 1 } }).fetchAsync();
    await seedResourcesOnTiles(tiles);
  }
  // Seed base stockpile and position (server-authoritative at init)
  if (!await BasesCollection.findOneAsync({ _id: 'player' })) {
    const tiles = await TilesCollection.find({}, { fields: { q: 1, r: 1 } }).fetchAsync();
    const pos = pickBottomCenterTile(tiles);
    await BasesCollection.insertAsync({ _id: 'player', energy: 20, metal: 20, baseQ: pos.q, baseR: pos.r, updatedAt: new Date() });
  }
});

Meteor.methods({
  async 'tiles.reset'(radius = 4) {
    // Danger: destructive reset for development
    await TilesCollection.removeAsync({});
    await UnitsCollection.removeAsync({});
    await ResourcesCollection.removeAsync({});
    const radiusNum = Number(radius) || 4;
    const tiles = generateSmallHexMap(radiusNum);
    await TilesCollection.rawCollection().insertMany(
      tiles.map((t) => ({ ...t, createdAt: new Date() }))
    );
    await seedResourcesOnTiles(tiles);
    // Reset the base stockpile and hard-code base position to bottom-center
    const pos = pickBottomCenterTile(tiles);
    await BasesCollection.upsertAsync({ _id: 'player' }, { $set: { energy: 20, metal: 20, baseQ: pos.q, baseR: pos.r, updatedAt: new Date() } });
    return { inserted: tiles.length, base: pos };
  },
  async 'units.spawnScout'({ base }) {
    // base: { q, r }
    if (!base || typeof base.q !== 'number' || typeof base.r !== 'number') {
      throw new Meteor.Error('invalid-args', 'Base axial coordinates are required');
    }
    function hexDistance(q1, r1, q2, r2) {
      const dq = q1 - q2;
      const dr = r1 - r2;
      const ds = -(q1 + r1) - (-(q2 + r2)); // = -(q1+r1) + (q2+r2) = (q2 + r2 - q1 - r1) = -(dq + dr)
      return Math.round((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2);
    }

    // Get all tiles and all occupied positions by units and resources
    const allTiles = await TilesCollection.find({}, { fields: { q: 1, r: 1 } }).fetchAsync();
    const occupiedUnitKeys = new Set(
      (await UnitsCollection.find({}, { fields: { q: 1, r: 1 } }).fetchAsync()).map((u) => `${u.q},${u.r}`)
    );
    const occupiedResourceKeys = new Set(
      (await ResourcesCollection.find({}, { fields: { q: 1, r: 1 } }).fetchAsync()).map((r) => `${r.q},${r.r}`)
    );

    // Build list of free tiles, excluding the base tile
    const freeTiles = allTiles
      .filter((t) => !(t.q === base.q && t.r === base.r))
      .filter((t) => !occupiedUnitKeys.has(`${t.q},${t.r}`) && !occupiedResourceKeys.has(`${t.q},${t.r}`));

    if (freeTiles.length === 0) {
      throw new Meteor.Error('no-space', 'No free tiles available on the map');
    }

    // Pick the closest free tile to the base
    freeTiles.sort((a, b) => hexDistance(base.q, base.r, a.q, a.r) - hexDistance(base.q, base.r, b.q, b.r));
    const { q, r } = freeTiles[0];
    const now = new Date();
    // consume metal cost from base
    const costMetal = 20;
    const baseDoc = await BasesCollection.findOneAsync({ _id: 'player' });
    if (!baseDoc || baseDoc.metal < costMetal) {
      throw new Meteor.Error('insufficient-metal', 'Not enough Metal to produce a Scout');
    }
    await BasesCollection.updateAsync({ _id: 'player' }, { $inc: { metal: -costMetal }, $set: { updatedAt: now } });
    const unit = {
      type: 'scout',
      q,
      r,
      goal: 'idle',
      goalData: null,
      hp: 100, // Health Points
      energy: 100,
      createdAt: now,
      updatedAt: now,
    };
    const _id = await UnitsCollection.insertAsync(unit);
    return { _id, ...unit };
  },
  async 'units.spawnSoldier'({ base }) {
    if (!base || typeof base.q !== 'number' || typeof base.r !== 'number') {
      throw new Meteor.Error('invalid-args', 'Base axial coordinates are required');
    }
    function hexDistance(q1, r1, q2, r2) {
      const dq = q1 - q2;
      const dr = r1 - r2;
      return Math.round((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2);
    }
    const allTiles = await TilesCollection.find({}, { fields: { q: 1, r: 1 } }).fetchAsync();
    const occupiedUnitKeys = new Set(
      (await UnitsCollection.find({}, { fields: { q: 1, r: 1 } }).fetchAsync()).map((u) => `${u.q},${u.r}`)
    );
    const occupiedResourceKeys = new Set(
      (await ResourcesCollection.find({}, { fields: { q: 1, r: 1 } }).fetchAsync()).map((r) => `${r.q},${r.r}`)
    );
    const freeTiles = allTiles
      .filter((t) => !(t.q === base.q && t.r === base.r))
      .filter((t) => !occupiedUnitKeys.has(`${t.q},${t.r}`) && !occupiedResourceKeys.has(`${t.q},${t.r}`));
    if (freeTiles.length === 0) {
      throw new Meteor.Error('no-space', 'No free tiles available on the map');
    }
    freeTiles.sort((a, b) => hexDistance(base.q, base.r, a.q, a.r) - hexDistance(base.q, base.r, b.q, b.r));
    const { q, r } = freeTiles[0];
    const now = new Date();
    const costMetal = 30;
    const baseDoc = await BasesCollection.findOneAsync({ _id: 'player' });
    if (!baseDoc || baseDoc.metal < costMetal) {
      throw new Meteor.Error('insufficient-metal', 'Not enough Metal to produce a Soldier');
    }
    await BasesCollection.updateAsync({ _id: 'player' }, { $inc: { metal: -costMetal }, $set: { updatedAt: now } });
    const unit = {
      type: 'soldier',
      q,
      r,
      goal: 'defend',
      goalData: null,
      hp: 180,
      energy: 100,
      createdAt: now,
      updatedAt: now,
    };
    const _id = await UnitsCollection.insertAsync(unit);
    return { _id, ...unit };
  },
  async 'units.stopAll'() {
    // Stop all scouts from performing energy-costly actions by forcing goal to idle
    const selector = { type: 'scout', goal: { $in: ['harvest', 'explore'] } };
    const res = await UnitsCollection.updateAsync(selector, { $set: { goal: 'idle', updatedAt: new Date() } }, { multi: true });
    return { updated: res };
  },
  async 'base.setPosition'({ q, r }) {
    if (typeof q !== 'number' || typeof r !== 'number') {
      throw new Meteor.Error('invalid-args', 'Base coordinates required');
    }
    // Store base position on the single player base doc
    await BasesCollection.updateAsync({ _id: 'player' }, { $set: { baseQ: q, baseR: r, updatedAt: new Date() } });
    // Ensure no resource can exist on base tile; remove if any
    await ResourcesCollection.removeAsync({ q, r });
  },
  async 'units.setGoal'({ unitId, goal, goalData }) {
    if (!unitId || typeof goal !== 'string') {
      throw new Meteor.Error('invalid-args', 'unitId and goal are required');
    }
    const allowed = new Set(['idle', 'harvest', 'explore', 'defend', 'attack']);
    if (!allowed.has(goal)) {
      throw new Meteor.Error('invalid-goal', 'Unsupported goal');
    }
    const set = { goal, goalData: goal === 'explore' ? { direction: normalizeDir((goalData && goalData.direction) || null) } : null, updatedAt: new Date() };
    await UnitsCollection.updateAsync({ _id: unitId }, { $set: set });
    return { ok: 1 };
  },
});

async function seedResourcesOnTiles(tiles) {
  // Simple random seeding: 25% of tiles get a resource node
  // Types: 'energy', 'metal' with different amounts
  const nodes = [];
  for (const t of tiles) {
    if (Math.random() < 0.10) {
      const kind = Math.random() < 0.6 ? 'energy' : 'metal';
      const base = kind === 'energy' ? 10 : 10;
      const jitter = Math.floor(Math.random() * 10);
      nodes.push({ kind, q: t.q, r: t.r, amount: base + jitter, createdAt: new Date() });
    }
  }
  if (nodes.length > 0) {
    // If base position is known, drop nodes that would be at base tile
    const base = await BasesCollection.findOneAsync({ _id: 'player' });
    const filtered = base && typeof base.baseQ === 'number' && typeof base.baseR === 'number'
      ? nodes.filter((n) => !(n.q === base.baseQ && n.r === base.baseR))
      : nodes;
    if (filtered.length > 0) {
      await ResourcesCollection.rawCollection().insertMany(filtered);
    }
  }
}

async function ensureUniqueIndex(collection, key, name) {
  const raw = collection.rawCollection();
  const indexes = await raw.indexes();
  const existing = indexes.find((ix) => ix.name === name);
  if (!existing) {
    try {
      await raw.createIndex(key, { name, unique: true });
      return;
    } catch (e) {
      // If a race or conflict happens, try to drop and recreate below
    }
  }
  if (existing && !existing.unique) {
    try {
      await raw.dropIndex(name);
    } catch (e) {
      // ignore if not found
    }
    await raw.createIndex(key, { name, unique: true });
  }
}

// --- Pathfinding and simulation tick ---

function hexDistance(q1, r1, q2, r2) {
  const dq = q1 - q2;
  const dr = r1 - r2;
  return Math.round((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2);
}

function aStarPath(start, goal, passable) {
  const startKey = `${start.q},${start.r}`;
  const goalKey = `${goal.q},${goal.r}`;
  if (startKey === goalKey) return [];
  const open = new Set([startKey]);
  const cameFrom = new Map();
  const gScore = new Map([[startKey, 0]]);
  const fScore = new Map([[startKey, hexDistance(start.q, start.r, goal.q, goal.r)]]);

  function lowestF() {
    let best = null;
    let bestVal = Infinity;
    for (const k of open) {
      const v = fScore.get(k) ?? Infinity;
      if (v < bestVal) { bestVal = v; best = k; }
    }
    return best;
  }

  while (open.size > 0) {
    const current = lowestF();
    if (!current) break;
    if (current === goalKey) {
      // reconstruct
      const path = [];
      let cur = current;
      while (cameFrom.has(cur)) {
        path.unshift(cur);
        cur = cameFrom.get(cur);
      }
      // path contains keys including goal, excluding start; convert to coords
      return path.map((k) => {
        const [q, r] = k.split(',').map(Number);
        return { q, r };
      });
    }
    open.delete(current);
    const [cq, cr] = current.split(',').map(Number);
    for (const [nq, nr] of axialNeighbors(cq, cr)) {
      if (!passable(nq, nr)) continue;
      const nk = `${nq},${nr}`;
      const tentative = (gScore.get(current) ?? Infinity) + 1;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, current);
        gScore.set(nk, tentative);
        fScore.set(nk, tentative + hexDistance(nq, nr, goal.q, goal.r));
        if (!open.has(nk)) open.add(nk);
      }
    }
  }
  return []; // fallback: no path
}

async function simulationTick() {
  const base = await BasesCollection.findOneAsync({ _id: 'player' });
  if (!base) return;
  const MOVE_COST = 1;                 // energy per step
  const EXPLORE_BUILD_COST = 10;       // energy to create a new tile during explore
  if ((base.energy ?? 0) < MOVE_COST) return; // insufficient shared energy → no movement
  const MOVE_PERIOD_MS = 1100; // slower step
  const BUILD_TIME_MS = 1200;  // hold time when creating a new tile
  const HARVEST_ANIM_MS = 900; // keep in sync with client interpolation
  // removed duplicate HARVEST_ANIM_MS declaration
  // snapshot
  const tiles = await TilesCollection.find({}, { fields: { q: 1, r: 1 } }).fetchAsync();
  const tileSet = new Set(tiles.map((t) => `${t.q},${t.r}`));
  const units = await UnitsCollection.find({ type: 'scout' }, { fields: { _id: 1, q: 1, r: 1, lastMoveAt: 1, buildHoldUntil: 1, harvestHoldUntil: 1, pendingHarvestResourceId: 1, goal: 1, goalData: 1 } }).fetchAsync();
  const resources = await ResourcesCollection.find({}, { fields: { _id: 1, q: 1, r: 1, kind: 1, amount: 1 } }).fetchAsync();
  dlog(`Tick: base.energy=${base.energy}, tiles=${tiles.length}, units=${units.length}, resources=${resources.length}`);

  // Occupancy to avoid two units in same tile in the same tick
  const occupied = new Set(units.map((u) => `${u.q},${u.r}`));

  let energySpent = 0;
  for (const u of units) {
    if ((base.energy - energySpent) < MOVE_COST) { dlog('Stop: not enough energy for any move'); break; }
    // Rate-limit unit movement or building hold
    const nowMs = Date.now();
    const lastMs = u.lastMoveAt ? new Date(u.lastMoveAt).getTime() : 0;
    const buildMs = u.buildHoldUntil ? new Date(u.buildHoldUntil).getTime() : 0;
    const harvestMs = u.harvestHoldUntil ? new Date(u.harvestHoldUntil).getTime() : 0;
    // Finish pending harvest when its hold ends
    if (harvestMs && nowMs >= harvestMs) {
      const res = resources.find((r) => (u.pendingHarvestResourceId ? String(r._id) === String(u.pendingHarvestResourceId) : (r.q === u.q && r.r === u.r)));
      const now = new Date();
      if (res) {
        dlog('Harvest done', u._id, 'resource', res._id, res.kind, res.amount, '@', u.q, u.r);
        await ResourcesCollection.removeAsync({ _id: res._id });
        const delta = res.amount || 0;
        if (res.kind === 'energy') {
          await BasesCollection.updateAsync({ _id: 'player' }, { $inc: { energy: delta }, $set: { updatedAt: now } });
        } else {
          await BasesCollection.updateAsync({ _id: 'player' }, { $inc: { metal: delta }, $set: { updatedAt: now } });
        }
      }
      await UnitsCollection.updateAsync({ _id: u._id }, { $unset: { harvestHoldUntil: 1, pendingHarvestResourceId: 1 }, $set: { updatedAt: now } });
      dlog('Unit free after harvest hold', u._id);
      continue;
    }
    if ((buildMs && nowMs < buildMs) || (harvestMs && nowMs < harvestMs) || (lastMs && (nowMs - lastMs) < MOVE_PERIOD_MS)) {
      dlog('Skip: hold or rate limit', u._id, { buildMs, harvestMs, lastMs, nowMs });
      continue;
    }
    let next = null;
    const isBaseTile = (q, r) => (typeof base.baseQ === 'number' && typeof base.baseR === 'number' && q === base.baseQ && r === base.baseR);
    if (u.goal === 'idle' || !u.goal) {
      dlog('Idle', u._id);
      continue;
    } else if (u.goal === 'harvest') {
      // Find nearest resource by hex distance
      let best = null;
      let bestD = Infinity;
      for (const r of resources) {
        const d = hexDistance(u.q, u.r, r.q, r.r);
        if (d < bestD) { bestD = d; best = r; }
      }
      if (!best) { continue; }
      // If already on a resource tile, start harvest hold instead of moving
      if (best.q === u.q && best.r === u.r) {
        if (!u.harvestHoldUntil) {
          dlog('Start harvest hold on tile', u._id, '@', u.q, u.r, 'res', best._id);
          await UnitsCollection.updateAsync({ _id: u._id }, { $set: { harvestHoldUntil: new Date(Date.now() + HARVEST_ANIM_MS), pendingHarvestResourceId: best._id, updatedAt: new Date() } });
        }
        continue;
      }
      const passable = (q, r) => tileSet.has(`${q},${r}`) && !occupied.has(`${q},${r}`) && !isBaseTile(q, r);
      const path = aStarPath({ q: u.q, r: u.r }, { q: best.q, r: best.r }, passable);
      if (path.length === 0) { dlog('No path to resource', u._id, 'from', u.q, u.r, 'to', best.q, best.r); continue; }
      dlog('Harvest step', u._id, '->', path[0]);
      next = path[0];
    } else if (u.goal === 'explore') {
      const dir = normalizeDir((u.goalData && u.goalData.direction) || { x: 1, z: 0 });
      // Choose the neighbor most aligned with desired direction. Allow stepping into unknown by creating the tile.
      let best = null;
      let bestScore = -Infinity;
      for (const [nq, nr] of axialNeighbors(u.q, u.r)) {
        if (isBaseTile(nq, nr)) continue;
        const key = `${nq},${nr}`;
        const from = axialToWorldVec(u.q, u.r);
        const to = axialToWorldVec(nq, nr);
        const vx = to.x - from.x;
        const vz = to.z - from.z;
        const vlen = Math.hypot(vx, vz) || 1;
        const dot = (vx / vlen) * dir.x + (vz / vlen) * dir.z;
        if (occupied.has(key)) continue; // avoid stepping into occupied tile
        const exists = tileSet.has(key);
        // Prefer outward expansion slightly when alignment is similar
        const score = dot + (exists ? 0 : 0.05);
        if (score > bestScore) { bestScore = score; best = { q: nq, r: nr, exists }; }
      }
      if (!best) { dlog('Explore: no neighbor'); continue; }
      if (!best.exists) {
        // Require enough energy to create a new tile; consume build energy on creation and hold
        if ((base.energy - energySpent) < EXPLORE_BUILD_COST) {
          dlog('Explore: insufficient energy to build', u._id);
          continue; // not enough energy to build this step
        }
        energySpent += EXPLORE_BUILD_COST;
        // Create the tile if missing (idempotent via upsert) and hold
        const now = new Date();
        await TilesCollection.updateAsync({ q: best.q, r: best.r }, { $setOnInsert: { q: best.q, r: best.r, createdAt: now } }, { upsert: true });
        tileSet.add(`${best.q},${best.r}`);
        await UnitsCollection.updateAsync({ _id: u._id }, { $set: { buildHoldUntil: new Date(Date.now() + BUILD_TIME_MS), updatedAt: now } });
        dlog('Explore: built new tile and holding', u._id, best.q, best.r);
        // No movement this tick; will move next tick after hold
        continue;
      }
      next = { q: best.q, r: best.r };
    }
    if (!next) continue;
    const nextKey = `${next.q},${next.r}`;
    if (occupied.has(nextKey)) continue; // just in case
    // Move: spend energy; exploration costs 1 as well; only tile creation is costly
    energySpent += MOVE_COST;
    const now = new Date();
    await UnitsCollection.updateAsync({ _id: u._id }, {
      $set: { prevQ: u.q, prevR: u.r, q: next.q, r: next.r, lastMoveAt: now, updatedAt: now, buildHoldUntil: null }
    });
    occupied.delete(`${u.q},${u.r}`);
    occupied.add(nextKey);
    dlog('Moved', u._id, 'to', next.q, next.r, 'energySpentSoFar', energySpent);
    // If a resource is present on the arrival tile, hold for harvest animation; remove on next pass
    const res = resources.find((r) => r.q === next.q && r.r === next.r);
    if (res) {
      await UnitsCollection.updateAsync({ _id: u._id }, { $set: { harvestHoldUntil: new Date(Date.now() + HARVEST_ANIM_MS), pendingHarvestResourceId: res._id } });
      dlog('Arrived on resource, start harvest hold', u._id, res._id);
    }
  }
  if (energySpent > 0) {
    await BasesCollection.updateAsync({ _id: 'player' }, { $inc: { energy: -energySpent }, $set: { updatedAt: new Date() } });
    dlog('Tick energy debited', energySpent, 'remaining', (await BasesCollection.findOneAsync({ _id: 'player' })).energy);
  }
}

function pickBottomCenterTile(tiles) {
  // Deterministic "bottom-center" using world projection and lateral distance to center
  if (!tiles || tiles.length === 0) return { q: 0, r: 0 };
  const radius = 0.6;
  let best = null;
  let bestScore = Infinity;
  // compute center in world by averaging
  let cx = 0, cz = 0;
  for (const t of tiles) {
    const x = radius * (3 / 2) * t.q;
    const z = radius * Math.sqrt(3) * (t.r + t.q / 2);
    cx += x; cz += z;
  }
  cx /= tiles.length; cz /= tiles.length;
  for (const t of tiles) {
    const x = radius * (3 / 2) * t.q;
    const z = radius * Math.sqrt(3) * (t.r + t.q / 2);
    // bottom-most = minimal z, tie-break by |x - cx|
    const score = z * 1000 + Math.abs(x - cx); // z dominates
    if (score < bestScore) { bestScore = score; best = t; }
  }
  return { q: best.q, r: best.r };
}

// Run simulation tick periodically
// Rare resource spawn helper
async function rareResourceSpawn() {
  const MAX_RESOURCES = 10; // global cap to keep scarcity
  const existingCount = await ResourcesCollection.find().countAsync();
  if (existingCount >= MAX_RESOURCES) return;

  const tiles = await TilesCollection.find({}, { fields: { q: 1, r: 1 } }).fetchAsync();
  const base = await BasesCollection.findOneAsync({ _id: 'player' });
  const occupiedUnitKeys = new Set(
    (await UnitsCollection.find({}, { fields: { q: 1, r: 1 } }).fetchAsync()).map((u) => `${u.q},${u.r}`)
  );
  const occupiedResourceKeys = new Set(
    (await ResourcesCollection.find({}, { fields: { q: 1, r: 1 } }).fetchAsync()).map((r) => `${r.q},${r.r}`)
  );
  const freeTiles = tiles.filter((t) => {
    if (base && typeof base.baseQ === 'number' && typeof base.baseR === 'number') {
      if (t.q === base.baseQ && t.r === base.baseR) return false;
    }
    const key = `${t.q},${t.r}`;
    return !occupiedUnitKeys.has(key) && !occupiedResourceKeys.has(key);
  });
  if (freeTiles.length === 0) return;
  const t = freeTiles[Math.floor(Math.random() * freeTiles.length)];
  const kind = Math.random() < 0.6 ? 'energy' : 'metal';
  const baseAmount = kind === 'energy' ? 10 : 10;
  const jitter = Math.floor(Math.random() * 10);
  try {
    await ResourcesCollection.insertAsync({ kind, q: t.q, r: t.r, amount: baseAmount + jitter, createdAt: new Date() });
  } catch (e) {
    // ignore duplicates due to race
  }
}

// Self-rescheduling Poisson-like spawn loop: spawns at random times, one at a time
function scheduleResourceSpawnLoop() {
  const MEAN_MS = 15000; // average ~15s between attempts
  const raw = -Math.log(1 - Math.random()) * MEAN_MS; // exponential
  const delay = Math.max(5000, Math.min(raw, 60000)); // clamp 5s..60s
  if (globalThis.__rareSpawnTimer) {
    Meteor.clearTimeout(globalThis.__rareSpawnTimer);
  }
  globalThis.__rareSpawnTimer = Meteor.setTimeout(async () => {
    try { await rareResourceSpawn(); } catch (e) { /* ignore */ }
    scheduleResourceSpawnLoop();
  }, delay);
}

Meteor.startup(() => {
  Meteor.setInterval(() => {
    simulationTick().catch(() => {});
  }, 500);
  scheduleResourceSpawnLoop();
});

function normalizeDir(dir) {
  if (!dir || typeof dir.x !== 'number' || typeof dir.z !== 'number') return { x: 1, z: 0 };
  const len = Math.hypot(dir.x, dir.z) || 1;
  return { x: dir.x / len, z: dir.z / len };
}

function axialToWorldVec(q, r) {
  // replicate axialToWorld with tileRadius used in scene (0.6)
  const radius = 0.6;
  const x = radius * (3 / 2) * q;
  const z = radius * Math.sqrt(3) * (r + q / 2);
  return { x, z };
}
