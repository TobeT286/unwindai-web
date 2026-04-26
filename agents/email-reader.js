// Email Reader — IMAP-based Gmail reader using App Passwords (no OAuth, no Google Cloud).
//
// Env vars (master .env at ../data-pipeline/.env):
//   GMAIL_PRIVATE_ADDRESS,  GMAIL_PRIVATE_APP_PASSWORD     — personal account
//   GMAIL_UNWINDAI_ADDRESS, GMAIL_UNWINDAI_APP_PASSWORD    — unwindai.com.au account
//   (Falls back to legacy GMAIL_ADDRESS / GMAIL_APP_PASSWORD if the per-account vars
//    aren't set — supports the existing master .env until Thomas generates the second
//    App Password.)
//
// Public API:
//   readInbox({ account, days = 7, mailbox = "INBOX", search })
//   summariseEmails(messages)
//
// account is "private" | "unwindai" — picks which credential pair to use.

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import Anthropic from "@anthropic-ai/sdk";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { config as loadDotenv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MASTER_ENV = join(__dirname, "..", "..", "data-pipeline", ".env");
loadDotenv({ path: MASTER_ENV, override: true });

const anthropic = new Anthropic();

function credsFor(account) {
  if (account === "private") {
    return {
      user: process.env.GMAIL_PRIVATE_ADDRESS  || process.env.GMAIL_ADDRESS,
      pass: process.env.GMAIL_PRIVATE_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD,
    };
  }
  if (account === "unwindai") {
    return {
      user: process.env.GMAIL_UNWINDAI_ADDRESS  || process.env.GMAIL_ADDRESS,
      pass: process.env.GMAIL_UNWINDAI_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD,
    };
  }
  throw new Error(`Unknown account: ${account}. Use "private" or "unwindai".`);
}

export async function readInbox({ account, days = 7, mailbox = "INBOX", search } = {}) {
  const { user, pass } = credsFor(account);
  if (!user || !pass) {
    throw new Error(
      `Missing IMAP creds for account="${account}". Set GMAIL_${account.toUpperCase()}_ADDRESS and GMAIL_${account.toUpperCase()}_APP_PASSWORD in master .env.`
    );
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  await client.connect();
  const messages = [];

  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const since = new Date(Date.now() - days * 86_400_000);
      const criteria = { since, ...(search ?? {}) };

      for await (const msg of client.fetch(criteria, { source: true, envelope: true, flags: true })) {
        const parsed = await simpleParser(msg.source);
        messages.push({
          uid: msg.uid,
          date: parsed.date,
          from: parsed.from?.text,
          to: parsed.to?.text,
          subject: parsed.subject,
          textPreview: (parsed.text ?? "").slice(0, 600),
          flags: [...(msg.flags ?? [])],
          unread: !msg.flags?.has?.("\\Seen"),
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return messages;
}

export async function summariseEmails(messages, { context = "" } = {}) {
  if (!messages.length) return "No emails in window.";

  const digest = messages
    .map((m, i) => `[${i + 1}] ${m.date?.toISOString?.().slice(0, 10) ?? "?"} — ${m.from} → ${m.subject}\n${m.textPreview}`)
    .join("\n\n---\n\n");

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Summarise the following emails into: (a) anything that needs Thomas's response, (b) anything informational worth knowing, (c) anything that can be ignored. Keep it brief. ${context ? `Context: ${context}` : ""}\n\n${digest}`,
      },
    ],
  });

  return msg.content[0].text;
}
