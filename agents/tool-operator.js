// Tool Operator — handles all external API calls (Sheets, Calendar, Email, Python scripts)
import { execFile } from "child_process";
import { promisify } from "util";
import { readInbox, summariseEmails } from "./email-reader.js";

const execFileAsync = promisify(execFile);

// Registry of available tools
const TOOLS = {
  sheets: callSheets,
  calendar: callCalendar,
  email: callEmail,
  python: runPython,
};

export async function callTool(toolName, params = {}) {
  const tool = TOOLS[toolName];
  if (!tool) throw new Error(`Unknown tool: ${toolName}`);
  return tool(params);
}

async function callEmail({ account = "unwindai", action = "list", days = 7, mailbox = "INBOX", search } = {}) {
  if (action === "list") {
    const messages = await readInbox({ account, days, mailbox, search });
    return { source: "email", account, count: messages.length, messages };
  }
  if (action === "summarise") {
    const messages = await readInbox({ account, days, mailbox, search });
    const summary = await summariseEmails(messages);
    return { source: "email", account, count: messages.length, summary };
  }
  throw new Error(`Unknown email action: ${action}`);
}

async function callSheets({ sheetId, range, values, action = "read" }) {
  // Placeholder — wire to Google Sheets API or your existing sheet logic
  if (action === "read") {
    return { source: "sheets", sheetId, range, data: [] };
  }
  if (action === "write") {
    return { source: "sheets", sheetId, range, written: values };
  }
  throw new Error(`Unknown sheets action: ${action}`);
}

async function callCalendar({ action = "list", params: calParams = {} }) {
  // Placeholder — wire to Google Calendar API
  return { source: "calendar", action, params: calParams, events: [] };
}

async function runPython({ scriptPath, args = [] }) {
  const { stdout, stderr } = await execFileAsync("python", [scriptPath, ...args], {
    timeout: 30000,
  });
  if (stderr) console.warn("[tool-operator] python stderr:", stderr);
  return { source: "python", scriptPath, output: stdout.trim() };
}
