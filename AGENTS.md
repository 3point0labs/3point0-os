# Agent Definitions — 3point0 OS

*Last updated: April 2026. Documents agents that exist and run today. Planned-but-unbuilt agents will be added when they ship.*

---

## Agent rules (apply to all)

- **Minimum model for the job.** Haiku for simple checks and flags. Sonnet for writing, research, personalization, strategy.
- **No silent runs.** Every agent has a clear output rendered to the user. Background-only behavior is a bug.
- **Log every agent action** via `logAgentEvent` in `src/lib/mailroom/activity.ts` — useful for debugging and future analytics.
- **Brand voice is owned by the playbooks, not the agent code.** When changing how an agent sounds, edit `docs/playbooks/*` — not the system prompt in code.
- **Never fabricate stats, listener counts, awards, or biographical details.** Use only what's in the playbook or sponsor data.

---

## 1. Sponsor outreach agent

The unified agent that drafts cold outreach for both One54 and Pressbox sponsors. Brand-aware via the playbooks loaded at runtime.

**Triggered by:**
- `> RUN AGENT` button on any sponsor card in the Partnerships kanban
- `PITCH →` button on a Today's Priority Targets row in Command Center

**Server action:** `draftOutreachEmail(sponsorId)` in `src/app/actions/draft-email.ts`

**Input:** full `Sponsor` object from Supabase (contact name, company, title, tier, category, pitch angle, LinkedIn URL, podcast, verification status)

**Process:**
1. Determine recommended channel via tier + title + available contact data (see "Channel strategy" below)
2. Web search for recent company news via DuckDuckGo HTML scrape
3. Load brand playbooks from `docs/playbooks/{podcast}-pitch.md` + `{podcast}-target-sponsors.md` — re-read on every call
4. Call Claude Sonnet 4 with the playbook content as authoritative brand context
5. Parse strict JSON output: `{ email, linkedinMessage }`

**Output (rendered in `DraftEmailModal`):**
- Recommended channel banner: `RECOMMENDED CHANNEL: [channel] — [one-line reason]`
- Editable To / Subject / Body fields
- Email verification badge next to "To" (green/yellow/red — driven by sponsor enrichment data)
- For COMBINATION channel only: blue LinkedIn section with editable note + Copy button + Open profile link

**Model:** `claude-sonnet-4-20250514` · `max_tokens: 1400`

**Tone:** Per the loaded playbook. Pressbox = journalistic, press-box credibility. One54 = confident, data-led, cultural-moment positioning. Both = max 3 paragraphs.

**Signs as:** `Marquel Martin / 3point0 Labs` (email closes with this; LinkedIn DM does not)

**Side effects:** On successful `Send via Gmail` (modal → `/api/gmail/send` with `sponsorId`), the server-side `markSponsorContacted(sponsorId)` helper:
- Updates `last_contact_date` to today
- Advances stage `New → Contacted` only
- Never downgrades (Negotiating stays Negotiating, just updates the date)

---

## 2. Channel strategy (used by the Sponsor outreach agent)

Before drafting, the agent picks one channel:

| Channel | When to use |
|---|---|
| **EMAIL** | Direct email is available AND contact is VP+ |
| **LINKEDIN DM** | LinkedIn URL is available AND contact is C-suite (CEO/Founder) — cold email to CEOs rarely works, DM is warmer. Or: LinkedIn is the only direct contact available. |
| **WEBSITE INQUIRY** | Only a generic inbox (`partnerships@`, `info@`, `hello@`) is available — flag as low priority |
| **INSTAGRAM DM** | Contact is a founder/creator with active personal IG |
| **COMBINATION** | Tier S contacts with both a real email AND a LinkedIn URL: send email + same-day LinkedIn connection request |

Channel logic lives in `recommendChannel(sponsor)` inside `src/app/actions/draft-email.ts`. The agent always **states the recommended channel and reason before drafting** (rendered as the banner at the top of `DraftEmailModal`).

