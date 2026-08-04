// Turns raw pose landmarks into game actions.
//
// Everything is measured against a calibration snapshot taken while the player
// stands still, and normalised by their own torso length / shoulder width, so
// the same thresholds work whether they're 5 ft or 12 ft from the phone.

import { TUNING } from './config.js';

const L = { NOSE: 0, SHO_L: 11, SHO_R: 12, HIP_L: 23, HIP_R: 24,
            KNEE_L: 25, KNEE_R: 26, ANK_L: 27, ANK_R: 28 };
const NEEDED = [L.NOSE, L.SHO_L, L.SHO_R, L.HIP_L, L.HIP_R, L.KNEE_L, L.KNEE_R, L.ANK_L, L.ANK_R];

// Landmarks come from an un-mirrored camera image; we flip x so that the
// player moving to *their* right increases x (matches the mirrored preview
// and the third-person game view).
function readFrame(lm) {
  const mx = (i) => 1 - lm[i].x;
  const y = (i) => lm[i].y;

  const shoMid = { x: (mx(L.SHO_L) + mx(L.SHO_R)) / 2, y: (y(L.SHO_L) + y(L.SHO_R)) / 2 };
  const hipMid = { x: (mx(L.HIP_L) + mx(L.HIP_R)) / 2, y: (y(L.HIP_L) + y(L.HIP_R)) / 2 };

  const torso = Math.abs(hipMid.y - shoMid.y);
  return {
    hipX: hipMid.x,
    hipY: hipMid.y,
    shoulderW: Math.max(Math.abs(mx(L.SHO_L) - mx(L.SHO_R)), 0.03),
    torso: Math.max(torso, 0.03),
    stature: Math.max(((y(L.ANK_L) + y(L.ANK_R)) / 2) - y(L.NOSE), 0.05),
    ankleL: y(L.ANK_L),
    ankleR: y(L.ANK_R),
    // Knee height measured *from the hip*, so it survives the player bobbing.
    kneeHL: (hipMid.y - y(L.KNEE_L)),
    kneeHR: (hipMid.y - y(L.KNEE_R)),
  };
}

function median(arr) {
  const a = [...arr].sort((p, q) => p - q);
  return a[Math.floor(a.length / 2)];
}

export class GestureEngine {
  constructor() {
    this.base = null;          // calibration snapshot
    this.samples = [];
    this.calibrating = false;

    this.reset();
  }

  reset() {
    this.lane = 0;
    this.crouching = false;
    this.airborne = false;
    this.lastJump = 0;
    this.stepSign = 0;
    this.stepTimes = [];
    this.totalSteps = 0;
    this.lastStepAt = 0;
    this.metrics = { lateral: 0, hipRise: 0, statureRatio: 1, kneeDiff: 0, spm: 0 };
    this.hasBody = false;
    this.events = [];          // drained by the game each tick
  }

  // ---- calibration -------------------------------------------------------
  beginCalibration() { this.samples = []; this.calibrating = true; }

  get calibrationSamples() { return this.samples.length; }

  finishCalibration() {
    this.calibrating = false;
    if (this.samples.length < 8) return false;
    const pick = (k) => median(this.samples.map((s) => s[k]));
    this.base = {
      hipX: pick('hipX'),
      hipY: pick('hipY'),
      shoulderW: pick('shoulderW'),
      torso: pick('torso'),
      stature: pick('stature'),
      ankleL: pick('ankleL'),
      ankleR: pick('ankleR'),
    };
    this.reset();
    return true;
  }

