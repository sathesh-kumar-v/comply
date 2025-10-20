#!/usr/bin/env python3
"""
Password reset utility for Comply-X users
Usage: python reset_password.py <username> <new_password>
"""
import sys
import os
from sqlalchemy.orm import Session
from passlib.context import CryptContext

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import User

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def reset_user_password(username: str, new_password: str):
    db = SessionLocal()
    try:
        # Find user by username
        user = db.query(User).filter(User.username == username).first()
        if not user:
            print(f"User '{username}' not found")
            return False
        
        # Hash new password and update
        hashed_password = get_password_hash(new_password)
        user.hashed_password = hashed_password
        db.commit()
        
        print(f"Password successfully reset for user '{username}'")
        return True
        
    except Exception as e:
        print(f"Error resetting password: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def list_users():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print("\nExisting users:")
        for user in users:
            print(f"- Username: {user.username}, Email: {user.email}, Role: {user.role}")
    except Exception as e:
        print(f"Error listing users: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("Usage: python reset_password.py <username> <new_password>")
        print("       python reset_password.py --list")
        sys.exit(1)
    
    if sys.argv[1] == "--list":
        list_users()
        sys.exit(0)
    
    if len(sys.argv) != 3:
        print("Usage: python reset_password.py <username> <new_password>")
        sys.exit(1)
    
    username = sys.argv[1]
    new_password = sys.argv[2]
    
    reset_user_password(username, new_password)