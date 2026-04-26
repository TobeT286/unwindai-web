// Doer — executes a single step from the planner's plan
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function execute(step, contextData = {}) {
  const system = `You are an execution agent. Carry out the given step precisely.
Use any provided context data. Return the result as plain text or JSON.
Context data: ${JSON.stringify(contextData)}`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: `Execute: ${step}` }],
  });

  return msg.content[0].text;
}

// Execute all steps sequentially, passing results forward
export async function executeAll(steps, contextData = {}) {
  const results = [];
  let accumulated = { ...contextData };

  for (const step of steps) {
    const result = await execute(step, accumulated);
    results.push({ step, result });
    accumulated.previousResult = result;
  }

  return results;
}
