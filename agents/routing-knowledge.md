# Routing knowledge — file & email categorisation

This document teaches the categorisation agent about Thomas's specific projects, properties, and conventions. Both `agents/file-triage.js` and `agents/flows/email-flow.js` load this file and inject it into the LLM prompt.

**Maintainer note:** add new project / property / contractor as they come up. Keep entries short, factual, and specific. The model will use them verbatim.

---

## VEU application work-stream — high frequency

Thomas runs **Unwind AI GoGreen** — a Victorian Energy Upgrades (VEU) accredited business. The accreditation application is an active work-stream. Anything that's part of the **VEU APPLICATION** goes to:

**`UnwyndAI/veu/veu_application`**

Files that belong here include:
- VEU Job Packs (heat pump, split system, etc.) — e.g. `UNWIND_AI_VEU_Job_Pack_HeatPump_SplitSystem_v2.docx`
- VEU Contractor Agreements (e.g. `UNWIND_AI_VEU_Contractor_Agreement_*.docx`)
- VEU Contractor Onboarding Checklists (e.g. `UNWIND_AI_Contractor_Onboarding_Checklist_*.docx`)
- Process Documentation (`Process Documentation.docx`)
- Compliance and Audit documents (`Compliance_and_Audit.docx`)
- Activity 45 / VEEC assignment forms (`Activity 45 VEEC assignment forms*.docx`)
- Statement of Qualifications and Experience
- Responses to questions / "~$sponses to questions" (Thomas was answering VEU questions)
- VEU Accreditation Certificate
- CPPHES4005 home energy assessment course material (this is the qualification course Thomas did for VEU)
- Anything with "VEU", "VEEC", "Activity 45", or "Home Energy Rating"

**Confidence:** route any of the above to `UnwyndAI/veu/veu_application` at ≥ 0.85 even when the filename is generic ("Process Documentation", "Compliance_and_Audit") — these names appear in the VEU application context.

### VEU contractor sub-folders

**`UnwyndAI/veu/contractors/<contractor_name>`** — for contractor-specific docs.

Existing contractors:
- `obrians_electrical` — O'Brians Electrical (referenced as "OBrians" in filenames). Files like `Unwindai_OBrians_Checklist.docx` go here.

When you see a contractor name in a VEU-related filename, route to `UnwyndAI/veu/contractors/<contractor>`.

---

## Investment properties — address-specific subfolders

Thomas owns multiple investment properties. **Property-specific docs (water bills, leases, tax, renovation, tenancy, utility) go into address-specific subfolders.**

| Address subfolder | Property | Filename signals |
|---|---|---|
| `personal/finance/properties/62 Kernan St` | Kernan Street (renovation in progress, quality issues) | "Kernan St", "Kernan Street", any renovation docs about this property |
| `personal/finance/properties/2 Thomas St` | Moonee Ponds — commercial tenancy, AMH Psychology operates from this address | "Moonee Ponds", "2 Thomas St", AMH-tenancy-related leases |
| `personal/finance/properties/Birkenweg 34` | German property in Zolling, Bavaria | German-language property docs, "Zolling", "Grundsteuer" (property tax), "Wasser" (water), "Geräteservice" (equipment service), "Gesamtabrechnung" (annual settlement), "VGEM" |

**Rule of thumb for property docs:**
- German property docs (any of: Zolling, Grundsteuer, Wasser, Gesamtabrechnung, Geräteservice, VGEM) → `Birkenweg 34`
- Kernan Street docs (renovation, quality issues, plans) → `62 Kernan St`
- Moonee Ponds / commercial-tenancy / AMH-as-tenant docs → `2 Thomas St`

For utility bills (water, electricity, gas) where the **address is not in the filename**: the agent must inspect content to determine the address. If only a filename is available and it's ambiguous (e.g. `GWW Water Bill.pdf`), route to `personal/finance/properties` (parent) at confidence ~0.6 so it falls into manual review.

---

## AMH Psychology — single canonical folder

**`UnwyndAI/amh/accounting`** — CANONICAL. Use this for **all** AMH financial / accounting docs.

