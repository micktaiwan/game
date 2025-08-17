export function ensureTilesRendered({ THREE, tilesGroup, outlinesGroup, outlineMaterial, outlineGeometry, tileMeshByKey, outlineByKey, tileKeys, axialToWorld, tileRadius, hexDisc, tileMaterial, spawnTileSparkBurst }, nextTiles) {
  if (!Array.isArray(nextTiles)) return;
  const nextKeySet = new Set(nextTiles.map((t) => `${t.q},${t.r}`));
  for (const key of Array.from(tileKeys)) {
    if (!nextKeySet.has(key)) {
      const mesh = tileMeshByKey.get(key);
      const line = outlineByKey.get(key);
      if (mesh) {
        tilesGroup.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
        tileMeshByKey.delete(key);
      }
      if (line) {
        outlinesGroup.remove(line);
        outlineByKey.delete(key);
      }
      tileKeys.delete(key);
    }
  }
  for (const t of nextTiles) {
    const key = `${t.q},${t.r}`;
    if (tileKeys.has(key)) continue;
    const pos = axialToWorld(t.q, t.r, tileRadius);
    const mesh = new THREE.Mesh(hexDisc, tileMaterial.clone());
    mesh.position.set(pos.x, 0.6, pos.z);
    mesh.scale.set(0.1, 0.1, 0.1);
    mesh.userData = { kind: 'tile', q: t.q, r: t.r };
    tilesGroup.add(mesh);
    tileMeshByKey.set(key, mesh);
    const line = new THREE.LineLoop(outlineGeometry, outlineMaterial);
    line.position.set(pos.x, 0.001, pos.z);
    outlinesGroup.add(line);
    outlineByKey.set(key, line);
    tileKeys.add(key);
    const start = performance.now();
    const duration = 1000;
    function animateDrop(now) {
      const tNorm = Math.min(1, (now - start) / duration);
      const ease = tNorm < 0.5 ? 2 * tNorm * tNorm : 1 - Math.pow(-2 * tNorm + 2, 2) / 2;
      mesh.position.y = 0.6 * (1 - ease);
      const s = 0.1 + 0.9 * ease;
      mesh.scale.set(s, s, s);
      if (tNorm < 1) requestAnimationFrame(animateDrop);
    }
    requestAnimationFrame(animateDrop);
    spawnTileSparkBurst({ x: pos.x, z: pos.z });
  }
}

