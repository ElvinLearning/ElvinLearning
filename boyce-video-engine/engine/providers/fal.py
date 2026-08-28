"""fal.ai provider — the default once Higgsfield credits are spent.

Uses fal's queue API: POST to https://queue.fal.run/<model-path>, poll the returned status_url,
then fetch the result. Set FAL_KEY in the environment.
"""
from __future__ import annotations

import time
import urllib.request
import json
from pathlib import Path

from ..config import api_key
from ..cost import price_for
from .base import GeneratedTake, ShotRequest

# Model id (ours) -> fal model path. Update as fal moves endpoints around.
MODEL_PATHS = {
    "seedance_2_5": "fal-ai/bytedance/seedance-2.5/reference-to-video",
    "seedance_2_0": "fal-ai/bytedance/seedance-2.0/image-to-video",
    "kling3_0": "fal-ai/kling-video/v3/standard/image-to-video",
    "veo3_1": "fal-ai/veo-3.1",
}

POLL_INTERVAL_S = 3
POLL_TIMEOUT_S = 900


class FalProvider:
    name = "fal"

    def _headers(self) -> dict[str, str]:
        key = api_key("fal")
        if not key:
            raise RuntimeError("FAL_KEY is not set — see .env.example")
        return {"Authorization": f"Key {key}", "Content-Type": "application/json"}

    def _post(self, url: str, payload: dict) -> dict:
        req = urllib.request.Request(
            url, data=json.dumps(payload).encode(), headers=self._headers(), method="POST"
        )
        with urllib.request.urlopen(req) as r:
            return json.load(r)

    def _get(self, url: str) -> dict:
        req = urllib.request.Request(url, headers=self._headers())
        with urllib.request.urlopen(req) as r:
            return json.load(r)

    def _build_payload(self, req: ShotRequest) -> dict:
        payload: dict = {
            "prompt": req.prompt,
            "duration": int(req.duration),
            "aspect_ratio": req.aspect,
            **req.params,
        }
        if req.seed is not None:
            payload["seed"] = req.seed
        # Reference images must be reachable URLs. Upload to fal storage (or any CDN) first and
        # cache the URL next to the file as <name>.url — see docs/02-IDENTITY-KIT.md.
        urls = []
        for p in req.reference_images:
            cached = p.with_suffix(p.suffix + ".url")
            if not cached.exists():
                raise RuntimeError(
                    f"no uploaded URL for reference {p}. Upload identity refs once and cache the "
                    f"URL at {cached} (`python -m engine.cli identity upload <version>`)."
                )
            urls.append(cached.read_text().strip())
        if urls:
            payload["reference_image_urls"] = urls
        return payload

    def generate(self, req: ShotRequest) -> GeneratedTake:
        path = MODEL_PATHS.get(req.model)
        if not path:
            raise KeyError(f"no fal path mapped for model {req.model!r}")

        submitted = self._post(f"https://queue.fal.run/{path}", self._build_payload(req))
        status_url = submitted["status_url"]
        response_url = submitted["response_url"]

        deadline = time.time() + POLL_TIMEOUT_S
        while time.time() < deadline:
            status = self._get(status_url)
            if status.get("status") == "COMPLETED":
                break
            if status.get("status") == "FAILED":
                raise RuntimeError(f"fal job failed for {req.shot_id}: {status}")
            time.sleep(POLL_INTERVAL_S)
        else:
            raise TimeoutError(f"fal job timed out after {POLL_TIMEOUT_S}s for {req.shot_id}")

        result = self._get(response_url)
        video_url = result["video"]["url"]

        out = req.out_path or Path(f"{req.shot_id}.mp4")
        out.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(video_url, out)

        return GeneratedTake(
            path=out,
            model=req.model,
            provider=self.name,
            cost_usd=self.estimate_cost(req),
            seed=result.get("seed", req.seed),
            raw=result,
        )

    def estimate_cost(self, req: ShotRequest) -> float:
        return price_for(req.model, req.params) * req.duration
