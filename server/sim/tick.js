import { TilesCollection } from '/imports/api/tiles';
import { UnitsCollection } from '/imports/api/units';
import { ResourcesCollection } from '/imports/api/resources';
import { BasesCollection } from '/imports/api/bases';
import { aStarPath } from './pathfinding.js';
import { dlogFactory, axialNeighbors, normalizeDir, axialToWorldVec } from './utils.js';
import { DEBUG_MOVE, MOVE_PERIOD_MS, HARVEST_ANIM_MS, MOVE_COST, EXPLORE_BUILD_COST, PATH_FAIL_MAX_TICKS, BUILD_BLOCK_MAX_TICKS } from './constants.js';

const dlog = dlogFactory(DEBUG_MOVE);

export async function simulationTick() {
  const base = await BasesCollection.findOneAsync({ _id: 'player' });
  if (!base) return;
  let availableEnergy = base.energy ?? 0;

  const tiles = await TilesCollection.find({}, { fields: { q: 1, r: 1 } }).fetchAsync();
  const tileSet = new Set(tiles.map((t) => `${t.q},${t.r}`));
  const units = await UnitsCollection.find(
    { type: 'scout' },
    { fields: { _id: 1, q: 1, r: 1, lastMoveAt: 1, buildHoldUntil: 1, harvestHoldUntil: 1, pendingHarvestResourceId: 1, goal: 1, goalData: 1, pathFailCount: 1, buildBlockedCount: 1 } }
  ).fetchAsync();
  const resources = await ResourcesCollection.find({}, { fields: { _id: 1, q: 1, r: 1, kind: 1, amount: 1 } }).fetchAsync();
  dlog(`Tick: base.energy=${base.energy}, tiles=${tiles.length}, units=${units.length}, resources=${resources.length}`);

  const occupied = new Set(units.map((u) => `${u.q},${u.r}`));
  let moveEnergySpent = 0;
  for (const u of units) {
    const nowMs = Date.now();
    const lastMs = u.lastMoveAt ? new Date(u.lastMoveAt).getTime() : 0;
    const buildMs = u.buildHoldUntil ? new Date(u.buildHoldUntil).getTime() : 0;
    const harvestMs = u.harvestHoldUntil ? new Date(u.harvestHoldUntil).getTime() : 0;
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
    const canMove = (availableEnergy - moveEnergySpent) >= MOVE_COST;
    if (u.goal === 'idle' || !u.goal) {
      dlog('Idle', u._id);
      continue;
    } else if (u.goal === 'harvest') {
      let best = null; let bestD = Infinity;
      for (const r of resources) {
        const d = Math.round((Math.abs(u.q - r.q) + Math.abs(u.r - r.r) + Math.abs((u.q - r.q) + (u.r - r.r))) / 2);
        if (d < bestD) { bestD = d; best = r; }
      }
      if (!best) { continue; }
      if (best.q === u.q && best.r === u.r) {
        if (!u.harvestHoldUntil) {
          dlog('Start harvest hold on tile', u._id, '@', u.q, u.r, 'res', best._id);
          await UnitsCollection.updateAsync({ _id: u._id }, { $set: { harvestHoldUntil: new Date(Date.now() + HARVEST_ANIM_MS), pendingHarvestResourceId: best._id, updatedAt: new Date() } });
        }
        continue;
      }
      if (!canMove) { dlog('Energy gating: cannot move (harvest) this tick', u._id); continue; }
      const passable = (q, r) => tileSet.has(`${q},${r}`) && !occupied.has(`${q},${r}`) && !isBaseTile(q, r);
      const path = aStarPath({ q: u.q, r: u.r }, { q: best.q, r: best.r }, passable);
      if (path.length === 0) {
        const current = (u.pathFailCount || 0) + 1;
        if (current >= PATH_FAIL_MAX_TICKS) {
          await UnitsCollection.updateAsync({ _id: u._id }, { $set: { goal: 'idle', pathFailCount: 0, updatedAt: new Date() } });
          dlog('Path fallback: switching to Idle after failures', u._id);
        } else {
          await UnitsCollection.updateAsync({ _id: u._id }, { $set: { pathFailCount: current, updatedAt: new Date() } });
          dlog('No path to resource; increment fail count', u._id, current);
        }
        continue;
      }
      dlog('Harvest step', u._id, '->', path[0]);
      next = path[0];
    } else if (u.goal === 'explore') {
      const dir = normalizeDir((u.goalData && u.goalData.direction) || { x: 1, z: 0 });
      let best = null; let bestScore = -Infinity;
      for (const [nq, nr] of axialNeighbors(u.q, u.r)) {
        if (isBaseTile(nq, nr)) continue;
        const key = `${nq},${nr}`;
        const from = axialToWorldVec(u.q, u.r);
        const to = axialToWorldVec(nq, nr);
        const vx = to.x - from.x; const vz = to.z - from.z;
        const vlen = Math.hypot(vx, vz) || 1;
        const dot = (vx / vlen) * dir.x + (vz / vlen) * dir.z;
        if (occupied.has(key)) continue;
        const exists = tileSet.has(key);
        const score = dot + (exists ? 0 : 0.05);
        if (score > bestScore) { bestScore = score; best = { q: nq, r: nr, exists }; }
      }
      if (!best) { dlog('Explore: no neighbor'); continue; }
      if (!best.exists) {
        if ((availableEnergy - moveEnergySpent) < EXPLORE_BUILD_COST) {
          const current = (u.buildBlockedCount || 0) + 1;
          if (current >= BUILD_BLOCK_MAX_TICKS) {
            await UnitsCollection.updateAsync({ _id: u._id }, { $set: { goal: 'idle', buildBlockedCount: 0, updatedAt: new Date() } });
            dlog('Explore: energy blocked repeatedly; switching to Idle', u._id);
          } else {
            await UnitsCollection.updateAsync({ _id: u._id }, { $set: { buildBlockedCount: current, updatedAt: new Date() } });
            dlog('Explore: insufficient energy to build; increment block count', u._id, current);
          }
          continue;
        }
        availableEnergy -= EXPLORE_BUILD_COST;
        await BasesCollection.updateAsync({ _id: 'player' }, { $inc: { energy: -EXPLORE_BUILD_COST }, $set: { updatedAt: new Date() } });
        const now = new Date();
        await TilesCollection.updateAsync({ q: best.q, r: best.r }, { $setOnInsert: { q: best.q, r: best.r, createdAt: now } }, { upsert: true });
        tileSet.add(`${best.q},${best.r}`);
        await UnitsCollection.updateAsync({ _id: u._id }, { $set: { buildHoldUntil: new Date(Date.now() + HARVEST_ANIM_MS + (BUILD_TIME_MS - HARVEST_ANIM_MS)), updatedAt: now } });
        dlog('Explore: built new tile and holding', u._id, best.q, best.r);
        continue;
      }
      if (!canMove) { dlog('Energy gating: cannot move (explore) this tick', u._id); continue; }
      next = { q: best.q, r: best.r };
    }
    if (!next) continue;
    const nextKey = `${next.q},${next.r}`;
    if (occupied.has(nextKey)) continue;
    moveEnergySpent += MOVE_COST;
    const now = new Date();
    await UnitsCollection.updateAsync({ _id: u._id }, { $set: { prevQ: u.q, prevR: u.r, q: next.q, r: next.r, lastMoveAt: now, updatedAt: now, buildHoldUntil: null } });
    occupied.delete(`${u.q},${u.r}`);
    occupied.add(nextKey);
    dlog('Moved', u._id, 'to', next.q, next.r, 'moveEnergySpentSoFar', moveEnergySpent);
    const res = resources.find((r) => r.q === next.q && r.r === next.r);
    if (res) {
      await UnitsCollection.updateAsync({ _id: u._id }, { $set: { harvestHoldUntil: new Date(Date.now() + HARVEST_ANIM_MS), pendingHarvestResourceId: res._id } });
      dlog('Arrived on resource, start harvest hold', u._id, res._id);
    }
  }
  if (moveEnergySpent > 0) {
    await BasesCollection.updateAsync({ _id: 'player' }, { $inc: { energy: -moveEnergySpent }, $set: { updatedAt: new Date() } });
    const cur = await BasesCollection.findOneAsync({ _id: 'player' });
    dlog('Tick energy debited (moves)', moveEnergySpent, 'remaining', cur?.energy);
  }
}


