"""
Speaker diarization service using pyannote.audio.
Refactored from the original repo -- removed Streamlit dependency.
"""

import logging
import os
from pathlib import Path
from typing import Optional

import torch

from utils.gpu_utils import get_optimal_device

logger = logging.getLogger(__name__)

_pipeline_cache = {}


def _get_pipeline(hf_token: str, device: torch.device):
    cache_key = str(device)
    if cache_key in _pipeline_cache:
        return _pipeline_cache[cache_key]

    try:
        from pyannote.audio import Pipeline

        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.0",
            use_auth_token=hf_token,
        )
        if device.type == "cuda":
            pipeline = pipeline.to(device)

        _pipeline_cache[cache_key] = pipeline
        return pipeline
    except Exception as e:
        logger.error(f"Failed to load diarization pipeline: {e}")
        return None


def diarize_and_label(
    transcription_result: dict,
    audio_path: str,
    hf_token: Optional[str] = None,
    num_speakers: Optional[int] = None,
    use_gpu: bool = True,
) -> dict:
    """
    Apply speaker diarization to an existing transcription result.
    Adds 'speaker' field to each word and segment.

    Returns the mutated transcription_result with speaker labels.
    """
    hf_token = hf_token or os.environ.get("HF_TOKEN")
    if not hf_token:
        logger.warning("No HuggingFace token provided; skipping diarization")
        return transcription_result

    device = get_optimal_device() if use_gpu else torch.device("cpu")
    pipeline = _get_pipeline(hf_token, device)
    if pipeline is None:
        return transcription_result

    audio_path = Path(audio_path)
    logger.info(f"Running diarization on {audio_path}")

    try:
        diarization = pipeline(str(audio_path), num_speakers=num_speakers)
    except Exception as e:
        logger.error(f"Diarization failed: {e}")
        return transcription_result

    speaker_map = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        speaker_map.append((turn.start, turn.end, speaker))

    def _find_speaker(start: float, end: float) -> str:
        best_overlap = 0
        best_speaker = "UNKNOWN"
        for s_start, s_end, speaker in speaker_map:
            overlap_start = max(start, s_start)
            overlap_end = min(end, s_end)
            overlap = max(0, overlap_end - overlap_start)
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = speaker
        return best_speaker

    for word in transcription_result.get("words", []):
        word["speaker"] = _find_speaker(word["start"], word["end"])

    for segment in transcription_result.get("segments", []):
        segment["speaker"] = _find_speaker(segment["start"], segment["end"])
        for w in segment.get("words", []):
            w["speaker"] = _find_speaker(w["start"], w["end"])

    return transcription_result
