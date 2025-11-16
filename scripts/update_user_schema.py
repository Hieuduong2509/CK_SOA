#!/usr/bin/env python3
"""Ensure user_service related tables have latest columns."""

import os
import psycopg2

MAIN_DB_URL = os.getenv(
    "MAIN_DB_URL",
    "postgresql://postgres:postgres@localhost:5432/marketplace_db",
)

ALTER_STATEMENTS = [
    "ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);",
    "ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);",
    "ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(255);",
    "ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS headline VARCHAR(255);",
    "ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS categories JSONB;",
    "ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS badges JSONB;",
    "ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS response_time_label VARCHAR(255);",
    "ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS experience_level VARCHAR(50);",
    "ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS hourly_rate DOUBLE PRECISION;",
    "ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS languages JSONB;",
]

POST_QUERIES = [
    "UPDATE profiles SET categories = '[]'::jsonb WHERE categories IS NULL;",
    "UPDATE profiles SET badges = '[]'::jsonb WHERE badges IS NULL;",
    "UPDATE profiles SET languages = '[]'::jsonb WHERE languages IS NULL;",
    "ALTER TABLE profiles ALTER COLUMN categories SET DEFAULT '[]'::jsonb;",
    "ALTER TABLE profiles ALTER COLUMN badges SET DEFAULT '[]'::jsonb;",
    "ALTER TABLE profiles ALTER COLUMN languages SET DEFAULT '[]'::jsonb;",
]


def main():
    conn = psycopg2.connect(MAIN_DB_URL)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            for stmt in ALTER_STATEMENTS:
                cur.execute(stmt)
            for stmt in POST_QUERIES:
                cur.execute(stmt)
        print("✓ User profiles table updated")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
