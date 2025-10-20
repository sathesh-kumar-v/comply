#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
import json

# Database URLs
LOCAL_DB_URL = "sqlite:///./comply_x.db"
EXTERNAL_DB_URL = "postgresql://complyx_db_user:hAKDq5SpLibMuYxeAnQyPQUUTmJB2gh3@dpg-d2hh43ndiees73eheaq0-a.oregon-postgres.render.com/complyx_db"

def migrate_table_data(table_name):
    """Migrate data from local SQLite to external PostgreSQL for a specific table"""
    try:
        print(f"🔄 Migrating {table_name}...")
        
        # Connect to local SQLite
        local_conn = sqlite3.connect('comply_x.db')
        local_conn.row_factory = sqlite3.Row
        local_cursor = local_conn.cursor()
        
        # Connect to external PostgreSQL
        external_conn = psycopg2.connect(EXTERNAL_DB_URL)
        external_cursor = external_conn.cursor(cursor_factory=RealDictCursor)
        
        # Get data from local database
        local_cursor.execute(f"SELECT * FROM {table_name}")
        rows = local_cursor.fetchall()
        
        if not rows:
            print(f"   ⚪ {table_name}: No data to migrate")
            local_conn.close()
            external_conn.close()
            return True
        
        # Get column names
        columns = [description[0] for description in local_cursor.description]
        
        # Check if external table has data
        external_cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        external_count = external_cursor.fetchone()[0]
        
        if external_count > 0:
            print(f"   ⚠️  {table_name}: External table has {external_count} records, skipping migration")
            local_conn.close()
            external_conn.close()
            return True
        
        # Prepare insert statement
        placeholders = ', '.join(['%s'] * len(columns))
        insert_sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
        
        # Migrate data
        migrated_count = 0
        for row in rows:
            try:
                values = [row[col] for col in columns]
                external_cursor.execute(insert_sql, values)
                migrated_count += 1
            except Exception as e:
                print(f"     ❌ Error migrating row: {e}")
                continue
        
        external_conn.commit()
        
        print(f"   ✅ {table_name}: Migrated {migrated_count}/{len(rows)} records")
        
        local_conn.close()
        external_conn.close()
        
        return True
        
    except Exception as e:
        print(f"   ❌ {table_name}: Migration failed - {e}")
        return False

def migrate_critical_data():
    """Migrate critical data that users likely want to preserve"""
    print("🚀 Migrating Critical Data")
    print("=" * 40)
    
    # Tables to migrate in order (respecting foreign key constraints)
    critical_tables = [
        'users',
        'departments', 
        'documents',
        'document_assignments',
        'document_audit_logs',
        'password_reset_tokens'
    ]
    
    successful_migrations = 0
    
    for table in critical_tables:
        if migrate_table_data(table):
            successful_migrations += 1
    
    print(f"\n📊 Migration Results: {successful_migrations}/{len(critical_tables)} tables migrated")
    
    return successful_migrations == len(critical_tables)

def verify_migration():
    """Verify migrated data"""
    print("\n🔍 Verifying Migration...")
    
    try:
        # Connect to external database
        external_conn = psycopg2.connect(EXTERNAL_DB_URL)
        external_cursor = external_conn.cursor()
        
        # Check record counts
        tables_to_check = ['users', 'documents', 'departments', 'document_assignments']
        
        for table in tables_to_check:
            external_cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = external_cursor.fetchone()[0]
            print(f"✅ {table}: {count} records")
        
        external_conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return False

def main():
    print("📦 Comply-X Data Migration Tool")
    print("=" * 50)
    
    # Warn user
    print("⚠️  WARNING: This will migrate data from local SQLite to external PostgreSQL")
    print("💡 Only empty tables in external database will be populated")
    print("🔒 Tables with existing data will be skipped for safety")
    
    # Ask for confirmation
    try:
        confirm = input("\n❓ Do you want to continue? (y/N): ").strip().lower()
        if confirm not in ['y', 'yes']:
            print("❌ Migration cancelled by user")
            return False
    except KeyboardInterrupt:
        print("\n❌ Migration cancelled by user")
        return False
    
    # Run migration
    if not migrate_critical_data():
        print("\n❌ Migration completed with errors")
        return False
    
    # Verify migration
    if not verify_migration():
        print("\n❌ Migration verification failed")
        return False
    
    print("\n🎉 Data migration completed successfully!")
    print("💡 Your application is now fully migrated to the external database")
    
    return True

if __name__ == "__main__":
    main()