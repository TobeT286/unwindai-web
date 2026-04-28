// Email Reader — IMAP-based Gmail reader using App Passwords (no OAuth, no Google Cloud).
//
// Env vars (master .env at ../data-pipeline/.env):
//   GMAIL_ADDRESS,           GMAIL_APP_PASSWORD           — private account (thomas.taresch@gmail.com)
//   GMAIL_ADDRESS_UNWINDAI,  GMAIL_APP_PASSWORD_UNWINDAI  — unwindai account (thomas.taresch@unwindai.com.au)
//
// Naming convention: <BASE>_<ACCOUNT_SUFFIX>. Private has no suffix (it's the default).
// Add more accounts by adding GMAIL_ADDRESS_<NAME> + GMAIL_APP_PASSWORD_<NAME>.
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
  // Private = no suffix (the default). Other accounts use _<NAME> suffix.
  const suffix = account === "private" ? "" : `_${account.toUpperCase()}`;
  return {
    user: process.env[`GMAIL_ADDRESS${suffix}`],
    pass: process.env[`GMAIL_APP_PASSWORD${suffix}`],
  };
}

export async function readInbox({ account, days = 7, mailbox = "INBOX", search } = {}) {
  const { user, pass } = credsFor(account);
  if (!user || !pass) {
    const suffix = account === "private" ? "" : `_${account.toUpperCase()}`;
    throw new Error(
      `Missing IMAP creds for account="${account}". Set GMAIL_ADDRESS${suffix} and GMAIL_APP_PASSWORD${suffix} in master .env.`
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
