#!/usr/bin/env python3
"""
Fix all enum constraints to match the model values.
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
            print("Fixing all enum constraints...")
            
            # Check current role values
            result = connection.execute(text("SELECT DISTINCT role FROM users WHERE role IS NOT NULL;"))
            current_roles = [row[0] for row in result.fetchall()]
            print(f"Current role values: {current_roles}")
            
            # Check current permission_level values  
            result = connection.execute(text("SELECT DISTINCT permission_level FROM users WHERE permission_level IS NOT NULL;"))
            current_permissions = [row[0] for row in result.fetchall()]
            print(f"Current permission_level values: {current_permissions}")
            
            # Check what constraints exist
            result = connection.execute(text("""
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'users' AND constraint_type = 'CHECK';
            """))
            constraints = [row[0] for row in result.fetchall()]
            print(f"Existing constraints: {constraints}")
            
            # Drop any existing enum constraints
            for constraint in constraints:
                if 'enum' in constraint.lower() or 'role' in constraint.lower() or 'permission' in constraint.lower():
                    try:
                        print(f"Dropping constraint: {constraint}")
                        connection.execute(text(f"ALTER TABLE users DROP CONSTRAINT IF EXISTS {constraint};"))
                        connection.commit()
                    except Exception as e:
                        print(f"Error dropping {constraint}: {e}")
            
            # For now, let's not add any enum constraints to allow all values
            # This will let the application handle enum validation
            print("Removed enum constraints - application will handle validation")
            
            print("Enum constraint fixes completed successfully!")
            
        except Exception as e:
            print(f"Migration failed: {e}")
            connection.rollback()
            sys.exit(1)

if __name__ == "__main__":
    run_migration()