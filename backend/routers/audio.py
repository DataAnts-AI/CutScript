"""Audio processing endpoint (noise reduction / Studio Sound)."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.audio_cleaner import clean_audio, is_deepfilter_available

logger = logging.getLogger(__name__)
router = APIRouter()


class AudioCleanRequest(BaseModel):
    input_path: str
    output_path: Optional[str] = None


@router.post("/audio/clean")
async def clean_audio_endpoint(req: AudioCleanRequest):
    try:
        output = clean_audio(req.input_path, req.output_path or "")
        return {
            "status": "ok",
            "output_path": output,
            "engine": "deepfilternet" if is_deepfilter_available() else "ffmpeg_anlmdn",
        }
    except Exception as e:
        logger.error(f"Audio cleaning failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/audio/capabilities")
async def audio_capabilities():
    return {
        "deepfilternet_available": is_deepfilter_available(),
    }
