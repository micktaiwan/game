export function dlogFactory(enabled) {
  return function dlog(...args) {
    if (enabled) console.log('[SIM]', ...args);
  };
}

export function axialNeighbors(q, r) {
  return [
    [q + 1, r],
    [q - 1, r],
    [q, r + 1],
    [q, r - 1],
    [q + 1, r - 1],
    [q - 1, r + 1],
  ];
}

export function hexDistance(q1, r1, q2, r2) {
  const dq = q1 - q2;
  const dr = r1 - r2;
  return Math.round((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2);
}

import { TILE_RADIUS } from '/imports/shared/constants.js';

export function axialToWorldVec(q, r, radius = TILE_RADIUS) {
  const x = radius * (3 / 2) * q;
  const z = radius * Math.sqrt(3) * (r + q / 2);
  return { x, z };
}

export function normalizeDir(dir) {
  if (!dir || typeof dir.x !== 'number' || typeof dir.z !== 'number') return { x: 1, z: 0 };
  const len = Math.hypot(dir.x, dir.z) || 1;
  return { x: dir.x / len, z: dir.z / len };
}


