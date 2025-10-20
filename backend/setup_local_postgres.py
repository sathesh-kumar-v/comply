#!/usr/bin/env python3

import subprocess
import sys
import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def run_command(cmd, description, ignore_errors=False):
    """Run a command and handle errors"""
    try:
        print(f"🔄 {description}...")
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
        if result.stdout:
            print(f"   ✅ {result.stdout.strip()}")
        return True
    except subprocess.CalledProcessError as e:
        if ignore_errors:
            print(f"   ⚠️  {description} (ignored): {e.stderr.strip()}")
            return False
        else:
            print(f"   ❌ {description} failed: {e.stderr.strip()}")
            return False

def setup_postgres_user():
    """Setup PostgreSQL user and database"""
    print("🏗️  Setting up PostgreSQL user and database...")
    
    # First, try to connect as postgres user to create our user
    try:
        # Connect as postgres superuser (if available)
        conn = psycopg2.connect(
            host="localhost",
            database="postgres",
            user="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Create user if not exists
        try:
            cursor.execute("CREATE USER logu WITH CREATEDB;")
            print("   ✅ Created user 'logu'")
        except psycopg2.errors.DuplicateObject:
            print("   ✅ User 'logu' already exists")
        
        # Create database if not exists
        try:
            cursor.execute("CREATE DATABASE \"comply-x\" OWNER logu;")
            print("   ✅ Created database 'comply-x'")
        except psycopg2.errors.DuplicateDatabase:
            print("   ✅ Database 'comply-x' already exists")
        
        cursor.close()
        conn.close()
        return True
        
    except psycopg2.OperationalError as e:
        print(f"   ❌ Could not connect as postgres user: {e}")
        
        # Try alternative approach - create user first
        print("   🔄 Trying alternative setup...")
        
        # Try to create user using peer authentication
        commands = [
            'psql -U postgres -c "CREATE USER logu WITH CREATEDB;" 2>/dev/null || echo "User may already exist"',
            'psql -U postgres -c "CREATE DATABASE \\"comply-x\\" OWNER logu;" 2>/dev/null || echo "Database may already exist"'
        ]
        
        for cmd in commands:
            subprocess.run(cmd, shell=True)
        
        return True

def test_connection():
    """Test connection to the local database"""
    try:
        print("🔍 Testing connection...")
        conn = psycopg2.connect(
            host="localhost",
            database="comply-x", 
            user="logu"
        )
        
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        print(f"   ✅ Connected successfully: {version[:50]}...")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"   ❌ Connection test failed: {e}")
        return False

def main():
    print("🐘 Local PostgreSQL Setup for Comply-X")
    print("=" * 50)
    
    # Check if PostgreSQL is installed
    if not run_command("which psql", "Checking PostgreSQL installation"):
        print("❌ PostgreSQL is not installed. Please install it first:")
        print("   sudo apt update && sudo apt install postgresql postgresql-contrib")
        return False
    
    # Setup user and database
    if not setup_postgres_user():
        print("❌ Failed to setup PostgreSQL user/database")
        return False
    
    # Test connection
    if not test_connection():
        print("❌ Connection test failed")
        
        # Provide manual instructions
        print("\n📋 Manual Setup Instructions:")
        print("1. Connect as postgres superuser:")
        print("   sudo -u postgres psql")
        print("2. Run these commands:")
        print("   CREATE USER logu WITH CREATEDB;")
        print("   CREATE DATABASE \"comply-x\" OWNER logu;")
        print("   \\q")
        print("3. Test connection:")
        print("   psql -d comply-x")
        
        return False
    
    print("\n🎉 Local PostgreSQL setup completed!")
    print("💡 You can now connect using:")
    print("   psql -d comply-x")
    print("   or use: postgresql://logu@localhost/comply-x")
    
    return True

if __name__ == "__main__":
    main()