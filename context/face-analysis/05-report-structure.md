# Estrutura do Relatório — DB, API e Resposta

Sistema atual: **NestJS + PostgreSQL + Python (MediaPipe-478)**. Não existe mais `result.json` persistido em disco — os dados fluem via API REST.

---

## 1. Banco de dados — tabelas principais

### metric_definition

Catálogo estático das 93 métricas. Populado pelas migrations SeedMetricCatalog*.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `metric_id` | varchar PK | Identificador único (snake_case) |
| `version` | varchar | Versão do catálogo (ex: "C3") |
| `family` | varchar | Grupo lógico (symmetry, eye, nose…) |
| `region` | varchar | Região anatômica (eyes, brows, jaw…) |
| `unit` | varchar | "ratio" \| "degrees" \| "intercanthal_units" \| "index_0_1" |
| `display_name` | varchar | Nome legível (PT-BR) |
| `presentation_only` | boolean | true = exibir mas não scorear |
| `requires_pixel_analysis` | boolean | true = precisa de análise de pixel (skin, etc.) |
| `dependency_landmarks` | int[] | Índices MediaPipe-478 usados |
| `default_weight_in_region` | float | Peso padrão na região |
| `min_confidence_to_display` | float | Abaixo → exibir como "confiança insuficiente" |

### metric_ideal

Limiares green/yellow por métrica. 88 linhas (exceto 4 stubs + presentation_only sem score).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `metric_id` | varchar FK | Referência à metric_definition |
| `metric_definition_version` | varchar | Versão da definição associada |
| `ideals_version` | varchar | Versão dos ideais (ex: "V1.5") |
| `ideal_type` | varchar | "bilateral_mean" \| "ratio" \| "angle" |
| `ideal_central_value` | float | Valor central ideal |
| `green_range_min` | float | Limite inferior zona verde |
| `green_range_max` | float | Limite superior zona verde |
| `yellow_range_min` | float | Limite inferior zona amarela (inclui verde) |
| `yellow_range_max` | float | Limite superior zona amarela (inclui verde) |
| `direction_label_above` | varchar | Label semântico quando value > ideal (ex: "wide_mouth") |
| `direction_label_below` | varchar | Label semântico quando value < ideal (ex: "narrow_mouth") |
| `population_reference_note` | text | Referência bibliográfica / nota clínica |

### region_metric_weight

Pesos das métricas por região para o cálculo do score regional. Versão atual: V1.5.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `metric_id` | varchar FK | Referência à metric_definition |
| `region` | varchar | Região (deve bater com metric_definition.region) |
| `weight_value` | float | Peso relativo dentro da região |
| `version` | varchar | Versão dos pesos (ex: "V1.5") |

---

## 2. Endpoint de análise

```
POST /v1/vision/metrics
Content-Type: multipart/form-data
Body: { image: <file> }
```

**Fluxo interno:**
1. NestJS recebe imagem → faz HTTP POST para Python (FastAPI)
2. Python detecta face (MediaPipe) → normaliza para ICU → roda 93 calculators → retorna lista de `MetricValue`
3. NestJS une com `metric_definition`, `metric_ideal`, `region_metric_weight`
4. NestJS calcula: `deviation_raw`, `deviation_normalized`, `severity_5`, `severity_3`, `direction_label`, `improvement_vector_x/y`
5. Retorna lista de `MetricEvaluationResultDto`

---

## 3. MetricEvaluationResultDto (TypeScript)

