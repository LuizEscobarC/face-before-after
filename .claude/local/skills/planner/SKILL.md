---
name: planner
description: "Decomposes a task into steps, selects the right skills, and orchestrates execution order. Use when the user says 'plan this task', 'what skills should I use for X', 'how do I approach this', or when a task involves multiple steps or multiple modules. Also invoke automatically before any complex implementation that touches 3+ files or 2+ layers."
---

## When to use

- User says "plan this task", "break this down", "what's the approach"
- Task touches multiple modules or layers simultaneously
- Task has unclear scope or ambiguous requirements
- Before implementing anything with 3+ interdependent files

## Instructions

### Step 1 — Understand the task

Read the task description carefully. Extract:
- **Goal:** What is the end state?
- **Module(s):** Which modules are affected? (`app/Modules/[Module]/`)
- **Layers:** Which layers need changes? (Controller / Service / Repository / Resource / Request / Route)
- **DB connections:** `mysql` (API data) or `mysql_dados` (measurements)?
- **Side effects:** Does it affect context docs, Postman collection, tests?

### Step 2 — Load relevant context

Always read before planning:
1. `.claude/local/context/ai_context_master.md` — table schemas, model relationships
2. `.claude/local/context/modules/[module]/00-index.md` — business rules index
3. Specific sub-docs if the task involves calculations, data sources, or warnings

### Step 3 — Select skills

Map each part of the task to the appropriate skill:

| Task type | Skill to invoke |
|-----------|----------------|
| New endpoint | `laravel-feature-implementer` |
| New module | `neo-module-architect` → `laravel-feature-implementer` |
| Bug investigation | `laravel-bug-diagnostician` |
| Energy report bug | `energy-report-bug-diagnostician` |
| Write tests | `phpunit-test-writer` |
| Verify with curl (obrigatório se houver endpoint) | `integration-prober` |
| Update docs | `domain-context-updater` |
| New module docs | `register-domain` |
| Extract business rules | `laravel-business-rules-context` |
| Generate Postman | `generate-postman` → `api-doc-generator` |
| Lume endpoint | `laravel-feature-implementer` → `lume-endpoint-finisher` |
| Math validation | `math-proof` |

### Step 4 — Order execution

Always follow this order:
1. `clear-cache` (always first)
2. Context loading (task-context-loader / read domain docs)
3. Business rules extraction if touching existing repository
4. Implementation (laravel-feature-implementer or neo-module-architect)
5. Tests (phpunit-test-writer)
6. Format: `run_pint` tool
7. Verification (`integration-prober` — OBRIGATÓRIO se qualquer endpoint foi tocado, independente do tipo da task)
8. Documentation update (domain-context-updater or register-domain)
9. Postman + API doc (generate-postman → api-doc-generator)

### Step 5 — Output the plan

Present the decomposed plan to the user as a numbered list with:
- Which skill handles each step
- Any decision points that need user input (e.g. DDD vs simple structure)
- What files will be created/modified
- How to verify success

## Examples

**Input:** "Add a filter by date range to the water consumption endpoint"

**Output plan:**
1. `clear-cache`
2. Read `.claude/local/context/modules/water/00-index.md`
3. `laravel-business-rules-context` — extract existing WaterConsumptionRepository rules
4. `laravel-feature-implementer` — add `start_date`/`end_date` params to Form Request + Repository
5. `phpunit-test-writer` — add test cases for date range filtering
6. `run_pint`
7. `domain-context-updater` — update water/02-data-sources.md
8. `generate-postman` → `api-doc-generator`

Files affected: `WaterConsumptionRequest.php`, `WaterConsumptionRepository.php`, `WaterConsumptionService.php` (pass params), test file.
