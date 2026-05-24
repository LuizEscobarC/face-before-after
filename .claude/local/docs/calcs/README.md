---
tenant_id: "face-before-after"
project: "face-before-after"
module: "calcs/README"
file_path: ".claude/docs/calcs/README.md"
doc_type: "concept"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  > Auditoria matemática rodada em 2026-05-09 sobre os 3 pilares numéricos do produto: cálculo de métricas faciais Python, scoring Nest, e improvement vectors Python+Frontend.
tags:
  - "calculations"
rag_keywords:
  - "calcs"
  - "docs"
  - "readme"
related_modules: []
depends_on: []
used_by: []
---
# Math-Proof — face-before-after

> Auditoria matemática rodada em 2026-05-09 sobre os 3 pilares numéricos do produto: cálculo de métricas faciais (Python), scoring (Nest), e improvement vectors (Python+Frontend).

## Veredito geral

| Pilar | Resultado | Achados |
|-------|-----------|---------|
| **Métricas faciais** (8 calculadores principais) | ✅ correto | 7/8 sem ressalva, 1 gap técnico menor (atan2 não-normalizado) |
| **Scoring** (RegionalScorer + GlobalScorer + ScoreBander + SeverityClassifier) | ✅ correto | Pesos globais somam 1.0 nas duas versões, banding consistente, sem gaps |
| **Improvement vectors** (4 calculadores + frontend) | ✅ correto | Sinal, cap ±0.3 ICU, conversão pixel e âncoras MediaPipe-478 todos corretos |

**Bugs:** 0
**Gaps documentados:** 1 (mandibular plane angle)
**Total testes verdes:** 1110 Python + 161 Vitest

## Estrutura

### Round 1 — caminho crítico (2026-05-09)

- [`metrics/calcs.md`](./metrics/calcs.md) — fórmulas auditadas dos 8 calculadores principais
- [`scoring/calcs.md`](./scoring/calcs.md) — fórmulas RegionalScorer/GlobalScorer/Bander
- [`improvement-vectors/calcs.md`](./improvement-vectors/calcs.md) — sinal/cap/âncora dos 4 vetores

### Round 2 — passada crítica complementar (2026-05-09)

- [`round2/01-calculators-extended.md`](./round2/01-calculators-extended.md) — ~58 calculadores não-auditados na round 1
- [`round2/02-confidence-propagation.md`](./round2/02-confidence-propagation.md) — fórmula completa + bug NaN
- [`round2/03-heatmap-and-composer.md`](./round2/03-heatmap-and-composer.md) — Runge phenomenon + magnitude cap
- [`round2/04-ideals-cross-check.md`](./round2/04-ideals-cross-check.md) — 59 rows de `metric_ideal` cross-checked

### Gaps consolidados

- [`metrics/gaps.md`](./metrics/gaps.md) — 5 entries (1 da round 1 + 4 da round 2)

---

## Veredito atualizado (round 1 + round 2)

| Pilar | Round | Status | Achados |
|-------|-------|--------|---------|
| Métricas faciais — caminho crítico (8) | 1 | ✅ | 1 gap menor (atan2) |
| Scoring (Regional/Global/Bander/Severity) | 1 | ✅ | 0 |
| Improvement vectors (4) | 1 | ✅ | 0 |
| Métricas estendidas (~58) | 2 | ⚠️ | 5 fallbacks 0.0 mascarando degenerate |
| Confidence propagation | 2 | ❌ | 1 bug real: NaN propagation |
| Heatmaps + Before/Ideal composer | 2 | ⚠️ | 2 fragilidades (Runge, magnitude cap) |
| Seed `metric_ideal` (59 rows) | 2 | ✅ | 0 violações aritméticas / bibliográficas / DEC |

**Bugs reais:** 1 — `confidence_propagation.py:267` (NaN propagation).
**Fragilidades estruturais:** 2 — Runge phenomenon, magnitude cap por componente.
**Fallbacks silenciosos:** 5 — forehead/cheekbones/global_shape retornando `value=0.0` com confiança alta.
**Gaps menores:** 1 — `mandibular_plane_angle` atan2.

## Recomendação revisada

**Antes de PR-22 (calibração com fotos reais) — obrigatório:**
- Corrigir NaN propagation em `confidence_propagation.py:267` (fix de 1 linha). Sem isso, multi-foto pode gerar `confidence_final = NaN` no DB e operador calibra ideais contra dados corruptos sem perceber.

**Junto com PR-22 — recomendado:**
- Corrigir os 5 fallbacks `value=0.0` → `_null_mv` (padrão já existe em `phi_golden.py`). PR-22 vai expor esses branches em fotos reais com hairline cortado, oclusão lateral, ângulo ruim.

**Pode ficar para depois (M3 cleanup) — opcional:**
- Runge clamp pós-griddata em `heatmap_renderer.py` (1 linha).
- Decisão editorial sobre magnitude cap (norma vs componente) em `before_ideal_composer.py`.
- `mandibular_plane_angle` atan2 normalizado (1 linha).

**Não exige ação:** scoring, improvement vectors, seed do banco, todas as famílias `eyes/nose/mouth/thirds/fifths/phi/brows-restantes/jaw-restantes`.
