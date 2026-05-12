# M4_PR58_DiagnosticPriorityService.md — Plano detalhado do PR-58

> **Nota de nomenclatura:** o usuário referenciou o PR como "PR-57", mas o escopo
> (fórmula `(I×S×C×A)×(1−R)×(1−E×0.5)`, persistência em `priority_score_audit`)
> corresponde exatamente ao **PR-58** do
> [`M4_NARRATIVE.md` §2.4](./M4_NARRATIVE.md) — PR-57 é o `RecommendationEngine`
> (matching de triggers), que já está implementado. PR-58 é o passo **a seguir**:
> aplicar a fórmula de priorização sobre os `recommendation_link` que o PR-57
> emitiu, persistir auditoria completa e enforçar regras DEC-38 da escada.
>
> **Modelo recomendado:** Opus (calibração da fórmula, judgment ético em DEC-38).
> **Releia junto com:** [`PLAN_METRICS.md`](../PLAN_METRICS.md),
> [`DDL_REVIEW.md`](../DDL_REVIEW.md) §5.7,
> [`M4_NARRATIVE.md`](./M4_NARRATIVE.md) §2.4 + DEC-34/35/37/38 + §6 armadilhas.
> Criado: 2026-05-11.

---

## 0. Estado atual — o que JÁ existe vs o que falta

| Item | Status |
|------|--------|
| Tabela `recommendation_link` (PR-55) | ✅ EXISTE — migrations `1746000200000`/`230000` |
| Catálogo `recommendation_catalog` com `invasiveness_level`/`evidence_level`/`clinical_pathway_required` (PR-55b) | ✅ EXISTE — migration `1746000230000` |
| 427 recomendações + 8.352 triggers populados (PR-56) | ✅ EXISTE |
| `RecommendationEngine` (PR-57) → emite `recommendation_link` rows com `final_priority_in_session=NULL` | ✅ EXISTE em `recommendation-engine.service.ts` |
| `DiagnosticPriorityService` **arquivo já existe** em [`nest/src/modules/diagnosis/diagnostic-priority.service.ts`](../../../../nest/src/modules/diagnosis/diagnostic-priority.service.ts) | ⚠️ **PARCIAL** — fórmula aplicada + diversity cap (2/cat) + persistência de `final_priority_in_session`/`is_displayed_to_user`. **FALTA:** tabela `priority_score_audit`, gravação da auditoria, integração com `invasiveness_level`, enforcement DEC-38 (top-5 nunca isolado 4b + pelo menos 2 vagas ≤ nível 3), penalidade de qualidade, FKs de rastreio §5.7, testes. |
| Tabela `priority_score_audit` | ❌ **NÃO EXISTE** no Nest — existe apenas em [`.claude/database/ddl.sql`](../../database/ddl.sql) (DDL legado). PR-58 precisa criar migration. |

> **Conclusão:** PR-58 é **incremental**: NÃO reescreve o service, ESTENDE-o.
> Mantém a fórmula atual (já correta) e adiciona auditoria, ladder rules,
> qualidade e testes.

---

## 1. Princípios duros — o que não pode quebrar

### 1.1 Fórmula congelada
$$\text{score} = (I \times S \times C \times A) \times (1 - R) \times (1 - E \times 0.5)$$

| Símbolo | Domínio | Fonte | Mapeamento |
|---------|---------|-------|-----------|
| `I` Impact | [0,1] | `recommendation_catalog.priority_default` ∈ {1..5} | linear `1→0.2 … 5→1.0` |
| `S` Severity | [0,1] | `metric_evaluation_against_ideal.severity5` do trigger **mais grave** | `ideal=0.0, minimal=0.10, mild=0.30, moderate=0.50, strong=0.80, extreme=1.00` |
| `C` Confidence | [0,1] | `metric_evaluation.confidence_final` da avaliação que deu o pior S | passthrough |
| `A` Actionability | [0,1] | `recommendation_catalog.effort_estimate` | `low=1.0, medium=0.6, high=0.3` (inverso do esforço) |
| `R` Risk | [0,1] | `recommendation_catalog.risk_level` | passthrough; **R > 0.7 ⇒ guardrail bloqueante** (DDL §5.7) |
| `E` Effort | [0,1] | `recommendation_catalog.effort_estimate` | `low=0.0, medium=0.5, high=1.0` |

