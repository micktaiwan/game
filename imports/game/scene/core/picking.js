import * as THREE from 'three';

export function screenToNdc(e, element) {
  const rect = element.getBoundingClientRect();
  return new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -(((e.clientY - rect.top) / rect.height) * 2 - 1)
  );
}

export function pickFirst(hitRoot, ndc, camera) {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(hitRoot, true);
}

export function findPickedUnitId(hit) {
  let node = hit?.object;
  while (node) {
    const ud = node.userData;
    if (ud && ud.kind === 'unit' && ud.unitId) return ud.unitId;
    node = node.parent;
  }
  return null;
}