`UnwyndAI/AMH Psychology` is **DEPRECATED** — do NOT route to this folder. It will be migrated.

AMH BAS PDFs, receivables CSVs, spending CSVs, invoicing, accounting reports — **all go to `UnwyndAI/amh/accounting`**, regardless of how the filename refers to the business ("AMH Psych", "amh_psyc", "AMH Psychology", etc.).

---

## Plascorp data investigation (6STEP client)

Plascorp is a 6STEP client for whom Thomas runs a data pipeline. Files relating to investigation of Plascorp's payroll, employee data, or labour hours go to:

**`UnwyndAI/6STEP/plascorp`**

Filename signals:
- "Payroll Payment mapping"
- "Direct Indirect Employee by State"
- Anything mentioning Plascorp labour hours, payroll mapping, employee state breakdowns
- Office lock-file variants (`~$Payroll Payment mapping.xlsx`) → same routing as parent

---

## Proposals

Partnership / business proposals go to **`UnwyndAI/proposals/<topic>`**.

Existing topic subfolders:
- `UnwyndAI/proposals/low_code_platform` — Low-Code Platform partnership proposal

When a filename contains "Proposal" + a topic (e.g. "Low-Code Platform — Partnership Proposal.md"), route to the matching topic subfolder. If no topic subfolder exists yet, suggest one via `suggest_new_folder` (e.g. `proposals/<inferred_topic>`).

---

## Phone / utility bills (Unwind AI as billed entity)

Phone bills (Optus, Telstra, etc.) and other utility bills issued to **Unwind AI** as the billed entity → **`UnwyndAI/admin/Accounting`**.

Note the case-sensitive folder name: `Accounting` (capital A).

A filename like `my-bill.pdf` is too generic on its own — but if the content (or sender, for emails) reveals it's an Optus / Telstra / utility bill addressed to Unwind AI, route here at high confidence.

---

## Personal identity documents

Government IDs and personal certificates → **`personal/passport_licenses`**.

Includes: drivers license (any country), Medicare card, passport (any country), birth certificate.

---

## German tax / property documents

- If property-related (water, Grundsteuer, equipment service, annual settlement) → matching property subfolder under `personal/finance/properties/<address>`
- If purely income/tax (no property attached) → `personal/finance/tax`

---

## Things to leave UNCATEGORISED (do not try harder)

These should always route to `uncategorised` with low confidence — Thomas prefers them in the review folder over getting misfiled:

- **Software installers**: `.exe`, `.msi`, `.dmg`, `.winmd`, `.iso`, `.crdownload`, `.part` — Thomas can re-download. Installers older than 30 days can be deleted.
- **Generic data dumps**: `CSVData.csv`, `CSVData (1).csv`, `survey_summary.xlsx` (no project context)
- **Obfuscated filenames**: long digit strings (e.g. `333133333839313036353.pdf`)
- **Vague titles** without strong context: `report.pdf`, `Responses to questions.docx` (UNLESS the routing knowledge above tells you they belong to a specific work-stream — e.g. "Responses to questions" is part of the VEU application)
- **Game launchers**: Rockstar, Steam, etc.
- **Children's toy software**: tiptoi installers (kids' learning toy software)

---

## Confidence calibration

| Confidence | When |
|---|---|
| 0.95+ | Filename explicitly contains a project/address/contractor name from the rules above |
| 0.85–0.94 | Strong contextual match (e.g. "Activity 45" → VEU application; German property terms → Birkenweg 34) |
| 0.75–0.84 | Generic filename but clear category (e.g. AMH BAS without explicit "Psychology") |
| 0.60–0.74 | Plausible match but real ambiguity — routes to manual review |
| < 0.60 | Truly unclear — route to uncategorised |

---

## When extending this file

Add a new section when:
- A new client / project starts (new folder added under UnwyndAI)
- A new property is acquired
- A new contractor is engaged
- A pattern emerges where the model keeps misclassifying a category

Keep entries factual and specific. The model reads this file verbatim every run.