```typescript
// nest/src/modules/analysis/dto/evaluate.dto.ts

export class MetricEvaluationResultDto {
  metric_id: string;              // ex: "canthal_tilt_l"
  region: string;                 // ex: "eyes"
  family: string;                 // ex: "eye"
  unit: string;                   // ex: "degrees"
  value: number;                  // valor calculado (em ICU ou graus)
  confidence_raw: number;         // [0,1] — só geometria Python
  confidence_final: number;       // [0,1] — degradado por pose/qualidade
  is_low_confidence: boolean;     // confidence_final < LOW_CONF_THRESHOLD (0.4)
  direction: string;              // "neutral" | label_above | label_below | "not_computed"
  deviation_raw: number;          // value - ideal_central_value
  deviation_normalized: number;   // deviation_raw / (green_range_max - ideal_central_value)
  severity_5: string | null;      // "ideal"|"mild"|"moderate"|"strong"|"extreme"|null
  severity_3: string | null;      // "LEVE"|"MODERADO"|"SEVERO"|null
  direction_label: string | null; // ex: "wide_mouth", "low_brow"
  improvement_vector_x: number;   // deslocamento sugerido em ICU (landmark principal)
  improvement_vector_y: number;   // deslocamento sugerido em ICU (landmark principal)
}
```

**Campos null:** métricas stub (`direction="not_computed"`), `is_low_confidence=true`, ou `presentation_only=true` têm `severity_5=null`, `severity_3=null`.

---

## 4. Resposta completa do endpoint

```json
{
  "analysis_id": "uuid-v4",
  "metrics": [
    {
      "metric_id": "canthal_tilt_l",
      "region": "eyes",
      "family": "eye",
      "unit": "degrees",
      "value": 2.3,
      "confidence_raw": 0.91,
      "confidence_final": 0.85,
      "is_low_confidence": false,
      "direction": "low_canthal_tilt",
      "deviation_raw": -2.7,
      "deviation_normalized": -2.7,
      "severity_5": "mild",
      "severity_3": "MODERADO",
      "direction_label": "Canto externo baixo",
      "improvement_vector_x": 0.0,
      "improvement_vector_y": -0.05
    }
    // ... 92 mais
  ],
  "regional_scores": {
    "eyes":       { "score": 0.72, "scoreable_count": 6 },
    "brows":      { "score": 0.81, "scoreable_count": 8 },
    "symmetry":   { "score": 0.68, "scoreable_count": 5 },
    "nose":       { "score": 0.75, "scoreable_count": 7 },
    "mouth":      { "score": 0.80, "scoreable_count": 5 },
    "jaw":        { "score": 0.61, "scoreable_count": 6 },
    "cheekbones": { "score": 0.78, "scoreable_count": 5 },
    "thirds":     { "score": 0.85, "scoreable_count": 3 },
    "fifths":     { "score": 0.76, "scoreable_count": 4 },
    "forehead":   { "score": 0.70, "scoreable_count": 4 },
    "global":     { "score": 0.74, "scoreable_count": 3 }
  },
  "overall_score": 0.74,
  "pose": {
    "yaw_deg": 1.2,
    "pitch_deg": -0.5,
    "roll_deg": 0.8
  },
  "quality_score": 0.91,
  "created_at": "2026-04-17T17:33:00Z"
}
```

---

## 5. Tabela de regiões × métricas

| Região | Métricas scoráveis | Métricas presentation_only | Stubs |
|--------|-------------------|---------------------------|-------|
| symmetry | 5 | 0 | 0 |
| global | 3–5 | 0 | 0 |
| thirds | 3–4 | 0 | 0 |
| fifths | 4–6 | 0 | 0 |
| eyes | 9 | 0 | 1 (supratarsal_fold_visibility) |
| jaw | 6–7 | 0 | 0 |
| nose | 7–9 | 0 | 1 (nasolabial_angle_proxy) |
| mouth | 5–7 | 0 | 0 |
| brows | 10–12 | 0 | 0 |
| cheekbones | 6–8 | 0 | 0 |
| forehead | 4–6 | 0 | 2 (ogee_curve_proxy, forehead_slope_proxy) |
| phi_golden | 2–4 | 2 | 0 |
| wave_c2 | 8–10 | 0 | 0 |

> Totais aproximados. Contagem exata: `SELECT count(*) FROM metric_definition WHERE presentation_only = false`.

