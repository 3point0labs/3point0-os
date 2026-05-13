# 3point0 OS — Project Context

*Last updated: April 2026*

## Company

3point0 Labs — media/content company.
Operator: Marquel Martin (founder, marquel@3point0labs.io)

## Products

- **Press Box Chronicles with Jeff Pearlman** — long-form sports storytelling podcast on Blue Wire Network. 1.4M monthly YouTube views, Top 25% of Blue Wire by audio downloads. The Hollywood Reporter called it "the new 30-for-30."
- **One54 Africa** — weekly long-form podcast celebrating Africa's 54 countries through entertainment, athletics, and business. iHeartPodcasts production, "from the makers of Club Shay Shay." 220M+ social video views in 5 months, 8M+ follower ecosystem (hosts Akbar Gbajabiamila + Godfrey).
- 4 active content / social media clients.

## Current goals

1. Land podcast sponsorships for both shows
2. Manage content clients (social media, editing, production)
3. Build internal OS to automate outreach, enrichment, and workflows

## Operator context

- Marquel is studying for NFLPA Contract Advisor exam — July 2026
- Also building AGiNT (separate project — agentic infrastructure for athletes)
- Thinks in products, deals, and systems — not code
- Wants things shipped fast, no over-engineering

## Stack

- **Next.js 16** with **Turbopack**, Tailwind CSS, TypeScript
- **Supabase** (Postgres + RLS) — primary store for `sponsors`, `gmail_tokens`, `profiles`, `rocketreach_usage`, `rocketreach_balance`. Some lighter data still on JSON files (`team-notes.json`, `production-calendar.json`, `intelligence.json`, `dashboard.json`).
- **Anthropic API** — `claude-sonnet-4-20250514` for writing/research/personalization, `claude-haiku-4-5` for simple checks/flags
- **Gmail API** — OAuth + refresh-token rotation handled in `/api/gmail/send` and `/api/gmail/inbox`
- **RocketReach API** — sponsor email + LinkedIn enrichment via `src/lib/rocketreach.ts` + `src/app/actions/enrich-contact.ts`
- **YouTube Data API** — Broadcast Room episode player + intelligence
- Deployed on **Vercel** — production at `os.3point0labs.io` and `3point0-os.vercel.app`
- API keys in `.env.local` locally, marked **Sensitive** in Vercel env

### Supabase schema (sponsors table — key columns)

```
id, contact_name, company, email, podcast, stage, last_contact_date,
linkedin_url, contact_title, tier, category, pitch_angle, notes,
scheduled_call_date, gmail_thread_id, last_reply_date,

-- RocketReach enrichment columns:
email_verified (bool), email_verified_at, email_source, email_validation_error,
rocketreach_id, rocketreach_looked_up_at, title_tier
```

### Data access pattern

`src/lib/data.ts` exposes `getSponsors()` / `saveSponsors()`. **Uses the Supabase service-role client** to bypass RLS — safe because all callers are authenticated server actions or authenticated API routes. User-scoped operations (like `markSponsorContacted` after a Gmail send) use the user client.

### Auth & users

- **Auth:** Supabase (Google OAuth + email/password). Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. Run SQL in `supabase/profiles.sql` (profiles table + RLS + trigger on new users).
- **Roles:** `admin` (full access), `team` (3point0 staff, full data), `partner` (scoped to `podcast_access` in `profiles`).
- **Adding a user:** Supabase Dashboard → Authentication → Users → Invite user. After they sign in, set `role` and `podcast_access` in the `profiles` table (`One54`, `Pressbox Chronicles`, or both).
- **Admin email:** marquel@3point0labs.io

## App structure (routes)

1. **`/command`** — Command Center: greeting + clock + system health bar, daily playbook, meetings, Today's Priority Targets with `PITCH →` buttons that open the same DraftEmailModal as Partnerships, My Inbox widget (Gmail), Todo list. Root `/` redirects here.
2. **`/broadcast`** — Broadcast Room: YouTube episode player + intelligence analysis, production calendar.
3. **`/partnerships`** — Partnerships: pipeline stat cards (filter ALL / ONE54 / PRESSBOX) + full sponsor kanban with search by company/contact name, CSV import/export, RocketReach bulk-enrich button, email verification badges on every card. Single outreach surface for the whole pipeline.
4. **`/settings`** — Auth, Gmail connection, role-gated tools.

**Deleted routes — do not re-add:**
- `/dealflow` (replaced by Partnerships kanban)
- `/mailroom` (redirects to `/command`; future Reply Inbox rebuild lives here)
- `/sponsors` (replaced by Partnerships kanban)
- `/test-rocketreach` (debugging page, removed)

Sidebar podcast switcher (ONE54 / PRESSBOX) sets global accent and agent context. Partnerships page has its own data filter for stats and board.

## Outreach data flow

