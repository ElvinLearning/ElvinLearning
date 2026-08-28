"""Config loading. Pricing and routing live in YAML so they can be updated without touching code."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover - surfaced with a useful message at call time
    yaml = None

ROOT = Path(__file__).resolve().parent.parent
ENGINE = ROOT / "engine"
ASSETS = ROOT / "assets"
EPISODES = ROOT / "episodes"
OUT = ROOT / "out"


def _load_yaml(path: Path) -> dict[str, Any]:
    if yaml is None:
        raise RuntimeError("PyYAML is required: pip install -r requirements.txt")
    return yaml.safe_load(path.read_text()) or {}


@lru_cache(maxsize=None)
def pricing() -> dict[str, Any]:
    return _load_yaml(ENGINE / "pricing.yaml")


@lru_cache(maxsize=None)
def routing() -> dict[str, Any]:
    return _load_yaml(ENGINE / "routing.yaml")


def api_key(provider: str) -> str | None:
    """Keys come from the environment only. Never commit them; see .env.example."""
    return os.environ.get({
        "fal": "FAL_KEY",
        "higgsfield": "HIGGSFIELD_API_KEY",
        "hedra": "HEDRA_API_KEY",
        "heygen": "HEYGEN_API_KEY",
        "elevenlabs": "ELEVENLABS_API_KEY",
    }.get(provider, provider.upper() + "_API_KEY"))


def resolve_route(shot_type: str) -> dict[str, Any]:
    """Look up the model + params for a shot type. See engine/routing.yaml."""
    r = routing()
    route = (r.get("routes") or {}).get(shot_type)
    if not route:
        raise KeyError(f"no route configured for shot_type {shot_type!r} (see engine/routing.yaml)")
    out = dict(route)
    out.setdefault("provider", r.get("default_provider", "fal"))
    out.setdefault("params", {})
    return out
