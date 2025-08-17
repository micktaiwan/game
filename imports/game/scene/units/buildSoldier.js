import * as THREE from 'three';

export function buildSoldierMesh(renderRadius) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(renderRadius * 0.28, renderRadius * 0.32, renderRadius * 0.6, 18),
    new THREE.MeshStandardMaterial({ color: 0x2da8ff, metalness: 0.35, roughness: 0.5 })
  );
  body.position.y = renderRadius * 0.3;
  const turret = new THREE.Mesh(
    new THREE.SphereGeometry(renderRadius * 0.2, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xbfdfff, metalness: 0.2, roughness: 0.4, emissive: 0x0f2740, emissiveIntensity: 0.25 })
  );
  turret.position.y = renderRadius * 0.62;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(renderRadius * 0.24, renderRadius * 0.04, 10, 24),
    new THREE.MeshStandardMaterial({ color: 0x2da8ff, metalness: 0.25, roughness: 0.5 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = renderRadius * 0.12;
  group.add(body); group.add(turret); group.add(ring);
  return group;
}

