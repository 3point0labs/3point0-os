-- Dedicated Gmail OAuth tokens (separate from Supabase login OAuth).
-- Run in Supabase SQL editor after deploy.

create table if not exists gmail_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text,
  created_at timestamptz default now(),
  unique (user_id)
);

create index if not exists gmail_tokens_user_id_idx on gmail_tokens (user_id);

alter table gmail_tokens enable row level security;

create policy "Users read own gmail tokens"
  on gmail_tokens for select
  using (auth.uid() = user_id);

create policy "Users insert own gmail tokens"
  on gmail_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users update own gmail tokens"
  on gmail_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own gmail tokens"
  on gmail_tokens for delete
  using (auth.uid() = user_id);
