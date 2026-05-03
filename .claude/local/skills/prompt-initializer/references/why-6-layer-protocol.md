# Why This 6-Layer Protocol?

Rationale for each layer. Read this when onboarding a new team member, justifying the skill's overhead, or debugging unexpected behavior in context injection.

---

## 1. Language Server Hovering (LSP Protocol)

Modern IDEs hover over identifiers to show their type, signature, and documentation before you ever write a call. This layer replicates that: before suggesting any code, the skill forces resolution of every unknown identifier against `.claude/local/context/`.

Without it, the model will hallucinate method signatures that don't exist, reference tables that are in a different DB connection, or assume enum values that were renamed 3 months ago. The context files are ground truth; "hovering" before writing is how you prevent code that compiles but does the wrong thing.

## 2. Instance-Based Sampling (Semantic Understanding)

Schema docs tell you column names and types. They don't tell you that `status = '999'` means deleted, that 41% of open tickets are `'Aguardando Atendimento'`, or that `uv` values range from 0-12 and never exceed 15.

Real data rows teach value distributions. When you inject 10-15 actual rows, the model builds the right filtering predicates, handles NULLs where they actually appear, and avoids off-by-one logic on numeric ranges. Without samples, the model guesses at cardinality and often guesses wrong.

## 3. Schema Pruning (Pure Fine-Tuning)

Injecting the full `ai_context_master.md` (5000+ tokens) into every task is wasteful and actively harmful: the model's attention distributes across all schemas equally, reducing focus on the task-relevant tables.

Pruning to only the affected tables (typically 2-4) reduces context by ~60% while preserving all precision needed. The model sees `chamados_geral` → `instalacao` FK, not the entire energy schema distracting from the ticket logic. Token savings compound across every task in a session.

## 4. Guardrails & Isolation (Security + Correctness)

Three failure modes this layer prevents:

**Race conditions** — Without atomic WHERE guards on state transitions (`UPDATE ... WHERE status = 'em_andamento'`), two concurrent workers can both "win" a status check and apply conflicting updates. The pattern is cheap insurance.

**Multi-tenant leaks** — Without automatic `tenant_id` injection, a query that returns one tenant's data for another is a silent correctness bug that only surfaces in production.

**Cross-DB JOINs** — Eloquent `mysql` and `mysql_dados` are separate connections. A JOIN across them produces a confusing "Table not found" error. Explicit boundary warnings at prompt time catch this before any code is written.

## 5. ReAct Self-Reflection (Meta-Reasoning)

The six layers above produce high-quality context. But the model still has to bind that context to the task. Self-reflection is the validation step: after assembling the prompt, the skill checks that every identifier referenced has a definition in context, every FK is documented, every guardrail is applied.

If reflection fails, the skill stops and adds a clarifying note instead of proceeding with an assumption. This is the "measure twice, cut once" principle applied to prompt generation.

## 6. Integridade de Fluxo (Integrity of Flow)

Without an enforced gate, tasks drift into implementation before context is loaded. The developer (or agent) starts coding before understanding the data model, discovers a constraint 200 lines in, and has to backtrack.

The Integrity of Flow constraint makes the `.prompt.md` file the mandatory starting artifact. No code is suggested until the file exists AND the 6-layer validation has passed. This creates a natural checkpoint that prevents rushed, under-informed implementations.

---

## Benefits Summary

| Layer | Primary Benefit | Secondary Benefit |
|-------|-----------------|-------------------|
| 1 — LSP Hovering | Zero undefined references | Catches naming variations early |
| 2 — Instance Sampling | Accurate filter/aggregation logic | Handles NULLs correctly |
| 3 — Schema Pruning | 60% token reduction | Increased model focus |
| 4 — Guardrails | Race condition immunity | Multi-tenant leak prevention |
| 5 — ReAct Reflection | Dependency gap detection | Prevents "looks right" mistakes |
| 6 — Integrity of Flow | Architecture-first enforcement | Reproducible, consistent prompts |
