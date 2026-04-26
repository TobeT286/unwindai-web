// Presenter — formats the final response for the user
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function present(rawOutput, format = "markdown", context = "") {
  const system = `You are a presentation agent. Take raw agent output and format it
clearly for the end user. Format: ${format}. Be concise and friendly.
Context about this agent: ${context}`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: rawOutput }],
  });

  return msg.content[0].text;
}

// Lightweight formatter — no LLM call, just structure
export function formatSimple(data, format = "markdown") {
  if (format === "json") return JSON.stringify(data, null, 2);

  if (typeof data === "string") return data;

  if (Array.isArray(data)) {
    return data.map((item, i) => `${i + 1}. ${JSON.stringify(item)}`).join("\n");
  }

  return Object.entries(data)
    .map(([k, v]) => `**${k}:** ${v}`)
    .join("\n");
}
