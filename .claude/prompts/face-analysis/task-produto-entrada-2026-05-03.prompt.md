# Task: Produto de Entrada — Implementação dos Módulos Python

**Module:** face-analysis  
**Type:** feature  
**Slug:** produto-entrada  
**Date:** 2026-05-03  
**Model:** sonnet  
**Plan:** `.claude/plans/produto-entrada-2026-05-03.md`

---

## Objetivo

Implementar os blocos técnicos que transformam o pipeline de análise facial existente no produto comercial de entrada (R$9,90–R$29,90 / análise). O produto recebe uma única foto de frente e entrega: diagnóstico de primeira impressão, mudança de maior alavanca, antes/depois simulado, 3 ações priorizadas, trilha de evolução e score de status visual.

---

## Contexto do Projeto

**Stack:** Python 3, dlib 68-pt landmarks, OpenCV, scipy, numpy  
**Ambiente:** venv em `/home/luizescobal/study/face-before-after/.venv`  
**Rodar testes:** `pytest tests/` (no venv ativado)

### Arquivos existentes relevantes

| Arquivo | Responsabilidade |
|---------|-----------------|
| `face_asymmetry.py` | Detecta landmarks, calcula 9 métricas de assimetria + `overall_asymmetry_score` |
| `face_metrics.py` | Calcula 40+ métricas avançadas (proporções, jaw, cantal tilt, pele, pose) |
| `recommendations.py` | Catálogo `REC_CATALOG` com ações por severidade por chave de métrica |
| `mvp_pipeline.py` | Pipeline principal: recebe foto → gera JSON + TXT com score, tier, top3, main_insight |
| `glossary.py` | Ranges ideais, definições técnicas, citações por métrica |

### Métricas-chave disponíveis (de `face_metrics.py`)

```python
# Percepção de dominância/força
fwhr                         # ideal ~1.85 (Lefevre 2012)
jawline_definition_score     # angular variance da mandíbula
bizygomatic_to_bigonial_ratio
gonial_angle_mean_deg        # ângulo mandibular médio

# Percepção de atratividade
canthal_tilt_mean_deg        # ideal ~+5° (Rhee 2012)
overall_asymmetry_score_pct_ipd  # <1% = excelente
thirds_std_dev               # ideal 0 (equilíbrio dos terços)
lower_third_ratio            # ideal ~0.56 masculino

# Percepção de cuidado/saúde (frescor)
skin_uniformity_std_lab_left
skin_uniformity_std_lab_right
skin_uniformity_std_lab_forehead
under_eye_darkness_left
under_eye_darkness_right
eye_aspect_ratio_mean        # abertura ocular

# Qualidade da foto
head_pose_yaw_deg            # |yaw| ≤ 7° = ok
head_pose_pitch_deg
head_pose_roll_deg
sharpness_laplacian_var
frontal_ok                   # bool
```

### Estrutura do `REC_CATALOG` em `recommendations.py`

Cada entrada em `REC_CATALOG` é um dict com chaves:
```python
{
    "label": str,
    "ideal": str,
    "what_is": str,
    "how_measured": str,
    "why_matters": str,
    "actions_by_severity": {
        "leve": [{"tipo", "titulo", "descricao", "frequencia", "fonte"}, ...],
        "moderada": [...],
        "acentuada": [...],
    },
    "references": [{"titulo", "url"}, ...],
}
```

### Estrutura atual do JSON de saída (`mvp_pipeline.py`)

```json
{
  "score": 96,
  "tier": "Excelente",
  "tier_description": "...",
  "main_insight": {
    "short_name": "...",
    "detail": "..."
  },
  "top_3_actions": [
    {"rank": 1, "action": "...", "detail": "..."}
  ],
  "measurements": {
    "eye_level_difference_px": 0.0,
    "overall_asymmetry_score": 0.51,
    ...
  },
  "rotation_deg": 0.0,
  "generated_at": "..."
}
```

---

## Tarefa 1 — Atualizar `recommendations.py`

Adicionar 5 novos campos em cada entrada do `REC_CATALOG`. **NÃO alterar** a estrutura existente, apenas adicionar campos novos.

### Campos a adicionar por entrada

