import assert from 'assert';
import { aStarPath } from '/server/sim/pathfinding.js';

function passableAll() { return true; }

describe('pathfinding: aStarPath', function () {
  it('returns empty path when start equals goal', function () {
    const path = aStarPath({ q: 0, r: 0 }, { q: 0, r: 0 }, passableAll);
    assert.ok(Array.isArray(path));
    assert.strictEqual(path.length, 0);
  });

  it('finds a path between adjacent hexes', function () {
    const path = aStarPath({ q: 0, r: 0 }, { q: 1, r: 0 }, passableAll);
    assert.strictEqual(path.length, 1);
    assert.deepStrictEqual(path[0], { q: 1, r: 0 });
  });

  it('finds a multi-step path when passable', function () {
    const path = aStarPath({ q: 0, r: 0 }, { q: 2, r: -1 }, passableAll);
    assert.ok(path.length >= 2);
    const last = path[path.length - 1];
    assert.deepStrictEqual(last, { q: 2, r: -1 });
  });

  it('returns empty when blocked by passable=false', function () {
    const blocked = (q, r) => !(q === 0 && r === 1);
    const path = aStarPath({ q: 0, r: 0 }, { q: 0, r: 1 }, blocked);
    assert.strictEqual(path.length, 0);
  });
});


