# Atlas → Job offers playbook

The repo + the deployed demo + the 60s video are the artillery. This is how
you actually convert them into interviews and offers.

## What you're aiming at (be honest with yourself)

Pick the bucket that matches your seniority + how Atlas presents you. You
can target two buckets at once but not three — your messaging splits.

| Bucket | Title bands | Comp ranges (US remote, 2026) |
|---|---|---|
| **Senior Frontend / Product Engineer** | Senior, Lead Product Engineer | $140-200K base |
| **Staff Frontend / Graphics** | Staff SWE, Senior Staff | $200-300K base + equity |
| **Founding Engineer / Eng #1-3** | Founding Engineer, Lead | $130-180K base + 0.5-2% equity |
| **Specialist (graphics, realtime, CRDT)** | Senior at companies that need exactly this | $180-260K base |

Atlas places you naturally in the **Staff** or **Founding Engineer** bucket
— the combination of WebGL shaders, CRDT, multi-platform, and shipping
discipline is rare. Don't undersell.

---

## Tier 1 — Companies that NEED your exact stack

These companies build the same kind of product Atlas is. Your demo will
hit them like a magnet. **These are the highest-conversion targets.**

| Company | Role | Why they care |
|---|---|---|
| **Linear** | Senior/Staff Product Engineer | Their graph view is exactly this. Stack: TS, custom canvas. |
| **Notion** | Senior Frontend / Performance | They wrestle with rendering large docs/databases. WebGL canvas projects ongoing. |
| **Figma** | Senior Software Engineer (Multiplayer / Editor) | CRDT, custom rendering, multi-cursor — Atlas hits every box. |
| **Arc / The Browser Company** | Senior Engineer | Spatial UX, Apple-tier polish, opinionated rendering. |
| **Tana** | Senior Engineer | Spatial knowledge graph product. Tiny team. |
| **Reflect** | Engineer | Apple-tier notes app with graph view. |
| **Reflect.app / Capacities / Anytype** | Engineer | Same product space. |
| **Liveblocks** | Founding/Senior Engineer | CRDT infra — they'd love your gateway implementation. |
| **Multi (now Salesforce)** | Realtime engineer | Multiplayer rendering. |
| **Pitch** | Senior Engineer | Collaborative canvas in their core. |
| **Cursor / Anysphere** | Senior Frontend | Editor that needs heavy rendering. |
| **Vercel** | DX Engineer / Senior Frontend | Next.js 16 expertise + showcasing it. |
| **Resend / Trigger.dev / Outerbase** | Senior Engineer at YC-stage devtools | Atlas-level polish stands out. |

## Tier 2 — Adjacent fits (good landing pad)

| Company | Why |
|---|---|
| **Stripe** | Frontend Infra, Dashboard Performance |
| **Replit** | Realtime collab, editor rendering |
| **Loom** | Editor + canvas + realtime |
| **Excalidraw / tldraw** | Canvas-first, open source — also good for community |
| **Plasmic / Builder.io** | Visual builder, canvas heavy |
| **Cocoon / Mmhmm** | Multi-platform creative tools |
| **Apple** (any role touching spatial / VisionOS) | Visual sophistication |

## Tier 3 — Use Atlas as differentiator (broad senior frontend)

Pretty much any well-funded startup with a sophisticated frontend will be
impressed. Examples: Watershed, Ramp, Mercury, Brex, Posthog, Browser Use,
Modal, Anthropic, Replicate, Hugging Face, Mistral, Together AI.

## Tier 4 — Skip these (don't waste cycles)

