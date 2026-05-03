# Produto: Versão Compartilhável do Resultado

**Status:** Diferido (pós-lançamento)  
**Depende de:** produto-entrada funcionando com clientes reais

---

## Objetivo

Transformar o resultado da análise em conteúdo que o próprio cliente quer compartilhar, gerando prova social orgânica sem custo de mídia.

---

## O Que Entregar

### Card Compartilhável (imagem estática)

Formato: PNG 1080×1080 ou 1080×1920 (Stories)

**Conteúdo do card:**
- Score de simetria em destaque (ex: "87/100")
- Tier em linguagem social ("Presença Visual Forte")
- 1 insight principal em frase curta
- 3 tags de percepção (ex: "simétrico · jovial · cuidado")
- Rodapé: branding mínimo + CTA ("Analise o seu →")

**Geração em Python:**
```python
# Usar Pillow (PIL) para composição tipográfica
# Sem IA — apenas layout programático com fonte + cores

from PIL import Image, ImageDraw, ImageFont

def generate_share_card(report_data: dict, output_path: str) -> str:
    """
    Args:
        report_data: JSON do mvp_pipeline com score, tier, first_impression, visual_status
    Returns:
        path do card PNG gerado
    """
```

**Componentes visuais:**
- Score circular (desenhar arco com PIL ou cv2)
- Barra de status visual (3 mini-barras: Dominância / Atratividade / Frescor)
- Fundo escuro com gradiente programático (numpy → PIL)
- Texto com fontes Open Source (Roboto, Inter, Montserrat via PIL ImageFont)

---

## Variantes

| Variante | Formato | Uso |
|----------|---------|-----|
| Story vertical | 1080×1920 | Instagram/TikTok Stories |
| Post quadrado | 1080×1080 | Feed Instagram/LinkedIn |
| Card horizontal | 1200×628 | Twitter/WhatsApp |

---

## Texto Pré-pronto para Legenda

Gerar automaticamente 3 opções de legenda com base nos insights:

```python
def generate_share_captions(report_data: dict) -> list[str]:
    """Retorna 3 opções de legenda para o cliente copiar e colar."""
```

Exemplos de template por tier:
- **Excelente:** "Análise de presença visual: {score}/100. {positive_signal} 🎯 Qual é o seu?"
- **Bom:** "Descobri o que estava reduzindo minha primeira impressão. Um ajuste simples. Curiosidade?"
- **Regular:** "Resultado surpreendeu. {main_risk_short}. Mas existe uma mudança que resolve agora."

---

## Implementação

### Passo 1 — Instalar Pillow

```bash
pip install Pillow
```

Já provavelmente disponível no venv. Verificar com `pip show pillow`.

### Passo 2 — Criar `share_card.py`

```python
# share_card.py
# Módulo autônomo: recebe report_data, gera card PNG + 3 legendas
# Interface:
def generate(report_data: dict, output_dir: str, variant: str = "square") -> dict:
    """
    Returns:
        {
            "card_path": str,
            "captions": list[str],
        }
    """
```

### Passo 3 — Integrar no `mvp_pipeline.py`

```python
# Após gerar o JSON principal, opcionalmente gerar card:
if args.share_card:
    from share_card import generate as gen_card
    share = gen_card(result, output_dir)
    result["share_card"] = share
```

Flag: `python mvp_pipeline.py foto.jpg --share-card`

---

## Métricas de Sucesso

- Taxa de compartilhamento ≥ 15% dos compradores
- Taxa de conversão de quem vê o card compartilhado ≥ 3%
- CPL (custo por lead) via prova social < 50% do CPL via anúncio pago

---

## O Que NÃO Fazer

- Não colocar dados sensíveis da foto no card público
- Não mostrar a foto real no card (privacidade + LGPD)
- Não usar branding pesado que pareça propaganda — deve parecer resultado pessoal
- Não criar card complexo demais — quanto mais simples, maior compartilhamento

---

## Dependências

- `Pillow` para composição do card
- Fontes: baixar Montserrat ou Inter (Open Font License) em `assets/fonts/`
- Nenhuma API externa necessária

---

## Timeline Sugerida

- Implementar após os primeiros 50 compradores validarem o produto core
- Testar com 10 clientes antes de escalar (enviar card manualmente)
- Automatizar no pipeline após validação manual
