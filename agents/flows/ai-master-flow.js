// AI Master flow — combines static ai-master.md with live ai-research.md digest
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import { supervise } from "../supervisor.js";
import { present } from "../presenter.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const client = new Anthropic();

async function loadContext() {
  const base = await readFile(join(ROOT, "context", "ai-master.md"), "utf-8");

  // Append live research digest if available
  let research = "";
  try {
    research = await readFile(join(ROOT, "context", "ai-research.md"), "utf-8");
  } catch {
    // Not yet populated — researcher hasn't run
  }

  return research
    ? `${base}\n\n---\n\n## Live AI Research Digest\n\n${research}`
    : base;
}

export async function runAIMasterFlow(userMessage) {
  const context = await loadContext();

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: context,
    messages: [{ role: "user", content: userMessage }],
  });

  const rawOutput = msg.content[0].text;

  const finalResponse = await supervise(
    () => present(rawOutput, "markdown", "AI strategy advisor for a solo AI consultancy"),
    "ai-master:presenter"
  ).then((r) => (r.ok ? r.result : rawOutput));

  return { response: finalResponse };
}
