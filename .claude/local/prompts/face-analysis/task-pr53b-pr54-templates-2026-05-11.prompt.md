---
tenant_id: "face-before-after"
project: "face-before-after"
module: "face-analysis/task-pr53b-pr54-templates-2026-05-11.prompt"
file_path: ".claude/prompts/face-analysis/task-pr53b-pr54-templates-2026-05-11.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Data: 2026-05-11 Plano: .claude/plans/pr53b-pr54-30-metrics-2026-05-11.md Modelo: opus Escopo desta prompt: Fases A + B PR-53b + PR-54. Fase C 30 métricas novas ganha prompts separados.
tags:
  - "face-analysis"
  - "task-prompt"
rag_keywords:
  - "analysis"
  - "face"
  - "pr53b"
  - "pr54"
  - "prompt"
  - "prompts"
  - "templates"
related_modules: []
depends_on: []
used_by: []
---
# Task: PR-53b + PR-54 — Templates short+long + auto-revisão de tom

**Data:** 2026-05-11
**Plano:** `.claude/plans/pr53b-pr54-30-metrics-2026-05-11.md`
**Modelo:** opus
**Escopo desta prompt:** Fases A + B (PR-53b + PR-54). Fase C (30 métricas novas) ganha prompts separados.

---

## Contexto carregado (Layer 1 — Context Retrieval)

Arquivos lidos antes de qualquer código:

- `.claude/plans/PLAN_METRICS.md` — estado de PRs (PR-50..PR-52 completos, PR-53 pendente Opus).
- `.claude/plans/DDL_REVIEW.md` — schema de catálogo + avaliação.
- `.claude/plans/marcos/M4_NARRATIVE.md` — DEC-30..DEC-41, linha vermelha §1.1 (verbos permitidos, vocabulário proibido).
- `nest/src/database/migrations/1746000180000-M41DiagnosticTemplates.ts` — schema das 4 tabelas + seed v0.1 + blacklist v0.1 (10 termos).
- `nest/src/database/migrations/1746000220000-M42DiagnosticTemplatesV1.ts` — 168 templates v1.0 (size=medium, severities mild/moderate/strong, direction='any').
- `nest/src/modules/diagnosis/template-renderer.service.ts` — `TemplateRendererService.render`, `ALLOWED_PLACEHOLDERS = ['value','ideal','deviation_pct','direction_label','region_pt']`, 4 gates: `placeholder_not_allowed`, `undeclared_placeholder`, `missing_context_value`, `extraneous_context_key`.
- `nest/scripts/lint-templates.ts` — `npm run lint:templates`, exit 0/1/2.
- `nest/src/modules/diagnosis/narrative.service.ts` — consumidor atual (lê `size='medium'`).

## Dependências mapeadas (Layer 2 — Hovering)

Identificadores verificados em `.claude/`:

- `DiagnosticTemplateEntity` — campos `version, metricId, severity (severity_5_enum), direction, size, templatePt, placeholdersUsed jsonb, createdAt`.
- `TemplateBlacklistTermEntity` — campos `version, term (lowercase), category ∈ {tom_clinico, tom_pejorativo, tom_vendedor, jargao, outros}`.
- Composite UNIQUE `(version, metric_id, severity, direction, size)` em `diagnostic_template`.
- Composite UNIQUE `(version, term)` em `template_blacklist_term`.
- Partial unique index `is_active=TRUE` em ambas as tabelas de versão.

## Escopo (Layer 3 — Schema Pruning)

Tabelas tocadas: `diagnostic_template_version` (read-only — v1.0 ativa), `diagnostic_template` (INSERT 336 rows), `template_blacklist_version` (INSERT v0.2 + UPDATE v0.1 inactive), `template_blacklist_term` (INSERT 15 rows).

NÃO toca: `metric_definition`, `metric_ideal`, `region_metric_weight`, qualquer tabela de avaliação. Sem mudanças no schema.

## Guardrails (Layer 5)

- Migration idempotente: todos os INSERTs com `ON CONFLICT DO NOTHING`.
- `down()` reverte: DELETE por `(version, metric_id, severity, direction, size)` para os 336 + DELETE da blacklist v0.2 + UPDATE v0.1 active=TRUE.
- Sem mutação fora dessas 4 tabelas.
- Locale: pt-BR fixo. Sem strings em inglês.

