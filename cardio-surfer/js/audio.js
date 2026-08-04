// Tiny WebAudio blips. Must be unlocked from a user gesture on iOS.

let ctx = null;
let enabled = true;

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { enabled = false; return; }
  try {
    ctx = new AC();
    // Silent tick — iOS needs a node to actually start the graph.
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
  } catch { enabled = false; }
}

function tone(freq, dur, type = 'sine', gain = 0.14, slideTo = null) {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + dur + 0.02);
}

export const sfx = {
  coin:  () => tone(1180, 0.09, 'square', 0.07, 1760),
  jump:  () => tone(430, 0.13, 'triangle', 0.10, 760),
  roll:  () => tone(320, 0.13, 'sawtooth', 0.06, 180),
  lane:  () => tone(620, 0.05, 'sine', 0.05),
  hit:   () => tone(160, 0.28, 'sawtooth', 0.16, 60),
  over:  () => { tone(420, 0.2, 'triangle', 0.12, 300); setTimeout(() => tone(240, 0.45, 'triangle', 0.12, 110), 170); },
  go:    () => tone(880, 0.16, 'sine', 0.12, 1320),
  tick:  () => tone(660, 0.07, 'sine', 0.08),
};
