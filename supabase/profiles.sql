-- Run this SQL in the Supabase SQL editor after creating the project.
-- Creates profiles, RLS, and auto-profile on new auth users.

create table if not exists profiles (
  id uuid references auth.users on delete cascade,
  email text unique,
  name text,
  role text default 'partner'
    check (role in ('admin', 'team', 'partner')),
  podcast_access text[] default array['One54'],
  created_at timestamptz default now(),
  primary key (id)
);

alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Admin can read all profiles"
  on profiles for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
