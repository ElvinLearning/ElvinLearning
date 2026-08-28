"""Dataclasses mirroring schema/episode.schema.json.

The JSON on disk is the source of truth; these are a typed view over it. Every load/save round
trip preserves unknown keys so hand-edits to the JSON are never silently dropped.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class Take:
    """One generated candidate. Append-only — takes are never overwritten or deleted."""

    version: str
    path: str
    model: str
    created_at: str = field(default_factory=_now)
    provider: str = ""
    prompt: str = ""
    seed: int | None = None
    cost_usd: float = 0.0
    note: str = ""

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Take:
        known = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in d.items() if k in known})

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in self.__dict__.items() if v not in ("", None)}


@dataclass
class Shot:
    id: str
    duration: float
    shot_type: str
    action: str
    role: str = ""
    camera: str = ""
    dialogue: dict[str, Any] | None = None
    on_screen_text: str = ""
    identity_refs: list[str] = field(default_factory=list)
    wardrobe: str = ""
    boyce_in_shot: bool = True
    route: str = "auto"
    provider: str = "auto"
    candidates: int = 3
    seed: int | None = None
    takes: list[Take] = field(default_factory=list)
    locked: str | None = None
    notes: str = ""

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Shot:
        d = dict(d)
        takes = [Take.from_dict(t) for t in d.pop("takes", [])]
        known = {f for f in cls.__dataclass_fields__} - {"takes"}
        return cls(takes=takes, **{k: v for k, v in d.items() if k in known})

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for k, v in self.__dict__.items():
            if k == "takes":
                if v:
                    out["takes"] = [t.to_dict() for t in v]
            elif v not in ("", [], None) or k == "locked":
                out[k] = v
        return out

    def next_version(self) -> str:
        return f"v{len(self.takes) + 1}"

    def locked_take(self) -> Take | None:
        return next((t for t in self.takes if t.version == self.locked), None)

    def is_speaking(self) -> bool:
        return bool(self.dialogue and not self.dialogue.get("vo", False))


@dataclass
class Episode:
    id: str
    title: str
    show: str
    aspect: str
    identity: str
    shots: list[Shot]
    fps: int = 30
    voice_id: str = ""
    premise: str = ""
    lesson: str = ""
    approved_by: str = ""
    approved_at: str = ""
    music: dict[str, Any] = field(default_factory=dict)
    captions: dict[str, Any] = field(default_factory=dict)
    disclosure: dict[str, Any] = field(default_factory=dict)
    path: Path | None = None

    @classmethod
    def load(cls, path: str | Path) -> Episode:
        path = Path(path)
        d = json.loads(path.read_text())
        shots = [Shot.from_dict(s) for s in d.pop("shots", [])]
        known = {f for f in cls.__dataclass_fields__} - {"shots", "path"}
        return cls(shots=shots, path=path, **{k: v for k, v in d.items() if k in known})

    def save(self, path: str | Path | None = None) -> Path:
        target = Path(path) if path else self.path
        if target is None:
            raise ValueError("no path to save to")
        d = {k: v for k, v in self.__dict__.items() if k not in ("shots", "path") and v not in ("", {}, None)}
        d["shots"] = [s.to_dict() for s in self.shots]
        target.write_text(json.dumps(d, indent=2) + "\n")
        return target

    def shot(self, shot_id: str) -> Shot:
        for s in self.shots:
            if s.id == shot_id:
                return s
        raise KeyError(f"no shot {shot_id!r} in {self.id}")

    @property
    def runtime(self) -> float:
        return sum(s.duration for s in self.shots)

    def unlocked(self) -> list[Shot]:
        return [s for s in self.shots if not s.locked]