1. Operator clicks `> RUN AGENT` (kanban card) or `PITCH →` (Command Center Priority Target)
2. `DraftEmailModal` opens with sponsor context
3. `draftOutreachEmail` server action runs:
   - Determines recommended channel (EMAIL / LINKEDIN DM / WEBSITE INQUIRY / INSTAGRAM DM / COMBINATION) based on tier + title + available contact data
   - Web-searches for recent company news (DuckDuckGo, no API key required)
   - Loads brand playbooks from `docs/playbooks/{podcast}-pitch.md` + `{podcast}-target-sponsors.md` on every call (no cache — edits apply immediately)
   - Calls Claude Sonnet 4 with the playbook as authoritative brand context
   - Returns strict JSON: `{ email, linkedinMessage }` — split artifacts (Option A)
4. Modal renders:
   - Recommended channel banner
   - Editable To / Subject / Body
   - For COMBINATION channel: blue LinkedIn section with own Copy + Open profile link
   - Email verification badge next to "To" (green = RocketReach verified, yellow = unverified, red = invalid)
5. `Send via Gmail` → `/api/gmail/send` → real Gmail API → returns successfully
6. After send, server-side `markSponsorContacted(sponsorId)`:
   - Updates `last_contact_date` to today
   - Advances stage from "New" → "Contacted" only
   - **Never downgrades** (e.g. a send to a Negotiating sponsor stays Negotiating, just updates the date)
7. Modal auto-closes; `router.refresh()` re-pulls sponsor data; card moves columns / shows "0d since touch"

## Sponsor enrichment flow (RocketReach)

- **Per-sponsor:** `enrichSponsor(sponsorId)` in `src/app/actions/enrich-contact.ts` runs RocketReach person_search + person_lookup, writes verified email + LinkedIn URL + title back to Supabase, sets `email_verified=true` on successful match.
- **Bulk:** `bulkEnrichPrioritySponsors({ tiers, minCreditsRemaining })` iterates over all Tier S + A sponsors with null/unknown `email_source`, with 300ms rate-limiting between calls, and reports `{ enriched, skipped, failed, creditsUsedTotal }` at the end. Triggered by the green "Verify Tier S+A emails" button on the Partnerships page.
- Account check via `getRocketReachCredits()` runs before bulk operations to enforce credit safety threshold.

## Brand playbooks (read by the outreach agent)

The outreach agent reads brand-specific playbooks from `docs/playbooks/` before drafting each email:

- `one54-pitch.md` — One54 positioning, hosts, audience numbers, sponsorship packages
- `one54-target-sponsors.md` — One54 target categories + per-category pitch angles
- `pressbox-pitch.md` — Pressbox positioning, Jeff Pearlman credentials, audience data
- `pressbox-target-sponsors.md` — Pressbox target categories + per-category pitch angles

**These are the source of truth for brand voice and positioning.** Update them when the show's fundamentals change (new numbers, new guests, new partnership tiers). The agent re-reads them on every draft — no cache, edits apply immediately. To change how either show's outreach sounds, edit the playbook — not the agent code.

## Key files reference

- `src/app/actions/draft-email.ts` — outreach agent (loads playbooks + drafts)
- `src/app/actions/enrich-contact.ts` — RocketReach enrichment (per-sponsor + bulk)
- `src/app/actions/sponsors.ts` — sponsor CRUD, CSV import, reply checking
- `src/app/actions/stats.ts` — partnership pipeline stats, priority targets
- `src/app/actions/find-contact.ts` — Claude-powered contact finder for "+ New Contact" flow
- `src/app/api/gmail/send/route.ts` — Gmail send + auto-mark Contacted
- `src/app/api/gmail/inbox/route.ts` — Gmail inbox read (My Inbox widget)
- `src/app/api/gmail/callback/route.ts` — Gmail OAuth callback
- `src/lib/gmail-oauth.ts` — Gmail OAuth helpers + token refresh
- `src/lib/data.ts` — sponsor read/write to Supabase (service-role client)
- `src/lib/rocketreach.ts` — RocketReach API client + title classification
- `src/lib/sponsors-mark-contacted.ts` — auto-advance stage helper (used by send route)
- `src/lib/types.ts` — `Sponsor`, `Stage`, `Podcast` types
- `src/components/DraftEmailModal.tsx` — unified outreach modal (kanban + Command Center both use this)
- `src/components/SponsorsClient.tsx` — kanban + search + bulk enrich button
- `src/components/CommandCenterClient.tsx` — daily briefing + priority targets
- `src/components/EmailBadge.tsx` — verification badge component
- `docs/playbooks/*.md` — brand playbooks (authoritative for voice)
- `AGENTS.md` — agent definitions
- `supabase/profiles.sql` — auth schema migration

## Rules for this project

- Keep code simple and readable; ship first, optimize later
- Explain what you built in plain English after substantive changes
- Dark theme, mission-control UI, mobile-friendly where possible
- Use the minimum Claude model for the task (Haiku for checks, Sonnet for writing/research)
- Never invent listener counts, awards, or stats — use only what's in the playbooks or sponsor data
- When deleting features, also remove orphaned imports, actions, lib files, and SQL — leave no scar tissue
