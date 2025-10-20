#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import psycopg2
from psycopg2.extras import RealDictCursor

# External database connection
EXTERNAL_DB_URL = "postgresql://complyx_db_user:hAKDq5SpLibMuYxeAnQyPQUUTmJB2gh3@dpg-d2hh43ndiees73eheaq0-a.oregon-postgres.render.com/complyx_db"

def check_external_database():
    """Check what tables exist in the external PostgreSQL database"""
    try:
        print("Connecting to external PostgreSQL database...")
        conn = psycopg2.connect(EXTERNAL_DB_URL)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get list of tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        
        print(f"\nTables in external PostgreSQL database ({len(tables)} total):")
        for table in tables:
            print(f"- {table['table_name']}")
        
        # Check if there are any tables at all
        if not tables:
            print("External database appears to be empty - need to create all tables.")
            return False
        
        cursor.close()
        conn.close()
        print("\n✅ Successfully connected to external database")
        return True
        
    except Exception as e:
        print(f"❌ Error connecting to external database: {e}")
        return False

if __name__ == "__main__":
    check_external_database()