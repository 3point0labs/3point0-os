# Project Decisions Log

## Architecture decisions
- Using JSON file storage (sponsors.json) until Supabase free slot opens up
- Will migrate to Supabase when Doomclaw.ai project ends or Pro tier justified
- AGiNT lives in separate Supabase project (ATC Protocol) — do not mix

## API decisions
- Anthropic model: claude-sonnet-4-20250514 for all writing agents
- Anthropic model: claude-haiku-4-5 for lightweight check agents
- API key in .env.local only — never commit, never paste in chat
- Rotate API key if ever exposed in chat or code

## UI decisions
- Dark theme throughout
- Clean minimal layout — no clutter
- Sidebar navigation: Dashboard + Sponsor outreach (more pages coming)
- Mobile-friendly is nice to have, not blocking

## What not to repeat
- Do not add a database until JSON storage breaks or team grows past 3
- Do not build personal dashboards until company dashboard is stable
- Do not add authentication until deploying to Vercel for team use

## Pending
- Supabase migration (when slot available)
- Vercel deployment (next step after agent features done)
- Personal dashboard for Marquel (NFLPA study tracker)
- Follow-up agent with 7-day overdue alerts
