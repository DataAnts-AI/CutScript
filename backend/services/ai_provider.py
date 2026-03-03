"""
Unified AI provider interface for Ollama, OpenAI, and Claude.
"""

import json
import logging
from typing import Optional, List

import requests

logger = logging.getLogger(__name__)


class AIProvider:
    """Routes completion requests to the configured provider."""

    @staticmethod
    def complete(
        prompt: str,
        provider: str = "ollama",
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
    ) -> str:
        if provider == "ollama":
            return _ollama_complete(prompt, model or "llama3", base_url or "http://localhost:11434", system_prompt, temperature)
        elif provider == "openai":
            return _openai_complete(prompt, model or "gpt-4o", api_key or "", system_prompt, temperature)
        elif provider == "claude":
            return _claude_complete(prompt, model or "claude-sonnet-4-20250514", api_key or "", system_prompt, temperature)
        else:
            raise ValueError(f"Unknown provider: {provider}")

    @staticmethod
    def list_ollama_models(base_url: str = "http://localhost:11434") -> List[str]:
        try:
            resp = requests.get(f"{base_url}/api/tags", timeout=3)
            if resp.status_code == 200:
                return [m["name"] for m in resp.json().get("models", [])]
        except Exception:
            pass
        return []


def _ollama_complete(prompt: str, model: str, base_url: str, system_prompt: Optional[str], temperature: float) -> str:
    body = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": temperature},
    }
    if system_prompt:
        body["system"] = system_prompt

    try:
        resp = requests.post(f"{base_url}/api/generate", json=body, timeout=120)
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
    except Exception as e:
        logger.error(f"Ollama error: {e}")
        raise


def _openai_complete(prompt: str, model: str, api_key: str, system_prompt: Optional[str], temperature: float) -> str:
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"OpenAI error: {e}")
        raise


def _claude_complete(prompt: str, model: str, api_key: str, system_prompt: Optional[str], temperature: float) -> str:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        kwargs = {
            "model": model,
            "max_tokens": 4096,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        response = client.messages.create(**kwargs)
        return response.content[0].text.strip()
    except Exception as e:
        logger.error(f"Claude error: {e}")
        raise


def detect_filler_words(
    transcript: str,
    words: List[dict],
    provider: str = "ollama",
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    custom_filler_words: Optional[str] = None,
) -> dict:
    """
    Use an LLM to identify filler words in the transcript.
    Returns {"wordIndices": [...], "fillerWords": [{"index": N, "word": "...", "reason": "..."}]}
    """
    word_list = "\n".join(f"{w['index']}: {w['word']}" for w in words)

    custom_line = ""
    if custom_filler_words and custom_filler_words.strip():
        custom_line = f"\n\nAdditionally, flag these user-specified filler words/phrases: {custom_filler_words.strip()}"

    prompt = f"""Analyze this transcript for filler words and verbal hesitations.

Filler words include: um, uh, uh huh, hmm, like (when used as filler), you know, so (when starting sentences unnecessarily), basically, actually, literally, right, I mean, kind of, sort of, well (when used as filler).

Also flag repeated words that indicate stammering (e.g., "I I I" or "the the").{custom_line}

Here are the words with their indices:
{word_list}

Return ONLY a valid JSON object with this exact structure:
{{"wordIndices": [list of integer indices to remove], "fillerWords": [{{"index": integer, "word": "the word", "reason": "brief reason"}}]}}

Be conservative -- only flag clear filler words, not words that are part of meaningful sentences."""

    system = "You are a precise text analysis tool. Return only valid JSON, no explanation."

    result_text = AIProvider.complete(
        prompt=prompt,
        provider=provider,
        model=model,
        api_key=api_key,
        base_url=base_url,
        system_prompt=system,
        temperature=0.1,
    )

    try:
        start = result_text.find("{")
        end = result_text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(result_text[start:end])
    except json.JSONDecodeError:
        logger.error(f"Failed to parse AI response as JSON: {result_text[:200]}")

    return {"wordIndices": [], "fillerWords": []}


def create_clip_suggestion(
    transcript: str,
    words: List[dict],
    target_duration: int = 60,
    provider: str = "ollama",
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> dict:
    """
    Use an LLM to find the best clip segments in a transcript.
    """
    word_list = "\n".join(
        f"{w['index']}: \"{w['word']}\" ({w.get('start', 0):.1f}s - {w.get('end', 0):.1f}s)"
        for w in words
    )

    prompt = f"""Analyze this transcript and find the most engaging {target_duration}-second segment(s) that would work well as a YouTube Short or social media clip.

Look for: compelling stories, surprising facts, emotional moments, clear explanations, humor, or quotable statements.

Words with indices and timestamps:
{word_list}

Return ONLY a valid JSON object:
{{"clips": [{{"title": "short catchy title", "startWordIndex": integer, "endWordIndex": integer, "startTime": float, "endTime": float, "reason": "why this segment is engaging"}}]}}

Suggest 1-3 clips, each approximately {target_duration} seconds long."""

    system = "You are a viral content expert. Return only valid JSON, no explanation."

    result_text = AIProvider.complete(
        prompt=prompt,
        provider=provider,
        model=model,
        api_key=api_key,
        base_url=base_url,
        system_prompt=system,
        temperature=0.5,
    )

    try:
        start = result_text.find("{")
        end = result_text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(result_text[start:end])
    except json.JSONDecodeError:
        logger.error(f"Failed to parse clip suggestions: {result_text[:200]}")

    return {"clips": []}
