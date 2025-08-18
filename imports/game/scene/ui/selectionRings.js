import * as THREE from 'three';

export function createSelectionRings(renderRadius) {
  const selectionRing = new THREE.Mesh(
    new THREE.RingGeometry(renderRadius * 0.85, renderRadius * 0.98, 48),
    new THREE.MeshBasicMaterial({ color: 0x32d296, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.position.y = 0.01;
  selectionRing.visible = false;

  const hoverRing = new THREE.Mesh(
    new THREE.RingGeometry(renderRadius * 0.9, renderRadius * 1.02, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  hoverRing.rotation.x = -Math.PI / 2;
  hoverRing.position.y = 0.011;
  hoverRing.visible = false;

  return { selectionRing, hoverRing };
}


