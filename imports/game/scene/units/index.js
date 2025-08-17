export function ensureUnitsRendered(
  {
    THREE,
    unitsGroup,
    unitMeshesById,
    unitIndicatorsById,
    renderRadius,
    axialToWorldVec,
    createGoalIndicator,
    updateGoalIndicator,
    buildSoldierMesh,
    buildScoutMesh,
  },
  unitsList,
) {
  // Remove meshes for units that no longer exist
  for (const [id, mesh] of unitMeshesById.entries()) {
    if (!unitsList.find((u) => u._id === id)) {
      unitsGroup.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
      unitMeshesById.delete(id);
      const ind = unitIndicatorsById.get(id);
      if (ind) {
        unitsGroup.remove(ind);
        if (ind.material) ind.material.dispose();
        if (ind.geometry) ind.geometry.dispose();
        unitIndicatorsById.delete(id);
      }
    }
  }
  // Add/update meshes
  for (const u of unitsList) {
    let mesh = unitMeshesById.get(u._id);
    const currentPos = axialToWorldVec(u.q, u.r);
    if (!mesh) {
      // Build unit visual depending on type
      const group = new THREE.Group();
      if ((u.type || 'scout') === 'soldier') {
        const soldier = buildSoldierMesh(renderRadius);
        group.add(soldier);
      } else {
        const scoutMesh = buildScoutMesh(renderRadius);
        group.add(scoutMesh);
      }
      group.position.set(currentPos.x, 0, currentPos.z);
      group.userData = { kind: 'unit', unitId: u._id };
      group.traverse((child) => { if (child && child.isMesh) { child.userData = { ...(child.userData || {}), kind: 'unit', unitId: u._id }; } });
      unitsGroup.add(group);
      unitMeshesById.set(u._id, group);
      // Light column indicator
      const column = createGoalIndicator(u.goal, renderRadius);
      column.position.set(currentPos.x, 0.0, currentPos.z);
      unitsGroup.add(column);
      unitIndicatorsById.set(u._id, column);
    } else {
      // Simplified movement: snap directly to server position (no interpolation)
      mesh.position.set(currentPos.x, 0, currentPos.z);
      // Update indicator position and style
      let ind = unitIndicatorsById.get(u._id);
      if (!ind) {
        ind = createGoalIndicator(u.goal, renderRadius);
        unitsGroup.add(ind);
        unitIndicatorsById.set(u._id, ind);
      }
      ind.position.set(mesh.position.x, 0.0, mesh.position.z);
      updateGoalIndicator(ind, u.goal);
      // Keep scout colors constant (mode-agnostic)
      if ((u.type || 'scout') !== 'soldier') {
        const eq = mesh.getObjectByName && mesh.getObjectByName('equatorRing');
        if (eq && eq.material) {
          eq.material.color = new THREE.Color(0x2da8ff);
          eq.material.needsUpdate = true;
        }
        const orb = mesh.getObjectByName && mesh.getObjectByName('scoutOrb');
        if (orb && orb.material && orb.material.isMeshStandardMaterial) {
          orb.material.emissive = new THREE.Color(0x3fd8ff);
          orb.material.needsUpdate = true;
        }
        const sats = mesh.getObjectByName && mesh.getObjectByName('satellites');
        if (sats) {
          const satColors = [ new THREE.Color(0x2da8ff), new THREE.Color(0xffd166), new THREE.Color(0xbc66ff) ];
          for (let i = 0; i < sats.children.length; i += 1) {
            const child = sats.children[i];
            if (child && child.material) {
              child.material.color = satColors[i % satColors.length];
              child.material.needsUpdate = true;
            }
          }
        }
      }
    }
  }
}

