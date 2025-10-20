#!/usr/bin/env python3
"""
Fix the reporting_manager column conversion issue.
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
            print("Fixing reporting_manager column...")
            
            # First, set empty strings to NULL
            print("Setting empty strings to NULL...")
            connection.execute(text("UPDATE users SET reporting_manager = NULL WHERE reporting_manager = '';"))
            connection.commit()
            
            # Convert valid values to integers, set invalid ones to NULL
            print("Converting valid integer values...")
            connection.execute(text("""
                UPDATE users 
                SET reporting_manager = NULL 
                WHERE reporting_manager IS NOT NULL 
                AND reporting_manager !~ '^[0-9]+$'
            """))
            connection.commit()
            
            # Now alter the column type
            print("Converting column type to INTEGER...")
            connection.execute(text("ALTER TABLE users ALTER COLUMN reporting_manager TYPE INTEGER USING reporting_manager::integer;"))
            connection.commit()
            
            # Add the foreign key constraint
            print("Adding foreign key constraint...")
            connection.execute(text("ALTER TABLE users ADD CONSTRAINT fk_users_reporting_manager FOREIGN KEY (reporting_manager) REFERENCES users(id);"))
            connection.commit()
            
            # Add missing columns
            missing_columns = [
                "ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;", 
                "ALTER TABLE users ADD COLUMN locked_until TIMESTAMP;"
            ]
            
            for query in missing_columns:
                try:
                    print(f"Executing: {query}")
                    connection.execute(text(query))
                    connection.commit()
                except Exception as e:
                    if "already exists" in str(e).lower():
                        print(f"Column already exists, skipping: {e}")
                    else:
                        print(f"Error: {e}")
            
            print("Reporting manager fix completed successfully!")
            
        except Exception as e:
            print(f"Migration failed: {e}")
            connection.rollback()
            sys.exit(1)

if __name__ == "__main__":
    run_migration()