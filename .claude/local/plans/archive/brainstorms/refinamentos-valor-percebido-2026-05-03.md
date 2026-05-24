---
tenant_id: "face-before-after"
project: "face-before-after"
module: "brainstorms/refinamentos-valor-percebido-2026-05-03"
file_path: ".claude/plans/archive/brainstorms/refinamentos-valor-percebido-2026-05-03.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Date: 2026-05-03 Slug: refinamentos-valor-percebido Status: aprovado
tags:
  - "planning"
rag_keywords:
  - "archive"
  - "brainstorms"
  - "percebido"
  - "plans"
  - "refinamentos"
  - "valor"
related_modules: []
depends_on: []
used_by: []
---
# Plan: Refinamentos de Valor Percebido do Produto

**Date:** 2026-05-03  
**Slug:** refinamentos-valor-percebido  
**Status:** aprovado

## Recommended Execution Model

**sonnet**

---

## Contexto

Pipeline técnico completo (114 testes passando). Problema: output tem tom clínico em vez de produto de auto-melhoria. Usuário que pagou precisa sentir: "isso foi feito para mim", "aprendi algo que não sabia", "sei exatamente o que fazer agora".

---

## Fase 1 — Linguagem e Emoção

### 1. Score celebration copy — `mvp_pipeline.py`
- Adicionar `benchmark_message` tier-aware no JSON e TXT
- ≥90: "Resultado excepcional — você está entre os 5% com maior harmonia facial"
- 80–89: "Resultado acima da média — você já está entre os 20% melhores"
- 60–79: "Base sólida — 2 ajustes específicos mudam o jogo"
- <60: "Diagnóstico revelou oportunidades concretas — cada ponto tem ação clara"

### 2. First impression fallback fix — `impression_layer.py`
- POSITIVE_SIGNALS fallback: "Face detectada com qualidade suficiente..." → "Equilíbrio facial consistente — nenhum ponto de atenção dominante"
- Headline fallback: "Primeira impressão equilibrada. Oportunidades existem, mas nenhuma urgente."
- Threshold `good_canthal`: `>= 5` → `>= 3`

### 3. Visual status freshness alert — `visual_status.py`
- Quando `freshness_score < 4.0`: adicionar frase específica à narrativa
- Frase: "Olheiras e irregularidade de tom são os sinais que mais envelhecem a percepção visual — e os que melhor respondem a hábito simples."
- Adicionar `_freshness_alert(score: float) -> str`

### 4. WHY_BENEFIT_MAP — copy emocional — `top_leverage.py`
- Revisar todas as strings para contexto social concreto (não técnico)
- Mapeamento de refinamentos no prompt

---

## Fase 2 — Lógica Comercial e CTA

### 5. CTA por perfil corrigido — `mvp_pipeline.py` · `build_next_step()`
- alto (≥80): cta_text = "Ver minha simulação antes/depois" | cta_type = "simulacao" | urgency_hook = "Você já tem a base. Veja o antes/depois."
- medio (60–79): cta_text = "Começar o plano de 7 dias" | cta_type = "plano_7d" | urgency_hook = "7 dias são suficientes para notar a diferença."
- baixo (<60): cta_text = "Quero entender meus 3 pontos de melhoria" | cta_type = "detalhamento" | urgency_hook = "O diagnóstico revelou onde está o maior retorno."

### 6. Phase confidence visível no TXT — `build_shareable_report()`
- Após cada fase: `[muito provável | provável | possível | desafiador]`
- Quando fase_3.confidence_label == "desafiador": nota adicional sobre acompanhamento profissional

### 7. Simulação mencionada no TXT
- Bloco `📸 VISUALIZAÇÕES GERADAS` quando `simulation_paths` não for None
- Mostrar filenames relativos dos 3 arquivos gerados
- Quando `simulation_error`: mencionar que apenas report textual foi gerado

---

## Fase 3 — Acionabilidade e Especificidade

### 8. Foto ruim → aviso priorizado — `build_shareable_report()`
- Quando `capture_confidence < 0.60` ou `frontal_ok == False`: mover aviso ANTES das 3 ações
- Header: `⚠️ ANTES DE AGIR, MELHORE A CAPTURA:`
- Adicionar: "Uma foto em melhores condições pode mudar completamente as recomendações."

### 9. Skin alert no evolution path — `evolution_path.py` + `recommendations.py`
- Condição: `skin_uniformity_std_lab_mean > 20` ou `under_eye_darkness_mean > 0.15`
- Nova entrada em `REC_CATALOG`: chave `"skin_spf_protocol"` com tier 0, mutable True
- `build_evolution_path` retorna `skin_alert: bool`
- Quando True: forçar ação "Protocolo SPF diário + hidratação" como 1ª ação da Fase 1

### 10. Score percentil + contexto — `mvp_pipeline.py`
- Campo `score_context` no JSON e TXT (hardcoded defensivo por tier)
- Valores: ≥90 → "top 5%"; 80–89 → "top 20%"; 60–79 → "top 45%"; <60 → "maioria dos rostos não possui análise"
- Exibir após score no TXT: `  Contexto: Sua análise está entre os X% ...`

---

## Arquivos a modificar

| Arquivo | Itens |
|---|---|
| `mvp_pipeline.py` | 1, 5, 6, 7, 8, 10 |
| `impression_layer.py` | 2 |
| `visual_status.py` | 3 |
| `top_leverage.py` | 4 |
| `evolution_path.py` | 9 |
| `recommendations.py` | 9 |

---

## Verificação

```bash
source .venv/bin/activate
python -m pytest tests/ -v              # 114/114 esperados
./mvp_pipeline.py depois.png            # inspecionar TXT completo
./mvp_pipeline.py antes.png             # verificar perfil medio + captura warnings
```

Validar no JSON: `benchmark_message`, `score_context`, `simulation_paths`, `skin_alert`  
Validar no TXT: phase confidence visível, CTA "Ver simulação", bloco de simulação, aviso de captura priorizado (se aplicável)

---

## Exclusões de escopo

- Card compartilhável visual: fora (`produto-compartilhavel.md`)
- Sem preços, comparações com concorrentes, ou APIs externas
- Sem alterar contratos de dados entre módulos
