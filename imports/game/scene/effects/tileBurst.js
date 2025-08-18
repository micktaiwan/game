import * as THREE from 'three';

/**
 * Tile burst particle system extracted from the scene façade.
 * Provides spawn helpers and an update loop to manage lifecycles.
 */
export function createTileBurstSystem(renderRadius) {
  const group = new THREE.Group();
  const active = new Set();

  function spawnEnergySpikes(pos, color, radiusHint = renderRadius) {
    const count = 64;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = pos.x;
      positions[i * 3 + 1] = 0.12;
      positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const sp = 1.2 + Math.random() * 2.4;
      velocities[i * 3 + 0] = Math.cos(a) * sp;
      velocities[i * 3 + 1] = 3.0 + Math.random() * 3.0;
      velocities[i * 3 + 2] = Math.sin(a) * sp;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size: (radiusHint || renderRadius) * 0.22,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ps = new THREE.Points(geom, mat);
    ps.userData = { velocities, age: 0, lifespan: 0.5, gravity: -7.0 };
    group.add(ps);
    active.add(ps);
    return ps;
  }

  function spawnTileSparkBurst(pos) {
    const count = 56;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = pos.x;
      positions[i * 3 + 1] = 0.06;
      positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const sp = 0.8 + Math.random() * 2.0;
      velocities[i * 3 + 0] = Math.cos(a) * sp;
      velocities[i * 3 + 1] = 2.2 + Math.random() * 2.2;
      velocities[i * 3 + 2] = Math.sin(a) * sp;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffe08a,
      size: renderRadius * 0.22,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const ps = new THREE.Points(geom, mat);
    ps.userData = { velocities, age: 0, lifespan: 0.7, gravity: -6.0 };
    group.add(ps);
    active.add(ps);
    return ps;
  }

  function update(dt) {
    for (const ps of Array.from(active)) {
      const ud = ps.userData || {};
      ud.age = (ud.age || 0) + dt;
      const positions = ps.geometry.attributes.position.array;
      const velocities = ud.velocities;
      for (let i = 0; i < velocities.length / 3; i++) {
        velocities[i * 3 + 1] += (ud.gravity || -6.0) * dt;
        positions[i * 3 + 0] += velocities[i * 3 + 0] * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
      }
      ps.geometry.attributes.position.needsUpdate = true;
      const duration = ud.lifespan || 0.6;
      const t = Math.min(1, Math.max(0, ud.age / duration));
      if (ps.material && ps.material.transparent === true) {
        ps.material.opacity = 0.95 * (1 - t);
      }
      if (ud.age >= duration) {
        group.remove(ps);
        if (ps.geometry) ps.geometry.dispose();
        if (ps.material) ps.material.dispose();
        active.delete(ps);
      } else {
        ps.userData = ud;
      }
    }
  }

  function dispose() {
    for (const ps of Array.from(active)) {
      group.remove(ps);
      if (ps.geometry) ps.geometry.dispose();
      if (ps.material) ps.material.dispose();
      active.delete(ps);
    }
  }

  return { group, spawnEnergySpikes, spawnTileSparkBurst, update, dispose };
}


