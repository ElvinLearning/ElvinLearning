// Glue: screens, camera bring-up, calibration, input mapping, HUD.

import { TUNING, loadTuning, saveTuning } from './config.js';
import { PoseTracker } from './pose.js';
import { GestureEngine } from './gestures.js';
import { Game } from './game.js';
import { unlockAudio, sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const screens = [...document.querySelectorAll('.screen')];

const video = $('video');
const skeleton = $('skeleton');
const badge = $('camBadge');

const game = new Game($('game'));
const gest = new GestureEngine();
const tracker = new PoseTracker(video, skeleton);

let mode = 'camera';          // 'camera' | 'touch'
let phase = 'title';          // title | setup | ready | playing | over
let touchLane = 0;
let touchLaneAt = -1e9;
let touchCrouchUntil = 0;
let touchEnabled = true;      // swipes stay live in camera mode as a safety net
let wakeLock = null;
let bestScore = Number(localStorage.getItem('cardiosurfer.best') || 0);

// ------------------------------------------------------------------ screens
function setScreen(id) {
  screens.forEach((s) => s.classList.toggle('active', s.id === id));
}
function setPhase(p) {
  phase = p;
  document.body.classList.toggle('menu', p === 'title');
  document.body.classList.toggle('setup', p === 'setup');
  $('hud').classList.toggle('hidden', p !== 'playing');
  $('gearBtn').classList.toggle('hidden', p === 'title' || p === 'setup');
  badge.classList.toggle('hide', mode === 'touch');
}
function fail(msg) {
  $('errMsg').textContent = msg;
  setScreen('scrError');
  setPhase('title');
}

// ------------------------------------------------------------------ startup
async function beginCamera() {
  unlockAudio();
  setScreen('scrSetup');
  setPhase('setup');
  $('setupStatus').textContent = 'Starting camera…';
  $('setupStatus').classList.remove('ok');
  $('calibBox').classList.add('hidden');
  tracker.fit = 'contain';

  try {
    await tracker.startCamera();
    $('setupStatus').textContent = 'Downloading the pose model (~10 MB, first time only)…';
    await tracker.loadModel();
  } catch (e) {
    tracker.stop();
    return fail(e.message || String(e));
  }

  tracker.onFrame = onPoseFrame;
  tracker.start();
  $('setupStatus').textContent = 'Step back until your whole body is in the box.';
  waitForBody();
}

function waitForBody() {
  let steady = 0;
  const tick = () => {
    if (phase !== 'setup') return;
    steady = gest.hasBody ? steady + 1 : 0;
    if (steady > 18) {
      $('setupStatus').textContent = 'Got you. Hold still…';
      $('setupStatus').classList.add('ok');
      runCalibration();
      return;
    }
    requestAnimationFrame(tick);
  };
  tick();
}

function runCalibration() {
  $('calibBox').classList.remove('hidden');
  $('calibRing').classList.remove('done');
  $('calibMsg').textContent = 'Stand still, arms relaxed';
  gest.beginCalibration();

  let n = 3;
  $('calibNum').textContent = n;
  sfx.tick();
  const iv = setInterval(() => {
    if (phase !== 'setup') { clearInterval(iv); gest.calibrating = false; return; }
    if (!gest.hasBody) {
      clearInterval(iv);
      $('setupStatus').textContent = 'Lost you — step back into frame.';
      $('setupStatus').classList.remove('ok');
      gest.calibrating = false;
      $('calibBox').classList.add('hidden');
      waitForBody();
      return;
    }
    n--;
    if (n > 0) { $('calibNum').textContent = n; sfx.tick(); return; }
    clearInterval(iv);
    if (!gest.finishCalibration()) {
      $('setupStatus').textContent = 'Calibration failed — try again with more of your body in view.';
      $('calibBox').classList.add('hidden');
      waitForBody();
      return;
    }
    $('calibRing').classList.add('done');
    $('calibNum').textContent = '✓';
    $('calibMsg').textContent = 'Calibrated';
    setTimeout(startCountdown, 500);
  }, 1000);
}

function startCountdown() {
  setScreen('scrReady');
  setPhase('ready');
  let n = 3;
  $('goNum').textContent = n;
  sfx.tick();
  const iv = setInterval(() => {
    n--;
    if (n > 0) { $('goNum').textContent = n; sfx.tick(); return; }
    if (n === 0) { $('goNum').textContent = 'GO'; sfx.go(); return; }
    clearInterval(iv);
    beginRun();
  }, 800);
}

function beginRun() {
  setScreen('');
  setPhase('playing');
  tracker.fit = 'cover';
  touchLane = 0;
  touchLaneAt = -1e9;
  touchCrouchUntil = 0;
  gest.reset();
  game.start(performance.now());
  requestWakeLock();
}

function endRun() {
  setPhase('over');
  const s = game.score;
  if (s > bestScore) { bestScore = s; localStorage.setItem('cardiosurfer.best', String(s)); }
  $('overTitle').textContent = game.lives <= 0 ? 'Wiped out' : 'Caught!';
  $('overReason').textContent = game.overReason || '';
  $('finalScore').textContent = s;
  $('finalDist').textContent = game.distance;
  const t = Math.floor(game.elapsed);
  $('finalTime').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  $('finalSteps').textContent = mode === 'camera' ? gest.totalSteps : '—';
  $('bestScore').textContent = bestScore;
  setScreen('scrOver');
  releaseWakeLock();
}

// ------------------------------------------------------------------ pose in
function onPoseFrame(lm) {
  gest.update(lm, performance.now());
  badge.textContent = gest.hasBody ? 'tracking' : 'no body';
  badge.classList.toggle('ok', gest.hasBody);
}

// ------------------------------------------------------------------ loop
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.06);
  last = now;

  if (phase === 'playing') {
    const camLane = mode === 'camera' && gest.base ? gest.lane : 0;
    const useTouch = mode === 'touch' || now - touchLaneAt < 2000;
    game.input.lane = useTouch ? touchLane : camLane;
    game.input.crouching = (mode === 'camera' && gest.crouching) || now < touchCrouchUntil;
    game.input.spm = gest.metrics.spm;
    game.input.msSinceStep = gest.msSinceStep(now);
    game.input.cadenceDriven = mode === 'camera';

    if (mode === 'camera') {
      for (const e of gest.drainEvents()) {
        if (e === 'jump') game.jump();
        else if (e === 'lane') sfx.lane();
        else if (e === 'crouch') sfx.roll();
      }
    } else {
      gest.drainEvents();
    }

    game.update(dt, now);
    updateHUD(now);
    if (game.state === 'over') endRun();
  } else {
    gest.drainEvents();
    game.update(dt, now);
  }

  game.render(now);
  if (debugOn) drawDebug();
}
requestAnimationFrame(loop);

