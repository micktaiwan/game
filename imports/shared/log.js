let DEBUG_FLAGS = {
  sim: false,
  gfx: false,
};

export function setDebugFlags(next) {
  DEBUG_FLAGS = { ...DEBUG_FLAGS, ...(next || {}) };
}

export function dlogSim(...args) {
  if (DEBUG_FLAGS.sim) console.log('[SIM]', ...args);
}

export function dlogGfx(...args) {
  if (DEBUG_FLAGS.gfx) console.log('[GFX]', ...args);
}

export function getDebugFlags() {
  return { ...DEBUG_FLAGS };
}


