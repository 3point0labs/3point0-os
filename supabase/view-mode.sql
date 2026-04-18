-- ==============================================================
-- Mailroom: profiles.view_mode
-- ==============================================================
-- Additive, non-breaking migration.
-- Run once in the Supabase SQL editor.
--
-- Adds an enum type and a nullable column to profiles so every user
-- can remember their Classic / Pixel view preference. Default value
-- is 'pixel' so new users land in The Mailroom.

do $$ begin
  create type view_mode_t as enum ('classic', 'pixel');
exception
  when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists view_mode view_mode_t not null default 'pixel';

comment on column public.profiles.view_mode is
  'Which landing experience the user prefers: pixel (Mailroom) or classic (sidebar nav).';
