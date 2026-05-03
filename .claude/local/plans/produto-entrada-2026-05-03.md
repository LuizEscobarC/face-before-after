# Plano: Produto de Entrada — Face Analysis (Pay-per-use)

**Data:** 2026-05-03  
**Módulo:** face-before-after (Python)  
**Goal:** Implementar os 7 blocos técnicos necessários para transformar o pipeline de análise facial em produto comercializável de entrada (R$9,90–R$29,90 / análise)

---

## Recomended Execution Model

**sonnet**

---

## Contexto Técnico

Stack: Python 3, dlib 68-pt landmarks, OpenCV, scipy, numpy  
Arquivos principais: `face_metrics.py`, `face_asymmetry.py`, `recommendations.py`, `mvp_pipeline.py`

---

## Passos de Execução

### 1 — Atualizar `recommendations.py`
**Skill:** edição direta  
**O que fazer:**
- Adicionar campo `actionability_tier` (0=hoje/grátis, 1=semanas/custo baixo, 2=profissional acessível, 3=cirurgia)
- Adicionar campo `time_to_result` ("imediato" | "semanas" | "meses" | "longo_prazo")
- Adicionar campo `cost_level` (0=grátis, 1=barato, 2=moderado, 3=alto)
- Adicionar campo `mutable` (bool — true se a métrica pode mudar sem cirurgia)
- Adicionar campo `social_perception_weight` (0.0–1.0 — impacto na percepção social, distinto do impacto técnico)

**Arquivos afetados:** `recommendations.py`

---

### 2 — Criar `impression_layer.py`
**Skill:** criação  
**O que fazer:**
- Dicionário de narrativas por combinação de métricas dominantes
- Função `build_first_impression(metrics_dict) → dict` que retorna:
  - `headline` (frase principal em linguagem social)
  - `tags` (lista de 2–4 adjetivos de percepção: "descansado", "simétrico", "cuidado", etc.)
  - `main_risk` (fator que mais derruba a impressão hoje)
- Mapeamentos:
  - `canthal_tilt < 0` + `under_eye_darkness > 0.15` → "Transmite cansaço"
  - `fWHR < 1.6` + `jawline_definition < 0.3` → "Presença suave, espaço para força"
  - `skin_uniformity_std > 20` → "Cuidado com pele visível"
  - `overall_asymmetry > 3%IPD` → "Assimetria acima do limiar perceptível"
  - `overall_asymmetry < 1%IPD` → "Alta simetria — ativo visual forte"
  - `canthal_tilt > 3` → "Olhar jovial e energético"
  - `fWHR > 1.9` → "Presença marcante e autoridade visual"

**Arquivos criados:** `impression_layer.py`

---

### 3 — Criar `visual_status.py`
**Skill:** criação  
**O que fazer:**
- `compute_dominance_score(metrics) → float` (0–10): baseado em `fWHR`, `jawline_definition_score`, `bizygomatic_to_bigonial_ratio`, `gonial_angle_mean_deg`
- `compute_attractiveness_score(metrics) → float` (0–10): baseado em `canthal_tilt_mean_deg`, `overall_asymmetry_score`, `thirds_balance_std`, `lower_third_ratio`
- `compute_freshness_score(metrics) → float` (0–10): baseado em `skin_uniformity_std_lab_*`, `under_eye_darkness_*`, `eye_aspect_ratio_mean`
- `build_visual_status(metrics) → dict` que retorna os 3 scores + narrativa interpretativa por dimensão
- Normalização: cada score usa referências do glossary.py (ranges ideais já documentados)

**Arquivos criados:** `visual_status.py`

---

### 4 — Criar `simulate_before_after.py`
**Skill:** criação  
**Implementação em 2 camadas (sem IA generativa):**

**Camada A — Simetrização:**
- Detectar metade "melhor" (menor assimetria)
- Espelhar via landmarks + `cv2.warpAffine` com matriz baseada em pontos de controle (olhos, boca, sobrancelhas)
- Retornar imagem simetrizada + imagem comparativa lado a lado (original | simetrizado)

**Camada B — Anotação de Proporções Ideais:**
- Sobre foto original, desenhar:
  - Terços horizontais ideais (linhas pontilhadas verdes)
  - Quintos verticais ideais (linhas pontilhadas verdes)
  - Ângulo cantal ideal (+5°) vs real (linha colorida por desvio)
  - Razão nariz/boca ideal vs real (guias de largura)
- Código de cor: verde = dentro do ideal, laranja = leve desvio, vermelho = desvio significativo