For COMBINATION channel, the agent returns BOTH an email body AND a LinkedIn connection note (1-2 sentences, max 300 chars). They render as separate artifacts in the modal — operator sends the email via Gmail, then copies the LinkedIn note and pastes it as a LinkedIn connection request.

---

## 3. Brand playbook integration

The Sponsor outreach agent is **playbook-driven**:

- Two markdown files per podcast live in `docs/playbooks/`:
  - `{podcast}-pitch.md` — brand positioning, voice, proof points, partnership packages
  - `{podcast}-target-sponsors.md` — categories the show actively pitches + per-category angles
- The agent loads both files via `loadPlaybooks(podcast)` in `src/app/actions/draft-email.ts`
- Playbook content is injected into the system prompt as authoritative brand context
- **To change the voice of outreach for either show, edit the playbook — not the agent code.** That's the point.
- No cache. Edits apply on the next draft.

### One54 outreach (via the unified agent)

- **Playbooks:** `docs/playbooks/one54-pitch.md` + `docs/playbooks/one54-target-sponsors.md`
- **Voice:** Confident, specific, data-led. The audience is not "emerging" — they are already here, already buying, already shaping culture. Lead with the moment ("the brands that show up first will own this relationship for a generation").
- **Key proof points the agent draws from:** 220M+ social video views in 5 months, 8M+ follower ecosystem (hosts Akbar Gbajabiamila + Godfrey), iHeartPodcasts production, "From the makers of Club Shay Shay," guest list including Uzo Aduba / Tiffany Haddish / Boris Kodjoe / Festus Ezeli / Prince Amukamara.
- **Target sectors:** financial services & credit, streaming platforms, music/audio platforms, global brands entering Africa, African CPG/founder brands, travel & hospitality, African tech/SaaS, sports brands with African ties (Tier B for sports), education/professional development. Full taxonomy in the target-sponsors playbook.
- **Workspace colorway:** green (`#16a34a`)

### Pressbox Chronicles outreach (via the unified agent)

- **Playbooks:** `docs/playbooks/pressbox-pitch.md` + `docs/playbooks/pressbox-target-sponsors.md`
- **Voice:** Journalistic, story-driven, "press-box credibility." Jeff Pearlman wrote the books on Vince Lombardi, Barry Bonds, the Dallas Cowboys, and the Showtime Lakers. The Hollywood Reporter called Pressbox "the new 30-for-30." Pitches lean into that credibility — not breathless hype.
- **Key proof points the agent draws from:** 1.4M monthly YouTube views, 65K subscribers, 66% returning viewers, 7:13 avg view duration, 54.4% completion, 95.9% male / 45-64 prime demo, "Top 25% of Blue Wire Network" by audio downloads.
- **Target sectors:** TV streaming / sports media, credit cards & financial services, sports betting & fantasy, home purchase / mortgage, NIL platforms, athletic apparel, sports law / agent services, sports tech / recovery, premium subscriptions. Full taxonomy in the target-sponsors playbook.
- **Workspace colorway:** orange (`#f97316`)

---

## 4. Sponsor enrichment agent (RocketReach)

Replaces guessed contact data with verified data from RocketReach.

**Two modes:**

### Per-sponsor enrichment
- **Server action:** `enrichSponsor(sponsorId)` in `src/app/actions/enrich-contact.ts`
- **Triggered by:** programmatically (not yet wired to a UI button — used internally by bulk enrich)
- **Process:**
  1. Fetch sponsor from Supabase
  2. If `rocketreach_id` is already set, skip the search step
  3. Otherwise: `searchPerson({ company, name, titleKeywords })` — narrow search for ideal/acceptable titles (partnerships, BD, marketing leads)
  4. If narrow search returns nothing, retry without title filter
  5. `lookupPersonEmails(rocketreachId)` — pulls verified email + LinkedIn + current title
  6. Update Supabase: `email`, `email_verified`, `email_source`, `email_validation_error`, `linkedin_url`, `contact_title`, `rocketreach_id`, `rocketreach_looked_up_at`, `title_tier`
