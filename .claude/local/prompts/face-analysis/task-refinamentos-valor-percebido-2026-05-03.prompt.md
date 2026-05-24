---
tenant_id: "face-before-after"
project: "face-before-after"
module: "face-analysis/task-refinamentos-valor-percebido-2026-05-03.prompt"
file_path: ".claude/prompts/face-analysis/task-refinamentos-valor-percebido-2026-05-03.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Module: face-analysis Type: refinement Slug: refinamentos-valor-percebido Date: 2026-05-03 Model: sonnet Plan: .claude/plans/refinamentos-valor-percebido-2026-05-03.md
tags:
  - "face-analysis"
  - "task-prompt"
rag_keywords:
  - "analysis"
  - "face"
  - "percebido"
  - "prompt"
  - "prompts"
  - "refinamentos"
  - "valor"
related_modules: []
depends_on: []
used_by: []
---
# Task: Refinamentos de Valor Percebido do Produto

**Module:** face-analysis  
**Type:** refinement  
**Slug:** refinamentos-valor-percebido  
**Date:** 2026-05-03  
**Model:** sonnet  
**Plan:** `.claude/plans/refinamentos-valor-percebido-2026-05-03.md`

---

## Objetivo

Refinar o produto de análise facial para que o usuário que pagou R$9,90–R$29,90 sinta: "isso foi feito para mim", "aprendi algo que não sabia", "sei exatamente o que fazer agora". As mudanças são majoritariamente de copy/narrativa + 2 pontos de lógica — sem alterar contratos de dados entre módulos.

---

## Estado Atual

- Pipeline técnico: completo e funcional (114 testes passando)
- Problema: output tem tom clínico (laudo de dermatologista) em vez de produto de auto-melhoria
- Oportunidades identificadas via diagnóstico do output `depois_mvp_report.txt`:
  - Score sem celebração ou contexto comparativo
  - First impression com fallback genérico ("Face detectada...")
  - Visual status: frescor 2.5/10 sem urgência ou ação clara
  - WHY_BENEFIT_MAP: linguagem técnica fria
  - CTA "acompanhar evolução" não alinhado com perfil alto (score 87)
  - Phase confidence existe no JSON mas invisível no TXT
  - Simulação gerada mas não mencionada no TXT
  - Foto com pitch=-16° sem aviso em destaque

---

## Fase 1 — Linguagem e Emoção

### 1. `mvp_pipeline.py` — `benchmark_message` + `score_context`

**Adicionar** função `_get_score_context(score: int, tier: str) -> dict` que retorna:
```python
{
    "benchmark_message": str,   # frase de celebração/provocação tier-aware
    "score_context": str,       # referência de percentil hardcoded
}
```

Mapeamento por tier/score:
```python
score >= 90:
    benchmark_message = "Resultado excepcional — harmonia facial acima de 95% das análises."
    score_context     = "Sua análise está entre os 5% com maior harmonia facial."

score >= 80:
    benchmark_message = "Você já está acima da média — e os ajustes certos ampliam ainda mais o impacto."
    score_context     = "Resultado entre os 20% melhores que analisamos."

score >= 60:
    benchmark_message = "Base sólida. Dois ajustes específicos mudam o jogo completamente."
    score_context     = "Resultado acima de 55% dos rostos analisados."

else:
    benchmark_message = "O diagnóstico revelou oportunidades concretas — cada ponto tem ação clara."
    score_context     = "Análise com múltiplos pontos de melhoria — situação comum e reversível."
```

**Adicionar ao JSON** `report` dict: `"benchmark_message"` e `"score_context"`.

**Adicionar ao TXT** (após linha do score):
```
  Contexto: <score_context>
  <benchmark_message>
```

### 2. `impression_layer.py` — fallback e threshold `good_canthal`

