export function installInputHandlers(renderer, camera, state, updateCamera, drag) {
  // drag: { active, mode, lastX, lastY }

  function onPointerDown(e) {
    drag.active = true;
    drag.mode = (e.shiftKey || e.button === 2) ? 'orbit' : 'pan';
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    renderer.domElement.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!drag.active) return;
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    if (drag.mode === 'pan') {
      const distance = state.radius;
      const worldPerPixel = (2 * Math.tan((camera.fov * Math.PI / 180) / 2) * distance) / renderer.domElement.clientHeight;
      const cosTheta = Math.cos(state.azimuth);
      const sinTheta = Math.sin(state.azimuth);
      const right = { x: -sinTheta, z: cosTheta };
      const forward = { x: -cosTheta, z: -sinTheta };
      state.target.x += right.x * dx * worldPerPixel + forward.x * dy * worldPerPixel;
      state.target.z += right.z * dx * worldPerPixel + forward.z * dy * worldPerPixel;
      updateCamera();
    } else {
      const orbitSpeed = 0.005;
      state.azimuth += dx * orbitSpeed;
      state.polar -= dy * orbitSpeed;
      const minPolar = 0.35;
      const maxPolar = 1.35;
      state.polar = Math.max(minPolar, Math.min(maxPolar, state.polar));
      updateCamera();
    }
  }

  function onPointerUp(e) {
    drag.active = false;
    renderer.domElement.releasePointerCapture(e.pointerId);
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: true });
  renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: true });
  renderer.domElement.addEventListener('pointerup', onPointerUp, { passive: true });

  return () => {
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
  };
}

