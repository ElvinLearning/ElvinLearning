// Feed the gesture engine synthetic skeletons and check that each intended
// move fires exactly once, and that jogging never fakes a jump/lane/crouch.

const { GestureEngine } = await import('../js/gestures.js');
const { TUNING } = await import('../js/config.js');

const BASE = { nose: 0.15, sho: 0.25, hip: 0.50, knee: 0.70, ank: 0.90 };
const SHOULDER_W = 0.12, HIP_W = 0.09;
let noiseAmp = 0.004;                       // ~MediaPipe landmark jitter
let rngState = 12345;
function rnd() { rngState = (rngState * 1103515245 + 12345) & 0x7fffffff; return rngState / 0x7fffffff; }
const jit = () => (rnd() - 0.5) * 2 * noiseAmp;

// cx is the RAW image x of the body centre. The engine mirrors x, so the user
// stepping to their own right means cx DECREASES.
function skeleton({ cx = 0.5, lift = 0, crouch = 0, phase = null }) {
  const c = crouch;
  let noseY = BASE.nose + 0.15 * c;
  let shoY = BASE.sho + 0.13 * c;
  let hipY = BASE.hip + 0.10 * c;
  let kneeY = BASE.knee + 0.02 * c;
  let ankY = BASE.ank;

  let kL = 0, kR = 0, aL = 0, aR = 0;
  if (phase !== null) {
    const A = 0.05;
    kL = Math.max(0, Math.sin(phase)) * A;
    kR = Math.max(0, Math.sin(phase + Math.PI)) * A;
    aL = kL * 1.2; aR = kR * 1.2;
    const bob = 0.008 * Math.sin(2 * phase);   // hips bob while jogging
    hipY -= bob; shoY -= bob; noseY -= bob;
  }
  noseY -= lift; shoY -= lift; hipY -= lift; kneeY -= lift; ankY -= lift;
  aL += lift ? 0 : 0;

  const p = (x, y) => ({ x: x + jit(), y: y + jit(), z: 0, visibility: 0.92 });
  const lm = Array.from({ length: 33 }, () => p(cx, hipY));
  lm[0] = p(cx, noseY);
  lm[11] = p(cx + SHOULDER_W / 2, shoY);
  lm[12] = p(cx - SHOULDER_W / 2, shoY);
  lm[23] = p(cx + HIP_W / 2, hipY);
  lm[24] = p(cx - HIP_W / 2, hipY);
  lm[25] = p(cx + HIP_W / 2, kneeY - kL);
  lm[26] = p(cx - HIP_W / 2, kneeY - kR);
  lm[27] = p(cx + HIP_W / 2, ankY - aL - (lift ? 0 : 0));
  lm[28] = p(cx - HIP_W / 2, ankY - aR);
  return lm;
}

const FPS = 30, DT = 1000 / FPS;
let t = 0;

function run(engine, seconds, frameFn) {
  const tally = { jump: 0, lane: 0, crouch: 0, step: 0 };
  const n = Math.round(seconds * FPS);
  for (let i = 0; i < n; i++) {
    t += DT;
    engine.update(skeleton(frameFn(i / FPS, i)), t);
    for (const e of engine.drainEvents()) tally[e] = (tally[e] || 0) + 1;
  }
  return tally;
}

const g = new GestureEngine();

// ---- calibrate on a still stand
g.beginCalibration();
run(g, 3, () => ({}));
console.log('calibrated:', g.finishCalibration(), '| samples used:', g.calibrationSamples);

const results = [];
const check = (name, pass, detail) => { results.push({ name, pass, detail }); };

// ---- 1. stand still: nothing should fire
let r = run(g, 4, () => ({}));
check('idle: no phantom jumps', r.jump === 0, `jumps=${r.jump}`);
check('idle: no phantom lane changes', r.lane === 0, `lane=${r.lane}`);
check('idle: no phantom crouch', r.crouch === 0, `crouch=${r.crouch}`);
check('idle: no phantom steps', r.step === 0, `steps=${r.step}`);

// ---- 2. jog in place at 150 spm for 6s
g.reset();
const SPM = 150, hz = SPM / 60 / 2;          // one full leg cycle = 2 steps
r = run(g, 6, (s) => ({ phase: 2 * Math.PI * hz * s }));
const spmRead = g.metrics.spm;
check('jog: steps counted', Math.abs(r.step - 15) <= 2, `steps=${r.step} (expected ~15)`);
check('jog: cadence reads back', Math.abs(spmRead - SPM) < 25, `spm=${spmRead.toFixed(0)} (expected ~${SPM})`);
check('jog: does NOT fake a jump', r.jump === 0, `jumps=${r.jump}`);
check('jog: does NOT fake a lane change', r.lane === 0, `lane=${r.lane}`);
check('jog: does NOT fake a crouch', r.crouch === 0, `crouch=${r.crouch}`);

// ---- 3. slow shuffle (60 spm) should read as slow, not zero
g.reset();
r = run(g, 6, (s) => ({ phase: 2 * Math.PI * (60 / 120) * s }));
check('slow jog registers', r.step >= 4, `steps=${r.step}`);
check('slow jog reads low cadence', g.metrics.spm > 30 && g.metrics.spm < 95, `spm=${g.metrics.spm.toFixed(0)}`);

