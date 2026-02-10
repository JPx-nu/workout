-- ============================================================
-- Migration: Enable required PostgreSQL extensions
-- ============================================================

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;

-- Vector embeddings (pgvector)
CREATE EXTENSION IF NOT EXISTS "vector" SCHEMA extensions;

-- Trigram fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA extensions;
