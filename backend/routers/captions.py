"""Caption generation endpoint."""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from services.caption_generator import generate_srt, generate_vtt, generate_ass, save_captions

logger = logging.getLogger(__name__)
router = APIRouter()


class CaptionWord(BaseModel):
    word: str
    start: float
    end: float
    confidence: float = 0.0


class CaptionStyle(BaseModel):
    fontName: str = "Arial"
    fontSize: int = 48
    fontColor: str = "&H00FFFFFF"
    backgroundColor: str = "&H80000000"
    position: str = "bottom"
    bold: bool = True


class CaptionRequest(BaseModel):
    words: List[CaptionWord]
    deleted_indices: List[int] = []
    format: str = "srt"
    words_per_line: int = 8
    style: Optional[CaptionStyle] = None
    output_path: Optional[str] = None


@router.post("/captions")
async def generate_captions(req: CaptionRequest):
    try:
        words_dicts = [w.model_dump() for w in req.words]
        deleted_set = set(req.deleted_indices)

        if req.format == "srt":
            content = generate_srt(words_dicts, deleted_set, req.words_per_line)
        elif req.format == "vtt":
            content = generate_vtt(words_dicts, deleted_set, req.words_per_line)
        elif req.format == "ass":
            style_dict = req.style.model_dump() if req.style else None
            content = generate_ass(words_dicts, deleted_set, req.words_per_line, style_dict)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown format: {req.format}")

        if req.output_path:
            saved = save_captions(content, req.output_path)
            return {"status": "ok", "output_path": saved}

        return PlainTextResponse(content, media_type="text/plain")

    except Exception as e:
        logger.error(f"Caption generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
