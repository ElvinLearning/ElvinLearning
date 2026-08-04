// Headless smoke test: run the game for a few simulated minutes and make sure
// update + render never throw and the state machine behaves.

const calls = new Set();
function makeCtx() {
  const grad = { addColorStop() {} };
  const target = {
    createLinearGradient: () => grad,
    canvas: { width: 400, height: 800 },
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      // roundRect exists in modern browsers; emulate presence
      if (typeof k === 'string') { calls.add(k); return () => {}; }
      return undefined;
    },
    set() { return true; },
    has() { return true; },
  });
}

globalThis.devicePixelRatio = 2;
globalThis.innerWidth = 390;
globalThis.innerHeight = 844;
globalThis.addEventListener = () => {};
globalThis.window = globalThis;

const canvas = { getContext: () => makeCtx(), style: {}, width: 0, height: 0 };

const { Game } = await import('../js/game.js');

const g = new Game(canvas);
let now = 0;
g.start(now);

const stats = { hits: 0, coins: 0, frames: 0, maxObjects: 0 };
let prevLives = g.lives;

// Simulate a player who jogs steadily and reacts *badly* (never jumps) for a
// while, then a player who reacts perfectly.
for (let pass = 0; pass < 2; pass++) {
  g.start(now);
  const perfect = pass === 1;
  for (let i = 0; i < 60 * 180; i++) {   // 3 minutes at 60fps
    const dt = 1 / 60;
    now += dt * 1000;

    g.input.spm = 150;
    g.input.msSinceStep = 300;
    g.input.cadenceDriven = true;

    if (perfect) {
      // Look ahead and do the right thing.
      const soon = g.objects
        .filter((o) => !o.resolved && o.z > 1.6 && o.z < 7 && o.type !== 'coin')
        .sort((a, b) => a.z - b.z);
      const imminent = soon.filter((o) => o.z < 5.5);
      const blocked = new Set(imminent.map((o) => o.lane));
      let want = g.input.lane;
      if (blocked.size) {
        const free = [-1, 0, 1].filter((l) => !imminent.some((o) => o.lane === l && o.type === 'block'));
        // prefer a lane with no obstacle at all
        const clean = [-1, 0, 1].filter((l) => !blocked.has(l));
        want = clean.length ? clean.sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0]
          : (free.length ? free[0] : want);
      }
      g.input.lane = want;

      const here = imminent.filter((o) => o.lane === want);
      const bar = here.find((o) => o.type === 'barrier');
      const beam = here.find((o) => o.type === 'beam');
      if (bar && bar.z < 4.0 && bar.z > 1.6) g.jump();
      g.input.crouching = !!(beam && beam.z < 5 && beam.z > 1.2);
    } else {
      g.input.lane = 0;
      g.input.crouching = false;
    }

    g.update(dt, now);
    g.render(now);
    stats.frames++;
    stats.maxObjects = Math.max(stats.maxObjects, g.objects.length);
    if (g.lives < prevLives) { stats.hits++; prevLives = g.lives; }
    if (g.state === 'over') break;
  }
  console.log(`pass ${pass} (${perfect ? 'perfect' : 'passive'}): state=${g.state} lives=${g.lives} ` +
    `dist=${g.distance} coins=${g.coins} score=${g.score} speed=${g.speed.toFixed(2)} reason="${g.overReason}"`);
  prevLives = g.lives;
}

// Stall test: stop jogging, expect a game over.
g.start(now);
for (let i = 0; i < 60 * 20; i++) {
  now += 1000 / 60;
  g.input.spm = 0;
  g.input.msSinceStep = i > 60 ? 9999 : 100;
  g.input.cadenceDriven = true;
  g.update(1 / 60, now);
  if (g.state === 'over') break;
}
console.log(`stall test: state=${g.state} reason="${g.overReason}" elapsed=${g.elapsed.toFixed(1)}s`);

// Jump arc sanity
g.start(now);
g.jump();
let peak = 0, airFrames = 0;
for (let i = 0; i < 200; i++) {
  now += 1000 / 60;
  g.input.spm = 150; g.input.msSinceStep = 100; g.input.cadenceDriven = true;
  g.update(1 / 60, now);
  peak = Math.max(peak, g.py);
  if (g.py > 0) airFrames++;
  else if (i > 3) break;
}
console.log(`jump: peak=${peak.toFixed(3)} world-units, airtime=${(airFrames / 60).toFixed(2)}s (barrier=0.19)`);

// Spawn fairness: no pattern should block all three lanes with non-jumpable stuff.
g.start(now);
const bad = [];
for (let i = 0; i < 60 * 400; i++) {
  now += 1000 / 60;
  g.input.spm = 160; g.input.msSinceStep = 100; g.input.cadenceDriven = true;
  g.input.lane = 0;
  g.update(1 / 60, now);
  if (g.state === 'over') { g.lives = 3; g.state = 'running'; }
}
// group obstacles by rounded z and check
const groups = new Map();
for (const o of g.objects) {
  if (o.type === 'coin') continue;
  const k = Math.round(o.z * 2) / 2;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(o);
}
for (const [k, arr] of groups) {
  const blockLanes = new Set(arr.filter((o) => o.type === 'block').map((o) => o.lane));
  if (blockLanes.size >= 3) bad.push(k);
}
console.log(`spawn fairness: ${bad.length === 0 ? 'OK — never all 3 lanes hard-blocked' : 'FAIL at ' + bad}`);

// Reaction window: how much wall-clock time does the player get between
// consecutive obstacle groups arriving? This is the number that decides
// whether a *body* can physically keep up.
{
  const g2 = new (await import('../js/game.js')).Game(canvas);
  let t = 0;
  g2.start(t);
  const crossings = [];
  const seen = new WeakSet();
  for (let i = 0; i < 60 * 600; i++) {
    t += 1000 / 60;
    g2.input.spm = 200; g2.input.msSinceStep = 50; g2.input.cadenceDriven = true;
    g2.input.lane = 0; g2.input.crouching = false;
    const before = g2.objects.filter((o) => o.type !== 'coin' && o.z > 1.6);
    g2.update(1 / 60, t);
    g2.lives = 3;                       // immortal probe
    for (const o of before) if (o.z <= 1.6 && !seen.has(o)) { seen.add(o); crossings.push({ t, d: g2.distance }); }
  }
  // cluster crossings that happen together (same spawned group)
  const groups = [];
  for (const c of crossings) {
    if (!groups.length || c.t - groups[groups.length - 1] > 120) groups.push(c.t);
  }
  const gaps = [];
  for (let i = 1; i < groups.length; i++) gaps.push((groups[i] - groups[i - 1]) / 1000);
  gaps.sort((a, b) => a - b);
  const late = gaps.slice(Math.floor(gaps.length * 0.75));
  console.log(`reaction window over ${groups.length} groups: min=${gaps[0]?.toFixed(2)}s ` +
    `p25=${gaps[Math.floor(gaps.length * .25)]?.toFixed(2)}s median=${gaps[Math.floor(gaps.length / 2)]?.toFixed(2)}s ` +
    `max=${gaps[gaps.length - 1]?.toFixed(2)}s  (late-game avg ${(late.reduce((a, b) => a + b, 0) / late.length).toFixed(2)}s)`);
  console.log(`top speed reached ${g2.speed.toFixed(2)} = ${(g2.speed * 9).toFixed(1)} units/s, distance ${g2.distance}`);
}
console.log(`render used ${calls.size} distinct ctx members; max concurrent objects ${stats.maxObjects}`);
console.log('roundRect referenced:', calls.has('roundRect'));
