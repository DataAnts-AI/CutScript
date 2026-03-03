"""Transcription endpoint using WhisperX."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.transcription import transcribe_audio
from services.diarization import diarize_and_label

logger = logging.getLogger(__name__)
router = APIRouter()


class TranscribeRequest(BaseModel):
    file_path: str
    model: str = "base"
    language: Optional[str] = None
    use_gpu: bool = True
    use_cache: bool = True
    diarize: bool = False
    hf_token: Optional[str] = None
    num_speakers: Optional[int] = None


@router.post("/transcribe")
async def transcribe(req: TranscribeRequest):
    try:
        result = transcribe_audio(
            file_path=req.file_path,
            model_name=req.model,
            use_gpu=req.use_gpu,
            use_cache=req.use_cache,
            language=req.language,
        )

        if req.diarize and req.hf_token:
            result = diarize_and_label(
                transcription_result=result,
                audio_path=req.file_path,
                hf_token=req.hf_token,
                num_speakers=req.num_speakers,
                use_gpu=req.use_gpu,
            )

        return result

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {req.file_path}")
    except Exception as e:
        logger.error(f"Transcription failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
