"""Command line for the shot-graph pipeline.

    python -m engine.cli validate episodes/ep001.json
    python -m engine.cli cost     episodes/ep001.json
    python -m engine.cli generate episodes/ep001.json [--emit-jobs] [--dry-run]
    python -m engine.cli contact  episodes/ep001.json
    python -m engine.cli lock     ep001 s04 v2
    python -m engine.cli reroll   ep001 s07 --note "hand clips through the mug"
    python -m engine.cli assemble episodes/ep001.json
    python -m engine.cli export   episodes/ep001.json
    python -m engine.cli variants episodes/ep001.json
    python -m engine.cli identity validate boyce.v1
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .config import EPISODES, OUT, resolve_route
from .cost import estimate_episode
from .assemble import MissingLock as MissingLockError
from .identity import IdentityKit, ReleaseMissing
from .models import Episode


def _find(ref: str) -> Path:
    """Accept either a path or a bare episode id."""
    p = Path(ref)
    if p.exists():
        return p
    cand = EPISODES / f"{ref}.json"
    if cand.exists():
        return cand
    matches = sorted(EPISODES.glob(f"{ref}*.json"))
    if len(matches) == 1:
        return matches[0]
    raise SystemExit(f"cannot resolve episode {ref!r}")


# ---------------------------------------------------------------- validate

def cmd_validate(args) -> int:
    ep = Episode.load(_find(args.episode))
    problems, warnings = [], []

    ids = [s.id for s in ep.shots]
    if len(ids) != len(set(ids)):
        problems.append("duplicate shot ids")
    if not ep.approved_by:
        problems.append("no approved_by — scripts go to Dr. Boyce BEFORE generation (docs/04)")
    if not ep.lesson:
        warnings.append("no lesson set — if removing it doesn't break the ending, rewrite it")

    for s in ep.shots:
        try:
            resolve_route(s.shot_type)
        except KeyError as e:
            problems.append(str(e))
        if s.boyce_in_shot and not s.identity_refs:
            problems.append(f"{s.id}: he's in the shot but no identity_refs — face will drift")
        if s.shot_type == "direct_address" and s.route not in ("auto", "") and "seedance" in s.route:
            problems.append(f"{s.id}: direct address routed to text-to-video (docs/02, rule 4)")
        if s.duration > 6 and s.shot_type != "direct_address":
            warnings.append(f"{s.id}: {s.duration}s — cut every 2-4s (docs/03)")

    wardrobes = {s.wardrobe for s in ep.shots if s.wardrobe}
    if len(wardrobes) > 1:
        warnings.append(f"multiple wardrobes in one episode {wardrobes} — check that's intentional")

    if ep.runtime > 90:
        warnings.append(f"runtime {ep.runtime}s is long for short-form")

    for w in warnings:
        print(f"  warn  {w}")
    for p in problems:
        print(f"  FAIL  {p}")
    print(f"\n{ep.id}: {len(ep.shots)} shots, {ep.runtime:.0f}s runtime, "
          f"{len(problems)} problems, {len(warnings)} warnings")
    return 1 if problems else 0


# ---------------------------------------------------------------- cost

def cmd_cost(args) -> int:
    ep = Episode.load(_find(args.episode))
    est = estimate_episode(ep, args.candidates)
    print(f"{'shot':6} {'model':18} {'cand':>4} {'dur':>5} {'$/s':>7} {'gen s':>6} {'cost':>8}")
    print("-" * 62)
    for r in est["rows"]:
        print(f"{r['shot']:6} {r['model']:18} {r['candidates']:>4} {r['duration']:>5.1f} "
              f"{r['rate_per_s']:>7.3f} {r['generated_seconds']:>6.1f} {r['cost_usd']:>8.2f}")
    print("-" * 62)
    print(f"{'':6} {'':18} {'':>4} {est['runtime_s']:>5.0f}s {'':>7} "
          f"{est['generated_seconds']:>6.0f} {est['total_usd']:>8.2f}")
    print(f"\n{ep.id}: ${est['total_usd']:.2f} to generate "
          f"{est['generated_seconds']:.0f}s for a {est['runtime_s']:.0f}s cut.")
    return 0


# ---------------------------------------------------------------- generate

def cmd_generate(args) -> int:
    from .generate import generate_shot, requests_for

    ep = Episode.load(_find(args.episode))
    kit = IdentityKit.load(ep.identity)

    if not args.dry_run and not args.emit_jobs:
        try:
            kit.require_release()
        except ReleaseMissing as e:
            print(f"\nBLOCKED\n{e}\n", file=sys.stderr)
            return 2

    shots = [ep.shot(s) for s in args.shots] if args.shots else ep.unlocked()
    if not shots:
        print(f"{ep.id}: every shot already locked — nothing to generate.")
        return 0

    if args.emit_jobs:
        from .providers.higgsfield import HiggsfieldProvider
        reqs = requests_for(ep, kit, shots, args.candidates)
        out = HiggsfieldProvider().emit_jobs(reqs, OUT / ep.id / "jobs.json")
        total = sum(r["estimated_cost_usd"] for r in json.loads(out.read_text()))
        print(f"wrote {len(reqs)} jobs -> {out}  (~${total:.2f})")
        print("run them via Higgsfield generate_video_batch + jobs_wait, then `ingest`.")
        return 0

    if args.dry_run:
        for req in requests_for(ep, kit, shots, args.candidates):
            print(f"{req.shot_id:6} {req.model:16} {req.duration:>4.1f}s  {req.prompt[:90]}...")
        return 0

    for shot in shots:
        n = args.candidates or shot.candidates
        print(f"generating {shot.id} x{n} ...", flush=True)
        takes = generate_shot(ep, shot, kit, args.provider, args.candidates)
        for t in takes:
            print(f"  {t.version}  {t.model:16} ${t.cost_usd:.2f}  {t.path}")
        ep.save()
    print(f"\n{ep.id}: review with `contact`, then lock the winners.")
    return 0


def cmd_ingest(args) -> int:
    """Fold Higgsfield/MCP batch results back into the episode as takes."""
    from datetime import datetime, timezone
    from .models import Take

    ep = Episode.load(_find(args.episode))
    results = json.loads(Path(args.results).read_text())
    n = 0
    for r in results:
        shot = ep.shot(r["shot_id"])
        shot.takes.append(Take(
            version=shot.next_version(),
            path=r["path"],
            model=r.get("model_id", ""),
            provider="higgsfield",
            prompt=r.get("prompt", ""),
            seed=r.get("seed"),
            cost_usd=float(r.get("cost_usd", 0.0)),
            created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        ))
        n += 1
    ep.save()
    print(f"{ep.id}: ingested {n} takes")
    return 0


# ---------------------------------------------------------------- review

def cmd_contact(args) -> int:
    """Print every take side by side so you can pick winners."""
    ep = Episode.load(_find(args.episode))
    for s in ep.shots:
        mark = f"LOCKED {s.locked}" if s.locked else "unlocked"
        print(f"\n{s.id}  [{s.shot_type}] {s.duration}s  {mark}")
        print(f"     {s.action[:100]}")
        if not s.takes:
            print("     (no takes yet)")
        for t in s.takes:
            flag = "*" if t.version == s.locked else " "
            note = f"  <- {t.note}" if t.note else ""
            print(f"   {flag} {t.version:4} {t.model:16} ${t.cost_usd:>5.2f}  {t.path}{note}")
    return 0


def cmd_lock(args) -> int:
    ep = Episode.load(_find(args.episode))
    shot = ep.shot(args.shot)
    if not any(t.version == args.version for t in shot.takes):
        raise SystemExit(f"{shot.id}: no take {args.version} (have: "
                         f"{', '.join(t.version for t in shot.takes) or 'none'})")
    shot.locked = args.version
    ep.save()
    print(f"{ep.id} {shot.id} -> locked {args.version}")
    remaining = ep.unlocked()
    print(f"{len(remaining)} shots still unlocked" if remaining else "all shots locked — ready to assemble")
    return 0


def cmd_reroll(args) -> int:
    """Re-roll ONE shot. The whole point of the system: never regenerate the episode."""
    from .generate import generate_shot

    ep = Episode.load(_find(args.episode))
    kit = IdentityKit.load(ep.identity)
    kit.require_release()
    shot = ep.shot(args.shot)
    print(f"re-rolling {shot.id} x{args.candidates or shot.candidates}"
          + (f"  ({args.note})" if args.note else ""))
    for t in generate_shot(ep, shot, kit, args.provider, args.candidates, note=args.note):
        print(f"  {t.version}  {t.model:16} ${t.cost_usd:.2f}  {t.path}")
    ep.save()
    return 0


# ---------------------------------------------------------------- output

def cmd_assemble(args) -> int:
    from .assemble import assemble, export_fcpxml

    ep = Episode.load(_find(args.episode))
    master = assemble(ep)
    xml = export_fcpxml(ep)
    print(f"master   {master}")
    print(f"timeline {xml}   (open in Resolve / Premiere / FCP)")
    return 0


def cmd_export(args) -> int:
    from .assemble import export_fcpxml
    ep = Episode.load(_find(args.episode))
    print(export_fcpxml(ep))
    return 0


def cmd_variants(args) -> int:
    from .assemble import variant_plan
    ep = Episode.load(_find(args.episode))
    plan = variant_plan(ep)
    for key, v in plan.items():
        print(f"{key}  {v['desc']:48} {v['aspect']:5} {len(v['shots'])} shots")
    out = OUT / ep.id / "variants.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(plan, indent=2) + "\n")
    print(f"\nplan -> {out}")
    print("Generation is spent; these cost nothing but assembly time.")
    return 0


# ---------------------------------------------------------------- identity

def cmd_identity(args) -> int:
    if args.action == "validate":
        kit = IdentityKit.load(args.version)
        missing = kit.coverage_report()
        if not missing:
            print(f"{args.version}: complete")
        else:
            for group, names in missing.items():
                print(f"  missing {group}: {', '.join(names)}")
        try:
            print(f"release: {kit.require_release()}")
        except ReleaseMissing as e:
            print(f"  FAIL  {e}")
            return 1
        return 0 if not missing else 1
    raise SystemExit(f"unknown identity action {args.action!r}")


# ---------------------------------------------------------------- main

def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="engine.cli", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    def ep_arg(sp):
        sp.add_argument("episode", help="episode id or path to its JSON")

    ep_arg(sub.add_parser("validate", help="check an episode before spending anything"))
    c = sub.add_parser("cost", help="estimate generation cost"); ep_arg(c)
    c.add_argument("--candidates", type=int, help="override candidates per shot")

    g = sub.add_parser("generate", help="render candidate takes"); ep_arg(g)
    g.add_argument("--shots", nargs="*", help="limit to these shot ids")
    g.add_argument("--candidates", type=int)
    g.add_argument("--provider", default="", help="fal | higgsfield (default: routing.yaml)")
    g.add_argument("--emit-jobs", action="store_true", help="write a Higgsfield/MCP job spec instead")
    g.add_argument("--dry-run", action="store_true", help="print prompts, generate nothing")

    i = sub.add_parser("ingest", help="fold MCP batch results back in"); ep_arg(i)
    i.add_argument("results", help="path to results json")

    ep_arg(sub.add_parser("contact", help="contact sheet of every take"))

    l = sub.add_parser("lock", help="approve a take"); ep_arg(l)
    l.add_argument("shot"); l.add_argument("version")

    r = sub.add_parser("reroll", help="re-roll ONE shot"); ep_arg(r)
    r.add_argument("shot")
    r.add_argument("--note", default="", help="why — this gets logged with the take")
    r.add_argument("--candidates", type=int)
    r.add_argument("--provider", default="")

    ep_arg(sub.add_parser("assemble", help="master.mp4 + fcpxml"))
    ep_arg(sub.add_parser("export", help="fcpxml only"))
    ep_arg(sub.add_parser("variants", help="plan the A-E published cuts"))

    idt = sub.add_parser("identity", help="identity kit tools")
    idt.add_argument("action", choices=["validate"])
    idt.add_argument("version")

    args = p.parse_args(argv)
    handlers = {
        "validate": cmd_validate, "cost": cmd_cost, "generate": cmd_generate,
        "ingest": cmd_ingest, "contact": cmd_contact, "lock": cmd_lock,
        "reroll": cmd_reroll, "assemble": cmd_assemble, "export": cmd_export,
        "variants": cmd_variants, "identity": cmd_identity,
    }
    try:
        return handlers[args.cmd](args)
    except (ReleaseMissing, FileNotFoundError, MissingLockError, KeyError) as e:
        # These are all "you're missing a prerequisite" errors, not bugs. A stack trace helps
        # nobody at 7am on the second production run of the day.
        print(f"\n{type(e).__name__}: {e}\n", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
