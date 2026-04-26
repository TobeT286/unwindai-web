// YouTube Researcher — fetches recent videos via public RSS (no API key),
// pulls transcripts via youtube-transcript (no API key), summarises with Claude,
// writes to /context/ai-research.md for the AI Master agent to consume.
//
// Run: node agents/youtube-researcher.js
// Schedule: nightly via Windows Task Scheduler (run-youtube-researcher.bat)
//
// Requires only ANTHROPIC_API_KEY (loaded from the master .env at
// ../data-pipeline/.env relative to project root).

import { YoutubeTranscript } from "youtube-transcript";
import Anthropic from "@anthropic-ai/sdk";
import { writeFile, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config as loadDotenv } from "dotenv";
import { parseStringPromise } from "xml2js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MASTER_ENV = join(ROOT, "..", "data-pipeline", ".env");

loadDotenv({ path: MASTER_ENV, override: true });

const OUTPUT_PATH = join(ROOT, "context", "ai-research.md");
const CHANNEL_CACHE_PATH = join(__dirname, ".channel-ids.json");

const anthropic = new Anthropic();

const DAYS_BACK = 30;
const MAX_VIDEOS_PER_CHANNEL = 5;
const MAX_TRANSCRIPT_CHARS = 8_000;

// Channel handles — resolved to IDs once, then cached
const TARGET_CHANNELS = [
  { handle: "IBMTechnology", label: "IBM Technology" },
  { handle: "nateherk",      label: "Nate Herk" },
  { handle: "AIFoundersHQ",  label: "AI Founders" },
  // Thomas — append more @handles here as you find them
];

// ─── channel ID resolution (HTML scrape, cached) ────────────────────────────

async function loadChannelIdCache() {
  try {
    return JSON.parse(await readFile(CHANNEL_CACHE_PATH, "utf-8"));
  } catch {
    return {};
  }
}

async function saveChannelIdCache(cache) {
  await writeFile(CHANNEL_CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function resolveChannelId(handle, cache) {
  if (cache[handle]) return cache[handle];

  const url = `https://www.youtube.com/@${handle}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`channel page ${url} returned ${res.status}`);
  const html = await res.text();

  const match = html.match(/"channelId":"(UC[\w-]{20,})"/) ||
                html.match(/"externalId":"(UC[\w-]{20,})"/);
  if (!match) throw new Error(`could not extract channelId from @${handle} page`);

  cache[handle] = match[1];
  return match[1];
}

// ─── RSS feed → recent videos ───────────────────────────────────────────────

async function fetchChannelRss(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RSS ${url} returned ${res.status}`);
  const xml = await res.text();
  const parsed = await parseStringPromise(xml);
  return (parsed.feed?.entry ?? []).map((e) => ({
    videoId:    e["yt:videoId"]?.[0],
    channelId:  e["yt:channelId"]?.[0],
    title:      e.title?.[0],
    published:  e.published?.[0],
    channel:    e.author?.[0]?.name?.[0],
    url:        e.link?.[0]?.$?.href,
  }));
}

function withinWindow(publishedIso, days) {
  const cutoff = Date.now() - days * 86_400_000;
  return new Date(publishedIso).getTime() >= cutoff;
}

// ─── transcript + summary ───────────────────────────────────────────────────

async function getTranscript(videoId) {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    return segments.map((s) => s.text).join(" ").slice(0, MAX_TRANSCRIPT_CHARS);
  } catch {
    return null;
  }
}

async function summariseVideo(video, transcript) {
  const published = video.published.slice(0, 10);

  const prompt = transcript
    ? `Video: "${video.title}" by ${video.channel} (${published})\nTranscript excerpt:\n${transcript}\n\nSummarise in 3–5 bullet points: what AI tool/development is covered, why it matters for a small consulting business applying AI for revenue, and any concrete takeaways.`
    : `Video: "${video.title}" by ${video.channel} (${published})\nNo transcript available. Summarise based on the title alone in 1–2 bullet points — flag uncertainty.`;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  return {
    title: video.title,
    channel: video.channel,
    published,
    url: video.url,
    summary: msg.content[0].text,
    hasTranscript: !!transcript,
  };
}

// ─── main ───────────────────────────────────────────────────────────────────

async function run() {
  console.log("[youtube-researcher] Starting run…");
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(`ANTHROPIC_API_KEY not found. Master .env path: ${MASTER_ENV}`);
  }

  const cache = await loadChannelIdCache();
  const allSummaries = [];

  for (const { handle, label } of TARGET_CHANNELS) {
    try {
      console.log(`  Resolving channel: ${label} (@${handle})`);
      const channelId = await resolveChannelId(handle, cache);

      const videos = (await fetchChannelRss(channelId))
        .filter((v) => v.videoId && withinWindow(v.published, DAYS_BACK))
        .slice(0, MAX_VIDEOS_PER_CHANNEL);

      console.log(`  Found ${videos.length} video(s) in last ${DAYS_BACK} days`);

      for (const video of videos) {
        const transcript = await getTranscript(video.videoId);
        const summary = await summariseVideo(video, transcript);
        allSummaries.push(summary);
        console.log(`  ✓ ${summary.title.slice(0, 60)}…`);
      }
    } catch (err) {
      console.warn(`  ⚠ @${handle} failed: ${err.message}`);
    }
  }

  await saveChannelIdCache(cache);

  if (!allSummaries.length) {
    console.log("[youtube-researcher] No qualifying videos found.");
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `# AI Research — YouTube Digest`,
    `_Last updated: ${date} | Sources: ${TARGET_CHANNELS.map((c) => c.label).join(", ")} | Window: last ${DAYS_BACK} days_`,
    "",
  ];

  for (const s of allSummaries) {
    lines.push(`## [${s.title}](${s.url})`);
    lines.push(`**Channel:** ${s.channel} | **Published:** ${s.published}${s.hasTranscript ? "" : " _(no transcript)_"}`);
    lines.push("");
    lines.push(s.summary);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  await writeFile(OUTPUT_PATH, lines.join("\n"), "utf-8");
  console.log(`[youtube-researcher] Wrote ${allSummaries.length} summaries → context/ai-research.md`);
}

run().catch((err) => {
  console.error("[youtube-researcher] Fatal:", err.message);
  process.exit(1);
});
