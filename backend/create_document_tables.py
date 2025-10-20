#!/usr/bin/env python3
"""
Migration script to create document management tables.
Run this to create all the new tables for the document management module.
"""

from sqlalchemy import create_engine
from database import DATABASE_URL, Base
from models import (
    Document, DocumentVersion, DocumentAccess, DocumentAuditLog,
    DocumentCategory, DocumentReview
)
import sys

def create_document_tables():
    """Create all document management tables"""
    engine = create_engine(DATABASE_URL)
    
    try:
        print("Creating document management tables...")
        
        # Create all tables defined in models
        Base.metadata.create_all(bind=engine, tables=[
            Document.__table__,
            DocumentVersion.__table__,
            DocumentAccess.__table__,
            DocumentAuditLog.__table__,
            DocumentCategory.__table__,
            DocumentReview.__table__
        ])
        
        print("✅ Document management tables created successfully!")
        print("Tables created:")
        print("- documents")
        print("- document_versions")
        print("- document_access")
        print("- document_audit_logs")
        print("- document_categories")
        print("- document_reviews")
        
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        sys.exit(1)

if __name__ == "__main__":
    create_document_tables()