// ------------------------------------------------------------------ HUD
let heartEls = [];
function buildHearts() {
  const box = $('hearts');
  box.innerHTML = '';
  heartEls = [];
  for (let i = 0; i < 3; i++) {
    const d = document.createElement('div');
    d.className = 'heart';
    box.appendChild(d);
    heartEls.push(d);
  }
}
buildHearts();

function updateHUD(now) {
  $('score').textContent = game.score;
  const spm = Math.round(game.input.spm);
  $('spm').textContent = mode === 'camera' ? spm : '—';
  heartEls.forEach((el, i) => el.classList.toggle('gone', i >= game.lives));

  const k = Math.max(0, Math.min(1, (spm - TUNING.spmIdle) / (TUNING.spmTarget - TUNING.spmIdle)));
  $('cadenceFill').style.width = (mode === 'camera' ? k * 100 : 100) + '%';
  $('stallWarn').classList.toggle('hidden', !game.stalling);

  const lane = game.input.lane;
  $('chipL').classList.toggle('on', lane < -0.5);
  $('chipC').classList.toggle('on', Math.abs(lane) <= 0.5);
  $('chipR').classList.toggle('on', lane > 0.5);
  $('chipJump').classList.toggle('on', game.py > 0.001);
  $('chipRoll').classList.toggle('on', game.rolling);
}

// ------------------------------------------------------------------ debug
let debugOn = false;
function drawDebug() {
  const m = gest.metrics;
  $('debug').textContent =
    `fps ${tracker.fps}  ${tracker.delegate || '-'}\n` +
    `body ${gest.hasBody ? 'yes' : 'NO'}  cal ${gest.base ? 'yes' : 'no'}\n` +
    `lateral ${m.lateral?.toFixed(2)}  lane ${gest.lane}\n` +
    `hipRise ${m.hipRise?.toFixed(3)}  foot ${(m.footRise ?? 0).toFixed(3)}\n` +
    `stature ${m.statureRatio?.toFixed(3)}  crouch ${gest.crouching}\n` +
    `kneeDiff ${m.kneeDiff?.toFixed(3)}  spm ${Math.round(m.spm || 0)}\n` +
    `speed ${game.speed.toFixed(2)}  obj ${game.objects.length}`;
}

