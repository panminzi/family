from __future__ import annotations

import json
import logging
from typing import Any, Optional

import httpx

from ..core.config import get_settings

log = logging.getLogger(__name__)


class AIProvider:
    """Thin wrapper around an OpenAI-compatible Chat Completions endpoint.

    Returns deterministic stub responses when no API key is configured so the
    rest of the system remains functional in local development.
    """

    def __init__(self) -> None:
        s = get_settings()
        self.base_url = s.ai_base_url.rstrip("/")
        self.api_key = s.ai_api_key
        self.text_model = s.ai_model_text
        self.image_model = s.ai_model_image

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.7,
        json_mode: bool = False,
        max_tokens: int = 800,
    ) -> str:
        if not self.enabled:
            return self._stub_chat(messages, json_mode=json_mode)

        payload: dict[str, Any] = {
            "model": self.text_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {"Authorization": f"Bearer {self.api_key}"}
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{self.base_url}/chat/completions", json=payload, headers=headers
            )
            r.raise_for_status()
            data = r.json()
        return data["choices"][0]["message"]["content"]

    async def image_prompt_to_url(self, prompt: str) -> Optional[str]:
        if not self.enabled:
            return None
        headers = {"Authorization": f"Bearer {self.api_key}"}
        payload = {"model": self.image_model, "prompt": prompt, "size": "1024x1024", "n": 1}
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(f"{self.base_url}/images/generations", json=payload, headers=headers)
            r.raise_for_status()
            data = r.json()
        first = (data.get("data") or [{}])[0]
        return first.get("url")

    @staticmethod
    def _stub_chat(messages: list[dict[str, str]], *, json_mode: bool) -> str:
        last = messages[-1]["content"] if messages else ""
        if json_mode:
            return json.dumps(
                {
                    "personality": "温暖、关心家人，偶尔有点啰嗦",
                    "speaking_style": "口语化、爱用反问、家常话",
                    "mood_tendency": "稳定偏正面",
                    "catchphrases": ["快吃菜", "别凉了", "多穿点"],
                    "raw_traits": {"keywords": last.split()[:8]},
                },
                ensure_ascii=False,
            )
        return "（离线模式）大家快来吃饭吧～今天的菜还热着呢。"


_provider: AIProvider | None = None


def get_ai() -> AIProvider:
    global _provider
    if _provider is None:
        _provider = AIProvider()
    return _provider
