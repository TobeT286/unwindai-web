// Email flow — daily digest agent.
//
// What it does:
//   1. Reads last 24h from both Gmail accounts (private + unwindai) via
//      agents/email-reader.js (IMAP + Gmail App Password — no Google Cloud).
//   2. Skips emails already processed (deduped by message-id in
//      agents/.processed-emails.jsonl).
//   3. For each new email: calls Claude with a tool-use schema to get
//      structured fields — categorisation, suggested folder, confidence,
//      action_required, priority, summary.
//   4. For each attachment: if confidence >= AUTO_ROUTE_THRESHOLD, saves
//      to the suggested folder under either Documents/UnwyndAI or
//      Documents/personal. Below threshold, saves to
//      Documents/_email_inbox_uncategorised/<date>/ for manual review.
//   5. Posts a Teams MessageCard to TEAMS_WEBHOOK_URL — the same "Daily
//      Quality Summary" channel used by daily_summary.py.
//
// Run:        node agents/flows/email-flow.js
// Schedule:   nightly via Task Scheduler (run-email-flow.bat)
//             — remember to enable "Run task as soon as possible after a
//               scheduled start is missed" per the project convention.

import { readFile, writeFile, appendFile, mkdir, readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import { config as loadDotenv } from "dotenv";
import { readInbox } from "../email-reader.js";
import { sendTeamsCard, themePass, themeFail, themeNeutral } from "../teams-webhook.js";
import { simpleParser } from "mailparser";
import { ImapFlow } from "imapflow";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
loadDotenv({ path: join(ROOT, "..", "data-pipeline", ".env"), override: true });

const USER = process.env.USERNAME || "Thomas";
const ONEDRIVE_BASE = `C:\\Users\\${USER}\\OneDrive - UnwyndAI\\Documents`;
const BUSINESS_ROOT  = join(ONEDRIVE_BASE, "UnwyndAI");
const PERSONAL_ROOT  = join(ONEDRIVE_BASE, "personal");
const UNCATEGORISED  = join(ONEDRIVE_BASE, "_email_inbox_uncategorised");
const PROCESSED_LOG  = join(__dirname, "..", ".processed-emails.jsonl");

const AUTO_ROUTE_THRESHOLD = 0.75;
const DAYS_BACK = 1;
const MAX_BODY_CHARS = 4_000;

const anthropic = new Anthropic();

// ─── folder tree scan ───────────────────────────────────────────────────────
// Returns array of relative paths (one or two levels deep) under each root —
// these are the only legal target_subfolder values the LLM is allowed to pick.

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

// ─── dedup ──────────────────────────────────────────────────────────────────

async function loadProcessedIds() {
  if (!existsSync(PROCESSED_LOG)) return new Set();
  const raw = await readFile(PROCESSED_LOG, "utf-8");
  return new Set(raw.split("\n").filter(Boolean).map((line) => {
    try { return JSON.parse(line).id; } catch { return null; }
  }).filter(Boolean));
}

async function recordProcessed(id, meta) {
  await appendFile(PROCESSED_LOG, JSON.stringify({ id, ...meta, at: new Date().toISOString() }) + "\n");
}

// ─── attachment fetch (re-uses readInbox would skip raw — fetch fresh) ─────

function imapClientFor(account) {
  const credSuffix = account === "private" ? "" : `_${account.toUpperCase()}`;
  const user = process.env[`GMAIL_ADDRESS${credSuffix}`];
  const pass = process.env[`GMAIL_APP_PASSWORD${credSuffix}`];
  if (!user || !pass) {
    throw new Error(`Missing IMAP creds for ${account} — set GMAIL_ADDRESS${credSuffix} and GMAIL_APP_PASSWORD${credSuffix}`);
  }
  return new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user, pass }, logger: false });
}

