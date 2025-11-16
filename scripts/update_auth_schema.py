#!/usr/bin/env python3
"""One-off helper to align auth_service schema with latest models."""

import os
import psycopg2

AUTH_DB_URL = os.getenv(
    "AUTH_DB_URL",
    "postgresql://postgres:postgres@localhost:5432/auth_db",
)

ALTER_STATEMENTS = [
    "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS phone VARCHAR(255);",
    "ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS headline VARCHAR(255);",
]


def main():
    conn = psycopg2.connect(AUTH_DB_URL)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            for stmt in ALTER_STATEMENTS:
                cur.execute(stmt)
        print("✓ Auth users table updated (phone/headline columns ensured)")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
