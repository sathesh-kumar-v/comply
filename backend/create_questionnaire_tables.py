#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from models import Base
from database import DATABASE_URL

def create_questionnaire_tables():
    """Create questionnaire-related tables"""
    try:
        # Create engine
        engine = create_engine(DATABASE_URL)
        
        # Create tables
        print("Creating questionnaire tables...")
        Base.metadata.create_all(bind=engine, checkfirst=True)
        
        print("✅ Successfully created questionnaire tables:")
        print("   - questionnaires")
        print("   - questions") 
        print("   - questionnaire_responses")
        print("   - answers")
        print("   - questionnaire_analytics")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating questionnaire tables: {e}")
        return False

if __name__ == "__main__":
    create_questionnaire_tables()