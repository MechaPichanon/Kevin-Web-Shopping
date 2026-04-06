-- Enable pgvector and add embedding columns for vector search.
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE IF EXISTS product_chunks
  ADD COLUMN IF NOT EXISTS content_hash TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS embed_model TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS embedding vector(1024);