```python
"actionability_tier": int,  # 0=hoje/grátis, 1=semanas/custo baixo, 2=profissional acessível, 3=cirurgia
"time_to_result": str,      # "imediato" | "semanas" | "meses" | "longo_prazo"
"cost_level": int,          # 0=grátis, 1=barato <R$50, 2=moderado R$50-500, 3=alto >R$500
"mutable": bool,            # True se pode mudar sem cirurgia
"social_perception_weight": float,  # 0.0–1.0, impacto na percepção social (≠ importância técnica)
```

### Valores para cada métrica existente no catálogo

| Métrica | actionability_tier | time_to_result | cost_level | mutable | social_perception_weight |
|---------|-------------------|---------------|-----------|---------|------------------------|
| `overall_asymmetry_score_pct_ipd` | 0 | "semanas" | 0 | True | 0.90 |
| `fwhr` | 1 | "meses" | 1 | True | 0.75 |
| `lower_third_ratio` | 1 | "meses" | 0 | True | 0.50 |
| `canthal_tilt_mean_deg` | 1 | "semanas" | 1 | True | 0.85 |
| `intercanthal_to_eyewidth_ratio` | 0 | "imediato" | 0 | False | 0.60 |
| `nasal_to_mouth_width_ratio` | 0 | "imediato" | 0 | False | 0.65 |
| `mouth_to_ipd_ratio` | 0 | "imediato" | 0 | True | 0.45 |
| `thirds_std_dev` | 0 | "imediato" | 0 | True | 0.55 |
| `fifths_std_dev` | 0 | "imediato" | 0 | False | 0.40 |

Para métricas **não listadas** acima (se existirem no catálogo), usar defaults conservadores:
- `actionability_tier=2`, `time_to_result="meses"`, `cost_level=2`, `mutable=False`, `social_perception_weight=0.50`

---

## Tarefa 2 — Criar `impression_layer.py`

### Interface pública

```python
def build_first_impression(metrics: dict) -> dict:
    """
    Args:
        metrics: dict retornado por face_metrics.compute() ou face_asymmetry.analyze()
                 Espera pelo menos: canthal_tilt_mean_deg, under_eye_darkness_left,
                 under_eye_darkness_right, fwhr, jawline_definition_score,
                 skin_uniformity_std_lab_left, skin_uniformity_std_lab_right,
                 overall_asymmetry_score_pct_ipd, eye_aspect_ratio_mean
    Returns:
        {
            "headline": str,      # 1 frase, linguagem social/benefício
            "tags": list[str],    # 2–4 adjetivos de percepção (ex: ["descansado", "simétrico"])
            "main_risk": str,     # fator que mais derruba a impressão hoje
            "positive_signal": str  # ponto forte da face (sempre presente)
        }
    """
```

### Mapeamentos obrigatórios

Implementar como conjunto de regras avaliadas em ordem de prioridade (primeiro match wins para `main_risk`; `headline` é construída combinando sinais):

```python
IMPRESSION_RULES = [
    # (condição, tag_negativa, narrativa_risco)
    # Cansaço/exaustão
    {
        "id": "tired_eyes",
        "condition": lambda m: m.get("canthal_tilt_mean_deg", 5) < 0 and
                               (m.get("under_eye_darkness_left", 0) + m.get("under_eye_darkness_right", 0)) / 2 > 0.15,
        "risk": "Olhar transmite cansaço — olhos caídos e área periorbital escura reduzem energia visual",
        "tag": "aparência cansada",
    },
    # Falta de força/presença
    {
        "id": "low_dominance",
        "condition": lambda m: m.get("fwhr", 1.85) < 1.6 and m.get("jawline_definition_score", 0.5) < 0.3,
        "risk": "Estrutura facial suave reduz percepção de presença — mandíbula e proporção de largura abaixo do ideal",
        "tag": "presença suave",
    },
    # Pele/cuidado
    {
        "id": "skin_care",
        "condition": lambda m: ((m.get("skin_uniformity_std_lab_left", 0) +
                                 m.get("skin_uniformity_std_lab_right", 0)) / 2) > 20,
        "risk": "Irregularidade de tom de pele visível — isso afeta diretamente a percepção de cuidado",
        "tag": "pele irregular",
    },
    # Assimetria perceptível
    {
        "id": "visible_asymmetry",
        "condition": lambda m: m.get("overall_asymmetry_score_pct_ipd", 0) > 3.0,
        "risk": "Assimetria facial acima do limiar perceptível — é o fator com maior peso na percepção atual",
        "tag": "assimetria visível",
    },
    # Olhos fechados/cansados
    {
        "id": "low_ear",
        "condition": lambda m: m.get("eye_aspect_ratio_mean", 0.3) < 0.22,
        "risk": "Abertura ocular reduzida — olhos pouco abertos passam sensação de sonolência ou desinteresse",
        "tag": "olhos pouco abertos",
    },
]

POSITIVE_SIGNALS = [
    {
        "id": "high_symmetry",
        "condition": lambda m: m.get("overall_asymmetry_score_pct_ipd", 99) < 1.0,
        "signal": "Alta simetria facial — ativo visual forte e raro",
    },
    {
        "id": "good_canthal",
        "condition": lambda m: m.get("canthal_tilt_mean_deg", 0) >= 3.0,
        "signal": "Olhar jovial e energético — canthal tilt positivo aumenta atratividade percebida",
    },
    {
        "id": "strong_presence",
        "condition": lambda m: m.get("fwhr", 0) >= 1.85,
        "signal": "Presença marcante — proporção facial associada a autoridade e confiança",
    },
    {
        "id": "fresh_skin",
        "condition": lambda m: ((m.get("skin_uniformity_std_lab_left", 99) +
                                 m.get("skin_uniformity_std_lab_right", 99)) / 2) < 12,
        "signal": "Tom de pele uniforme — transmite cuidado e saúde visualmente",
    },
    {
        "id": "default",
        "condition": lambda m: True,  # fallback
        "signal": "Face detectada com qualidade suficiente para análise completa",
    },
]
```

