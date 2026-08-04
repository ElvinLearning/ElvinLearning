// Central tuning + world constants.
// Everything body-related is expressed in "torso units" (shoulder->hip distance)
// or "shoulder widths" so it works at any distance from the camera.

export const TUNING = {
  // Side-step: lateral hip offset, in shoulder-widths, needed to claim a lane.
  laneEnter: 0.55,
  laneExitRatio: 0.6,      // release threshold = laneEnter * this (hysteresis)

  // Jump: hip must rise this many torso-units AND both ankles must leave
  // the floor together (that's what separates a jump from a jog stride).
  jumpHipRise: 0.11,
  jumpFootRise: 0.045,
  jumpCooldownMs: 500,

  // Crouch: nose->ankle "stature" shrinks below this fraction of standing.
  crouchRatio: 0.85,
  crouchExitPad: 0.06,     // exit above crouchRatio + pad

  // Jog: signed knee-height difference must swing past +/- this to count a step.
  stepAmp: 0.055,

  // Cadence -> speed
  spmWindowMs: 4000,
  spmIdle: 60,             // below this you are "not really jogging"
  spmTarget: 150,          // full speed
  jogTimeoutMs: 1500,      // no steps for this long -> stall warning
  stallGraceMs: 5000,      // stall this long -> caught

  // Landmark confidence needed to trust a frame
  minVisibility: 0.5,
};

export const WORLD = {
  laneW: 0.30,        // lane spacing as fraction of screen width at z=0
  camF: 5.5,          // perspective focal length
  zSpawn: 46,
  zPlayer: 1.6,
  unitsPerSec: 9,     // world units/sec at speed 1.0
  speedMin: 0.45,
  speedMax: 1.30,
  gravity: 5.25,      // world-height units / s^2
  jumpV: 1.89,        // -> ~0.34 peak, ~0.72s airtime
  lives: 3,
  invulnMs: 1300,
  laneLerp: 11,       // how fast the avatar slides between lanes
};

// Heights in "ground-to-horizon" units at z=0.
export const SIZES = {
  barrier: 0.19,      // jump over
  beamBottom: 0.20,   // roll under
  beamTop: 0.46,
  block: 0.62,        // change lane
  coinY: 0.16,
  playerStand: 0.30,
  playerRoll: 0.13,
};

// Seconds between obstacle groups. A real side-step or jump costs the player
// most of a second, so spacing is measured in TIME, not distance — otherwise
// the game becomes physically impossible as soon as you speed up.
export const PACING = { gapEasy: 3.2, gapHard: 1.9, jitter: 0.45, rampMeters: 700 };

const KEY = 'cardiosurfer.tuning.v1';

export function loadTuning() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const k of Object.keys(saved)) {
      if (k in TUNING && typeof saved[k] === typeof TUNING[k]) TUNING[k] = saved[k];
    }
  } catch { /* ignore corrupt storage */ }
}

export function saveTuning() {
  try { localStorage.setItem(KEY, JSON.stringify(TUNING)); } catch { /* private mode */ }
}
