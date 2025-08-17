import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import * as THREE from 'three';

export function createPostProcess(renderer, scene, camera, containerElement) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const ssaoPass = new SSAOPass(scene, camera, containerElement.clientWidth, containerElement.clientHeight);
  ssaoPass.enabled = false;
  composer.addPass(ssaoPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(containerElement.clientWidth, containerElement.clientHeight),
    0.25,
    0.6,
    0.75
  );
  composer.addPass(bloomPass);

  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.material.uniforms['resolution'].value.set(1 / (containerElement.clientWidth * (window.devicePixelRatio || 1)), 1 / (containerElement.clientHeight * (window.devicePixelRatio || 1)));
  fxaaPass.renderToScreen = true;
  composer.addPass(fxaaPass);

  return { composer, ssaoPass, bloomPass, fxaaPass };
}

