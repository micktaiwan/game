import assert from 'assert';
import { hexDistance, normalizeDir } from '/server/sim/utils.js';

describe('utils: hexDistance', function () {
  it('returns 0 for identical coordinates', function () {
    assert.strictEqual(hexDistance(0, 0, 0, 0), 0);
  });

  it('returns 1 for adjacent hexes', function () {
    assert.strictEqual(hexDistance(0, 0, 1, 0), 1);
    assert.strictEqual(hexDistance(0, 0, 0, 1), 1);
    assert.strictEqual(hexDistance(0, 0, -1, 1), 1);
  });

  it('is symmetric', function () {
    assert.strictEqual(hexDistance(2, -1, -1, 2), hexDistance(-1, 2, 2, -1));
  });
});

describe('utils: normalizeDir', function () {
  it('normalizes non-zero vectors to length 1 in XZ plane', function () {
    const d = normalizeDir({ x: 10, z: 0 });
    assert.ok(Math.abs(d.x - 1) < 1e-9);
    assert.ok(Math.abs(d.z - 0) < 1e-9);
  });

  it('handles zero or invalid input by returning default (1,0)', function () {
    const a = normalizeDir(null);
    const b = normalizeDir({});
    assert.strictEqual(a.x, 1); assert.strictEqual(a.z, 0);
    assert.strictEqual(b.x, 1); assert.strictEqual(b.z, 0);
  });
});