**Travas:**
- Se `A == 0` → guardrail "não solucionável sem profissional" (DDL §5.7 — comentário da coluna A).
  Operacionalmente: forçar `final_score = 0` e marcar `is_displayed_to_user = FALSE`
  exceto se categoria = `professional_referral`.
- Se `R > 0.7` → guardrail bloqueante: força `final_score = 0`, `is_displayed_to_user = FALSE`,
  registra motivo em audit (`suppression_reason = 'high_risk_self_application'`).

### 1.2 Penalidade de qualidade (raw → penalized → final)

O DDL legado distingue 3 scores em `priority_score_audit`:

| Coluna | Definição |
|--------|-----------|
| `raw_score` | `(I·S·C·A) · (1−R) · (1−E·0.5)` puro |
| `penalized_score` | `raw_score · (1 − quality_penalty)` onde `quality_penalty = (1 − photo_quality_score) · 0.3`; nunca > raw |
| `final_score` | igual a `penalized_score` por padrão; pode ser zerado pelos guardrails de A/R/DEC-38 |

`photo_quality_score` vem de `analysis_report.photo_quality_score` (já existe — campo lido por `ReportReaderService`). Cap em 30% de penalidade para não anular recomendações com foto ruim porém severas.

### 1.3 DEC-38 — Escada de invasividade (re-leitura obrigatória)

> Linha vermelha do produto. Quebrar isto é o que causa o caso "usuário recebe
> botox + ortodontia + bucomaxilo no top-5 sem nenhuma rotina do app".

| Regra | Implementação no `prioritize()` |
|-------|---------------------------------|
| **R1.** Sempre tentar o degrau mais baixo primeiro | Pre-sort secundário por `invasiveness_level` **asc** dentro do mesmo bucket de score (Δ ≤ 0.05) |
| **R2.** Max 2 categorias diferentes no top-5 | Conta categorias únicas; se 3ª categoria entra, descarta seu menor-score |
| **R3.** Nível 4b (`professional_referral`) **nunca isolado** | Se o top-5 contém um nível 4b, exigir **≥ 2 vagas** com `invasiveness_level ≤ 3`. Senão, expulsa o 4b para a posição 6+ |
| **R4.** Max 2 recomendações **da mesma categoria** | Já implementado (`MAX_PER_CATEGORY = 2`) — manter |
| **R5.** Nível 4b só dispara se `severity = extreme` **OU** `recommendation_trigger.clinical_pathway_required = TRUE` | Validação após RecommendationEngine: se trigger não satisfaz, suprime o link com `suppression_reason = 'clinical_pathway_not_required'` |
| **R6.** `evidence_level = 'anecdotal'` exige `disclaimer_template` populado | `RecommendationCatalog` já garante via CHECK; service só valida no momento de prep para narrativa |

**Cuidado:** R3 pode causar **loop** se 4 vagas top forem 4b. Solução: depois de aplicar R3, re-aplica R1 sobre as vagas vazias; max 2 iterações.

### 1.4 Auditoria total — RNF-D01

Toda execução grava **uma linha por `recommendation_link`** em `priority_score_audit`. Sem exceção (incluindo links suprimidos por R/A/DEC-38 — `final_score = 0` mas a linha existe).

---

## 2. Backlog do PR-58 — 5 sub-tarefas

### Sub-tarefa **PR-58.1** — Migration `priority_score_audit` (DDL)

Criar `nest/src/database/migrations/1746000290000-M44PriorityScoreAudit.ts`.

**Schema:**

