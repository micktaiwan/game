export function animateScouts(unitMeshesById, dt, t, renderRadius) {
  for (const [, mesh] of unitMeshesById.entries()) {
    if (!mesh || !mesh.userData) continue;
    const eq = mesh.getObjectByName && mesh.getObjectByName('equatorRing');
    if (eq && eq.material) {
      eq.rotation.z += 0.2 * dt;
      eq.material.opacity = 0.18 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.7));
    }
    const sats = mesh.getObjectByName && mesh.getObjectByName('satellites');
    const orb = mesh.getObjectByName && mesh.getObjectByName('scoutOrb');
    if (sats && orb) {
      const r = (orb.geometry.parameters.radius || renderRadius * 0.38) * 1.28;
      sats.userData.angle = (sats.userData.angle || 0) + 0.8 * dt;
      const num = sats.children.length;
      for (let i = 0; i < num; i += 1) {
        const child = sats.children[i];
        const ang = sats.userData.angle + (child.userData.offset || 0);
        child.position.set(Math.cos(ang) * r, orb.position.y, Math.sin(ang) * r);
      }
    }
  }
}

