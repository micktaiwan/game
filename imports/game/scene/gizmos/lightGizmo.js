import * as THREE from 'three';

export function ensureLightGizmo(debugGroup, light, existing) {
  let lightGizmo = existing || null;
  if (!lightGizmo) {
    lightGizmo = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 8), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.7 }));
    stem.name = 'stem';
    lightGizmo.add(head);
    lightGizmo.add(stem);
    debugGroup.add(lightGizmo);
  }
  lightGizmo.visible = true;
  lightGizmo.position.set(light.position.x, 0, light.position.z);
  const head = lightGizmo.children[0];
  const stem = lightGizmo.getObjectByName('stem');
  if (head) head.position.y = light.position.y;
  if (stem) { stem.scale.y = Math.max(0.001, light.position.y); stem.position.y = light.position.y * 0.5; }
  return lightGizmo;
}

