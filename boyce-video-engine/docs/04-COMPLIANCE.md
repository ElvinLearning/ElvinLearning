# Compliance — consent, disclosure, and keeping the channel

Read this before generating a single frame. The cost of doing it right is roughly zero. The cost of
skipping it is the channel, and possibly a lawsuit that Dr. Boyce would be the plaintiff in.

## The two separate obligations

People conflate these. They are independent, and you must satisfy both.

1. **Authorization to use the likeness.** Using a real person's synthetic likeness without
   documented authorization is a distinct violation on every major platform, independent of
   labeling. It is also a right-of-publicity claim in most US states.
2. **Disclosure that the content is AI-generated.** Required for realistic AI-generated depictions
   of people or scenes on TikTok, YouTube, and Meta.

Satisfying (2) does not cure (1), and vice versa.

## Obligation 1 — the release

**Nothing gets generated before this is signed.** It protects him more than it protects you, which
is also how to present it — a serious operator brings paperwork.

The release should specify, at minimum:

- Full legal name of the individual.
- Explicit grant to create and publish AI-generated video and audio depictions of his likeness and
  voice.
- Scope: which channels, which brands, which subject matter.
- **Term and termination:** a fixed period, and his right to revoke going forward.
- **Approval rights:** who signs off before publication (recommend: he or a delegate approves every
  episode until trust is established, then spot-checks).
- **Prohibited uses**, named explicitly: political endorsement, financial advice presented as
  personalized advice, health claims, anything implying endorsement of a third-party product
  without separate written approval, anything placing him in a false light.
- Ownership of the generated assets and of the identity kit.
- Where the source photos, source audio and the release itself are archived.

TikTok specifically requires consent documentation for advertising use — full legal name,
description of permitted use, campaign duration, and a signed release — uploaded directly in Ads
Manager. Write the release so it satisfies that standard from day one, even if you're only doing
organic now. ([AuditSocials](https://www.auditsocials.com/blog/tiktok-ai-content-disclosure-rules-2026))

> This is a template of what to cover, not legal advice. Have a lawyer review it before signature —
> at these stakes it's a few hundred dollars against the whole business.

Store the signed release at `assets/identity/<version>/RELEASE.pdf`, alongside the raw source
photos and audio. `engine/cli.py` refuses to generate against an identity kit with no release on
file. That's deliberate — see `engine/identity.py`.

## Obligation 2 — disclosure

**YouTube.** The Altered or Synthetic Content policy reached full enforcement in **January 2026**.
Toggle "altered or synthetic content" in YouTube Studio on every upload. Crucially: **disclosure
does not limit reach and does not affect monetization eligibility.** Repeated failure to disclose
leads to labels, removals, or YPP suspension. AI content remains monetizable when it offers
original value and is disclosed.
([Creators Agency](https://creatorsagency.co/blog/youtube-tiktok-ai-disclosure-rules-2026), [Vexub](https://vexub.com/blog/ai-generated-video-monetization-policies))

**TikTok.** Visible labeling required on AI-generated visuals and audio depicting realistic people
or scenes. TikTok reads **C2PA Content Credentials** and will auto-detect and auto-label synthetic
media even without self-disclosure — and unlabeled content can have distribution reduced or be
removed. Labeled AI content **stays eligible** for Creator Rewards and brand deals.
([Storrito](https://storrito.com/resources/tiktoks-2026-ai-labeling-rules-and-what-they-signal-for-platform-governance/), [AuditSocials](https://www.auditsocials.com/blog/tiktok-ai-content-disclosure-rules-2026))

**Meta.** Same shape: label AI-generated realistic media.

**Advertising.** AI likenesses of real people in ads are effectively prohibited across the major
platforms *without documented consent* — and even with consent, must be clearly labeled.
([InfluencerMarketingHub](https://influencermarketinghub.com/ai-disclosure-rules/))

**EU / watermarking.** EU AI Act Article 50 provenance obligations carry an August 2026 watermarking
deadline. If any of this ever runs as paid media in the EU, prefer voice and video providers that
embed provenance watermarks (e.g. Resemble's PerTh). Not urgent for US organic; know it exists.

### The upload checklist (in `docs/05-DAILY-RUNBOOK.md` too)

- [ ] Platform AI-content toggle ON, every upload, every platform.
- [ ] On-screen disclosure in the video itself for The Lesson and Boyce vs. — a small persistent
      corner mark. It costs nothing and it inoculates the comments.
- [ ] C2PA credentials preserved where the provider emits them; don't strip metadata on export.
- [ ] Never present a generated scene as documentary footage of a real event.
- [ ] "The Millionaire Next Door" carries a dramatization card — historical figures depicted by AI
      need it stated.

## The house rules (stricter than the platforms)

These exist because Dr. Boyce's asset is credibility, and credibility is the thing AI content is
most efficient at destroying.

1. **He never says a number, a prediction, or a recommendation he didn't approve.** Financial
   specifics are the one category where a hallucinated line is catastrophic. Every script line
   goes to him before generation, not after.
2. **No real third parties depicted.** No other identifiable real people, no real companies as
   villains, no real logos.
3. **No fabricated testimonials or results.** No invented students, no invented returns.
4. **No news framing.** Never generate him reacting to a real current event as though filmed.
5. **He gets a kill switch.** One message from him and the video comes down, no discussion. Say
   this out loud when you pitch it.
6. **Keep the receipts.** Every episode's JSON, prompts, and approval are in git. If it's ever
   questioned, the whole provenance chain is reconstructable.

Rule 1 and rule 5 are also the pitch. They are what separates this from someone deepfaking him.
