-- =====================================================================
-- Mailroom · character_config column
-- ---------------------------------------------------------------------
-- Additive migration. Adds an optional JSONB blob to `profiles` that
-- stores per-user overrides for their pixel avatar (skin, hair, outfit,
-- etc.). The Mailroom stage reads this on mount and the customization
-- modal (Phase 2.4, shipping tomorrow) writes to it.
--
-- Default is NULL so existing rows pick up the hard-coded TEAM_PRESETS
-- defaults from `src/lib/mailroom/config/characters.ts`.
-- =====================================================================

alter table public.profiles
  add column if not exists character_config jsonb;

comment on column public.profiles.character_config is
  'Mailroom avatar override: { skin, hair, outfit, role } matching CharacterConfig in src/lib/mailroom/config/characters.ts. NULL means use the preset.';
