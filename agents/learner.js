// Learner — loads context from /context/*.md to ground agent responses
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CONTEXT_MAP = {
  energy: "energy-agent.md",
  amh: "amh-agent.md",
  data: "data-agent.md",
  maintenance: "maintenance-agent.md",
  spoton: "spoton-electrical.md",
  thomas: "thomas-context.md",
};

export async function loadContext(agentKey) {
  const file = CONTEXT_MAP[agentKey];
  if (!file) throw new Error(`No context file mapped for agent key: ${agentKey}`);
  const filePath = join(ROOT, "context", file);
  return readFile(filePath, "utf-8");
}

export async function loadAll() {
  const entries = await Promise.all(
    Object.entries(CONTEXT_MAP).map(async ([key, file]) => {
      const content = await readFile(join(ROOT, "context", file), "utf-8").catch(() => "");
      return [key, content];
    })
  );
  return Object.fromEntries(entries);
}