```sql
CREATE TABLE priority_score_audit (
  id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Soft FK ao link (que é soft-FK ao analysis_report partitioned) ─────
  recommendation_link_id              UUID NOT NULL,
  analysis_report_id                  UUID NOT NULL,
  analysis_report_generated_at        TIMESTAMPTZ NOT NULL,

  -- ── Componentes da fórmula (todos em [0,1], NULLABLE se guardrail) ─────
  "I"                                 NUMERIC(6,5),
  "S"                                 NUMERIC(6,5),
  "C"                                 NUMERIC(6,5),
  "A"                                 NUMERIC(6,5),
  "E"                                 NUMERIC(6,5),
  "R"                                 NUMERIC(6,5),

  -- ── Cascata de scores ──────────────────────────────────────────────────
  raw_score                           NUMERIC(8,6) NOT NULL,
  penalized_score                     NUMERIC(8,6) NOT NULL,
  final_score                         NUMERIC(8,6) NOT NULL,
  photo_quality_score_applied         NUMERIC(6,5),  -- valor de quality_penalty usado

  -- ── Rastreio das fontes (DDL_REVIEW §5.7) ──────────────────────────────
  severity_source_against_ideal_id    UUID,   -- qual MEAI deu o S
  confidence_source_evaluation_id     UUID,   -- qual ME deu o C
  risk_source_recommendation_id       TEXT,   -- slug da rec (mesmo que link.recommendation_id, mas explícito)
  invasiveness_level_applied          SMALLINT,  -- snapshot na hora da decisão

  -- ── Diagnóstico das supressões ─────────────────────────────────────────
  suppression_reason                  TEXT,   -- NULL | 'high_risk_self_application' | 'no_actionability' | 'clinical_pathway_not_required' | 'dec38_ladder_isolated_4b' | 'dec38_max_category_exceeded'
  dec38_rank_position                 INT,    -- posição final no ranking (1-based) após DEC-38

  -- ── Metadados ──────────────────────────────────────────────────────────
  scored_at                           TIMESTAMPTZ NOT NULL DEFAULT now(),
  service_version                     TEXT NOT NULL DEFAULT 'pr-58.v1',  -- bump quando fórmula mudar

  -- ── Constraints ────────────────────────────────────────────────────────
  CONSTRAINT chk_psa_raw_ge_penalized   CHECK (raw_score >= penalized_score),
  CONSTRAINT chk_psa_penalized_ge_final CHECK (penalized_score >= final_score),
  CONSTRAINT chk_psa_invasiveness       CHECK (invasiveness_level_applied IS NULL OR invasiveness_level_applied BETWEEN 0 AND 4),
  CONSTRAINT chk_psa_suppression        CHECK (
    suppression_reason IS NULL OR suppression_reason IN (
      'high_risk_self_application',
      'no_actionability',
      'clinical_pathway_not_required',
      'dec38_ladder_isolated_4b',
      'dec38_max_category_exceeded'
    )
  ),
  CONSTRAINT uq_psa_link UNIQUE (recommendation_link_id)
);

CREATE INDEX idx_psa_report
  ON priority_score_audit (analysis_report_id, analysis_report_generated_at);
CREATE INDEX idx_psa_link
  ON priority_score_audit (recommendation_link_id);
CREATE INDEX idx_psa_suppression
  ON priority_score_audit (suppression_reason)
  WHERE suppression_reason IS NOT NULL;

COMMENT ON TABLE priority_score_audit IS
  'Auditoria completa do PriorityScore (PR-58). 1:1 com recommendation_link. Inclui componentes, cascata raw→penalized→final, fontes (DDL_REVIEW §5.7) e diagnóstico de supressão DEC-38.';
```

**Por que não-particionada:** volume baixo (≤500 linhas por report; típico ~50–80). Particionamento é overkill agora; reavalia em PR pós-MVP se rendered_asset/analysis_report rotation precisar.

**Por que UNIQUE em `recommendation_link_id`:** idempotência — re-rodar `prioritize()` faz UPSERT. Service usa `INSERT … ON CONFLICT (recommendation_link_id) DO UPDATE SET …`.

**Arquivos:**
- `nest/src/database/migrations/1746000290000-M44PriorityScoreAudit.ts`
- `nest/src/modules/diagnosis/infrastructure/entities/priority-score-audit.entity.ts` (novo)
- Registrar entity em `DiagnosisModule` (`forFeature([...])`)

**Modelo:** Sonnet (DDL puro). **Esforço:** ~1h.

---

### Sub-tarefa **PR-58.2** — Persistência da auditoria no service

Estender [`diagnostic-priority.service.ts`](../../../../nest/src/modules/diagnosis/diagnostic-priority.service.ts):

1. Injetar `@InjectRepository(PriorityScoreAuditEntity)`.
2. Substituir `(I*S*C*A)*(1-R)*(1-E*0.5)` por **3 etapas**:
   - `raw_score` puro
   - `quality_penalty = (1 − analysisReport.photoQualityScore) × 0.3`
   - `penalized_score = raw_score × (1 − quality_penalty)`
   - `final_score = applyGuardrails(penalized_score, ...)` (zera se R>0.7, A==0 fora de professional_referral, ou DEC-38 suprime)
