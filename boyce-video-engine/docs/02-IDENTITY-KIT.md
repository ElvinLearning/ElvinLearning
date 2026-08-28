# The Identity Kit — locking Dr. Boyce's face and voice

This is the highest-leverage asset in the whole system. Build it carefully once; every episode
forever depends on it. Budget one focused session with Dr. Boyce and about $150–300 of image
generation to refine it.

## What you need FROM him (one session, ~45 minutes)

### Stills — shoot these, don't scrape them
Existing publicity photos are a weak substitute: inconsistent lighting, heavy retouching, and
usually only one or two angles. A controlled shoot on a modern phone beats a folder of press
photos.

- **Angles:** front, 3/4 left, 3/4 right, profile left, profile right, slight-up, slight-down. (7)
- **Expressions:** neutral, warm smile, laughing, serious/stern, mid-speech, eyebrow-raise
  skeptical, thinking. (7)
- **Framing:** close-up head, chest-up, waist-up, full body standing. (4)
- **Wardrobe:** at minimum his two signature looks — the one he teaches in, and one dressed-down.
  Shoot the full angle set in each.
- **Lighting:** flat, even, soft. Window light or a single softbox. No hard shadows, no color
  casts, no busy backgrounds. Plain wall.
- **Resolution:** highest the phone offers. No filters, no beauty mode, no portrait-mode blur.

Target: **40–60 usable frames.** You will select 3–5 per shot at generation time; models perform
best with a handful of strong, varied references rather than everything you own.

### Voice — 3 minutes of pristine audio
- Quiet room, no echo, no HVAC, no traffic. A $100 USB mic or even AirPods in a closet beats a
  conference-room recording.
- Have him read: a neutral paragraph, an excited paragraph, a serious paragraph, and 30 seconds of
  natural unscripted talking.
- **Archive the raw file with the signed release.** If a provider changes terms or you re-clone on
  a better model in six months, you need the source. See `docs/04-COMPLIANCE.md`.

### Signed release
Before any of this. Non-negotiable, and it protects him as much as you. Template in `docs/04`.

## What the kit looks like on disk

```
assets/identity/boyce.v1/
  kit.yaml                     # the manifest — semantic names → files
  face/
    front.jpg  three_quarter_left.jpg  three_quarter_right.jpg
    profile_left.jpg  profile_right.jpg  low_angle.jpg  high_angle.jpg
  expression/
    neutral.jpg  smile.jpg  laugh.jpg  stern.jpg  speaking.jpg  skeptical.jpg
  wardrobe/
    navy_suit/  {front,three_quarter_left,...}.jpg
    black_tee/  {front,three_quarter_left,...}.jpg
  body/
    chest_up.jpg  waist_up.jpg  full_standing.jpg
  voice/
    source_raw.wav             # the archived original — never delete
    voice_id.txt               # provider voice ID for the clone
  NOTES.md                     # what worked, what drifted, per-model quirks
```

`kit.yaml` is the contract. Shots reference `face/three_quarter_left`, not a path. Bumping to
`boyce.v2` means every episode re-renders against better references with a one-line change.

## Building it

```bash
python -m engine.cli identity init boyce.v1 --from ~/Desktop/boyce-shoot/
python -m engine.cli identity validate boyce.v1      # checks coverage + resolution
python -m engine.cli identity test boyce.v1          # 6 test shots across models, side by side
```

`identity test` is the important one. It generates the same six canonical shots — direct address,
walking, seated at desk, laughing, profile turn, wide establishing — against each candidate model,
so you can see with your own eyes which route holds his face and which one drifts. Do this before
you produce a single episode. It costs about $15 and saves weeks.

## Rules that keep the face from drifting

1. **Never mix identity versions inside one episode.** Drift between shots is the single most
   obvious "this is AI" tell.
2. **Match the reference to the shot.** A profile shot conditioned only on front-facing references
   will invent a profile. Pass the 3/4 and profile refs for turning shots.
3. **Match wardrobe references to the scene wardrobe.** Otherwise the model splits the difference
   and you get a jacket that changes between cuts.
4. **Direct-address shots do not go through text-to-video.** Route them to the audio-driven
   lip-sync path. Generated mouths on a talking educator is the fastest way to look cheap.
5. **Lock a take, then never regenerate it.** Even with the same seed and prompt, "one more roll to
   see" will give you a subtly different face. Locked is locked.
6. **Log drift in `NOTES.md`.** Per-model quirks are real and they compound into a playbook that is
   itself part of what Boyce is paying for.

## Month 2: the trained upgrade

Once the multi-reference path is producing daily, add a trained identity as a floor-raise for the
hardest shots (fast motion, profile turns, unusual lighting):

- **Kling Custom Model** — 10–30 clips of 10–15s, one clearly visible face each, varied angles and
  backgrounds. Highest ceiling, needs the most from Boyce.
- **Wan 2.2 / LTX LoRA** — 10–20 high-res varied stills, trains in minutes, fully under your
  control, portable across your own infra.

Keep multi-reference as the default even after training. Trained identity is the specialist tool
for the 10% of shots that multi-reference fumbles.
