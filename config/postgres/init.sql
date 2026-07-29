-- Create databases
CREATE DATABASE rag_api;
CREATE DATABASE kaneo;
CREATE DATABASE temporal;

CREATE USER myuser WITH PASSWORD '${RAG_DB_PASSWORD:-mypassword}';
CREATE USER kaneo WITH PASSWORD '${KANEO_DB_PASSWORD:-kaneo_password}';
CREATE USER lemefy WITH PASSWORD '${LEMEFY_DB_PASSWORD:-lemefy_password}';

GRANT ALL PRIVILEGES ON DATABASE rag_api TO myuser;
GRANT ALL PRIVILEGES ON DATABASE kaneo TO kaneo;
GRANT ALL PRIVILEGES ON DATABASE lemefy TO lemefy;

-- Note: The following commands will run in the lemefy database
-- because POSTGRES_DB is set to 'lemefy' in docker-compose

-- Enable uuid-ossp for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- RBAC Tables for PostgreSQL migration
-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  _id VARCHAR(24) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  _id VARCHAR(24) UNIQUE NOT NULL,
  email VARCHAR(255),
  username VARCHAR(255),
  password_hash TEXT,
  role VARCHAR(255) DEFAULT 'USER',
  roles JSONB DEFAULT '[]',
  tenant_id VARCHAR(255) DEFAULT 'default',
  balance JSONB DEFAULT '{}',
  config JSONB DEFAULT '{}',
  email_verified BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (_id, name, description, permissions) 
VALUES 
  ('6789abcd0123456789012345', 'USER', 'Default user role', '{"read": true}'),
  ('6789abcd0123456789012346', 'ADMIN', 'Administrator role', '{"read": true, "write": true, "admin": true}'),
  ('6789abcd0123456789012347', 'SUPER_ADMIN', 'Super administrator role', '{"read": true, "write": true, "admin": true, "super_admin": true}')
ON CONFLICT (_id) DO NOTHING;

-- Insert default users if not exists
INSERT INTO users (_id, email, username, password_hash, role, roles, tenant_id, email_verified) 
VALUES 
  ('6789abcd0123456789012348', 'admin@lemefy.ai', 'admin', '$2a$10$i3.CRhqZPP6vYDY7EYYs.uXrsK8GgwJLTxv7LO408KclHlZT7rfdu', 'SUPER_ADMIN', '["SUPER_ADMIN"]', 'default', true),
  ('6789abcd0123456789012349', 'admin@lemefy.com', 'admin', '$2a$10$i3.CRhqZPP6vYDY7EYYs.uXrsK8GwJLTxv7LO408KclHlZT7rfdu', 'SUPER_ADMIN', '["SUPER_ADMIN"]', 'default', true)
ON CONFLICT (_id) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS roles_name_idx ON roles(name);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);
CREATE INDEX IF NOT EXISTS users_tenant_idx ON users(tenant_id);