**Alterar** em `POSITIVE_SIGNALS`:
```python
# ANTES (default fallback):
{"label": "default", ..., "signal": "Face detectada com qualidade suficiente para análise completa"}

# DEPOIS:
{"label": "default", ..., "signal": "Equilíbrio facial consistente — nenhum ponto de atenção dominante"}
```

**Alterar** headline quando `not risks_found`:
```python
# ANTES:
headline = f"Primeira impressão sólida. {positive['signal']}."

# DEPOIS:
headline = "Primeira impressão equilibrada. Oportunidades existem, mas nenhuma urgente." \
    if positive["label"] == "default" else \
    f"Primeira impressão sólida. {positive['signal']}."
```

**Alterar** threshold de `good_canthal` condition:
```python
# ANTES: metrics.get("canthal_tilt_mean_deg", 0) >= 5
# DEPOIS: metrics.get("canthal_tilt_mean_deg", 0) >= 3
```

### 3. `visual_status.py` — `_freshness_alert`

**Adicionar** função privada após `build_visual_status`:
```python
def _freshness_alert(freshness_score: float) -> str:
    """Retorna frase de impacto quando frescor está crítico."""
    if freshness_score < 4.0:
        return (
            " Olheiras e irregularidade de tom são os sinais que mais envelhecem "
            "a percepção visual — e os que melhor respondem a hábito simples."
        )
    return ""
```

**Alterar** `_build_narrative` para concatenar o alert ao narrative final:
```python
base_narrative = narratives.get(key, fallback)
return base_narrative + _freshness_alert(f)
```

### 4. `top_leverage.py` — `WHY_BENEFIT_MAP` refinado

**Substituir** as strings de `WHY_BENEFIT_MAP` para linguagem com contexto social concreto:

```python
WHY_BENEFIT_MAP = {
    "overall_asymmetry_score_pct_ipd": "muda como você aparece em fotos — o que as pessoas veem antes de te conhecer",
    "canthal_tilt_mean_deg":           "aumenta a percepção de juventude e energia — o que os outros sentem ao te olhar",
    "fwhr":                            "projeta presença antes mesmo de você falar — proporção associada a líderes e autoridade",
    "jawline_definition_score":        "projeta presença antes mesmo de você falar — estrutura que transmite autoridade",
    "bizygomatic_to_bigonial_ratio":   "define o contorno facial — o que muda a percepção de força na primeira impressão",
    "thirds_std_dev":                  "harmoniza o rosto globalmente — base invisível que o cérebro detecta como equilíbrio",
    "fifths_std_dev":                  "equilibra as proporções horizontais — detalhe que influencia percepção de beleza",
    "lower_third_ratio":               "define o terço inferior — impacta diretamente na leitura de maturidade e presença",
    "intercanthal_to_eyewidth_ratio":  "alinha os olhos com o rosto — muda como o olhar é percebido",
    "nasal_to_mouth_width_ratio":      "equilibra nariz e boca — harmonia central do rosto",
    "mouth_to_ipd_ratio":              "proporciona o sorriso ao rosto — o que muda a percepção de expressividade",
    "marquardt_deviation_pct_ipd":     "aproxima o rosto das proporções que o cérebro reconhece como harmônicas",
    "gonial_angle_mean_deg":           "define o ângulo da mandíbula — o que mais transmite estrutura facial masculina",
    "under_eye_darkness_left":         "reduz o sinal mais visível de cansaço — o que mais impacta percepção de energia",
    "under_eye_darkness_right":        "reduz o sinal mais visível de cansaço — o que mais impacta percepção de energia",
    "skin_uniformity_std_lab_left":    "uniformiza o tom da pele — o que transmite cuidado e vitalidade",
    "skin_uniformity_std_lab_right":   "uniformiza o tom da pele — o que transmite cuidado e vitalidade",
    "eye_aspect_ratio_mean":           "abre o olhar — o que muda como você transmite presença e atenção",
    "face_shape_label":                "trabalha o contorno do rosto — impacto direto na primeira leitura visual",
    "skin_spf_protocol":               "protege e uniformiza o tom da pele — o hábito com maior retorno visual por esforço",
}
```