- Companies with "React Developer" titles (you're senior+, that bar is below)
- Agencies (your skills are over their needs; they pay less)
- Crypto unless you genuinely care
- Big tech FAANG unless you specifically want the comp/scale

---

## Cold outreach templates

### Template 1 · LinkedIn DM to a hiring manager / eng lead (90 words)

> Hey {Name} — I just shipped **Atlas**, a spatial knowledge OS with
> a custom WebGL renderer (instanced shaders, GPU picking), CRDT sync,
> and a Llama-3.2 integration for AI summaries. Same product runs on
> iOS via Skia + Reanimated, 120Hz on ProMotion.
>
> Saw {Company} is hiring for {role}. The fit looks tight — I think
> Atlas is the kind of work {Company} ships.
>
> 60s demo: [link]
> Architecture writeup: [link]
>
> Worth a 15-min chat?

**Why it works:** specific, short, leads with proof. No "I'm passionate
about", no "I've been a fan for years". Just: here's what I built, here's
why you should look.

### Template 2 · Email to a founder / CTO (when no role posted)

> Subject: I built Atlas — would {Company} be interested?
>
> Hi {Name},
>
> I'm Juan, a software engineer based in {your city}. I just shipped
> Atlas: a multi-platform spatial knowledge tool — custom WebGL shaders,
> CRDT realtime sync, local LLM via Ollama, full iOS app with shared
> data layer. Web + mobile from a deliberately shared core.
>
> What it demonstrates I can do:
>  - Design state ownership across CRDT + store + React
>  - Write custom GLSL for instanced rendering at 60fps with 10k nodes
>  - Build a WebSocket sync gateway compatible with the Yjs protocol
>  - Ship the same product on iOS without code-duplicating the engine
>
> Demo: [link]
> Architecture: [link]
> 60s video: [link]
>
> If {Company} is hiring senior/staff engineers — even informally — I'd
> love to chat. If not, no worries; I respect your inbox.
>
> Juan

**Why it works:** addresses "we're not hiring" preemptively, sells what
you can DO not what you ARE, gives all artifacts up front.

### Template 3 · Application form / cover letter (when you HAVE to)

> Atlas is a spatial knowledge operating system I built end-to-end:
> Next.js 16 web with custom WebGL rendering (instanced shaders, GPU
> picking, semantic LOD), a NestJS realtime sync gateway over the Yjs
> protocol, and an iOS app in React Native + Skia with 120Hz gestures.
> Same data layer powers both. Local LLM integration via Ollama lets
> the app run fully offline at zero cost. 80 source files, 6.6k lines
> of TypeScript, 19 tests.
>
> I built it because the canvas-rendering, CRDT-sync, multi-platform
> problem is the kind of work I want to be doing — and {Company} is one
> of a small handful of places doing it at this level.
>
> Demo, repo, and video on my portfolio: [link]

**Why it works:** front-loads concrete, ends with the "why us" without
being sycophantic.

### Template 4 · Twitter/X DM (50 words max)

> Built **Atlas** — spatial knowledge graph with custom WebGL renderer,
> CRDT sync, multi-platform (web + iOS), local Llama integration.
>
> Saw {Company} is hiring. Demo: [link] · 60s video: [link]
>
> Up for a chat?

---

## How to source contacts

| Source | How |
|---|---|
| **LinkedIn** | Filter people by "Senior/Staff Engineering Manager" + company. Add note when sending connect (15 words: "Built Atlas, looking at {Company} roles"). |
| **AngelList/Wellfound** | Direct apply but ALSO message the listed founder. |
| **Read.cv / Polywork** | Founder-friendly format — list Atlas at the top. |
| **YC Work at a Startup** | Filter by stage + remote. Apply 5-10/week max — quality > spam. |
| **Twitter/X** | Find engineering leads who post about UI/rendering/CRDT. Reply useful comments on their posts BEFORE DMing. |
| **HN Who's Hiring** | First Tuesday of each month. Reply to posts matching your stack. |
| **Discord / Slack** | r/reactjs, Reactiflux, devtools-related Slacks. Soft visibility before warm intros. |

---

## Pricing yourself in interviews

When asked "what comp are you looking for", **don't pick a number; pick a
range and reference market**. Example for staff frontend US-remote:

> "Based on Levels.fyi, staff frontend at similar-stage companies is in
> the $200-280K base + equity range. I'd be looking in that band, with
> the exact number depending on equity refresh, remote flexibility, and
> the role's scope."

Numbers vary if you're outside the US — but reference market data
explicitly (Levels.fyi, OpenComp, NumberFinder). The signal you send is
"I've done my homework". Never improvise a number on the spot.

---

## Conversion rate expectations (realistic)

| Step | Pass-through % |
|---|---|
| Outreach sent | 100 |
| Reply rate | 15-25% |
| First call booked | 8-15% |
| Second round (technical) | 4-8% |
| Onsite | 2-5% |
| Offer | 1-3% |

For a portfolio this strong, expect the **upper end of each band**. If
you send 50 quality outreaches per week, you should be in 5-10 first
calls by week 3.

**Compound this:** every interview makes you better at the next one.
Don't apply to your dream company in week 1 — apply in week 4 when
you've practiced.

---

## The order I'd do this in

### Week 1 (3 days of work)
- [ ] Push Atlas to public GitHub repo
- [ ] Deploy web to Vercel (see DEPLOY.md)
- [ ] Record + edit 60s video (see VIDEO_SCRIPT.md)
- [ ] Update your LinkedIn headline: "Senior Software Engineer · ex-{X} · Built Atlas"
- [ ] Pin Atlas on GitHub profile

### Week 2 (find the leverage)
- [ ] Post Atlas launch on LinkedIn + Twitter/X (one well-crafted post each)
- [ ] Post on Hacker News "Show HN: Atlas — a spatial knowledge OS"
- [ ] Submit to designer/dev awesome lists (awesome-react, awesome-three, etc)
- [ ] Track every view/click/DM in a single spreadsheet

### Week 3-4 (apply hard)
- [ ] Tier 1 outreach (15-20 specific companies, personalized)
- [ ] Tier 2 outreach (broader, template-driven)
- [ ] Tier 3 spray (apply via forms but ALSO message a real human)
- [ ] Practice technical interviews on Atlas itself — the demo IS your interview material

### Week 5+ (negotiate)
- [ ] First offers come in — never accept the first number
- [ ] Tell other companies "I have an offer, I'd love to wrap up by Friday"
- [ ] Negotiate on equity refresh as hard as base — equity is real money
- [ ] Pick the company you'd be most proud to ship at, not the most prestige

---

## One last thing

Your job isn't to convince companies they need you. Your job is to find
the small number of companies that *already* need exactly what you've
shown you can build, and make it obvious to them in under 60 seconds.

Atlas does that. The work now is **distribution**, not building.
