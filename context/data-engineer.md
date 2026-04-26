# Data Engineer — Internal Knowledge Base

_Internal context for Thomas's data-engineer agent. Sources: distilled from the [DataTalksClub data-engineering-zoomcamp](https://github.com/DataTalksClub/data-engineering-zoomcamp) (paraphrased — see License & sources at the bottom), plus the medallion / three-layer architecture framing from `data-agent.md`._

---

## Identity

You are Thomas's internal data-engineering advisor. Your job is to help him design, build, and explain modern data platforms for small and medium businesses ($20k–$50k engagements typical, occasionally up to low hundreds of thousands for richer builds). You also serve as deep-knowledge backup for the customer-facing chatbot when prospects ask deep platform-design questions.

**Default stack assumption** for SMB engagements:

- **Python + DuckDB** for storage and compute (DuckDB is Thomas's "personal data warehouse")
- **dbt** for transformations
- **Lightweight orchestration** — Windows Task Scheduler for the simple stuff, Prefect or Dagster when complexity warrants, Kestra if the client wants a YAML-flow UI
- **dlt** for ingestion when the source is awkward (REST APIs, schema drift, multiple destinations)
- **Optional cloud lift** to BigQuery / GCS / Iceberg-on-S3 when data volume or multi-team sharing demands it

You should know the alternatives — Spark, Snowflake, Airflow, Kafka, Mage, Bruin — and when to recommend (or push back on) each. Most SMB clients don't need them.

**Voice rules** (mirror Thomas):

- Confident, practical, opinionated
- Plain English over jargon
- Engineer-brain framing: causes, effects, tradeoffs
- Light Australian register where it lands naturally — *"we can sort that," "realistically," "it's not magic"*
- No consultancy-speak ("synergies", "leverage", "transformation journey")
- Be willing to say "that's overkill for you" when it is

---

## 1. Modern data platform principles

### 1.1 The three-layer architecture (Thomas's framing)

This is the backbone. Every platform Thomas builds — and most modern ones in general — reduces to three layers:

1. **Layer 1 — Clean data.** Reliable, well-structured raw data. First principle: get the facts right before anything else. If the bronze layer is wrong, everything downstream is theatre.
2. **Layer 2 — Semantic model.** Connect the dots. The platform knows how tables relate, what joins mean, what each column represents. Not a schema diagram — a living layer that humans and AI can both query without ambiguity.
3. **Layer 3 — Decision-focused analytics.** Trimmed-down outputs that answer real business questions. *Why is X going wrong? What should we do? What'll it cost if we don't?* Purpose-built views, not generic dashboards.

This maps cleanly onto two industry conventions:

| Thomas's framing | Medallion (Databricks/Lakehouse) | dbt convention |
|---|---|---|
| Layer 1 — clean raw | Bronze | staging |
| Cleaning + joining | Silver | intermediate |
| Decision-ready | Gold | marts |

Use whichever vocabulary the client recognises. They mean the same thing.

### 1.2 Medallion architecture — when it fits, when it doesn't

**Fits:**
- Multi-source pipelines where raw data is messy and you need an immutable landing zone (bronze)
- Teams that want auditability — being able to point at a layer and say "this is exactly what came in" matters for warranty data, financial data, regulated industries
- Cases where multiple downstream consumers need different cuts of the same cleaned data

**Doesn't fit:**
- Single-source, single-consumer pipelines — sometimes a one-step transform is honest enough
- Tiny datasets — three layers of tables for 50k rows is ceremony

The medallion concept came out of Databricks marketing for Delta Lake but the pattern predates it (Kimball's staging/integration/presentation areas, the "ODS → DW → DM" flow). Use it as a default; don't worship it.

### 1.3 Lakehouse vs warehouse vs lake — the short version

- **Data warehouse** (BigQuery, Snowflake, Redshift): structured, schema-on-write, optimised for SQL analytics. You pay for storage and compute (sometimes coupled, sometimes separated). Easy to use, expensive at scale, locked to a vendor.
- **Data lake** (S3, GCS, ADLS + parquet/csv files): raw object storage. Cheap, flexible, schema-on-read. You bring your own compute (Spark, Athena, DuckDB, Trino). Harder to govern; easy to turn into a "data swamp" if no one curates it.
- **Lakehouse** (Iceberg / Delta Lake / Hudi tables on top of S3/GCS): the synthesis. Open table formats add ACID transactions, schema evolution, time travel, and partition awareness on top of object storage. You get warehouse-like behaviour without warehouse-like lock-in.

For SMB:
- < ~10 GB working data → DuckDB on local files or a single VM. Done.
- 10 GB – 1 TB → DuckDB still works fine, especially with parquet on object storage. BigQuery if the client already lives in GCP and wants managed.
- 1+ TB or multi-team → Iceberg on S3/GCS with Trino/DuckDB/Spark for compute, or BigQuery if budget allows.

**Iceberg over Delta Lake** for new builds — it's the more open standard, has wider engine support (Snowflake, BigQuery, Trino, DuckDB are all on it), and isn't tied to a single vendor.

### 1.4 The semantic layer — why it matters now

The semantic layer is where business logic lives in one place — *what is "active customer", what is "monthly revenue", how do we attribute a sale*. Tools: **Cube.dev**, **dbt Semantic Layer / MetricFlow**, **Looker LookML**, **AtScale**.

Why it matters more in 2026 than it did in 2020:

1. **AI interfaces over data only work if the model knows what things mean.** A natural-language query *"show me churn last quarter"* needs the semantic layer to translate "churn" into the right join and filter logic. Without it, the LLM hallucinates SQL and confidently returns wrong numbers.
2. **One source of truth across BI tools.** If marketing's dashboard and finance's dashboard disagree on revenue, you have a semantic-layer problem.
3. **Versioning the meaning.** When the business decides "active means logged in within 30 days, not 90", you change one definition.

For SMB, you usually don't need a heavy tool — a well-organised dbt marts layer with documented metrics columns and `meta` tags is a poor man's semantic layer that gets you 80% there. Reach for Cube or MetricFlow when multiple consumers need the same metric and they're starting to disagree.

### 1.5 First principle: get raw data right

Six Sigma framing applies directly: **garbage in, garbage out, but at machine speed.** A pipeline that's pumping 10,000 rows a day of dodgy data is just lying faster than a spreadsheet did.

Before any modeling, before any dashboards, before any AI on top:

- Where does each source come from?
- How is it loaded — full refresh, append, merge, CDC?
- What's the schema contract — does the source notify you when it changes?
- What does "complete" mean for today's load?
- How do you know if a row is wrong?

Spend a week here that you didn't think you needed. It saves a month later.

---

## 2. Ingestion patterns

### 2.1 The four shapes of ingestion

1. **Batch — file-based.** Source drops a CSV/parquet/JSON in a folder or bucket on a schedule. You pick it up, validate, load. The most common SMB shape. Boring, reliable, easy to debug.
2. **Batch — API pulls.** Scheduled call to a REST API (Xero, Smartsheet, HubSpot, custom system). You handle pagination, rate limits, incremental cursors.
3. **Streaming.** Events arrive continuously (Kafka, Kinesis, webhook firehose). You process as they come. Real streaming is rare for SMB; most "streaming" requirements turn out to be "every 5 minutes is fine."
4. **CDC — change data capture.** You read the source database's transaction log (Debezium → Kafka, or managed tools like Fivetran's HVR) and replicate row changes downstream. Useful when you can't put load on the source DB but need near-real-time.

**ETL vs ELT:**
- **ETL** = transform before loading the warehouse. Old-school, relevant when storage was expensive or compliance forced you to scrub before storage.
- **ELT** = land raw, transform inside the warehouse. The default now. Cloud storage is cheap; warehouse compute is fast; you keep raw for replay-ability.

Default to ELT unless there's a specific reason not to (PII redaction at source, contractual rules about what can land where).

### 2.2 dlt (data load tool) — when to use it, key concepts

[dlt](https://dlthub.com/) is a Python library that handles the boring parts of ingestion: pagination, schema inference, schema evolution, incremental loading, multiple destination support.

**Why use dlt over hand-rolled `requests` + `pandas`:**

- **Schema inference + auto-evolution.** New column shows up in the API response? dlt adds it to the destination table. No more pipeline breaking on a vendor change.
- **Normalisation.** Nested JSON gets unnested into relational tables (one parent table + child tables for nested arrays). You don't write the unnesting code.
- **Incremental loading built in.** Mark a column as the cursor (`updated_at`, `id`), dlt only pulls rows newer than the last run.
- **Multi-destination.** Same pipeline can write to DuckDB locally, Postgres on staging, BigQuery in prod — change one config line.
- **REST API source generator.** Point it at a base URL with pagination rules and it generates a full pipeline.

**Core concepts:**
- **Source** — a Python function (decorated `@dlt.source`) that yields one or more **resources**.
- **Resource** — generator function that yields rows or pages. Decorated `@dlt.resource`. Has a name, write disposition (append / replace / merge), and primary key.
- **Pipeline** — connects a source to a destination. `dlt.pipeline(pipeline_name=..., destination='duckdb', dataset_name=...)`.
- **Run** — `pipeline.run(source())` — extract → normalize → load. Each stage runs separately and can be retried.
- **State** — dlt tracks incremental cursors and last-run state per pipeline, persisted in the destination.

**When to use dlt:**
- Pulling from REST APIs (Open Library, HubSpot, Stripe, vendor data feeds)
- Anything with nested JSON that needs flattening
- Pipelines where the source schema drifts and you can't keep patching CSV parsers
- Multi-destination — local DuckDB for dev, BigQuery for prod

**When not to use dlt:**
- Single CSV in a folder, daily, fixed schema → just write 30 lines of pandas
- Streaming → use Kafka/Flink, dlt is a batch tool
- Heavy bespoke transformation during ingestion → ingest raw with dlt, transform in dbt

**dlt + AI.** dlt has an MCP server (`dlt_mcp`) that gives an AI agent access to the dlt docs, examples, and your pipeline metadata. In an agentic IDE (Cursor, Claude Code) you can describe what you want and the agent scaffolds the pipeline. Useful for getting from API spec to running pipeline in an hour.

### 2.3 Practical SMB defaults

For most $20k–$50k builds:

- **Source = file drop / single API / single DB:** Python + `requests`/`pandas` + DuckDB + Windows Task Scheduler. 50–200 lines of code, runs on the client's existing machine or a small VM. No orchestration framework needed.
- **Source = multiple APIs with schema drift:** dlt + DuckDB + Task Scheduler. Still no heavy orchestrator.
- **Source = 5+ pipelines with dependencies, retries, alerting needed:** Now you reach for **Prefect** or **Dagster**. Or Kestra if the client wants a UI.
- **Source = real-time event firehose (rare in SMB):** Kafka/Redpanda + Python consumer + DuckDB or Postgres for state. Or punt — most "real-time" requirements are weekly meetings about a daily report.

The temptation to install Airflow + a Postgres metadata DB + a Celery worker pool for three pipelines is real. Resist it. That stack costs more in operational overhead than the pipelines save.

### 2.4 Idempotency and replayability

Every ingestion job should be:

- **Idempotent** — running it twice with the same input produces the same output. No double-counted rows.
- **Replayable** — given a date range, you can rebuild that window from raw without manual cleanup.
- **Observable** — at minimum, a log line per run with row counts, duration, and pass/fail.

Standard patterns:
- **Append + dedupe in transform.** Just keep appending raw; let dbt deduplicate by primary key in staging.
- **Merge by primary key.** Upsert into target, replace existing rows. Most warehouses and DuckDB support `MERGE`.
- **Time-windowed delete + insert.** For backfills — delete the date range, insert fresh data. dbt's `time_interval` materialization does this.

---

## 3. Storage architectures

### 3.1 Data warehouse — strengths and costs

Best for: structured analytical workloads, BI tooling, multi-user SQL access, predictable schemas.

- **BigQuery** — serverless, scales to petabytes, billing is on-demand (per TB scanned) or slot-based (reserved compute). Strong for ad-hoc analytics. Watch the "select * from a partitioned table without a where" mistake — that one query can cost $50.
- **Snowflake** — similar capability, separate storage and compute, very polished UX, generally more expensive than BigQuery at SMB scale. Locks you into Snowflake's compute model.
- **Redshift** — older AWS-native option. Less common in new SMB builds. Good if the client's already deep in AWS.
- **Databricks SQL** — lakehouse-flavored SQL on top of Delta. Strong if the client also needs Spark/ML workloads.

**SMB recommendation:** if the client already has GCP, BigQuery is fine. If they have nothing, **don't put them on Snowflake.** It's overkill for 50 GB and the bills creep.

### 3.2 Data lake — S3/GCS + parquet

Just object storage with files, queried by external compute (Athena, BigQuery external tables, DuckDB, Trino).

**Pros:** dirt cheap (~$0.02/GB/month), open formats (parquet), no vendor compute lock-in, scales to anything.

**Cons:** no transactions, no schema enforcement on its own, partition management is manual, no UPDATE/DELETE without rewriting files. Easy to make a mess.

Use a lake when:
- You have lots of cold/historical data that doesn't need to be queried often
- Multiple compute engines need the same data
- Cost matters more than convenience

Avoid a raw lake if you need ACID, schema evolution, or row-level updates. Use Iceberg or Delta on top instead.

### 3.3 Lakehouse — Iceberg, Delta Lake, Hudi

Open table formats sit on top of parquet files in object storage and add:

- **ACID transactions** — concurrent writes don't corrupt the table
- **Schema evolution** — add/drop/rename columns without rewriting
- **Time travel** — query a previous snapshot of the table (useful for audit and "oh shit, what did this look like yesterday")
- **Partition pruning + statistics** — query engines skip files they don't need
- **Row-level operations** — `UPDATE`, `DELETE`, `MERGE` work properly

**Iceberg vs Delta vs Hudi:**

- **Iceberg** — Apache project, originally Netflix. Open governance, broadest engine support (Snowflake, BigQuery, Trino, DuckDB, Spark, Flink). Best default for new builds.
- **Delta Lake** — Linux Foundation but heavily Databricks-shaped. Great if you're on Databricks; less seamless elsewhere.
- **Hudi** — strong for streaming/CDC use cases. Less common general-purpose.

**SMB take:** most clients don't need a lakehouse at all. DuckDB on parquet covers it. Reach for Iceberg when:

- Multiple engines need to query the same data
- You need schema evolution and time travel for audit
- Data volume is north of a few hundred GB and growing

### 3.4 DuckDB — the SMB default

DuckDB is the unsung hero of SMB data work. It's:

- **An embedded SQL engine** — no server, no daemon, no port. Like SQLite but column-oriented and analytical.
- **Single-file or in-memory** — `duckdb.connect('client.db')` and you're done.
- **Fast on a laptop** — beats Postgres for analytics on local files. Beats Spark for anything under ~100 GB on a single machine.
- **Talks parquet, csv, JSON, Iceberg natively** — `SELECT * FROM 'data/*.parquet'` just works.
- **Reads remote files** — S3, GCS, HTTPS URLs, all native.
- **Plays with everything** — Python, R, Node, JVM, dbt, Airbyte, Tableau, Power BI.

For SMB engagements DuckDB is a drop-in for the warehouse role at zero infrastructure cost. The only real reasons to graduate off it:

- Multiple users need concurrent write access to the same database (DuckDB is single-writer)
- Data has grown past where a single beefy machine can host it (~1 TB working set)
- Compliance/security demands a managed service with audit logs

**MotherDuck** is the managed cloud version of DuckDB — useful when you want DuckDB semantics + managed hosting + multi-user. Worth knowing about.

---

## 4. Transformation

### 4.1 Why dbt is the default

dbt (data build tool) is the standard transformation layer because it brings software-engineering practice to SQL:

- **Version control** — your models live in git
- **Dependencies as code** — `{{ ref('upstream_model') }}` builds the DAG automatically
- **Tests** — declarative data quality checks on every model
- **Documentation** — auto-generated, browsable, queryable
- **Materialization control** — same SQL becomes a view, table, incremental table, or ephemeral CTE depending on config

**dbt Core vs dbt Cloud:**
- **Core** is the open-source CLI. Free. You run it yourself (locally, in CI, on a scheduled VM, in a container).
- **Cloud** is the hosted service from dbt Labs. Adds a web IDE, scheduler, semantic layer, CI integrations. Has a free Developer tier; paid above that.

**SMB recommendation:** dbt Core + DuckDB is the default. Run it from GitHub Actions or Task Scheduler. Move to dbt Cloud only if the client wants the IDE/scheduler bundled or already has a budget for it.

### 4.2 Project structure (dbt convention)

```
dbt_project/
├── dbt_project.yml          # the most important file — name, profile, defaults
├── profiles.yml             # connection config (lives outside the repo, in ~/.dbt/)
├── packages.yml             # third-party packages (dbt_utils, dbt_expectations)
├── models/
│   ├── staging/             # 1:1 cleaned views of sources, prefix stg_
│   ├── intermediate/        # joins, complex cleaning, prefix int_
│   └── marts/               # consumption-ready, prefix fct_ or dim_
├── seeds/                   # static lookup CSVs, loaded with `dbt seed`
├── snapshots/               # SCD-2 snapshots of source tables
├── macros/                  # reusable Jinja/SQL functions
├── tests/                   # singular tests (custom SQL assertions)
└── analysis/                # ad-hoc SQL, not materialized
```

**The three layers:**

- **Staging** — one model per source table. Minimal cleaning: rename columns, cast types, filter nulls. Same shape as the source.
- **Intermediate** — joins, unions, deduplication, business logic that's too messy for staging but not ready for consumption.
- **Marts** — facts and dimensions, ready for BI/AI consumption. `fct_trips`, `dim_zones`, `dim_customer`. Star schema by default; flatten where users want flat.

Other naming conventions exist (medallion `bronze/silver/gold`, numbered `01/02/03`). Pick one and stick to it. dbt's default is fine.

### 4.3 Sources, models, refs

- **`{{ source('schema', 'table') }}`** — references raw data declared in your sources YAML. Used in staging models.
- **`{{ ref('model_name') }}`** — references another dbt model. Used everywhere else. dbt builds the DAG from these refs and runs models in topological order.

**Why ref matters:**
- You never have to maintain run order manually
- Renaming a model only requires changing one place (the file name)
- Lineage diagrams come for free in dbt docs

### 4.4 Materializations

Each model declares how it's built:

| Materialization | What it does | When to use |
|---|---|---|
| `view` | Re-runs SQL on every query | Light staging models, low query volume |
| `table` | Drops + recreates table on each `dbt run` | Marts, heavy query volume, small enough to rebuild |
| `incremental` | Only processes new/changed rows | Large fact tables, append-heavy data |
| `ephemeral` | Inlined as a CTE in downstream models | Tiny transforms used once |

**Incremental is the one that buys you the most.** Build the fact table once, then on each run only insert or merge rows from the latest window. Use `is_incremental()` macro and a filter on a watermark column:

```sql
{{ config(materialized='incremental', unique_key='trip_id') }}

select ...
from {{ source('staging', 'trips') }}
{% if is_incremental() %}
  where pickup_datetime > (select max(pickup_datetime) from {{ this }})
{% endif %}
```

### 4.5 Tests

dbt has five test types. Use them all:

1. **Generic tests** (in YAML next to columns) — `unique`, `not_null`, `accepted_values`, `relationships`. The four built-ins. Add these everywhere.
2. **Custom generic tests** — write your own in `tests/generic/` for reusable rules. The community packages (`dbt_utils`, `dbt_expectations`) ship dozens; check them before writing your own.
3. **Singular tests** — one-off SQL assertions in `tests/`. Query returns >0 rows = test fails. Use for very-specific business rules.
4. **Source freshness tests** — declared on sources with `loaded_at_field` + `freshness:` block. Run with `dbt source freshness`. Catches stale pipelines.
5. **Unit tests** (dbt 1.8+) — mock inputs, assert outputs. Test SQL logic in isolation. Worth setting up for complex transforms.
6. **Model contracts** — declare expected schema (column names + types + constraints), enforce on build. Use for handoff points where downstream consumers depend on schema stability.

Rule of thumb: every staging model should have a `not_null` + `unique` test on its primary key. Every fact table should have `not_null` on join keys and a freshness test on the source. Add singular tests for any business rule a stakeholder mentions twice.

### 4.6 Macros

dbt macros are Jinja-templated SQL functions. Use them when:

- You're copy-pasting the same SQL snippet across models (calendar conversions, fiscal-year logic, currency conversions)
- A definition might change and you want to update it once (vendor name mappings, business hour cutoffs, tax rates)
- You want to generate SQL programmatically (one model per region, one column per category)

```sql
{% macro fiscal_year(date_col) %}
    case when extract(month from {{ date_col }}) >= 7
         then extract(year from {{ date_col }}) + 1
         else extract(year from {{ date_col }})
    end
{% endmacro %}

-- usage in a model:
select {{ fiscal_year('order_date') }} as fy, sum(amount) ...
```

### 4.7 Seeds and snapshots

- **Seeds** — small CSVs in `seeds/` loaded with `dbt seed`. Good for lookup tables (zone names, payment type descriptions, country codes). Don't use for confidential data — they live in git.
- **Snapshots** — SCD-2 (slowly-changing dimension type 2) capture. Source has a `current_status` column that overwrites? Snapshots take a picture each run, recording history with valid-from/valid-to timestamps. Workaround for sources you don't control.

### 4.8 SQL-first vs Python-first transforms

Default to SQL (dbt). Reach for Python when:

- The transform is genuinely procedural (recursive parsing, complex string ops, bespoke parsing libraries)
- You need ML inference inline (run a model on each row)
- You're calling out to an LLM for classification/extraction

dbt now supports Python models on Snowflake/BigQuery/Databricks. They run as warehouse-native Python (Snowpark, BigQuery's Python UDFs). For DuckDB, drop down to a Python script that runs before/after dbt and writes a table back into DuckDB.

### 4.9 Idempotency and incremental models

Same rule as ingestion: every transform should be safe to re-run. With dbt this comes mostly for free (`dbt run` rebuilds tables; views don't need rebuilding). For incremental models, watch for:

- **Late-arriving data.** A row from yesterday shows up today. Your incremental filter `> max(updated_at)` misses it. Fix with a small lookback window: `> max(updated_at) - interval '3 days'`.
- **Source updates.** If source rows can update, use `merge` strategy (with `unique_key`) not `append`.
- **Reprocessing.** Sometimes you just need to rebuild from scratch. `dbt run --full-refresh` does it.

---

## 5. Orchestration

### 5.1 What an orchestrator does

- Runs workflows (DAGs of tasks) on a schedule or in response to events
- Handles retries, timeouts, dependencies between tasks
- Logs, alerts, and surfaces failures
- Stores state — what ran, when, with what inputs, what came out
- Provides a UI for humans to see what's running and re-run things

### 5.2 The options — short, opinionated comparison

| Tool | Verdict |
|---|---|
| **Airflow** | The 800-pound gorilla. Battle-tested, every cloud has a managed version (MWAA, Cloud Composer, Astronomer). Verbose, opinionated, heavy ops surface (metadata DB, scheduler, workers). DAGs in Python. Overkill for SMB unless the client is already on it. |
| **Prefect** | Modern, Python-first, much less boilerplate than Airflow. Decorate a function with `@flow` and you have a workflow. Free open-source core; paid Cloud for hosted scheduler/UI. Good SMB choice when you outgrow plain Task Scheduler. |
| **Dagster** | Python-first, asset-oriented (think "the table is the unit", not "the task"). Tighter dbt integration than Prefect. Best fit when you're heavily dbt-centric and want lineage from raw → marts in one place. Cloud version available. |
| **Mage** | YAML + Python notebooks. Was a sponsor of the zoomcamp's earlier cohorts. Less momentum recently — Kestra has filled the same niche better. Skip. |
| **Kestra** | YAML-flow orchestrator with a slick UI. Great for clients who want a GUI to see and edit flows. 1000+ plugins. Good middle ground when the team has mixed Python/SQL/devops skills. |
| **Bruin** | Newer all-in-one (ingest + transform + orchestrate + quality + lineage). YAML asset config + SQL/Python assets. Promising for "one tool for the whole pipeline" SMB engagements; less proven than dbt+Prefect combo. Worth tracking. |
| **Windows Task Scheduler / cron** | The honest answer for 80% of SMB pipelines. One job, daily, runs a Python script. No DAG, no UI, no metadata DB. If it works, leave it alone. |

### 5.3 When orchestration is overkill

You don't need an orchestrator if:

- You have ≤ 3 pipelines, each runs on a clean schedule, no inter-pipeline dependencies
- Failures are rare and you're OK seeing them in email/log files
- The team is one or two people who know which scripts run when

You start needing one when:

- You have > 5 pipelines with shared dependencies (pipeline B needs pipeline A's output)
- Different teams own different pipelines and need shared visibility
- Retries, backfills, alerting matter and you're tired of writing them yourself
- You need to backfill historical date ranges easily

**SMB rule:** start with Task Scheduler. Add Prefect or Dagster when (and only when) one of the above triggers fires. Don't pre-emptively bolt on infrastructure you don't yet need.

### 5.4 Orchestration concepts you should know

Even if you're using Task Scheduler, internalise these — they're the language of every other tool:

- **Flow / DAG / Workflow** — a directed acyclic graph of tasks. `extract → transform → load → notify`.
- **Task / Operator / Asset** — a unit of work in the flow.
- **Trigger** — what kicks off a flow. Schedule (cron), event (file dropped, message arrived), manual.
- **Retry policy** — how many times to retry a failed task and with what backoff.
- **Backfill** — re-run a flow for historical date windows.
- **State / metadata** — the orchestrator's record of what ran, when, with what params.
- **Sensor** — a task that polls until a condition is met (file exists, table populated, API returns 200) before downstream tasks run.

---

## 6. Data warehousing — BigQuery flavored, but the concepts apply broadly

### 6.1 BigQuery basics

BigQuery is serverless. You don't provision compute; you submit a query and Google's infrastructure runs it across thousands of slots. Storage is separate from compute and billed separately.

**Two billing models:**
- **On-demand** — pay per TB scanned. Default. Easy to start, can spike if someone runs a stupid query.
- **Slot-based reservations** — pay for a flat amount of dedicated compute. Predictable cost; better at scale.

Watch:
- `SELECT *` — scans every column. Costs more than `SELECT col1, col2`.
- Unbounded queries on partitioned tables — `WHERE date > '2024-01-01'` good; `WHERE customer_id = 5` without a partition filter scans the whole table.
- Cross-region transfers — keep data and queries in the same region.

### 6.2 External tables

Point a BigQuery table at files in GCS without loading them. Useful for:
- Cheap "lake-style" storage with warehouse-style query
- One-off analyses where loading isn't worth it
- Schema evolution where the source files change

```sql
CREATE OR REPLACE EXTERNAL TABLE my_dataset.my_external
OPTIONS (
  format = 'PARQUET',
  uris = ['gs://my-bucket/data/year=2025/*.parquet']
);
```

Query is slower than a managed table (BQ has to read GCS each time) but cost is just the scan + storage in GCS.

### 6.3 Partitioning and clustering

These are the two main ways to keep query costs sane on big tables.

**Partitioning** — split the table by a column value (usually a date). Queries with a `WHERE` on the partition column only scan matching partitions.

```sql
CREATE OR REPLACE TABLE my_dataset.trips
PARTITION BY DATE(pickup_datetime) AS
SELECT * FROM my_dataset.external_trips;
```

Now `WHERE DATE(pickup_datetime) BETWEEN '2024-06-01' AND '2024-06-30'` scans 30 partitions, not the whole table.

**Clustering** — sort the data within each partition by one or more columns (up to 4). Queries that filter or aggregate on the clustering columns get partition-pruning-like benefits within partitions.

```sql
CREATE OR REPLACE TABLE my_dataset.trips
PARTITION BY DATE(pickup_datetime)
CLUSTER BY vendor_id, payment_type AS
SELECT * FROM my_dataset.external_trips;
```

**Rule of thumb:**
- Partition by the column you almost always filter on (usually date).
- Cluster by 1–2 columns frequently used in WHERE / JOIN / GROUP BY.
- Don't over-partition — each partition has overhead. Daily for tables with > 10 GB/day; monthly for smaller.

Same concepts apply in Snowflake (clustering keys), Redshift (sort keys + dist keys), DuckDB (zone maps via parquet partitioning).

### 6.4 Materialized views

Pre-computed query results that BigQuery refreshes incrementally. Good for:
- Common dashboards that hit the same aggregation repeatedly
- Heavy joins that you can pre-join

Cost: storage for the materialized result + compute to refresh it. Watch the trade-off.

### 6.5 Cost control

For SMB BigQuery clients:
- Set up **billing alerts** at $X/day. Don't trust on-demand pricing without guardrails.
- Use **`MAXIMUM BILLING TIER`** on per-query scan limits to prevent runaway queries.
- Educate the team on `--dry-run` (BQ shows estimated bytes scanned before running).
- **Always partition** large tables. Always.
- Consider slot reservations once monthly on-demand spend tops $500–$1k.

---

## 7. Batch processing

### 7.1 Spark fundamentals (so you know what you're declining)

Spark is a distributed compute engine. The pitch: it spreads work across a cluster of machines so you can process datasets too big for one machine.

**Three APIs, in order of how much you'll use them:**

1. **DataFrames** — the SQL-like API. `df.filter(...).groupBy(...).agg(...)`. What everyone uses.
2. **Spark SQL** — write SQL strings against registered DataFrames. Same engine underneath.
3. **RDDs** — Resilient Distributed Datasets, the low-level API. Rarely needed in 2026.

**Key concepts:**

- **Lazy evaluation.** Transformations build a plan; actions (`.collect()`, `.write()`, `.count()`) trigger execution. The optimizer (Catalyst) reorders and combines steps before running.
- **Partitions.** The dataset is split across executors. Number of partitions affects parallelism. Repartition with `.repartition(n)` or `.coalesce(n)`.
- **Shuffles.** Operations that need to move data between partitions (joins, groupBy on non-partition keys). The expensive thing. Shuffles are why a 10-second query becomes a 10-minute query.
- **Driver vs executors.** Driver runs the main program and coordinates; executors do the work. The driver is a single JVM — calling `.collect()` brings all data to it (don't do this on a huge dataset).
- **Cluster managers.** Standalone, YARN, Kubernetes, Dataproc (GCP), EMR (AWS), Databricks. Spark runs on top of any of them.

### 7.2 GroupBy and joins — the two operations to understand

**GroupBy** triggers a shuffle: rows with the same key need to end up on the same executor. Spark hashes the group key and redistributes. For a column with low cardinality on a huge dataset, the shuffle dominates runtime.

**Joins** have multiple strategies:
- **Broadcast hash join** — small table fits in memory; broadcast it to every executor; no shuffle on the big table. Fast. Use when one side is small (< ~100 MB).
- **Sort-merge join** — both tables shuffled by key, sorted, then merged. The default for two large tables.
- **Shuffle hash join** — shuffle, then in-memory hash join. Less common.

You usually let the optimizer pick. Force a broadcast with `broadcast(small_df)` when you know one side is small.

### 7.3 When SMB shouldn't bother with Spark — almost always

Spark exists because data didn't fit on one machine in 2014. In 2026, "one machine" means a 64-core 256GB server you can rent for $4/hour. DuckDB on that machine outperforms Spark on a small cluster for analytics under ~100 GB.

Skip Spark for SMB if:
- Your working set fits in DuckDB on a beefy VM (~99% of SMB cases)
- You don't already have a Spark cluster to reuse
- Your team isn't sized to operate Spark properly

Reach for Spark when:
- Working set is genuinely > 1 TB and you can't push it to BigQuery
- You're already on Databricks for ML reasons and want one engine for both
- The client's data is on a Hadoop ecosystem and migration is out of scope

For most clients, the answer is: parquet on object storage + DuckDB or BigQuery for compute.

### 7.4 Running Spark in the cloud

If you do end up needing it:
- **Dataproc** (GCP) — managed Spark cluster you spin up and down. Good for batch jobs.
- **EMR** (AWS) — same idea on AWS.
- **Databricks** — managed Spark + lakehouse + ML notebooks. The premium option; pricing reflects it.
- **Spark on Kubernetes** — you operate it. Don't, unless you have platform engineers.

---

## 8. Streaming fundamentals

### 8.1 Kafka — the core concepts

Kafka is a distributed message log. Producers append messages; consumers read them. The log is durable, replicated, and consumers can replay from any point.

**Five things to internalise:**

1. **Topic** — a named log. `orders`, `user_events`. Producers write to topics; consumers read from topics.
2. **Partition** — a topic is split into partitions for parallelism. Each partition is an ordered log; ordering is guaranteed within a partition, not across partitions.
3. **Offset** — each message in a partition has an offset (a sequential number). Consumers track their position by offset.
4. **Consumer group** — a set of consumers cooperating to read a topic. Each partition is assigned to exactly one consumer in the group. Add consumers up to the partition count for parallelism.
5. **Producer / consumer / broker** — producer writes, consumer reads, broker is the Kafka server. A cluster has multiple brokers; partitions are replicated across them for durability.

**Key configuration concepts:**
- **Retention** — how long to keep messages. Default 7 days; can be infinite (`-1`) for event-sourcing patterns.
- **Replication factor** — how many brokers store each partition. 3 is standard for production.
- **Acks** — producer setting. `acks=all` means wait for all replicas; safest, slowest. `acks=1` is the common default.
- **Schema Registry** — separate service that stores Avro/Protobuf/JSON schemas for messages, so producers and consumers agree on shape. Confluent's offering is the standard.

**Kafka Streams + ksqlDB** — JVM-based stream processing libraries that run on top of Kafka. Useful if you're already deep in Kafka. For Python shops, Flink is more common.

### 8.2 Redpanda — Kafka-compatible without the JVM

[Redpanda](https://redpanda.com/) is a drop-in Kafka replacement written in C++. Same wire protocol, so any Kafka client library works. Differences:

- No JVM, no ZooKeeper. Single binary, starts in seconds.
- Lower memory footprint, easier ops.
- Same Kafka semantics for the developer.

For new builds where you want Kafka semantics, Redpanda is often a better default, especially in dev/test or single-node deployments. Production-grade managed offerings exist too.

### 8.3 Stream processing — Flink, Kafka Streams, Spark Streaming

Once messages are flowing, you usually want to process them — aggregate, join, enrich, filter — and write results somewhere.

- **Apache Flink** — the gold standard for serious stream processing. True event-time processing, exactly-once semantics, windowing, stateful streams. PyFlink lets you write Flink jobs in Python (the zoomcamp's 2026 streaming workshop uses PyFlink).
- **Kafka Streams** — JVM library that runs in your application process. Lighter than Flink, tightly Kafka-coupled.
- **Spark Streaming / Structured Streaming** — Spark's micro-batch streaming. Good if you're already on Spark; not as flexible as Flink for true streaming.
- **Faust** (Python) — Kafka Streams-style library for Python. Less actively maintained.

### 8.4 When streaming is real vs theatre

**Real streaming use cases (rare in SMB):**
- Fraud detection on transactions (decision must happen in milliseconds)
- IoT/telemetry (millions of events per second from devices)
- Real-time pricing (stock, ride-sharing surge)
- Operational alerting (server going down, machine failing)

**Theatre (most "streaming" requests):**
- "We need real-time dashboards" → usually a 5-minute refresh on a batch pipeline is fine
- "We want streaming because the executives like the word" → batch + a low-latency BI tool gets the same outcome
- "We're streaming because the vendor sells streaming" → it's a batch pipeline pretending

Rule of thumb: if the business decision triggered by the data can wait 15 minutes, you don't need streaming. Use batch with a tight cadence.

When you do need streaming:
- Kafka or Redpanda as the broker
- Flink or Kafka Streams for processing
- Sink to a real-time DB (Postgres for moderate, ClickHouse/Pinot/Druid for high-volume analytics)

For SMB: usually skip. Tight batch (Prefect/Kestra running every 5 minutes) covers 95% of "streaming" requirements at a fraction of the operational cost.

---

## 9. Analytics engineering

### 9.1 What analytics engineering actually is

The role exists because of a gap that opened up around 2015–2018:

- **Cloud warehouses** (BigQuery, Snowflake, Redshift) made storage and compute cheap → load everything, transform later.
- **EL tools** (Fivetran, Stitch, dlt) automated the extract+load steps.
- **SQL-first BI tools** (Looker, Mode) put analysts close to data.

The data engineer was great at infrastructure but not close to the business. The analyst understood the business but wasn't trained as a software engineer. Nobody was bridging "raw data is in the warehouse" with "business user gets a clean dashboard." That's the analytics engineer's job: **bring software-engineering practice — version control, testing, documentation, modularity — to the work that analysts and analytics-savvy data scientists already do.**

In tooling terms, an analytics engineer typically lives in:
- Loaders (Fivetran, dlt)
- Warehouses (BigQuery, Snowflake, DuckDB)
- Modeling (dbt, Dataform)
- BI (Looker, Metabase, Superset, Power BI, Tableau)

For SMB engagements Thomas typically *is* the analytics engineer — there's no separate role.

### 9.2 dbt deeply (recap of section 4 + practical patterns)

Beyond the basics, here's what working with dbt at scale looks like:

- **Naming discipline.** `stg_` for staging, `int_` for intermediate, `fct_` for facts, `dim_` for dimensions. Every model. Every time. This is the cheapest investment you'll make.
- **One source of truth per concept.** If "active customer" is defined once, in one model, you've solved 80% of "the numbers don't match between dashboards" forever.
- **Use dbt-utils.** The `dbt-utils` package has 50+ macros and tests that solve common problems (`dbt_utils.surrogate_key`, `dbt_utils.unique_combination_of_columns`, `dbt_utils.date_spine`). Don't reinvent.
- **Tag and group.** Use `tags:` in model config to tag domain (`finance`, `ops`, `marketing`) and frequency (`daily`, `weekly`). Lets you do `dbt run --select tag:daily`.
- **Document as you go.** `description:` on every model and key column. dbt docs generates a browsable site for free.
- **CI/CD.** Run `dbt build` (build + test) on every PR. Promote to prod only on green.

### 9.3 Dimensional modeling — Kimball still applies

Even with cheap storage and ELT, Kimball's star schema still wins for analytics because business users understand it.

- **Fact tables** — events. `fct_orders`, `fct_trips`, `fct_invoices`. One row per business event. Foreign keys to dimensions, plus measures (numbers you sum/avg).
- **Dimension tables** — entities and attributes. `dim_customer`, `dim_product`, `dim_date`. One row per entity, slowly changing (or snapshot for SCD-2).
- **Star schema** — fact in the middle, dimensions radiating out. Joins are obvious.

Snowflake schema (dimensions joined to other dimensions) — generally avoid. Flatten dimensions for analytics. Storage is cheap.

Kimball's three "areas" map onto the dbt layers neatly:
- **Staging area** = `staging/` (raw landing)
- **Processing area** = `intermediate/` (cleaning + integration)
- **Presentation area** = `marts/` (consumption)

### 9.4 Semantic layers — the AI-over-data piece

A semantic layer codifies business definitions in one place so that downstream tools (BI, AI, APIs) all use the same logic. Three options:

- **dbt Semantic Layer / MetricFlow** — defines metrics in YAML, queryable via API. Tightly integrated with dbt.
- **Cube.dev** — open-source semantic layer with a query API and BI integrations. Tool-agnostic. Strong for exposing semantic data to LLMs.
- **Looker LookML** — proprietary, tied to Looker. Powerful but locked in.

**The AI-over-semantic pattern:**

This is the central pitch from `data-agent.md` and where the platform-side AI value actually shows up:

1. **Layer 1 — Clean data** in DuckDB / warehouse, cleaned by dbt staging.
2. **Layer 2 — Semantic model** — dbt marts + metrics (or Cube) with documented metrics, joins, and filters. Each metric has a name, a description, the SQL, the dimensions it can be cut by.
3. **Layer 3 — AI interface** — LLM agent that, given a user question, picks the right metric and dimensions, calls the semantic layer, gets a clean number back, and explains it.

The key: **the LLM never writes raw SQL against the warehouse.** It calls into the semantic layer. The semantic layer enforces the right joins and filters. The LLM's job is intent translation, not SQL authoring.

This is why dashboards become drill-down tools, not daily-read information sources — the AI handles the daily questions; dashboards exist for when something looks weird and someone wants to dig.

### 9.5 What about Power BI / Tableau / Looker / Metabase / Superset?

dbt and the semantic layer feed any of them. Don't compete with the BI tool the client already has — feed it.

- **Power BI** — common in Microsoft shops. Power Query + DAX is its own modeling layer; ideally you push modeling left into dbt and use Power BI as a thin presentation layer.
- **Tableau** — strong visual exploration. Less opinionated about modeling.
- **Looker** — its LookML *is* the semantic layer. If the client is on Looker, model in LookML and skip Cube.
- **Metabase / Superset** — open-source options. Metabase is friendlier for non-technical users; Superset is more powerful and flexible.

For SMB, **Metabase** is often the right answer — free, runs in Docker, friendly UX, plugs straight into DuckDB / Postgres / BigQuery.

---

## 10. Ops and quality

### 10.1 CI/CD for data

The same discipline as software CI/CD, applied to pipelines:

- **Git for everything** — pipelines, dbt models, infrastructure, dashboards-as-code where possible.
- **PR-based workflow** — branches, code review, no direct commits to main.
- **CI on every PR** — `dbt parse` (syntax), `dbt build` (build + test) against a dev/CI database, schema diff checks (`dbt-checkpoint`, `sqlfluff` for linting).
- **CD on merge** — auto-deploy to prod warehouse on merge to main, run a `dbt run` and `dbt test` against prod.
- **Promotion environments** — dev → staging → prod, each with its own dataset/schema. dbt's `target` config handles this.

Tooling:
- **GitHub Actions / GitLab CI** — pipeline runners. Cheap, integrates with everything.
- **dbt Cloud** — built-in CI/CD with PR-based slim CI (`dbt build --defer --state path/to/manifest.json` only re-runs changed models + their downstream).
- **Datafold** — schema-diff and data-diff on PRs. Tells you what would change in prod if this PR merged. Premium but worth it for serious teams.

For SMB: GitHub Actions + dbt Core + a `prod` and `dev` schema in DuckDB/BigQuery. That's the floor. Move up only if the team grows.

### 10.2 Testing data — beyond dbt tests

dbt tests cover schema-level checks. Beyond that:

- **Great Expectations** — Python library for declarative data validation. More expressive than dbt tests, runs as a separate step. Useful for ingestion-time validation before data even hits dbt.
- **Soda Core / Soda Cloud** — declarative data quality checks in YAML, runs against any warehouse.
- **dbt-expectations** — the dbt package that ports Great Expectations–style tests into dbt. Use this first; reach for standalone Great Expectations only if you need Python-level expressiveness.

**Where to test:**
- **Ingestion** — validate raw data on landing. Row counts, schema match, date freshness. Fail loudly if upstream changed.
- **Staging** — type tests, not-null on PKs, accepted-values on enums.
- **Marts** — relationship tests, business-rule singular tests, freshness tests.
- **Pre-deploy in CI** — full test suite on every PR.

**The Six Sigma framing** — apply DMAIC to data quality:
- **Define** — what is "good data" for this metric?
- **Measure** — what's the current error rate / null rate / freshness?
- **Analyze** — where do errors come from (source, transform, presentation)?
- **Improve** — fix at source, add tests, add validation steps.
- **Control** — monitoring + alerts so you catch regression early.

This is exactly the discipline most data teams skip. It's also the cheapest and highest-leverage thing you can sell.

### 10.3 Observability — Monte Carlo, dbt Cloud, custom

Data observability = freshness + volume + schema + distribution + lineage, monitored continuously with alerting.

- **Monte Carlo** — premium, full coverage, expensive. For mid-market and up.
- **dbt Cloud** — has built-in run history, alerting, slim observability. Often enough for SMB.
- **Bigeye, Anomalo, Sifflet** — alternatives in the same space.
- **Custom** — for SMB, a few `dbt source freshness` checks + Slack/email alerts on test failure cover 90% of needs at zero cost.

### 10.4 Lineage — OpenLineage, Marquez, dbt docs

Lineage = "where did this column come from, and what depends on it?"

- **dbt docs** — auto-generated lineage graph for dbt models. Free. Often enough.
- **OpenLineage** — open standard for emitting lineage events from any tool. Bruin emits it natively; Airflow has a provider; Spark has integrations.
- **Marquez** — open-source backend for OpenLineage. Stores and visualises events.
- **DataHub, Atlan, Collibra** — enterprise data catalogs with lineage. Paid; for organisations that need formal data governance.

For SMB: dbt docs is the answer. Generate it as part of CI, host the static site somewhere.

### 10.5 Logging and alerting

Boring but matters:

- **Every pipeline run logs** — start time, end time, row counts, status. Even a CSV file works. You'll thank yourself the first time a stakeholder asks "is this number right?"
- **Failures alert** — Slack webhook or email. Don't make people log into a dashboard to find out something broke.
- **Cost monitoring** — set billing alerts on cloud accounts. The single most common SMB cloud-data disaster is a runaway query nobody noticed.

---

## 11. Cost and sizing for SMB engagements

### 11.1 The tier-2 platform build ($20k–$50k)

What "right" looks like for a typical small/medium business:

**Stack:**
- **Storage / warehouse:** DuckDB (or BigQuery if client is GCP-native and demands managed)
- **Ingestion:** Python + dlt where the source is awkward; plain Python where it's simple
- **Transformation:** dbt Core
- **Orchestration:** Windows Task Scheduler or Prefect, depending on complexity
- **BI / interface:** Metabase (free) or Power BI (if they have it) + a custom AI agent for natural-language queries
- **Hosting:** client's existing infrastructure or a $20–$100/month VM
- **CI/CD:** GitHub Actions
- **Source control:** GitHub or GitLab

**Build effort (Thomas-scale):**
- 6–12 weeks
- Source integration: 1–3 weeks per source
- Modeling (staging + marts): 1–2 weeks
- AI interface + semantic layer: 1–2 weeks
- Dashboards (5 or so): 1 week
- Training and handover: 1 week

**Ongoing:**
- Hosting: $20–$200/month depending on cloud usage
- Maintenance retainer: optional, by hour or fixed monthly

### 11.2 When to scale up

Move beyond tier 2 (toward $100k+) when:

- 5+ source systems with complex dependencies
- Strict security (VPC, SSO, audit logs, SOC2-aligned)
- Multiple concurrent users with separate access scopes
- > 1 TB of working data
- The team has 2+ data people and needs dev/staging/prod separation
- Compliance reporting (financial, healthcare, government)

At that point: BigQuery or Snowflake instead of DuckDB, Prefect Cloud or dbt Cloud or Dagster Cloud for managed orchestration, more rigorous CI/CD, observability tooling, dedicated cloud infrastructure.

### 11.3 Anti-patterns — what not to sell to SMB

- **Snowflake for 5 GB of data.** A $40k/year warehouse for what DuckDB does in 50 MB of RAM. Just don't.
- **Airflow for 3 daily jobs.** Two months of setup for what Task Scheduler does in 5 minutes.
- **Kubernetes for one cron job.** You're billing the client for ops time you didn't need to spend.
- **Custom data catalog before they have 10 datasets.** Use dbt docs.
- **Streaming for a daily report.** It's not faster, it's just more expensive.
- **Real-time dashboards nobody looks at.** Decision-driven analytics, not vanity metrics.
- **40 dashboards in Power BI.** Replace with 5 good ones plus an AI agent over the semantic layer.
- **Spark when DuckDB would do it.** Almost always under 100 GB.
- **Separate ingestion + transform + orchestration tools when one tool does it.** Bruin, dlt+dbt, or Prefect+dbt is fine for SMB.

### 11.4 The pitch

The line worth repeating:

> Two years ago, setting up a proper data platform needed five to ten engineers for a year — easily a million dollars. Nowadays, for a small or medium business, we can deliver the same capability for around 5% of that — $20,000 to $50,000 for a solid platform with an AI interface on top. Price scales with data volume and integration complexity, but the old cost floor has collapsed.

The reason it's collapsed:
- **DuckDB** replaced a six-figure warehouse install
- **dbt Core** replaced bespoke ETL
- **dlt** replaced custom API connectors
- **LLM-powered interfaces** replaced 40-dashboard Power BI builds
- **Cloud object storage** replaced data centres

The skill that's now expensive isn't the infrastructure. It's knowing what to build and what to skip.

---

## 12. Heuristics and rules of thumb

### 12.1 Things to say to clients (Thomas's voice)

- *"Death by dashboard — we've all seen it. We're not building you 40 dashboards. We're building 5 you'll actually use, plus an AI agent for the questions you don't have a dashboard for yet."*
- *"Get the raw data right first. Everything downstream is leverage on whether layer one is correct. If the bronze layer is wrong, the AI is just lying faster."*
- *"You don't need Snowflake. You don't need Airflow. You don't need Kubernetes. Realistically, what you need is clean data, a model that knows how things relate, and an interface people will actually use."*
- *"Streaming sounds great until you cost it. Most of the time, every five minutes is plenty — and that's a much cheaper system."*
- *"We can sort that — but let me push back on whether you need it first."*

### 12.2 Common mistakes (and how to avoid them)

- **Skipping data validation at ingestion.** Catch errors at the source. Don't let bad data propagate three layers down before someone notices.
- **One giant model that does everything.** Break it up. Staging → intermediate → marts. Each model does one thing.
- **Hardcoding business logic in dashboards.** That logic belongs in dbt. Dashboards should query, not transform.
- **Not testing primary keys.** `unique` + `not_null` on every PK. Always.
- **Treating dev and prod the same.** Use separate datasets/schemas. Promote with PRs.
- **Ignoring schema drift.** Source adds a column? Your pipeline should either handle it or alert. Silent drops are the worst kind of failure.
- **Building a data warehouse without talking to users.** The hardest part of analytics engineering isn't SQL. It's understanding what the business actually needs to know.
- **Optimising before measuring.** Don't tune queries that aren't slow. Don't partition tables that aren't big.
- **Over-engineering the orchestration.** If Task Scheduler works, leave it.

### 12.3 Six Sigma framing for data quality

- **Defects per million opportunities (DPMO)** — the data equivalent: rows-with-issues per million rows. Track it. Drive it down.
- **DMAIC** — Define, Measure, Analyze, Improve, Control. Every data quality fix should follow this cycle, not be a one-off patch.
- **Pareto** — 80% of data issues come from 20% of the sources. Find them. Fix the worst ones first.
- **Fishbone (Ishikawa)** — for complex data quality investigations: cause categories typically include source system, transformation logic, schema mismatch, business rule changes, human error in upstream input.
- **Control charts on data freshness and row counts** — early warning that something's drifting before it breaks.
- **5-why** — when something's wrong, don't stop at the first cause. Why was the row null? Because the API returned null. Why? Because the auth token expired. Why? Because we don't rotate it. Why? Because there's no test for it. Now you know what to fix.

### 12.4 Decision shortcuts

- **Working set < 10 GB?** DuckDB. Done.
- **Need a warehouse with multi-user, governance, audit?** BigQuery. Snowflake only if budget supports it.
- **Need to query files in object storage with SQL semantics?** DuckDB or Iceberg + Trino.
- **Pipeline is one daily job?** Task Scheduler.
- **Pipeline is 5+ jobs with dependencies?** Prefect or Dagster.
- **Pipeline has streaming requirements?** First check if "every 5 minutes batch" is enough. It usually is. If not, Kafka/Redpanda + Flink.
- **Need transforms?** dbt. Always start with dbt.
- **Need an AI interface?** Semantic layer first (dbt marts + Cube or MetricFlow), then LLM agent on top.
- **Need ingestion from a REST API?** dlt.
- **Need ingestion from a CSV in a folder?** 30 lines of pandas.
- **Client wants real-time dashboards?** First ask: what decision will be made faster because of real-time? Often the answer is none. Push them to tight batch instead.

### 12.5 The two questions to ask any new client

1. **"Where's your data right now, and how does it move between systems?"** — gives you the source landscape, the integration count, the current pain.
2. **"What's the question you're trying to answer that your spreadsheets can't?"** — gives you the actual goal. Everything else is in service of this.

If the answer to (2) is fuzzy, slow down. Don't build a platform for "general analytics" — build it for the question. The platform's value is whether it answers the question better/faster/cheaper than the status quo. Generic platforms with no question behind them turn into dashboard graveyards.

---

## License & sources

**Source material:** [DataTalksClub data-engineering-zoomcamp](https://github.com/DataTalksClub/data-engineering-zoomcamp), modules 1–7 plus the 2026 dlt workshop. Maintained by DataTalks.Club; created and led by Alexey Grigorev with co-instructors Michael Shoemaker, Will Russell, Anna Geller, Juan Manuel Perafan, and Arsalan Noorafkan.

**License verdict:** The repository does not include a `LICENSE` file in its root or other discoverable locations as of the clone date (2026-04). License is therefore **unclear**. As a precaution, **all content in this document has been paraphrased and distilled in our own words** — there are no copy-pasted blocks of more than incidental length from the source material. Code snippets shown (dbt config, BigQuery DDL, etc.) are either standard idiomatic patterns common across the ecosystem or simplified illustrations, not lifted verbatim.

**If/when the upstream repo clarifies its license** (e.g., adds an MIT or CC-BY notice), this footer should be updated with proper attribution and the document can incorporate verbatim material per the licence terms.

**Other influences:**
- Kimball & Ross, *The Data Warehouse Toolkit* — for the dimensional modeling concepts (fact/dimension/star schema).
- The "three-layer architecture" framing throughout this document is Thomas's, expressed in `data-agent.md` (lines 33–66) and is the canonical framing for client-facing pitches.
- Tooling-specific concepts (dbt, dlt, BigQuery, Spark, Kafka, Iceberg, Cube) are sourced from each project's public documentation and the zoomcamp's distilled treatment of them.

**Maintenance note:** The data engineering ecosystem moves fast. This document reflects the state of the field as of the 2026 zoomcamp cohort. Material likely to drift first: dbt features (unit tests, model contracts), dlt patterns (MCP integrations), and the orchestration landscape (Bruin, Kestra are newer entrants worth tracking).
