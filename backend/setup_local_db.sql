-- Local PostgreSQL setup for Comply-X
-- Run this with: psql -U postgres -f setup_local_db.sql

-- Create user (ignore error if already exists)
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'logu') THEN
      
      CREATE USER logu WITH CREATEDB;
   END IF;
END
$do$;

-- Create database (ignore error if already exists)
SELECT 'CREATE DATABASE "comply-x" OWNER logu'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'comply-x')\gexec

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE "comply-x" TO logu;

-- Display success message
\echo 'Setup completed successfully!'
\echo 'You can now connect with: psql -d comply-x'