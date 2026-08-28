# Daily Runbook — two videos a day, sustainably

The pipeline exists to make this boring. If a production day takes more than ~90 minutes of your
attention, something is wrong and it's usually that concepts weren't banked ahead.

## The weekly rhythm

| Day | Work |
|---|---|
| **Sunday (90 min)** | Bank the week. Write 14 premises, draft 14 episode JSONs, send all scripts to Boyce for approval in one batch. |
| **Mon–Fri (2× ~40 min)** | Generate → review → lock → assemble → variants → publish. |
| **Friday (30 min)** | Pull numbers. Update `docs/PERFORMANCE.md`. Kill what's dead, double what's working. |

Batching Boyce's approval into one weekly pass is the thing that makes this survivable. Chasing
approval twice a day will kill the cadence inside a month.

## The production loop

```bash
# 1. Validate before you spend anything
python -m engine.cli validate episodes/ep014.json
python -m engine.cli cost      episodes/ep014.json     # sanity-check the bill first

# 2. Generate all shots, 3 candidates each
python -m engine.cli generate  episodes/ep014.json

# 3. Review the contact sheet, lock the winners
python -m engine.cli contact   episodes/ep014.json     # grid of every take, side by side
python -m engine.cli lock      ep014 s04 v2

# 4. Fix what's wrong — one shot, not the episode
python -m engine.cli reroll    ep014 s07 --note "hand clips through the mug" --candidates 3

# 5. Assemble
python -m engine.cli assemble  episodes/ep014.json                # master.mp4 + fcpxml
python -m engine.cli variants  episodes/ep014.json                # A–E cuts

# 6. If it needs a human finish
open out/ep014/ep014.fcpxml                                       # Resolve / Premiere / FCP
```

## Review discipline (the 5-minute pass that protects the brand)

Watch the assembled cut **twice**: once at full speed with sound, once muted at 2×.

- **Full speed, sound on:** does the hook hold you for 3 seconds? Does the lesson land? Does the
  lip-sync drift on the direct address?
- **Muted at 2×:** face drift and hand artifacts jump out immediately when you're not listening to
  the words. This catches almost everything the first pass misses.

Then the kill criteria from `docs/03-SERIES-BIBLE.md`. **Shipping one great video beats shipping
two mediocre ones** — the algorithm learns the account's quality level and that's expensive to undo.

## Publishing checklist (every single upload)

- [ ] AI-content disclosure toggle ON — YouTube Studio, TikTok, Meta. (Does not reduce reach or
      monetization. See `docs/04-COMPLIANCE.md`.)
- [ ] Correct crop for the platform (9:16 vertical, 16:9 for YouTube long/X).
- [ ] Captions burned in for the story cut; platform captions on as well.
- [ ] Hook text within the first 3 seconds, above the UI safe zone.
- [ ] No logo before the last 2 seconds.
- [ ] CTA to the Black Business School in the pinned comment, not the video body.
- [ ] Series name in the title so episodes compound: `The Lesson #014 — ...`
- [ ] Metadata/C2PA credentials preserved (don't re-encode through a stripping tool).

## Publishing schedule

Two generated episodes → ~10 posts/day across platforms. Don't dump them at once.

| Slot | Content |
|---|---|
| 7:00a | Yesterday's Lesson-cut (variant C) — commute audience |
| 12:00p | Today's flagship story cut (variant A) |
| 5:30p | Today's second episode (Boyce vs. or Millionaire Next Door) |
| 8:00p | Landscape cut to YouTube (variant D) |
| Rolling | Variant B hook-swap reposts, 6+ days after the original |

## Failure modes and what to do

| Symptom | Cause | Fix |
|---|---|---|
| Face drifts between shots | Mixed identity versions, or wrong refs for the angle | Re-roll with angle-matched refs; never ship drift |
| Lip-sync mushy on direct address | Routed through text-to-video | Re-route to the lip-sync path; this shot never uses T2V |
| Costs spiking | Re-rolling whole episodes out of habit | Re-roll shots. Check `cost` before `generate`. |
| Views collapsed across the board | Posting cadence outran quality | Drop to one/day for a week, raise the bar, rebuild |
| A format stops working | Fatigue — normal at ~20 episodes | Rotate to another show; rest the format 3 weeks |
| Boyce approval bottleneck | Approving daily instead of weekly | Batch to Sunday |

## Track weekly

3-second hold rate · average view duration · completion · shares (the real virality signal, above
likes) · comment sentiment · profile→link clicks · enrollments attributable to the channel.

**Shares and completion are the two that matter.** Optimize the hook for the first, the ending for
the second.
