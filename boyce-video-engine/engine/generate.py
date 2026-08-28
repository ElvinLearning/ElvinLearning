"""Generation: walk the shot graph, render N candidates per shot, never overwrite anything."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from . import providers
from .config import OUT, resolve_route
from .identity import IdentityKit
from .models import Episode, Shot, Take
from .providers.base import ShotRequest

# The house prompt. Order matters: subject and identity first, then action, then camera, then the
# realism block. The negative block at the end is what keeps shots from reading as stock AI.
REALISM = (
    "shot on a cinema camera, natural skin texture with visible pores, practical lighting, "
    "subtle handheld motion, shallow depth of field, filmic color, no beauty retouching"
)
NEGATIVE = (
    "no plastic skin, no waxy face, no warped hands, no extra fingers, no morphing features, "
    "no floating text, no watermark, no distorted background faces"
)


def build_prompt(ep: Episode, shot: Shot) -> str:
    parts = []
    if shot.boyce_in_shot:
        who = "the same man from the reference images"
        if shot.wardrobe:
            who += f", wearing {shot.wardrobe.replace('_', ' ')}"
        parts.append(who)
    parts.append(shot.action.strip())
    if shot.camera:
        parts.append(shot.camera.strip())
    if shot.dialogue and not shot.dialogue.get("vo"):
        parts.append(f'he says: "{shot.dialogue["line"]}"')
    parts.append(REALISM)
    parts.append(NEGATIVE)
    return ". ".join(p.rstrip(".") for p in parts if p) + "."


def build_request(ep: Episode, shot: Shot, kit: IdentityKit, version: str) -> ShotRequest:
    route = resolve_route(shot.shot_type)
    model = shot.route if shot.route and shot.route != "auto" else route["model"]
    refs = kit.resolve(shot.identity_refs, shot.wardrobe) if shot.boyce_in_shot else []
    return ShotRequest(
        shot_id=shot.id,
        prompt=build_prompt(ep, shot),
        duration=shot.duration,
        aspect=ep.aspect,
        model=model,
        params=dict(route.get("params", {})),
        reference_images=refs,
        seed=shot.seed,
        out_path=OUT / ep.id / "takes" / f"{shot.id}.{version}.mp4",
    )


def requests_for(ep: Episode, kit: IdentityKit, shots: list[Shot], candidates: int | None = None) -> list[ShotRequest]:
    """Build every request for a generation run without executing anything.

    Used by --emit-jobs (Higgsfield/MCP path) and by --dry-run.
    """
    reqs = []
    for shot in shots:
        n = candidates if candidates is not None else shot.candidates
        for i in range(n):
            version = f"v{len(shot.takes) + i + 1}"
            reqs.append(build_request(ep, shot, kit, version))
    return reqs


def generate_shot(ep: Episode, shot: Shot, kit: IdentityKit, provider_name: str,
                  candidates: int | None = None, note: str = "") -> list[Take]:
    """Render candidates for one shot. Takes are appended — nothing is ever overwritten."""
    route = resolve_route(shot.shot_type)
    name = shot.provider if shot.provider and shot.provider != "auto" else (provider_name or route["provider"])
    provider = providers.get(name)

    n = candidates if candidates is not None else shot.candidates
    new_takes: list[Take] = []
    for _ in range(n):
        version = shot.next_version()
        req = build_request(ep, shot, kit, version)
        result = provider.generate(req)
        take = Take(
            version=version,
            path=str(result.path.relative_to(Path.cwd())) if result.path.is_absolute() else str(result.path),
            model=result.model,
            provider=result.provider,
            prompt=req.prompt,
            seed=result.seed,
            cost_usd=round(result.cost_usd, 4),
            created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            note=note,
        )
        shot.takes.append(take)
        new_takes.append(take)
    return new_takes
