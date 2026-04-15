create table if not exists public.dealflow_contacts (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  contact_name text not null,
  title text not null default '',
  email text not null default '',
  linkedin_url text not null default '',
  podcast text not null check (podcast in ('One54', 'Pressbox Chronicles', 'BOTH')),
  pitch_draft text,
  channel_recommendation text check (channel_recommendation in ('EMAIL', 'LINKEDIN DM')),
  status text not null default 'New' check (status in ('New', 'Pitched', 'Followed Up', 'In Convo', 'Closed')),
  created_at timestamptz not null default now()
);

alter table public.dealflow_contacts enable row level security;

drop policy if exists "dealflow_contacts_select" on public.dealflow_contacts;
create policy "dealflow_contacts_select"
on public.dealflow_contacts
for select
to authenticated
using (true);

drop policy if exists "dealflow_contacts_insert" on public.dealflow_contacts;
create policy "dealflow_contacts_insert"
on public.dealflow_contacts
for insert
to authenticated
with check (true);

drop policy if exists "dealflow_contacts_update" on public.dealflow_contacts;
create policy "dealflow_contacts_update"
on public.dealflow_contacts
for update
to authenticated
using (true)
with check (true);

drop policy if exists "dealflow_contacts_delete" on public.dealflow_contacts;
create policy "dealflow_contacts_delete"
on public.dealflow_contacts
for delete
to authenticated
using (true);
