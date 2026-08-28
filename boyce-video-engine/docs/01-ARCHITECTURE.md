# Architecture: the shot graph

## The one idea

> A video is not a generation. A video is a **graph of shots**, each of which is independently
> addressable, re-rollable, and versioned.

Everything else follows from that.

```
episodes/ep001.json          ← the source of truth. Human-editable. Lives in git.
        │
        ├── identity: "boyce.v3"      → assets/identity/boyce.v3/  (locked face + voice)
        │
        ├── shot s01 ──┐
        ├── shot s02   │  each shot routes to the best model for its type,
        ├── shot s03   ├─ generates N candidate takes,
        ├── ...        │  and records which take is LOCKED
        └── shot s12 ──┘
        │
        ▼
out/ep001/takes/s04.v3.mp4    ← every take ever generated, kept forever
        │
        ▼
engine/assemble.py            ← stitches locked takes + VO + music + captions
        │
        ├──► out/ep001/master.mp4        the deliverable
        ├──► out/ep001/ep001.fcpxml      editable timeline for Resolve / Premiere / FCP
        └──► out/ep001/variants/*.mp4    3-5 published cuts from one generation
```

## Layer 1 — Identity (locked once, reused forever)

`assets/identity/boyce.v3/` holds the canonical reference set: face angles, wardrobes, expression
sheet, and voice ID. Shots never carry raw photo paths; they carry *semantic* references like
`["face/three_quarter_left", "wardrobe/navy_suit"]`, which `engine/identity.py` resolves against
the active identity version.

Why this indirection matters: when you build `boyce.v4` with better photos, every episode in the
repo can be re-rendered against it by changing one line. Without it, you'd hand-edit hundreds of
shot definitions.

## Layer 2 — Generation (routed per shot, N candidates)

`engine/generate.py` walks the shot list. For each shot it:

1. resolves the identity references into concrete image inputs,
2. picks a model via the routing table (`engine/routing.yaml`) unless the shot pins one,
3. requests `candidates` takes (default 3),
4. writes each take to `out/<ep>/takes/<shot>.v<n>.mp4` and appends it to the shot's take log.

Nothing is ever overwritten. Take 1 from three weeks ago is still on disk. This is the difference
between a pipeline and a slot machine.

**Re-rolling** is `python -m engine.cli reroll ep001 s04 --note "he looks past camera"` — that
shot only, appended as a new take, everything else untouched.

**Locking** is `python -m engine.cli lock ep001 s04 v3`, which writes `"locked": "v3"` into the
episode JSON. Assembly only ever reads locked takes.

## Layer 3 — Assembly (the editable layer)

Generation output is deliberately **naked**: no captions, no titles, no music, no logo, no CTA.
Those are added at assembly. That is what makes one generation produce five published variants —
change the hook card and the caption track, re-assemble in seconds, spend nothing on inference.

Two outputs, always:
- `master.mp4` — ready to post.
- `ep001.fcpxml` — the same edit as a real timeline, so a human editor can open it in Resolve or
  Premiere with every clip on its own track and finish it properly. Nothing is ever a dead end.

## Layer 4 — Distribution

`docs/05-DAILY-RUNBOOK.md`. Per-platform crops, the disclosure toggles that keep monetization
intact, and the two-a-day cadence that this whole thing exists to sustain.

## Provider abstraction

`engine/providers/` — `fal.py` and `higgsfield.py` implement the same `VideoProvider` interface.
Swap providers in `routing.yaml` per shot type. Sora 2's API shutdown on 24 Sep 2026 is the
argument for this: models come and go, the shot graph doesn't.

```python
class VideoProvider(Protocol):
    def generate(self, req: ShotRequest) -> Take: ...
    def estimate_cost(self, req: ShotRequest) -> float: ...
```

## Why not just use an existing tool?

Every tool in this space owns the whole vertical — its own identity system, its own generation, its
own timeline, its own export — and none of them let you route a single shot to a competitor's
model. The moment you need "his talking-head shots from Hedra, his story shots from Seedance, hero
from Veo, all with the same face, in one timeline," you are building this. The shot graph is the
thin layer that makes those interoperate.
