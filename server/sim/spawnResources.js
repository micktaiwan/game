import { Meteor } from 'meteor/meteor';
import { TilesCollection } from '/imports/api/tiles';
import { UnitsCollection } from '/imports/api/units';
import { ResourcesCollection } from '/imports/api/resources';
import { BasesCollection } from '/imports/api/bases';

export async function rareResourceSpawn() {
  const MAX_RESOURCES = 10;
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
  } catch (e) { /* ignore duplicates */ }
}

export function scheduleResourceSpawnLoop() {
  const MEAN_MS = 15000; // exponential mean
  const raw = -Math.log(1 - Math.random()) * MEAN_MS;
  const delay = Math.max(5000, Math.min(raw, 60000));
  if (globalThis.__rareSpawnTimer) {
    Meteor.clearTimeout(globalThis.__rareSpawnTimer);
  }
  globalThis.__rareSpawnTimer = Meteor.setTimeout(async () => {
    try { await rareResourceSpawn(); } catch (e) {}
    scheduleResourceSpawnLoop();
  }, delay);
}


