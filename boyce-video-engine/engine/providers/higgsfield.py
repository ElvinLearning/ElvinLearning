"""Higgsfield provider.

Higgsfield sits in front of the same models this pipeline wants — Seedance 2.5 (omni_reference,
up to 50 refs), Kling 3.0, Veo 3.1, MiniMax H3 — so an existing Higgsfield balance is a usable
backend, not sunk cost. The UI was the problem; the models never were. See docs/00-RESEARCH.md §5.

Generation is driven through Higgsfield's MCP tools (`generate_video` / `generate_video_batch`,
then `jobs_wait`), which is an agent-session surface rather than a documented public REST API.
So this provider emits a ready-to-run job spec and hands it to the caller instead of pretending
to have an HTTP endpoint it can't guarantee.

To run a batch:
  python -m engine.cli generate episodes/ep001.json --provider higgsfield --emit-jobs
then feed out/<ep>/jobs.json to the MCP client, and:
  python -m engine.cli ingest episodes/ep001.json out/<ep>/results.json
"""
from __future__ import annotations

import json
from pathlib import Path

from ..cost import price_for
from .base import GeneratedTake, ShotRequest


class MCPHandoff(RuntimeError):
    """Raised when a Higgsfield job spec has been written and needs the MCP client to execute."""


class HiggsfieldProvider:
    name = "higgsfield"

    # Our model ids happen to match Higgsfield's, which is why this mapping is a no-op today.
    MODEL_IDS = {
        "seedance_2_5": "seedance_2_5",
        "seedance_2_0": "seedance_2_0",
        "seedance_2_0_mini": "seedance_2_0_mini",
        "kling3_0": "kling3_0",
        "veo3_1": "veo3_1",
        "minimax_h3": "minimax_h3",
    }

    def job_spec(self, req: ShotRequest) -> dict:
        """A single entry for Higgsfield's generate_video / generate_video_batch."""
        return {
            "shot_id": req.shot_id,
            "model_id": self.MODEL_IDS.get(req.model, req.model),
            "prompt": req.prompt,
            "aspect_ratio": req.aspect,
            "params": {"duration": int(req.duration), **req.params},
            "medias": [
                {"path": str(p), "role": "image_references"} for p in req.reference_images
            ],
            "seed": req.seed,
            "out_path": str(req.out_path) if req.out_path else None,
            "estimated_cost_usd": round(self.estimate_cost(req), 4),
        }

    def emit_jobs(self, reqs: list[ShotRequest], out_path: Path) -> Path:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps([self.job_spec(r) for r in reqs], indent=2) + "\n")
        return out_path

    def generate(self, req: ShotRequest) -> GeneratedTake:
        raise MCPHandoff(
            f"Higgsfield generation runs through MCP tools, not a REST call. "
            f"Run with --emit-jobs to write a job spec for shot {req.shot_id}, execute it via "
            f"generate_video_batch + jobs_wait, then `python -m engine.cli ingest`."
        )

    def estimate_cost(self, req: ShotRequest) -> float:
        # Higgsfield bills in credits; this is the equivalent list-price cost, which is the right
        # number for deciding routing and for the pass-through invoice to Boyce.
        return price_for(req.model, req.params) * req.duration
