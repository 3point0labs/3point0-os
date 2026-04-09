# 3point0 OS — Project Context

## Company
3point0 Labs — media/content company.
Operator: Marquel Martin (founder)

## Products
- Pressbox Chronicles — sports storytelling podcast
- One54 — African business, innovation, culture podcast
- 4 active content/social media clients

## Current goals
1. Land podcast sponsorships for Pressbox Chronicles and One54
2. Manage content clients (social media, editing, production)
3. Build internal OS to automate outreach and workflows

## Operator context
- Marquel is studying for NFLPA Contract Advisor exam — July 2026
- Also building AGiNT (separate project — agentic infrastructure for athletes)
- Thinks in products, deals, and systems — not code
- Wants things shipped fast, no over-engineering

## Stack
- Next.js 14+, Tailwind CSS, TypeScript
- JSON file storage (`sponsors.json`, `team-notes.json`, `production-calendar.json`, `intelligence.json`, `dashboard.json`) — moving to Supabase later
- Anthropic API (claude-sonnet-4-20250514), YouTube Data API for Broadcast Room
- API keys in `.env.local` only

### Auth & users
- **Auth:** Supabase (Google OAuth + email/password). Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. Run SQL in `supabase/profiles.sql` in the Supabase SQL editor (profiles table + RLS + trigger on new users).
- **Roles:** `admin` (full access), `team` (3point0 staff, full data), `partner` (scoped to `podcast_access` in `profiles`).
- **Adding a user:** Supabase Dashboard → Authentication → Users → Invite user. After they sign in, set `role` and `podcast_access` in the `profiles` table (e.g. `One54`, `Pressbox Chronicles`, or both).
- **Admin email:** marquel@3point0labs.io (update if this changes)

## App structure (routes)
1. **`/command`** — Command Center: daily briefing (priorities, playbook, stats by workspace), team notes feed (`data/team-notes.json`). Root `/` redirects here.
2. **`/broadcast`** — Broadcast Room: YouTube episode player + intelligence analysis, production calendar (`data/production-calendar.json`).
3. **`/partnerships`** — Partnerships: pipeline stat cards (filter ALL / ONE54 / PRESSBOX) + full sponsor kanban, CSV import, agents. No separate dashboard route.

Sidebar podcast switcher (ONE54 / PRESSBOX) still sets global accent and agent context; partnerships page has its own data filter for stats and board.

## Rules for this project
- Keep code simple and readable; ship first, optimize later
- Explain what you built in plain English after substantive changes
- Dark theme, mission-control UI, mobile-friendly where possible
