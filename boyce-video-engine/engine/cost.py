"""Cost estimation. Everything reads engine/pricing.yaml so prices update in one place."""
from __future__ import annotations

from typing import Any

from .config import pricing, resolve_route


def price_for(model: str, params: dict[str, Any] | None = None) -> float:
    """Per-second USD for a model at the given params. Returns 0.0 for per-clip models."""
    params = params or {}
    table = pricing().get("video", {}).get(model)
    if table is None:
        flat = pricing().get("lipsync", {}).get(model)
        if flat is not None:
            return 0.0  # per-clip, handled by flat_price_for
        raise KeyError(f"no pricing for model {model!r} — add it to engine/pricing.yaml")

    # Try the most specific key the params imply, then fall back to the cheapest listed tier.
    for key in (params.get("resolution"), params.get("mode"), params.get("quality"), params.get("variant")):
        if key and key in table:
            return float(table[key])
    if model == "veo3_1":
        return float(table.get("lite_720p", min(table.values())))
    return float(min(table.values()))


def flat_price_for(model: str) -> float:
    """Per-clip USD for lip-sync style models that don't bill per second."""
    return float(pricing().get("lipsync", {}).get(model, 0.0))


def estimate_shot(shot, override_candidates: int | None = None) -> dict:
    """Cost estimate for one shot including all candidate takes."""
    route = resolve_route(shot.shot_type)
    model = shot.route if shot.route and shot.route != "auto" else route["model"]
    params = route.get("params", {})
    n = override_candidates if override_candidates is not None else shot.candidates

    flat = flat_price_for(model)
    if flat:
        cost = flat * n
        rate = 0.0
    else:
        rate = price_for(model, params)
        cost = rate * shot.duration * n

    return {
        "shot": shot.id,
        "model": model,
        "candidates": n,
        "duration": shot.duration,
        "rate_per_s": rate,
        "generated_seconds": shot.duration * n,
        "cost_usd": round(cost, 4),
    }


def estimate_episode(episode, override_candidates: int | None = None) -> dict:
    rows = [estimate_shot(s, override_candidates) for s in episode.shots]
    return {
        "episode": episode.id,
        "runtime_s": episode.runtime,
        "generated_seconds": sum(r["generated_seconds"] for r in rows),
        "total_usd": round(sum(r["cost_usd"] for r in rows), 2),
        "rows": rows,
    }
