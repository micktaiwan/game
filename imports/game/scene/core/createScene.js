import * as THREE from 'three';

export function createScene(containerElement) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1115);

  const camera = new THREE.PerspectiveCamera(
    60,
    Math.max(1, containerElement.clientWidth) / Math.max(1, containerElement.clientHeight),
    0.1,
    200,
  );

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(Math.max(1, containerElement.clientWidth), Math.max(1, containerElement.clientHeight));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  containerElement.appendChild(renderer.domElement);

  return { scene, camera, renderer };
}

