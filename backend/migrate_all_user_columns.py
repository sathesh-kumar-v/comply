#!/usr/bin/env python3
"""
Comprehensive migration script to fix all user table column mismatches.
This aligns the database schema with the current User model.
"""

from sqlalchemy import create_engine, text
import os
import sys

def run_migration():
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./comply_x.db")
    
    print(f"Connecting to database: {DATABASE_URL[:50]}...")
    
    if DATABASE_URL.startswith("sqlite"):
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    else:
        engine = create_engine(DATABASE_URL)
    
    with engine.connect() as connection:
        try:
            print("Starting comprehensive user table migration...")
            
            # Get current column info
            check_query = """
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY column_name;
            """
            
            result = connection.execute(text(check_query))
            existing_columns = {row[0]: row[1] for row in result.fetchall()}
            
            print(f"Current columns: {list(existing_columns.keys())}")
            
            migrations = []
            
            # Fix reporting_manager column (should be reporting_manager_id INTEGER)
            if 'reporting_manager' in existing_columns and 'reporting_manager_id' not in existing_columns:
                migrations.append("ALTER TABLE users RENAME COLUMN reporting_manager TO reporting_manager_id;")
                migrations.append("ALTER TABLE users ALTER COLUMN reporting_manager_id TYPE INTEGER USING reporting_manager_id::integer;")
                migrations.append("ALTER TABLE users ADD CONSTRAINT fk_users_reporting_manager FOREIGN KEY (reporting_manager_id) REFERENCES users(id);")
            
            # Add missing columns if they don't exist
            required_columns = {
                'phone': 'VARCHAR(20)',
                'position': 'VARCHAR(100)', 
                'avatar_url': 'VARCHAR(500)',
                'employee_id': 'VARCHAR(50)',
                'areas_of_responsibility': 'TEXT',
                'mfa_enabled': 'BOOLEAN DEFAULT FALSE',
                'failed_login_attempts': 'INTEGER DEFAULT 0',
                'locked_until': 'TIMESTAMP',
                'timezone': "VARCHAR(50) DEFAULT 'America/New_York'",
                'notifications_email': 'BOOLEAN DEFAULT TRUE',
                'notifications_sms': 'BOOLEAN DEFAULT FALSE'
            }
            
            for column, data_type in required_columns.items():
                if column not in existing_columns:
                    migrations.append(f"ALTER TABLE users ADD COLUMN {column} {data_type};")
            
            # Execute migrations
            for migration in migrations:
                try:
                    print(f"Executing: {migration}")
                    connection.execute(text(migration))
                    connection.commit()
                except Exception as e:
                    if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                        print(f"Skipping (already exists): {e}")
                    else:
                        print(f"Error: {e}")
                        # Continue with other migrations
            
            print("User table migration completed successfully!")
            
        except Exception as e:
            print(f"Migration failed: {e}")
            connection.rollback()
            sys.exit(1)

if __name__ == "__main__":
    run_migration()