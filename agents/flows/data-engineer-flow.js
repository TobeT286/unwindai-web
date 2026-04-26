// Data-Engineer flow — internal-facing agent that helps Thomas with platform
// design questions and acts as deep-knowledge backup for the customer-facing
// chatbot when prospects ask deep technical questions about modern data platforms.
//
// Loads:
//   context/data-engineer.md      — distilled DataTalksClub + Thomas's stance (always)
//   context/karpathy-principles.md — engineering discipline (always — keeps the agent
//                                     opinionated and grounded in first principles)
//   context/ai-research.md        — latest YouTube digest (when present)
//
// Pattern mirrors agents/flows/ai-master-flow.js.

import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import { config as loadDotenv } from "dotenv";
import { supervise } from "../supervisor.js";
import { present } from "../presenter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
loadDotenv({ path: join(ROOT, "..", "data-pipeline", ".env"), override: true });

const client = new Anthropic();

async function readIfPresent(path) {
  try { return await readFile(path, "utf-8"); } catch { return ""; }
}

async function loadContext() {
  const base       = await readFile(join(ROOT, "context", "data-engineer.md"), "utf-8");
  const principles = await readIfPresent(join(ROOT, "context", "karpathy-principles.md"));
  const research   = await readIfPresent(join(ROOT, "context", "ai-research.md"));

  let combined = base;
  if (principles) combined += `\n\n---\n\n## Engineering principles (Karpathy)\n\n${principles}`;
  if (research)   combined += `\n\n---\n\n## Latest AI research digest\n\n${research}`;
  return combined;
}

export async function runDataEngineerFlow(userMessage) {
  const context = await loadContext();

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: context,
    messages: [{ role: "user", content: userMessage }],
  });

  const rawOutput = msg.content[0].text;

  const finalResponse = await supervise(
    () => present(rawOutput, "markdown", "Internal data-engineering advisor for Thomas's consultancy"),
    "data-engineer:presenter"
  ).then((r) => (r.ok ? r.result : rawOutput));

  return { response: finalResponse };
}