3. Construir `PriorityScoreAuditEntity` por link com **todos os 6 componentes + 3 scores + 4 FKs de rastreio + suppression_reason + invasiveness_level_applied**.
4. Persistir em **batch** via `linkRepo.manager.transaction(async (txn) => { await txn.upsert(PriorityScoreAuditEntity, rows, ['recommendationLinkId']); await txn.save(updatedLinks); })`.

**Mudança de assinatura:**

```ts
async prioritize(
  analysisReportId: string,
  analysisReportGeneratedAt: Date,
  photoQualityScore: number,   // ← NOVO param (read from analysis_report by caller)
): Promise<RecommendationMatch[]>
```

**Caller update:** `NarrativeService` (PR-59) ou `RecommendationEngine` integration point — passa o `photo_quality_score` do `analysis_report` carregado.

**Modelo:** Sonnet. **Esforço:** ~3h.

---

### Sub-tarefa **PR-58.3** — Integração com `invasiveness_level` + DEC-38 ladder

Refatorar a função de ranking (passos 7–9 do service atual) em uma função pura testável:

```ts
function rankWithDec38Ladder(scored: ScoredLink[]): {
  ranked: ScoredLink[];                       // ordem final 1..N
  suppressions: Map<string, SuppressionReason>; // link_id → reason
}
```

**Algoritmo:**

1. Sort primário: `score desc`.
2. Sort secundário (tie-break Δ ≤ 0.05): `invasiveness_level asc`.
3. Greedy fill top-5 respeitando R4 (max 2 / category) — já existe.
4. **Pós-check DEC-38**:
   - Conta `level4b = top5.filter(s => s.catalog.invasivenessLevel === 4 && s.catalog.category === 'professional_referral').length`.
   - `level_le_3 = top5.filter(s => s.catalog.invasivenessLevel <= 3).length`.
   - Se `level4b > 0 && level_le_3 < 2`:
     - Marca o(s) 4b com `suppression_reason = 'dec38_ladder_isolated_4b'`, joga para posição 6+.
     - Re-greedy fill com candidatos restantes (passo 1).
     - Max 2 iterações; se ainda falha, deixa top-5 incompleto (4 itens) — log warning.
5. **Pós-check R5** (verifica trigger `clinical_pathway_required` para nível 4b): se trigger não satisfaz, suprime já no passo 1 (entrada).

**Diversidade ampliada (DEC-38 R2):** max 2 **categorias** diferentes no top-5 (mais restritivo que R4 atual). Adicionar contagem de categorias únicas; rejeitar 3ª categoria mesmo se 1ª aparição.

**⚠️ Cuidado:** PR-56 popula 8 categorias. Com R2+R4 simultâneas, top-5 vira fortemente concentrado em 2 categorias dominantes. Validar com fixture de regressão (subtarefa 4) que isso é o comportamento desejado.

**Decisão de produto que precisa travar (DEC-41 nova):**

> Quando R2 e R4 conflitam (ex: 3 exercícios todos bons), aplica **R4 primeiro** (deixa 2 exercises), depois **R2** (preenche restante das 3 vagas com ≤ 2 categorias adicionais). Documentar em DEC-41 no M4_NARRATIVE.

**Modelo:** Opus (judgment ético). **Esforço:** ~4h (incluindo desenho dos fixtures).

---

### Sub-tarefa **PR-58.4** — Testes Vitest

Criar `diagnostic-priority.service.spec.ts` com **9 grupos de teste** (≈25 testes):

