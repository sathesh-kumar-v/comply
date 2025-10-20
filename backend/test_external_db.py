#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_db, engine, DATABASE_URL
from models import User, UserRole, PermissionLevel
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime

def test_database_connection():
    """Test basic database connection"""
    try:
        print("🔌 Testing database connection...")
        print(f"📍 Database URL: {DATABASE_URL[:50]}...")
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            print(f"✅ Connected to PostgreSQL: {version[:50]}...")
            return True
            
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

def test_table_access():
    """Test access to key tables"""
    try:
        print("\n📊 Testing table access...")
        
        with engine.connect() as conn:
            # Test each key table
            tables = [
                'users', 'documents', 'questionnaires', 'departments', 
                'companies', 'groups', 'countries', 'sites'
            ]
            
            for table in tables:
                result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.fetchone()[0]
                print(f"✅ {table}: {count} records")
            
            return True
            
    except Exception as e:
        print(f"❌ Table access failed: {e}")
        return False

def test_model_operations():
    """Test basic CRUD operations with models"""
    try:
        print("\n🔧 Testing model operations...")
        
        db = next(get_db())
        
        # Test creating a user (if not exists)
        test_email = "test@comply-x.com"
        existing_user = db.query(User).filter(User.email == test_email).first()
        
        if existing_user:
            print(f"✅ Found existing test user: {existing_user.email}")
            user = existing_user
        else:
            # Create a test user
            user = User(
                email=test_email,
                username="testuser",
                first_name="Test",
                last_name="User", 
                hashed_password="hashed_password_here",
                role=UserRole.EMPLOYEE,
                permission_level=PermissionLevel.VIEW_ONLY,
                created_at=datetime.utcnow()
            )
            
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"✅ Created test user: {user.email}")
        
        # Test querying users
        user_count = db.query(User).count()
        print(f"✅ Total users in database: {user_count}")
        
        db.close()
        return True
        
    except Exception as e:
        print(f"❌ Model operations failed: {e}")
        return False

def test_enum_types():
    """Test enum types work correctly"""
    try:
        print("\n🔍 Testing enum types...")
        
        db = next(get_db())
        
        # Test UserRole enum
        admin_users = db.query(User).filter(User.role == UserRole.ADMIN).count()
        print(f"✅ UserRole enum working - {admin_users} admin users")
        
        # Test PermissionLevel enum  
        view_only_users = db.query(User).filter(User.permission_level == PermissionLevel.VIEW_ONLY).count()
        print(f"✅ PermissionLevel enum working - {view_only_users} view-only users")
        
        db.close()
        return True
        
    except Exception as e:
        print(f"❌ Enum types test failed: {e}")
        return False

def main():
    print("🧪 Comply-X External Database Test Suite")
    print("=" * 50)
    
    tests = [
        ("Database Connection", test_database_connection),
        ("Table Access", test_table_access),
        ("Model Operations", test_model_operations),
        ("Enum Types", test_enum_types),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n🧪 Running test: {test_name}")
        print("-" * 30)
        
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} PASSED")
            else:
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            print(f"❌ {test_name} ERROR: {e}")
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! External database is ready to use.")
        return True
    else:
        print("⚠️  Some tests failed. Please review the issues above.")
        return False

if __name__ == "__main__":
    main()