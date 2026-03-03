"""
Audio noise reduction using DeepFilterNet.
Falls back to a basic FFmpeg noise filter if DeepFilterNet is not installed.
"""

import logging
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    from df.enhance import enhance, init_df, load_audio, save_audio
    DEEPFILTER_AVAILABLE = True
except ImportError:
    DEEPFILTER_AVAILABLE = False


_df_model = None
_df_state = None


def _init_deepfilter():
    global _df_model, _df_state
    if _df_model is None:
        logger.info("Initializing DeepFilterNet model")
        _df_model, _df_state, _ = init_df()
    return _df_model, _df_state


def clean_audio(
    input_path: str,
    output_path: str = "",
) -> str:
    """
    Apply noise reduction to an audio file.

    If DeepFilterNet is available, uses it for high-quality results.
    Otherwise falls back to FFmpeg's anlmdn filter.

    Returns: path to the cleaned audio file.
    """
    input_path = Path(input_path)
    if not output_path:
        output_path = str(input_path.with_stem(input_path.stem + "_clean"))

    if DEEPFILTER_AVAILABLE:
        return _clean_with_deepfilter(str(input_path), output_path)
    else:
        return _clean_with_ffmpeg(str(input_path), output_path)


def _clean_with_deepfilter(input_path: str, output_path: str) -> str:
    model, state = _init_deepfilter()
    audio, info = load_audio(input_path, sr=state.sr())
    enhanced = enhance(model, state, audio)
    save_audio(output_path, enhanced, sr=state.sr())
    logger.info(f"DeepFilterNet cleaned audio saved to {output_path}")
    return output_path


def _clean_with_ffmpeg(input_path: str, output_path: str) -> str:
    """Fallback: basic noise reduction using FFmpeg's anlmdn filter."""
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-af", "anlmdn=s=7:p=0.002:r=0.002:m=15",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg audio cleaning failed: {result.stderr[-300:]}")
    logger.info(f"FFmpeg cleaned audio saved to {output_path}")
    return output_path


def is_deepfilter_available() -> bool:
    return DEEPFILTER_AVAILABLE
