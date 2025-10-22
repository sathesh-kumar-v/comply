# from sqlalchemy import create_engine
# from sqlalchemy.ext.declarative import declarative_base
# from sqlalchemy.orm import sessionmaker
# import os

# # Database URL configuration
# # Options: 'sqlite', 'local_postgres', 'external_postgres'
# DB_TYPE = os.getenv("DB_TYPE", "sqlite")

# if DB_TYPE == "sqlite":
#     DATABASE_URL = "sqlite:///./comply_x.db"
# elif DB_TYPE == "local_postgres":
#     DATABASE_URL = "postgresql://logu@localhost/comply-x"
# elif DB_TYPE == "external_postgres":
#     DATABASE_URL = "postgresql://complyx_db_user:hAKDq5SpLibMuYxeAnQyPQUUTmJB2gh3@dpg-d2hh43ndiees73eheaq0-a.oregon-postgres.render.com/complyx_db"
# else:
#     # Fallback to environment variable or SQLite
#     DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./comply_x.db")

# if DATABASE_URL.startswith("sqlite"):
#     engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
# else:
#     engine = create_engine(DATABASE_URL)

# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# Base = declarative_base()

# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()

# database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# --- Add and export Base so models can import it ---
Base = declarative_base()

DB_TYPE = os.getenv("DB_TYPE", "sqlite")

if DB_TYPE == "sqlite":
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DB_PATH = os.path.join(BASE_DIR, "comply_x.db")
    DATABASE_URL = f"sqlite:///{DB_PATH}"
elif DB_TYPE == "local_postgres":
    DATABASE_URL = "postgresql://logu@localhost/comply-x"
elif DB_TYPE == "external_postgres":
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://USER:PASS@HOST:5432/DBNAME?sslmode=require",
    )
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DB_PATH = os.path.join(BASE_DIR, "comply_x.db")
    DATABASE_URL = f"sqlite:///{DB_PATH}"

# SQLAlchemy defaults to the psycopg2 driver for ``postgresql://`` URLs, but the
# project depends on ``psycopg`` (the psycopg3 driver).  Render was failing to
# import ``psycopg2`` during startup, so we explicitly switch the URL scheme to
# ``postgresql+psycopg://`` when needed to ensure SQLAlchemy loads the correct
# driver.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)

engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

__all__ = ["Base", "engine", "SessionLocal", "get_db", "DATABASE_URL"]