// Router — determines which agent flow handles a given request
const ROUTES = {
  aimaster: {
    keywords: ["ai tool", "ai trend", "latest ai", "new model", "agent framework", "llm", "how should i use ai", "best ai", "ai for business", "ai revenue", "automate with ai"],
    contextKey: "ai-master",
  },
  energy: {
    keywords: ["energy", "solar", "battery", "power", "electricity", "tariff", "grid"],
    contextKey: "energy",
  },
  amh: {
    keywords: ["amh", "invoice", "payment", "reconcile", "halaxy", "bank", "finance"],
    contextKey: "amh",
  },
  data: {
    keywords: ["data", "pipeline", "report", "spreadsheet", "duckdb", "smartsheet"],
    contextKey: "data",
  },
  maintenance: {
    keywords: ["maintenance", "repair", "schedule", "asset", "fault"],
    contextKey: "maintenance",
  },
  spoton: {
    keywords: ["spoton", "electrical", "quote", "job", "site"],
    contextKey: "spoton",
  },
};

export function route(userMessage) {
  const lower = userMessage.toLowerCase();

  for (const [agentKey, { keywords, contextKey }] of Object.entries(ROUTES)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return { agentKey, contextKey };
    }
  }

  // Default fallback
  return { agentKey: "general", contextKey: "thomas" };
}
