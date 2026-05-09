# Plano: Correções UX Críticas — Output TXT/JSON
**Data:** 2026-05-03
**Scope:** mvp_pipeline.py, impression_layer.py

## Contexto
Revisão crítica do output identificou 6 problemas que impedem o produto de ser vendável:
1. Contradição hierárquica: "maior alavanca" ≠ ação #1
2. Jargão interno "Tier: 0 / Tier: 1" exposto ao usuário final
3. Sinal positivo == Headline — mesma frase repetida em dois campos
4. Bloco de simulação sem valor: só nomes de arquivo, sem narrativa
5. "Confiança da captura: 71%" sem referência (bom? ruim?)
6. Score 87 "top 20%" + 3 ações urgentes = frame inconsistente

## Passos

### 1. Resolver contradição hierárquica (mvp_pipeline.py)
- Quando `skin_alert` ativo: a seção "MUDANÇA PRINCIPAL" deve exibir a métrica de maior `deviation_score` **excluindo** `skin_spf_protocol` (que não é uma alavanca estrutural)
- Ou: tornar a seção "MUDANÇA PRINCIPAL" aware do skin_alert e exibir dois sub-campos: "estrutural" e "hábito urgente"
- Escolha: separar em `"Maior alavanca estrutural"` + `"Hábito urgente (alto retorno)"` no TXT quando skin_alert

### 2. Remover jargão "Tier" do TXT (mvp_pipeline.py)
- No bloco `3 AÇÕES PRIORIZADAS`, substituir `Tier: 0/1/2` por label legível:
  - tier 0 → "imediato"  (já existe em time_to_result, mas tier é diferente)
  - Solução: remover a linha `Tier: X` inteiramente do TXT; já existe `Tempo: X`

### 3. Eliminar redundância headline/sinal-positivo (impression_layer.py + mvp_pipeline.py)
- Opção A: mudar o headline para não repetir o positive_signal, tornando-o a síntese risco+positivo
- Opção B: remover o campo "Sinal positivo:" do TXT (fica no JSON)
- Escolha: Opção B — o TXT já tem headline que captura o positivo; campo duplicado some do TXT

### 4. Dar valor ao bloco de simulação (mvp_pipeline.py)
- Substituir lista de nomes de arquivo por copy que explica o que cada visualização mostra:
  - `symmetrized` → "Rosto com simetria maximizada — como você ficaria com assimetria zerada"
  - `ideal_proportions` → "Proporções ideais sobrepostas — referência visual dos ajustes possíveis"
  - `comparison_grid` → "Grade comparativa lado a lado — antes vs. projeção"

### 5. Contextualizar confiança da captura (mvp_pipeline.py)
- Adicionar label: ≥ 80% → "boa", 60–79% → "aceitável — resultados confiáveis", < 60% → "limitada — recomendamos nova foto"
- Exibir como: `Confiança da captura : 71%  (aceitável)`

### 6. Resolver inconsistência frame score alto + ações urgentes (mvp_pipeline.py)
- Para score ≥ 80: substituir header `"✅ 3 AÇÕES PRIORIZADAS"` por `"✨ 3 REFINAMENTOS DE ALTO IMPACTO"`
- E mudar o foco das descrições de "urgência" para "otimização"
- A frase `"efeito visual em semanas, custo mínimo"` já é ok; o que quebra é o header alarmista

## Arquivos tocados
- `mvp_pipeline.py` — passos 1, 2, 4, 5, 6
- `impression_layer.py` — passo 3 (remover positive_signal do TXT é no pipeline, mas garantir que headline já contenha o positivo)

## Testes
- 114/114 devem continuar passando (mudanças são apenas de copy/display)
- Rodar `python mvp_pipeline.py depois.png` e revisar cada seção

## Recommended Execution Model
sonnet
