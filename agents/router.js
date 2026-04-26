// Router — determines which agent flow handles a given request.
// Order matters: more specific routes first. The data-engineer route catches
// internal/technical platform-design questions; the data route catches
// customer-facing pitch questions.
const ROUTES = {
  aimaster: {
    keywords: ["ai tool", "ai trend", "latest ai", "new model", "agent framework", "llm", "how should i use ai", "best ai", "ai for business", "ai revenue", "automate with ai"],
    contextKey: "ai-master",
  },
  "data-engineer": {
    keywords: ["data engineer", "data engineering", "platform design", "platform architecture", "medallion", "bronze silver gold", "lakehouse", "dbt", "airflow", "prefect", "dagster", "data warehouse", "iceberg", "delta lake", "kafka", "spark", "orchestration", "semantic layer", "data quality"],
    contextKey: "data-engineer",
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
