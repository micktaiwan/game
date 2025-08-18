import { axialNeighbors, hexDistance } from './utils.js';

export function aStarPath(start, goal, passable) {
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
      const path = [];
      let cur = current;
      while (cameFrom.has(cur)) {
        path.unshift(cur);
        cur = cameFrom.get(cur);
      }
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
  return [];
}


