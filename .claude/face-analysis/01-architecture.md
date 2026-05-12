# Arquitetura do Pipeline — Face Analysis

## Stack atual

```
Frontend React (Vite) ──► NestJS API (nest/) ──► Python backend (backend/)
                                │
                          PostgreSQL :9019
                          (face_analysis)
```

## Módulos NestJS (`nest/src/modules/`)

| Módulo | Responsabilidade |
|--------|-----------------|
| `vision/` | Pipeline principal: landmarks → métricas → análise |
| `analysis/` | Histórico de análises + comparação antes/depois |
| `catalog/` | Catálogo de métricas do DB (`metric_definition`) |
| `diagnosis/` | Recomendações + `animationConfig` / `biometricConfig` |
| `photo-quality/` | Score de qualidade da imagem (pose, sharpness, iluminação) |
| `identity/` | Usuários e autenticação |
| `health/` | Health-check |
| `admin/` | Endpoints administrativos |

## Endpoints principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/v1/vision/landmarks` | MediaPipe → extrai landmarks da imagem |
| POST | `/v1/vision/metrics` | Landmarks → 93 MetricValues (chama Python) |
| POST | `/v1/vision/full-pipeline` | Imagem → landmarks → métricas → análise completa |
| POST | `/v1/vision/submit-landmarks` | Persiste landmarks de uma sessão |
| POST | `/v1/vision/compare` | Compara duas análises (antes/depois) |
| POST | `/v1/analysis` | Cria análise + persiste |
| GET  | `/v1/analysis/reports` | Lista histórico de análises |
| GET  | `/v1/analysis/reports/:id` | Detalhe de uma análise |
| GET  | `/v1/vision/results/:runId/annotated` | Imagem com landmarks |
| GET  | `/v1/vision/capture-guidelines` | Guidelines de captura |

## Arquivos-chave Python (`backend/`)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `app/services/metrics/__init__.py` | Importa todos os módulos → dispara `@register` |
| `app/services/metrics/registry.py` | `REGISTRY` dict + `register` decorator + `compute_all()` |
| `app/services/metrics/base.py` | `MetricCalculator` ABC + `QualityContext` dataclass |
| `app/services/metrics/confidence_propagation.py` | `propagate()`: pose · qualidade · penalidades regionais |
| `app/domain/landmarks_mesh.py` | Índices Mesh-478: LM_*, P_* constantes |
| `app/domain/normalized_landmarks.py` | `NormalizedLandmarks`: origem intercantal, escala ICD |
| `app/domain/metric_value.py` | `MetricValue` dataclass |
| `app/services/metrics/symmetry.py` | 5 métricas de simetria bilateral |
| `app/services/metrics/thirds.py` | 4 métricas de terços faciais |
| `app/services/metrics/fifths.py` | 6 métricas de quintos faciais |
| `app/services/metrics/eyes.py` | 10 métricas oculares (incl. C1) |
| `app/services/metrics/jaw.py` | 6 métricas mandibulares |
| `app/services/metrics/nose.py` | 9 métricas nasais |
| `app/services/metrics/mouth.py` | 7 métricas bucais |
| `app/services/metrics/brows.py` | 9 métricas de sobrancelhas |
| `app/services/metrics/cheekbones.py` | 5 métricas de maçãs do rosto |
| `app/services/metrics/forehead.py` | 4 métricas de testa |
| `app/services/metrics/global_shape.py` | 4 métricas de forma global |
| `app/services/metrics/phi_golden.py` | 4 métricas proporção áurea |
| `app/services/metrics/wave_c2.py` | 10 métricas C2 (nariz/boca/mandíbula avançado) |
| `app/services/metrics/wave_c3.py` | 10 métricas C3 (mento/sobrancelhas/maçãs/testa/global) |

---

## Fluxo de dados (Pipeline atual)

