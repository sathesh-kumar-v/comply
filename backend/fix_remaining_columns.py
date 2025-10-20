#!/usr/bin/env python3
"""
Fix remaining column issues after department rename.
"""

from sqlalchemy import create_engine, text
import os
import sys

def run_migration():
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./comply_x.db")
    
    if DATABASE_URL.startswith("sqlite"):
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    else:
        engine = create_engine(DATABASE_URL)
    
    with engine.connect() as connection:
        try:
            print("Fixing remaining user table columns...")
            
            # Fix reporting_manager_id column (it's currently VARCHAR, should be INTEGER)
            print("Fixing reporting_manager_id column...")
            
            # Set empty strings to NULL
            connection.execute(text("UPDATE users SET reporting_manager_id = NULL WHERE reporting_manager_id = '' OR reporting_manager_id = 'NULL';"))
            connection.commit()
            
            # Convert to integer type
            connection.execute(text("ALTER TABLE users ALTER COLUMN reporting_manager_id TYPE INTEGER USING CASE WHEN reporting_manager_id ~ '^[0-9]+$' THEN reporting_manager_id::integer ELSE NULL END;"))
            connection.commit()
            
            # Add missing columns
            missing_columns = [
                ("mfa_enabled", "ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE;"),
                ("failed_login_attempts", "ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;"), 
                ("locked_until", "ALTER TABLE users ADD COLUMN locked_until TIMESTAMP;")
            ]
            
            # Check which columns exist
            result = connection.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'users';"))
            existing_columns = [row[0] for row in result.fetchall()]
            
            for column_name, query in missing_columns:
                if column_name not in existing_columns:
                    try:
                        print(f"Adding column: {column_name}")
                        connection.execute(text(query))
                        connection.commit()
                    except Exception as e:
                        print(f"Error adding {column_name}: {e}")
                else:
                    print(f"Column {column_name} already exists")
            
            print("User table fixes completed successfully!")
            
        except Exception as e:
            print(f"Migration failed: {e}")
            connection.rollback()
            sys.exit(1)

if __name__ == "__main__":
    run_migration()