#!/usr/bin/env python3
"""Simple migration runner shared by all services.

Usage::

    python migrations/run_migrations.py

The script looks for ``DATABASE_URL`` in the environment.  It will attempt to
load ``.env`` files from the repository root as well as the service folders so
that running it from any shell picks up the same configuration used by the
bots and the website.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from psycopg import connect
from psycopg.rows import tuple_row


PROJECT_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = Path(__file__).resolve().parent / "sql"


def load_environment() -> None:
    """Load environment variables from available .env files."""

    env_files = [
        PROJECT_ROOT / ".env",
        PROJECT_ROOT / "website" / ".env",
        PROJECT_ROOT / "signals-bot" / ".env",
        PROJECT_ROOT / "trading-mentor-bot" / ".env",
    ]

    for env_path in env_files:
        if env_path.exists():
            load_dotenv(env_path, override=False)


def ensure_schema_table(cursor) -> None:
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )


def get_applied_migrations(cursor) -> set[str]:
    cursor.execute("SELECT name FROM schema_migrations")
    rows = cursor.fetchall()
    applied = {row[0] for row in rows}
    return applied


def run_pending_migrations(cursor) -> list[str]:
    if not MIGRATIONS_DIR.exists():
        MIGRATIONS_DIR.mkdir(parents=True, exist_ok=True)

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    applied = get_applied_migrations(cursor)
    executed: list[str] = []

    for migration in migration_files:
        name = migration.stem
        if name in applied:
            continue

        sql_text = migration.read_text(encoding="utf-8").strip()
        if sql_text:
            cursor.execute(sql_text)

        cursor.execute(
            "INSERT INTO schema_migrations (name) VALUES (%s)", (name,)
        )
        cursor.connection.commit()
        executed.append(name)

    return executed


def main() -> int:
    load_environment()
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        print("[migrations] DATABASE_URL is not set. Aborting.", file=sys.stderr)
        return 1

    if not MIGRATIONS_DIR.exists():
        MIGRATIONS_DIR.mkdir(parents=True, exist_ok=True)

    with connect(database_url) as conn:
        conn.row_factory = tuple_row
        with conn.cursor() as cur:
            ensure_schema_table(cur)
            executed = run_pending_migrations(cur)
        conn.commit()

    if executed:
        for name in executed:
            print(f"[migrations] Applied {name}")
    else:
        print("[migrations] No pending migrations")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


