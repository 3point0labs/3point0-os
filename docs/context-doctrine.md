# 3point0 Labs — Context Engineering Doctrine
**v1.0 · April 2026 · The Mailroom Intelligence Layer**

This document defines how intelligence (context, memory, skills, sub-agents) is organized inside 3point0 Labs. It is the operational spine for every AI-powered workflow in The Mailroom — how Marquel, Andrew, and Randy each run their own scoped intelligence without burning tokens on redundant loops, without their sub-agents stepping on each other, and without re-deriving the same knowledge on every query.

**The thesis (adapted from Karpathy):** LLMs don't need bigger context windows. They need the *right* context, at the *right* time, for the *right* operator. Build the knowledge layer once, compound it forever. Re-derive nothing.

---

## The four laws

Before anything else, these are the rules every agent in The Mailroom follows. They are non-negotiable.

**Law 1 — Scope.** Every sub-agent is scoped to exactly one operator (or "studio-wide" for company context). No agent reads across operators unless explicitly granted permission. Randy's content agents cannot read Andrew's legal memory. Andrew's legal agents cannot read Marquel's recruiting memory. This is not a security policy — it's a *quality* policy. Cross-contamination is how agents get confused and costs you tokens.

**Law 2 — Compile, don't re-derive.** If an agent has figured something out once — a sponsor's decision-maker, a contract clause pattern, a podcast guest's prior appearances — it gets written to the operator's memory file. Next time, the agent reads the compiled fact instead of re-researching it. This is Karpathy's insight, and it's where token savings live.

