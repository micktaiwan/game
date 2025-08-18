import * as THREE from 'three';
import { createGoalIndicator, updateGoalIndicator } from './indicators/goalIndicator';
import { ensureLightGizmo } from './gizmos/lightGizmo';
import { buildScoutMesh } from './units/buildScout';
import { buildSoldierMesh } from './units/buildSoldier';
import { ensureUnitsRendered as ensureUnitsRenderedExt } from './units/index';
import { ensureResourcesRendered as ensureResourcesRenderedExt } from './resources/index';
import { ensureTilesRendered as ensureTilesRenderedExt } from './tiles/index';
import { axialToWorld as axialToWorldFn } from './math/axial';
import { animateScouts } from './units/animate';
import { buildCommandCenterTripod } from './props/commandCenter';
import { createStarfield } from './core/starfield';
import { createScene } from './core/createScene';
import { createPostProcess } from './core/postprocess';
import { installInputHandlers } from './core/input';
import { defaultGfx, applyGfxSettings as applyGfxSettingsExt } from './core/gfxSettings';
import { createTileBurstSystem } from './effects/tileBurst';
import { createSelectionRings } from './ui/selectionRings';
import { screenToNdc, pickFirst } from './core/picking';
import { handleClickPick } from './core/pickingHandlers';
import { TILE_RADIUS } from '/imports/shared/constants.js';

function axialToWorld(q, r, radius) {
  const p = axialToWorldFn(q, r, radius);
  return new THREE.Vector3(p.x, 0, p.z);
}

/**
 * Initialize a minimal Three.js scene inside the provided container.
 * Returns a cleanup function to dispose resources and listeners.
 */
/**
 * Create and mount the Three.js scene for the hex world.
 * Public API returned: { resetView, cleanup, setUnits, setResources, setSelectedUnitId, setTiles, setBase }
 * Notes:
 * - Base placement is client-authoritative. Pass `options.base` to avoid visual flicker.
 * - Use `setTiles` when the tiles collection changes to add/remove meshes reactively.
 */