### Lógica da headline

```python
# Pseudocódigo
risks_found = [r for r in IMPRESSION_RULES if r["condition"](metrics)]
positive = next(p for p in POSITIVE_SIGNALS if p["condition"](metrics))

if not risks_found:
    headline = f"Primeira impressão sólida. {positive['signal']}."
elif len(risks_found) == 1:
    headline = f"{positive['signal'].split('—')[0].strip()}. O que está pesando mais: {risks_found[0]['risk'].split('—')[0].lower()}."
else:
    headline = f"Dois fatores estão reduzindo sua impressão visual. O mais impactante: {risks_found[0]['risk'].split('—')[0].lower()}."
```

---

## Tarefa 3 — Criar `visual_status.py`

### Interface pública

```python
def build_visual_status(metrics: dict) -> dict:
    """
    Returns:
        {
            "dominance_score": float,      # 0–10
            "attractiveness_score": float, # 0–10
            "freshness_score": float,      # 0–10
            "narrative": str               # texto interpretativo 2–3 frases
        }
    """
```

### Fórmulas de score (normalização linear para 0–10)

#### Dominância (força/presença)

```python
# fWHR: ideal=1.85, range considerado 1.4–2.2
fwhr_score = clamp((m.get("fwhr", 1.85) - 1.4) / (2.2 - 1.4) * 10, 0, 10)

# jawline_definition: ideal alto, range 0–1
jaw_score = clamp(m.get("jawline_definition_score", 0.5) * 10, 0, 10)

# bizygomatic_to_bigonial: ideal ~1.3 (zigomático mais largo que gonial)
bzg_ratio = m.get("bizygomatic_to_bigonial_ratio", 1.3)
bzg_score = clamp(10 - abs(bzg_ratio - 1.3) * 20, 0, 10)

dominance_score = (fwhr_score * 0.5 + jaw_score * 0.35 + bzg_score * 0.15)
```

#### Atratividade

```python
# canthal_tilt: ideal=+5, penalizar negativo fortemente
tilt = m.get("canthal_tilt_mean_deg", 5)
tilt_score = clamp((tilt + 5) / 12 * 10, 0, 10)  # [-5, +7] → [0, 10]

# simetria: ideal=0% IPD, acentuada=5%+ IPD
asym = m.get("overall_asymmetry_score_pct_ipd", 0)
sym_score = clamp((5.0 - asym) / 5.0 * 10, 0, 10)

# thirds balance: ideal std_dev=0, piora com desvio
thirds = m.get("thirds_std_dev", 0)
thirds_score = clamp(10 - thirds * 50, 0, 10)  # 0.2 std_dev → score 0

attractiveness_score = (tilt_score * 0.45 + sym_score * 0.40 + thirds_score * 0.15)
```

#### Frescor (cuidado/saúde)

