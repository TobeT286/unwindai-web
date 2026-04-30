# UnwindAI Web — Workplan

## Today (this session) — completed
- [x] Homepage greeting shortened, sped up to 12ms/char, dark grey on white bubble
- [x] 15s idle follow-up listing the 3 divisions (Data & AI, Unwindai GoGreen, Gadgets) with clickable links
- [x] Markdown link rendering in chat (`[text](url)` → `<a>`)
- [x] Sample prompt chips updated:
  - 🔥 AI Integration for SME business (highlighted with "Trending for Tradies" tag)
  - 📊 Data platform cost (kept)
  - ❄️ VEU Energy Upgrades — Unwindai GoGreen?
- [x] Chat input converted to auto-grow textarea (long prompts no longer cut off)
- [x] Green logo variant created at `public/images/logo_green.png`, wired into energy nav
- [x] /data page rebuilt with **Our Services** (3 cards) + **Prior Projects** carousel (Translink / Deakin / Fox Sports / 6Step)
- [x] Contact menu replaced with form modal (Name / Email / Question — 10 rows / Send)
- [x] Energy page: contact form next to chatbox (side-by-side)
- [x] Energy page: 5s second message about gas hot water / heat pump / energy assessments

---

## Tomorrow — first task: functionality check
Go through the homepage and each subpage and verify:
- [ ] Homepage chat: greeting types out, 15s idle prompt fires, clickable links work
- [ ] Homepage prompt chips: all 3 send the right prompts and chat expands
- [ ] Homepage textarea: long prompts are visible and scroll
- [ ] /data page: services section renders, prior projects carousel auto-rotates and arrows work
- [ ] /energy page: chat + contact form display side-by-side, 5s second message fires, full enquiry form below still works
- [ ] Contact menu (all 4 pages): clicking opens modal, form submits without page reload
- [ ] Mobile layout: hero, chat, side-by-side stack correctly under 640px
- [ ] All internal navigation links (Data & AI, Energy, Gadgets) load the right pages
- [ ] Markdown links in assistant responses render as clickable `<a>` (not raw `[text](url)`)

If any of the above is broken — fix before moving on.

---

## Tomorrow — main work: build out /gadgets

Three free tools to ship. Plan to dispatch each as a focused sub-agent so they can be built in parallel without interfering with each other.

### 1. Bank Statement Summariser
- Upload PDF/CSV bank statements
- Parse transactions, categorise (groceries / fuel / rent / income / etc.)
- Summary view: monthly totals, top categories, recurring subscriptions
- Export summary as CSV or PDF

### 2. Invoice / Receipt Manager & Matcher
- Upload invoices and receipts (image or PDF)
- Extract vendor / amount / date / GST via Claude vision API
- Match receipts to invoices by amount + date + vendor proximity
- Show matched / unmatched lists, export CSV

### 3. SMSF Eligibility Checker
- Multi-step questionnaire (employment, super balance, business structure, age)
- Decision tree → eligibility verdict + plain-English explanation
- "Download my answers as PDF" so user can take to their financial planner

### Sub-agent dispatch pattern
Per CLAUDE.md sub-agent pattern:
1. **Research agent** — read existing chat.js / style.css / page structures, produce a build brief per gadget
2. **Build agent** (one per gadget) — implement the page + any API endpoints based on the brief
3. **Review agent** — verify each build against the original spec and our coding standards

All 3 gadgets share the same nav, footer, chat-widget pattern, and hero style — keep visual consistency with existing site.

API endpoints likely needed under `/api/`:
- `/api/parse-statement` — PDF → transactions JSON
- `/api/extract-receipt` — image → structured fields
- `/api/smsf-check` — answers → eligibility verdict (could also run pure client-side)

---

## Required Vercel env vars

Set these in **Vercel → Project Settings → Environment Variables** (Production scope):

