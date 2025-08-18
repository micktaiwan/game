import * as THREE from 'three';
import { colorForGoal } from '/imports/shared/colors.js';

export function createBeamTexture(hexColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
  const color = `#${hexColor.toString(16).padStart(6, '0')}`;
  grad.addColorStop(0.00, `${color}00`);
  grad.addColorStop(0.20, `${color}55`);
  grad.addColorStop(0.50, `${color}ff`);
  grad.addColorStop(0.80, `${color}66`);
  grad.addColorStop(1.00, `${color}00`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  tex.needsUpdate = true;
  return tex;
}

export function createGoalIndicator(goal, renderRadius) {
  const group = new THREE.Group();
  group.userData.kind = 'indicator';
  group.userData.goal = goal;
  group.userData.phase = Math.random() * Math.PI * 2;
  const height = 1.6;
  const radius = renderRadius * 0.15;
  const beamGeom = new THREE.CylinderGeometry(radius, radius, height, 20, 1, true);
  const baseColor = colorForGoal(goal);
  const beamMat = new THREE.MeshBasicMaterial({
    color: baseColor,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    map: createBeamTexture(baseColor)
  });
  const beam = new THREE.Mesh(beamGeom, beamMat);
  beam.position.y = height * 0.5;
  group.add(beam);

  // Embers
  const particleCount = 28;
  const pGeom = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const speeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const rad = radius * 0.6 * Math.sqrt(Math.random());
    positions[i * 3 + 0] = Math.cos(angle) * rad;
    positions[i * 3 + 1] = Math.random() * height;
    positions[i * 3 + 2] = Math.sin(angle) * rad;
    speeds[i] = 0.4 + Math.random() * 0.8;
  }
  pGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeom.computeBoundingSphere();
  const pMat = new THREE.PointsMaterial({
    color: baseColor,
    size: radius * 0.35,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const particles = new THREE.Points(pGeom, pMat);
  group.add(particles);

  group.userData.beamMat = beamMat;
  group.userData.beamHeight = height;
  group.userData.particles = particles;
  group.userData.particleSpeeds = speeds;
  group.userData.scrollSpeed = 0.35;
  return group;
}

export function updateGoalIndicator(group, goal) {
  const color = new THREE.Color(colorForGoal(goal));
  const beamMat = group.userData.beamMat;
  if (beamMat) {
    beamMat.color = color;
    beamMat.map = createBeamTexture(color.getHex());
    beamMat.needsUpdate = true;
  }
  const pMat = group.userData.particles?.material;
  if (pMat && pMat.isMaterial) {
    pMat.color = color;
    pMat.needsUpdate = true;
  }
  group.userData.goal = goal;
}

