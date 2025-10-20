#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from models import Base
import psycopg2
from psycopg2.extras import RealDictCursor

# Database URLs
LOCAL_DB_URL = "sqlite:///./comply_x.db"
EXTERNAL_DB_URL = "postgresql://complyx_db_user:hAKDq5SpLibMuYxeAnQyPQUUTmJB2gh3@dpg-d2hh43ndiees73eheaq0-a.oregon-postgres.render.com/complyx_db"

def get_existing_tables_external():
    """Get list of existing tables in external database"""
    try:
        conn = psycopg2.connect(EXTERNAL_DB_URL)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        
        tables = [row[0] for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        return tables
        
    except Exception as e:
        print(f"❌ Error getting existing tables: {e}")
        return []

def migrate_schema_to_external():
    """Migrate all missing tables to external PostgreSQL database"""
    try:
        print("🔄 Starting migration to external PostgreSQL database...")
        
        # Get existing tables in external database
        existing_tables = get_existing_tables_external()
        print(f"📋 Found {len(existing_tables)} existing tables in external database")
        
        # Create engine for external database
        external_engine = create_engine(EXTERNAL_DB_URL)
        
        # Create all missing tables
        print("🏗️  Creating missing tables...")
        Base.metadata.create_all(bind=external_engine, checkfirst=True)
        
        # Verify all tables were created
        conn = psycopg2.connect(EXTERNAL_DB_URL)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        
        final_tables = [row[0] for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        
        new_tables = [table for table in final_tables if table not in existing_tables]
        
        print(f"\n✅ Migration completed successfully!")
        print(f"📊 Total tables in external database: {len(final_tables)}")
        print(f"🆕 New tables created: {len(new_tables)}")
        
        if new_tables:
            print("\n🆕 New tables created:")
            for table in new_tables:
                print(f"   - {table}")
        
        print(f"\n📋 All tables in external database:")
        for table in sorted(final_tables):
            status = "🆕" if table in new_tables else "✅"
            print(f"   {status} {table}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()
        return False

def migrate_data_to_external():
    """Migrate data from local SQLite to external PostgreSQL (optional)"""
    try:
        print("\n🔄 Starting data migration (if needed)...")
        
        # Create engines
        local_engine = create_engine(LOCAL_DB_URL)
        external_engine = create_engine(EXTERNAL_DB_URL)
        
        # Get list of tables from local database
        with local_engine.connect() as conn:
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'"))
            local_tables = [row[0] for row in result.fetchall()]
        
        print(f"📋 Found {len(local_tables)} tables in local database")
        
        # For now, we'll just verify the tables exist but not migrate data
        # Data migration can be done later if needed
        print("⚠️  Data migration skipped - manual review recommended")
        print("💡 Tables are ready for data migration if needed")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during data migration check: {e}")
        return False

def verify_migration():
    """Verify that the migration was successful"""
    try:
        print("\n🔍 Verifying migration...")
        
        # Test connection and basic functionality
        external_engine = create_engine(EXTERNAL_DB_URL)
        
        with external_engine.connect() as conn:
            # Test basic query
            result = conn.execute(text("SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'"))
            table_count = result.fetchone()[0]
            
            print(f"✅ Connection successful - {table_count} tables found")
            
            # Test a few key tables exist
            key_tables = ['users', 'documents', 'questionnaires', 'departments', 'companies']
            for table in key_tables:
                result = conn.execute(text(f"SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '{table}'"))
                exists = result.fetchone()[0] > 0
                status = "✅" if exists else "❌"
                print(f"   {status} {table} table")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during verification: {e}")
        return False

def main():
    print("🚀 Comply-X Database Migration Tool")
    print("=" * 50)
    
    # Step 1: Migrate schema
    if not migrate_schema_to_external():
        print("❌ Schema migration failed")
        return False
    
    # Step 2: Check data migration needs
    migrate_data_to_external()
    
    # Step 3: Verify migration
    if not verify_migration():
        print("❌ Migration verification failed")
        return False
    
    print("\n🎉 Migration completed successfully!")
    print("💡 Next steps:")
    print("   1. Update your application to use the external database")
    print("   2. Test your application with the new database")
    print("   3. Migrate data if needed")
    
    return True

if __name__ == "__main__":
    main()