```
Imagem (JPG/PNG)
    │
    ▼
1. MediaPipe FaceLandmarker (frontend ou NestJS)
   - Extrai 478 landmarks (x, y, z normalizados 0–1)

    │
    ▼
2. NestJS: POST /v1/vision/metrics
   - Converte landmarks para NormalizedLandmarks (origem intercantal, escala ICD)
   - Chama Python via RPC/exec

    │
    ▼
3. Python: compute_all(lm, ctx)
   - Itera os 93 calculadores registrados no REGISTRY
   - Cada calculator.compute(lm, ctx) → MetricValue
   - confidence_propagation.propagate() aplica correções de pose/qualidade

    │
    ▼
4. NestJS: monta resposta
   - Enriquece cada MetricValue com metric_ideal (green/yellow ranges)
   - Aplica region_metric_weight v1.5 para score regional
   - Persiste em PostgreSQL (tabela analysis_result)

    │
    ▼
5. Frontend React
   - Renderiza dashboard com métricas, scores regionais, directions
```

---

## Schema do banco de dados (tabelas-chave)

```sql
-- Definição de cada métrica (93 rows)
metric_definition (
  metric_id TEXT,              -- ex: "jaw_width_ratio"
  version TEXT,                -- "v1.0"
  family TEXT,                 -- ex: "jaw"
  region TEXT,                 -- ex: "jaw"
  unit TEXT,                   -- ratio | degrees | index_0_1 | intercanthal_units | ...
  display_name JSONB,          -- { "pt-BR": "..." }
  presentation_only BOOLEAN,   -- se só exibição, não entra no score
  requires_pixel_analysis BOOLEAN, -- TRUE → stub DEC-10
  dependency_landmarks JSONB,  -- lista de índices Mesh-478
  default_weight_in_region FLOAT,
  min_confidence_to_display FLOAT
)

-- Intervalo de ideais por métrica (88 rows — exclui 5 stubs)
metric_ideal (
  metric_id TEXT,
  metric_definition_version TEXT,
  ideals_version TEXT,
  ideal_type TEXT,             -- canonical | population_statistical
  ideal_central_value FLOAT,
  green_range_min FLOAT,
  green_range_max FLOAT,
  yellow_range_min FLOAT,
  yellow_range_max FLOAT,
  direction_label_above JSONB, -- { "pt-BR": "..." }
  direction_label_below JSONB,
  population_reference_note TEXT
)

-- Pesos para score regional (88 rows, version='v1.5')
region_metric_weight (
  version TEXT,
  region TEXT,
  metric_id TEXT,
  weight FLOAT
)
```

---

## Modelo de landmarks MediaPipe Mesh-478 (pontos-chave)

```python
# Referência: backend/app/domain/landmarks_mesh.py

# Regiões (listas)
LM_LEFT_EYE    = [33, 7, 163, 144, 145, 153]
LM_RIGHT_EYE   = [263, 249, 390, 373, 374, 380]
LM_LEFT_BROW   = [70, 63, 105, 66, 107]
LM_RIGHT_BROW  = [336, 296, 334, 293, 300]
LM_OUTER_MOUTH = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375]
LM_INNER_MOUTH = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324]
LM_JAWLINE     = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288]
LM_NOSE_BRIDGE = [168, 6, 197, 195]

# Pontos singulares (P_)
P_INNER_CANTHUS_L = 133   # canto medial olho esq → usado para origem ICD
P_INNER_CANTHUS_R = 362
P_NASION          = 168
P_NOSE_TIP        = 4
P_SUBNASALE       = 94
P_UPPER_LIP_TOP   = 0
P_LOWER_LIP_BOT   = 17
P_MENTON          = 152
P_LEFT_ZYGOMATIC  = 234
P_RIGHT_ZYGOMATIC = 454
P_LEFT_GONION     = 172
P_RIGHT_GONION    = 397
P_FOREHEAD_CROWN  = 10
```


---

## Confiança da captura (`capture_confidence`)

Score de confiança 0–1 calculado como combinação ponderada das métricas de qualidade:

```python
capture_confidence = (
    0.45 × frontal_score   # 1 se frontal_ok, 0 caso contrário
  + 0.25 × sharpness_score # normalizado (0 se <50, 1 se >500)
  + 0.20 × lighting_score  # 1 - min(delta_e/20, 1)
  + 0.10 × focal_score     # 0 se focal_distortion_warning, senão 1
)
```

Usado em `top_leverage` e `evolution_path` para ajustar confiança das recomendações.
