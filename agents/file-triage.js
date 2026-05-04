// File triage — dry-run categoriser for files in a directory (default: Downloads).
// Uses the same target-folder scan + LLM tool-use pattern as email-flow but
// classifies files based on filename + size + ext + modification date only.
// Writes a markdown report; does NOT move files. You review the report and
// give Claude feedback so the rules can be tuned.
//
// Run:    node agents/file-triage.js [path] [max-files]
// Default path: C:\Users\<you>\Downloads
// Default max:  50

import { readdir, stat, writeFile, readFile } from "fs/promises";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import { config as loadDotenv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
loadDotenv({ path: join(ROOT, "..", "data-pipeline", ".env"), override: true });

const USER = process.env.USERNAME || "Thomas";
const ONEDRIVE_BASE = `C:\\Users\\${USER}\\OneDrive - UnwyndAI\\Documents`;
const BUSINESS_ROOT = join(ONEDRIVE_BASE, "UnwyndAI");
const PERSONAL_ROOT = join(ONEDRIVE_BASE, "personal");

const TARGET_DIR = process.argv[2] || `C:\\Users\\${USER}\\Downloads`;
const MAX_FILES  = parseInt(process.argv[3] || "50", 10);

const anthropic = new Anthropic();

async function scanFolders(root, maxDepth = 2) {
  const results = [];
  async function walk(dir, depth, rel) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith(".") || e.name.startsWith("_")) continue;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      results.push(childRel);
      await walk(join(dir, e.name), depth + 1, childRel);
    }
  }
  await walk(root, 1, "");
  return results.sort();
}

const ROUTE_FILE_TOOL = {
  name: "route_file",
  description: "Decide where to file a file based on its name, extension, size, and modification date.",
  input_schema: {
    type: "object",
    properties: {
      target_root: { type: "string", enum: ["UnwyndAI", "personal", "uncategorised"] },
      target_subfolder: { type: "string", description: "Existing subfolder under the target root (forward slashes). Empty for root." },
      suggest_new_folder: { type: "string", description: "If existing folders don't fit, suggest a new folder name. Empty otherwise." },
      confidence: { type: "number" },
      reasoning: { type: "string", description: "One short sentence explaining the choice." },
      summary_guess: { type: "string", description: "One-sentence guess at what the file is about, based on filename." },
    },
    required: ["target_root", "target_subfolder", "confidence", "reasoning", "summary_guess"],
  },
};

async function classifyFile(file, businessFolders, personalFolders, routingKnowledge) {
  const prompt = `You are categorising a file in Thomas Taresch's Downloads folder.

${routingKnowledge}

---

Available folders under \`Documents/UnwyndAI\` (business):
${businessFolders.map((f) => `- ${f}`).join("\n")}

Available folders under \`Documents/personal\`:
${personalFolders.map((f) => `- ${f}`).join("\n")}

When routing knowledge above conflicts with the bare folder list, the routing knowledge wins (it tells you which folders are canonical and which are deprecated).

File to categorise:
- Name: ${file.name}
- Extension: ${file.ext || "(none)"}
- Size: ${file.size} bytes
- Modified: ${file.mtime.toISOString().slice(0, 10)}`;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    tools: [ROUTE_FILE_TOOL],
    tool_choice: { type: "tool", name: "route_file" },
    messages: [{ role: "user", content: prompt }],
  });
  const toolUse = msg.content.find((c) => c.type === "tool_use");
  if (!toolUse) throw new Error("Model did not return tool_use");
  return toolUse.input;
}

async function run() {
  console.log(`[file-triage] Scanning ${TARGET_DIR} (max ${MAX_FILES} files)…`);

  const businessFolders = await scanFolders(BUSINESS_ROOT);
  const personalFolders = await scanFolders(PERSONAL_ROOT);
  const routingKnowledge = await readFile(join(__dirname, "routing-knowledge.md"), "utf-8");

  const all = await readdir(TARGET_DIR, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const e of all) {
    if (!e.isFile()) continue;
    if (e.name.startsWith(".")) continue;
    if (e.name.startsWith("~$")) continue;       // Office lock files
    if (/\.(exe|msi|dmg|iso|winmd|tmp|crdownload|part)$/i.test(e.name)) continue; // installers / partial downloads / system metadata
    const fp = join(TARGET_DIR, e.name);
    const s = await stat(fp);
    files.push({ name: e.name, path: fp, size: s.size, mtime: s.mtime, ext: extname(e.name).toLowerCase() });
  }
  files.sort((a, b) => b.mtime - a.mtime); // newest first
  const sample = files.slice(0, MAX_FILES);
  console.log(`  ${files.length} files in directory; classifying ${sample.length}`);

  const decisions = [];
  for (const f of sample) {
    try {
      const decision = await classifyFile(f, businessFolders, personalFolders, routingKnowledge);
      decisions.push({ file: f, decision });
      const tgt = decision.target_root === "uncategorised" ? "uncategorised" : `${decision.target_root}/${decision.target_subfolder}`;
      console.log(`  ${f.name.slice(0, 60).padEnd(60)} → ${tgt} (${decision.confidence.toFixed(2)})`);
    } catch (err) {
      decisions.push({ file: f, error: err.message });
    }
  }

  // Markdown report
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `# File triage — dry run — ${date}`,
    "",
    `**Source:** \`${TARGET_DIR}\``,
    `**Files classified:** ${decisions.length} of ${files.length} present`,
    "",
    "_No files were moved. Review the suggestions, mark which ones are wrong (with reasoning), and send back so the routing prompt can be tuned._",
    "",
    "| # | File | Suggested location | Confidence | Reasoning | What it likely is |",
    "|---|---|---|---|---|---|",
  ];
  decisions.forEach((d, i) => {
    if (d.error) {
      lines.push(`| ${i + 1} | ${d.file.name} | _error_ | — | ${d.error} | — |`);
      return;
    }
    const tgt = d.decision.target_root === "uncategorised"
      ? `_uncategorised_${d.decision.suggest_new_folder ? ` (suggest: \`${d.decision.suggest_new_folder}\`)` : ""}`
      : `${d.decision.target_root}/${d.decision.target_subfolder}`;
    lines.push(`| ${i + 1} | ${d.file.name} | ${tgt} | ${d.decision.confidence.toFixed(2)} | ${d.decision.reasoning} | ${d.decision.summary_guess} |`);
  });
  lines.push("");

  const reportPath = join(ROOT, "context", `file-triage-report-${date}.md`);
  await writeFile(reportPath, lines.join("\n"), "utf-8");
  console.log(`[file-triage] Wrote report → ${reportPath}`);
}

run().catch((err) => {
  console.error("[file-triage] Fatal:", err.message);
  process.exit(1);
});
