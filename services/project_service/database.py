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
            ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS freelancer_id INTEGER;
        """))
        conn.execute(text("""
            ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS project_type VARCHAR(50) DEFAULT 'BIDDING';
        """))
        conn.execute(text("""
            ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS service_package_id INTEGER;
        """))
        conn.execute(text("""
            ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS requirements_answers JSONB DEFAULT '[]'::jsonb;
        """))
        conn.execute(text("""
            ALTER TABLE projects
                ADD COLUMN IF NOT EXISTS service_snapshot JSONB;
        """))
        conn.execute(text("""
            UPDATE projects
            SET project_type = 'BIDDING'
            WHERE project_type IS NULL;
        """))
        conn.commit()

