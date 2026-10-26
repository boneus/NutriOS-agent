-- Run this migration in Supabase SQL Editor before `npm run ingest`.
create extension if not exists vector;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  file text not null,
  heading text not null,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_embedding_cosine_idx
  on public.knowledge_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count integer default 5
)
returns table (
  id uuid,
  file text,
  heading text,
  content text,
  similarity double precision
)
language sql
stable
as $$
  select
    knowledge_chunks.id,
    knowledge_chunks.file,
    knowledge_chunks.heading,
    knowledge_chunks.content,
    1 - (knowledge_chunks.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks
  order by knowledge_chunks.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;

grant execute on function public.match_knowledge_chunks(vector, integer) to service_role;