**Output:** 3 imagens: `symmetrized.jpg`, `ideal_proportions.jpg`, `comparison_grid.jpg`  
**Arquivos criados:** `simulate_before_after.py`

---

### 5 — Criar `evolution_path.py`
**Skill:** criação  
**O que fazer:**
- `get_mutable_metrics(metrics) → list[str]`: retorna métricas com `mutable=True` que estão fora do ideal (usa `recommendations.py`)
- `build_evolution_path(metrics) → dict` com 3 fases:
  - **Fase 1 (0–7 dias):** ações `tier_0` — foto, expressão, iluminação, postura
  - **Fase 2 (7–30 dias):** ações `tier_1` — hábitos, skincare, exercício mastigatório
  - **Fase 3 (30–90 dias):** ações `tier_2` — profissional acessível (se indicado)
- Cada fase com: lista de ações + meta de re-análise + métricas esperadas melhorar
- Função `get_reanalysis_date(phase) → str`: sugere data de retorno para nova análise

**Arquivos criados:** `evolution_path.py`

---

### 6 — Criar `top_leverage.py`
**Skill:** criação  
**O que fazer:**
- `get_top_leverage_recommendation(metrics, max_tier=1) → dict`: filtra por `actionability_tier <= max_tier`, ordena por `social_perception_weight × deviation_from_ideal`, retorna 1 recomendação principal com:
  - `short_action`: 1 linha (o que fazer)
  - `why_it_matters`: 1 linha (benefício percebido, não déficit técnico)
  - `time_to_result`: quando verá resultado
  - `tier`: nível de esforço
- `get_top3_actions(metrics, max_tier=2) → list[dict]`: retorna 3 ações ordenadas por `(social_perception_weight × deviation) / time_weight`
  - Garante: 1 ação `tier_0`, 1 `tier_1`, 1 `tier_2` na resposta final

**Arquivos criados:** `top_leverage.py`

---

### 7 — Atualizar `mvp_pipeline.py`
**Skill:** edição  
**O que fazer:**
- Importar e integrar os 4 novos módulos
- Estender o JSON de saída com:
  ```json
  {
    "first_impression": { "headline": "...", "tags": [...], "main_risk": "..." },
    "visual_status": { "dominance": 6.2, "attractiveness": 7.8, "freshness": 5.1, "narrative": "..." },
    "top_leverage": { "short_action": "...", "why_it_matters": "...", "time_to_result": "..." },
    "top3_actions": [...],
    "evolution_path": { "phase_1": [...], "phase_2": [...], "phase_3": [...] }
  }
  ```
- Manter compatibilidade retroativa com campos existentes

**Arquivos afetados:** `mvp_pipeline.py`

---

### 8 — Atualizar `tests/`
**O que fazer:**
- Criar `tests/test_impression_layer.py`
- Criar `tests/test_visual_status.py`
- Criar `tests/test_top_leverage.py`
- Adicionar casos nos testes existentes para campos novos do pipeline

---

## Arquivos Criados / Modificados

| Ação | Arquivo |
|------|---------|
| MODIFICAR | `recommendations.py` |
| CRIAR | `impression_layer.py` |
| CRIAR | `visual_status.py` |
| CRIAR | `simulate_before_after.py` |
| CRIAR | `evolution_path.py` |
| CRIAR | `top_leverage.py` |
| MODIFICAR | `mvp_pipeline.py` |
| CRIAR | `tests/test_impression_layer.py` |
| CRIAR | `tests/test_visual_status.py` |
| CRIAR | `tests/test_top_leverage.py` |

---

## Critério de Sucesso

1. `python mvp_pipeline.py <foto>` retorna JSON com todos os 5 novos campos
2. Toda foto retorna pelo menos 1 ação `tier_0`
3. Recomendação principal nunca é `tier_3` no produto de entrada
4. Score de status visual retorna as 3 dimensões para qualquer foto válida
5. Simulação gera 3 imagens sem erro para qualquer foto frontal válida
6. `pytest tests/` passa sem regressão

---

## Decisões Fechadas

- Simulação: Opção A (simetrização) + Opção B (anotação de proporções) — sem IA generativa
- Recomendação principal: `max_tier=1` para produto de entrada
- Features 8 (compartilhável) e 9 (próximo passo) em planos separados (ver `produto-compartilhavel.md` e `produto-proximo-passo.md`)
- Grooming/barba: fora do escopo inicial (requer segmentação, não só landmarks)

---

## Recommended Execution Model

**sonnet**
