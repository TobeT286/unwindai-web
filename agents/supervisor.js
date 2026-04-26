// Supervisor — monitors the agent flow, handles retries and failures
const MAX_RETRIES = 2;

export async function supervise(taskFn, label = "task") {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const result = await taskFn();
      if (attempt > 1) {
        console.log(`[supervisor] "${label}" succeeded on attempt ${attempt}`);
      }
      return { ok: true, result };
    } catch (err) {
      lastError = err;
      console.warn(`[supervisor] "${label}" failed (attempt ${attempt}): ${err.message}`);
      if (attempt <= MAX_RETRIES) {
        await sleep(500 * attempt);
      }
    }
  }

  console.error(`[supervisor] "${label}" exhausted retries. Final error: ${lastError.message}`);
  return { ok: false, error: lastError.message };
}

// Run multiple supervised tasks, collect all results (no short-circuit)
export async function superviseAll(tasks) {
  return Promise.all(
    tasks.map(({ fn, label }) => supervise(fn, label))
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
