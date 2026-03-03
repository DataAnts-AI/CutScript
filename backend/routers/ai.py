"""AI feature endpoints: filler word detection, clip creation, Ollama model listing."""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.ai_provider import AIProvider, detect_filler_words, create_clip_suggestion

logger = logging.getLogger(__name__)
router = APIRouter()


class WordInfo(BaseModel):
    index: int
    word: str
    start: Optional[float] = None
    end: Optional[float] = None


class FillerRequest(BaseModel):
    transcript: str
    words: List[WordInfo]
    provider: str = "ollama"
    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    custom_filler_words: Optional[str] = None


class ClipRequest(BaseModel):
    transcript: str
    words: List[WordInfo]
    provider: str = "ollama"
    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    target_duration: int = 60


@router.post("/ai/filler-removal")
async def filler_removal(req: FillerRequest):
    try:
        words_dicts = [w.model_dump() for w in req.words]
        result = detect_filler_words(
            transcript=req.transcript,
            words=words_dicts,
            provider=req.provider,
            model=req.model,
            api_key=req.api_key,
            base_url=req.base_url,
            custom_filler_words=req.custom_filler_words,
        )
        return result
    except Exception as e:
        logger.error(f"Filler detection failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/create-clip")
async def create_clip(req: ClipRequest):
    try:
        words_dicts = [w.model_dump() for w in req.words]
        result = create_clip_suggestion(
            transcript=req.transcript,
            words=words_dicts,
            target_duration=req.target_duration,
            provider=req.provider,
            model=req.model,
            api_key=req.api_key,
            base_url=req.base_url,
        )
        return result
    except Exception as e:
        logger.error(f"Clip creation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai/ollama-models")
async def ollama_models(base_url: str = "http://localhost:11434"):
    models = AIProvider.list_ollama_models(base_url)
    return {"models": models}