```python
# skin uniformity: ideal std_lab < 10, ruim > 25
skin_std = (m.get("skin_uniformity_std_lab_left", 15) + m.get("skin_uniformity_std_lab_right", 15)) / 2
skin_score = clamp((25 - skin_std) / 15 * 10, 0, 10)

# under-eye darkness: ideal < 0.05, ruim > 0.25
eye_dark = (m.get("under_eye_darkness_left", 0.1) + m.get("under_eye_darkness_right", 0.1)) / 2
dark_score = clamp((0.25 - eye_dark) / 0.20 * 10, 0, 10)

# EAR: ideal 0.28–0.35, penalizar < 0.22
ear = m.get("eye_aspect_ratio_mean", 0.28)
ear_score = clamp((ear - 0.18) / 0.17 * 10, 0, 10)  # [0.18, 0.35] → [0, 10]

freshness_score = (skin_score * 0.45 + dark_score * 0.35 + ear_score * 0.20)
```

### Narrativa

```python
def _build_narrative(d: float, a: float, f: float) -> str:
    # Identificar dimensão mais alta e mais baixa
    scores = {"dominância": d, "atratividade": a, "frescor": f}
    strongest = max(scores, key=scores.get)
    weakest = min(scores, key=scores.get)
    
    narratives = {
        ("dominância", "frescor"): "Presença e estrutura são seus pontos fortes. Recuperar a aparência de energia visual é o próximo passo de maior impacto.",
        ("dominância", "atratividade"): "Você transmite autoridade. Ajustar o ângulo do olhar e a simetria amplia ainda mais sua presença.",
        ("atratividade", "dominância"): "Você tem harmonia e equilíbrio visual. Aumentar a percepção de força facial é o passo que mais soma.",
        ("atratividade", "frescor"): "Harmonia facial forte. Aparência de descanso e cuidado com pele é o que mais impacta agora.",
        ("frescor", "dominância"): "Você transmite saúde e cuidado. Fortalecer a percepção de presença é a alavanca disponível.",
        ("frescor", "atratividade"): "Aparência saudável e descansada. Trabalhar simetria e proporções amplia o impacto.",
    }
    key = (strongest, weakest)
    return narratives.get(key, f"Seus pontos mais fortes são {strongest} ({scores[strongest]:.1f}/10). Maior oportunidade: {weakest} ({scores[weakest]:.1f}/10).")
```

---

## Tarefa 4 — Criar `simulate_before_after.py`

### Interface pública

```python
def simulate(
    image_path: str,
    landmarks: list,  # lista de (x, y) com 68 pontos (output do dlib)
    output_dir: str,
) -> dict:
    """
    Gera 3 imagens de simulação e retorna os caminhos.
    
    Returns:
        {
            "symmetrized": str,         # path da imagem simetrizada
            "ideal_proportions": str,   # path com anotações de proporções ideais
            "comparison_grid": str,     # path do grid 1×3: original | simetrizado | proporções
        }
    """
```

### Camada A — Simetrização

```python
# Algoritmo:
# 1. Calcular midline_x = (landmarks[36][0] + landmarks[45][0]) / 2
# 2. Determinar metade "melhor" (menor assimetria média dos landmarks em relação à midline)
# 3. Espelhar a metade melhor usando cv2.flip parcial via máscara + cv2.seamlessClone
#    OU: abordagem simples com warpAffine + blend linear

# Implementação simples (sem seamlessClone para evitar artefatos):
# a. Flip horizontal da imagem inteira
# b. Blend ponderado: 60% metade melhor (original) + 40% metade espelhada
# c. Aplicar máscara suave na região de blend (gradiente na midline ±20px)
```

### Camada B — Anotação de Proporções Ideais

```python
# Desenhar sobre a imagem original:
# 1. Terços horizontais (3 linhas pontilhadas):
#    - Calcular y_trichion (estimado), y_glabella (landmark 21/22 média), y_nasion (landmark 27), y_menton (landmark 8)
#    - Linha verde pontilhada em y_glabella e y_nasion
# 2. Quintos verticais (4 linhas pontilhadas):
#    - x_left_temple (landmark 0), x_left_eye_outer (36), x_left_eye_inner (39)
#    - x_right_eye_inner (42), x_right_eye_outer (45), x_right_temple (16)
#    - Ideal: 5 quintos iguais entre landmark 0 e 16
# 3. Canthal tilt ideal (+5°):
#    - Para cada olho: desenhar linha verde no ângulo +5° a partir do canto medial
#    - Comparar com linha real (colorir por desvio: verde=ok, laranja=leve, vermelho=significativo)
# 4. Razão nariz/boca:
#    - Ideal: alar width = 70% mouth width
#    - Desenhar bracket verde na largura ideal do nariz abaixo dos nostrils

# Código de cor:
GREEN = (0, 200, 0)
ORANGE = (0, 165, 255)   # BGR
RED = (0, 0, 220)
FONT = cv2.FONT_HERSHEY_SIMPLEX
```

