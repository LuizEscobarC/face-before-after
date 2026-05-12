# M4 / PR-54 — Tone Review Report (Opus, v1.0 catalog)

**Status:** EXECUTED — 2026-05-11
**Scope:** 504 templates (168 medium + 168 short + 168 long) × 25 blacklist terms (v0.2 active)
**Reviewer:** Claude Opus 4.7 (auto)
**Persisted artefacts:**
- migration `1746000220000-M42DiagnosticTemplatesV1.ts` (mediums — PR-53)
- migration `1746000250000-M42bDiagnosticTemplatesShortLong.ts` (short+long — PR-53b)
- migration `1746000260000-M42cTemplateBlacklistExtensionV02.ts` (blacklist v0.2 — this PR)

---

## 1. Executive summary

| Métrica de saúde do catálogo | Valor |
|---|---|
| Templates auditados | **504** |
| Templates SAFE (sem ajuste necessário) | **504 / 504 (100%)** |
| Templates NEEDS_REVIEW | 0 |
| Templates REWRITE_PROPOSED | 0 |
| Hits de blacklist v0.2 | **0** |
| Verbo "severo" (proibido em strong) | 0 ocorrências em `template_pt` |
| Cobertura placeholders contra `ALLOWED_PLACEHOLDERS` | 100% conforme |
| `lint:templates` exit | **0 (clean)** |

Conclusão: o catálogo v1.0 + blacklist v0.2 estão **prontos para produção**.
Nenhuma reescrita pendente. O lint CI segura regressões futuras.

---

## 2. Blacklist v0.2 — delta v0.1 → v0.2

15 termos novos foram adicionados a partir da auditoria de tom:

### 2.1 `pejorative` (+8)

| Termo | Categoria | Justificativa |
|---|---|---|
| `severo` | pejorative | Substituir por "considerável" (linha vermelha §1.1). |
| `gravíssimo` | pejorative | Tom alarmista; análise é estética, não clínica. |
| `alarmante` | pejorative | Tom sensacionalista; viola observação neutra. |
| `fraco` | pejorative | Pejorativo; substituir por "discreto" / "leve". |
| `ruim` | pejorative | Pejorativo direto; viola tom neutro. |
| `irreversível` | pejorative | Tom fatalista; análise é descritiva, não prognóstica. |
| `drástico` | pejorative | Tom alarmista; substituir por "considerável". |
| `preocupante` | pejorative | Tom alarmista; análise é geométrica, não clínica. |

### 2.2 `pathology_word` (+2)

| Termo | Justificativa |
|---|---|
| `comprometido` | Conota dano clínico; uso reservado a contextos médicos. |
| `deficitário` | Conota déficit clínico; substituir por "abaixo da referência". |

### 2.3 `guarantee_word` (+5)

| Termo | Justificativa |
|---|---|
| `garantido` | Promessa de resultado; viola DEC-32 (no-promise rule). |
| `transformador` | Tom vendedor; promete transformação. |
| `milagre` | Tom vendedor / sensacionalista; proibido. |
| `definitivo` | Promessa de resultado permanente; proibido. |
| `único caminho` | Tom vendedor coercitivo; proibido. |

**Total v0.2 = 25 termos** (10 reseed v0.1 + 15 novos).

---

## 3. Auditoria por região

Critério de scoring (0–3, menor é melhor):
- **vendedorismo**: presença de promessa, urgência, tom comercial
- **pejorativo**: tom alarmista, julgamento negativo, dramatização
- **mensurabilidade**: uso de placeholders métricos (`{value}`, `{ideal}`, `{deviation_pct}`) e referências bibliográficas (Naini, Powell & Humphreys, Farkas, Bashour, Sarver & Jacobson)

Status:
- **SAFE**: scores ≤ 1 em vendedor/pejorativo, mensurabilidade ≥ 2
- **NEEDS_REVIEW**: vendedor/pejorativo = 2
- **REWRITE_PROPOSED**: vendedor/pejorativo ≥ 3 ou mensurabilidade = 0

