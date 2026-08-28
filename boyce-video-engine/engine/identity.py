"""Identity kit resolution — turning semantic refs like 'face/three_quarter_left' into files.

The indirection is the point: shots never carry raw paths, so bumping boyce.v1 -> boyce.v2
re-renders every episode in the repo against better references with a one-line change.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .config import ASSETS, _load_yaml


class ReleaseMissing(RuntimeError):
    """Raised when generating against a kit with no signed release on file.

    This is a deliberate hard stop, not an inconvenience. Using a real person's synthetic
    likeness without documented authorization is a distinct platform violation independent of
    AI labeling, and a right-of-publicity exposure. See docs/04-COMPLIANCE.md.
    """


@dataclass
class IdentityKit:
    version: str
    root: Path
    manifest: dict

    @classmethod
    def load(cls, version: str) -> IdentityKit:
        root = ASSETS / "identity" / version
        if not root.is_dir():
            raise FileNotFoundError(
                f"identity kit {version!r} not found at {root}. "
                f"Build it first: python -m engine.cli identity init {version} --from <photo-dir>"
            )
        manifest_path = root / "kit.yaml"
        manifest = _load_yaml(manifest_path) if manifest_path.exists() else {}
        return cls(version=version, root=root, manifest=manifest)

    def require_release(self) -> Path:
        """Refuse to generate without a signed release. Non-negotiable."""
        for name in ("RELEASE.pdf", "RELEASE.md", "RELEASE.txt"):
            p = self.root / name
            if p.exists():
                return p
        raise ReleaseMissing(
            f"No signed release found in {self.root}.\n"
            f"Nothing gets generated against a real person's likeness without one.\n"
            f"See docs/04-COMPLIANCE.md for what it needs to cover, then place it at "
            f"{self.root / 'RELEASE.pdf'}."
        )

    def resolve(self, refs: list[str], wardrobe: str = "") -> list[Path]:
        """Resolve semantic refs to concrete image files.

        'face/three_quarter_left' -> <kit>/wardrobe/<wardrobe>/three_quarter_left.jpg if a
        wardrobe is specified and that variant exists, else <kit>/face/three_quarter_left.jpg.
        Matching the wardrobe reference to the scene wardrobe is what stops the jacket changing
        between cuts.
        """
        resolved: list[Path] = []
        for ref in refs:
            group, _, name = ref.partition("/")
            candidates: list[Path] = []
            if wardrobe and group == "face":
                candidates += list((self.root / "wardrobe" / wardrobe).glob(f"{name}.*"))
            candidates += list((self.root / group).glob(f"{name}.*"))
            hit = next((c for c in candidates if c.is_file()), None)
            if hit is None:
                raise FileNotFoundError(
                    f"identity ref {ref!r} not found in kit {self.version} "
                    f"(looked in {self.root / group}{' and wardrobe/' + wardrobe if wardrobe else ''})"
                )
            resolved.append(hit)
        return resolved

    def voice_id(self) -> str:
        vid = self.root / "voice" / "voice_id.txt"
        return vid.read_text().strip() if vid.exists() else ""

    def coverage_report(self) -> dict[str, list[str]]:
        """What the kit has and what it's missing. Used by `identity validate`."""
        want = {
            "face": ["front", "three_quarter_left", "three_quarter_right",
                     "profile_left", "profile_right", "low_angle", "high_angle"],
            "expression": ["neutral", "smile", "laugh", "stern", "speaking", "skeptical"],
            "body": ["chest_up", "waist_up", "full_standing"],
        }
        missing: dict[str, list[str]] = {}
        for group, names in want.items():
            gone = [n for n in names if not list((self.root / group).glob(f"{n}.*"))]
            if gone:
                missing[group] = gone
        if not self.voice_id():
            missing["voice"] = ["voice_id.txt"]
        return missing