async function fetchEmailsWithAttachments(account, days) {
  const client = imapClientFor(account);
  await client.connect();
  const messages = [];
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - days * 86_400_000);
      for await (const m of client.fetch({ since }, { source: true, envelope: true })) {
        const parsed = await simpleParser(m.source);
        messages.push({
          id: parsed.messageId || `${m.uid}@${account}`,
          uid: m.uid,
          account,
          date: parsed.date,
          from: parsed.from?.text || "",
          subject: parsed.subject || "(no subject)",
          text: (parsed.text || parsed.html || "").slice(0, MAX_BODY_CHARS),
          attachments: (parsed.attachments || []).map((a) => ({
            filename: a.filename || `attachment-${a.contentId || Date.now()}`,
            contentType: a.contentType,
            size: a.size,
            content: a.content, // Buffer
          })),
        });
      }
    } finally { lock.release(); }
  } finally { await client.logout(); }
  return messages;
}

// Pulls In-Reply-To + References values from the Sent folder for the last
// `days` days. The returned set is the universe of message-ids Thomas has
// already replied to. Used to mark inbox emails as already_replied.
async function fetchRepliedToIds(account, days) {
  const replied = new Set();
  const client = imapClientFor(account);
  try {
    await client.connect();
    // Gmail's sent folder is "[Gmail]/Sent Mail" — try variants
    const candidates = ["[Gmail]/Sent Mail", "Sent", "Gesendet", "INBOX.Sent"];
    let opened = false;
    let lock;
    for (const name of candidates) {
      try { lock = await client.getMailboxLock(name); opened = true; break; } catch { /* try next */ }
    }
    if (!opened) return replied;
    try {
      const since = new Date(Date.now() - days * 86_400_000);
      for await (const m of client.fetch({ since }, { source: true })) {
        const parsed = await simpleParser(m.source);
        if (parsed.inReplyTo) replied.add(parsed.inReplyTo);
        for (const ref of parsed.references || []) replied.add(ref);
      }
    } finally { lock.release(); }
  } catch (err) {
    console.warn(`  ⚠ ${account} sent-folder lookup failed: ${err.message}`);
  } finally {
    try { await client.logout(); } catch {}
  }
  return replied;
}

// Cross-account / forwarding dedup. Same from + subject + minute → keep first.
function dedupAcrossAccounts(messages) {
  const seen = new Map();
  const kept = [];
  for (const m of messages) {
    const minuteBucket = m.date ? new Date(m.date).toISOString().slice(0, 16) : "no-date";
    const key = `${m.from}|${m.subject}|${minuteBucket}`;
    if (seen.has(key)) {
      seen.get(key).duplicateAccounts.push(m.account);
      continue;
    }
    m.duplicateAccounts = [];
    seen.set(key, m);
    kept.push(m);
  }
  return kept;
}

// ─── LLM categorisation ─────────────────────────────────────────────────────

const CATEGORISE_TOOL = {
  name: "categorise_email",
  description: "Categorise an email and decide where to file its attachments (if any).",
  input_schema: {
    type: "object",
    properties: {
      target_root: {
        type: "string",
        enum: ["UnwyndAI", "personal", "uncategorised"],
        description: "UnwyndAI = business folder, personal = personal life folder, uncategorised = unclear or need user input.",
      },
      target_subfolder: {
        type: "string",
        description: "Existing subfolder under the target root (use forward slashes, e.g. 'finance/bank' or '6STEP'). Empty string for the root itself. MUST be one of the folders provided in the prompt — do not invent.",
      },
      suggest_new_folder: {
        type: "string",
        description: "If none of the existing folders fit, suggest a new folder name to create (relative path under target_root). Empty string if existing folder is fine.",
      },
      confidence: { type: "number", description: "0.0 to 1.0 — how confident the categorisation is. Below 0.75 routes to manual review." },
      reasoning: { type: "string", description: "One short sentence explaining the choice." },
      summary: { type: "string", description: "One-sentence summary of the email content." },
      classification: {
        type: "string",
        enum: ["needs_reply", "needs_action", "informational", "noise"],
        description: "needs_reply = sender is waiting on Thomas's response. needs_action = a non-reply task (do something, decide something). informational = read-and-know. noise = newsletter, marketing, automated notification with no action required.",
      },
      action_summary: { type: "string", description: "If needs_reply or needs_action, one-sentence description. Empty string otherwise." },
      priority: { type: "string", enum: ["high", "medium", "low"] },
    },
    required: ["target_root", "target_subfolder", "confidence", "reasoning", "summary", "classification", "priority"],
  },
};

