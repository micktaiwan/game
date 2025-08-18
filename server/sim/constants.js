// Centralized server-side simulation constants

export const MOVE_PERIOD_MS = 1100;      // per-step throttle for units
export const HARVEST_ANIM_MS = 900;      // hold duration for harvest completion
export const BUILD_TIME_MS = 1200;       // hold duration after creating a new tile (Explore)
export const SERVER_TICK_MS = 500;       // server simulation tick interval

// Costs and thresholds
export const MOVE_COST = 1;              // energy per step
export const EXPLORE_BUILD_COST = 10;    // energy to create a new tile during explore

export const PATH_FAIL_MAX_TICKS = 6;    // after N path failures, switch to Idle
export const BUILD_BLOCK_MAX_TICKS = 6;  // after N energy blocks while building, switch to Idle

// Debug flags
export const DEBUG_MOVE = false;


