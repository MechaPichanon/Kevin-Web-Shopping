"""
Checks that every LLM call follows OPENROUTER_API_KEY — no real network or key
needed (requests.post is replaced by a fake).

    docker exec -w /app/backend/chatbot kevin-web-shopping-backend-1 python tests/test_llm_routing.py
"""
import importlib
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import requests  # noqa: E402

calls = []


class _Resp:
    def __init__(self, data, status=200):
        self._data, self.status_code = data, status

    def json(self):
        return self._data


def fake_post(url, json=None, **kw):
    calls.append((url, json))
    if "openrouter.ai" in url:
        return _Resp({"choices": [{"message": {"content": "store_policy"}}]})
    # Simulates the cloud VM: Ollama has only bge-m3, no chat model.
    raise requests.ConnectionError("no chat model on this Ollama")


def load(key):
    os.environ["OPENROUTER_API_KEY"] = key
    import llm_client
    import intent
    importlib.reload(llm_client)
    importlib.reload(intent)
    return intent


requests.post = fake_post

# 1. Key set + no Ollama chat model → OpenRouter is used, intent is correct.
intent = load("sk-or-fake")
assert intent.detect_intent("ส่งกี่วันคะ") == intent.Intent.STORE_POLICY
assert calls and all("openrouter.ai" in u for u, _ in calls), calls
assert calls[-1][1]["temperature"] == 0, calls[-1][1]
print("ok  key set   → OpenRouter, temperature 0, ส่งกี่วันคะ = store_policy")

# 2. Key unset → Ollama is used (and its failure is logged + falls back, not raised).
calls.clear()
intent = load("")
assert intent.detect_intent("ส่งกี่วันคะ") == intent.Intent.PRODUCT_INFO
assert calls and all("/api/generate" in u for u, _ in calls), calls
assert calls[-1][1]["options"] == {"temperature": 0}, calls[-1][1]
print("ok  key unset → Ollama /api/generate, options.temperature 0, failure → product_info fallback")

# 3. Empty model reply doesn't crash (was IndexError on .split()[0]).
requests.post = lambda url, json=None, **kw: _Resp({"choices": [{"message": {"content": ""}}]})
intent = load("sk-or-fake")
assert intent.detect_intent("ส่งกี่วันคะ") == intent.Intent.PRODUCT_INFO
print("ok  empty reply → product_info fallback, no crash")
print("all passed")