### Comparação Grid

```python
# grid = np.hstack([img_original, img_symmetrized, img_proportions])
# Adicionar labels em cima de cada coluna: "Original", "Simetrizado", "Proporções Ideais"
```

---

## Tarefa 5 — Criar `evolution_path.py`

### Interface pública

```python
def build_evolution_path(metrics: dict, recommendations_catalog: dict) -> dict:
    """
    Returns:
        {
            "phase_1": {
                "label": "Esta semana (0–7 dias)",
                "focus": str,       # foco da fase
                "actions": list[dict],  # ações tier_0
                "target_metric": str,   # métrica esperada melhorar
                "reanalysis_date": str  # "em 7 dias"
            },
            "phase_2": {
                "label": "Próximos 30 dias",
                "focus": str,
                "actions": list[dict],  # ações tier_1
                "target_metric": str,
                "reanalysis_date": str
            },
            "phase_3": {
                "label": "3 meses",
                "focus": str,
                "actions": list[dict],  # ações tier_2 (se indicado)
                "target_metric": str,
                "reanalysis_date": str,
                "requires_professional": bool
            },
            "mutable_metrics": list[str]  # métricas que podem mudar sem cirurgia
        }
    """
```

### Lógica

```python
def get_mutable_metrics_out_of_range(metrics, catalog):
    """Retorna lista de chaves de métricas que são mutáveis E estão fora do ideal."""
    # Importar face_metrics para usar severity_for() / adv_severity()
    # Para cada key em catalog onde catalog[key]["mutable"] == True:
    #   Calcular severidade da métrica atual
    #   Se severidade != "excelente": incluir na lista

def _get_actions_by_tier(metrics, catalog, tier):
    """Retorna ações do catalog para métricas fora do ideal com actionability_tier == tier."""
    # Para cada métrica mutável fora do ideal:
    #   Pegar severidade (leve/moderada/acentuada)
    #   Filtrar actions onde tipo não requer cirurgia (tier 0 e 1 = habito/postura/exercicio)
```

---

## Tarefa 6 — Criar `top_leverage.py`

### Interface pública

```python
def get_top_leverage_recommendation(metrics: dict, max_tier: int = 1) -> dict:
    """
    Retorna a 1 recomendação com maior alavancagem social dentro do tier máximo.
    
    Returns:
        {
            "metric_key": str,
            "short_action": str,    # 1 linha: o que fazer
            "why_it_matters": str,  # 1 linha: benefício percebido (NÃO déficit técnico)
            "time_to_result": str,
            "tier": int,
            "deviation_score": float  # distância do ideal × social_perception_weight
        }
    """

def get_top3_actions(metrics: dict, max_tier: int = 2) -> list[dict]:
    """
    Retorna 3 ações garantindo variedade de tier (1 por tier quando possível).
    Cada ação: {"rank", "short_action", "why_it_matters", "time_to_result", "tier"}
    """
```

### Algoritmo de ranking

```python
# 1. Para cada métrica no catalog:
#    a. Calcular deviation_from_ideal (usar face_metrics.adv_severity ou calcular normalized distance)
#    b. Filtrar: actionability_tier <= max_tier
#    c. Score = social_perception_weight × deviation_from_ideal
# 2. Ordenar por score DESC
# 3. get_top_leverage: retornar o primeiro
# 4. get_top3: retornar 1 tier_0 + 1 tier_1 + 1 tier_2 (ou os melhores disponíveis)

# Para "why_it_matters" (linguagem de benefício):
WHY_BENEFIT_MAP = {
    "overall_asymmetry_score_pct_ipd": "melhora imediatamente como você é percebido em fotos e vídeos",
    "canthal_tilt_mean_deg": "aumenta a percepção de juventude e energia visual",
    "fwhr": "amplia a percepção de presença e autoridade",
    "intercanthal_to_eyewidth_ratio": "elimina distorção que prejudica a primeira impressão na foto",
    "nasal_to_mouth_width_ratio": "equilibra as proporções centrais — o que mais capta atenção no rosto",
    # ... default:
    "_default": "aumenta o impacto da sua presença visual",
}
```