## ReAct self-reflection (Layer 6)

- [x] Allowlist de placeholders verificada — só 5 chaves permitidas no template_pt.
- [x] Char limits: short ≤120, medium ≤350, long ≤500.
- [x] Linha vermelha: verbos permitidos `observa-se | indica | apresenta | tende a apresentar`. Strong nunca usa "severo" → "considerável".
- [x] Idempotência via UNIQUE constraint composto.
- [x] Lint script existe e está validado contra DB local (5 rows × 10 termos = 0 hits no estado atual).

---

## Tarefa

### Fase 0 — Baseline (sequencial, primeiro)

1. `cd /home/luizescobal/study/face-before-after/nest && npm test 2>&1 | tail -5` — confirmar 201/201+ verde.
2. `cd /home/luizescobal/study/face-before-after/nest && npx tsc --noEmit` — confirmar clean.
3. `cd /home/luizescobal/study/face-before-after/nest && npm run lint:templates` — confirmar exit 0.
4. Query SQL: `SELECT version, metric_id, severity, direction, template_pt FROM diagnostic_template WHERE version='v1.0' ORDER BY metric_id, severity;` — capturar os 168 mediums como referência de vocabulário.

### Fase A — PR-53b: Migration M42b com 336 templates short+long

**Arquivo a criar**: `nest/src/database/migrations/1746000250000-M42bDiagnosticTemplatesShortLong.ts`.

**Estrutura** (espelhar `1746000220000-M42DiagnosticTemplatesV1.ts`):

```ts
export class M42bDiagnosticTemplatesShortLong1746000250000 implements MigrationInterface {
  name = 'M42bDiagnosticTemplatesShortLong1746000250000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const row of SHORT_LONG_TEMPLATES) {
      await queryRunner.query(
        `INSERT INTO diagnostic_template (
           version, metric_id, severity, direction, size,
           template_pt, placeholders_used
         ) VALUES (
           $1, $2, $3::severity_5_enum, $4, $5,
           $6, $7::jsonb
         ) ON CONFLICT (version, metric_id, severity, direction, size) DO NOTHING`,
        [row.version, row.metric_id, row.severity, row.direction, row.size,
         row.template_pt, JSON.stringify(row.placeholders_used)],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const row of SHORT_LONG_TEMPLATES) {
      await queryRunner.query(
        `DELETE FROM diagnostic_template
         WHERE version=$1 AND metric_id=$2 AND severity=$3::severity_5_enum
           AND direction=$4 AND size=$5`,
        [row.version, row.metric_id, row.severity, row.direction, row.size],
      );
    }
  }
}
```

**Geração dos 336 templates** — paralelizar via 3 subagentes Opus (`runSubagent`):

- Subagent A.1: famílias `symmetry + thirds + fifths` → 14 métricas × 3 sevs × 2 sizes = 84 templates.
- Subagent A.2: famílias `eyes + brows + nose + mouth` → 26 × 3 × 2 = 156 templates.
- Subagent A.3: famílias `jaw + cheekbones + forehead + global` → 16 × 3 × 2 = 96 templates.

**Cada subagent recebe**:
- Lista exata de metric_id da sua família + os mediums correspondentes (vocabulário a preservar).
- Regras: ALLOWED_PLACEHOLDERS, verbos permitidos, char limits, blacklist v0.1 + v0.2 (lista do M42c).
- Output: array TS pronto para colar no `SHORT_LONG_TEMPLATES`.

**Helper local** para derivar `placeholders_used`:
```ts
function extractPlaceholders(tpl: string): string[] {
  const re = /\{([a-z_][a-z0-9_]*)\}/g;
  const found = new Set<string>();
  let m;
  while ((m = re.exec(tpl)) !== null) found.add(m[1]);
  return [...found];
}
```

### Fase B — PR-54: Migration M42c + relatório de revisão

**Arquivo 1**: `nest/src/database/migrations/1746000260000-M42cTemplateBlacklistExtensionV02.ts`.