- **Credits:** 1 person_search + 1 person_lookup per successful match (2 credits). 1 credit on no-match.
- **Output:** `EnrichResult` with email + verification status + credits used

### Bulk enrichment
- **Server action:** `bulkEnrichPrioritySponsors({ tiers, minCreditsRemaining })` in `src/app/actions/enrich-contact.ts`
- **Triggered by:** green `✓ Verify Tier S+A emails` button on the Partnerships page
- **Process:**
  1. Check current RocketReach credit balance
  2. Stop early if `personLookupRemaining < minCreditsRemaining` (safety threshold)
  3. Query sponsors WHERE `tier IN tiers AND (email_source = 'unknown' OR email_source IS NULL)` — only enriches contacts not yet processed
  4. For each match: call `enrichSponsor(id)` with 300ms rate-limiting between calls
  5. Aggregate `{ enriched, skipped, failed, creditsUsedTotal }` plus remaining credits after run
- **Default tiers:** S, A
- **Default safety threshold:** 50 lookups remaining

**RocketReach plan in use:** Enterprise (15,000 person_search/mo + 20,000 person_lookup/mo). Credits checked via `getRocketReachCredits()`.

**Title classification:** Used to score quality of match. `TARGET_TITLE_KEYWORDS` in `src/lib/rocketreach.ts` defines partnerships/BD/marketing keywords. `classifyTitle(title)` returns `"ideal" | "acceptable" | "fallback" | "avoid"` and writes to `title_tier`.

---

## 5. Find Contact agent

Used inside the "+ New Contact" modal on the Partnerships page when an operator types a company name and clicks "Find contact" — the agent suggests a real decision-maker at the company.

**Server action:** `findBestContact(company)` in `src/app/actions/find-contact.ts`

**Input:** company name

**Process:** Web search via the Anthropic API, then Claude Sonnet identifies the best partnerships/BD/marketing contact at the company.

**Output:** `{ contactName, contactTitle, linkedinUrl, rationale }` — auto-fills the form fields with the rationale shown below the form.

**Known limitation:** Has historically produced guessed/fabricated emails. Trust the **contact name + title + LinkedIn URL** outputs; do NOT trust the email field — verify it through RocketReach enrichment instead.

**Model:** `claude-sonnet-4-20250514`

---

## 6. Discovery agent (sponsor discovery)

Suggests new sponsors not already in the pipeline.

**Component:** `src/components/DiscoverSponsorsModal.tsx` ("Discover new sponsors" button on Partnerships)

**Input:** podcast (One54 / Pressbox / both), category (or "All categories"), target count (10 / 25 / 50)

**Process:** Web search + Claude reasoning to find brands not already in the sponsors table that match the category and podcast fit.

**Output:** List of suggested companies + contact info; operator selects which to import to the kanban.

**Model:** `claude-sonnet-4-20250514`

---

## What's NOT yet built (roadmap parking lot)

Documented here so future-Claude doesn't think they exist:

- **Follow-up agent** — daily check that flags any sponsor with no contact in 7+ days and proposes next action. Planned for Haiku (cheap recurring check). Not built.
- **Study agent** — NFLPA exam prep helper for Marquel only. Generates practice questions, summarizes key rules. Planned for personal dashboard only — not visible to team. Not built.
- **Reply Inbox / Mailroom rebuild** — multi-account Gmail monitoring (inquiries@one54africa.com, Pink Dear inbox, marquel@3point0labs.io). Blocked on partner-credential risk (see open threads in CLAUDE.md). Not built.
- **Per-operator agents (Andrew, Randy)** — per the Context Engineering Doctrine in `docs/context-doctrine.md`. Not yet scaffolded — will come when those operators are formally onboarded.

When any of these ships, add a numbered section above and delete the entry here.