async function categorise(email, businessFolders, personalFolders) {
  const prompt = `You are categorising a single email for Thomas Taresch's filing system.

Available folders under \`Documents/UnwyndAI\` (business):
${businessFolders.map((f) => `- ${f}`).join("\n")}

Available folders under \`Documents/personal\`:
${personalFolders.map((f) => `- ${f}`).join("\n")}

Routing rules:
- "UnwyndAI" = business / clients / Unwind AI work / energy upgrades / VEU / consulting / income / invoicing of clients
- "personal" = anything to do with personal life: bank, properties (Thomas owns several investment properties), SMSF, tax, immigration, certificates
- "uncategorised" = genuinely unclear; pick this if you'd be guessing

Confidence rules:
- 0.9+ when the routing is obvious from sender + subject
- 0.75-0.9 when content makes it clear
- below 0.75 if you're uncertain — better to route to uncategorised than misfile

Classification rules (be strict — Thomas is drowning in noise):
- "noise" = marketing, newsletters, automated notifications ("your statement is ready"), promotional offers, generic announcements with no action expected from Thomas. Most senders ending in @marketing, @newsletter, @notifications, @no-reply qualify. Set noise generously — Thomas will see the count and can spot-check.
- "informational" = legit content worth knowing but no action: client updates, industry news he subscribed to, school notices, account confirmations.
- "needs_action" = Thomas must do something other than reply: book an appointment, review a document, decide on a quote, follow a link.
- "needs_reply" = sender is waiting on a response from Thomas. Be conservative — only mark this if a reply is genuinely expected (a real human asking a real question, not a CTA in marketing).

Priority:
- high = time-sensitive (today/tomorrow) or important client/financial/legal
- medium = within the week
- low = whenever convenient

Email:
- From: ${email.from}
- Subject: ${email.subject}
- Date: ${email.date?.toISOString?.()?.slice(0, 10) ?? "unknown"}
- Account received on: ${email.account}
- Attachments: ${email.attachments.length} (${email.attachments.map((a) => a.filename).join(", ")})

Body:
${email.text}`;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    tools: [CATEGORISE_TOOL],
    tool_choice: { type: "tool", name: "categorise_email" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = msg.content.find((c) => c.type === "tool_use");
  if (!toolUse) throw new Error("Model did not return tool_use block");
  return toolUse.input;
}

// ─── attachment routing ─────────────────────────────────────────────────────

function safeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 200);
}

async function saveAttachment(buf, targetDir, filename) {
  await mkdir(targetDir, { recursive: true });
  let target = join(targetDir, safeFilename(filename));
  if (existsSync(target)) {
    const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    const dot = filename.lastIndexOf(".");
    const stem = dot > 0 ? filename.slice(0, dot) : filename;
    const ext  = dot > 0 ? filename.slice(dot) : "";
    target = join(targetDir, safeFilename(`${stem}-${ts}${ext}`));
  }
  await writeFile(target, buf);
  return target;
}

async function routeAttachments(email, decision) {
  const date = (email.date || new Date()).toISOString().slice(0, 10);
  const routed = [];
  const lowConfidence = decision.confidence < AUTO_ROUTE_THRESHOLD || decision.target_root === "uncategorised";

  let baseDir;
  if (lowConfidence) {
    baseDir = join(UNCATEGORISED, date);
  } else {
    const root = decision.target_root === "UnwyndAI" ? BUSINESS_ROOT : PERSONAL_ROOT;
    const sub  = (decision.target_subfolder || "").replace(/\//g, "\\");
    baseDir = sub ? join(root, sub) : root;
  }

  for (const att of email.attachments) {
    try {
      const path = await saveAttachment(att.content, baseDir, att.filename);
      routed.push({ filename: att.filename, path, lowConfidence });
    } catch (err) {
      routed.push({ filename: att.filename, error: err.message });
    }
  }
  return routed;
}

// ─── Teams card builder ─────────────────────────────────────────────────────

function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + "…" : s; }

