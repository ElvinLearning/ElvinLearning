from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol


@dataclass
class ShotRequest:
    """Everything a provider needs to render one candidate take."""

    shot_id: str
    prompt: str
    duration: float
    aspect: str
    model: str
    params: dict[str, Any] = field(default_factory=dict)
    reference_images: list[Path] = field(default_factory=list)
    seed: int | None = None
    out_path: Path | None = None


@dataclass
class GeneratedTake:
    path: Path
    model: str
    provider: str
    cost_usd: float
    seed: int | None = None
    raw: dict[str, Any] = field(default_factory=dict)


class VideoProvider(Protocol):
    name: str

    def generate(self, req: ShotRequest) -> GeneratedTake: ...

    def estimate_cost(self, req: ShotRequest) -> float: ...