```ts
export class M42cTemplateBlacklistExtensionV021746000260000 implements MigrationInterface {
  name = 'M42cTemplateBlacklistExtensionV021746000260000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE template_blacklist_version SET is_active=FALSE WHERE version='v0.1'`);
    await queryRunner.query(
      `INSERT INTO template_blacklist_version (version, description, is_active)
       VALUES ('v0.2', 'PR-54: extensão de blacklist com tom vendedor + pejorativo', TRUE)`
    );
    for (const t of NEW_TERMS) {
      await queryRunner.query(
        `INSERT INTO template_blacklist_term (version, term, category)
         VALUES ('v0.2', $1, $2)
         ON CONFLICT (version, term) DO NOTHING`,
        [t.term, t.category],
      );
    }
    // Reseed também os 10 termos de v0.1 sob v0.2 para continuidade
    for (const t of V01_TERMS) {
      await queryRunner.query(
        `INSERT INTO template_blacklist_term (version, term, category)
         VALUES ('v0.2', $1, $2)
         ON CONFLICT (version, term) DO NOTHING`,
        [t.term, t.category],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM template_blacklist_term WHERE version='v0.2'`);
    await queryRunner.query(`DELETE FROM template_blacklist_version WHERE version='v0.2'`);
    await queryRunner.query(`UPDATE template_blacklist_version SET is_active=TRUE WHERE version='v0.1'`);
  }
}
```

`NEW_TERMS` = 15 termos (severo, gravíssimo, alarmante, comprometido, fraco, ruim, irreversível, drástico, garantido, transformador, milagre, único caminho, definitivo, preocupante, deficitário) categorizados em `tom_pejorativo` ou `tom_vendedor`.

**Arquivo 2**: `.claude/plans/marcos/M4_PR54_TONE_REVIEW.md` — relatório markdown.

Estrutura:
```md
# PR-54 — Revisão de Tom dos Templates v1.0

Auditoria automática Opus. Cada template recebe 3 scores 0–3:
- vendedorismo: 0=neutro, 3=promessa explícita
- pejorativo: 0=neutro, 3=clínico negativo
- mensurabilidade: 0=sem número, 3=usa value+ideal+deviation

## Região: symmetry

### metric_id=midline_deviation severity=mild direction=right_dominant size=medium
Template atual: "..."
Scores: vend=0 pej=0 mens=2
Status: SAFE
---
### metric_id=midline_deviation severity=strong direction=right_dominant size=long
Template proposto: "..."
Scores: vend=0 pej=2 mens=3
Status: REWRITE_PROPOSED
Sugestão: "..." (motivo: termo X marcado v0.2)
```

Agrupado por região → severidade → size. Inclui **todos** os 168 mediums + 336 short+long da Fase A.

### Fase Z — Verificação final

1. `cd nest && npm run typeorm:run` — aplica M42b + M42c.
2. `cd nest && npm run lint:templates` — exit 0 contra v0.2 ativa.
3. `cd nest && npm test` — 201/201+ verde.
4. `cd nest && npx tsc --noEmit` — clean.
5. SQL spot-check:
   ```sql
   SELECT severity, size, COUNT(*)
   FROM diagnostic_template
   WHERE version='v1.0'
   GROUP BY severity, size
   ORDER BY severity, size;
   ```
   Esperado: distribuição balanceada (~56 por (severity, size) combo).
6. SQL: `SELECT version, COUNT(*) FROM template_blacklist_term GROUP BY version;` → v0.1=10, v0.2=25.
7. Markdown PR-54 existe com todas as linhas categorizadas.

---

## Critério de pronto (definição)

- [ ] M42b mergeada e aplicada → 336 novas linhas em `diagnostic_template`.
- [ ] M42c mergeada e aplicada → blacklist v0.2 ativa (25 termos).
- [ ] `lint:templates` exit 0 contra v0.2.
- [ ] `npm test` 201/201+ verde.
- [ ] `tsc --noEmit` clean.
- [ ] `M4_PR54_TONE_REVIEW.md` gerado e commitado em `.claude/plans/marcos/`.

---

## Próximos passos (fora desta prompt)

- Aprovação humana do `M4_PR54_TONE_REVIEW.md` → migration `M42d` aplica UPDATEs nos templates marcados `REWRITE_PROPOSED`.
- Confirmação da lista canônica das 30 métricas → prompt separado para PR-NEW Wave C1.
