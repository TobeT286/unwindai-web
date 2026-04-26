// Energy agent flow — composes all IBM framework roles for VEU energy queries
import { loadContext } from "../learner.js";
import { plan } from "../planner.js";
import { executeAll } from "../doer.js";
import { critique } from "../critic.js";
import { supervise } from "../supervisor.js";
import { present } from "../presenter.js";

export async function runEnergyFlow(userMessage) {
  // 1. Learner — ground the flow in energy context
  const context = await loadContext("energy");

  // 2. Planner — decompose the request into steps
  const { steps, intent } = await supervise(
    () => plan(userMessage, context),
    "energy:planner"
  ).then((r) => (r.ok ? r.result : { steps: [userMessage], intent: userMessage }));

  // 3. Doer — execute each step with energy context
  const stepResults = await supervise(
    () => executeAll(steps, { context, userMessage }),
    "energy:doer"
  ).then((r) =>
    r.ok ? r.result : [{ step: userMessage, result: "Could not complete task." }]
  );

  const rawOutput = stepResults.map((s) => `${s.step}\n${s.result}`).join("\n\n");

  // 4. Critic — review before showing the user
  const review = await supervise(
    () => critique(rawOutput, intent, context),
    "energy:critic"
  ).then((r) => (r.ok ? r.result : { approved: true, issues: [], revised: null }));

  const toPresent = review.revised ?? rawOutput;

  // 5. Presenter — format for the end user
  const finalResponse = await supervise(
    () => present(toPresent, "markdown", context),
    "energy:presenter"
  ).then((r) => (r.ok ? r.result : toPresent));

  return {
    response: finalResponse,
    intent,
    steps,
    critiqued: !review.approved,
    issues: review.issues,
  };
}
