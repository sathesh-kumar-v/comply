#!/usr/bin/env python3

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from models import Base
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def setup_sqlite():
    """Setup SQLite database (current working setup)"""
    print("🗃️  Setting up SQLite database...")
    
    try:
        # Set environment variable
        os.environ["DB_TYPE"] = "sqlite"
        
        # Import after setting environment
        from database import DATABASE_URL, engine
        
        print(f"   📍 Database URL: {DATABASE_URL}")
        
        # Create tables
        Base.metadata.create_all(bind=engine, checkfirst=True)
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
            tables = result.fetchall()
            print(f"   ✅ SQLite setup complete - {len(tables)} tables")
        
        return True
        
    except Exception as e:
        print(f"   ❌ SQLite setup failed: {e}")
        return False

def setup_local_postgres():
    """Setup local PostgreSQL database"""
    print("🐘 Setting up local PostgreSQL database...")
    
    # First, try to create the database if it doesn't exist
    try:
        print("   🔧 Setting up database and user...")
        
        # Connect to default postgres database
        conn = psycopg2.connect(
            host="localhost",
            database="postgres",
            user="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Create user if not exists
        cursor.execute("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'logu') THEN
                    CREATE USER logu WITH CREATEDB;
                END IF;
            END $$;
        """)
        
        # Create database if not exists  
        cursor.execute("""
            SELECT 1 FROM pg_database WHERE datname = 'comply-x'
        """)
        if not cursor.fetchone():
            cursor.execute('CREATE DATABASE "comply-x" OWNER logu')
            print("   ✅ Created database 'comply-x'")
        else:
            print("   ✅ Database 'comply-x' already exists")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"   ⚠️  Database setup (may need manual setup): {e}")
    
    try:
        # Set environment variable
        os.environ["DB_TYPE"] = "local_postgres"
        
        # Import after setting environment
        from database import DATABASE_URL, engine
        
        print(f"   📍 Database URL: {DATABASE_URL}")
        
        # Create tables
        Base.metadata.create_all(bind=engine, checkfirst=True)
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
            tables = result.fetchall()
            print(f"   ✅ Local PostgreSQL setup complete - {len(tables)} tables")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Local PostgreSQL setup failed: {e}")
        print("\n   📋 Manual setup required:")
        print("   1. Run: sudo -u postgres psql")
        print("   2. Execute: CREATE USER logu WITH CREATEDB;")
        print("   3. Execute: CREATE DATABASE \"comply-x\" OWNER logu;")
        print("   4. Exit with: \\q")
        return False

def setup_external_postgres():
    """Setup external PostgreSQL database (Render)"""
    print("☁️  Setting up external PostgreSQL database...")
    
    try:
        # Set environment variable
        os.environ["DB_TYPE"] = "external_postgres"
        
        # Import after setting environment
        from database import DATABASE_URL, engine
        
        print(f"   📍 Database URL: {DATABASE_URL[:50]}...")
        
        # Create tables
        Base.metadata.create_all(bind=engine, checkfirst=True)
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
            tables = result.fetchall()
            print(f"   ✅ External PostgreSQL setup complete - {len(tables)} tables")
        
        return True
        
    except Exception as e:
        print(f"   ❌ External PostgreSQL setup failed: {e}")
        return False

def main():
    print("🚀 Comply-X Database Setup Tool")
    print("=" * 50)
    
    print("\nAvailable database options:")
    print("1. SQLite (local file, works out of the box)")
    print("2. Local PostgreSQL (requires PostgreSQL installation)")
    print("3. External PostgreSQL (Render cloud database)")
    
    try:
        choice = input("\nSelect database type (1-3): ").strip()
        
        if choice == "1":
            success = setup_sqlite()
            db_type = "sqlite"
        elif choice == "2":
            success = setup_local_postgres()
            db_type = "local_postgres"
        elif choice == "3":
            success = setup_external_postgres()
            db_type = "external_postgres"
        else:
            print("❌ Invalid choice")
            return False
        
        if success:
            print(f"\n🎉 Database setup successful!")
            print(f"💡 To use this database, set environment variable:")
            print(f"   export DB_TYPE={db_type}")
            print(f"   or start your app with: DB_TYPE={db_type} python main.py")
            
            # Create a .env file for convenience
            with open('.env', 'w') as f:
                f.write(f"DB_TYPE={db_type}\n")
            print(f"   ✅ Created .env file with DB_TYPE={db_type}")
            
        return success
        
    except KeyboardInterrupt:
        print("\n❌ Setup cancelled")
        return False

if __name__ == "__main__":
    main()