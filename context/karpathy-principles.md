# Karpathy Principles — Working Knowledge Base

_Distilled from Andrej Karpathy's essays and talks. These are the working principles that ground how Thomas builds AI systems and how the agents in this repo should reason. Cite this file when writing CLAUDE.md, planning agent flows, or making engineering judgement calls._

---

## 1. The paradigm: Software 1.0 → 2.0 → 3.0

**Software 1.0** — explicit instructions written by a human in Python/C++/SQL. The classical paradigm.

**Software 2.0** — behaviour specified, then optimised by gradient descent. The "code" is the weights of a neural network. Most active development is **curating, growing, massaging and cleaning labelled datasets** rather than writing logic.

> "Neural networks are not just another classifier, they represent the beginning of a fundamental shift in how we develop software. They are Software 2.0." — *Software 2.0* (2017)

**Software 3.0** (the current era) — natural-language prompting and tool use. The interface is English. The artefact is a **system prompt + a context bundle + tool definitions**. This is the era we're operating in.

**For Thomas's stack:** the agent framework in this repo is Software 3.0. Each agent (`router`, `learner`, `planner`, `doer`, `critic`, `presenter`, `supervisor`) is a Software 3.0 component. The context files in `context/` are the dataset.

---

## 2. The four working principles (CLAUDE.md grounding)

These four principles in your `CLAUDE.md` derive from Karpathy's *Recipe for Training Neural Networks* (2019). Original framings:

### 2.1 Think before coding
> "A 'fast and furious' approach to training neural networks does not work and only leads to suffering. Now, suffering is a perfectly natural part of getting a neural network to work well, but it can be mitigated by being thorough, defensive, paranoid, and obsessed with visualizations of basically every possible thing." — *Recipe*

The qualities that correlate with success are **patience and attention to detail.** Most failures are silent — code runs, model trains, but "subtly wrong" answers come out. Same is true of LLM agents: a flow that runs to completion without erroring is not the same as a flow that's correct.

**Apply:** Before writing code, write down hypotheses. Before running an agent flow, predict what the output should look like. If the actual output doesn't match the prediction, debug — don't accept and move on.

### 2.2 Simplicity first
Start with the **dumbest possible baseline** — a linear classifier, a single-prompt agent, a hardcoded keyword router. Establish the full pipeline end-to-end before adding complexity. Each subsequent change is one variable changed at a time.

> "Make concrete hypotheses about what will happen and then either validate them with an experiment or investigate until we find some issue." — *Recipe*

**Apply:** When building an agent flow, do not add a planner-doer-critic chain before you've proven the single-prompt version. When adding a tool, prove it with one hand-written call before generalising. Three concrete examples beat a flexible abstraction every time.

### 2.3 Surgical changes
Never introduce multiple unverified complexities simultaneously. One change → run → verify → next change. This is the Recipe's "obsessive iteration" discipline.

**Apply:** When the agent's answer is wrong, change one thing at a time. New context file? Verify it loads before changing the prompt. New tool? Test it in isolation before wiring it into a flow.

### 2.4 Goal-driven execution
> "Build end-to-end skeleton + get dumb baselines + overfit first." — *Recipe*

Define the success criterion **before** implementing. Make it executable: a test, an output the right shape, a verifiable claim. Loop on the actual signal, not on intermediate-feeling progress.

**Apply:** "Fix the YouTube researcher" is not a goal. "The script writes a 5+ video summary to `context/ai-research.md` without errors" is a goal. Convert vague tasks to verifiable checks before starting.

---

## 3. Become one with the data

Before architecting an agent or pipeline, **spend real time looking at the actual inputs**. Read the messages your customer chatbot has actually received. Open the spreadsheet. Read the PDFs the agent will be summarising. Look at the failure cases.

> "It's important to inspect your data: their distribution, modes, outliers, biases. The neural net is effectively a compressed/compiled version of your dataset." — *Recipe*

For LLM agents, the equivalent is: read every context file your agent loads. Read 50 user inputs the agent has handled. Read the agent's own outputs across a representative sample. The system prompt + context is your dataset.

**Anti-pattern:** designing agent flows from intuition without ever opening the actual context files or sample inputs. This is the LLM-era version of "fast and furious" and produces silent-failure agents.

---

## 4. Power to the People — why this matters for Unwind AI

> "Disproportionate benefit for regular people. The corporate and governmental impact is muted and lagging." — *Power to the People* (2025)

Karpathy's thesis: LLMs reverse the historical adoption pattern. Old tech (electricity, cryptography, internet) flowed top-down — government / military → corporations → individuals. LLMs flow **bottom-up**: individuals and small businesses benefit first; large organisations lag because legacy systems, compliance, and coordination overhead frustrate rapid adoption.

**Why this matters for Unwind AI's pitch:**

1. **The $20k–$50k SMB data platform is real.** Two years ago this took 5–10 engineers and a year. Now a single operator with the right tooling can deliver it. This isn't marketing — it's the tech-diffusion pattern Karpathy is describing.

2. **Small businesses are the right ICP.** Big consultancies still sell big-consultancy projects. Small businesses are the segment where LLM-augmented delivery has the biggest cost advantage. Lean into that.

3. **"Versatile but shallow and fallible" is the right framing.** Sell auditable, narrow, reliable AI — not magic. Karpathy himself flags this as the limit. Unwind AI's pitch (specific tasks, classification, semantic search over your data, not a hallucinating chatbot) maps exactly.

4. **The window may close.** Karpathy notes scaling could re-introduce inequality if frontier models become enterprise-only. Move while access is broad.

---

## 5. Operational heuristics for AI agent development

Drawn from Karpathy's debugging and engineering discipline:

| Heuristic | Application |
|-----------|-------------|
| Overfit a single batch first | Prove your agent works on ONE crafted input before testing on N inputs |
| Visualise everything | Log the actual prompts sent to Claude. Read them. Don't trust the log line, read the prompt |
| Random seed everything reproducible | Save the agent inputs that triggered surprising outputs. You will want them later |
| Don't trust the abstraction | The Anthropic SDK is not a clean API once you go beyond hello-world. Read the raw response. Check `stop_reason`. Verify token counts |
| Patience and attention to detail | The qualities most correlated with success. Same in 2019 with CNNs, same in 2026 with agents |
| One change at a time | When the agent gets worse, change one thing. Do not refactor while debugging |

---

## 6. Quotes worth keeping

> "Fast and furious does not work." — *Recipe*

> "The qualities that in my experience correlate most strongly to success in deep learning are patience and attention to detail." — *Recipe*

> "Most active 'software development' takes the form of curating, growing, massaging and cleaning labeled datasets." — *Software 2.0*

> "Make concrete hypotheses about what will happen and then either validate them with an experiment or investigate until we find some issue." — *Recipe*

> "The future is already here, and it is shockingly distributed." — *Power to the People*

---

## License & sources

All quotes are from publicly available essays by Andrej Karpathy:

- **A Recipe for Training Neural Networks** (Apr 2019) — https://karpathy.github.io/2019/04/25/recipe/
- **Software 2.0** (Nov 2017) — https://karpathy.medium.com/software-2-0-a64152b37c35
- **Power to the People: How LLMs Flip the Script on Technology Diffusion** (Apr 2025) — https://karpathy.bearblog.dev/power-to-the-people/
- Recent posts (2025): *2025 LLM Year in Review*, *Verifiability*, *Animals vs Ghosts* — https://karpathy.bearblog.dev/

Quotations are used under fair-use commentary; full attribution given.
