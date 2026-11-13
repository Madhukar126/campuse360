-- CAMPUS360 AI RAG schema (768-dimensional embeddings).
-- Apply only after reviewing against the active hosted schema/migration history.
create extension if not exists vector with schema extensions;

create table if not exists public.c360_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  filename text not null,
  visibility text not null check (visibility in ('public','staff','admin')),
  department text not null default 'general',
  sha256 text not null,
  uploaded_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.c360_knowledge_chunks (
  id bigserial primary key,
  document_id uuid not null references public.c360_knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  page_number integer,
  content text not null,
  embedding extensions.vector(768) not null,
  visibility text not null check (visibility in ('public','staff','admin')),
  department text not null default 'general',
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);

create index if not exists c360_knowledge_chunks_embedding_idx
  on public.c360_knowledge_chunks using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);

create table if not exists public.c360_ai_audit (
  id bigserial primary key,
  user_id text not null,
  role text not null check (role in ('student','staff','admin')),
  question text not null,
  source_document_ids uuid[] not null default '{}',
  provider text not null,
  created_at timestamptz not null default now()
);

alter table public.c360_knowledge_documents enable row level security;
alter table public.c360_knowledge_chunks enable row level security;
alter table public.c360_ai_audit enable row level security;

-- No direct browser policies: all reads/writes go through the authenticated portal
-- Edge Function and the private AI service using server-side credentials.
revoke all on public.c360_knowledge_documents, public.c360_knowledge_chunks, public.c360_ai_audit from anon, authenticated;
grant all on public.c360_knowledge_documents, public.c360_knowledge_chunks, public.c360_ai_audit to service_role;
grant usage, select on sequence public.c360_knowledge_chunks_id_seq, public.c360_ai_audit_id_seq to service_role;

create or replace function public.c360_match_knowledge_chunks(
  query_embedding extensions.vector(768),
  match_count int default 5,
  request_role text default 'student'
)
returns table (
  document_id uuid,
  title text,
  page_number int,
  chunk_index int,
  content text,
  similarity float
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select c.document_id, d.title, c.page_number, c.chunk_index, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.c360_knowledge_chunks c
  join public.c360_knowledge_documents d on d.id = c.document_id
  where
    (request_role = 'student' and c.visibility = 'public')
    or (request_role = 'staff' and c.visibility in ('public','staff'))
    or (request_role = 'admin' and c.visibility in ('public','staff','admin'))
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 10);
$$;

revoke all on function public.c360_match_knowledge_chunks(extensions.vector, int, text) from public, anon, authenticated;
grant execute on function public.c360_match_knowledge_chunks(extensions.vector, int, text) to service_role;
