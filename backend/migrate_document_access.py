#!/usr/bin/env python3

import sqlite3
import sys
from pathlib import Path

def migrate_document_access_table():
    """Add department_id column to document_access table if it doesn't exist"""
    db_path = Path(__file__).parent / "comply_x.db"
    
    if not db_path.exists():
        print(f"Database file {db_path} does not exist!")
        return False
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # Check if the document_access table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='document_access';")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            print("document_access table does not exist, creating it...")
            # Create the table with all necessary columns
            cursor.execute("""
                CREATE TABLE document_access (
                    id INTEGER PRIMARY KEY,
                    document_id INTEGER NOT NULL,
                    user_id INTEGER,
                    role TEXT,
                    department_id INTEGER,
                    permission_level TEXT,
                    can_read BOOLEAN DEFAULT 1,
                    can_download BOOLEAN DEFAULT 0,
                    can_edit BOOLEAN DEFAULT 0,
                    can_delete BOOLEAN DEFAULT 0,
                    can_approve BOOLEAN DEFAULT 0,
                    granted_by_id INTEGER NOT NULL,
                    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    FOREIGN KEY (document_id) REFERENCES documents(id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (department_id) REFERENCES departments(id),
                    FOREIGN KEY (granted_by_id) REFERENCES users(id)
                );
            """)
            print("✅ Created document_access table with all columns")
        else:
            # Check if department_id column exists
            cursor.execute("PRAGMA table_info(document_access);")
            columns = cursor.fetchall()
            column_names = [column[1] for column in columns]
            
            if 'department_id' not in column_names:
                print("Adding department_id column to document_access table...")
                cursor.execute("ALTER TABLE document_access ADD COLUMN department_id INTEGER;")
                print("✅ Added department_id column to document_access table")
            else:
                print("✅ department_id column already exists in document_access table")
        
        conn.commit()
        return True
        
    except sqlite3.Error as e:
        print(f"❌ SQLite error: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    print("🔄 Migrating document_access table...")
    success = migrate_document_access_table()
    if success:
        print("✅ Migration completed successfully!")
        sys.exit(0)
    else:
        print("❌ Migration failed!")
        sys.exit(1)