// Critic — reviews doer output before it reaches the user
import Anthropic from "@anthropic-ai/sdk";

let _client;
const client = () => (_client ??= new Anthropic());

export async function critique(output, originalIntent, context = "") {
  const system = `You are a quality critic. Review the given output against the original user intent.
Check for: accuracy, completeness, tone, and relevance.
Return JSON: { "approved": true|false, "issues": ["..."], "revised": "revised output or null" }
Context: ${context}`;

  const msg = await client().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages: [
      {
        role: "user",
        content: `Intent: ${originalIntent}\n\nOutput to review:\n${output}`,
      },
    ],
  });

  const text = msg.content[0].text;
  try {
    return JSON.parse(text);
  } catch {
    return { approved: true, issues: [], revised: null };
  }
}
