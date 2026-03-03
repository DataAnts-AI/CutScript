"""
Generate caption files (SRT, VTT, ASS) from word-level timestamps.
"""

import logging
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)


def _format_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _format_vtt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def _format_ass_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def generate_srt(
    words: List[dict],
    deleted_indices: Optional[set] = None,
    words_per_line: int = 8,
) -> str:
    """Generate SRT caption content from word-level timestamps."""
    deleted_indices = deleted_indices or set()
    active_words = [(i, w) for i, w in enumerate(words) if i not in deleted_indices]

    lines = []
    counter = 1
    for chunk_start in range(0, len(active_words), words_per_line):
        chunk = active_words[chunk_start:chunk_start + words_per_line]
        if not chunk:
            continue

        start_time = chunk[0][1]["start"]
        end_time = chunk[-1][1]["end"]
        text = " ".join(w["word"] for _, w in chunk)

        lines.append(str(counter))
        lines.append(f"{_format_srt_time(start_time)} --> {_format_srt_time(end_time)}")
        lines.append(text)
        lines.append("")
        counter += 1

    return "\n".join(lines)


def generate_vtt(
    words: List[dict],
    deleted_indices: Optional[set] = None,
    words_per_line: int = 8,
) -> str:
    """Generate WebVTT caption content."""
    deleted_indices = deleted_indices or set()
    active_words = [(i, w) for i, w in enumerate(words) if i not in deleted_indices]

    lines = ["WEBVTT", ""]
    for chunk_start in range(0, len(active_words), words_per_line):
        chunk = active_words[chunk_start:chunk_start + words_per_line]
        if not chunk:
            continue

        start_time = chunk[0][1]["start"]
        end_time = chunk[-1][1]["end"]
        text = " ".join(w["word"] for _, w in chunk)

        lines.append(f"{_format_vtt_time(start_time)} --> {_format_vtt_time(end_time)}")
        lines.append(text)
        lines.append("")

    return "\n".join(lines)


def generate_ass(
    words: List[dict],
    deleted_indices: Optional[set] = None,
    words_per_line: int = 8,
    style: Optional[dict] = None,
) -> str:
    """Generate ASS subtitle content with styling."""
    deleted_indices = deleted_indices or set()
    active_words = [(i, w) for i, w in enumerate(words) if i not in deleted_indices]

    s = style or {}
    font = s.get("fontName", "Arial")
    size = s.get("fontSize", 48)
    color = s.get("fontColor", "&H00FFFFFF")
    bold = "-1" if s.get("bold", True) else "0"
    alignment = 2

    header = f"""[Script Info]
Title: AI Video Editor Captions
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font},{size},{color},&H000000FF,&H00000000,&H80000000,{bold},0,0,0,100,100,0,0,1,2,1,{alignment},20,20,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events = []
    for chunk_start in range(0, len(active_words), words_per_line):
        chunk = active_words[chunk_start:chunk_start + words_per_line]
        if not chunk:
            continue

        start_time = chunk[0][1]["start"]
        end_time = chunk[-1][1]["end"]
        text = " ".join(w["word"] for _, w in chunk)

        events.append(
            f"Dialogue: 0,{_format_ass_time(start_time)},{_format_ass_time(end_time)},Default,,0,0,0,,{text}"
        )

    return header + "\n".join(events) + "\n"


def save_captions(
    content: str,
    output_path: str,
) -> str:
    """Write caption content to a file."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    logger.info(f"Saved captions to {output_path}")
    return str(output_path)