| Var | Required? | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | already set, drives `/api/chat` and now `/api/intake` |
| `RESEND_API_KEY` | yes | email backup for every form (sign up free at resend.com) |
| `ENQUIRY_EMAIL_TO` | optional | overrides default `info@unwindai.com.au` |
| `CONTACT_EMAIL_FROM` | optional | once you verify a domain in Resend, e.g. `UnwindAI <enquiries@unwindai.com.au>` |
| `GOOGLE_SHEETS_ID` | optional | enables Sheets sink — ID is the long string in the sheet URL |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | optional | full service-account JSON pasted as a single-line string. Share the sheet with the service account email |

**Without `RESEND_API_KEY`:** forms still validate and AI router still runs, but no email is sent — visitor sees an error, fall back to direct mail.
**Without `GOOGLE_*`:** Sheets sink silently skipped, log + email continue working.

---

## Backlog — pick up after gadgets

**Near-term (after gadgets ship):**
- Phase 2 polish: split routes use `/api/contact` and `/api/enquiry` legacy endpoints; consider deprecating those once `/api/intake` is verified
- Add file-attachment support to `/api/intake` (energy full enquiry form has the input but file isn't uploaded yet — see Pattern B in session history; ~2 hour build)
- Add Open Graph images per page
- Replace temporary "Coming Soon" copy on /gadgets with real tool cards
- Add Plausible / Umami analytics (lightweight, privacy-respecting)
- Lighthouse pass: target ≥95 on Performance / Accessibility / SEO
- Privacy policy linked from footer (mandatory before public 1.0 launch — Phase 2+ touches PII)
- Local DuckDB sync: scheduled Python script that pulls Sheets nightly into DuckDB

**Phase 3-4 (after homepage 1.0 ships):**
- AI-drafted reply emails — `/admin/leads` page with magic-link auth; you review-and-send instead of typing each reply
- AI books Calendly slot with personalised brief — low-compliance bridge before voice

**Long-term — auto-calling agent (Phase 5, "Unwindai GoGreen voice agent")**
- See `ROADMAP.md` Phase 5 for full architecture, compliance constraints, and pricing-accuracy guardrails
- TL;DR: form submission with "OK to call" consent → Vapi.ai-managed agent calls within an hour, walks through VEU options with live VEEC pricing, books in-person assessment or politely opts out
- Build cost: ~2 weeks MVP via Vapi (managed Twilio + STT + LLM + TTS); operational cost ~$0.50-$1.50 per 5-min call
- Hard prerequisites: Phases 2-4 working, real-world transcripts to learn from, Australian compliance sorted (AI disclosure, recording disclosure, DNC, Privacy Act, NDS rules), pinned VEEC pricing table so the model never invents numbers
- Quarter+ timeline — only worth building once close-rate × deal-size justifies the spend

**Alternative email transport (optional swap):**
- Currently: Resend API. Alternative: Gmail SMTP via App Password (`GMAIL_ADDRESS_UNWINDAI` + `GMAIL_APP_PASSWORD_UNWINDAI` env vars on Vercel + `nodemailer`). Resend is the recommended default — Gmail SMTP is here as a fallback if Resend doesn't suit. Never commit credentials; set them only in Vercel env

---

## Notes for the next session

**Recommended opening prompt (cold start, fresh window):**
> *"Read ROADMAP.md and WORKPLAN.md, then start Stream B — dispatch the research agent for gadgets, then the three build agents in parallel."*

**State of play as of last session (commit `a108bd0`):**
- Homepage feature-complete, nearing 1.0 release
- AI-routed `/api/intake` deployed; needs `RESEND_API_KEY` env var on Vercel to actually send mail
- Three streams in flight: A (homepage 1.0 polish), B (gadgets build, parallel sub-agents), C (Phase 2 verification + DuckDB sync)
- Voice/auto-calling agent **deferred to Phase 5** — see backlog above and `ROADMAP.md` Phase 5

**Push policy (per memory):** direct pushes to main are pre-authorised for this repo. `data-pipeline` repos still require diff review.

**Useful artefacts:**
- `make_green_logo.py` — re-run if source logo changes
- Worktree: `serene-hofstadter-09c764` on branch `claude/serene-hofstadter-09c764` (homepage edits land in main repo via absolute paths regardless)
