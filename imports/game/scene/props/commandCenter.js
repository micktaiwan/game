import * as THREE from 'three';

export function buildCommandCenterTripod(group, platformRadius, platformHeight) {
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(platformRadius, platformRadius, platformHeight, 24),
    new THREE.MeshStandardMaterial({ color: 0x7f95ad, metalness: 0.25, roughness: 0.55 })
  );
  platform.position.y = platformHeight / 2;
  group.add(platform);

  // Central reactor core
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(platformRadius * 0.22, platformRadius * 0.22, platformHeight * 1.2, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x32d296, emissiveIntensity: 1.8, roughness: 0.25 })
  );
  core.position.y = platformHeight * 1.1;
  group.add(core);

  // Three capacitors around
  const capRadius = platformRadius * 0.18;
  const capHeight = platformHeight * 2.8; // taller to showcase breathing FX
  const capMat = new THREE.MeshStandardMaterial({ color: 0x9fb3c8, metalness: 0.35, roughness: 0.4, emissive: 0x1b2a35, emissiveIntensity: 0.3 });
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3);
    const r = platformRadius * 0.58;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(capRadius, capRadius * 0.9, capHeight, 14), capMat);
    cap.position.set(Math.cos(a) * r, platformHeight + capHeight / 2, Math.sin(a) * r);
    group.add(cap);
  }

  // Halo ring
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(platformRadius * 0.95, platformRadius * 0.05, 10, 60),
    new THREE.MeshBasicMaterial({ color: 0x32d296, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = platformHeight * 0.9;
  group.add(halo);

  group.userData.ccFX = { halo, core, phase: Math.random() * Math.PI * 2 };
}


