# Task: Grupo 1 — Fundacao de Dados e Personalizacao Real

**Module:** face-analysis  
**Type:** feature  
**Slug:** grupo-1-fundacao-personalizacao  
**Date:** 2026-05-03  
**Model:** sonnet  
**Plan:** `.claude/local/plans/produto-entrada-2026-05-03.md`

---

## Objetivo

Integrar `face_metrics.compute_all` no fluxo de `run` em `mvp_pipeline.py` para eliminar fallback excessivo e garantir que os modulos de produto usem metricas avancadas reais.

---

## Escopo

1. Integrar `compute_all` ao pipeline principal apos alinhamento facial.
2. Unificar `measurements` com blocos:
- assimetria (`face_asymmetry`)
- advanced (`face_metrics`)
- skin (`face_metrics`)
- photo_quality (`face_metrics`)
3. Preservar compatibilidade de chaves legadas do JSON.
4. Criar `capture_confidence` de 0 a 1 usando:
- `frontal_ok`
- `sharpness_laplacian_var`
- `lighting_asymmetry_delta_e`
- `focal_distortion_warning`

---

## Arquivos-alvo

- `mvp_pipeline.py`
- `face_metrics.py` (somente se necessario para suporte de chaves)

---

## Regras

- Nao quebrar CLI atual (`python mvp_pipeline.py <foto> --output-dir ...`).
- Nao remover campos legados existentes do JSON.
- Manter `capture_confidence` com escala interpretavel [0,1].
- Se algum bloco avancado falhar, retornar erro explicito sem mascarar falhas de captura critica.

---

## Criterios de Aceite

- `impression_layer.py`, `visual_status.py`, `top_leverage.py` e `evolution_path.py` passam a usar dados avancados reais do pipeline.
- `capture_confidence` existe no JSON final e varia conforme qualidade real da foto.
- `pytest tests/` passa sem regressao.

---

## Verificacao

```bash
source .venv/bin/activate
python -m pytest tests/ -v
./mvp_pipeline.py depois.png
```

Validar no JSON final:
- `measurements` contendo chaves de assimetria + advanced + skin + photo_quality
- `capture_confidence`





context:

gere prompts agrupados com prompt-initializer para desenvolver todos os pontos mencionados:


Diagnóstico da primeira impressão

Já faz: sim, via impression_layer.py.

Falta: alimentar com métricas avançadas reais (não só assimetria em px e %IPD).

Tirar algo: eu tiraria qualquer texto técnico em px da camada principal para usuário final e manteria só linguagem de benefício.

Observação crítica: o TXT não está exibindo essa camada de primeira impressão no fluxo atual do report em mvp_pipeline.py.

A única mudança com maior alavanca

Já faz: sim, a lógica de alavancagem existe em top_leverage.py.

Como identificar: social_perception_weight × desvio normalizado vs ideal.

Falta: alguns campos do catálogo não têm ideal/tolerância em face_metrics.py, então certos itens nunca ganham score forte mesmo quando deveriam.

Todo rosto terá proposta: terá fallback, mas só fica realmente personalizada quando integrar o bloco advanced + skin.

Antes/depois simulado sem IA paga

Já faz: você já tem implementação viável em simulate_before_after.py com OpenCV/Numpy.

Sem IA, opções boas:

Simetrização por espelhamento/blend (já implementado).

Overlay de proporções ideais (já implementado).

Ajustes fotográficos de alto impacto: iluminação, enquadramento, correção de pose.

Crítica: módulo existe, mas ainda não está plugado no fluxo principal de mvp_pipeline.py.

3 ações práticas ordenadas por prioridade real

Hoje você tem duas trilhas paralelas:

Top 3 antigo por impacto em px no próprio mvp_pipeline.py.

Top 3 novo por alavancagem social em top_leverage.py.

Crítica: isso gera conflito de narrativa e pode confundir usuário.

Recomendação: manter só uma hierarquia oficial para produto (a nova), e deixar a antiga apenas como debug interno.

Caminho curto de evolução

Já faz: sim, em 3 fases no evolution_path.py.

Base está correta para MVP: fase imediata, 30 dias, 90 dias.

Falta: qualidade/confiança da medição para não recomendar plano “forte” em foto ruim.

Métricas suficientes: para MVP, sim; para escala, faltam sinais de qualidade de captura e confiabilidade por recomendação.

Leitura de status visual (força, cuidado, atratividade)

Já faz: sim, em visual_status.py.

Plano técnico: dominar com fwhr/jaw, atratividade com canthal/simetria/terços, cuidado com pele/olheira/EAR.

Falta: novamente, integrar métricas avançadas no pipeline principal.

Crítica: sem isso, os 3 scores parecem “bonitos” mas não necessariamente responsivos ao rosto real.

Recomendação principal com máxima alavancagem percebida

Já faz: sim em top_leverage.py.

Plano correto: limitar tier no produto de entrada (já existe max_tier).

Falta: calibrar cobertura de ideais para todas as métricas relevantes e exibir confiança da recomendação.

Resultado esperado após integração: “ação única” realmente pessoal, que é o coração comercial do produto.

Versão compartilhável deixar para depois

Sim, pode e deve deixar para depois sem bloquear venda inicial.

Já está detalhado em produto-compartilhavel.md.

Chamada para próximo passo

Sim, deve existir já no resultado para capturar impulso.

Já está detalhado em produto-proximo-passo.md.

Plano objetivo para destravar lançamento

Integrar no run do MVP as saídas de face_metrics.py junto com assimetria.
Unificar o motor de prioridade em apenas uma lista de 3 ações.
Exibir first impression + status + next step no relatório final.
