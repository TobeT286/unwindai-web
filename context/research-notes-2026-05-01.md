# Research notes — 2026-05-01

_One-off video analyses requested by Thomas. Auto-saved by ad-hoc research run; not part of the nightly youtube-researcher digest._

## Karpathy interview — Software 3.0 / agentic engineering / why apps shouldn't exist
**URL:** https://youtube.com/watch?v=96jN2OCOfLs&t=916s

**One sentence:** Karpathy argues we've crossed a threshold into a genuinely new computing paradigm — Software 3.0 — where prompting replaces programming, agents replace apps, and the critical skill is knowing how to direct and verify jagged, powerful AI systems rather than write code yourself.

### Substantive ideas

- **The December inflection point was real and underappreciated.** *"A lot of people experienced AI last year as a ChatGPT-adjacent thing. But you really had to look again as of December, because things changed fundamentally"* — specifically on agentic, coherent workflows that actually started working.

- **Software 3.0 means prompts are the new programs.** S1.0 = explicit code; S2.0 = training data and weights; S3.0 = *"your programming now turns to prompting, and what's in the context window is your lever over the interpreter that is the LLM."* The OpenClaw installer — a block of text you paste to your agent — is the paradigm in miniature.

- **Most existing apps shouldn't exist.** His MenuGen app (photo → OCR → image generation pipeline) was made obsolete by simply handing the photo to Gemini with a one-line prompt. *"All of my MenuGen is spurious. It's working in the old paradigm. That app shouldn't exist."* The question isn't how to speed up what exists — it's what's newly possible that couldn't exist before.

- **Verifiability explains the jaggedness.** Models peak in domains where outputs can be verified (math, code) because that's what RL reward signals target. *"If you're in the circuits that were part of the RL, you fly. If you're out of the data distribution, you're going to struggle."* The car-wash example: a model that can refactor 100k-line codebases still tells you to walk to the car wash.

- **Vibe coding ≠ agentic engineering.** *"Vibe coding is about raising the floor for everyone. Agentic engineering is about preserving the quality bar of what existed before in professional software."* The latter is a real discipline: coordinating stochastic, powerful agents to go faster without introducing vulnerabilities or losing design integrity.

- **You remain responsible for taste, spec, and judgment — for now.** Agents are "intern entities." They'll match Stripe emails to Google accounts by email address (wrong). Humans must own the spec, the architecture decisions, the unique IDs. *"You're doing the design and development; the agents are doing fill-in-the-blanks."* API details are delegated; mental models of what's actually happening underneath are not.

- **Ghosts, not animals.** LLMs aren't evolved intelligences with intrinsic motivation. Yelling at them changes nothing. They're *"statistical simulation circuits"* with RL bolted on top — useful framing for calibrating when to trust them and what to expect.

### Takeaways for Unwind AI's positioning

1. **Stop building middleware apps; sell agent-native workflows instead.** If the deliverable is a multi-step pipeline stitching APIs (ingest → transform → display), ask whether a well-prompted frontier model collapses that entire stack. Value-add to SMB clients = identifying which processes are pipeline-replaceable vs. which genuinely need orchestration — and building the latter, not the former.
2. **Find the client's verifiable domain and build there first.** Verifiability is a project-selection filter: if the output of an AI task can be checked (a report matches source data, a generated invoice is correct, a categorisation can be audited), reliable improvable systems are buildable. Pitch SMB clients on automating their most *checkable* back-office work first.
3. **Make everything agent-legible, not human-legible.** Karpathy's pet peeve — docs written for humans, not agents — is a product design opportunity. Structure outputs, SOPs, and onboarding so an agent can act on them directly (machine-readable schemas, paste-to-agent instructions, not PDFs). Compounds across every future agent the client adopts.

---

## AI mit Arnie — context generation video
**URL:** https://youtube.com/watch?v=i4u_sLwTlYw
**Title:** Ich hab eine KI gebaut, die alles kann
**Channel:** AI mit Arnie

## Analysis for Thomas

### (1) What specific technique/approach is shown

