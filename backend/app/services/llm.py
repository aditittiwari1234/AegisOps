"""
services/llm.py — Unified LLM client.
Primary: Gemini 2.0 Flash via google-generativeai SDK.
Fallback: OpenRouter API via httpx (drop-in by setting LLM_PROVIDER=openrouter).
"""
from __future__ import annotations
import os
import json
import httpx
from typing import Type, TypeVar
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

T = TypeVar("T", bound=BaseModel)

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemma-2-9b-it:free")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")


class LLMClient:
    """
    Wraps Gemini and OpenRouter behind a common interface.
    Usage:
        llm = LLMClient()
        result: MySchema = await llm.complete(prompt, MySchema)
    """

    async def complete(self, prompt: str, response_schema: Type[T]) -> T:
        if LLM_PROVIDER == "gemini":
            return await self._gemini(prompt, response_schema)
        return await self._openrouter(prompt, response_schema)

    # ── Gemini ────────────────────────────────────────────────────────────────

    async def _gemini(self, prompt: str, response_schema: Type[T]) -> T:
        import asyncio
        from google import genai
        from google.genai import types

        def _call_gemini():
            client = genai.Client(api_key=GEMINI_API_KEY)
            return client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=response_schema,
                ),
            )

        response = await asyncio.to_thread(_call_gemini)
        raw = response.text
        data = json.loads(raw)
        return response_schema.model_validate(data)


    # ── OpenRouter ────────────────────────────────────────────────────────────

    async def _openrouter(self, prompt: str, response_schema: Type[T]) -> T:
        schema_json = json.dumps(response_schema.model_json_schema(), indent=2)
        system = (
            "You are a JSON-only responder. "
            f"Respond ONLY with a valid JSON object matching this schema:\n{schema_json}\n"
            "No explanation, no markdown fences — pure JSON only."
        )
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": OPENROUTER_MODEL,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"].strip()
            # Strip potential markdown fences
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            data = json.loads(content)

        return response_schema.model_validate(data)

    # ── Retry wrapper ─────────────────────────────────────────────────────────

    async def complete_with_retry(self, prompt: str, response_schema: Type[T], retries: int = 3) -> T:
        """Attempt completion; handle rate limits (429) with backoff and on JSON parse failure retry."""
        import asyncio
        last_err: Exception | None = None
        for attempt in range(retries + 1):
            try:
                return await self.complete(prompt, response_schema)
            except Exception as e:
                last_err = e
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    if attempt < retries:
                        await asyncio.sleep(4.0)
                        continue
                if attempt < retries:
                    prompt = prompt + "\n\nYour previous response was not valid JSON. Respond ONLY with a valid JSON object."
                    await asyncio.sleep(1.0)
        raise RuntimeError(f"LLM failed after {retries + 1} attempts: {last_err}") from last_err


# Singleton
llm = LLMClient()