| # | Grupo | Cenário |
|---|-------|---------|
| 1 | Fórmula | Caso canônico: `I=1, S=1, C=1, A=1, R=0, E=0` → score = 1.0 |
| 2 | Fórmula | `R = 0.5` → score = 0.5 × (1−E×0.5) |
| 3 | Fórmula | `E = 1.0` → score multiplicado por 0.5 |
| 4 | Severity | Pega worst S de 3 trigger metrics (mild/moderate/strong) → usa strong |
| 5 | Quality | `photo_quality_score=0.5` → penalty=0.15, penalized = 0.85·raw |
| 6 | Guardrail R | `risk_level=0.8` → final_score=0, suppression='high_risk_self_application' |
| 7 | Guardrail A | `effort=high, category=lifestyle` → A=0.3 (passa); `category=professional_referral` ignora guardrail A |
| 8 | DEC-38 R3 | top-5 com 1 single 4b + 4 outros → 4b mantido se ≥2 vagas ≤ nível 3 |
| 9 | DEC-38 R3 | top-5 com 4b isolado (sem 2 vagas ≤3) → 4b suprimido para pos 6, hole preenchido |
| 10 | DEC-38 R2 | Mix de 5 categorias com scores próximos → top-5 fica com 2 categorias |
| 11 | DEC-38 R4 | 3 lifestyle todos bons → só 2 entram no top-5 |
| 12 | DEC-38 R5 | Trigger sem `clinical_pathway_required` para 4b → suprime na entrada |
| 13 | Idempotência | Rodar `prioritize` 2x → mesma saída, UPSERT em audit não duplica |
| 14 | Audit completude | Após `prioritize`, `count(priority_score_audit) === count(recommendation_link)` para o report |
| 15 | Tie-break | 2 links com score igual → mais baixo `invasiveness_level` ganha |

**Mock approach:** TypeORM mock repos via `@Repository` mocks (mesmo padrão de `template-renderer.service.spec.ts`). Não precisa DB real.

**Modelo:** Sonnet. **Esforço:** ~5h.

---

### Sub-tarefa **PR-58.5** — Integration com `NarrativeService` (PR-59)

PR-58 não é completo até o caller passar `photo_quality_score`. Stub mínimo:

```ts
// narrative.service.ts
const report = await this.reportReader.getReportById(reportId);
await this.priorityService.prioritize(
  report.id,
  report.generatedAt,
  report.photoQualityScore ?? 1.0,  // fallback safe se NULL
);
```

`NarrativeService` é o trigger de PR-59 separado, mas o **wiring** é parte de PR-58 (1 linha de change).

**Modelo:** Sonnet. **Esforço:** ~30min.

---

## 3. Ordem de execução em paralelo (multi-agent)

Para maximizar throughput SEM perder qualidade:

```
┌─ Sonnet agent A (paralelo)
│  └─ PR-58.1 Migration + Entity
│  └─ Output: migration file + entity + module wire-up
│
├─ Sonnet agent B (paralelo)
│  └─ PR-58.4 Test scaffold (mocks + fixtures, ainda sem service final)
│  └─ Output: .spec.ts esqueleto com 25 it() vazios + fixtures
│
└─ Opus agent C (sequencial, após A) ← TASK PRINCIPAL DESTE PR
   └─ PR-58.2 + PR-58.3 (modifica service + ladder algorithm)
   └─ Output: diagnostic-priority.service.ts atualizado
   └─ Requer: entity de A
   └─ Bloqueia: B para preencher os it() reais
```

**Phase 2 (após Opus C terminar):**

```
└─ Sonnet agent B (resume)
   └─ Preenche assertions reais nos 25 it()
   └─ Roda npm test, ajusta até verde
   └─ PR-58.5 wiring em NarrativeService (1 linha)
```

**Estimativa wall-clock:** A+B+C ≈ max(1h, 2h, 7h) = **~7h** vs serial ~13.5h. Ganho ~48%.

---

## 4. Decisões a travar antes de começar

| ID | Decisão | Default sugerido |
|----|---------|------------------|
| **DEC-41** | Conflito R2 (max 2 cat) × R4 (max 2/cat) | Aplica R4 primeiro, R2 depois (compatível com fixtures atuais) |
| **DEC-42** | Penalidade de qualidade — coeficiente | `0.3` cap (igual ao DDL legado §5.7). Documenta como hyperparam em `service_version='pr-58.v1'` |
| **DEC-43** | `priority_score_audit` particionada? | **Não** (volume baixo). Reavaliar em PR pós-MVP. |
| **DEC-44** | Onde lê `photo_quality_score`? | `NarrativeService` carrega `analysis_report` e passa como param. Service de priority é puro/stateless. |
| **DEC-45** | Comportamento quando NarrativeService chama priority sem links (RecommendationEngine não rodou) | Retorna `[]`, log warn (já implementado). Não invoca engine implicitamente. |
| **DEC-46** | Threshold do tie-break por invasiveness | `Δ ≤ 0.05` em score. Justificativa: cap em 5% de diferença ainda é "essencialmente empatado" considerando ruído de C (confidence). |

