"""Assembly — locked takes to a master cut, plus an editable timeline.

Generation output is deliberately naked: no captions, no titles, no music, no logo. Those are
added here. That is what makes one generation produce five published variants for free, and it's
why the variant engine in docs/03-SERIES-BIBLE.md costs nothing in inference.

Two outputs, always: master.mp4 (ready to post) and <ep>.fcpxml (the same edit as a real
timeline, so a human editor can finish it in Resolve/Premiere/FCP). Nothing is ever a dead end.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from xml.sax.saxutils import escape

from .config import OUT, ROOT
from .models import Episode


class MissingLock(RuntimeError):
    """Assembly reads only locked takes. An unlocked shot is an unanswered question."""


def _ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("ffmpeg not found on PATH — brew install ffmpeg / apt install ffmpeg")
    return exe


def locked_clips(ep: Episode) -> list[tuple[str, Path]]:
    clips: list[tuple[str, Path]] = []
    missing = []
    for shot in ep.shots:
        take = shot.locked_take()
        if take is None:
            missing.append(shot.id)
            continue
        p = Path(take.path)
        if not p.is_absolute():
            p = ROOT / p
        clips.append((shot.id, p))
    if missing:
        raise MissingLock(
            f"{ep.id}: no locked take for {', '.join(missing)}. "
            f"Review with `contact` then `lock {ep.id} <shot> <version>`."
        )
    return clips


def assemble(ep: Episode, out_dir: Path | None = None, burn_captions: bool | None = None) -> Path:
    """Concatenate locked takes into master.mp4."""
    out_dir = out_dir or (OUT / ep.id)
    out_dir.mkdir(parents=True, exist_ok=True)
    clips = locked_clips(ep)

    # concat demuxer: re-encode once so mixed sources (different models, different encoders)
    # land on a single consistent stream.
    listing = out_dir / "concat.txt"
    listing.write_text("".join(f"file '{p.resolve()}'\n" for _, p in clips))

    master = out_dir / "master.mp4"
    cmd = [
        _ffmpeg(), "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
        "-r", str(ep.fps),
        "-c:v", "libx264", "-preset", "slow", "-crf", "17",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        str(master),
    ]
    subprocess.run(cmd, check=True, capture_output=True)

    burn = ep.captions.get("burn_in", True) if burn_captions is None else burn_captions
    if burn:
        srt = write_srt(ep, out_dir)
        captioned = out_dir / "master_captioned.mp4"
        style = "FontName=Arial Black,FontSize=16,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Alignment=2,MarginV=120"
        subprocess.run(
            [_ffmpeg(), "-y", "-i", str(master),
             "-vf", f"subtitles={srt}:force_style='{style}'",
             "-c:a", "copy", str(captioned)],
            check=True, capture_output=True,
        )
        return captioned
    return master


def _ts(seconds: float) -> str:
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int((s % 1) * 1000):03d}"


def write_srt(ep: Episode, out_dir: Path) -> Path:
    """Caption track from dialogue and on-screen text. Separate from generation on purpose."""
    lines, t, idx = [], 0.0, 1
    for shot in ep.shots:
        text = shot.on_screen_text or (shot.dialogue or {}).get("line", "")
        if text:
            lines.append(f"{idx}\n{_ts(t)} --> {_ts(t + shot.duration)}\n{text}\n")
            idx += 1
        t += shot.duration
    srt = out_dir / f"{ep.id}.srt"
    srt.write_text("\n".join(lines))
    return srt


FCPXML_TMPL = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
    <format id="r0" name="FFVideoFormat" frameDuration="1/{fps}s" width="{w}" height="{h}"/>
{assets}  </resources>
  <library>
    <event name="{show}">
      <project name="{title}">
        <sequence format="r0" duration="{total}s" tcStart="0s" tcFormat="NDF">
          <spine>
{clips}          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
"""


def export_fcpxml(ep: Episode, out_dir: Path | None = None) -> Path:
    """Export an FCPXML timeline — the 're-cuttable' half of editable.

    Opens in DaVinci Resolve, Premiere Pro and Final Cut with every locked take on the timeline
    as its own clip, so a human editor can finish the piece properly. See docs/00-RESEARCH.md §4.
    """
    out_dir = out_dir or (OUT / ep.id)
    out_dir.mkdir(parents=True, exist_ok=True)
    clips = locked_clips(ep)
    w, h = {"9:16": (1080, 1920), "16:9": (1920, 1080), "1:1": (1080, 1080)}[ep.aspect]

    assets, spine, offset = [], [], 0.0
    for i, (shot_id, path) in enumerate(clips, start=1):
        dur = ep.shot(shot_id).duration
        assets.append(
            f'    <asset id="a{i}" name="{escape(shot_id)}" src="file://{escape(str(path.resolve()))}" '
            f'hasVideo="1" hasAudio="1" duration="{dur}s" format="r0"/>\n'
        )
        spine.append(
            f'            <asset-clip ref="a{i}" name="{escape(shot_id)}" '
            f'offset="{offset}s" duration="{dur}s" start="0s"/>\n'
        )
        offset += dur

    xml = FCPXML_TMPL.format(
        fps=ep.fps, w=w, h=h, show=escape(ep.show), title=escape(ep.title),
        total=ep.runtime, assets="".join(assets), clips="".join(spine),
    )
    out = out_dir / f"{ep.id}.fcpxml"
    out.write_text(xml)
    return out


VARIANTS = {
    "A": "story cut — full episode, 9:16",
    "B": "hook swap — alternate first 3s, same body",
    "C": "lesson cut — direct address only, ~12s",
    "D": "landscape — 16:9 recrop for YouTube/X",
    "E": "carousel still — key frame + the number + the lesson",
}


def variant_plan(ep: Episode) -> dict[str, dict]:
    """What the five published cuts are for this episode. See docs/03-SERIES-BIBLE.md."""
    direct = [s.id for s in ep.shots if s.shot_type == "direct_address"]
    hook = [s.id for s in ep.shots if s.role == "hook"]
    return {
        "A": {"desc": VARIANTS["A"], "shots": [s.id for s in ep.shots], "aspect": ep.aspect},
        "B": {"desc": VARIANTS["B"], "shots": [s.id for s in ep.shots], "aspect": ep.aspect,
              "replace_hook": hook},
        "C": {"desc": VARIANTS["C"], "shots": direct, "aspect": ep.aspect},
        "D": {"desc": VARIANTS["D"], "shots": [s.id for s in ep.shots], "aspect": "16:9"},
        "E": {"desc": VARIANTS["E"], "shots": hook[:1] or [ep.shots[0].id], "aspect": "1:1",
              "still": True},
    }