function buildTeamsCard(stats, processed) {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const total = processed.length;
  const errors = processed.filter((p) => p.error).length;

  const successful = processed.filter((p) => p.decision);
  const byClass = (cls) => successful.filter((p) => p.decision.classification === cls);
  const needsReply       = byClass("needs_reply").filter((p) => !p.alreadyReplied);
  const needsAction      = byClass("needs_action").filter((p) => !p.alreadyReplied);
  const informational    = byClass("informational");
  const noise            = byClass("noise");
  const alreadyReplied   = successful.filter((p) => p.alreadyReplied);

  const themeColor = errors > 0 ? themeFail : ((needsReply.length + needsAction.length) === 0 ? themePass : themeNeutral);

  const sortPriority = (a, b) => ({ high: 0, medium: 1, low: 2 }[a.decision.priority] - { high: 0, medium: 1, low: 2 }[b.decision.priority]);

  const fmtItem = (p) => `- **[${p.decision.priority}]** ${p.decision.action_summary || p.decision.summary} _(from ${truncate(p.email.from, 40)})_`;

  const autoRouted = processed.flatMap((p) =>
    (p.routed || []).filter((r) => !r.lowConfidence && !r.error).map((r) =>
      `- ${r.filename} → ${r.path.replace(ONEDRIVE_BASE + "\\", "")}`
    )
  );
  const uncategorisedAttachments = processed.flatMap((p) =>
    (p.routed || []).filter((r) => r.lowConfidence && !r.error).map((r) =>
      `- ${r.filename} _(${truncate(p.email.subject, 40)})_`
    )
  );

  const sections = [
    {
      activityTitle: `📧 Email Digest — ${now}`,
      activitySubtitle: `${total} new · 🔴 ${needsReply.length} reply · 📌 ${needsAction.length} action · ✅ ${alreadyReplied.length} replied · 📰 ${informational.length} info · 🗑️ ${noise.length} noise · 📎 ${autoRouted.length} routed · ❓ ${uncategorisedAttachments.length} review${errors ? ` · ❌ ${errors} errors` : ""}`,
    },
  ];

  if (needsReply.length) {
    sections.push({
      activityTitle: "🔴 Needs your reply",
      text: needsReply.sort(sortPriority).map(fmtItem).join("\n"),
    });
  }

  if (needsAction.length) {
    sections.push({
      activityTitle: "📌 Action items (no reply)",
      text: needsAction.sort(sortPriority).map(fmtItem).join("\n"),
    });
  }

  if (alreadyReplied.length) {
    sections.push({
      activityTitle: "✅ Already replied — no action",
      text: alreadyReplied.slice(0, 10).map((p) => `- ${truncate(p.email.subject, 60)} _(${truncate(p.email.from, 40)})_`).join("\n") + (alreadyReplied.length > 10 ? `\n_…and ${alreadyReplied.length - 10} more_` : ""),
    });
  }

  if (informational.length) {
    sections.push({
      activityTitle: "📰 Worth knowing",
      text: informational.slice(0, 8).map((p) => `- ${p.decision.summary} _(${truncate(p.email.from, 40)})_`).join("\n") + (informational.length > 8 ? `\n_…and ${informational.length - 8} more_` : ""),
    });
  }

  if (autoRouted.length) {
    sections.push({
      activityTitle: "📎 Attachments auto-routed",
      text: autoRouted.slice(0, 20).join("\n") + (autoRouted.length > 20 ? `\n_…and ${autoRouted.length - 20} more_` : ""),
    });
  }

  if (uncategorisedAttachments.length) {
    sections.push({
      activityTitle: "❓ Attachments needing review",
      activitySubtitle: `Saved to ${UNCATEGORISED.replace(ONEDRIVE_BASE + "\\", "")}\\<date>\\`,
      text: uncategorisedAttachments.slice(0, 20).join("\n") + (uncategorisedAttachments.length > 20 ? `\n_…and ${uncategorisedAttachments.length - 20} more_` : ""),
    });
  }

  if (noise.length) {
    const topSenders = Object.entries(
      noise.reduce((acc, p) => { const sender = p.email.from.split("<")[0].trim().slice(0, 40); acc[sender] = (acc[sender] || 0) + 1; return acc; }, {})
    ).sort((a, b) => b[1] - a[1]).slice(0, 5);
    sections.push({
      activityTitle: `🗑️ Noise filtered (${noise.length})`,
      text: topSenders.map(([s, n]) => `- ${s} ×${n}`).join("\n"),
    });
  }

  if (errors) {
    sections.push({
      activityTitle: "⚠️ Errors",
      text: processed.filter((p) => p.error).map((p) => `- ${truncate(p.email.subject, 50)}: ${p.error}`).join("\n"),
    });
  }

  if (total === 0) {
    sections.push({ activityTitle: "_No new emails in window._" });
  }

  return { summary: `Email digest — ${total} new`, sections, themeColor };
}