**Regra de fallback** (manter): se chave não está no map, usar `"melhora a percepção visual geral"`.

---

## Fase 2 — Lógica Comercial e CTA

### 5. `mvp_pipeline.py` — `build_next_step()` CTA por perfil

**Alterar** a lógica de `cta_text`, `cta_type` e `urgency_hook` por profile:

```python
if profile == "alto":
    cta_text     = "Ver minha simulação antes/depois"
    cta_type     = "simulacao"
    urgency_hook = f"Você já tem a base. Veja o antes/depois."
    # Se top_leverage foi passado: "Você pode começar com '<short_action>' ainda hoje."
    # Manter lógica atual do urgency_hook com top_leverage se existir

elif profile == "medio":
    cta_text     = "Começar o plano de 7 dias"
    cta_type     = "plano_7d"
    urgency_hook = "7 dias são suficientes para notar a diferença."
    # Se top_leverage: "Você pode começar com '<short_action>' ainda hoje."

else:  # baixo
    cta_text     = "Quero entender meus 3 pontos de melhoria"
    cta_type     = "detalhamento"
    urgency_hook = "O diagnóstico revelou onde está o maior retorno."
    # Se top_leverage: "Você pode começar com '<short_action>' ainda hoje."
```

**Nota:** a lógica atual do `urgency_hook` com `top_leverage.short_action` deve ser preservada — só mudar o hook genérico quando não há `top_leverage`.

### 6. `mvp_pipeline.py` — `build_shareable_report()` — Phase confidence no TXT

**Alterar** o bloco `🧭 CAMINHO CURTO DE EVOLUÇÃO` para incluir confidence label e nota profissional:

```
🧭 CAMINHO CURTO DE EVOLUÇÃO:
  <phase_1.label> [<confidence_label>]
    Foco: <phase_1.focus>
    Ações: ...

  <phase_2.label> [<confidence_label>]
    ...

  <phase_3.label> [<confidence_label>]
    ...
    <se desafiador: nota sobre profissional>
```

Quando `phase_3.confidence_label == "desafiador"`:
```
  ⚠️  Esta fase provavelmente requer acompanhamento profissional para ser efetiva.
```

### 7. `mvp_pipeline.py` — `build_shareable_report()` — Bloco de simulações no TXT

**Adicionar** após o bloco de evolução (antes do próximo passo):

```python
if simulation_paths:
    lines.append("")
    lines.append("📸 VISUALIZAÇÕES GERADAS:")
    lines.append(f"  → Rosto simetrizado:      {os.path.basename(simulation_paths['symmetrized'])}")
    lines.append(f"  → Proporções ideais:       {os.path.basename(simulation_paths['ideal_proportions'])}")
    lines.append(f"  → Grade comparativa:       {os.path.basename(simulation_paths['comparison_grid'])}")
    lines.append("  (abra os arquivos na pasta de saída para visualizar)")
elif simulation_error:
    lines.append("")
    lines.append(f"  (simulação visual não gerada: {simulation_error})")
```

---

## Fase 3 — Acionabilidade e Especificidade

### 8. `mvp_pipeline.py` — `build_shareable_report()` — Aviso de captura priorizado

**Alterar** a posição do aviso de captura: quando `capture_confidence < 0.60` ou `photo_quality.frontal_ok == False`, mover o aviso para **ANTES** do bloco das 3 ações.

Novo header do bloco:
```
⚠️  ANTES DE AGIR, MELHORE A CAPTURA:
  <capture_recommendations itens>
  Uma foto em melhores condições pode mudar completamente as recomendações.
```

**Manter** o bloco `📷 PARA MELHORAR A PRÓXIMA ANÁLISE` no final para quando confidence >= 0.60 (posição atual).

