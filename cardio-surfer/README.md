# Cardio Surfer

An endless runner where **your body is the controller**. Point any device's front
camera at yourself and:

| Move | Does |
| --- | --- |
| **Jog in place** | Sets your speed — stop jogging and the guard catches you |
| **Side-step left / right** | Changes lane |
| **Jump** | Clears orange barriers |
| **Crouch** | Rolls under purple beams |

Everything runs in the browser. No app, no install, no account. The camera feed
never leaves the device — pose estimation happens locally in WebAssembly and no
frame is ever uploaded or stored.

---

## Play it on your phone right now

The page needs **HTTPS** for the camera to work, so it has to be served — opening
the file directly won't do it.

**Zero setup:** open this on the phone —

```
https://raw.githack.com/ElvinLearning/ElvinLearning/claude/subway-surfer-cardio-game-4zxtmw/cardio-surfer/index.html
```

**Permanent URL (better):** in repo **Settings → Pages**, set *Source* to
**Deploy from a branch**, pick the branch and **/ (root)**, save, wait a minute.

Then, on the phone:

1. Tap **Enable camera & play** and allow the camera.
2. **Prop the phone up in portrait**, roughly waist height, leaning against
   something. A shelf, a water bottle, a chair back.
3. **Back up until your whole body — head to feet — is inside the frame.**
   Usually 6–8 ft. This is the single thing that determines whether it works.
4. Stand still for the 3-second calibration. Everything is measured relative to
   that pose, so stand naturally.
5. Jog.

You want about **1 m / 3 ft of clear space either side** for the side-steps.

> First load downloads ~11 MB of pose model + WebAssembly from jsDelivr. It's
> cached afterwards, so do it on Wi-Fi once and later runs start instantly.

### If it doesn't see you

- **Whole body must be in frame** — if your feet are cut off, knee and ankle
  tracking dies and jogging stops registering.
- Front-lit is better than back-lit. Standing with a bright window behind you
  turns you into a silhouette.
- Safari on iOS ≥16 works; so does Chrome/Edge on iOS 17+ and Chrome on Android.
- Camera blocked? In Safari: **"AA"** in the address bar → *Website Settings* →
  *Camera* → *Allow*, then reload.

### If a move isn't registering

Tap the **⚙** during a run. There's a slider per gesture, plus **Show live
numbers** which prints the raw signal the detector sees so you can watch what
your movement actually does. Settings persist. There's also **Re-calibrate** if
you moved the phone.

| Slider | Raise it if… | Lower it if… |
| --- | --- | --- |
| Side-step | It changes lane when you don't mean to | You have to step way too far |
| Jump | Jogging triggers phantom jumps | Your jumps get missed |
| Crouch | It thinks you crouched mid-stride | You have to squat all the way down |
| Jog step size | It counts steps while you stand still | Your cadence reads too low |

---

## How the motion tracking works

`js/pose.js` runs MediaPipe's **Pose Landmarker** (lite model, GPU delegate with
a CPU fallback) on each camera frame, giving 33 body landmarks in normalised
image coordinates.

`js/gestures.js` turns those into game actions. The core idea: **every
measurement is expressed in units of the player's own body**, not pixels — hip
travel is measured in shoulder-widths, vertical motion in torso-lengths. So the
same thresholds work whether you're 5 ft or 12 ft from the phone, tall or short.
A 3-second calibration captures your standing pose as the reference, and
vertical baselines drift slowly afterwards so posture changes don't poison
detection.

| Gesture | Signal |
| --- | --- |
| Lane | Hip midpoint's lateral offset ÷ shoulder width, with hysteresis so you don't flicker on the boundary |
| Jump | Hip rise ÷ torso length **and both ankles leaving the floor at once** |
| Crouch | Nose→ankle "stature" shrinking below a fraction of standing height |
| Jog step | Sign changes in `(left knee height − right knee height)`, measured relative to the hips so it survives you bobbing up and down |

That jump rule is the important one. A jog stride also lifts a knee and bounces
the hips, so hip-rise alone produces constant false jumps. Requiring *both* feet
up simultaneously is what separates a hop from a stride — the test suite pushes a
200 spm high-knee jog with a heavy bounce through it and gets zero false jumps.

Cadence drives speed: steps in a rolling 4-second window → steps/min → run speed.
Stop for ~1.5 s and you get a warning; ~5 s after that, the guard gets you. That's
the part that makes it cardio rather than a game you can play standing still.

## Design note: pacing is measured in seconds, not metres

A physical side-step costs you most of a second — you cannot dodge on the frame
timings a thumb-controlled runner uses. So obstacle spacing is priced in *time at
top speed*, which makes the gap a guaranteed floor on reaction time: jog slower
and the same spacing simply arrives further apart. Measured over a full run, the
tightest window is ~1.5 s and the median ~2.1 s.

## Layout

```
index.html         screens, HUD, camera preview
css/style.css      all styling, iOS safe-area aware
js/config.js       every tuneable number, in one place
js/pose.js         camera + MediaPipe landmarker + skeleton overlay
js/gestures.js     landmarks -> lane / jump / crouch / cadence
js/game.js         runner logic + canvas rendering
js/audio.js        WebAudio blips
js/main.js         screen flow, calibration, input wiring
test/              headless tests, no browser needed
```

## Running locally

```sh
npm start          # serves on http://localhost:8080
npm test           # 22 gesture assertions + a game simulation
```

`localhost` counts as a secure origin, so the camera works there without HTTPS.

The tests need no browser and no camera. `test/gestures.test.mjs` feeds synthetic
skeletons through the gesture engine (jogging, side-steps, jumps, crouches, at
different camera distances and noise levels) and asserts each move fires exactly
once and that jogging never fakes anything. `test/game.test.mjs` stubs a canvas,
simulates several minutes of play, and checks collisions, the difficulty ramp,
the stall timer, and that no spawn pattern ever blocks all three lanes.

## Touch mode

**Play with touch instead** on the title screen skips the camera entirely: swipe
left/right/up/down, or use arrow keys on a desktop. Handy for checking the game
itself without setting up a space. Swipes also stay live during a camera run as a
fallback (toggle in ⚙).

## Licence

MIT.
