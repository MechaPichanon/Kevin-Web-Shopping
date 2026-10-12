"""
Single text-completion call shared by the chat reply (main.py) and the intent
classifier (intent.py), so both always use the same backend:

  OPENROUTER_API_KEY set   → OpenRouter /chat/completions, OPENROUTER_CHAT_MODEL
  OPENROUTER_API_KEY unset → local Ollama /api/generate, OLLAMA_CHAT_MODEL

On the cloud VM (docs/adr/0001) Ollama only hosts bge-m3, so a call that went to
Ollama there would fail — hence one switch for every LLM call.
"""
import os
from typing import Optional

import requests

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "qwen2.5:7b")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
# Interim default (the original pick, Typhoon2, was delisted from
# OpenRouter) — pending the user's own Thai-quality comparison against
# qwen/qwen3.7-flash.
OPENROUTER_CHAT_MODEL = os.getenv("OPENROUTER_CHAT_MODEL", "google/gemini-3.5-flash-lite")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
# "off" sends reasoning.enabled=false: reasoning models (e.g. qwen3.7-flash)
# skip their hidden "thinking" step — much faster and cheaper per reply.
# "on" (default) sends nothing, so the model uses its own default.
OPENROUTER_REASONING = os.getenv("OPENROUTER_REASONING", "on").strip().lower()


class LLMError(Exception):
    """The LLM call failed (network error, HTTP error, or unexpected response)."""


def backend_name() -> str:
    return f"OpenRouter ({OPENROUTER_CHAT_MODEL}, reasoning {OPENROUTER_REASONING})" if OPENROUTER_API_KEY else f"Ollama ({OLLAMA_CHAT_MODEL})"


def complete(prompt: str, *, temperature: Optional[float] = None, timeout: float = 300) -> str:
    """Send one user prompt, return the model's text. Raises LLMError on any failure."""
    try:
        if OPENROUTER_API_KEY:
            body = {"model": OPENROUTER_CHAT_MODEL,
                    "messages": [{"role": "user", "content": prompt}]}
            if temperature is not None:
                body["temperature"] = temperature
            if OPENROUTER_REASONING == "off":
                body["reasoning"] = {"enabled": False}
            resp = requests.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
                json=body,
                timeout=timeout,
            )
            data = resp.json()
            try:
                return data["choices"][0]["message"]["content"] or ""
            except (KeyError, IndexError, TypeError):
                raise LLMError(f"unexpected OpenRouter response (HTTP {resp.status_code}): {data}")

        body = {"model": OLLAMA_CHAT_MODEL, "prompt": prompt, "stream": False}
        if temperature is not None:
            body["options"] = {"temperature": temperature}
        resp = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=body, timeout=timeout)
        data = resp.json()
        if "response" not in data:
            raise LLMError(f"unexpected Ollama response (HTTP {resp.status_code}): {data}")
        return data["response"]
    except (requests.RequestException, ValueError) as exc:  # ValueError: body wasn't JSON
        raise LLMError(f"{backend_name()} request failed: {exc}") from exc
