FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/chatbot/requirements.txt /app/backend/chatbot/requirements.txt
# CPU-only torch build first — this deploy target has no GPU (see CLAUDE.md/
# ADR 0001), and the default PyPI torch wheel pulls the full CUDA/nvidia-cu*
# toolchain (~2GB+ extra) that's never used here.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r /app/backend/chatbot/requirements.txt

COPY backend /app/backend

EXPOSE 8000

WORKDIR /app/backend
CMD ["uvicorn", "chatbot.main:app", "--host", "0.0.0.0", "--port", "8000"]

