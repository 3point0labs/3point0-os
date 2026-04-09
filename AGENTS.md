# Agent Definitions — 3point0 OS

## Sponsor outreach agent
- Triggered by: "Draft email" button on sponsor row
- Input: contact name, company, email, podcast name
- Process: web search for recent company news → write personalized pitch email
- Output: draft email in modal with copy button
- Model: claude-sonnet-4-20250514
- Tone: professional, direct, short — 3 paragraphs max
- Signs as: Marquel Martin, 3point0 Labs

## Outreach channel strategy
Before drafting any outreach the agent should evaluate the best channel:

- EMAIL → use when: direct email is available and contact is VP level or above
- LINKEDIN DM → use when: LinkedIn URL is available and contact is C-suite (CEO/Founder) — cold email to CEOs rarely works, DM is warmer
- WEBSITE INQUIRY → use when: only generic partnerships@ email available — flag as low priority
- INSTAGRAM DM → use when: contact is a founder/creator with active personal IG
- COMBINATION → for Tier S contacts: suggest email + LinkedIn connection request same day

The agent should always STATE which channel it recommends and WHY before drafting the message. Format: "RECOMMENDED CHANNEL: [channel] — [one line reason]"

## Pressbox Chronicles outreach agent
- Triggered by: "> RUN AGENT" on Pressbox workspace contacts
- Input: contact name, company, title, email/LinkedIn, stage, category, pitch angle
- Process: evaluate channel first (email/linkedin/dm), enrich with current brand context, draft sports-forward outreach
- Output: recommended channel banner + draft message in modal
- Podcast context: sports storytelling format with press-box credibility
- Target sectors: sports brands, sports betting, athletic apparel, sports media, team partnerships, NIL platforms, sports law firms, and athlete-focused financial advisors
- Tone: energetic, sports-forward, concise
- Signs as: Marquel Martin, 3point0 Labs
- Workspace colorway: orange (#f97316)

## Follow-up agent (next to build)
- Triggered by: daily check or manual button
- Input: all sponsor contacts + last contact dates
- Process: flag anyone with no contact in 7+ days
- Output: list of overdue contacts with suggested next action
- Model: claude-haiku-4-5 (fast + cheap for simple checks)

## Study agent (personal dashboard — Marquel only)
- Triggered by: study session button
- Input: NFLPA exam topic of the day
- Process: generate practice questions, summarize key rules
- Output: study card with Q&A format
- Model: claude-sonnet-4-20250514
- Note: lives on personal dashboard only — not visible to team

## Agent rules
- Always use the minimum model needed for the task
- Haiku for simple checks and flags
- Sonnet for research, writing, personalization
- Never run an agent without a clear output to show the user
- Log every agent action to console for debugging
