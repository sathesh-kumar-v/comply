#!/usr/bin/env python3

import os
import sys
import traceback
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text

def test_database(db_type):
    """Test a specific database configuration"""
    print(f"\n🧪 Testing {db_type.upper()} database...")
    
    try:
        # Set environment variable
        os.environ["DB_TYPE"] = db_type
        
        # Import database after setting environment
        import importlib
        if 'database' in sys.modules:
            importlib.reload(sys.modules['database'])
        
        from database import DATABASE_URL, engine
        
        print(f"   📍 URL: {DATABASE_URL[:50]}{'...' if len(DATABASE_URL) > 50 else ''}")
        
        # Test connection
        with engine.connect() as conn:
            if DATABASE_URL.startswith("sqlite"):
                result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
                tables = result.fetchall()
                print(f"   ✅ Connected - {len(tables)} tables found")
            else:
                result = conn.execute(text("SELECT version()"))
                version = result.fetchone()[0]
                print(f"   ✅ Connected - {version[:50]}...")
                
                result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
                tables = result.fetchall()
                print(f"   📊 Tables: {len(tables)}")
        
        return True
        
    except Exception as e:
        print("   ❌ Failed type:", type(e).__name__)
        # Show DBAPI-level message if present
        if getattr(e, "orig", None):
            print("   ↪ DBAPI:", repr(e.orig))
        # Show SQL statement if present
        if getattr(e, "statement", None):
            print("   ↪ SQL:", e.statement)
        traceback.print_exc(limit=1)
        return False

def main():
    print("🔍 Database Connection Test Suite")
    print("=" * 50)
    
    databases = [
        ("sqlite", "SQLite Local Database"),
        ("local_postgres", "Local PostgreSQL Database"),
        ("external_postgres", "External PostgreSQL Database (Render)")
    ]
    
    results = {}
    
    for db_type, description in databases:
        print(f"\n{'='*20} {description} {'='*20}")
        results[db_type] = test_database(db_type)
    
    print("\n" + "="*60)
    print("📊 Summary:")
    
    for db_type, description in databases:
        status = "✅ Working" if results[db_type] else "❌ Failed"
        print(f"   {db_type:<20} {status}")
    
    working_dbs = [db for db, status in results.items() if status]
    
    if working_dbs:
        print(f"\n💡 Working databases: {', '.join(working_dbs)}")
        print("\n🔧 To switch databases:")
        print("   export DB_TYPE=sqlite           # Use SQLite")
        print("   export DB_TYPE=local_postgres   # Use local PostgreSQL")
        print("   export DB_TYPE=external_postgres # Use external PostgreSQL")
        print("\n   Or start your app with:")
        print("   DB_TYPE=sqlite python main.py")
    
    # Reset to default
    os.environ["DB_TYPE"] = "sqlite"
    
    return len(working_dbs) > 0

if __name__ == "__main__":
    main()