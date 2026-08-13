# 03 — OpenRouter chat migration with local Ollama fallback

**What to build:** the chatbot's chat-completion call goes to OpenRouter
(model: `scb10x/typhoon2-70b-instruct`, chosen for Thai-English output
quality — see `../spec.md` §"Chat LLM + embedding model hosting" for the
full rationale) when `OPENROUTER_API_KEY` is set, and falls back to the
existing local Ollama `qwen2.5:7b` call when it isn't — so local
development keeps working without an API key while the deployed demo uses
OpenRouter. This is a call-site branch, not a new provider-abstraction
layer.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] With `OPENROUTER_API_KEY` set and `OPENROUTER_CHAT_MODEL` unset,
      sending a chat message gets a response generated via OpenRouter using
      the default model `scb10x/typhoon2-70b-instruct`.
- [x] With `OPENROUTER_API_KEY` unset, sending a chat message still gets a
      response, generated via local Ollama `qwen2.5:7b` exactly as before —
      no regression to existing local dev behavior.
- [x] `OPENROUTER_CHAT_MODEL` is a working override (setting it to a
      different OpenRouter model id changes which model answers).
- [x] The RAG-injected system prompt (top-`RAG_TOP_K` products +
      conversation history) is confirmed to fit inside Typhoon2's 8K
      context window without silent truncation; if it doesn't fit as-is,
      conversation history is trimmed to make it fit.
- [x] `.env.example` documents `OPENROUTER_API_KEY` and
      `OPENROUTER_CHAT_MODEL` (with the Typhoon2 default shown as the
      example value).
- [x] `CLAUDE.md`'s "Key env vars" section is updated to reflect the new
      `OPENROUTER_CHAT_MODEL` var and that the migration is now implemented
      (not just planned), per `CLAUDE.md`'s own "new comer updated"
      convention.