**Law 3 — Skills are procedural, memory is factual.** A `SKILL.md` file tells an agent *how to do something* (how to draft a sponsor email, how to review a brand-deal contract). A memory file tells an agent *what it knows* (who Oliver Schusser is at Apple Music, what Nike paid LeBron's agent last year). Never mix them.

**Law 4 — The minimum model for the job.** Simple checks (is this contact overdue, does this email mention pricing) run on Haiku. Research, writing, strategy, negotiation analysis run on Sonnet. Nothing in The Mailroom runs on a bigger model than the task needs.

---

## The architecture at a glance

Three layers, stacked like an office building:

```
┌──────────────────────────────────────────────────────────┐
│  LAYER 3 — Operator intelligence (per-person)            │
│  Marquel's stack  │  Andrew's stack  │  Randy's stack    │
│  Skills + Memory  │  Skills + Memory │  Skills + Memory  │
│  Sub-agents       │  Sub-agents      │  Sub-agents       │
├──────────────────────────────────────────────────────────┤
│  LAYER 2 — Studio intelligence (shared company memory)   │
│  COMPANY.md · CLIENTS.md · DEALS.md · CONTENT.md         │
│  Read by all operators. Written to carefully.            │
├──────────────────────────────────────────────────────────┤
│  LAYER 1 — Foundation (shared skills + tooling)          │
│  Design system · Brand voice · Email templates · Tools   │
│  Read-only reference. Everyone uses the same primitives. │
└──────────────────────────────────────────────────────────┘
```

**Principle:** operators read *up the stack* (their own files → studio files → foundation files) and write *to their own layer only*. The only exception is studio memory, which is written to by a gated process (see "Studio memory discipline" below).

---

## The file system — how it's organized on disk

This is the actual folder structure we build inside `3point0-os`:

```
3point0-os/
├── .claude/
│   └── context/
│       ├── foundation/                 ← LAYER 1: read-only by all
│       │   ├── SKILL.md                ← how to use the Mailroom
│       │   ├── brand-voice.md          ← copy & tone rules
│       │   ├── design-system.md        ← the Stone & Cognac spec
│       │   ├── email-templates.md      ← approved templates
│       │   └── tools/                  ← tool descriptions
│       │
│       ├── studio/                     ← LAYER 2: shared company
│       │   ├── COMPANY.md              ← who we are, mission, pillars
│       │   ├── CLIENTS.md              ← 4 content clients + status
│       │   ├── DEALS.md                ← closed deals, active pipeline
│       │   ├── CONTENT.md              ← podcast universes, episodes
│       │   └── TEAM.md                 ← operators, roles, territory
│       │
│       └── operators/                  ← LAYER 3: per-person
│           ├── marquel/
│           │   ├── SKILL.md            ← Marquel's operational playbook
│           │   ├── MEMORY.md           ← what Marquel's agents know
│           │   ├── PARTNERSHIPS.md     ← sponsorship intel
│           │   ├── RECRUITING.md       ← NFLPA, athlete prospects
│           │   ├── STUDY.md            ← NFLPA exam prep
│           │   └── agents/             ← Marquel's sub-agents
│           │       ├── partnerships-outreach.md
│           │       ├── recruiting-tracker.md
│           │       ├── follow-up.md
│           │       └── study-coach.md
│           │
│           ├── andrew/
│           │   ├── SKILL.md            ← Andrew's operational playbook
│           │   ├── MEMORY.md           ← what Andrew's agents know
│           │   ├── LEGAL.md            ← contracts, clause patterns
│           │   ├── OPERATIONS.md       ← ops decisions, vendors
│           │   ├── DEAL-STRUCTURE.md   ← term sheet patterns
│           │   └── agents/
│           │       ├── contract-review.md
│           │       ├── term-sheet-builder.md
│           │       ├── vendor-management.md
│           │       └── compliance-check.md
│           │
│           └── randy/
│               ├── SKILL.md            ← Randy's operational playbook
│               ├── MEMORY.md           ← what Randy's agents know
│               ├── CONTENT.md          ← editorial + narrative frameworks
│               ├── PODCASTS.md         ← ONE54 + Pressbox production notes
│               ├── SOCIAL.md           ← platform-specific playbooks
│               └── agents/
│                   ├── episode-prep.md
│                   ├── social-scheduler.md
│                   ├── guest-research.md
│                   └── clip-producer.md
```

That's the whole system. Every file is markdown. Every file is human-readable. Every file is agent-writeable. No database, no vector store, no RAG complexity — Karpathy's point exactly.

---

## Layer 1 — Foundation (shared, read-only)

These are the primitives everyone's agents read. They exist so nobody re-derives the basics.

**`foundation/SKILL.md`** — The Mailroom operating manual. "When you're working inside 3point0 Labs, here's how things work." High-level orientation for any new agent joining the system.

**`foundation/brand-voice.md`** — Every copy rule from the design system's voice section. Tight declarative sentences. No exclamation points. Italic serif for emphasis. Signature lines locked.

**`foundation/design-system.md`** — The Stone & Cognac spec doc (we already wrote this). Agents reference it when drafting any UI or visual output.

**`foundation/email-templates.md`** — Approved outreach templates. Sponsor intro, follow-up, talent intro, press pitch, etc. Agents adapt these rather than inventing from scratch.

**`foundation/tools/`** — One file per tool (Gmail MCP, Calendar MCP, Twilio, Anthropic API, etc.) describing when to use it, what to pass, what to expect back. Agents load these on demand — never the whole folder at once.

**Rule:** Foundation files are **read-only at runtime**. They change only when an operator explicitly updates them (like a design system version bump). Agents never write here.

---

## Layer 2 — Studio (shared company intelligence)

These are the files that represent 3point0 Labs itself. They compound across everyone's work. Every agent across every operator reads them.

**`studio/COMPANY.md`** — Mission, three pillars, positioning, current priorities. What the company is building this quarter, what it's not. Where the cash is coming from, where it's going.

**`studio/CLIENTS.md`** — Your 4 active content clients. Who they are, what you do for them, their status. Updated when a client is added, dropped, or meaningfully changes.

**`studio/DEALS.md`** — Closed deals, active pipeline summary, lost deals and why. This is the *compressed* view — individual deal details live in Marquel's partnership memory.

**`studio/CONTENT.md`** — ONE54 and Pressbox universes. Recurring guests, recurring sponsors, thematic arcs, published episode count, upcoming slate.

**`studio/TEAM.md`** — Who does what. Marquel → Partnerships + Recruiting + Sponsorships. Andrew → Legal + Operations + Deal structure. Randy → Content + Podcasts + Social. Updated on role changes only.

### Studio memory discipline

Studio files are high-leverage but dangerous — if they get polluted, everyone's agents get worse. The rule:

- **Agents propose, operators approve.** A sub-agent can draft an update to a studio file, but it lands in a `pending/` folder. An operator reviews and promotes it. Nothing auto-commits to studio memory.
- **Every studio file has an "UPDATED" header.** Who updated it, when, and why. Audit trail baked into the file itself.
- **Studio files get re-compiled quarterly.** Operator sits down with an agent and has it re-read the file and suggest consolidations. Prevents file rot.

---

## Layer 3 — Operator intelligence (the part you're asking about)

This is where each of you — Marquel, Andrew, Randy — lives. Every operator gets an identical *structure* but wildly different *contents*. Same shelf system, different books.

### The standard per-operator folder

Every operator gets five files and a sub-agent directory:

| File | Purpose |
|---|---|
| `SKILL.md` | Your operational playbook. How *you* work. What you care about. How your agents should act on your behalf. |
| `MEMORY.md` | The top-level compiled facts your agents have learned. Index pointing to deeper memory files. |
| `DOMAIN-1.md` | First domain memory file (e.g. `PARTNERSHIPS.md`) |
| `DOMAIN-2.md` | Second domain (e.g. `RECRUITING.md`) |
| `DOMAIN-3.md` | Third domain (e.g. `STUDY.md`) |
| `agents/*.md` | One markdown file per sub-agent. Defines what that agent does, which memory it reads, which tools it uses, which model it runs. |

### Marquel's stack — Partnerships / Recruiting / Sponsorships

**`marquel/SKILL.md`** — "I'm the founder. I run partnerships, recruiting, and sponsorship. I think in deals and systems. I don't want long explanations — I want the ranked move. When drafting on my behalf, be direct, confident, and commercially sharp. Sign outreach as 'Marquel Martin · 3point0 Labs' unless the context is athlete recruiting, where I sign as 'Marquel Martin'."

**`marquel/MEMORY.md`** — The index. "Sponsors I've pitched lately → see PARTNERSHIPS.md. Athletes I'm tracking → see RECRUITING.md. NFLPA exam prep → see STUDY.md. Active relationships → below."

**`marquel/PARTNERSHIPS.md`** — The big one. Every sponsor in your pipeline, every decision-maker you've identified, every rate card you've seen, every objection you've handled. This file *grows* as agents work. Example entries:

```
## Apple Music / Shazam
- DM: Oliver Schusser (VP Apple Music)
- Status: Tier S, never contacted as of April 2026
- Angle: Platform diversity + African market entry
- Budget signal: Unknown — need to research Q3 ad spend
- Last touched: —
- Best outreach channel: LinkedIn InMail (confirmed open rate)

## BET+ / Paramount
- DM: Scott Mills (CEO BET)
- Status: Tier S, never contacted
- Angle: ONE54's African diaspora audience = Paramount's global strategy
- Prior context: Paramount acquired Miramax 2019 — cultural content focus
- Warm intro available? Randy may know someone at BET
```

**`marquel/RECRUITING.md`** — Athlete prospects for future representation. Tier rankings, prior contact, agency status, exclusive windows.

**`marquel/STUDY.md`** — NFLPA Contract Advisor exam prep. Key rule sections, practice questions, your weak areas, upcoming exam date. Study agent reads and writes here.

**`marquel/agents/partnerships-outreach.md`** — defines the Partnerships Outreach Agent:

```
# Partnerships Outreach Agent (Marquel)

## Purpose
Draft sponsor outreach for ONE54 and Pressbox. Recommend best channel.
Only runs on contacts in Marquel's partnerships pipeline.

## Reads
- foundation/brand-voice.md
- foundation/email-templates.md
- studio/COMPANY.md
- studio/CONTENT.md (for podcast context)
- marquel/SKILL.md
- marquel/PARTNERSHIPS.md (the target's file)

## Does NOT read
- Randy's files. Andrew's files. Any studio file not listed above.

## Writes
- Drafts to marquel/outbox/ (pending operator approval)
- Proposes updates to marquel/PARTNERSHIPS.md (after outreach)

## Model
- claude-haiku-4-5 (simple drafting, cheap)
- Escalates to claude-sonnet-4-6 only if asked to research or strategize

## Token budget per run
- ~2,500 input / ~800 output
```

This is the key: the agent *knows exactly what to read* before it runs. No loading the whole company context on every draft. No re-reading the brand voice for the 400th time.

### Andrew's stack — Legal / Operations / Deal structure

**`andrew/SKILL.md`** — "I'm CBO. UCLA JD/MBA. I ran business affairs at CAA and eOne. My agents should think like a deal lawyer crossed with an ops lead: precise, paranoid about downside, always looking for exclusivity traps, rate-card benchmarks, and term-sheet deviations. Sign outreach as 'Andrew Cutrow · 3point0 Labs'."

**`andrew/LEGAL.md`** — Contract clause patterns Andrew has seen. Standard music licensing, standard athlete endorsement, standard production agreements. Red flags catalogue. Exclusivity traps. Comp terms by deal type.

**`andrew/OPERATIONS.md`** — Vendors, software licenses, legal filings, compliance deadlines, tax structure.

**`andrew/DEAL-STRUCTURE.md`** — Term sheet patterns by category. When to ask for equity. When to accept backend-only. How to structure step-ups.

**`andrew/agents/contract-review.md`** — defines Andrew's contract review sub-agent. Reads only Andrew's legal files + the specific deal being reviewed. Flags deviations from standard terms.

**`andrew/agents/term-sheet-builder.md`** — generates term sheets from Andrew's patterns.

### Randy's stack — Content / Podcasts / Social

**`randy/SKILL.md`** — "I'm CCO. I run content and podcasts. My taste is editorial — A24 meets longform journalism. Sign my outreach as 'Randy Faehnrich · 3point0 Labs'. When drafting on my behalf, lean into narrative framing and specific cultural references."

**`randy/CONTENT.md`** — Editorial frameworks, narrative arcs you've used, content themes that perform.

**`randy/PODCASTS.md`** — ONE54 + Pressbox production notes. Recurring segments, guest booking patterns, sponsor read templates, episode formulas that work.

**`randy/SOCIAL.md`** — Platform-specific playbooks. Instagram for ONE54 is different from Twitter for Pressbox. What's landed, what hasn't.

**`randy/agents/episode-prep.md`** — sub-agent that preps episode briefs from guest research + Randy's content frameworks.

**`randy/agents/social-scheduler.md`** — drafts platform-specific posts around new episodes.

**`randy/agents/guest-research.md`** — researches upcoming podcast guests, pulls relevant prior appearances, drafts intro questions.

**`randy/agents/clip-producer.md`** — identifies shareable moments from episode transcripts.

---

## The four context moves (applied to your studio)

LangChain's framework maps exactly to how each operator's stack should work:

### 1. Write — save it outside the context window

Every operator's `MEMORY.md` and domain files ARE the scratchpad. When an agent learns something useful ("Scott Mills at BET mentioned they're hiring a podcast licensing lead in Q2") it writes that to the relevant memory file. Next time anyone asks about BET, that context is already there.

### 2. Select — fetch only what's relevant

Sub-agents declare upfront which files they read (see the partnerships-outreach.md example). They don't load the whole operator folder. They don't load other operators' folders. They don't load foundation files that aren't relevant to the task.

**Practical rule:** a sub-agent's reads should be under ~8,000 input tokens. If it needs more, split it into two sub-agents.

### 3. Compress — summarize before it bloats

Every operator's `MEMORY.md` is a *compressed* index pointing to deeper files. When `PARTNERSHIPS.md` grows past ~20,000 words, a monthly "compiler" agent rewrites the top section as a summary and archives old entries to `marquel/archive/partnerships-q1-2026.md`.

### 4. Isolate — keep operator contexts separate

This is the big one for your multi-operator question. Randy's content agent never reads Andrew's legal memory. Andrew's contract review agent never reads Marquel's recruiting files. **Isolation is enforced at the agent definition level** — each agent's markdown file explicitly lists what it's allowed to read.

---

## How this saves you tokens (real math)

A typical sponsor outreach draft today, unscoped, might look like:

```
System prompt (generic):                    ~800 tokens
Brand voice rules (loaded every time):    ~1,200 tokens
Company context (loaded every time):      ~2,500 tokens
All prior sponsor notes (everyone's):     ~14,000 tokens
Target contact info:                        ~400 tokens
Instructions:                               ~300 tokens
──────────────────────────────────────────────────────
TOTAL per draft:                          ~19,200 tokens
At Sonnet pricing, per 100 drafts:      ~$5.76 input
```

Same draft, scoped through this system:

```
Agent definition (partnerships-outreach):   ~400 tokens
Brand voice (only when drafting):         ~1,200 tokens
COMPANY.md (compressed):                    ~600 tokens
CONTENT.md (relevant podcast only):         ~500 tokens
marquel/SKILL.md:                           ~300 tokens
PARTNERSHIPS.md entry for this target:      ~250 tokens
Instructions:                               ~300 tokens
──────────────────────────────────────────────────────
TOTAL per draft:                           ~3,550 tokens
At Haiku pricing, per 100 drafts:       ~$0.10 input
```

**About 5x fewer tokens, running on a cheaper model, with better output** (because the agent has exactly the right context, not a kitchen sink). This is where Karpathy's thesis becomes dollars.

---

## The onboarding ritual (for when Andrew and Randy join)

When you're ready to plug Andrew and Randy into The Mailroom, the onboarding is a one-day process:

**Day 1 (30 minutes) — their SKILL.md.** Sit with them. Ask: how do you work? What's your territory? What signature do you want on outreach? What do your agents need to know about your taste? You type as they talk. Save it to `operators/[name]/SKILL.md`.

**Day 1 (30 minutes) — seed their MEMORY.md.** Start with an empty index file. Add the three domains they own. Create empty files for each. Over the next 90 days, their agents populate these.

**Day 1 (60 minutes) — their first two sub-agents.** Don't build all four on day one. Build the two they'll use daily. Andrew gets `contract-review.md` + `term-sheet-builder.md`. Randy gets `episode-prep.md` + `social-scheduler.md`. They use those for 30 days, then add the next two based on what they actually need.

**Day 1 (15 minutes) — access rules.** Make sure their agents are scoped to their files only. Confirm they can't accidentally read across operators. Do this in the agent definition files (the `reads:` block).

**Ongoing — compile, don't re-derive.** Every time an agent learns something new, it writes. Every week, the operator reviews what's been written. Every quarter, the operator re-compiles.

---

## What this enables that nothing else does

Three things worth calling out because they're the strategic payoff:

**1. You can demo the whole studio from a single folder.** If an investor asks "how do you run this company?" you open The Mailroom, click Andrew's pixel character, the right panel shows Andrew's active sub-agents. You click Randy's. Different agents. You click your own. Different again. Four operators (you, Andrew, Randy, and future hires) each with scoped, working intelligence. That's a demo nobody else in talent representation has.

**2. You're practicing what AGiNT is pitching.** AGiNT sells scoped agentic representation to sports agents. If 3point0 Labs itself runs on scoped agents per operator, you're not pitching a theory — you're pitching the thing you already use. The Mailroom becomes the case study. Dogfooding = credibility.

**3. When you hire operator #4, 5, 6, onboarding is a folder.** A new hire gets `operators/[theirname]/` created with empty template files. Their SKILL.md gets written in 30 minutes. Their agents come online within a week. You've just systemized the "agency mailroom training" into a repeatable onboarding rail. That's a scalable studio.

---

## The short version (for when you're explaining this to Andrew and Randy)

> "Everyone gets their own folder in The Mailroom. Your folder has your playbook, your memory, and your sub-agents. Your agents only read your files, unless they need something company-wide — then they read from the shared studio files. They never read other operators' stuff.
>
> Every time your agent learns something, it writes it down so it doesn't forget next time. That's how we stop burning tokens on stuff we already figured out.
>
> You own your stack. I own mine. Randy owns his. The company stays coherent because we all pull from the same foundation — same brand, same design, same values — but our day-to-day intelligence is ours."

That's the doctrine. One page, one concept, operator-grade.

---

## Phase plan — build this incrementally

You don't build all of this in week one. You build it in three phases as The Mailroom itself matures.

**Phase 1 (this week, while you finish v10 and restyle):**
- Create the folder structure above — empty files, proper hierarchy
- Write `foundation/SKILL.md`, `foundation/brand-voice.md`, `foundation/design-system.md`
- Write `studio/COMPANY.md`, `studio/TEAM.md`
- Write `marquel/SKILL.md` + `marquel/MEMORY.md` as empty index

**Phase 2 (next week, alongside Mailroom build):**
- Build Marquel's first two agents: `partnerships-outreach.md`, `follow-up.md`
- Wire those agents into the existing 3point0 OS partnerships page
- Start letting them write to `marquel/PARTNERSHIPS.md` after every draft

**Phase 3 (when Andrew joins formally):**
- Create `operators/andrew/` folder
- Run the 30-minute SKILL.md interview
- Build `andrew/agents/contract-review.md`, `term-sheet-builder.md`
- Andrew uses these for 30 days before you add more

**Phase 4 (when Randy joins formally):**
- Same ritual. Create `operators/randy/`. Interview. Two agents first.
- Wire into the Broadcast Room pages

**Phase 5 (compound and compress):**
- Quarterly: operator + compiler agent review each memory file, consolidate, archive
- Annually: re-read `foundation/` files, update brand voice, ship v2 of the design system

---

**— 3POINT0 LABS · CONTEXT ENGINEERING DOCTRINE v1.0**
*Written April 2026 for The Mailroom. Update as agents earn it.*