---

## 5. Critérios de saída

- [ ] PR-58.1 migration aplicada em DB local + reverter via `down()` validado.
- [ ] PR-58.2 service grava 1 linha de `priority_score_audit` por `recommendation_link`.
- [ ] PR-58.3 algoritmo DEC-38 passa todos os 6 testes do grupo "DEC-38".
- [ ] PR-58.4 ≥25 testes Vitest todos verdes (`npm test` clean).
- [ ] PR-58.5 NarrativeService wiring com fallback safe.
- [ ] Em ≥3 reports reais distintos (de `resultado_api/`), inspecionado manualmente:
  - audit table tem 1 row por link
  - nenhum top-5 viola DEC-38
  - nenhuma supressão silenciosa (toda supressão tem `suppression_reason`)
- [ ] DEC-41..DEC-46 documentadas em [`M4_NARRATIVE.md`](./M4_NARRATIVE.md) §3.

---

## 6. Armadilhas (releitura forçada antes de codar)

1. **Esquecer de salvar o link suprimido em audit.** Audit DEVE ter linha mesmo para links com `final_score=0`. RNF-D01 quebra senão.
2. **Aplicar quality penalty antes de raw_score.** Inverte semântica do DDL. `raw` é puro, `penalized` é `raw × (1−q)`, `final` é `penalized` com guardrails.
3. **DEC-38 R3 em loop infinito.** Sem cap de 2 iterações, top-5 pode oscilar quando todos os candidatos restantes também são 4b. Solução: cap + warning + top-5 incompleto.
4. **`prioritize()` mexer em links de OUTRO report.** `where: { analysisReportId, analysisReportGeneratedAt }` é obrigatório no load e no save.
5. **Race condition em re-run.** Se NarrativeService chama priority enquanto outra request também chama, audit pode duplicar. Solução: UPSERT (já planejado) + `uq_psa_link` unique constraint.
6. **`confidence_final` NULL para métricas de baixa qualidade.** Tratar como `0` (não 1). Senão score infla artificialmente quando confiança é desconhecida.
7. **Esquecer de cobrir `professional_referral` com guardrail A bypass.** A=0.3 (high effort) faria todo professional_referral sumir do top-5 sem essa exceção.
8. **Categoria `presentation_only` não deveria nem entrar no priority_link.** RecommendationEngine não fira-as. Validar em test que `category='presentation_only'` nunca aparece no input do priority service.

---

## 7. Referências de fonte

- [`M4_NARRATIVE.md`](./M4_NARRATIVE.md) §2.4 (PR-58 escopo), §3 DEC-34/35/37/38, §6 armadilhas.
- [`DDL_REVIEW.md`](../DDL_REVIEW.md) §5.7 (`priority_score_audit` 5 FKs adicionais), §6 (consolidação de versionamento).
- [`.claude/database/ddl.sql`](../../database/ddl.sql) linhas 597–630 (DDL legado da tabela).
- [`diagnostic-priority.service.ts`](../../../../nest/src/modules/diagnosis/diagnostic-priority.service.ts) (implementação parcial atual — fórmula correta, sem audit).
- [`recommendation-link.entity.ts`](../../../../nest/src/modules/diagnosis/infrastructure/entities/recommendation-link.entity.ts) (soft FK pattern).
- [`recommendation-trigger.entity.ts`](../../../../nest/src/modules/diagnosis/infrastructure/entities/recommendation-trigger.entity.ts) campo `min_invasiveness_level` + `clinical_pathway_required`.
- [`recommendation.types.ts`](../../../../nest/src/modules/diagnosis/domain/types/recommendation.types.ts) (`EVIDENCE_LEVELS`, `CATEGORY_TO_INVASIVENESS`).
- PLAN da revisão de invasividade: `.claude/plans/fa-a-mais-uma-revis-o-quirky-hopper.md`.

---

## Recommended Execution Model

**opus** — calibração da fórmula (escolha dos pesos de severity/effort), judgment ético da escada DEC-38, decisão de tie-breaks, escrita dos guardrails e seus reasons. PR-58.1 (migration) e PR-58.4 (test scaffold) podem rodar em paralelo com Sonnet.
