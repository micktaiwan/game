import * as THREE from 'three';

export function ensureResourcesRendered(resourcesGroup, resourceMeshesById, axialToWorldVec, renderRadius, resourceList) {
  // cleanup removed
  for (const [id, mesh] of resourceMeshesById.entries()) {
    if (!resourceList.find((r) => r._id === id)) {
      resourcesGroup.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
      resourceMeshesById.delete(id);
    }
  }
  for (const r of resourceList) {
    let mesh = resourceMeshesById.get(r._id);
    const pos = axialToWorldVec(r.q, r.r);
    if (!mesh) {
      const color = r.kind === 'energy' ? 0xffd166 : 0x118ab2;
      const geom = new THREE.DodecahedronGeometry(renderRadius * 0.35);
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.7, emissive: color, emissiveIntensity: 0.15 });
      mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(pos.x, renderRadius * 0.35, pos.z);
      mesh.userData = { kind: 'resource', resourceId: r._id };
      resourcesGroup.add(mesh);
      resourceMeshesById.set(r._id, mesh);
    } else {
      mesh.position.set(pos.x, renderRadius * 0.35, pos.z);
    }
  }
}

