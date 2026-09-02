# Same Face, Every Shot — course build

The complete $100 course: three PDFs, two video scripts, sales copy, and the launch plan.

## Status

| Asset | State |
|---|---|
| Book One — The Playbook (11pp) | **Built** → `pdfs/01-playbook.pdf` |
| Book Two — The Vault (12pp) | **Built** → `pdfs/02-vault.pdf` |
| Book Three — The Business (9pp) | **Built** → `pdfs/03-business.pdf` |
| Video 1 script — Identity Lock | **Written** → `videos/video-1-identity-lock.md` |
| Video 2 script — The Full Build | **Written** → `videos/video-2-full-build.md` |
| Recording setup guide | **Written** → `videos/recording-setup.md` |
| Sales page copy | **Written** → `sales/sales-page.md` |
| Pricing + offer ladder | **Written** → `sales/pricing-and-offer.md` |
| Launch plan | **Written** → `sales/launch-plan.md` |
| Delivery/packaging | **Written** → `delivery/packaging.md` |
| **The two videos themselves** | **You and Kayson record these** |
| START-HERE page | To write (spec in `delivery/packaging.md`) |
| Templates Pack (order bump) | To build (contents listed in `sales/pricing-and-offer.md`) |

## Rebuilding the PDFs

The books are HTML + one shared stylesheet, so a copy change is a two-minute turnaround.

```bash
./build.sh          # rebuild all three
./build.sh 02       # rebuild just Book Two
```

Edit `pdfs/0X-*.body.html` for content, `brand/style.css` for the look of all three at once.

## Before you launch

Read `sales/launch-plan.md` first — the sequencing section specifically.

The short version: **produce one real video with this system before you record the course videos.**
The books teach a method and stand on their own, but the videos need to show real work. A week of
actually running the loop first is the difference between a course that sells once and one that gets
recommended.

## The point of the $100 price

The course isn't the business — it's the top of the funnel. Roughly 3–8% of buyers ask about
done-for-you. A hundred sales is $10k; three of those hundred becoming retainer clients is $150k+ a
year. Price and promote it accordingly. Full ladder in `sales/pricing-and-offer.md`.

## Related

The production pipeline this course teaches is implemented in `../boyce-video-engine/` — schema,
model routing, cost model and CLI. The course teaches the method by hand; the engine automates it.
