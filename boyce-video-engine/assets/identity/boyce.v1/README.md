# boyce.v1 — drop the shoot in here

Empty on purpose. This is the scaffold; the content comes from one 45-minute session with
Dr. Boyce. See `docs/02-IDENTITY-KIT.md` for exactly what to shoot and how.

```
face/        front.jpg  three_quarter_left.jpg  three_quarter_right.jpg
             profile_left.jpg  profile_right.jpg  low_angle.jpg  high_angle.jpg
expression/  neutral.jpg  smile.jpg  laugh.jpg  stern.jpg  speaking.jpg  skeptical.jpg
body/        chest_up.jpg  waist_up.jpg  full_standing.jpg
wardrobe/navy_suit/   the full face set again, in that wardrobe
wardrobe/black_tee/   same
voice/       source_raw.wav   (3 min, archived forever)   voice_id.txt
RELEASE.pdf  the signed likeness release — generation is BLOCKED without it
```

Check your work:

```bash
python -m engine.cli identity validate boyce.v1
```
