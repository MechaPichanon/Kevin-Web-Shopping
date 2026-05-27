"""
db.py — Thread-safe PostgreSQL connection pool for the chatbot.

Uses psycopg2 (synchronous) — matches retrieval.py's threading model.
The pool is lazily initialised on first use and returns None when
DATABASE_URL is not configured, so callers can fall back gracefully.

Usage:
    from db import get_conn, release_conn

    conn = get_conn()
    if conn is None:
        # no DB configured — use fallback
        ...
    try:
        cur = conn.cursor()
        cur.execute("SELECT ...")
        rows = cur.fetchall()
    finally:
        release_conn(conn)
"""

import logging
import os
import threading
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy import so the module loads even if psycopg2 is not yet installed
# (avoids ImportError at container build time before pip install runs).
try:
    import psycopg2
    import psycopg2.pool
    _PSYCOPG2_AVAILABLE = True
except ImportError:
    _PSYCOPG2_AVAILABLE = False
    logger.warning("psycopg2 not installed — chatbot will fall back to products.json")

_pool = None
_pool_lock = threading.Lock()

_MIN_CONN = 1
_MAX_CONN = 5


def _get_pool():
    """
    Lazily create the connection pool.
    Returns None when:
      - DATABASE_URL env var is not set
      - psycopg2 is not installed
      - PostgreSQL connection fails
    Never raises — callers treat None as "use fallback".
    """
    global _pool
    if _pool is not None:
        return _pool

    with _pool_lock:
        if _pool is not None:
            return _pool

        if not _PSYCOPG2_AVAILABLE:
            return None

        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            logger.warning(
                "DATABASE_URL is not set — chatbot will fall back to products.json"
            )
            return None

        try:
            _pool = psycopg2.pool.ThreadedConnectionPool(
                _MIN_CONN,
                _MAX_CONN,
                dsn=database_url,
            )
            logger.info(
                "PostgreSQL connection pool ready (min=%d max=%d dsn=%s)",
                _MIN_CONN,
                _MAX_CONN,
                database_url.split("@")[-1],  # log host/db only, not credentials
            )
        except Exception as exc:  # psycopg2.Error or anything unexpected
            logger.error(
                "Failed to create PostgreSQL connection pool: %s "
                "— chatbot will fall back to products.json",
                exc,
            )
            _pool = None

        return _pool


def get_conn():
    """
    Borrow a connection from the pool.
    Returns None if the pool is unavailable (no DATABASE_URL, psycopg2
    not installed, or connection failure).
    Caller MUST call release_conn(conn) in a finally block.
    """
    pool = _get_pool()
    if pool is None:
        return None
    try:
        return pool.getconn()
    except Exception as exc:
        logger.error("Could not get DB connection from pool: %s", exc)
        return None


def release_conn(conn) -> None:
    """Return a borrowed connection back to the pool."""
    if conn is None:
        return
    pool = _get_pool()
    if pool is not None:
        try:
            pool.putconn(conn)
        except Exception as exc:
            logger.warning("Error returning connection to pool: %s", exc)


def close_pool() -> None:
    """Shut down all connections in the pool (call at process exit if needed)."""
    global _pool
    with _pool_lock:
        if _pool is not None:
            try:
                _pool.closeall()
            except Exception as exc:
                logger.warning("Error closing pool: %s", exc)
            _pool = None
