#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from models import Base
from database import DATABASE_URL

def create_auth_tables():
    """Create authentication-related tables"""
    try:
        # Create engine
        engine = create_engine(DATABASE_URL)
        
        # Create tables
        print("Creating authentication tables...")
        Base.metadata.create_all(bind=engine, checkfirst=True)
        
        print("✅ Successfully created authentication tables:")
        print("   - password_reset_tokens")
        print("   - mfa_methods (already exists)")
        print("   - user_devices (already exists)")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating authentication tables: {e}")
        return False

if __name__ == "__main__":
    create_auth_tables()