// ------------------------------------------------------------------ touch
function enterTouchMode() {
  unlockAudio();
  mode = 'touch';
  tracker.stop();
  $('camWrap').classList.add('hidden');
  startCountdown();
}

const touchLive = () => phase === 'playing' && (mode === 'touch' || touchEnabled);

let ptr = null;
addEventListener('pointerdown', (e) => {
  if (!touchLive()) return;
  ptr = { x: e.clientX, y: e.clientY, t: performance.now() };
}, { passive: true });

addEventListener('pointerup', (e) => {
  if (!ptr || !touchLive()) return;
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
  ptr = null;
  if (Math.abs(dx) < 26 && Math.abs(dy) < 26) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    touchLane = Math.max(-1, Math.min(1, touchLane + (dx > 0 ? 1 : -1)));
    touchLaneAt = performance.now();
    sfx.lane();
  } else if (dy < 0) {
    game.jump();
  } else {
    touchCrouchUntil = performance.now() + 650;
    sfx.roll();
  }
}, { passive: true });

addEventListener('keydown', (e) => {
  if (phase !== 'playing') return;
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a') { touchLane = Math.max(-1, touchLane - 1); touchLaneAt = performance.now(); }
  else if (k === 'ArrowRight' || k === 'd') { touchLane = Math.min(1, touchLane + 1); touchLaneAt = performance.now(); }
  else if (k === 'ArrowUp' || k === 'w' || k === ' ') game.jump();
  else if (k === 'ArrowDown' || k === 's') touchCrouchUntil = performance.now() + 650;
});

// ------------------------------------------------------------------ wake lock
async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* unsupported */ }
}
function releaseWakeLock() { try { wakeLock?.release(); } catch { /* noop */ } wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && phase === 'playing') requestWakeLock();
});

// ------------------------------------------------------------------ tuner UI
loadTuning();
const sliders = [
  ['tLane', 'oLane', 'laneEnter', (v) => v.toFixed(2)],
  ['tJump', 'oJump', 'jumpHipRise', (v) => v.toFixed(2)],
  ['tCrouch', 'oCrouch', 'crouchRatio', (v) => v.toFixed(2)],
  ['tStep', 'oStep', 'stepAmp', (v) => v.toFixed(3)],
];
for (const [sid, oid, key, fmt] of sliders) {
  const el = $(sid);
  el.value = TUNING[key];
  $(oid).textContent = fmt(TUNING[key]);
  el.addEventListener('input', () => {
    TUNING[key] = Number(el.value);
    $(oid).textContent = fmt(TUNING[key]);
    saveTuning();
  });
}
$('tDebug').addEventListener('change', (e) => {
  debugOn = e.target.checked;
  $('debug').classList.toggle('hidden', !debugOn);
});
$('tTouch').checked = true;
$('tTouch').addEventListener('change', (e) => {
  touchEnabled = e.target.checked;
  if (!touchEnabled) { touchLaneAt = 0; touchCrouchUntil = 0; }
});
$('gearBtn').onclick = () => $('tuner').classList.remove('hidden');
$('tunerClose').onclick = () => $('tuner').classList.add('hidden');
$('btnRecal').onclick = () => {
  $('tuner').classList.add('hidden');
  if (mode !== 'camera') return;
  game.state = 'idle';
  tracker.fit = 'contain';
  setScreen('scrSetup');
  setPhase('setup');
  $('setupStatus').textContent = 'Step back into frame.';
  $('calibBox').classList.add('hidden');
  waitForBody();
};

// ------------------------------------------------------------------ buttons
$('btnStart').onclick = beginCamera;
$('btnTouch').onclick = enterTouchMode;
$('btnErrTouch').onclick = enterTouchMode;
$('btnRetry').onclick = beginCamera;
$('btnBack').onclick = () => { tracker.stop(); setScreen('scrTitle'); setPhase('title'); };
$('btnAgain').onclick = () => {
  if (mode === 'camera' && !gest.base) return beginCamera();
  startCountdown();
};
$('btnMenu').onclick = () => { setScreen('scrTitle'); setPhase('title'); };

setPhase('title');
$('bestScore').textContent = bestScore;
