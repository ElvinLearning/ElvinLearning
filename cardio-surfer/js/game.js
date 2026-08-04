// Endless 3-lane runner. Pure canvas 2D with a fake-perspective projection.

import { WORLD as W, SIZES as S, TUNING, PACING as P } from './config.js';
import { sfx } from './audio.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

export class Game {
  constructor(canvas) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.dpr = 1; this.w = 0; this.h = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 300));

    // Input surface written by main.js each frame.
    this.input = { lane: 0, crouching: false, spm: 0, msSinceStep: Infinity, cadenceDriven: true };
    this.reset();
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = innerWidth, h = innerHeight;
    this.dpr = dpr; this.w = w; this.h = h;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + 'px';
    this.cv.style.height = h + 'px';
    this.horizon = h * 0.42;
    this.unit = h - this.horizon;
  }

  reset() {
    this.state = 'idle';           // idle | running | over
    this.objects = [];
    this.particles = [];
    this.playerLane = 0;
    this.playerX = 0;              // smoothed lane position
    this.py = 0;                   // height above ground, world units
    this.vy = 0;
    this.rolling = false;
    this.lives = W.lives;
    this.invulnUntil = 0;
    this.speed = W.speedMin;
    this.traveled = 0;
    this.coins = 0;
    this.startedAt = 0;
    this.elapsed = 0;
    this.nextSpawn = 20;
    this.runPhase = 0;
    this.shake = 0;
    this.stalling = false;
    this.stallSince = 0;
    this.overReason = '';
    this.scenery = Array.from({ length: 26 }, (_, i) => ({ z: i * 2.1, side: i % 2 ? 1 : -1 }));
  }

  start(now) {
    this.reset();
    this.state = 'running';
    this.startedAt = now;
  }

  get score() { return Math.floor(this.traveled) + this.coins * 10; }
  get distance() { return Math.floor(this.traveled); }

  // ---------------------------------------------------------------- update
  update(dt, now) {
    dt = Math.min(dt, 0.05);
    if (this.state !== 'running') { this._particles(dt); return; }

    this.elapsed = (now - this.startedAt) / 1000;

    // ---- speed from cadence
    const t = this.input;
    if (t.cadenceDriven) {
      const k = clamp((t.spm - TUNING.spmIdle) / (TUNING.spmTarget - TUNING.spmIdle), 0, 1);
      const target = lerp(W.speedMin, W.speedMax, k);
      this.speed += (target - this.speed) * Math.min(1, dt * 2.2);

      const idle = t.msSinceStep > TUNING.jogTimeoutMs;
      if (idle && !this.stalling) { this.stalling = true; this.stallSince = now; }
      if (!idle) this.stalling = false;
      if (this.stalling && now - this.stallSince > TUNING.stallGraceMs) {
        return this.gameOver('The guard caught you — keep those feet moving!');
      }
    } else {
      const target = lerp(W.speedMin + 0.5, W.speedMax, clamp(this.elapsed / 70, 0, 1));
      this.speed += (target - this.speed) * Math.min(1, dt * 0.8);
      this.stalling = false;
    }

    const move = this.speed * W.unitsPerSec * dt;
    this.traveled += move;
    this.runPhase += dt * (3 + this.speed * 7);
    this.shake = Math.max(0, this.shake - dt * 3.4);

    // ---- player
    this.playerLane = clamp(t.lane, -1, 1);
    this.playerX = lerp(this.playerX, this.playerLane, Math.min(1, dt * W.laneLerp));

    this.rolling = t.crouching && this.py <= 0.001;
    if (this.py > 0 || this.vy > 0) {
      this.vy -= W.gravity * dt;
      this.py += this.vy * dt;
      if (this.py <= 0) { this.py = 0; this.vy = 0; }
    }

    // ---- world
    for (const o of this.objects) {
      o.pz = o.z;
      o.z -= move;
    }
    for (const s of this.scenery) {
      s.z -= move;
      if (s.z < -3) s.z += 26 * 2.1;
    }

    this._collide(now);
    this.objects = this.objects.filter((o) => o.z > -4 && !o.gone);

    // ---- spawn (gap held constant in seconds of reaction time)
    const diff = clamp(this.traveled / P.rampMeters, 0, 1);
    while (this.traveled + W.zSpawn > this.nextSpawn) {
      this._spawn(this.nextSpawn - this.traveled, diff);
      const secs = lerp(P.gapEasy, P.gapHard, diff) * (1 + (Math.random() - 0.5) * P.jitter);
      // Priced at top speed: `secs` then becomes the *floor* on reaction time.
      // Jog slower and the same spacing simply arrives further apart.
      this.nextSpawn += secs * W.speedMax * W.unitsPerSec;
    }

    this._particles(dt);
  }

  _collide(now) {
    const invuln = now < this.invulnUntil;
    for (const o of this.objects) {
      if (o.gone || o.resolved) continue;
      if (!(o.pz > W.zPlayer && o.z <= W.zPlayer)) continue;
      o.resolved = true;
      if (Math.abs(o.lane - this.playerX) > 0.5) continue;

      if (o.type === 'coin') {
        o.gone = true;
        this.coins++;
        sfx.coin();
        this._burst(o.lane, S.coinY, '#ffd54a', 8);
        continue;
      }
      if (invuln) continue;

      let hit = false;
      if (o.type === 'barrier') hit = this.py < S.barrier;
      else if (o.type === 'beam') hit = !this.rolling;
      else if (o.type === 'block') hit = true;

      if (hit) {
        this.lives--;
        this.shake = 1;
        this.invulnUntil = now + W.invulnMs;
        sfx.hit();
        this._burst(o.lane, 0.25, '#ff5d8f', 16);
        this.speed = Math.max(W.speedMin, this.speed * 0.55);
        o.gone = true;
        if (this.lives <= 0) {
          const how = o.type === 'barrier' ? 'Jump higher next time.'
            : o.type === 'beam' ? 'That one needed a crouch.'
              : 'Side-step out of the way!';
          return this.gameOver(how);
        }
      }
    }
  }

  _spawn(zOff, diff) {
    const z = W.zSpawn + zOff;
    const lanes = [-1, 0, 1];
    const pick = () => lanes[(Math.random() * 3) | 0];
    const r = Math.random();

    const add = (type, lane, zz) => this.objects.push({ type, lane, z: zz, pz: zz + 1, resolved: false, gone: false, seed: Math.random() });
    const coinRun = (lane, zz, n = 5) => { for (let i = 0; i < n; i++) add('coin', lane, zz + i * 1.25); };

    if (r < 0.20) {
      coinRun(pick(), z, 4 + ((Math.random() * 4) | 0));
    } else if (r < 0.42) {
      const l = pick(); add('barrier', l, z);
      if (Math.random() < 0.5) coinRun(l, z + 2.4, 3);
    } else if (r < 0.62) {
      add('beam', pick(), z);
    } else if (r < 0.80) {
      const l = pick(); add('block', l, z);
      const free = lanes.filter((x) => x !== l);
      if (Math.random() < 0.6) coinRun(free[(Math.random() * free.length) | 0], z, 4);
    } else if (r < 0.92 && diff > 0.25) {
      // Two blocked lanes — one guaranteed gap.
      const open = pick();
      for (const l of lanes) if (l !== open) add(Math.random() < 0.5 ? 'block' : 'barrier', l, z);
      coinRun(open, z, 3);
    } else if (diff > 0.45) {
      // Barrier wall you must jump, coins overhead as the reward.
      for (const l of lanes) add('barrier', l, z);
      coinRun(pick(), z + 1.6, 3);
    } else {
      add('barrier', pick(), z);
    }
  }

  jump() {
    if (this.state !== 'running') return;
    if (this.py > 0.001) return;
    this.vy = W.jumpV;
    this.py = 0.001;
    sfx.jump();
  }

  gameOver(reason) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.overReason = reason;
    this.shake = 1.2;
    sfx.over();
  }

  // ------------------------------------------------------------- particles
  _burst(lane, h, color, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        lane: lane + (Math.random() - 0.5) * 0.3,
        h: h + (Math.random() - 0.5) * 0.12,
        z: W.zPlayer,
        vx: (Math.random() - 0.5) * 1.4,
        vh: Math.random() * 1.1,
        life: 1, color,
      });
    }
  }

  _particles(dt) {
    for (const p of this.particles) {
      p.life -= dt * 1.9;
      p.lane += p.vx * dt;
      p.vh -= 3.2 * dt;
      p.h = Math.max(0, p.h + p.vh * dt);
      p.z -= dt * 2;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  // ---------------------------------------------------------------- render
  scaleAt(z) { return W.camF / (Math.max(z, -W.camF + 0.4) + W.camF); }
  xAt(lane, z) { return this.w / 2 + lane * W.laneW * this.w * this.scaleAt(z); }
  yAt(z, h = 0) {
    const s = this.scaleAt(z);
    return this.horizon + this.unit * s - h * this.unit * s;
  }

  render(now) {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sh = this.shake;
    if (sh > 0) {
      g.translate((Math.random() - 0.5) * 16 * sh, (Math.random() - 0.5) * 12 * sh);
    }

    this._sky();
    this._ground();
    this._scenery();

    const draw = (o) => (o.type === 'coin' ? this._coin(o, now) : this._obstacle(o));
    const vis = this.objects
      .filter((o) => o.z <= W.zSpawn + 6 && o.z > -0.8)
      .sort((a, b) => b.z - a.z);

    // Far half, then the avatar, then whatever is sweeping past in front of it.
    for (const o of vis) if (o.z >= W.zPlayer) draw(o);
    this._player(now);
    for (const o of vis) if (o.z < W.zPlayer) draw(o);
    this._parts();
    if (this.state === 'running' && now < this.invulnUntil) this._flash(now);
  }

  _sky() {
    const g = this.g, w = this.w, h = this.h;
    const sky = g.createLinearGradient(0, 0, 0, this.horizon + 30);
    sky.addColorStop(0, '#141a34');
    sky.addColorStop(0.55, '#2b2450');
    sky.addColorStop(1, '#ff8a5c');
    g.fillStyle = sky;
    g.fillRect(-20, -20, w + 40, this.horizon + 40);

    // sun
    g.fillStyle = 'rgba(255,204,120,.85)';
    g.beginPath();
    g.arc(w * 0.5 - this.playerX * w * 0.06, this.horizon - 26, 46, 0, Math.PI * 2);
    g.fill();

    // skyline
    const off = -this.playerX * w * 0.03 - (this.traveled * 0.6) % 240;
    g.fillStyle = 'rgba(22,26,52,.92)';
    for (let i = -1; i < 12; i++) {
      const seed = ((i % 12) + 12) % 12;
      const bw = 26 + (seed * 37) % 34;
      const bh = 30 + (seed * 53) % 74;
      const x = off + i * 60;
      g.fillRect(x, this.horizon - bh, bw, bh);
    }
  }

  _ground() {
    const g = this.g, w = this.w, hz = this.horizon, H = this.h;

    g.fillStyle = '#171c2f';
    g.fillRect(-20, hz, w + 40, H - hz + 20);

    // track surface (trapezoid from far edge to near edge)
    const far = 1.6, near = 1.6;
    const xFarL = this.xAt(-far, W.zSpawn), xFarR = this.xAt(far, W.zSpawn);
    const xNearL = this.xAt(-near, -1), xNearR = this.xAt(near, -1);
    const yFar = this.yAt(W.zSpawn), yNear = this.yAt(-1);
    const grad = g.createLinearGradient(0, yFar, 0, yNear);
    grad.addColorStop(0, '#2c3350');
    grad.addColorStop(1, '#3d4670');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(xFarL, yFar); g.lineTo(xFarR, yFar);
    g.lineTo(xNearR, yNear); g.lineTo(xNearL, yNear);
    g.closePath(); g.fill();

    // scrolling rungs
    const period = 2.2;
    const phase = this.traveled % period;
    g.fillStyle = 'rgba(255,255,255,.055)';
    for (let i = 0; i < 24; i++) {
      const z = i * period - phase;
      if (z < -0.5) continue;
      const y1 = this.yAt(z), y2 = this.yAt(z + period * 0.42);
      if (y1 - y2 < 0.4) continue;
      const l1 = this.xAt(-1.5, z), r1 = this.xAt(1.5, z);
      const l2 = this.xAt(-1.5, z + period * 0.42), r2 = this.xAt(1.5, z + period * 0.42);
      g.beginPath();
      g.moveTo(l1, y1); g.lineTo(r1, y1); g.lineTo(r2, y2); g.lineTo(l2, y2);
      g.closePath(); g.fill();
    }

    // lane dividers
    g.strokeStyle = 'rgba(255,255,255,.22)';
    g.lineWidth = 2;
    for (const l of [-0.5, 0.5]) {
      g.beginPath();
      g.moveTo(this.xAt(l, W.zSpawn), yFar);
      g.lineTo(this.xAt(l, -1), yNear);
      g.stroke();
    }
    // rails
    g.strokeStyle = 'rgba(55,230,180,.35)';
    g.lineWidth = 3;
    for (const l of [-1.5, 1.5]) {
      g.beginPath();
      g.moveTo(this.xAt(l, W.zSpawn), yFar);
      g.lineTo(this.xAt(l, -1), yNear);
      g.stroke();
    }
  }

  _scenery() {
    const g = this.g;
    for (const s of [...this.scenery].sort((a, b) => b.z - a.z)) {
      if (s.z < -1 || s.z > W.zSpawn) continue;
      const sc = this.scaleAt(s.z);
      const x = this.xAt(s.side * 1.85, s.z);
      const yB = this.yAt(s.z), yT = this.yAt(s.z, 0.9);
      const wdt = Math.max(1, 0.07 * this.w * sc);
      g.fillStyle = 'rgba(30,36,64,.9)';
      g.fillRect(x - wdt / 2, yT, wdt, yB - yT);
      g.fillStyle = 'rgba(55,230,180,.5)';
      g.fillRect(x - wdt / 2, yT, wdt, Math.max(1, 4 * sc));
    }
  }

  _quad(g, pts, fill, stroke) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); }
  }

  // Draw a lane-aligned box between two heights.
  _box(lane, z, depth, hBot, hTop, colFront, colTop, halfW = 0.38) {
    const g = this.g;
    const zn = z, zf = z + depth;
    const nl = this.xAt(lane - halfW, zn), nr = this.xAt(lane + halfW, zn);
    const fl = this.xAt(lane - halfW, zf), fr = this.xAt(lane + halfW, zf);
    const nb = this.yAt(zn, hBot), nt = this.yAt(zn, hTop);
    const fb = this.yAt(zf, hBot), ft = this.yAt(zf, hTop);

    this._quad(g, [[fl, ft], [fr, ft], [fr, fb], [fl, fb]], colTop, null);           // back
    this._quad(g, [[fl, ft], [fr, ft], [nr, nt], [nl, nt]], colTop, null);           // top
    this._quad(g, [[nl, nt], [nr, nt], [nr, nb], [nl, nb]], colFront, 'rgba(0,0,0,.35)');
    return { nl, nr, nt, nb };
  }

  _obstacle(o) {
    const g = this.g;
    if (o.type === 'barrier') {
      const r = this._box(o.lane, o.z, 0.5, 0, S.barrier, '#ff9f43', '#c9762a');
      // hazard stripes
      g.save();
      g.beginPath();
      g.rect(r.nl, r.nt, r.nr - r.nl, r.nb - r.nt);
      g.clip();
      g.strokeStyle = 'rgba(30,20,10,.75)';
      g.lineWidth = Math.max(2, (r.nb - r.nt) * 0.22);
      const step = Math.max(6, (r.nr - r.nl) / 4);
      for (let x = r.nl - (r.nb - r.nt); x < r.nr + (r.nb - r.nt); x += step) {
        g.beginPath(); g.moveTo(x, r.nb); g.lineTo(x + (r.nb - r.nt), r.nt); g.stroke();
      }
      g.restore();
    } else if (o.type === 'beam') {
      // Uprights sit on the lane edges so the gap underneath stays clear.
      for (const sgn of [-1, 1]) {
        this._box(o.lane + sgn * 0.45, o.z, 0.5, 0, S.beamTop, '#5a4fbf', '#463b9c', 0.045);
      }
      this._box(o.lane, o.z, 0.5, S.beamBottom, S.beamTop, '#7c6cff', '#5849c9', 0.5);
    } else if (o.type === 'block') {
      const r = this._box(o.lane, o.z, 1.5, 0, S.block, '#e04b6b', '#a83350', 0.42);
      // windows
      const hgt = r.nb - r.nt, wid = r.nr - r.nl;
      if (hgt > 18) {
        g.fillStyle = 'rgba(255,255,255,.22)';
        g.fillRect(r.nl + wid * 0.16, r.nt + hgt * 0.14, wid * 0.68, hgt * 0.22);
        g.fillStyle = 'rgba(255,255,255,.12)';
        g.fillRect(r.nl + wid * 0.16, r.nt + hgt * 0.46, wid * 0.68, hgt * 0.16);
      }
    }
  }

  _coin(o, now) {
    const g = this.g;
    const s = this.scaleAt(o.z);
    const x = this.xAt(o.lane, o.z);
    const y = this.yAt(o.z, S.coinY);
    const r = 0.035 * this.w * s;
    if (r < 0.6) return;
    const spin = Math.abs(Math.cos(now / 260 + o.seed * 6));
    g.fillStyle = '#ffd54a';
    g.beginPath();
    g.ellipse(x, y, Math.max(0.5, r * spin), r, 0, 0, Math.PI * 2);
    g.fill();
    if (r > 4) {
      g.strokeStyle = 'rgba(160,110,10,.8)';
      g.lineWidth = Math.max(1, r * 0.14);
      g.stroke();
    }
  }

  _player(now) {
    const g = this.g;
    const z = W.zPlayer;
    const s = this.scaleAt(z);
    const x = this.xAt(this.playerX, z);
    const ground = this.yAt(z);
    const u = this.unit * s;                     // px per world height unit
    const yFeet = ground - this.py * u;

    const blink = now < this.invulnUntil && Math.floor(now / 90) % 2 === 0;
    g.save();
    g.globalAlpha = blink ? 0.4 : 1;

    // shadow
    g.fillStyle = `rgba(0,0,0,${clamp(0.35 - this.py * 0.5, 0.06, 0.35)})`;
    g.beginPath();
    g.ellipse(x, ground + 2, u * 0.11 * (1 - this.py * 0.4), u * 0.035, 0, 0, Math.PI * 2);
    g.fill();

    const body = '#37e6b4';
    const dark = '#1b9c78';
    const skin = '#ffd9b8';

    const hh = S.playerStand * u;                // standing height, px

    if (this.rolling) {
      // A tucked body is roughly a ball a bit under half your standing height.
      const rx = hh * 0.27, ry = hh * 0.23;
      const spin = now / 60;
      g.fillStyle = body;
      g.beginPath();
      g.ellipse(x, yFeet - ry, rx, ry, Math.sin(spin) * 0.45, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = skin;
      g.beginPath();
      g.arc(x + Math.cos(spin) * rx * 0.42, yFeet - ry + Math.sin(spin) * ry * 0.38, ry * 0.40, 0, Math.PI * 2);
      g.fill();
      g.restore();
      return;
    }

    const legLen = hh * 0.42, torsoH = hh * 0.36, headR = hh * 0.13;
    const hipY = yFeet - legLen;
    const shoY = hipY - torsoH;
    const air = this.py > 0.001;
    const ph = this.runPhase;
    const swing = air ? 0.55 : Math.sin(ph) * 0.85;
    const swing2 = air ? 0.2 : Math.sin(ph + Math.PI) * 0.85;

    g.lineCap = 'round';
    // legs — running stride on the ground, a clear knees-up tuck in the air
    g.strokeStyle = dark;
    g.lineWidth = Math.max(2, hh * 0.10);
    [swing, swing2].forEach((sw, i) => {
      let kneeX, kneeY, footX, footY;
      if (air) {
        const t = i === 0 ? 1 : 0.66;                  // stagger so both read
        kneeX = x + hh * 0.15 * t;
        kneeY = hipY + legLen * (0.30 + 0.10 * t);
        footX = x - hh * 0.09 * t;
        footY = hipY + legLen * (0.22 + 0.12 * t);
      } else {
        kneeX = x + sw * hh * 0.10;
        kneeY = hipY + legLen * 0.5 - Math.abs(sw) * hh * 0.06;
        footX = x + sw * hh * 0.18;
        footY = yFeet - Math.max(0, sw) * hh * 0.10;
      }
      g.beginPath();
      g.moveTo(x, hipY); g.lineTo(kneeX, kneeY); g.lineTo(footX, footY);
      g.stroke();
    });
    // torso
    g.fillStyle = body;
    const bw = hh * 0.30;
    g.beginPath();
    if (g.roundRect) g.roundRect(x - bw / 2, shoY, bw, torsoH + hh * 0.04, bw * 0.35);
    else g.rect(x - bw / 2, shoY, bw, torsoH + hh * 0.04);
    g.fill();
    // arms
    g.strokeStyle = body;
    g.lineWidth = Math.max(2, hh * 0.085);
    for (const sw of [swing2, swing]) {
      const elbowX = x + sw * hh * -0.12;
      const elbowY = shoY + torsoH * 0.45;
      const handX = x + sw * hh * -0.05;
      const handY = shoY + torsoH * (air ? 0.15 : 0.75);
      g.beginPath();
      g.moveTo(x + (sw > 0 ? bw : -bw) * 0.42, shoY + torsoH * 0.12);
      g.lineTo(elbowX, elbowY); g.lineTo(handX, handY);
      g.stroke();
    }
    // head
    g.fillStyle = skin;
    g.beginPath();
    g.arc(x, shoY - headR * 0.85, headR, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2b3450';
    g.beginPath();
    g.arc(x, shoY - headR * 1.05, headR * 0.98, Math.PI, Math.PI * 2);
    g.fill();

    g.restore();
  }

  _parts() {
    const g = this.g;
    for (const p of this.particles) {
      const s = this.scaleAt(p.z);
      const x = this.xAt(p.lane, p.z);
      const y = this.yAt(p.z, p.h);
      g.globalAlpha = clamp(p.life, 0, 1);
      g.fillStyle = p.color;
      const r = Math.max(1, 0.012 * this.w * s);
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  }

  _flash(now) {
    const g = this.g;
    g.fillStyle = `rgba(255,93,143,${0.10 + 0.06 * Math.sin(now / 80)})`;
    g.fillRect(0, 0, this.w, this.h);
  }
}
