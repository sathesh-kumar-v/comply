#!/usr/bin/env python3
"""
Migration script to add new wizard fields to the users table.
Run this script to update your existing database with new columns.
"""

from sqlalchemy import create_engine, text
from database import DATABASE_URL
import sys

def run_migration():
    engine = create_engine(DATABASE_URL)
    
    migration_queries = [
        # Professional Information
        "ALTER TABLE users ADD COLUMN company VARCHAR(200);",
        "ALTER TABLE users ADD COLUMN employee_id VARCHAR(50);",
        
        # Compliance Role & Permissions
        "ALTER TABLE users ADD COLUMN areas_of_responsibility TEXT;",
        "ALTER TABLE users ADD COLUMN reporting_manager VARCHAR(255);",
        
        # Additional Settings
        "ALTER TABLE users ADD COLUMN timezone VARCHAR(50) DEFAULT 'America/New_York';",
        "ALTER TABLE users ADD COLUMN notifications_email BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE users ADD COLUMN notifications_sms BOOLEAN DEFAULT FALSE;",
    ]
    
    with engine.connect() as connection:
        try:
            print("Starting migration...")
            
            for query in migration_queries:
                try:
                    print(f"Executing: {query}")
                    connection.execute(text(query))
                    connection.commit()
                except Exception as e:
                    if "already exists" in str(e) or "duplicate column" in str(e).lower():
                        print(f"Column already exists, skipping: {e}")
                    else:
                        print(f"Error executing query: {e}")
                        raise
            
            print("Migration completed successfully!")
            
        except Exception as e:
            print(f"Migration failed: {e}")
            connection.rollback()
            sys.exit(1)

if __name__ == "__main__":
    run_migration()