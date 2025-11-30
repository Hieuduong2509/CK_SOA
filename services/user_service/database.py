from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from models import Base
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/marketplace_db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE packages
                ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';
        """))
        conn.execute(text("""
            ALTER TABLE packages
                ADD COLUMN IF NOT EXISTS cover_image TEXT;
        """))
        conn.execute(text("""
            ALTER TABLE packages
                ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]'::jsonb;
        """))
        conn.execute(text("""
            ALTER TABLE packages
                ADD COLUMN IF NOT EXISTS category VARCHAR(100);
        """))
        conn.execute(text("""
            ALTER TABLE packages
                ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '[]'::jsonb;
        """))
        conn.execute(text("""
            ALTER TABLE packages
                ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
        """))
        conn.execute(text("""
            ALTER TABLE packages
                ADD COLUMN IF NOT EXISTS faq JSONB DEFAULT '[]'::jsonb;
        """))
        conn.execute(text("""
            ALTER TABLE packages
                ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION DEFAULT 0;
        """))
        conn.execute(text("""
            ALTER TABLE packages
                ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;
        """))
        conn.execute(text("""
            ALTER TABLE packages
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
        """))
        conn.execute(text("""
            ALTER TABLE packages
                ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
        """))
        conn.execute(text("""
            UPDATE packages
            SET status = CASE
                WHEN status IN ('published') THEN 'approved'
                WHEN status IN ('pending_approval') THEN 'pending'
                WHEN status IN ('suspended') THEN 'hidden'
                ELSE COALESCE(status, 'draft')
            END
        """))
        conn.commit()

