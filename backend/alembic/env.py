import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Alembic Config object
config = context.config

# Read DB URL from env if present (fallback to sqlite absolute path)
db_url = os.getenv("DATABASE_URL", "sqlite:///D:/Sathesh%20GPT/Comply-X/backend/db.sqlite3")
config.set_main_option("sqlalchemy.url", db_url)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# --- Import your SQLAlchemy Base and models ---
# Adjust these imports to match your project structure
# Example if you have backend/database.py and backend/models/calendar.py:
from database import Base  # exposes Base = declarative_base()
from models.calendar import CalendarEvent  # ensure models are imported so metadata sees them
# If your packages are modules (e.g., backend.database), use:
# from backend.database import Base
# from backend.models.calendar import CalendarEvent

target_metadata = Base.metadata

def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # helpful flags:
        compare_type=True,
        compare_server_default=True,
        render_as_batch=True,  # important for SQLite schema changes
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            render_as_batch=True,  # important for SQLite
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
