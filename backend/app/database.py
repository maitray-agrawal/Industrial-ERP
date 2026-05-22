import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Retrieve database connection string, defaulting to SQLite in workspace
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./erp.db")

# For SQLite, we must set check_same_thread to False to allow multi-threaded access in FastAPI
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """
    FastAPI dependency that provides a transactional database session.
    Automatically handles cleanup and closing.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