// ─── main ───────────────────────────────────────────────────────────────────

async function run() {
  console.log("[email-flow] Starting…");
  const businessFolders = await scanFolders(BUSINESS_ROOT);
  const personalFolders = await scanFolders(PERSONAL_ROOT);
  console.log(`  Folders scanned: ${businessFolders.length} business, ${personalFolders.length} personal`);

  const processedIds = await loadProcessedIds();
  const stats = { accounts: [], totalRead: 0, totalNew: 0, deduped: 0 };
  const processed = [];

  // Pull inbox + sent for both accounts in parallel where possible
  const accountsData = await Promise.all(
    ["private", "unwindai"].map(async (account) => {
      try {
        const [messages, repliedTo] = await Promise.all([
          fetchEmailsWithAttachments(account, DAYS_BACK),
          fetchRepliedToIds(account, DAYS_BACK + 14), // wider window for sent — replies often happen days later
        ]);
        return { account, messages, repliedTo };
      } catch (err) {
        console.warn(`  ⚠ ${account} fetch failed: ${err.message}`);
        return { account, messages: [], repliedTo: new Set() };
      }
    })
  );

  // Merge sent-folder universes — a reply from either account counts as "replied"
  const allRepliedTo = new Set();
  for (const { repliedTo } of accountsData) for (const id of repliedTo) allRepliedTo.add(id);

  // Combine + dedup messages across accounts
  let allMessages = [];
  for (const { account, messages } of accountsData) {
    if (messages.length) stats.accounts.push(account);
    stats.totalRead += messages.length;
    allMessages = allMessages.concat(messages);
  }
  const beforeDedup = allMessages.length;
  allMessages = dedupAcrossAccounts(allMessages);
  stats.deduped = beforeDedup - allMessages.length;
  console.log(`  Inbox: ${stats.totalRead} total, ${stats.deduped} cross-account duplicates removed`);
  console.log(`  Sent (last ${DAYS_BACK + 14} days): ${allRepliedTo.size} message-ids referenced`);

  for (const email of allMessages) {
    if (processedIds.has(email.id)) continue;
    stats.totalNew++;
    const alreadyReplied = email.id && allRepliedTo.has(email.id);
    try {
      const decision = await categorise(email, businessFolders, personalFolders);
      const routed = email.attachments.length ? await routeAttachments(email, decision) : [];
      processed.push({ email, decision, routed, alreadyReplied });
      await recordProcessed(email.id, {
        account: email.account,
        subject: email.subject?.slice(0, 100),
        target: decision.target_root === "uncategorised" ? "uncategorised" : `${decision.target_root}/${decision.target_subfolder}`,
        classification: decision.classification,
        alreadyReplied,
        confidence: decision.confidence,
        attachments: routed.length,
      });
      const repliedTag = alreadyReplied ? " [replied]" : "";
      const dupeTag = email.duplicateAccounts?.length ? ` [+${email.duplicateAccounts.join(",")}]` : "";
      console.log(`  ✓ [${decision.classification}|${decision.target_root}/${decision.target_subfolder}]${repliedTag}${dupeTag} ${truncate(email.subject, 50)} (conf ${decision.confidence.toFixed(2)})`);
    } catch (err) {
      console.warn(`  ✗ ${truncate(email.subject, 50)}: ${err.message}`);
      processed.push({ email, error: err.message, alreadyReplied });
    }
  }

  const card = buildTeamsCard(stats, processed);
  try {
    await sendTeamsCard(card);
    console.log("[email-flow] Teams card sent.");
  } catch (err) {
    console.error("[email-flow] Teams send failed:", err.message);
  }
  console.log(`[email-flow] Done — ${stats.totalNew} new email(s) processed (${stats.deduped} dedup'd).`);
}

run().catch((err) => {
  console.error("[email-flow] Fatal:", err.message);
  process.exit(1);
});
