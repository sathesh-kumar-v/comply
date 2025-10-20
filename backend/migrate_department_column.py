#!/usr/bin/env python3
"""
Migration script to rename the department column to department_id in the users table.
This fixes the schema mismatch between the model and database.

For production, run this with your DATABASE_URL:
export DATABASE_URL="postgresql://complyx_db_user:hAKDq5SpLibMuYxeAnQyPQUUTmJB2gh3@dpg-d2hh43ndiees73eheaq0-a.oregon-postgres.render.com/complyx_db"
python3 migrate_department_column.py
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
            print("Starting department column migration...")
            
            # Check if department column exists and department_id doesn't
            check_columns_query = """
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name IN ('department', 'department_id');
            """
            
            result = connection.execute(text(check_columns_query))
            existing_columns = [row[0] for row in result.fetchall()]
            
            print(f"Found columns: {existing_columns}")
            
            if 'department' in existing_columns and 'department_id' not in existing_columns:
                # Rename department to department_id
                rename_query = "ALTER TABLE users RENAME COLUMN department TO department_id;"
                print(f"Executing: {rename_query}")
                connection.execute(text(rename_query))
                connection.commit()
                print("Successfully renamed department column to department_id!")
                
            elif 'department_id' in existing_columns:
                print("Column department_id already exists, no migration needed.")
                
            elif 'department' not in existing_columns and 'department_id' not in existing_columns:
                # Neither column exists, create department_id
                create_query = "ALTER TABLE users ADD COLUMN department_id INTEGER REFERENCES departments(id);"
                print(f"Executing: {create_query}")
                connection.execute(text(create_query))
                connection.commit()
                print("Successfully created department_id column!")
                
            else:
                print("Unexpected column state, manual intervention required.")
            
            print("Department column migration completed successfully!")
            
        except Exception as e:
            print(f"Migration failed: {e}")
            connection.rollback()
            sys.exit(1)

if __name__ == "__main__":
    run_migration()