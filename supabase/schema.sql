-- Run once in the Supabase SQL editor.
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  raw_text text not null,
  title text not null,
  summary text not null,
  action_items jsonb not null default '[]'::jsonb
);

create index if not exists notes_created_at_idx on public.notes (created_at desc);

-- RLS on with no policies: the anon/public key can't read or write this table.
-- The server uses the service-role key, which bypasses RLS.
alter table public.notes enable row level security;
