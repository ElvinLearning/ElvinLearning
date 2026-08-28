# Costs — what this actually runs, and what to charge

All per-second figures are August 2026 list prices and move constantly. They live in
`engine/pricing.yaml`; `python -m engine.cli cost <episode>` computes from that file, so update the
YAML and every estimate follows. Treat the tables below as the shape of the answer, not a quote.

## Per-episode generation cost

Assume a 52-second episode: 12 shots, ~5s each, **3 candidate takes per shot** (the candidates are
the whole point — you're buying the right to pick).

### Flagship "The Lesson" — premium routing

| Component | Shots | Final sec | Generated sec (×3) | Rate | Cost |
|---|---|---|---|---|---|
| Direct address (lip-sync route) | 2 | 10 | 30 | per-clip | ~$2.00 |
| Story shots — Seedance 2.5 720p | 7 | 35 | 105 | $0.473/s | ~$49.70 |
| B-roll / wides — Kling 3.0 | 3 | 15 | 45 | ~$0.10/s | ~$4.50 |
| Voice clone (ElevenLabs v3) | — | — | — | — | ~$0.10 |
| Music (amortized subscription) | — | — | — | — | ~$0.50 |
| **Total** | **12** | **60** | **180** | | **≈ $57** |

### Same episode — budget routing (Kling 3.0 for story shots)

Story shots at ~$0.10/s instead of $0.473/s → **≈ $18/episode.** Noticeably less filmic; fine for
B-variants and for the Lesson-cut shorts.

### "Boyce vs." hero episode — Veo 3.1 Standard on the 4 money shots

Four hero shots at $0.75/s × 3 candidates = ~$45 on top of a budget base → **≈ $100/episode.**

## Monthly, at two a day

| Scenario | Mix | Monthly |
|---|---|---|
| Lean | all budget routing | ~$1,100 |
| **Recommended** | 45 flagship @ $57 + 15 hero @ $100 | **~$4,100** |
| No-ceiling | premium everywhere, 4 candidates | ~$7,500 |

Plus one-time: **Identity Kit build ~$300** (image iteration + the `identity test` bake-off), and
optionally **Kling Custom Model / LoRA training ~$50–200** in month 2.

Remember the variant engine: 60 generated episodes become **~300 published posts**. Cost per
published asset at the recommended tier is roughly **$14**. That is the number to say out loud.

## Non-generation costs

| Item | Monthly |
|---|---|
| ElevenLabs (creator/pro tier) | $22–99 |
| Hedra or HeyGen (talking-head route) | $30–120 |
| Music license (Epidemic/Artlist commercial) | $25–60 |
| Storage (takes accumulate fast — budget 1–2 TB/yr) | $10–25 |
| Higgsfield (existing — run the credits down programmatically) | already paid |

## What to charge Dr. Boyce

You're not selling videos. You're selling **a production line that outputs 300 branded assets a
month with his face on them, compliantly, that he owns.** Price against what that replaces, not
against your compute bill.

An agency producing 60 original short-form videos a month at this quality quotes $15k–40k. A single
freelance editor doing 20/month is $4k–8k and can't do the likeness work at all.

**Recommended structure — pass-through plus retainer:**

- **Compute billed at cost, monthly, with the receipts.** ~$4,100 at the recommended tier. Passing
  this through at cost is a strong move: it makes you a partner rather than a vendor with a margin
  to defend, and it means you never have to argue about a re-roll.
- **Retainer for the system and the operation: $7,500–10,000/month.** This covers the pipeline, the
  identity kit, daily production of 2 episodes → ~10 posts, compliance, and iteration on what's
  working.
- **All-in: ~$12,000–14,000/month.** Well under agency rate for 5× the output.

**If he wants to start smaller:** a paid pilot. $3,500 for two weeks — Identity Kit built, 10
episodes delivered, ~50 posts, full performance report. It de-risks him and it gets the kit built,
which is the part that makes everything after it cheap.

**Ask for a performance kicker.** A bonus on episodes crossing an agreed view threshold, or a small
percentage of attributable Black Business School enrollments. You are building the asset that
compounds; you should own some of the compound. This is also the single highest-expected-value term
in the whole deal — one "Boyce vs." breaking out is worth more than a year of retainer.

**Terms worth holding:** you own the pipeline (he owns the identity kit, the footage, and the
output); a 30-day notice period; and compute is pre-approved in a monthly envelope so you're never
waiting on a decision to re-roll a shot.
