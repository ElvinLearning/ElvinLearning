# Boyce Video Engine

A production line for editable, identity-locked AI video. Built to ship **two high-quality videos
a day** featuring Dr. Boyce Watkins, for The Black Business School.

---

## The short answer

The tools were never the problem. **The workflow was.**

Consumer AI-video apps — Higgsfield, Kling's web app, Runway's editor — are slot machines. You
prompt, you pay, you get one take, and when shot 7 of 9 is wrong there is no way to fix *just that
shot*. No project file, no per-shot version history, no re-roll. The only recovery move is
regenerating everything, which is how credits evaporate while the output still isn't good enough.

So this repo doesn't chase a better model. It treats a video the way film production does:

> **A video is not a generation. It's a graph of shots — each independently addressable,
> re-rollable, and versioned, all bound to one locked identity.**

Bad shot 4? Re-roll shot 4. Everything else is untouched, on disk, and already approved.

## What that gets you

| Slot-machine UI | This |
|---|---|
| Bad shot → regenerate the whole video | Re-roll one shot |
| No record of what made the good take | Every take is a file, every prompt is in git |
| Face drifts between shots | One locked identity kit, referenced by every shot |
| Output is a flat MP4, dead on arrival | MP4 **plus** an FCPXML timeline for Resolve/Premiere |
| Cost scales with your mistakes | Cost scales with your output |
| 1 video = 1 post | 1 generation = **5 published posts** (captions/music never baked in) |

Two generated episodes a day → **~10 posts a day** across platforms, with zero extra inference.
That's the actual answer to "two videos a day."

## Cost

~**$53** to generate a 52-second episode with three candidate takes on every shot
(`python -m engine.cli cost ep001` — that's a live number from `engine/pricing.yaml`, not a guess).
At the recommended routing that's **~$4,100/month** for 60 episodes → ~300 published assets, or
about **$14 per published asset**. Full arithmetic and the pricing conversation to have with
Dr. Boyce: [`docs/06-COSTS.md`](docs/06-COSTS.md).

## The Higgsfield money isn't wasted

Higgsfield is a front end over the same models this pipeline wants — Seedance 2.5, Kling 3.0,
Veo 3.1, MiniMax H3. The account is a perfectly good **backend**; the UI was the problem. This
ships with two interchangeable providers (`fal` and `higgsfield`) behind one interface, so you can
run the existing credits down through the programmatic path — where the shot graph finally gives
you the control the UI never did — then switch providers with a one-line config change.

---

## Quickstart

```bash
pip install -r requirements.txt
cp .env.example .env          # add your keys

python -m engine.cli validate ep001    # catch problems before spending anything
python -m engine.cli cost     ep001    # see the bill first
python -m engine.cli generate ep001    # 3 candidate takes per shot
python -m engine.cli contact  ep001    # review every take side by side
python -m engine.cli lock     ep001 s04 v2
python -m engine.cli reroll   ep001 s07 --note "hand clips through the mug"
python -m engine.cli assemble ep001    # master.mp4 + ep001.fcpxml
python -m engine.cli variants ep001    # the A-E published cuts
```

`make help` has the same thing as targets.

## Read these in order

| Doc | What's in it |
|---|---|
| [`docs/00-RESEARCH.md`](docs/00-RESEARCH.md) | **The deep research.** Every model compared with 2026 prices, why the UIs fail, what actually holds a real face, and the recommendation with sources. |
| [`docs/01-ARCHITECTURE.md`](docs/01-ARCHITECTURE.md) | How the shot graph works. |
| [`docs/02-IDENTITY-KIT.md`](docs/02-IDENTITY-KIT.md) | **Do this first.** Exactly what to shoot in one 45-min session with Boyce, and the rules that stop his face drifting. |
| [`docs/03-SERIES-BIBLE.md`](docs/03-SERIES-BIBLE.md) | The creative engine — three shows, beat sheets, hook rules, the premise bank, the variant engine. |
| [`docs/04-COMPLIANCE.md`](docs/04-COMPLIANCE.md) | Consent, disclosure, and the house rules. Disclosure costs nothing; skipping it costs the channel. |
| [`docs/05-DAILY-RUNBOOK.md`](docs/05-DAILY-RUNBOOK.md) | The two-a-day operation, review discipline, failure modes. |
| [`docs/06-COSTS.md`](docs/06-COSTS.md) | Real cost math and what to charge. |

## How it's put together

```
episodes/ep001.json          the source of truth — human-editable, lives in git
        │  identity: boyce.v3  →  assets/identity/boyce.v3/  (locked face + voice)
        │  12 shots, each routed to the model that wins for its shot type
        ▼
out/ep001/takes/s04.v3.mp4   every take ever generated, kept forever
        ▼
        ├──► master.mp4        ready to post
        ├──► ep001.fcpxml      editable timeline — Resolve / Premiere / FCP
        └──► variants/         5 published cuts from one generation
```

**Model routing** (`engine/routing.yaml`) — no single model wins everything, so route per shot:

| Shot type | Model | Why |
|---|---|---|
| He speaks to camera | Hedra / HeyGen | Audio-driven. Generated mouths on a talking educator look cheap. |
| He's a character in a scene | Seedance 2.5 | Up to 50 refs, best spokesperson identity hold |
| Multi-angle in one clip | Kling 3.0 | 6 cuts with identity continuity, cheapest per second |
| Hero / establishing | Veo 3.1 | Best realism and lip-sync in market |
| B-roll, no face | Kling 3.0 std | Identity doesn't matter — optimize for cost |

## Two hard gates, on purpose

The CLI **refuses to generate** if:

1. There's no signed likeness release in the identity kit. Using a real person's synthetic
   likeness without documented authorization is a platform violation independent of AI labeling,
   and a right-of-publicity exposure.
2. The episode has no `approved_by`. Scripts go to Dr. Boyce **before** generation, never after —
   a hallucinated financial specific in his voice is the one mistake there's no recovering from.

Both are in `docs/04-COMPLIANCE.md`. They're also the pitch: they're what separates this from
someone deepfaking him.

## Status

The pipeline, schema, routing, cost model, FCPXML export and CLI are built and working end to end
(`ep001` is a complete worked episode — validate it, cost it, dry-run the prompts). What it needs
to produce actual video:

- [ ] Signed likeness release from Dr. Boyce
- [ ] One 45-minute shoot → the Identity Kit (`docs/02`) — this is the critical path
- [ ] API keys in `.env`
- [ ] `identity test` bake-off to pick the winning route for his face specifically (~$15, worth weeks)