---

## Tarefa 7 — Atualizar `mvp_pipeline.py`

### O que adicionar

1. Importar os 4 novos módulos (após verificar que existem):
```python
from impression_layer import build_first_impression
from visual_status import build_visual_status
from top_leverage import get_top_leverage_recommendation, get_top3_actions
from evolution_path import build_evolution_path
import recommendations as rec
```

2. Após calcular `measurements` com `face_metrics.compute()`, adicionar:
```python
# Novos campos do produto de entrada
first_impression = build_first_impression(measurements)
visual_status_data = build_visual_status(measurements)
top_leverage = get_top_leverage_recommendation(measurements, max_tier=1)
top3 = get_top3_actions(measurements, max_tier=2)
evolution = build_evolution_path(measurements, rec.REC_CATALOG)
```

3. Estender o dict de saída JSON **sem quebrar campos existentes**:
```python
report.update({
    "first_impression": first_impression,
    "visual_status": visual_status_data,
    "top_leverage": top_leverage,
    "top3_actions_v2": top3,   # usar "top3_actions_v2" para não quebrar "top_3_actions" existente
    "evolution_path": evolution,
})
```

4. Atualizar o relatório TXT (`build_shareable_report`) para incluir:
   - `first_impression["headline"]` logo abaixo do score
   - `visual_status` em formato tabela simples (Dominância: X/10, Atratividade: Y/10, Frescor: Z/10)
   - `top_leverage["short_action"]` como "AÇÃO PRINCIPAL"

---

## Tarefa 8 — Criar testes

### `tests/test_impression_layer.py`

```python
# Cenários obrigatórios:
# 1. metrics com canthal < 0 e under_eye_darkness > 0.15 → "tired_eyes" in tags
# 2. metrics com assimetria > 3% IPD → "assimetria visível" in main_risk
# 3. metrics perfeitas (assimetria < 1%, canthal > 3) → headline positiva
# 4. build_first_impression retorna todas as chaves ("headline", "tags", "main_risk", "positive_signal")
```

### `tests/test_visual_status.py`

```python
# Cenários obrigatórios:
# 1. fwhr=2.0, jaw=0.8 → dominance_score > 7
# 2. canthal=-3, asym=5% → attractiveness_score < 4
# 3. skin_std=8, eye_dark=0.03 → freshness_score > 8
# 4. build_visual_status retorna "dominance_score", "attractiveness_score", "freshness_score", "narrative"
# 5. todos os scores estão no range 0–10
```

### `tests/test_top_leverage.py`

```python
# Cenários obrigatórios:
# 1. metrics com canthal moderadamente ruim → retorna ação com tier <= 1
# 2. get_top3_actions retorna exatamente 3 itens
# 3. cada ação tem "short_action", "why_it_matters", "time_to_result", "tier"
# 4. recomendação principal nunca é tier 3 quando max_tier=1
```

---

## Guardrails

1. **Sem IA generativa** — toda simulação é OpenCV + numpy puro
2. **Compatibilidade retroativa** — campos existentes em `mvp_pipeline.py` não podem ser removidos ou renomeados
3. **Tratamento de métricas ausentes** — usar `dict.get(key, default_value)` em todo lugar; nunca `.get()` sem default em métricas opcionais
4. **Score sempre 0–10** — usar função `clamp(val, 0, 10)` antes de retornar qualquer score
5. **Tier_3 bloqueado no produto de entrada** — `max_tier=1` para `get_top_leverage_recommendation` em `mvp_pipeline.py`

---

## Critério de Conclusão

- [ ] `python mvp_pipeline.py <foto>` retorna JSON com `first_impression`, `visual_status`, `top_leverage`, `top3_actions_v2`, `evolution_path`
- [ ] `pytest tests/` passa sem regressão (incluindo `test_face_metrics.py` e `test_recommendations.py` existentes)
- [ ] Toda foto válida retorna pelo menos 1 ação em tier_0
- [ ] Recomendação principal nunca é tier_3
- [ ] Simulação gera 3 imagens sem erro para foto frontal válida
