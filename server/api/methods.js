import { Meteor } from 'meteor/meteor';
import { TilesCollection } from '/imports/api/tiles';
import { UnitsCollection } from '/imports/api/units';
import { ResourcesCollection } from '/imports/api/resources';
import { BasesCollection } from '/imports/api/bases';
import { hexDistance } from '../sim/utils.js';
import { TILE_RADIUS } from '/imports/shared/constants.js';

async function generateSmallHexMap(radius = 4) {
  const tiles = [];
  for (let q = -radius; q <= radius; q += 1) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r += 1) {
      tiles.push({ q, r });
    }
  }
  return tiles;
}

function pickBottomCenterTile(tiles) {
  if (!tiles || tiles.length === 0) return { q: 0, r: 0 };
  const radius = TILE_RADIUS;
  let best = null;
  let bestScore = Infinity;
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
    const score = z * 1000 + Math.abs(x - cx);
    if (score < bestScore) { bestScore = score; best = t; }
  }
  return { q: best.q, r: best.r };
}

async function seedResourcesOnTiles(tiles) {
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
    const base = await BasesCollection.findOneAsync({ _id: 'player' });
    const filtered = base && typeof base.baseQ === 'number' && typeof base.baseR === 'number'
      ? nodes.filter((n) => !(n.q === base.baseQ && n.r === base.baseR))
      : nodes;
    if (filtered.length > 0) {
      await ResourcesCollection.rawCollection().insertMany(filtered);
    }
  }
}

Meteor.methods({
  async 'tiles.reset'(radius = 4) {
    await TilesCollection.removeAsync({});
    await UnitsCollection.removeAsync({});
    await ResourcesCollection.removeAsync({});
    const radiusNum = Number(radius) || 4;
    const tiles = await generateSmallHexMap(radiusNum);
    await TilesCollection.rawCollection().insertMany(
      tiles.map((t) => ({ ...t, createdAt: new Date() }))
    );
    await seedResourcesOnTiles(tiles);
    const pos = pickBottomCenterTile(tiles);
    await BasesCollection.upsertAsync({ _id: 'player' }, { $set: { energy: 20, metal: 20, baseQ: pos.q, baseR: pos.r, updatedAt: new Date() } });
    return { inserted: tiles.length, base: pos };
  },
  async 'units.spawnScout'({ base }) {
    if (!base || typeof base.q !== 'number' || typeof base.r !== 'number') {
      throw new Meteor.Error('invalid-args', 'Base axial coordinates are required');
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
    if (freeTiles.length === 0) throw new Meteor.Error('no-space', 'No free tiles available on the map');
    freeTiles.sort((a, b) => hexDistance(base.q, base.r, a.q, a.r) - hexDistance(base.q, base.r, b.q, b.r));
    const { q, r } = freeTiles[0];
    const now = new Date();
    const costMetal = 20;
    const baseDoc = await BasesCollection.findOneAsync({ _id: 'player' });
    if (!baseDoc || baseDoc.metal < costMetal) throw new Meteor.Error('insufficient-metal', 'Not enough Metal to produce a Scout');
    await BasesCollection.updateAsync({ _id: 'player' }, { $inc: { metal: -costMetal }, $set: { updatedAt: now } });
    const unit = { type: 'scout', q, r, goal: 'idle', goalData: null, hp: 100, energy: 100, createdAt: now, updatedAt: now };
    const _id = await UnitsCollection.insertAsync(unit);
    return { _id, ...unit };
  },
  async 'units.spawnSoldier'({ base }) {
    if (!base || typeof base.q !== 'number' || typeof base.r !== 'number') {
      throw new Meteor.Error('invalid-args', 'Base axial coordinates are required');
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
    if (freeTiles.length === 0) throw new Meteor.Error('no-space', 'No free tiles available on the map');
    freeTiles.sort((a, b) => hexDistance(base.q, base.r, a.q, a.r) - hexDistance(base.q, base.r, b.q, b.r));
    const { q, r } = freeTiles[0];
    const now = new Date();
    const costMetal = 30;
    const baseDoc = await BasesCollection.findOneAsync({ _id: 'player' });
    if (!baseDoc || baseDoc.metal < costMetal) throw new Meteor.Error('insufficient-metal', 'Not enough Metal to produce a Soldier');
    await BasesCollection.updateAsync({ _id: 'player' }, { $inc: { metal: -costMetal }, $set: { updatedAt: now } });
    const unit = { type: 'soldier', q, r, goal: 'defend', goalData: null, hp: 180, energy: 100, createdAt: now, updatedAt: now };
    const _id = await UnitsCollection.insertAsync(unit);
    return { _id, ...unit };
  },
  async 'units.stopAll'() {
    const selector = { type: 'scout', goal: { $in: ['harvest', 'explore'] } };
    const res = await UnitsCollection.updateAsync(selector, { $set: { goal: 'idle', updatedAt: new Date() } }, { multi: true });
    return { updated: res };
  },
  async 'base.setPosition'({ q, r }) {
    if (typeof q !== 'number' || typeof r !== 'number') throw new Meteor.Error('invalid-args', 'Base coordinates required');
    await BasesCollection.updateAsync({ _id: 'player' }, { $set: { baseQ: q, baseR: r, updatedAt: new Date() } });
    await ResourcesCollection.removeAsync({ q, r });
  },
  async 'units.setGoal'({ unitId, goal, goalData }) {
    if (!unitId || typeof goal !== 'string') throw new Meteor.Error('invalid-args', 'unitId and goal are required');
    const allowed = new Set(['idle', 'harvest', 'explore', 'defend', 'attack']);
    if (!allowed.has(goal)) throw new Meteor.Error('invalid-goal', 'Unsupported goal');
    const set = { goal, goalData: goal === 'explore' ? { direction: ((goalData && goalData.direction) || { x: 1, z: 0 }) } : null, updatedAt: new Date() };
    await UnitsCollection.updateAsync({ _id: unitId }, { $set: set });
    return { ok: 1 };
  },
});


