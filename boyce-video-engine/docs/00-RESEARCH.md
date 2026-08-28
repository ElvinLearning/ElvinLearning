# Deep Research: How to actually make editable, high-quality AI videos of a real person, twice a day

Research date: **August 2026**. Prices and model versions in this space change monthly — every
number here is also encoded in `engine/pricing.yaml` so it can be updated in one place without
touching code.

---

## 1. The real problem (and why Higgsfield felt like a waste of money)

The instinct is to look for a *better model*. That is the wrong search. In August 2026 there are at
least six models that can produce a shot good enough for a viral short. The models are not the
bottleneck.

The bottleneck is that consumer AI-video UIs — Higgsfield, Kling's web app, Sora's app, Runway's
web editor — are **slot machines**. You type a prompt, you pay, you get one take, and if take 7 of
9 shots is wrong you have no way to fix *just that shot*. There is no project file. There is no
"re-roll shot 4 and leave the other eight alone." There is no version history per shot. So the only
recovery move is to regenerate the whole thing, which is why the credits evaporate and the output
still isn't broadcast-quality.

That is a **workflow** failure, not a model failure. And it is worth being precise about it,
because it is also the thing that is worth money to Dr. Boyce: anyone can buy a Higgsfield
subscription. Almost nobody has a repeatable production line.

**The fix, in one sentence:** stop treating a video as one generation, and start treating it as a
**shot graph** — a JSON file where every shot is an independently addressable, independently
re-rollable, independently versioned unit bound to a locked identity.

This is, not coincidentally, exactly how real film production works. Nobody reshoots the movie
because one take was bad.

### What this buys you
| Slot-machine UI | Shot-graph pipeline |
|---|---|
| Bad shot 4 → regenerate all 9 shots | Bad shot 4 → re-roll shot 4 only |
| No record of what prompt made the good take | Every take is a file, every prompt is in git |
| Face drifts between shots | One locked identity kit referenced by every shot |
| Output is a flat MP4, dead on arrival | Output is an MP4 *plus* an editable timeline for Resolve/Premiere/CapCut |
| Cost scales with your mistakes | Cost scales with your output |
| Can't hand it to an editor | Hand the whole project folder to an editor |

The Higgsfield spend is not actually wasted, and I'd stop treating it as sunk cost — see §5.

---

## 2. The identity problem: getting *his* face, reliably

This is the hard technical constraint. Everything else is solvable. There are four viable
approaches in 2026, and they are not interchangeable — they solve different shot types.

### A. Multi-reference conditioning (the workhorse)
Feed the model a set of real reference photos alongside the prompt; the model holds that identity
through the clip.

