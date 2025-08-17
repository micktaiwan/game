import * as THREE from 'three';

export function buildScoutMesh(renderRadius) {
  const group = new THREE.Group();

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(renderRadius * 0.38, 18, 14),
    new THREE.MeshStandardMaterial({ color: 0xaad7c8, metalness: 0.2, roughness: 0.45, emissive: new THREE.Color(0x3fd8ff), emissiveIntensity: 0.38 })
  );
  orb.name = 'scoutOrb';
  orb.position.y = renderRadius * 0.45;
  group.add(orb);

  const equatorRing = new THREE.Mesh(
    new THREE.TorusGeometry(renderRadius * 0.42, renderRadius * 0.015, 10, 40),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x2da8ff), transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending })
  );
  equatorRing.name = 'equatorRing';
  equatorRing.rotation.x = Math.PI / 2;
  equatorRing.position.y = orb.position.y;
  group.add(equatorRing);

  const satellites = new THREE.Group();
  satellites.name = 'satellites';
  satellites.userData.angle = Math.random() * Math.PI * 2;
  const satGeom = new THREE.SphereGeometry(renderRadius * 0.08, 12, 10);
  const satColors = [
    new THREE.Color(0x2da8ff), // blue
    new THREE.Color(0xffd166), // amber
    new THREE.Color(0xbc66ff), // violet
  ];
  for (let i = 0; i < 3; i += 1) {
    const s = new THREE.Mesh(
      satGeom,
      new THREE.MeshBasicMaterial({ color: satColors[i], transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending })
    );
    s.userData.offset = (i * Math.PI * 2) / 3;
    satellites.add(s);
  }
  group.add(satellites);

  return group;
}

