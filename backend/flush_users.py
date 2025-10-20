#!/usr/bin/env python3
"""
Script to flush all users from the database.
WARNING: This will permanently delete all user data!
"""

from sqlalchemy import create_engine, text
from database import DATABASE_URL
import sys

def flush_users():
    """Delete all users from the users table"""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as connection:
        try:
            print("WARNING: This will delete ALL users from the database!")
            print("Database:", DATABASE_URL)
            
            # Count existing users
            result = connection.execute(text("SELECT COUNT(*) FROM users"))
            user_count = result.scalar()
            print(f"Current user count: {user_count}")
            
            if user_count == 0:
                print("No users found in database.")
                return
            
            # Auto-confirm for non-interactive execution
            print("Auto-confirming deletion for script execution...")
            
            print("Deleting all users...")
            connection.execute(text("DELETE FROM users"))
            connection.commit()
            
            # Verify deletion
            result = connection.execute(text("SELECT COUNT(*) FROM users"))
            remaining_count = result.scalar()
            
            if remaining_count == 0:
                print("✅ All users successfully deleted!")
                print("You can now register new users through the registration wizard.")
            else:
                print(f"❌ Error: {remaining_count} users still remain in database.")
            
        except Exception as e:
            print(f"❌ Error flushing users: {e}")
            connection.rollback()
            sys.exit(1)

if __name__ == "__main__":
    flush_users()