"""
FFmpeg-based video cutting engine.
Uses stream copy for fast, lossless cuts and falls back to re-encode when needed.
"""

import logging
import subprocess
import tempfile
import os
from pathlib import Path
from typing import List

logger = logging.getLogger(__name__)


def _find_ffmpeg() -> str:
    """Locate ffmpeg binary."""
    for cmd in ["ffmpeg", "ffmpeg.exe"]:
        try:
            subprocess.run([cmd, "-version"], capture_output=True, check=True)
            return cmd
        except (FileNotFoundError, subprocess.CalledProcessError):
            continue
    raise RuntimeError("FFmpeg not found. Install it or add it to PATH.")


def export_stream_copy(
    input_path: str,
    output_path: str,
    keep_segments: List[dict],
) -> str:
    """
    Export video using FFmpeg concat demuxer with stream copy.
    ~100x faster than re-encoding. No quality loss.

    Args:
        input_path: source video file
        output_path: destination file
        keep_segments: list of {"start": float, "end": float} to keep

    Returns:
        output_path on success
    """
    ffmpeg = _find_ffmpeg()
    input_path = str(Path(input_path).resolve())
    output_path = str(Path(output_path).resolve())

    if not keep_segments:
        raise ValueError("No segments to export")

    temp_dir = tempfile.mkdtemp(prefix="aive_export_")

    try:
        segment_files = []
        for i, seg in enumerate(keep_segments):
            seg_file = os.path.join(temp_dir, f"seg_{i:04d}.ts")
            cmd = [
                ffmpeg, "-y",
                "-ss", str(seg["start"]),
                "-to", str(seg["end"]),
                "-i", input_path,
                "-c", "copy",
                "-avoid_negative_ts", "make_zero",
                "-f", "mpegts",
                seg_file,
            ]
            logger.info(f"Extracting segment {i}: {seg['start']:.2f}s - {seg['end']:.2f}s")
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                logger.warning(f"Stream copy segment {i} failed, will try re-encode: {result.stderr[-200:]}")
                return export_reencode(input_path, output_path, keep_segments)
            segment_files.append(seg_file)

        concat_str = "|".join(segment_files)
        cmd = [
            ffmpeg, "-y",
            "-i", f"concat:{concat_str}",
            "-c", "copy",
            "-movflags", "+faststart",
            output_path,
        ]
        logger.info(f"Concatenating {len(segment_files)} segments -> {output_path}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.warning(f"Concat failed, falling back to re-encode: {result.stderr[-200:]}")
            return export_reencode(input_path, output_path, keep_segments)

        return output_path

    finally:
        for f in os.listdir(temp_dir):
            try:
                os.remove(os.path.join(temp_dir, f))
            except OSError:
                pass
        try:
            os.rmdir(temp_dir)
        except OSError:
            pass


def export_reencode(
    input_path: str,
    output_path: str,
    keep_segments: List[dict],
    resolution: str = "1080p",
    format_hint: str = "mp4",
) -> str:
    """
    Export video with full re-encode. Slower but supports resolution changes,
    format conversion, and avoids stream-copy edge cases.
    """
    ffmpeg = _find_ffmpeg()
    input_path = str(Path(input_path).resolve())
    output_path = str(Path(output_path).resolve())

    if not keep_segments:
        raise ValueError("No segments to export")

    scale_map = {
        "720p": "scale=-2:720",
        "1080p": "scale=-2:1080",
        "4k": "scale=-2:2160",
    }

    filter_parts = []
    for i, seg in enumerate(keep_segments):
        filter_parts.append(
            f"[0:v]trim=start={seg['start']}:end={seg['end']},setpts=PTS-STARTPTS[v{i}];"
            f"[0:a]atrim=start={seg['start']}:end={seg['end']},asetpts=PTS-STARTPTS[a{i}];"
        )

    n = len(keep_segments)
    concat_inputs = "".join(f"[v{i}][a{i}]" for i in range(n))
    filter_parts.append(f"{concat_inputs}concat=n={n}:v=1:a=1[outv][outa]")

    filter_complex = "".join(filter_parts)

    scale = scale_map.get(resolution, "")
    if scale:
        filter_complex += f";[outv]{scale}[outv_scaled]"
        video_map = "[outv_scaled]"
    else:
        video_map = "[outv]"

    codec_args = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k"]
    if format_hint == "webm":
        codec_args = ["-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-c:a", "libopus"]

    cmd = [
        ffmpeg, "-y",
        "-i", input_path,
        "-filter_complex", filter_complex,
        "-map", video_map,
        "-map", "[outa]",
        *codec_args,
        "-movflags", "+faststart",
        output_path,
    ]

    logger.info(f"Re-encoding {n} segments -> {output_path} ({resolution})")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg re-encode failed: {result.stderr[-500:]}")

    return output_path


def export_reencode_with_subs(
    input_path: str,
    output_path: str,
    keep_segments: List[dict],
    subtitle_path: str,
    resolution: str = "1080p",
    format_hint: str = "mp4",
) -> str:
    """
    Export video with re-encode and burn-in subtitles (ASS format).
    Applies trim+concat first, then overlays the subtitle file.
    """
    ffmpeg = _find_ffmpeg()
    input_path = str(Path(input_path).resolve())
    output_path = str(Path(output_path).resolve())
    subtitle_path = str(Path(subtitle_path).resolve())

    if not keep_segments:
        raise ValueError("No segments to export")

    scale_map = {
        "720p": "scale=-2:720",
        "1080p": "scale=-2:1080",
        "4k": "scale=-2:2160",
    }

    filter_parts = []
    for i, seg in enumerate(keep_segments):
        filter_parts.append(
            f"[0:v]trim=start={seg['start']}:end={seg['end']},setpts=PTS-STARTPTS[v{i}];"
            f"[0:a]atrim=start={seg['start']}:end={seg['end']},asetpts=PTS-STARTPTS[a{i}];"
        )

    n = len(keep_segments)
    concat_inputs = "".join(f"[v{i}][a{i}]" for i in range(n))
    filter_parts.append(f"{concat_inputs}concat=n={n}:v=1:a=1[outv][outa]")

    filter_complex = "".join(filter_parts)

    # Escape path for FFmpeg subtitle filter (Windows backslashes need escaping)
    escaped_sub = subtitle_path.replace("\\", "/").replace(":", "\\:")

    scale = scale_map.get(resolution, "")
    if scale:
        filter_complex += f";[outv]{scale},ass='{escaped_sub}'[outv_final]"
    else:
        filter_complex += f";[outv]ass='{escaped_sub}'[outv_final]"
    video_map = "[outv_final]"

    codec_args = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k"]
    if format_hint == "webm":
        codec_args = ["-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-c:a", "libopus"]

    cmd = [
        ffmpeg, "-y",
        "-i", input_path,
        "-filter_complex", filter_complex,
        "-map", video_map,
        "-map", "[outa]",
        *codec_args,
        "-movflags", "+faststart",
        output_path,
    ]

    logger.info(f"Re-encoding {n} segments with subtitles -> {output_path} ({resolution})")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg re-encode with subs failed: {result.stderr[-500:]}")

    return output_path


def get_video_info(input_path: str) -> dict:
    """Get basic video metadata using ffprobe."""
    ffmpeg = _find_ffmpeg()
    ffprobe = ffmpeg.replace("ffmpeg", "ffprobe")

    cmd = [
        ffprobe, "-v", "quiet",
        "-print_format", "json",
        "-show_format", "-show_streams",
        str(input_path),
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        import json
        data = json.loads(result.stdout)
        fmt = data.get("format", {})
        video_stream = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), {})

        return {
            "duration": float(fmt.get("duration", 0)),
            "size": int(fmt.get("size", 0)),
            "format": fmt.get("format_name", ""),
            "width": int(video_stream.get("width", 0)),
            "height": int(video_stream.get("height", 0)),
            "codec": video_stream.get("codec_name", ""),
            "fps": eval(video_stream.get("r_frame_rate", "0/1")) if "/" in video_stream.get("r_frame_rate", "") else 0,
        }
    except Exception as e:
        logger.error(f"Failed to get video info: {e}")
        return {}
