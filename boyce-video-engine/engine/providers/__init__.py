"""Provider abstraction.

Models come and go — Sora 2's API shuts down 2026-09-24 — but the shot graph doesn't. Every
provider implements the same interface so routing.yaml can move a shot type between vendors
without a rewrite.
"""
from __future__ import annotations

from .base import ShotRequest, VideoProvider  # noqa: F401


def get(name: str) -> VideoProvider:
    if name == "fal":
        from .fal import FalProvider
        return FalProvider()
    if name == "higgsfield":
        from .higgsfield import HiggsfieldProvider
        return HiggsfieldProvider()
    raise KeyError(f"unknown provider {name!r} (have: fal, higgsfield)")
