import * as THREE from 'three';

export const defaultGfx = {
  exposure: 1.6,
  ambientIntensity: 1.2,
  fogEnabled: true,
  fogDensity: 0.007,
  bloomEnabled: true,
  bloomStrength: 0.65,
  bloomRadius: 0.6,
  bloomThreshold: 0.1,
  fxaaEnabled: true,
  ssaoEnabled: false,
  ssaoKernelRadius: 6,
  ssaoMinDistance: 0.004,
  ssaoMaxDistance: 0.12,
  tileColor: 3822440,
  tileEmissive: 1054496,
  tileEmissiveIntensity: 1.13,
  tileBrightness: 2.0,
  outlineColor: 1713971,
  outlineOpacity: 0.2,
  skyTop: 1185051,
  skyBottom: 856343,
  dirLightAzimuthDeg: 342.12,
  dirLightRadius: 3.6,
  showLightGizmo: false,
  dirLightAutoOrbit: false,
  dirLightOrbitSpeedDeg: 90,
};

export function applyGfxSettings(gfx, ctx) {
  const { renderer, ambient, scene, bloomPass, fxaaPass, ssaoPass, tileMeshByKey, outlineMaterial, skyMat, light, ensureLightGizmoRef, hideLightGizmoRef } = ctx;
  renderer.toneMappingExposure = gfx.exposure;
  ambient.intensity = gfx.ambientIntensity;
  if (gfx.fogEnabled) {
    scene.fog = new THREE.FogExp2(0x0a0d12, gfx.fogDensity);
  } else {
    scene.fog = null;
  }
  bloomPass.enabled = !!gfx.bloomEnabled;
  bloomPass.strength = gfx.bloomStrength;
  bloomPass.radius = gfx.bloomRadius;
  bloomPass.threshold = gfx.bloomThreshold;
  fxaaPass.enabled = !!gfx.fxaaEnabled;
  ssaoPass.enabled = !!gfx.ssaoEnabled;
  ssaoPass.kernelRadius = gfx.ssaoKernelRadius;
  ssaoPass.minDistance = gfx.ssaoMinDistance;
  ssaoPass.maxDistance = gfx.ssaoMaxDistance;
  for (const mesh of tileMeshByKey.values()) {
    if (mesh.material && mesh.material.isMaterial) {
      const baseColor = new THREE.Color(gfx.tileColor);
      const bright = Math.max(0.2, gfx.tileBrightness || 1.0);
      baseColor.multiplyScalar(bright);
      mesh.material.color = baseColor;
      mesh.material.emissive = new THREE.Color(gfx.tileEmissive);
      mesh.material.emissiveIntensity = gfx.tileEmissiveIntensity;
      mesh.material.needsUpdate = true;
    }
  }
  outlineMaterial.color = new THREE.Color(gfx.outlineColor);
  outlineMaterial.opacity = gfx.outlineOpacity;
  outlineMaterial.needsUpdate = true;
  if (skyMat && skyMat.uniforms) {
    skyMat.uniforms.topColor.value = new THREE.Color(gfx.skyTop);
    skyMat.uniforms.bottomColor.value = new THREE.Color(gfx.skyBottom);
    skyMat.needsUpdate = true;
  }
  if (typeof gfx.dirLightAzimuthDeg === 'number' || typeof gfx.dirLightRadius === 'number') {
    const deg = typeof gfx.dirLightAzimuthDeg === 'number' ? gfx.dirLightAzimuthDeg : 34;
    const rad = THREE.MathUtils.degToRad(deg);
    const r = gfx.dirLightRadius || 3.6;
    const y = light.position.y;
    light.position.set(Math.cos(rad) * r, y, Math.sin(rad) * r);
  }
  if (ensureLightGizmoRef && hideLightGizmoRef) {
    if (gfx.showLightGizmo) ensureLightGizmoRef();
    else hideLightGizmoRef();
  }
}