- **Seedance 2.5** (ByteDance) accepts up to **50 multimodal reference images** and holds a
  character, set and palette across a single take of up to **30 seconds**. Multiple independent
  reviews in 2026 name it the strongest option specifically for *spokesperson* work — a real
  person's face across many shots — with three to five reference images being the practical sweet
  spot. ([fal](https://fal.ai/models/bytedance/seedance-2.5/reference-to-video), [Elser](https://www.elser.ai/blog/best-ai-video-model-character-consistency-2026))
- **Kling 3.0** (released Feb 2026) supports tagging uploaded reference images of specific
  characters in the prompt, and holds identity across up to six camera cuts *inside one
  generation*. ([fal](https://blog.fal.ai/kling-3-0-is-now-available-on-fal/), [The Brand Hopper](https://thebrandhopper.com/learning-resources/best-ai-video-models-for-character-consistency/))

**Verdict: this is the primary path.** It requires no training, no wait, no per-model fine-tune,
and it works from the day you have good photos of him.

### B. Trained identity (LoRA / custom model) — the insurance policy
Train a small adapter on his likeness once, then every generation is anchored to it.

- **Kling Custom Models**: upload 10–30 clips of 10–15s, one clearly visible face per clip, varied
  angles and lighting. ([Heather Cooper](https://heatherbcooper.substack.com/p/kling-ais-video-character-consistency))
- **Wan 2.2 / LTX** LoRA training: 10–20 high-res varied photos, training in minutes on consumer
  GPUs; LTX trains natively on video rather than frames, so motion consistency comes along with
  the face. ([selfielab](https://selfielabstudio.com/blog/wan-22-lora-training-custom-characters-guide-20260317), [LTX](https://ltx.io/model/capabilities/lora-training))

**Verdict: worth doing in month 2, not week 1.** It's a meaningful quality floor-raise for the
hardest shots (profile turns, fast motion, unusual lighting) but multi-reference gets you shipping
now, and Boyce's time to record a training set is the scarce resource.

### C. Performance transfer / lip-sync (for anything where he talks)
Talking directly to camera is the single highest-trust shot type for an educator brand, and pure
text-to-video still produces the most uncanny mouths.

- **Hedra Character-3** drives a single still image with audio into an expressive performance;
  reviewers consistently rank it best-in-class for getting a real performance out of *one photo*.
- **HeyGen Avatar IV** scores highest for talking-head realism and gesture control, and is the
  strongest option for a *branded, reusable* avatar built from his own face and voice.
- **Runway Act-Two** transfers a real performance (you act it out, the character does it) — a
  different and often more natural approach than static lip-sync.
  ([lipsync.com](https://lipsync.com/compare/heygen-vs-hedra), [Morphed](https://morphed.app/blog/hedra-alternatives))

**Verdict: mandatory as a second route.** Direct-address shots should not go through a
text-to-video model. Route them here.

### D. Voice
- **ElevenLabs v3** remains the expressiveness benchmark; a clone needs ~30 seconds of clean audio.
- **Fish Audio S2** beat ElevenLabs v3 60/40 in a blind A/B and runs roughly 6× cheaper.
- **Resemble AI** embeds the PerTh watermark, built for EU AI Act Article 50 provenance ahead of
  the **August 2026** watermarking deadline — relevant if this ever runs as paid advertising.
  ([eesel](https://www.eesel.ai/blog/elevenlabs-alternatives), [CloneMyVoice](https://clonemyvoice.ai/compare/best-elevenlabs-alternatives/))

**Verdict:** clone on ElevenLabs v3 for the hero voice, keep 60+ seconds of pristine source audio
archived with the signed consent, and A/B Fish Audio once volume makes the cost difference matter.

---

## 3. Model routing: there is no single best model, and that's the point

Each shot type has a different winner. A pipeline that can route per shot beats any single tool.

| Shot type | Route to | Why |
|---|---|---|
| He speaks to camera | Hedra / HeyGen (audio-driven) | Real lip-sync beats generated mouths |
| He's a character in a scene, 2+ shots | **Seedance 2.5** (`omni_reference`) | 50 refs, up to 30s, best spokesperson identity hold |
| Multi-angle scene inside one clip | **Kling 3.0** | Up to 6 cuts with identity continuity, cheapest per second |
| Hero / beauty / establishing shot | **Veo 3.1** | Best-in-market realism and lip-sync, native audio, 4K on Standard |
| B-roll, no face | Kling 3.0 std / Seedance Mini | Identity doesn't matter, optimize for cost |
| Reference stills / character sheet | Image model (Nano Banana Pro / Seedream class) | Cheap iteration before you spend on motion |

Per-second list pricing, August 2026 (varies by provider and resolution; verify before relying on it):

| Model | ~$/sec | Notes |
|---|---|---|
| Veo 3.1 Lite 720p | ~$0.03 | Cheapest first-party quality tier |
| Kling 3.0 (via fal) | ~$0.029–0.14 | Cheapest per-second at scale |
| Veo 3.1 Lite 1080p | ~$0.05 | |
| Sora 2 Pro | ~$0.30–0.70 | **API shuts down 24 Sep 2026 — do not build on it** |
| Seedance 2.5 720p (fal) | ~$0.473 | Audio included; token-metered |
| Veo 3.1 Standard | ~$0.75 | Native 4K, best lip-sync |

Sources: [CometAPI](https://www.cometapi.com/ai-video-api-pricing/), [ModelsLab](https://modelslab.com/blog/api/veo-3-1-vs-kling-3-sora-2-ai-video-api-cost-2026), [BuildMVPFast](https://www.buildmvpfast.com/api-costs/ai-video), [CellCog](https://cellcog.ai/blog/seedance-2-5-pricing/)

**The Sora 2 note matters.** Building the house on an API with a published shutdown date is how you
lose a month. The pipeline is provider-abstracted for exactly this reason.

---

## 4. "Editable" — defining it properly, because it's the whole ask

"Editable" has three distinct meanings and you want all three:

1. **Re-rollable** — regenerate one shot without touching the others. Solved by the shot graph.
2. **Re-cuttable** — hand a real editor a real timeline. Solved by exporting **FCPXML / OTIO**.
   OpenTimelineIO is the Academy Software Foundation's JSON interchange format and is the universal
   hub between Resolve, Premiere and Final Cut. ([ChatOctopus/timeline](https://github.com/ChatOctopus/timeline))
   The proven pattern in 2026 is hybrid: AI generates and rough-cuts, a human finishes in Resolve.
3. **Re-skinnable** — change the hook, the captions, the CTA, the music, without re-generating a
   single frame. Solved by keeping captions/music/titles as a separate assembly layer, never baked
   into the generation.

Point 3 is the one people miss and it is where the volume comes from. One generated episode should
yield 3–5 published variants (different hooks, different first 3 seconds, different platform
crops). That is how you hit two a day without generating two a day.

---

## 5. So what do you actually do with the Higgsfield money?

Don't write it off. Higgsfield is a **front end plus an API/MCP layer over the same models** —
Seedance 2.5 (with `omni_reference` and up to 50 refs), Kling 3.0, Veo 3.1, Grok Video 1.5,
MiniMax H3 and others all sit behind it, alongside a character-sheet workflow and stored character
/ reference elements for identity lock.

The UI was the problem. The account is still a valid backend. This pipeline therefore ships with
**two interchangeable providers** — `fal` and `higgsfield` — behind one interface. Run the
Higgsfield credits down through the programmatic path where the shot graph gives you the control
the UI never did, and switch the routing table to fal when the credits are gone or when fal is
cheaper for a given shot. No rewrite either way.

---

## 6. Recommendation

**Build the shot-graph pipeline. Route per shot. Lock identity once. Export an editable timeline.**

Concretely, in priority order:

1. **Identity Kit** (week 1) — the single highest-leverage asset. A canonical, versioned set of
   reference stills and a cloned voice, built once, referenced by every shot forever. `docs/02`.
2. **Shot-graph episodes** (week 1) — every video is a JSON file in git. `schema/episode.schema.json`.
3. **Multi-reference generation via Seedance 2.5 / Kling 3.0**, direct-address via Hedra/HeyGen,
   hero shots via Veo 3.1. Three candidate takes per shot, lock the best. `engine/generate.py`.
4. **Assembly + FCPXML export** so nothing is ever a dead-end MP4. `engine/assemble.py`.
5. **Variant engine** — 3–5 published cuts per generated episode. `docs/05`.
6. **LoRA / Kling Custom Model** (month 2) — raises the floor on the hardest shots once Boyce can
   sit for a training set.

Expected all-in generation cost: **$30–75 per episode** at three candidates per shot with premium
routing. See `docs/06-COSTS.md` for the arithmetic and the pricing conversation.

---

## 7. The thing that will actually kill this if you ignore it

Using a real person's synthetic likeness without documented authorization is a **separate
violation** from failing to label AI content, on every major platform. TikTok requires consent
documentation — full legal name, description of permitted use, campaign duration, signed release —
uploaded directly for advertising use. YouTube's Altered or Synthetic Content policy went to full
enforcement in **January 2026**.

The good news: disclosure does **not** reduce reach or monetization eligibility on YouTube, and
properly labeled AI content stays eligible for TikTok's Creator Rewards Program and brand deals.
([Creators Agency](https://creatorsagency.co/blog/youtube-tiktok-ai-disclosure-rules-2026), [AuditSocials](https://www.auditsocials.com/blog/tiktok-ai-content-disclosure-rules-2026), [InfluencerMarketingHub](https://influencermarketinghub.com/ai-disclosure-rules/))

So the cost of compliance is approximately zero and the cost of skipping it is the channel. Get the
signed release from Dr. Boyce before shot one, label every upload, and this is a non-issue.
`docs/04-COMPLIANCE.md` has the checklist and a release template to adapt.

---

## Sources

- [fal — Seedance 2.5 Reference to Video](https://fal.ai/models/bytedance/seedance-2.5/reference-to-video)
- [fal — Kling 3.0 launch](https://blog.fal.ai/kling-3-0-is-now-available-on-fal/)
- [CellCog — Seedance 2.5 pricing compared](https://cellcog.ai/blog/seedance-2-5-pricing/)
- [CometAPI — AI video API pricing 2026](https://www.cometapi.com/ai-video-api-pricing/)
- [ModelsLab — Veo 3.1 vs Kling 3.0 vs Sora 2 cost](https://modelslab.com/blog/api/veo-3-1-vs-kling-3-sora-2-ai-video-api-cost-2026)
- [BuildMVPFast — AI video API costs](https://www.buildmvpfast.com/api-costs/ai-video)
- [Elser AI — which model keeps characters most consistent](https://www.elser.ai/blog/best-ai-video-model-character-consistency-2026)
- [The Brand Hopper — 8 models compared for character consistency](https://thebrandhopper.com/learning-resources/best-ai-video-models-for-character-consistency/)
- [lipsync.com — HeyGen vs Hedra](https://lipsync.com/compare/heygen-vs-hedra)
- [Morphed — Hedra alternatives](https://morphed.app/blog/hedra-alternatives)
- [selfielab — Wan 2.2 LoRA training guide](https://selfielabstudio.com/blog/wan-22-lora-training-custom-characters-guide-20260317)
- [LTX — LoRA training for video](https://ltx.io/model/capabilities/lora-training)
- [Heather Cooper — Kling character consistency / custom models](https://heatherbcooper.substack.com/p/kling-ais-video-character-consistency)
- [eesel — ElevenLabs alternatives 2026](https://www.eesel.ai/blog/elevenlabs-alternatives)
- [CloneMyVoice — best ElevenLabs alternatives](https://clonemyvoice.ai/compare/best-elevenlabs-alternatives/)
- [ChatOctopus/timeline — FCPXML/OTIO interchange](https://github.com/ChatOctopus/timeline)
- [Creators Agency — YouTube & TikTok AI disclosure checklist 2026](https://creatorsagency.co/blog/youtube-tiktok-ai-disclosure-rules-2026)
- [AuditSocials — TikTok AI disclosure rules 2026](https://www.auditsocials.com/blog/tiktok-ai-content-disclosure-rules-2026)
- [InfluencerMarketingHub — AI disclosure rules by platform](https://influencermarketinghub.com/ai-disclosure-rules/)
- [Medium — episodic short-form series in 2026](https://medium.com/@yashasvi_nurdd/episodic-short-form-series-why-creators-are-abandoning-the-one-off-reel-in-2026-bdc6aa03ed9f)
- [OpusClip — Shorts hook formulas for 3-second holds](https://www.opus.pro/blog/youtube-shorts-hook-formulas)
