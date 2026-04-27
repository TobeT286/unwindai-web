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

## Backlog — pick up after gadgets

- Wire `/api/contact` endpoint (Resend or Google Sheets) — currently form is a placeholder
- Wire energy enquiry form to the same endpoint
- Add Open Graph images per page
- Replace temporary "Coming Soon" copy on /gadgets with real tool cards
- Add Plausible / Umami analytics (lightweight, privacy-respecting)
- Lighthouse pass: target ≥95 on Performance / Accessibility / SEO

---

## Notes for tomorrow's session

- Start by saying: "Continue from WORKPLAN.md — run the functionality check first, then dispatch sub-agents for gadgets"
- The green logo generator script lives at `make_green_logo.py` — re-run if the source logo changes
- Worktree: `serene-hofstadter-09c764` (currently on branch `claude/serene-hofstadter-09c764`)
