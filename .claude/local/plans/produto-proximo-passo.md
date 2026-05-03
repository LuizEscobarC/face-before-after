# Produto: Chamada para o Próximo Passo

**Status:** Diferido — mas deve estar pronto antes do lançamento  
**Prioridade:** Alta (é o mecanismo de upsell e retenção)

---

## Objetivo

No momento em que a pessoa recebe o resultado, capturar o impulso de melhoria e convertê-lo em próxima compra ou assinatura — sem quebrar o fluxo emocional criado pelo diagnóstico.

---

## Princípio

> "A chamada para o próximo passo é parte do produto, não um anúncio."

O resultado da análise deve terminar com uma porta aberta natural, não um CTA agressivo. A pessoa acabou de receber um insight valioso — ela está em estado receptivo. O próximo passo precisa parecer a continuação lógica, não uma venda.

---

## Estrutura do Próximo Passo

### 3 Caminhos por Perfil de Resultado

#### Perfil A — Score Alto (≥ 75): "Você já tem uma base forte"

**Mensagem:** "Seu ativo visual já está acima da média. O que você pode fazer agora é manter e refinar."

**Próximo passo:** Re-análise em 30 dias para confirmar progresso + comparativo antes/depois

**CTA:** "Quero acompanhar minha evolução" → Assinatura mensal (R$X/mês)

---

#### Perfil B — Score Médio (45–74): "Existe oportunidade clara"

**Mensagem:** "A mudança principal está identificada. O próximo passo é confirmar que você está no caminho certo."

**Próximo passo:** Análise completa com simulação visual e plano de 30 dias

**CTA:** "Quero o plano completo" → Produto intermediário (R$X)

---

#### Perfil C — Score Baixo (< 45): "Mudança possível, começo imediato"

**Mensagem:** "Existe potencial real aqui. A boa notícia: o ajuste principal é acessível e você pode começar hoje."

**Próximo passo:** Análise completa + acompanhamento de 3 meses com checkpoints

**CTA:** "Quero começar agora" → Produto premium ou assinatura trimestral

---

## Implementação Técnica

### Campo `next_step` no JSON de saída

```python
# Adicionar em mvp_pipeline.py após calcular o score:
def build_next_step(score: int, evolution_path: dict) -> dict:
    """
    Gera chamada para próximo passo baseada no score e na trilha de evolução.
    
    Returns:
        {
            "profile": str,      # "alto" | "medio" | "baixo"
            "message": str,      # mensagem de ponte (resultado → próximo)
            "action": str,       # ação específica sugerida
            "cta_text": str,     # texto do botão/link
            "cta_type": str,     # "assinatura" | "upgrade" | "reanalise"
            "urgency_hook": str, # gancho de urgência contextual (opcional)
        }
    """
    if score >= 75:
        profile = "alto"
        message = "Seu ativo visual já está acima da média. O próximo passo é manter e refinar."
        action = "Re-análise em 30 dias para confirmar progresso"
        cta_text = "Quero acompanhar minha evolução"
        cta_type = "assinatura"
    elif score >= 45:
        profile = "medio"
        message = "A mudança principal está identificada. Confirmar o progresso é o próximo passo."
        action = "Análise completa com simulação e plano de 30 dias"
        cta_text = "Quero o plano completo"
        cta_type = "upgrade"
    else:
        profile = "baixo"
        message = "Existe potencial real. O ajuste principal é acessível e começa hoje."
        action = "Análise completa com acompanhamento de 3 meses"
        cta_text = "Quero começar agora"
        cta_type = "upgrade"
    
    # Gancho de urgência contextual baseado nas fases da trilha de evolução
    phase_1_actions = evolution_path.get("phase_1", {}).get("actions", [])
    urgency_hook = ""
    if phase_1_actions:
        first_action = phase_1_actions[0].get("titulo", "")
        urgency_hook = f"Você pode começar com '{first_action}' ainda hoje."
    
    return {
        "profile": profile,
        "message": message,
        "action": action,
        "cta_text": cta_text,
        "cta_type": cta_type,
        "urgency_hook": urgency_hook,
    }
```

### Integração em `mvp_pipeline.py`

```python
# Após calcular evolution_path:
next_step = build_next_step(score, evolution)
result["next_step"] = next_step
```

### Exibição no relatório TXT

```
══════════════════════════════════════════════════════════════
  → PRÓXIMO PASSO
══════════════════════════════════════════════════════════════
  {next_step["message"]}

  {next_step["urgency_hook"]}

  [ {next_step["cta_text"]} ]
══════════════════════════════════════════════════════════════
```

---

## Regras de Copy

1. **Nunca usar "compre agora"** — usar "quero", "vejo", "confirmo"
2. **Nunca mencionar preço no relatório** — o preço fica na página de venda
3. **O CTA precisa soar como continuação, não interrupção** — "próximo passo" > "oferta"
4. **Personalizar com o insight do resultado** — mencionar a métrica real, não genérica
5. **Uma única chamada por relatório** — mais de uma dilui e confunde

---

## Testes de Copy

Antes de lançar, testar pelo menos 3 versões do CTA:

| Versão | CTA | Hipótese |
|--------|-----|----------|
| A | "Quero o plano completo" | Clareza sobre o produto |
| B | "Ver minha evolução em 30 dias" | Foco no resultado futuro |
| C | "Começar agora" | Urgência + simplicidade |

Medir: taxa de clique no CTA dentro do relatório (se for HTML) ou tráfego para a URL de upsell.

---

## Escada de Valor (resumo)

| Produto | Preço | Gatilho |
|---------|-------|---------|
| Diagnóstico rápido (entrada) | R$9,90–R$29,90 | Curiosidade + evento próximo |
| Análise completa + simulação | R$49–R$79 | Quem quer o plano completo |
| Check-in antes de evento | R$29–R$49 | Urgência contextual (casamento, entrevista) |
| Assinatura mensal | R$19–R$39/mês | Quem quer acompanhar evolução |
| Histórico comparativo | Incluso na assinatura | Retenção via valor acumulado |

---

## Dependências

- `build_next_step()` em `mvp_pipeline.py` (implementação acima)
- URL de upsell funcional antes de lançar (página de venda ou checkout)
- Analytics de clique no CTA (Pixel FB/GA ou UTM simples no link)

---

## Timeline

- Implementar `build_next_step()` antes do primeiro lançamento
- URL de upsell precisa existir no dia do lançamento
- Testar copy com os primeiros 20 compradores manualmente antes de automatizar variante B/C
