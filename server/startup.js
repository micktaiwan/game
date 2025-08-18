import { Meteor } from 'meteor/meteor';
import { TilesCollection } from '/imports/api/tiles';
import { UnitsCollection } from '/imports/api/units';
import { ResourcesCollection } from '/imports/api/resources';
import { BasesCollection } from '/imports/api/bases';
import { simulationTick } from './sim/tick.js';
import { scheduleResourceSpawnLoop } from './sim/spawnResources.js';
import { SERVER_TICK_MS } from './sim/constants.js';
import { TILE_RADIUS } from '/imports/shared/constants.js';

async function ensureUniqueIndex(collection, key, name) {
  const raw = collection.rawCollection();
  const indexes = await raw.indexes();
  const existing = indexes.find((ix) => ix.name === name);
  if (!existing) {
    try { await raw.createIndex(key, { name, unique: true }); return; } catch (e) {}
  }
  if (existing && !existing.unique) {
    try { await raw.dropIndex(name); } catch (e) {}
    await raw.createIndex(key, { name, unique: true });
  }
}

function pickBottomCenterTile(tiles) {
  if (!tiles || tiles.length === 0) return { q: 0, r: 0 };
  const radius = TILE_RADIUS;
  let best = null; let bestScore = Infinity;
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

export async function serverStartup() {
  if (await TilesCollection.find().countAsync() === 0) {
    const radius = 4;
    const tiles = [];
    for (let q = -radius; q <= radius; q += 1) {
      const r1 = Math.max(-radius, -q - radius);
      const r2 = Math.min(radius, -q + radius);
      for (let r = r1; r <= r2; r += 1) {
        tiles.push({ q, r });
      }
    }
    await TilesCollection.rawCollection().insertMany(
      tiles.map((t) => ({ ...t, createdAt: new Date() }))
    );
  }
  await UnitsCollection.rawCollection().createIndex({ q: 1, r: 1 });
  await ensureUniqueIndex(ResourcesCollection, { q: 1, r: 1 }, 'q_1_r_1');
  await BasesCollection.rawCollection().createIndex({ _id: 1 });
  if (await ResourcesCollection.find().countAsync() === 0) {
    const tiles = await TilesCollection.find({}, { fields: { q: 1, r: 1 } }).fetchAsync();
    await seedResourcesOnTiles(tiles);
  }
  if (!await BasesCollection.findOneAsync({ _id: 'player' })) {
    const tiles = await TilesCollection.find({}, { fields: { q: 1, r: 1 } }).fetchAsync();
    const pos = pickBottomCenterTile(tiles);
    await BasesCollection.insertAsync({ _id: 'player', energy: 20, metal: 20, baseQ: pos.q, baseR: pos.r, updatedAt: new Date() });
  }
  Meteor.setInterval(() => { simulationTick().catch(() => {}); }, SERVER_TICK_MS);
  scheduleResourceSpawnLoop();
}


