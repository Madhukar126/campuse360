-- CAMPUS360 RAG knowledge base. Apply only after reviewing the existing schema.
-- The CAMPUS360 Supabase project was reported INACTIVE during preparation.
-- This migration has NOT been applied remotely.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS campus_ai;
REVOKE ALL ON SCHEMA campus_ai FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA campus_ai TO authenticated;
GRANT USAGE ON SCHEMA extensions TO authenticated;

CREATE TABLE IF NOT EXISTS campus_ai.knowledge_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 200),
 file_name text NOT NULL CHECK(char_length(file_name) BETWEEN 1 AND 255),
 mime_type text NOT NULL,
 visibility text NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','staff','admin')),
 department text,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
 created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS campus_ai.knowledge_chunks (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 document_id uuid NOT NULL REFERENCES campus_ai.knowledge_documents(id) ON DELETE CASCADE,
 chunk_index integer NOT NULL CHECK(chunk_index>=0),
 content text NOT NULL CHECK(char_length(content)>0),
 embedding extensions.vector(768) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(document_id,chunk_index)
);
CREATE INDEX IF NOT EXISTS knowledge_documents_visibility_idx ON campus_ai.knowledge_documents(visibility,status,department);
CREATE INDEX IF NOT EXISTS knowledge_chunks_document_idx ON campus_ai.knowledge_chunks(document_id,chunk_index);
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw_idx ON campus_ai.knowledge_chunks USING hnsw(embedding extensions.vector_cosine_ops);

CREATE OR REPLACE FUNCTION campus_ai.current_user_id()
RETURNS text LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp
AS $$ SELECT COALESCE(NULLIF(pg_catalog.current_setting('request.jwt.claims',true),'')::jsonb->>'sub','') $$;
CREATE OR REPLACE FUNCTION campus_ai.current_campus_role()
RETURNS text LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp
AS $$ SELECT COALESCE(NULLIF(pg_catalog.current_setting('request.jwt.claims',true),'')::jsonb->>'campus_role','') $$;
REVOKE ALL ON FUNCTION campus_ai.current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION campus_ai.current_campus_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION campus_ai.current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION campus_ai.current_campus_role() TO authenticated;

ALTER TABLE campus_ai.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_ai.knowledge_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_documents_read_by_visibility ON campus_ai.knowledge_documents FOR SELECT TO authenticated
USING(status='active' AND (visibility='public' OR (visibility='staff' AND campus_ai.current_campus_role() IN ('staff','admin')) OR (visibility='admin' AND campus_ai.current_campus_role()='admin')));
DROP POLICY IF EXISTS knowledge_documents_admin_insert ON campus_ai.knowledge_documents FOR INSERT TO authenticated
WITH CHECK(campus_ai.current_campus_role()='admin' AND created_by=campus_ai.current_user_id());
DROP POLICY IF EXISTS knowledge_documents_admin_update ON campus_ai.knowledge_documents FOR UPDATE TO authenticated
USING(campus_ai.current_campus_role()='admin') WITH CHECK(campus_ai.current_campus_role()='admin');
DROP POLICY IF EXISTS knowledge_documents_admin_delete ON campus_ai.knowledge_documents FOR DELETE TO authenticated
USING(campus_ai.current_campus_role()='admin');
DROP POLICY IF EXISTS knowledge_chunks_read_by_document_visibility ON campus_ai.knowledge_chunks FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM campus_ai.knowledge_documents d WHERE d.id=document_id AND d.status='active' AND (d.visibility='public' OR (d.visibility='staff' AND campus_ai.current_campus_role() IN ('staff','admin')) OR (d.visibility='admin' AND campus_ai.current_campus_role()='admin'))));
DROP POLICY IF EXISTS knowledge_chunks_admin_insert ON campus_ai.knowledge_chunks FOR INSERT TO authenticated
WITH CHECK(campus_ai.current_campus_role()='admin' AND EXISTS(SELECT 1 FROM campus_ai.knowledge_documents d WHERE d.id=document_id));
DROP POLICY IF EXISTS knowledge_chunks_admin_delete ON campus_ai.knowledge_chunks FOR DELETE TO authenticated
USING(campus_ai.current_campus_role()='admin');

REVOKE ALL ON ALL TABLES IN SCHEMA campus_ai FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON campus_ai.knowledge_documents TO authenticated;
GRANT SELECT,INSERT,DELETE ON campus_ai.knowledge_chunks TO authenticated;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA campus_ai TO authenticated;
-- Keep campus_ai outside Supabase's exposed Data API schemas.