### 9. `evolution_path.py` + `recommendations.py` — Skin alert

**Em `recommendations.py`**, adicionar nova entrada no `REC_CATALOG`:
```python
"skin_spf_protocol": {
    "label":                   "Protocolo SPF diário + hidratação",
    "short_action":            "SPF 30+ diariamente + hidratante noturno",
    "why_it_matters":          "Protege e uniformiza o tom da pele — o hábito com maior retorno visual por esforço.",
    "severity_thresholds":     {"leve": 15.0, "moderada": 20.0, "severa": 25.0},
    "actions_by_severity": {
        "leve":     "SPF 30+ diariamente ao sair.",
        "moderada": "SPF 50+ diário + vitamina C tópica + hidratante noturno.",
        "severa":   "SPF 50+ + rotina completa diurna/noturna + avaliação dermatológica."
    },
    "actionability_tier":       0,
    "time_to_result":           "semanas",
    "cost_level":               1,
    "mutable":                  True,
    "social_perception_weight": 0.70,
}
```

**Em `evolution_path.py`**, adicionar lógica `skin_alert`:

```python
def _check_skin_alert(metrics: dict) -> bool:
    """Retorna True se pele/olheiras estão em nível de alerta."""
    left  = metrics.get("skin_uniformity_std_lab_left", 0.0)
    right = metrics.get("skin_uniformity_std_lab_right", 0.0)
    skin_mean = (left + right) / 2 if (left or right) else 0.0
    dark_l = metrics.get("under_eye_darkness_left", 0.0)
    dark_r = metrics.get("under_eye_darkness_right", 0.0)
    dark_mean = (dark_l + dark_r) / 2 if (dark_l or dark_r) else 0.0
    return skin_mean > 20.0 or dark_mean > 0.15
```

**Adicionar** `skin_alert` ao retorno de `build_evolution_path`:
```python
result["skin_alert"] = _check_skin_alert(metrics)
```

**Injetar** ação de pele na fase 1 quando `skin_alert == True`:
```python
if result["skin_alert"]:
    skin_action = "SPF 30+ diariamente + hidratante noturno"
    if skin_action not in result["phase_1"]["actions"]:
        result["phase_1"]["actions"].insert(0, skin_action)
```

**Passar `skin_alert`** para `build_shareable_report` e exibir nota quando True:
```
  ⚠️  Skin alert ativo: sua pele/olheiras estão no nível de maior impacto visual — 
      a 1ª ação da semana já trata isso.
```

### 10. `mvp_pipeline.py` — `score_context` (ver item 1)

Já coberto no item 1 — usar `_get_score_context(score, tier)`.

---

## Regras de Implementação

- Não alterar assinaturas de funções públicas já testadas (apenas adicionar campos ao retorno)
- Não remover campos JSON existentes
- Cada novo campo JSON deve ter fallback seguro (não quebrar se cálculo falhar)
- Manter 114 testes passando (zero regressão)

---

## Critérios de Aceite

1. `pytest tests/ -v` → **114/114 passando**
2. JSON final contém: `benchmark_message`, `score_context`, `skin_alert` em `evolution_path`
3. TXT final contém:
   - Score + contexto de percentil
   - Phase confidence label visível após cada fase
   - Bloco `📸 VISUALIZAÇÕES GERADAS` quando simulação disponível
   - CTA "Ver minha simulação antes/depois" para score ≥ 80
   - Aviso de captura ANTES das 3 ações quando `capture_confidence < 0.60`
4. `impression_layer.py`: fallback não é mais "Face detectada..."
5. `visual_status.py`: narrativa com frescor < 4 inclui frase de skincare

---

## Verificação

```bash
source .venv/bin/activate
python -m pytest tests/ -v
./mvp_pipeline.py depois.png
cat resultado_mvp/depois_mvp_report.txt
./mvp_pipeline.py antes.png
cat resultado_mvp/antes_mvp_report.txt
```
