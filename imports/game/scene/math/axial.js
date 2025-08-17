export function axialToWorld(q, r, radius) {
  const x = radius * (3 / 2) * q;
  const z = radius * Math.sqrt(3) * (r + q / 2);
  return { x, z };
}