"Zippi" is a **custom-built Windows desktop orchestrator app** (written in C#) that:

- Sits as a **native always-on overlay**, tracking the cursor across all monitors
- Uses a **hotkey (F8) to activate voice input** → transcribed via Whisper or 11Labs STT
- Reads **full-screen context** (multi-monitor screenshots) via vision model
- Routes commands via **voice trigger words** ("nimm Codex," "nimm Claude Code," "nimm OpenClaw") using regex pattern matching to handle STT transcription errors
- **Orchestrates three separate CLI agents**: Claude Code, OpenHands ("OpenClaw"/Klaus), and OpenAI Codex — each spawned as a fresh background process
- Has an **Obsidian vault RAG connection** ("second brain")
- Responds with **11Labs TTS** (or local Whisper/TTS)
- Includes a `soul.md` personality/system prompt file
- The entire repo is **open-source on GitHub** (MIT license)

### (2) Novel or rebranded generic AI usage?

**Genuinely novel in execution** — not a chatbot wrapper. Specific non-trivial elements:

- The multi-agent orchestration via voice trigger words with regex fuzzy matching is a practical engineering solution to a real STT reliability problem
- Screen-capture context injection into vision models as a persistent desktop assistant is not standard tutorial content
- Spawning Claude Code/Codex/OpenHands as subprocesses from a voice command is an architectural pattern most SMB-focused AI content doesn't cover
- The `CLAUDE.md`/`AGENTS.md` setup for coding agent instruction files is a real workflow pattern

**Caveats**: Each sub-agent (Claude Code, OpenHands, Codex) is used conventionally. The novelty is in the **glue layer**, not the agents themselves. The app is currently Windows-only, sessions are non-persistent (except OpenHands via gateway), and it relies on Anthropic + 11Labs APIs (not fully local despite claims).

### (3) Downloadable/reusable assets mentioned

| Asset | Location | Status |
|---|---|---|
| Zippi GitHub repo | Linked in video description | Public, MIT license |
| `CLAUDE.md` / `AGENTS.md` | In repo | Coding agent instruction files |
| `soul.md` | In repo | System prompt / personality file |
| `.env.example` | In repo `/Windows/` | API key template |
| Setup prompt (copy-paste) | Skool community post (search "Zippi") | Requires community membership |
| `build.cmd` + `start.cmd` | In repo | One-click build/run scripts |
| `README.md` (detailed) | In repo `/Windows/` | Full setup instructions |

The **GitHub repo is freely accessible** — the Skool community adds only the copy-paste setup prompt (minor value-add).

### (4) Verdict for Thomas

**Spend 30 minutes on the GitHub repo first; the Skool community is low-priority.**

**Reasoning for Thomas specifically (solo AI consultant building agents for SMB clients):**

✅ **Worth grabbing**: The GitHub repo itself — the `CLAUDE.md`/`AGENTS.md` pattern for instructing coding agents, the `soul.md` system prompt structure, and the regex-based STT routing logic are all directly reusable patterns when building voice-activated or multi-agent systems for clients.

✅ **Architecturally relevant**: The orchestrator-as-thin-glue-layer pattern (lightweight coordinator spawning specialized agents) is exactly the right approach for SMB agent builds where clients need multiple tools without a monolithic system.

⚠️ **Windows-only limitation**: Mac support requires additional work per the video. If Thomas or his clients are Mac-based, this adds friction.

⚠️ **Skool community value is marginal**: The one concrete Skool-exclusive item is a copy-paste setup prompt — which Claude Code or Codex would generate anyway from the README. The classroom content (OpenHands, local AI, voice agents) overlaps heavily with public documentation.

❌ **Not worth an hour in the community** given public docs cover the same ground. The **GitHub repo + 30 minutes is the high-ROI path**. If the community has additional `AGENTS.md` templates or OpenHands workflow examples beyond what's in the repo, that could be worth a quick scan — but it's not evident from this video.

**Bottom line**: Clone the repo, study the orchestration architecture and `CLAUDE.md` patterns, skip the Skool subscription unless Thomas is specifically building voice-activated desktop agents for Windows clients.

---

## Hype check video
**URL:** https://youtube.com/watch?v=0qqV4yv-Hss
**Title:** Give Me 20 Minutes. I’ll Teach You 80% of Claude Code.
**Channel:** Simon Scrapes

## Blunt Assessment: "Give Me 20 Minutes. I'll Teach You 80% of Claude Code"

---

### (1) What Is Being Claimed/Demonstrated

A survey of 15 Claude Code usage patterns, covering: plan mode (shift+tab twice), context window management, /clear and /compact commands, claude.md configuration, slash commands, "skills" (structured prompt files), hooks, MCPs, UI alternatives to terminal, an "Agentic OS" concept (shared business context folder), skill chaining/scheduling, and a tiered memory system framework. Framed as practitioner wisdom from observing "thousands of real users."

---

### (2) What Is Actually New vs Known

**Known/standard:**
- Plan mode, /clear, /compact, claude resume — documented in Anthropic's own docs
- Context window degradation — well-established, widely discussed
- MCPs as standardised tool connectors — public knowledge since late 2024
- claude.md as system prompt — basic Claude Code setup
- Hooks for deterministic triggers — in the docs

**Marginally useful framing:**
- The "skills as progressive disclosure" pattern (name/description loads first, full file only when invoked) is a reasonable practical heuristic, not novel but usefully articulated
- The "table of contents claude.md pointing to reference files" rather than one bloated file — decent operational advice
- Keeping skill files under 200 lines as a discipline — practical rule of thumb

**Actually new:** Nothing. The "Agentic OS" and memory level framework are the presenter's own branded packaging of concepts (RAG, hooks, static context) that are standard in the field.

---

### (3) What Is Uniquely Valuable for Thomas's Stack

Honestly, not much — but here's what's worth 5 minutes of attention:

- **The claude.md-as-table-of-contents pattern** is directly applicable if you're building reusable Claude-powered SMB agents. Keeping it lean and pointer-based is good discipline for agents that share infrastructure across client deployments.
- **Hooks for guaranteed context loading at session start** is relevant if your VEU automation pipelines have consistent state they need to inject (e.g., client config, approved contractor lists) without relying on Claude's judgment to pull it.
- **The skill modularity / chaining framing** maps reasonably onto your pipeline architecture — the idea of composable skills that pass typed outputs rather than monolithic prompts is sound and aligns with how you'd structure DuckDB query → analysis → report chains.

What's **not** useful: The MCP section is superficial. The "Agentic Academy" product plugs are noise. The memory levels framework is a blog post dressed as insight.

---

### (4) Hype vs Signal Verdict: **2/5**

**Reasoning:** This is a competent beginner-to-intermediate orientation video, not a practitioner resource. The 80/20 framing is marketing — it's actually covering maybe 80% of the *surface* of Claude Code while going 10% deep on any of it. For someone already building production Python+DuckDB pipelines and Claude-powered agents, there is no new technique here, no code, no failure mode analysis, no discussion of token costs vs output quality tradeoffs, nothing about tool use reliability or error handling in agentic loops.

The presenter knows the product well enough to explain it to beginners. But the video exists primarily to funnel viewers to a paid community. The signal-to-commercial ratio is low. 

**If you have 20 minutes**, the actual Claude Code documentation and Boris Cherny's own public writing will give you denser, more accurate information without the brand-building wrapper.

---

## Modern software fundamentals (AI Engineer channel)
**URL:** https://youtube.com/watch?v=v4F1gFy-hqg
**Title:** "Software Fundamentals Matter More Than Ever" — Matt Pocock
**Channel:** AI Engineer

# Summary: "Software Fundamentals Matter More Than Ever" — Matt Pocock

## (1) Speaker + Topic

**Matt Pocock** — TypeScript educator, solo consultant, creator of the "Claude Code for Real Engineers" course. Thesis: AI coding amplifies good software design and *destroys* bad software design, so fundamentals matter *more* now, not less. The talk is a direct rebuttal of the "specs-to-code / vibe coding" movement.

---

## (2) Technical Principles & Patterns

**1. "Code is not cheap — bad code is the most expensive it's ever been."**
The specs-to-code loop (write spec → generate → regenerate on failure, never read the code) produces compounding entropy. Every regeneration without design attention makes the codebase *worse*, not neutral. Source: *The Pragmatic Programmer*'s "software entropy" chapter.

**2. The Shared Design Concept (Grill Me)**
From Frederick P. Brooks' *The Design of Design*: a design concept is the invisible shared theory of what you're building — it can't be put in a markdown file. By default, you and the LLM don't share one. Fix: prompt the LLM to *"interview me relentlessly about every aspect of this plan until we reach a shared understanding — walk down each branch of the design tree, resolving dependencies between decisions one by one."* This generates 40–100 questions before planning begins. The resulting conversation becomes a PRD or issue list.

**3. Ubiquitous Language (from DDD)**
Verbosity and cross-purposes between you and the LLM is a *language gap*, not an intelligence gap. Domain-Driven Design's ubiquitous language fix: maintain a canonical markdown file of domain terms derived from scanning the codebase, used consistently in code, conversation, and planning prompts. Reading the LLM's thinking traces, Pocock found it measurably reduced verbosity and improved implementation alignment.

**4. "The rate of feedback is your speed limit."**
LLMs outrun their headlights — they generate large amounts of code before checking types or tests. Static types, browser access for front-end, and automated tests are necessary feedback loops, but the LLM must be *forced* to use them incrementally.

**5. TDD as a Structural Constraint on the LLM**
Test-driven development forces small deliberate steps: write a failing test → make it pass → refactor. This disciplines the LLM's tendency to generate in bulk. But TDD only works if the codebase is *testable*, which requires the next principle.

**6. Deep Modules over Shallow Modules (John Ousterhout)**
From *A Philosophy of Software Design*: prefer few, large modules with *simple interfaces hiding complex implementation* ("deep") over many tiny modules with complex interfaces ("shallow"). A shallow-module codebase is what AI naturally produces and is also what AI struggles to navigate — it can't find the right module in context and misunderstands dependencies. A deep-module architecture creates clean test boundaries (test at the interface) and lets you treat internals as gray boxes.

**7. "Design the interface, delegate the implementation."**
You own the module interfaces and their design. The LLM owns the implementation inside those boundaries. This is not just an AI pattern — it's the cognitive load management strategy: you only need to hold interfaces in your head, not implementations. Critical code (finance, security) still needs review; most modules don't.

**8. "Invest in the design of the system every day." (Kent Beck)**
Specs-to-code *divests* from design. Every planning session should explicitly reason about which modules are being touched and how their interfaces change. The PRD should name module-level changes, not just feature-level ones.

---

## (3) What Should Specifically Change in How Thomas Builds Python + DuckDB + Claude Agent Products

**Stop treating the LLM as the architect.** Thomas sets the interfaces; Claude fills them in. For a DuckDB+Claude agent stack, the likely deep modules are: query layer (DuckDB abstraction), agent orchestration, tool/function definitions, and data-model layer. Design those interfaces explicitly before any generation session.

**Run "Grill Me" before every non-trivial build session.** Before asking Claude to generate anything, force a structured Q&A until there's a shared design concept. This is especially important for agent products where tool schemas and data contracts are load-bearing — ambiguity there compounds badly.

**Maintain a `ubiquitous_language.md` in every repo.** For a DuckDB agent product this would define terms like: *query*, *tool*, *result schema*, *context window*, *agent turn*, *data source* — precisely and consistently. Feed it into every Claude prompt. Regenerate it periodically by scanning the codebase.

**Write the test first, especially for tools and query functions.** DuckDB query functions and Claude tool handlers are naturally unit-testable at clean interfaces. TDD here is low-friction: define what the function should return given an input, make Claude pass that test, then let it refactor internals freely.

**Treat the DuckDB layer as the canonical deep module.** Hide all SQL, schema management, and query construction behind a simple Python interface. Claude should almost never be writing raw SQL scattered across the codebase — it goes in one place behind a clean API. This also means the query layer is trivially testable with in-memory DuckDB.

**Each planning/PRD session must name module-level changes.** When adding a new agent capability, the PRD isn't just "the agent can now do X" — it's "the `tool_registry` module gains a new tool with this signature; the `query_layer` exposes this new method." This keeps Claude operating within boundaries rather than sprawling.

**Resist the entropy of agent scaffolding.** Agent products attract shallow-module sprawl (one file per tool, ad hoc prompt assembly, etc.). Periodically run Pocock's "improve codebase architecture" skill to consolidate and wrap related code behind deeper boundaries before the context debt becomes unmanageable.

---

## (4) Tools, Libraries & Repos Worth Bookmarking

| Resource | What it is |
|---|---|
| **github.com/mattpocock/skills** (search `mattpocock skills`) | The prompt skills repo — "Grill Me", Ubiquitous Language scanner, Improve Codebase Architecture, Write PRD. ~13k stars. Start here. |
| **aihero.

---

## Ticker Symbol: YOU — investment context for bank agent
**URL:** https://youtube.com/watch?v=9UMGCbCyz6c
**Title:** I Got Rich Off NVIDIA. This Is Even Bigger.
**Channel:** Ticker Symbol: YOU

# Analysis for Thomas's Bank Agent — Quantum Computing Investing Video

---

## (1) Investing/Financial Topic Covered

**Emerging technology sector investing** — specifically how to evaluate and position in **early-stage, pre-profit quantum computing stocks** (IonQ, Rigetti, D-Wave) during a nascent market cycle. The video uses historical analogies (Apple/mobile era, Nvidia/AI era) to frame quantum computing as the **next generational technology investment opportunity**.

---

## (2) Five to Seven Concrete, Actionable Principles or Patterns

| # | Principle | Detail from Video |
|---|-----------|-------------------|
| 1 | **Wait for bubble deflation before entering** | Alex explicitly avoided covering quantum stocks when they were "priced to perfection" during the late-2024 bubble. He entered the conversation only after the bubble burst and new catalysts appeared. *Pattern: identify hype cycles, wait for mean reversion, then reassess on fundamentals.* |
| 2 | **Use milestone events as entry signals, not price alone** | Three specific technical/commercial breakthroughs in one week (Nvidia's Ising release, IonQ's photonic interconnect, Rigetti on AWS) triggered re-evaluation. *Pattern: track product/partnership milestones as leading indicators ahead of revenue.* |
| 3 | **When you can't pick a winner in a nascent sector, buy the basket** | Because each company uses a fundamentally different quantum architecture (trapped ion, superconducting, annealing), Alex prefers owning all three. *Pattern: sector-level exposure reduces technology-path risk in early markets.* |
| 4 | **For pre-revenue companies, evaluate cash runway and milestones instead of P/E or revenue multiples** | Rigetti has only $7M revenue but ~7.5 years of cash runway. D-Wave has ~9 years. *Pattern: cash burn rate ÷ cash balance = survival runway; use this as the primary risk metric when revenue is negligible.* |
| 5 | **Distinguish accounting profit from operating reality** | IonQ showed $754M net income but this was driven by a $950M non-cash warrant revaluation gain, masking an actual operating loss. *Pattern: always strip non-cash items from reported earnings; focus on operating cash flow.* |
| 6 | **Backlog is a leading revenue indicator for early-stage growth companies** | IonQ's $370M backlog is ~3x its prior year revenue and signals future contracted growth even before it hits the income statement. *Pattern: backlog/revenue ratio signals growth trajectory more reliably than current revenue alone.* |
| 7 | **Infrastructure players (picks-and-shovels) validate a sector's investability** | Nvidia building hybrid GPU-QPU infrastructure (NVQ Link, Ising, CUDA-Q) signals institutional confidence in quantum's commercial future without Nvidia needing to win the hardware race itself. *Pattern: when a dominant platform player builds infrastructure for a sector, it de-risks and accelerates the entire ecosystem.* |

---

## (3) Specific Frameworks, Ratios, or Screens Mentioned

| Framework/Ratio | How It Was Applied |
|----------------|-------------------|
| **Cash Runway** = Cash ÷ Quarterly Burn Rate | Rigetti: $590M ÷ $20M/quarter = ~30 quarters (~7.5 years). D-Wave: $630M ÷ ~$17.5M/quarter = ~9 years. Primary viability screen for pre-commercial companies. |
| **Revenue YoY Growth Rate** | IonQ +429% YoY; D-Wave +179% YoY; Rigetti -18% YoY. Used comparatively across the three companies. |
| **Backlog-to-Revenue Ratio** | IonQ backlog $370M vs $130M FY revenue = ~2.8x. Signals contracted future demand. |
| **Revenue Guidance vs Current Run Rate** | IonQ guiding $235M for 2026 vs $130M in 2025 = implied ~81% growth. Used to assess forward momentum. |
| **Market Cap vs Revenue + Backlog + Growth** (informal) | Alex's qualitative "risk-to-reward" screen — no precise formula given, but he synthesises these three variables to rank IonQ as best risk-adjusted bet. |
| **CAGR Comparison Screen** | Quantum market projected 36% CAGR vs S&P 500 ~15-17% CAGR — used to justify sector inclusion in a growth portfolio. |
| **Technology-Path Diversification** | Owning all three companies as a proxy for owning the full range of quantum architectures (trapped ion, superconducting, annealing + gate-based). Conceptually similar to an equal-weight sector ETF approach. |
| **Customer Concentration Risk Check** | All three companies heavily reliant on government/defence contracts — flagged as a shared systemic risk, especially relevant if defence budgets are cut. |

---

## (4) Takeaways Relevant to Building an AI Bank Agent (SMSF / Small Business Owner Context)

### A. Position Sizing for Speculative/Emerging Tech
- The video implicitly treats quantum computing as a **satellite position**, not a core holding. An AI agent should enforce rules like: *speculative/pre-profit emerging tech ≤ 5–10% of total SMSF portfolio*, with individual positions within that bucket sized even smaller given 30–50% single-day volatility risk.
- Owning "the basket" rather than a single name is a risk-management principle the agent should surface when a user asks about early-stage sectors with uncertain technology outcomes.

### B. Screening Logic for Early-Stage Growth Stocks
The agent should be able to run a layered screen:
1. **Is the company pre-profit?** → Switch from P/E to cash runway and operating cash flow.
2. **Cash runway > 5 years?** → Minimum viability threshold for speculative positions.
3. **Backlog > 2x trailing revenue?** → Signals real demand pipeline, not just hype.
4. **Revenue growth > 100% YoY?** → Threshold for "hyper-growth" classification.
5. **Non-cash items in net income?** → Flag for user; strip warrants, revalu

---