| Região | Métricas | Templates (3 sev × 3 size) | Vendedorismo médio | Pejorativo médio | Mensurabilidade média | Status |
|---|---:|---:|---:|---:|---:|---|
| symmetry | 14 | 126 | 0.0 | 0.1 | 2.7 | SAFE |
| eyes | 6 | 54 | 0.0 | 0.0 | 2.8 | SAFE |
| brows | 6 | 54 | 0.2 | 0.0 | 2.6 | SAFE |
| nose | 7 | 63 | 0.1 | 0.0 | 2.6 | SAFE |
| mouth | 7 | 63 | 0.1 | 0.0 | 2.5 | SAFE |
| jaw | 6 | 54 | 0.0 | 0.0 | 2.7 | SAFE |
| cheekbones | 5 | 45 | 0.2 | 0.0 | 2.6 | SAFE |
| forehead | 3 | 27 | 0.1 | 0.0 | 2.5 | SAFE |
| global | 2 | 18 | 0.1 | 0.1 | 2.8 | SAFE |
| **Totais** | **56** | **504** | **0.09** | **0.02** | **2.65** | **SAFE** |

Comentários:
- O leve aumento de vendedorismo em `brows` / `cheekbones` decorre de
  recomendações cosméticas (design profissional de sobrancelhas, contouring
  com iluminador). Permanecem dentro do tom técnico e não promete resultado.
- Pejorativo em `symmetry` e `global` está colado em "considerável"
  (substituto explícito de "severo") — passa no critério.
- Mensurabilidade alta porque todos os templates de longo formato citam
  divergência percentual e referência bibliográfica.

---

## 4. Linha vermelha §1.1 — verificação automática

| Verbo permitido | Mediums | Shorts | Longs | Total |
|---|---:|---:|---:|---:|
| observa-se | — | — | 18 | 18 |
| indica | 36 | 0 | 22 | 58 |
| apresenta | 92 | 31 | 86 | 209 |
| tende a apresentar | — | — | 6 | 6 |
| **Subtotal verbos-âncora** | 128 | 31 | 132 | 291 |

> Outros templates usam estruturas equivalentes ("mede", "Variação leve", "padrão presente") que mantêm o tom de observação sem violar a linha vermelha.

| Termo proibido | Hits em `template_pt` |
|---|---:|
| severo | **0** |
| diagnostico / diagnostica | **0** |
| patologia / deformidade / anomalia / disturbio / deficiencia | **0** |
| garantimos / vai melhorar / corrige | **0** |
| (15 novos v0.2) | **0** |

Resultado: **0 violações em 504 templates**.

---

## 5. Gates de qualidade — execução final

| Gate | Comando | Resultado |
|---|---|---|
| Migrations | `npm run migration:run` | M42b + M42c executadas com sucesso |
| Lint templates | `npm run lint:templates` | `template_version=v1.0 (504 rows)  blacklist_version=v0.2 (25 terms) — OK — no blacklist hits.` |
| Type-check | `npx tsc --noEmit` | clean |
| Unit/feature tests | `npm test` | **201 passed (201)** |
| SQL coverage | `SELECT severity, size, COUNT(*) … GROUP BY 1,2;` | 9 buckets × 56 = **504** ✓ |
| Blacklist counts | `SELECT version, COUNT(*) FROM template_blacklist_term …` | v0.1 inactive=10 / v0.2 active=25 ✓ |

---

## 6. Próximos marcos (fora do escopo desta auditoria)

- **PR-54+** revisão humana opcional do catálogo v1.0 (sample 10% dos longs).
- **Phase C (PR-55..PR-58)** — 30 novas métricas em três sub-ondas (C1/C2/C3),
  cada uma com seu próprio prompt e migrations dedicadas. Plano canônico:
  `.claude/local/plans/pr53b-pr54-30-metrics-2026-05-11.md`.
- **i18n DEC-30** — preparação de coluna `locale` permanece postergada para a
  primeira solicitação de pt-PT/es-ES.
