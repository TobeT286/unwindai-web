// Teams webhook — sends MessageCard payloads to the channel configured by
// TEAMS_WEBHOOK_URL in the master .env. Mirrors the schema used by
// data-pipeline/quality/daily_summary.py so all Unwind AI agent updates
// land in the same "Daily Quality Summary" channel with consistent formatting.
//
// Usage:
//   import { sendTeamsCard, themePass, themeFail } from "./teams-webhook.js";
//   await sendTeamsCard({ summary, sections, themeColor });

import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { config as loadDotenv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: join(__dirname, "..", "..", "data-pipeline", ".env"), override: true });

export const themePass = "00b050";
export const themeFail = "FF0000";
export const themeNeutral = "0078d4";

export async function sendTeamsCard({ summary, sections, themeColor = themeNeutral }) {
  const url = process.env.TEAMS_WEBHOOK_URL;
  if (!url) throw new Error("TEAMS_WEBHOOK_URL not set in master .env");

  const card = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor,
    summary,
    sections,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Teams webhook ${res.status}: ${text}`);
  }
  return true;
}
