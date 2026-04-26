// Planner — breaks user input into an ordered step plan
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function plan(userMessage, context = "") {
  const system = `You are a planning agent. Given a user request and optional context,
decompose it into a numbered list of discrete, executable steps.
Return JSON: { "steps": ["step1", "step2", ...], "intent": "short summary" }
Context: ${context}`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = msg.content[0].text;
  try {
    return JSON.parse(text);
  } catch {
    return { steps: [text], intent: userMessage };
  }
}
