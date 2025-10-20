#!/usr/bin/env python3
"""
Migration script to add the permission_level column to the users table.
This fixes the production database that's missing this column.

For production, run this with your DATABASE_URL:
export DATABASE_URL="postgresql://complyx_db_user:hAKDq5SpLibMuYxeAnQyPQUUTmJB2gh3@dpg-d2hh43ndiees73eheaq0-a.oregon-postgres.render.com/complyx_db"
python3 migrate_permission_level.py
"""

from sqlalchemy import create_engine, text
import os
import sys

def run_migration():
    # Get database URL from environment or use default
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./comply_x.db")
    
    print(f"Connecting to database: {DATABASE_URL[:50]}...")
    
    if DATABASE_URL.startswith("sqlite"):
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    else:
        engine = create_engine(DATABASE_URL)
    
    with engine.connect() as connection:
        try:
            print("Starting permission_level column migration...")
            
            # Add permission_level column with default value
            query = "ALTER TABLE users ADD COLUMN permission_level VARCHAR(50) DEFAULT 'view_only';"
            
            try:
                print(f"Executing: {query}")
                connection.execute(text(query))
                connection.commit()
                print("Permission_level column added successfully!")
            except Exception as e:
                error_msg = str(e).lower()
                if "already exists" in error_msg or "duplicate column" in error_msg or "column already exists" in error_msg:
                    print(f"Column already exists, skipping: {e}")
                else:
                    print(f"Error executing query: {e}")
                    raise
            
            # For PostgreSQL, add enum constraint
            if not DATABASE_URL.startswith("sqlite"):
                try:
                    constraint_query = """
                    ALTER TABLE users ADD CONSTRAINT permission_level_enum 
                    CHECK (permission_level IN ('view_only', 'link_access', 'edit_access', 'admin_access', 'super_admin'));
                    """
                    print(f"Adding constraint...")
                    connection.execute(text(constraint_query))
                    connection.commit()
                    print("Enum constraint added successfully!")
                except Exception as e:
                    error_msg = str(e).lower()
                    if "already exists" in error_msg or "constraint already exists" in error_msg:
                        print(f"Constraint already exists, skipping: {e}")
                    else:
                        print(f"Warning: Could not add constraint: {e}")
            
            print("Permission level migration completed successfully!")
            
        except Exception as e:
            print(f"Migration failed: {e}")
            connection.rollback()
            sys.exit(1)

if __name__ == "__main__":
    run_migration()