export function createThreeApp(containerElement, tilesData = [], options = {}) {
  const { onSelectCommandCenter, onSelectUnit, onSelectResource, onExploreDirection, onClickTile, onBaseCandidate, units = [], resources = [] } = options;
  if (!containerElement) {
    throw new Error('createThreeApp: containerElement is required');
  }

  // Scene core (creates scene, camera, renderer and attaches canvas)
  const { scene, camera, renderer } = createScene(containerElement);
  // Skybox gradient via large inverted sphere (kept here so GFX can tweak it)
  const skyGeo = new THREE.SphereGeometry(300, 16, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x12151b) },
      bottomColor: { value: new THREE.Color(0x0d1117) },
      offset: { value: 0.0 },
      exponent: { value: 1.0 },
    },
    vertexShader: `varying vec3 vWorldPosition; void main(){ vec4 worldPosition = modelMatrix * vec4( position, 1.0 ); vWorldPosition = worldPosition.xyz; gl_Position = projectionMatrix * viewMatrix * worldPosition; }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main(){ float h = normalize( vWorldPosition ).y; float f = max(pow(max(h + offset, 0.0), exponent), 0.0); gl_FragColor = vec4( mix( bottomColor, topColor, f ), 1.0 ); }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  // Fog disabled for now (tiles visibility first)
  scene.fog = null;

  // moved starfield creation to core/starfield

  // Scene was created above; nothing else to do here

  // Postprocessing
  const { composer, ssaoPass, bloomPass, fxaaPass } = createPostProcess(renderer, scene, camera, containerElement);

  function applyGfxSettings(next) {
    gfx = { ...gfx, ...next };
    const ensureLightGizmoRef = () => { lightGizmo = ensureLightGizmo(debugGroup, light, lightGizmo); };
    applyGfxSettingsExt(gfx, { renderer, ambient, scene, bloomPass, fxaaPass, ssaoPass, tileMeshByKey, outlineMaterial, skyMat, light, ensureLightGizmoRef });
  }

  // Initial preset will be applied after gfx is initialized below

  function getGfxSettings() {
    return { ...gfx };
  }

  // moved CC builder to props/commandCenter

  // spawnEnergySpikes now provided by the tile burst system

  // Hex tiles rendering (flat hex discs without thickness)
  const tileRadius = TILE_RADIUS; // spacing radius
  const gapRatio = 0.02; // 2% gap between tiles
  const renderRadius = tileRadius * (1.0 - gapRatio);
  const hexDisc = new THREE.CircleGeometry(renderRadius, 6);
  hexDisc.rotateX(-Math.PI / 2);
  const tileMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a5368,
    metalness: 0.08,
    roughness: 0.8,
    emissive: 0x101720,
    emissiveIntensity: 0.22
  });

  // Outline geometry and material
  const outlineRadius = tileRadius * (1.0 - gapRatio * 0.35);
  const outlinePoints = [];
  for (let i = 0; i < 6; i += 1) {
    const theta = (i * Math.PI) / 3; // 0, 60, 120... flat-top
    outlinePoints.push(new THREE.Vector3(
      outlineRadius * Math.cos(theta),
      0.001,
      outlineRadius * Math.sin(theta)
    ));
  }
  const outlineGeometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
  const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x1a2733, transparent: true, opacity: 0.9 });

  const tilesGroup = new THREE.Group();
  const outlinesGroup = new THREE.Group();
  const tileKeys = new Set();
  const tileMeshByKey = new Map();
  const outlineByKey = new Map();
  let introComplete = false;
  // Intro: staggered drop for tiles
  let __introTileIdx = 0;
  const __introStaggerMs = 18;
  for (const tile of tilesData) {
    const mesh = new THREE.Mesh(hexDisc, tileMaterial.clone());
    const pos = axialToWorld(tile.q, tile.r, tileRadius);
    mesh.position.set(pos.x, 0.6, pos.z);
    mesh.scale.set(0.1, 0.1, 0.1);
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    mesh.userData = { kind: 'tile', q: tile.q, r: tile.r };
    tilesGroup.add(mesh);
    tileMeshByKey.set(`${tile.q},${tile.r}`, mesh);

    const line = new THREE.LineLoop(outlineGeometry, outlineMaterial);
    line.position.set(pos.x, 0.001, pos.z);
    outlinesGroup.add(line);
    outlineByKey.set(`${tile.q},${tile.r}`, line);
    tileKeys.add(`${tile.q},${tile.r}`);

    const startDelay = __introTileIdx * __introStaggerMs;
    __introTileIdx += 1;
    const start = performance.now() + startDelay;
    function animateDrop(now) {
      if (now < start) { requestAnimationFrame(animateDrop); return; }
      const tNorm = Math.min(1, (now - start) / 500);
      const ease = tNorm < 0.5 ? 2 * tNorm * tNorm : 1 - Math.pow(-2 * tNorm + 2, 2) / 2;
      mesh.position.y = 0.6 * (1 - ease);
      const s = 0.1 + 0.9 * ease;
      mesh.scale.set(s, s, s);
      if (tNorm < 1) requestAnimationFrame(animateDrop);
    }
    requestAnimationFrame(animateDrop);
  }
  scene.add(tilesGroup);
  scene.add(outlinesGroup);
  // Initialize effects system now that renderRadius is computed
  const tileBurst = createTileBurstSystem(renderRadius);
  const effectsGroup = tileBurst.group;
  const spawnEnergySpikes = tileBurst.spawnEnergySpikes;
  const spawnTileSparkBurst = tileBurst.spawnTileSparkBurst;
  const updateTileBursts = tileBurst.update;
  const disposeTileBursts = tileBurst.dispose;
  scene.add(effectsGroup);

  // Starfield far behind the map
  const starfield = createStarfield(tilesData.length > 0 ? 80 : 120);
  scene.add(starfield);
  // Apply graphics preset once after initial scene objects exist
  applyInitialPreset();

  // Player base decal will be created after map bounds are computed (needs center/mapRadius)

  // Compute map bounds and place camera top-down so the whole map fits in view
  const box = new THREE.Box3().setFromObject(tilesGroup);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  const mapRadius = sphere.radius * 1.05; // small margin
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const fitDistance = mapRadius / Math.tan(fovRad / 2);

  const state = {
    target: center.clone(),
    radius: fitDistance * 0.85,
    azimuth: -Math.PI / 2,           // rotate -90° so world -Z aligns with screen bottom
    polar: 0.65,          // more angled view to better see vertical columns
  };

  // Pan world up a bit at initialization to frame CC and tiles better
  state.target.add(new THREE.Vector3(0, 0, -mapRadius * 0.2));

  function updateCamera() {
    const sinPhi = Math.sin(state.polar);
    const cosPhi = Math.cos(state.polar);
    const cosTheta = Math.cos(state.azimuth);
    const sinTheta = Math.sin(state.azimuth);
    const x = state.target.x + state.radius * sinPhi * cosTheta;
    const y = state.target.y + state.radius * cosPhi;
    const z = state.target.z + state.radius * sinPhi * sinTheta;
    camera.position.set(x, y, z);
    camera.lookAt(state.target);
  }

  updateCamera();
  // Ensure we look slightly tilted if polar is very small

  const light = new THREE.DirectionalLight(0xffffff, 0.8);
  light.position.set(3, 5, 2);
  light.castShadow = false; // keep off until meshes are set to cast/receive
  scene.add(light);

  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);

  let animationFrameId = null;
  let lastFrameTimeSec = performance.now() * 0.001;
  let commandCenter = null;
  let commandCenterTile = null;
  const unitsGroup = new THREE.Group();
  scene.add(unitsGroup);
  // Debug visuals group (for gizmos)
  const debugGroup = new THREE.Group();
  scene.add(debugGroup);
  let lightGizmo = null;

  const unitMeshesById = new Map();
  const unitIndicatorsById = new Map();
  const resourcesGroup = new THREE.Group();
  scene.add(resourcesGroup);
  const resourceMeshesById = new Map();
  let tilesInitialized = false;
  // Graphics settings (runtime adjustable)
  let gfx = { ...defaultGfx };
  // Apply the initial graphics preset now that gfx is defined
  function applyInitialPreset() {
    // Delay to ensure passes are fully ready
    requestAnimationFrame(() => applyGfxSettings({}));
  }
  // Selection and hover rings
  const { selectionRing, hoverRing } = createSelectionRings(renderRadius);
  scene.add(selectionRing);
  scene.add(hoverRing);

  let currentSelectedUnitId = null;

  function axialToWorldVec(q, r) {
    return axialToWorld(q, r, tileRadius);
  }

  /** Update or remove unit meshes to match the given list. */
  function ensureUnitsRendered(unitsList) {
    return ensureUnitsRenderedExt({
      THREE,
      unitsGroup,
      unitMeshesById,
      unitIndicatorsById,
      renderRadius,
      axialToWorldVec,
      createGoalIndicator,
      updateGoalIndicator,
      buildSoldierMesh,
      buildScoutMesh,
    }, unitsList);
  }

  // Moved to indicators/goalIndicator.js

  // Moved to indicators/goalIndicator.js

  // colorForGoal imported from indicators/goalIndicator.js

  /** Update or remove resource meshes to match the given list. */
  const ensureResourcesRendered = (resourceList) => ensureResourcesRenderedExt(resourcesGroup, resourceMeshesById, axialToWorldVec, renderRadius, resourceList);

  /** Add/remove tiles in the scene to reflect nextTiles from the DB. */
  function ensureTilesRendered(nextTiles) {
    ensureTilesRenderedExt({
      THREE,
      tilesGroup,
      outlinesGroup,
      outlineMaterial,
      outlineGeometry,
      tileMeshByKey,
      outlineByKey,
      tileKeys,
      axialToWorld,
      tileRadius,
      hexDisc,
      tileMaterial,
      spawnTileSparkBurst,
    }, nextTiles);
    tilesInitialized = true;
  }

  // spawnTileSparkBurst provided by tileBurst system

  // Camera controls: pan/orbit/zoom
  const drag = { active: false, mode: 'pan', lastX: 0, lastY: 0 };

  // 3D UI removed – we expose an API to control the camera from HTML overlay

  // onPointerDown/onPointerMove handled by core/input via installInputHandlers
  // Tile hover feedback
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (drag.active) return;
    const ndc = screenToNdc(e, renderer.domElement);
    const hits = pickFirst(tilesGroup, ndc, camera);
    if (hits.length > 0) {
      const obj = hits[0].object;
      const info = obj.userData || {};
      if (info.kind === 'tile') {
        hoverRing.visible = true;
        hoverRing.position.set(obj.position.x, hoverRing.position.y, obj.position.z);
        return;
      }
    }
    hoverRing.visible = false;
  }, { passive: true });

  function onPointerUp(e) {
    drag.active = false;
    renderer.domElement.releasePointerCapture(e.pointerId);
    // click selection
    const moved = Math.abs(e.clientX - drag.lastX) + Math.abs(e.clientY - drag.lastY);
    if (moved < 3) {
      const ndc = screenToNdc(e, renderer.domElement);
      const handled = handleClickPick({
        ndc,
        camera,
        unitsGroup,
        tilesGroup,
        resourcesGroup,
        commandCenter,
        commandCenterTile,
        currentSelectedUnitId,
        optionsUnits: options.units,
        optionsResources: options.resources,
        onSelectUnit,
        onSelectResource,
        onSelectCommandCenter,
        onClickTile,
        pointer: { x: e.clientX, y: e.clientY },
      });
      if (handled) return;
      // If explore-direction modifier: send a direction vector on ground plane
      if (typeof onExploreDirection === 'function' && (e.altKey || e.metaKey)) {
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const point = new THREE.Vector3();
        const raycaster2 = new THREE.Raycaster();
        raycaster2.setFromCamera(ndc, camera);
        raycaster2.ray.intersectPlane(plane, point);
        const dir = point.clone().sub(state.target).setY(0);
        if (dir.length() > 0.0001) {
          onExploreDirection({ direction: { x: dir.x, z: dir.z } });
          return;
        }
      }
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const zoomSpeed = 0.0015;
    const factor = 1 + (e.deltaY * zoomSpeed);
    const minDist = Math.max(mapRadius * 0.2, tileRadius * 1.4);
    const maxDist = mapRadius * 4.0;
    state.radius = THREE.MathUtils.clamp(state.radius * factor, minDist, maxDist);
    updateCamera();
  }

  const onResize = () => {
    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setSize(width, height);
    // Update FXAA and SSAO
    if (fxaaPass) {
      fxaaPass.material.uniforms['resolution'].value.set(1 / (width * (window.devicePixelRatio || 1)), 1 / (height * (window.devicePixelRatio || 1)));
    }
    if (ssaoPass) {
      ssaoPass.width = width;
      ssaoPass.height = height;
    }
  };

  const animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    // Subtle starfield motion for parallax (very slow)
    starfield.rotation.y += 0.00008;
    starfield.rotation.x += 0.00002;
    // Lock starfield position to camera so pan doesn't translate background
    starfield.position.copy(camera.position);
    // Animate indicators and effects
    const nowSec = performance.now() * 0.001;
    const dt = Math.min(0.05, Math.max(0.0, nowSec - lastFrameTimeSec));
    const t = nowSec;
    lastFrameTimeSec = nowSec;
    // Auto orbit directional light if enabled
    if (gfx.dirLightAutoOrbit) {
      const deg = (gfx.dirLightAzimuthDeg || 0) + (gfx.dirLightOrbitSpeedDeg || 0) * dt;
      gfx.dirLightAzimuthDeg = ((deg + 360) % 360);
      const rad = THREE.MathUtils.degToRad(gfx.dirLightAzimuthDeg);
      const r = gfx.dirLightRadius || 3.6;
      const y = light.position.y;
      light.position.set(Math.cos(rad) * r, y, Math.sin(rad) * r);
      if (lightGizmo && lightGizmo.visible) {
        lightGizmo.position.set(light.position.x, 0, light.position.z);
        const head = lightGizmo.children[0];
        const stem = lightGizmo.getObjectByName('stem');
        if (head) head.position.y = light.position.y;
        if (stem) { stem.scale.y = Math.max(0.001, light.position.y); stem.position.y = light.position.y * 0.5; }
      }
    }
    for (const [, group] of unitIndicatorsById.entries()) {
      const goal = group.userData.goal || 'idle';
      const phase = group.userData.phase || 0;
      const height = group.userData.beamHeight || 1.6;
      // Rise/fall bobbing of whole beam
      const yBob = 0.02 * Math.sin(t * 2.2 + phase);
      group.position.y = yBob;
      // Gentle twist per mode
      if (goal === 'attack') group.rotation.y += 0.03;
      else if (goal === 'explore') group.rotation.y += 0.02;
      else if (goal === 'defend') group.rotation.y += 0.01;
      // Scroll the beam texture upward to simulate flowing energy
      const beamMat = group.userData.beamMat;
      if (beamMat && beamMat.map) {
        beamMat.map.offset.y = (beamMat.map.offset.y + (group.userData.scrollSpeed || 0.35) * dt) % 1;
      }
      // Animate particles rising like embers
      const particles = group.userData.particles;
      const speeds = group.userData.particleSpeeds;
      if (particles && speeds) {
        const pos = particles.geometry.attributes.position;
        for (let i = 0; i < speeds.length; i++) {
          let y = pos.getY(i) + speeds[i] * dt;
          if (y > height) y = 0.0;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
        particles.material.opacity = 0.7 + 0.25 * (0.5 + 0.5 * Math.sin(t * 3.0 + phase));
      }
    }
    // Animate scout adornments (equator ring + satellites)
    animateScouts(unitMeshesById, dt, t, renderRadius);
    // CC breathing/rotation if present
    if (commandCenter && commandCenter.userData && commandCenter.userData.ccFX) {
      const fx = commandCenter.userData.ccFX;
      const p = t + fx.phase;
      if (fx.halo) {
        fx.halo.scale.setScalar(1.0 + 0.1 * Math.sin(p * 1.6));
        fx.halo.material.opacity = 0.25 + 0.18 * (0.5 + 0.5 * Math.sin(p * 2.0));
      }
      if (fx.core) {
        fx.core.rotation.y += 0.015;
        fx.core.material.emissiveIntensity = 1.6 + 0.8 * (0.5 + 0.5 * Math.sin(p * 2.4));
      }
    }
    // Update spark bursts via effects system
    updateTileBursts(dt);
    // Follow selection ring if any
    if (currentSelectedUnitId) {
      const sel = unitMeshesById.get(currentSelectedUnitId);
      if (sel) {
        selectionRing.visible = true;
        selectionRing.position.x = sel.position.x;
        selectionRing.position.z = sel.position.z;
        const pulse = 0.85 + 0.08 * (0.5 + 0.5 * Math.sin(performance.now() * 0.005));
        selectionRing.scale.set(pulse, pulse, pulse);
      } else {
        selectionRing.visible = false;
      }
    } else {
      selectionRing.visible = false;
    }
    composer.render();
  };

  const removeBasicInput = installInputHandlers(renderer, camera, state, updateCamera, drag);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  renderer.domElement.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('resize', onResize);
  onResize();
  animate();

  // Create player base decal now that center/mapRadius are known
  (function createPlayerBase() {
    // Determine screen-bottom direction on ground plane
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
    const upScreen = new THREE.Vector3().crossVectors(right, forward).normalize();
    const downDir = upScreen.setY(0).normalize().multiplyScalar(-1); // invert to get screen-bottom direction
    const perpDir = new THREE.Vector3(-downDir.z, 0, downDir.x).normalize();

    let candidate = null;
    // Prefer explicit base from options when provided (avoids flicker)
    if (options.base && typeof options.base.q === 'number' && typeof options.base.r === 'number') {
      const p = axialToWorld(options.base.q, options.base.r, tileRadius);
      candidate = { q: options.base.q, r: options.base.r, pos: p, side: 0 };
    } else {
    let bestAlong = -Infinity;
    const eps = renderRadius * 0.5;
    for (const t of tilesData) {
      const p = axialToWorld(t.q, t.r, tileRadius);
      const v = p.clone().sub(center);
      const along = downDir.dot(v);
      if (along > bestAlong + 1e-6) {
        bestAlong = along;
        candidate = { q: t.q, r: t.r, pos: p, side: Math.abs(perpDir.dot(v)) };
      } else if (Math.abs(along - bestAlong) <= eps && candidate) {
        const side = Math.abs(perpDir.dot(v));
        if (side < candidate.side) {
          candidate = { q: t.q, r: t.r, pos: p, side };
          }
        }
      }
    }
    if (!candidate) return;
    // If no explicit base was provided, inform client of the candidate so it can persist it once
    if (!options.base && typeof onBaseCandidate === 'function') {
      try { onBaseCandidate({ q: candidate.q, r: candidate.r }); } catch (e) {}
    }

    const platformRadius = renderRadius * 0.74; // slightly larger footprint
    const platformHeight = 0.16; // thicker base for better visual presence
    const baseGroup = new THREE.Group();
    buildCommandCenterTripod(baseGroup, platformRadius, platformHeight);

    baseGroup.position.set(candidate.pos.x, 0.001, candidate.pos.z);
    // Delay CC appearance until tiles intro is complete
    const __introDoneMs = (__introTileIdx * __introStaggerMs) + 200;
    setTimeout(() => {
    scene.add(baseGroup);
    commandCenter = baseGroup;
    commandCenterTile = { q: candidate.q, r: candidate.r, pos: candidate.pos };
      // Spawn a short burst of energy on spawn
      spawnEnergySpikes(candidate.pos, 0x32d296, platformRadius);
    }, __introDoneMs);
    // Do not call onBasePlaced here; client will call after it decides authoritative position
  })();

  // Delay initial units/resources only once; subsequent updates should render live
  const __introDoneMs = (__introTileIdx * __introStaggerMs) + 600;
  setTimeout(() => {
    introComplete = true;
    ensureUnitsRendered(units);
    ensureResourcesRendered(resources);
  }, __introDoneMs);

  // Public API for external controls (HTML overlay)
  function resetView() {
    state.target.copy(center);
    state.radius = fitDistance * 0.85;
    state.azimuth = -Math.PI / 2;
    state.polar = 0.65;
    updateCamera();
  }

  function cleanup() {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', onResize);
    removeBasicInput();
    renderer.domElement.removeEventListener('wheel', onWheel);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    disposeTileBursts();
    renderer.dispose();
    hexDisc.dispose();
    tileMaterial.dispose();
    outlineGeometry.dispose();
    outlineMaterial.dispose();
    selectionRing.geometry.dispose();
    selectionRing.material.dispose();
    hoverRing.geometry.dispose();
    hoverRing.material.dispose();
    for (const [, mesh] of resourceMeshesById.entries()) {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    }
    for (const [, mesh] of unitMeshesById.entries()) {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    }
    if (renderer.domElement && renderer.domElement.parentNode === containerElement) {
      containerElement.removeChild(renderer.domElement);
    }
  }

  // Allow external refresh of units
  /** Replace the live units list driving meshes. */
  function setUnits(nextUnits) {
    options.units = Array.isArray(nextUnits) ? nextUnits.slice() : [];
    if (introComplete) {
      ensureUnitsRendered(options.units);
    }
  }

  /** Replace the live resources list driving meshes. */
  function setResources(nextResources) {
    options.resources = Array.isArray(nextResources) ? nextResources.slice() : [];
    if (introComplete) {
      ensureResourcesRendered(options.resources);
    }
  }

  /** Apply newly discovered/removed tiles to the scene. */
  function setTiles(nextTiles) {
    ensureTilesRendered(nextTiles);
  }

  /** Set/override the base position in the scene. Client is authoritative. */
  function setBase(nextBase) {
    if (!nextBase || typeof nextBase.q !== 'number' || typeof nextBase.r !== 'number') return;
    const pos = axialToWorld(nextBase.q, nextBase.r, tileRadius);
    if (!commandCenter) {
      // Create a minimal base if it was not created yet (e.g., after live reset)
      const platformRadius = renderRadius * 0.7;
      const platformHeight = 0.08;
      const domeRadius = platformRadius * 0.55;
      const baseGroup = new THREE.Group();
      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(platformRadius, platformRadius, platformHeight, 24),
        new THREE.MeshStandardMaterial({ color: 0x9fb3c8, metalness: 0.2, roughness: 0.6 })
      );
      platform.position.y = platformHeight / 2;
      baseGroup.add(platform);
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(platformRadius * 0.92, platformRadius * 0.07, 12, 48),
        new THREE.MeshStandardMaterial({ color: 0xe6edf3, metalness: 0.3, roughness: 0.4, emissive: 0x112233, emissiveIntensity: 0.2 })
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = platformHeight * 0.5;
      baseGroup.add(rim);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(domeRadius, 24, 16),
        new THREE.MeshStandardMaterial({ color: 0xd7e3ee, metalness: 0.1, roughness: 0.35 })
      );
      dome.position.y = platformHeight + domeRadius * 0.85;
      baseGroup.add(dome);
      scene.add(baseGroup);
      commandCenter = baseGroup;
    }
    commandCenter.position.set(pos.x, 0.001, pos.z);
    commandCenterTile = { q: nextBase.q, r: nextBase.r, pos };
  }

  function setSelectedUnitId(id) {
    // Update highlight by re-applying materials
    currentSelectedUnitId = id || null;
    for (const [unitId, mesh] of unitMeshesById.entries()) {
      const isSelected = id && unitId === id;
      const mat = mesh.material;
      if (mat && mat.isMaterial) {
        mat.emissive = new THREE.Color(isSelected ? 0x32d296 : 0x000000);
        mat.emissiveIntensity = isSelected ? 0.6 : 0.0;
      }
      mesh.scale.set(1, isSelected ? 1.1 : 1, 1);
    }
  }

  return { cleanup, resetView, setUnits, setResources, setSelectedUnitId, setTiles, setBase, applyGfxSettings, getGfxSettings };
}
