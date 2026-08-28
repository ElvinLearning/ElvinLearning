# Harmony Stack

A one-page a cappella looper for your phone. Tap record, get a bar of clicks,
sing the low part for four bars — then tap again and sing the high harmony
over the top of it. Layers stack up as long as you want them to.

Everything runs in the browser. Nothing is uploaded.

## Files

| Path | What it is |
| --- | --- |
| `app/harmony-stack.html` | The app. A body-only HTML fragment (the form the Claude Artifact host expects). |
| `index.html` | Generated standalone page for ordinary web hosting. |
| `build.sh` | Wraps the fragment into `index.html`. Run it after editing the app. |

Edit `app/harmony-stack.html`, then `./build.sh`.

## Running it

Serve the repo over **HTTPS** (or `localhost`) — browsers only grant
microphone access on a secure origin. GitHub Pages works.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## How the timing works

The transport is a Web Audio lookahead scheduler: clicks and loop boundaries
are scheduled ahead of the clock rather than fired from timers, so the loop
does not drift.

Input is captured continuously through a `ScriptProcessorNode`, with `0.55 s`
of padding recorded either side of the loop window. A take is stored as that
padded buffer, and playback reads the region `[PAD + nudge, PAD + nudge + loop]`
out of it. Because the nudge is applied at playback time rather than at capture
time, moving the **Timing nudge** slider re-times every layer already recorded,
not just the next one.

The nudge exists because a phone hands over audio a moment after the sound
happened. That delay compounds with each overdub — layer two is sung against a
layer one that was already late — so the slider starts from an estimate of the
round trip (`baseLatency + outputLatency + track latency`) and is then yours to
tune by ear. It is remembered in `localStorage`.

## Notes

- Wear headphones. On speaker the mic hears your earlier layers and records
  them again. Speaker mode turns on echo cancellation as a fallback; it works,
  but it thins the voice.
- Tempo and metre lock once a layer exists — clear the layers to change them.
- **Save mix** appears only where the host grants the downloads capability. It
  bounces one pass of the loop in real time to WebM or MP4, whichever the
  browser can encode.
