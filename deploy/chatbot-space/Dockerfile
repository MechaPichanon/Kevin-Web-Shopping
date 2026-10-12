# Hugging Face Space (Docker SDK, CPU basic) for the FastAPI chatbot.
# Copy this file + README.md into the Space repo. The Space builds the code
# from the public GitHub repo, so pushing to GitHub + "Factory rebuild" (or any
# Space restart that rebuilds) deploys new code.
#
# Differences from backend/Dockerfile (local dev):
#   - bge-m3 runs in-process (EMBED_BACKEND=sentence-transformers) — no Ollama
#   - bge-m3 + CLIP weights are downloaded at build time, so the first
#     customer doesn't wait for a 2 GB download
#   - port 7860 (what HF Spaces expects), no --reload, one worker (chat
#     context is in-memory)
# Runtime settings (DATABASE_URL, OPENROUTER_*, INTERNAL_API_KEY, ...) come
# from the Space's "Variables and secrets" — never put them in this file.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models \
    EMBED_BACKEND=sentence-transformers

ARG REPO=MechaPichanon/Kevin-Web-Shopping
ARG BRANCH=main

RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

# 1. Python packages (CPU-only torch first, same as backend/Dockerfile).
#    Re-runs only when requirements.txt on GitHub changes.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
ADD https://raw.githubusercontent.com/${REPO}/${BRANCH}/backend/chatbot/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# 2. Model weights, baked into the image (cached across code-only rebuilds).
RUN python -c "from sentence_transformers import SentenceTransformer as S; S('BAAI/bge-m3', device='cpu'); S('clip-ViT-B-32', device='cpu')" \
    && chmod -R a+rwX /models

# 3. The code. ADDing the branch's latest-commit info busts the cache only
#    when there's a new commit, so a rebuild always gets the current code.
ADD https://api.github.com/repos/${REPO}/commits/${BRANCH} /tmp/latest-commit.json
RUN git clone --depth 1 --branch ${BRANCH} https://github.com/${REPO}.git /app

# HF Spaces run the container as user 1000.
RUN useradd -m -u 1000 user && chown -R user /app
USER user

WORKDIR /app/backend
EXPOSE 7860
CMD ["uvicorn", "chatbot.main:app", "--host", "0.0.0.0", "--port", "7860"]
