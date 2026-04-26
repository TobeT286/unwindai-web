// YouTube Researcher — fetches recent high-view AI videos, summarises with Claude,
// writes to /context/ai-research.md for the AI Master agent to consume.
//
// Run: node agents/youtube-researcher.js
// Schedule: nightly via Windows Task Scheduler
//
// Requires env vars:
//   YOUTUBE_API_KEY   — Google Cloud project with YouTube Data API v3 enabled
//   ANTHROPIC_API_KEY — for summarisation

import { google } from "googleapis";
import { YoutubeTranscript } from "youtube-transcript";
import Anthropic from "@anthropic-ai/sdk";
import { writeFile, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = join(ROOT, "context", "ai-research.md");

const youtube = google.youtube({ version: "v3", auth: process.env.YOUTUBE_API_KEY });
const anthropic = new Anthropic();

const MIN_VIEWS = 50_000;
const DAYS_BACK = 30;
const MAX_TRANSCRIPT_CHARS = 8_000; // trim long transcripts before sending to Claude

// Channel handles → resolved to IDs at runtime via the API
const TARGET_CHANNELS = [
  { handle: "IBMTechnology",  label: "IBM Technology" },
  { handle: "nateherk",       label: "Nate Herk" },
  { handle: "AIFoundersHQ",   label: "AI Founders" },
];

// ─── helpers ────────────────────────────────────────────────────────────────

function publishedAfter() {
  const d = new Date();
  d.setDate(d.getDate() - DAYS_BACK);
  return d.toISOString();
}

async function resolveChannelId(handle) {
  try {
    const res = await youtube.channels.list({
      part: ["id"],
      forHandle: handle,
    });
    return res.data.items?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function fetchChannelVideos(channelId) {
  const res = await youtube.search.list({
    part: ["snippet"],
    channelId,
    type: ["video"],
    order: "date",
    publishedAfter: publishedAfter(),
    maxResults: 20,
  });

  const items = res.data.items ?? [];
  const videoIds = items.map((i) => i.id.videoId).filter(Boolean);
  if (!videoIds.length) return [];

  // Fetch statistics to filter by views
  const stats = await youtube.videos.list({
    part: ["snippet", "statistics"],
    id: videoIds,
  });

  return (stats.data.items ?? [])
    .filter((v) => parseInt(v.statistics.viewCount ?? "0", 10) >= MIN_VIEWS)
    .sort((a, b) => parseInt(b.statistics.viewCount, 10) - parseInt(a.statistics.viewCount, 10));
}

async function getTranscript(videoId) {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    const text = segments.map((s) => s.text).join(" ");
    return text.slice(0, MAX_TRANSCRIPT_CHARS);
  } catch {
    return null; // transcript unavailable (disabled / live / private)
  }
}

async function summariseVideo(video, transcript) {
  const title = video.snippet.title;
  const channel = video.snippet.channelTitle;
  const views = parseInt(video.statistics.viewCount, 10).toLocaleString();
  const published = video.snippet.publishedAt.slice(0, 10);
  const videoId = video.id;

  const prompt = transcript
    ? `Video: "${title}" by ${channel} (${views} views, ${published})\nTranscript excerpt:\n${transcript}\n\nSummarise in 3-5 bullet points: what AI tool/development is covered, why it matters for a business applying AI for revenue, and any concrete takeaways.`
    : `Video: "${title}" by ${channel} (${views} views, ${published})\nNo transcript available. Summarise based on the title alone in 1-2 bullet points.`;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001", // fast + cheap for batch summarisation
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  return {
    title,
    channel,
    views,
    published,
    url: `https://youtube.com/watch?v=${videoId}`,
    summary: msg.content[0].text,
    hasTranscript: !!transcript,
  };
}

// ─── main ────────────────────────────────────────────────────────────────────

async function run() {
  console.log("[youtube-researcher] Starting run…");
  const allSummaries = [];

  for (const { handle, label } of TARGET_CHANNELS) {
    console.log(`  Resolving channel: ${label} (@${handle})`);
    const channelId = await resolveChannelId(handle);
    if (!channelId) {
      console.warn(`  ⚠ Could not resolve channel ID for @${handle} — skipping`);
      continue;
    }

    const videos = await fetchChannelVideos(channelId);
    console.log(`  Found ${videos.length} video(s) with ${MIN_VIEWS.toLocaleString()}+ views`);

    for (const video of videos.slice(0, 5)) { // max 5 per channel
      const transcript = await getTranscript(video.id);
      const summary = await summariseVideo(video, transcript);
      allSummaries.push(summary);
      console.log(`  ✓ ${summary.title.slice(0, 60)}…`);
    }
  }

  if (!allSummaries.length) {
    console.log("[youtube-researcher] No qualifying videos found.");
    return;
  }

  // Build the context markdown
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `# AI Research — YouTube Digest`,
    `_Last updated: ${date} | Sources: ${TARGET_CHANNELS.map((c) => c.label).join(", ")} | Min views: ${MIN_VIEWS.toLocaleString()} | Window: last ${DAYS_BACK} days_`,
    "",
  ];

  for (const s of allSummaries) {
    lines.push(`## [${s.title}](${s.url})`);
    lines.push(`**Channel:** ${s.channel} | **Views:** ${s.views} | **Published:** ${s.published}${s.hasTranscript ? "" : " _(no transcript)_"}`);
    lines.push("");
    lines.push(s.summary);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  await writeFile(OUTPUT_PATH, lines.join("\n"), "utf-8");
  console.log(`[youtube-researcher] Written ${allSummaries.length} summaries → context/ai-research.md`);
}

run().catch((err) => {
  console.error("[youtube-researcher] Fatal:", err.message);
  process.exit(1);
});
