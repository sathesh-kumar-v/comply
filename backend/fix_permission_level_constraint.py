#!/usr/bin/env python3
"""
Fix the permission_level enum constraint to match the model values.
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
            print("Fixing permission_level enum constraint...")
            
            # Drop the existing constraint
            print("Dropping old constraint...")
            connection.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS permission_level_enum;"))
            connection.commit()
            
            # Add the correct constraint with lowercase values
            print("Adding correct constraint...")
            constraint_query = """
            ALTER TABLE users ADD CONSTRAINT permission_level_enum 
            CHECK (permission_level IN ('view_only', 'link_access', 'edit_access', 'admin_access', 'super_admin'));
            """
            connection.execute(text(constraint_query))
            connection.commit()
            
            print("Permission level constraint fixed successfully!")
            
        except Exception as e:
            print(f"Migration failed: {e}")
            connection.rollback()
            sys.exit(1)

if __name__ == "__main__":
    run_migration()