// ---- 4. side-step right, hold, return to centre
g.reset();
const lanes = [];
const stepOver = 0.075;                       // ~0.62 shoulder-widths
run(g, 3.0, (s) => {
  let cx = 0.5;
  if (s > 0.5 && s < 2.0) cx = 0.5 - stepOver;   // mirrored: user's right
  lanes.push(g.lane);
  return { cx, phase: 2 * Math.PI * hz * s };
});
check('side-step right claims right lane', lanes.includes(1), `lanes seen: ${[...new Set(lanes)]}`);
check('returns to centre', g.lane === 0, `final lane=${g.lane}`);
check('never flipped to the wrong lane', !lanes.includes(-1), `lanes seen: ${[...new Set(lanes)]}`);

// ---- 5. side-step left
g.reset();
const lanesL = [];
run(g, 3.0, (s) => {
  let cx = 0.5;
  if (s > 0.5 && s < 2.0) cx = 0.5 + stepOver;
  lanesL.push(g.lane);
  return { cx, phase: 2 * Math.PI * hz * s };
});
check('side-step left claims left lane', lanesL.includes(-1), `lanes seen: ${[...new Set(lanesL)]}`);

// ---- 6. a single jump while jogging
g.reset();
r = run(g, 4, (s) => {
  const phase = 2 * Math.PI * hz * s;
  // one hop between t=1.5s and t=2.1s
  let lift = 0;
  if (s > 1.5 && s < 2.1) {
    const u = (s - 1.5) / 0.6;
    lift = Math.sin(u * Math.PI) * 0.055;
  }
  return { phase: lift > 0 ? null : phase, lift };
});
check('jump fires exactly once', r.jump === 1, `jumps=${r.jump}`);

// ---- 7. three jumps in a row
g.reset();
r = run(g, 6, (s) => {
  let lift = 0;
  for (const at of [1.0, 2.6, 4.2]) {
    if (s > at && s < at + 0.6) lift = Math.sin(((s - at) / 0.6) * Math.PI) * 0.055;
  }
  return { lift, phase: lift > 0 ? null : 2 * Math.PI * hz * s };
});
check('three jumps -> three events', r.jump === 3, `jumps=${r.jump}`);

// ---- 8. crouch and stand back up
g.reset();
r = run(g, 4, (s) => {
  let crouch = 0;
  if (s > 1.0 && s < 2.2) crouch = 1;
  return { crouch, phase: crouch ? null : 2 * Math.PI * hz * s };
});
check('crouch fires exactly once', r.crouch === 1, `crouch=${r.crouch}`);
check('crouch releases on standing', g.crouching === false, `crouching=${g.crouching}`);

// ---- 9. body leaves frame
g.reset();
g.update(null, (t += DT));
check('handles missing body', g.hasBody === false, `hasBody=${g.hasBody}`);
const lowVis = skeleton({}); lowVis.forEach((p) => (p.visibility = 0.1));
g.update(lowVis, (t += DT));
check('handles low-confidence landmarks', g.hasBody === false, `hasBody=${g.hasBody}`);

// ---- 10. distance invariance: same moves further from the camera
{
  const far = new GestureEngine();
  const shrink = 0.55;                         // person appears 55% the size
  const orig = { ...BASE };
  const mid = 0.5;
  const scaleSkel = (s) => {
    const lm = skeleton(s);
    return lm.map((p) => ({ ...p, x: mid + (p.x - mid) * shrink, y: 0.5 + (p.y - 0.5) * shrink }));
  };
  far.beginCalibration();
  for (let i = 0; i < 90; i++) { t += DT; far.update(scaleSkel({}), t); }
  far.finishCalibration();
  let jumps = 0, lanesFar = new Set();
  for (let i = 0; i < 150; i++) {
    const s = i / FPS; t += DT;
    let lift = 0;
    if (s > 1.0 && s < 1.6) lift = Math.sin(((s - 1.0) / 0.6) * Math.PI) * 0.055;
    const cx = s > 2.5 && s < 4.0 ? 0.5 - 0.075 : 0.5;
    far.update(scaleSkel({ lift, cx, phase: lift > 0 ? null : 2 * Math.PI * hz * s }), t);
    for (const e of far.drainEvents()) { if (e === 'jump') jumps++; }
    lanesFar.add(far.lane);
  }
  check('works at a different camera distance', jumps === 1 && lanesFar.has(1),
    `jumps=${jumps} lanes=${[...lanesFar]}`);
  Object.assign(BASE, orig);
}

// ---- report
let failed = 0;
for (const { name, pass, detail } of results) {
  if (!pass) failed++;
  console.log(`${pass ? ' ok ' : 'FAIL'}  ${name.padEnd(42)} ${detail}`);
}
console.log(`\n${results.length - failed}/${results.length} passed` + (failed ? '  <<<' : ''));
process.exit(failed ? 1 : 0);
