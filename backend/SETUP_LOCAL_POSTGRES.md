# Local PostgreSQL Setup Guide

## 🐘 Setting up Local PostgreSQL for Comply-X

### Method 1: Quick Setup (Recommended)

1. **Connect to PostgreSQL as superuser:**
   ```bash
   sudo -u postgres psql
   ```

2. **Run these commands in PostgreSQL:**
   ```sql
   CREATE USER logu WITH CREATEDB;
   CREATE DATABASE "comply-x" OWNER logu;
   \q
   ```

3. **Test the connection:**
   ```bash
   psql -d comply-x
   ```

4. **Set your database type:**
   ```bash
   export DB_TYPE=local_postgres
   python3 main.py
   ```

### Method 2: Using provided script

1. **Run the setup script:**
   ```bash
   echo "2" | python3 db_setup.py
   ```

2. **If it fails, follow Method 1 above**

### Method 3: Using SQL file

1. **Run the SQL setup file:**
   ```bash
   sudo -u postgres psql -f setup_local_db.sql
   ```

## 🔄 Switching Between Databases

Your application now supports multiple database configurations:

### SQLite (Default - Works out of the box)
```bash
export DB_TYPE=sqlite
python3 main.py
```

### Local PostgreSQL
```bash
export DB_TYPE=local_postgres  
python3 main.py
```

### External PostgreSQL (Render)
```bash
export DB_TYPE=external_postgres
python3 main.py
```

## 🧪 Testing Your Setup

Test all database connections:
```bash
python3 test_all_dbs.py
```

## 📊 Current Status

- ✅ **SQLite**: Working (27 tables, your existing data)
- ⚠️  **Local PostgreSQL**: Needs manual setup (see Method 1)
- ✅ **External PostgreSQL**: Working (26 tables, migrated schema)

## 🔧 Troubleshooting

### "fe_sendauth: no password supplied" error
This means PostgreSQL authentication needs to be configured. Use Method 1 above.

### "database does not exist" error  
The database hasn't been created yet. Use Method 1 above.

### "role does not exist" error
The user hasn't been created yet. Use Method 1 above.

## 💡 Recommendations

1. **For Development**: Use SQLite (simplest, no setup required)
2. **For Production-like Testing**: Use Local PostgreSQL
3. **For Production**: Use External PostgreSQL (already set up)

Your SQLite database contains all your existing data and is ready to use immediately!