  // ---- per-frame ---------------------------------------------------------
  update(lm, now) {
    this.hasBody = !!lm && NEEDED.every((i) => lm[i] && (lm[i].visibility ?? 1) > TUNING.minVisibility);
    if (!this.hasBody) return;

    const f = readFrame(lm);
    if (this.calibrating) { this.samples.push(f); return; }
    if (!this.base) return;

    const b = this.base;
    const lateral = (f.hipX - b.hipX) / b.shoulderW;
    const hipRise = (b.hipY - f.hipY) / b.torso;
    const footRise = Math.min((b.ankleL - f.ankleL), (b.ankleR - f.ankleR)) / b.torso;
    const statureRatio = f.stature / b.stature;
    const kneeDiff = (f.kneeHL - f.kneeHR) / b.torso;

    this._lane(lateral);
    this._crouch(statureRatio);
    this._jump(hipRise, footRise, now);
    this._steps(kneeDiff, now);
    this._drift(f, lateral, hipRise, statureRatio);

    const spm = this._spm(now);
    this.metrics = { lateral, hipRise, footRise, statureRatio, kneeDiff, spm };
  }

  _lane(lateral) {
    const enter = TUNING.laneEnter;
    const exit = enter * TUNING.laneExitRatio;
    let next = this.lane;
    if (this.lane === 0) {
      if (lateral > enter) next = 1;
      else if (lateral < -enter) next = -1;
    } else if (this.lane === 1) {
      if (lateral < exit) next = lateral < -enter ? -1 : 0;
    } else {
      if (lateral > -exit) next = lateral > enter ? 1 : 0;
    }
    if (next !== this.lane) { this.lane = next; this.events.push('lane'); }
  }

  _crouch(ratio) {
    if (!this.crouching && ratio < TUNING.crouchRatio) {
      this.crouching = true;
      this.events.push('crouch');
    } else if (this.crouching && ratio > TUNING.crouchRatio + TUNING.crouchExitPad) {
      this.crouching = false;
    }
  }

  _jump(hipRise, footRise, now) {
    const ready = now - this.lastJump > TUNING.jumpCooldownMs;
    // Both feet up at once is what separates a jump from a jog stride.
    const lifted = hipRise > TUNING.jumpHipRise && footRise > TUNING.jumpFootRise;
    if (ready && !this.airborne && !this.crouching && lifted) {
      this.airborne = true;
      this.lastJump = now;
      this.events.push('jump');
    } else if (this.airborne && hipRise < TUNING.jumpHipRise * 0.5) {
      this.airborne = false;
    }
  }

  _steps(kneeDiff, now) {
    const amp = TUNING.stepAmp;
    let sign = 0;
    if (kneeDiff > amp) sign = 1;
    else if (kneeDiff < -amp) sign = -1;
    if (sign !== 0 && sign !== this.stepSign) {
      this.stepSign = sign;
      this.stepTimes.push(now);
      this.totalSteps++;
      this.lastStepAt = now;
      this.events.push('step');
    }
  }

  _spm(now) {
    const w = TUNING.spmWindowMs;
    while (this.stepTimes.length && now - this.stepTimes[0] > w) this.stepTimes.shift();
    if (this.stepTimes.length < 2) return 0;
    // Use the actual span covered so cadence ramps up quickly at the start.
    const span = Math.max(now - this.stepTimes[0], 900);
    return (this.stepTimes.length / span) * 60000;
  }

  // Slowly re-centre vertical baselines so posture drift doesn't poison
  // jump/crouch detection. Never adapts hipX — that would erase lane offsets.
  _drift(f, lateral, hipRise, statureRatio) {
    if (Math.abs(lateral) > 0.25) return;
    if (Math.abs(hipRise) > 0.06) return;
    if (statureRatio < 0.94 || statureRatio > 1.06) return;
    const a = 0.004;
    const b = this.base;
    b.hipY += (f.hipY - b.hipY) * a;
    b.stature += (f.stature - b.stature) * a;
    b.torso += (f.torso - b.torso) * a;
    b.ankleL += (f.ankleL - b.ankleL) * a;
    b.ankleR += (f.ankleR - b.ankleR) * a;
    b.shoulderW += (f.shoulderW - b.shoulderW) * a;
  }

  drainEvents() { const e = this.events; this.events = []; return e; }

  msSinceStep(now) { return this.lastStepAt ? now - this.lastStepAt : Infinity; }
}
