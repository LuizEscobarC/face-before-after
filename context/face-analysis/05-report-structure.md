# Estrutura do Relatório

## JSON de saída (result.json)

```json
{
  "run_id": "abc123def456",
  "mode": "premium",
  "score": 72,
  "score_tier": "Boa",
  "score_tier_description": "Assimetria leve — dentro da variação natural",
  "measurements": {
    "ipd_px": 145.3,
    "overall_asymmetry_score": 8.5,
    "overall_asymmetry_score_pct_ipd": 5.85,
    "asymmetry_eyes": 3.2,
    "asymmetry_nose": 4.1,
    "asymmetry_mouth": 5.0,
    "asymmetry_chin": 2.8,
    "asymmetry_jaw": 6.1,
    "advanced": {
      "thirds_upper_ratio": 0.328,
      "thirds_middle_ratio": 0.334,
      "thirds_lower_ratio": 0.338,
      "thirds_std_dev": 0.005,
      "fifths_std_dev": 0.042,
      "lower_third_ratio": 0.553,
      "fwhr": 1.78,
      "bizygomatic_px": 258.4,
      "bigonial_px": 198.7,
      "jaw_width_pct_ipd": 136.7,
      "bizygomatic_to_bigonial_ratio": 1.30,
      "gonial_angle_left_deg": 122.4,
      "gonial_angle_right_deg": 119.8,
      "gonial_angle_mean_deg": 121.1,
      "chin_projection_pct_ipd": 12.3,
      "jawline_definition_score": 4.8,
      "canthal_tilt_left_deg": 3.2,
      "canthal_tilt_right_deg": 2.8,
      "canthal_tilt_mean_deg": 3.0,
      "eye_aspect_ratio_left": 0.29,
      "eye_aspect_ratio_right": 0.31,
      "eye_aspect_ratio_mean": 0.30,
      "intercanthal_to_eyewidth_ratio": 1.02,
      "brow_to_eyelid_left_pct_ipd": 18.5,
      "brow_to_eyelid_right_pct_ipd": 19.2,
      "brow_to_eyelid_mean_pct_ipd": 18.85,
      "brow_tilt_left_deg": 5.1,
      "brow_tilt_right_deg": 4.7,
      "nasal_to_mouth_width_ratio": 0.68,
      "alar_intercanthal_alignment_pct": 4.2,
      "nasal_length_pct_face_height": 29.8,
      "alar_width_pct_ipd": 48.3,
      "mouth_to_ipd_ratio": 1.45,
      "upper_lower_lip_ratio": 0.62,
      "philtrum_length_pct_ipd": 24.1,
      "upper_lip_thickness_pct_ipd": 8.2,
      "lower_lip_thickness_pct_ipd": 13.2,
      "face_height_to_width_ratio": 1.38,
      "zygomatic_to_gonial_ratio": 1.30,
      "face_shape_label": "oval",
      "marquardt_deviation_px": 7.2,
      "marquardt_deviation_pct_ipd": 4.95
    },
    "photo_quality": {
      "head_pose_yaw_deg": 1.2,
      "head_pose_pitch_deg": −0.5,
      "head_pose_roll_deg": 0.8,
      "frontal_ok": true,
      "focal_distortion_ratio": 0.46,
      "focal_distortion_warning": false,
      "lighting_asymmetry_delta_e": 3.1,
      "face_pixel_width": 320,
      "sharpness_laplacian_var": 245.6,
      "warnings": []
    },
    "skin": {
      "skin_uniformity_std_lab_left": 14.2,
      "skin_uniformity_std_lab_right": 12.8,
      "skin_uniformity_std_lab_forehead": 11.5,
      "skin_lighting_delta_e_lr": 3.1,
      "under_eye_darkness_left": 0.12,
      "under_eye_darkness_right": 0.09
    }
  },
  "first_impression": {
    "headline": "...",
    "tags": ["assimetria visível"],
    "main_risk": "...",
    "positive_signal": "..."
  },
  "visual_status": {
    "dominance_score": 6.2,
    "attractiveness_score": 5.8,
    "freshness_score": 4.9,
    "narrative": "..."
  },
  "top_leverage": {
    "metric_key": "canthal_tilt_mean_deg",
    "short_action": "...",
    "why_it_matters": "...",
    "time_to_result": "semanas",
    "tier": 1,
    "deviation_score": 0.423,
    "confidence_score": 0.701
  },
  "top3_actions": [
    {"rank": 1, "metric_key": "...", "short_action": "...", "tier": 0},
    {"rank": 2, "metric_key": "...", "short_action": "...", "tier": 1},
    {"rank": 3, "metric_key": "...", "short_action": "...", "tier": 2}
  ],
  "recommendations": [
    {
      "metric_key": "canthal_tilt_mean_deg",
      "metric_label": "Canthal tilt médio",
      "severity": "leve",
      "value": 3.0,
      "ideal": "~+5°",
      "what_is": "...",
      "how_measured": "...",
      "why_matters": "...",
      "actions": [...],
      "references": [...]
    }
  ],
  "evolution_path": {
    "mutable_metrics": ["canthal_tilt_mean_deg", "skin_uniformity_std_lab_left", ...],
    "skin_alert": true,
    "phase_1": {
      "label": "Esta semana (0–7 dias)",
      "focus": "...",
      "actions": [...],
      "target_metric": "...",
      "reanalysis_date": "2026-04-24",
      "reanalysis_label": "em 7 dias",
      "confidence_score": 0.71,
      "confidence_label": "provável"
    },
    "phase_2": { "label": "Próximos 30 dias", ... },
    "phase_3": { "label": "3 meses", ..., "requires_professional": true }
  },
  "simulation_paths": {
    "symmetrized": "/path/to/abc123_symmetrized.jpg",
    "ideal_proportions": "/path/to/abc123_ideal_proportions.jpg",
    "comparison_grid": "/path/to/abc123_comparison_grid.jpg"
  },
  "simulation_error": null,
  "capture_confidence": 0.87,
  "premium_metrics_catalog": { ... },
  "generated_at": "2026-04-17T17:33:00"
}
```

---

## Seções do relatorio.html

O relatório HTML é gerado por `build_html_report.py` como página standalone (sem JS externo). Usa o design system do projeto.

### Paleta de cores do relatório

```css
:root {
  --bg:      #0e1116;   /* fundo escuro */
  --panel:   #161b22;   /* cards/painéis */
  --border:  #30363d;   /* bordas */
  --text:    #e6edf3;   /* texto principal */
  --muted:   #8b949e;   /* texto secundário */
  --green:   #3fb950;   /* excelente */
  --yellow:  #d29922;   /* leve */
  --orange:  #db6d28;   /* moderada */
  --red:     #f85149;   /* acentuada/severa */
  --blue:    #388bfd;   /* destaques informativos */
}
```

### Seções em ordem de exibição

| # | Seção | Conteúdo |
|---|-------|---------|
| 1 | **Header** | Score (% IPD), tier, data de geração |
| 2 | **Comparativo antes/depois** | Lado a lado com scores e severity pills |
| 3 | **Assimetrias regionais** | Tabela: olhos, nariz, boca, queixo, mandíbula |
| 4 | **Foto / Qualidade** | Pose, sharpness, focal distortion, lighting ΔE |
| 5 | **Proporções avançadas** | Terços, quintos, fWHR, lower_third, Marquardt |
| 6 | **Olhos** | Canthal tilt, EAR, intercanthal/eyewidth |
| 7 | **Dimorfismo** | Jaw width, gonial angle, bizygomatic/bigonial |
| 8 | **Nariz** | Razões nasal/boca, comprimento |
| 9 | **Boca / Lábios** | Razão superior/inferior, fíltro |
| 10 | **Pele** | Uniformidade Lab, olheiras, ΔE iluminação |
| 11 | **Percepção visual** | Primeira impressão, tags, main_risk, positive_signal |
| 12 | **Status visual** | 3 scores (dominância, atratividade, frescor) + narrativa |
| 13 | **Top alavancagem** | Melhor ação + porquê importa |
| 14 | **Plano de ação** | Lista ordenada por severidade com ações por métrica |
| 15 | **Trilha de evolução** | 3 fases: 7d / 30d / 90d com confidence score |
| 16 | **Simulações visuais** | 3 imagens: simetrizado, proporções ideais, grid |

---

## Simulações visuais (simulate_before_after.py)

### 1. Rosto simetrizado (`_symmetrized.jpg`)

```
Lógica:
1. Estima "melhor metade" (esq ou dir) baseada em sharpness/iluminação
2. Espelha horizontalmente a metade escolhida
3. Aplica gradiente de blend de ±30px na linha da midline
   - Zona de blend = max(0, 1 − (|x − midline| / blend_width))
4. Combina original + espelhado com o mapa de blend
```

### 2. Proporções ideais (`_ideal_proportions.jpg`)

Desenha linhas-guia sobre a imagem original:

| Guia | Cor | Descrição |
|------|-----|-----------|
| Linha dos terços horizontal | Ciano | glabella_y |
| Linha dos terços horizontal | Ciano | subnasale_y |
| Linha dos quintos vertical | Azul semitransparente | 5 divisões verticais |
| Canthal tilt ideal (+5°) | Amarelo | Linha tracejada em +5° |
| Guia largura do nariz | Verde | Ideal = 70% da largura da boca |

### 3. Grid comparativo (`_comparison_grid.jpg`)

```
Layout: 3 colunas lado a lado
Coluna 1: Original
Coluna 2: Simetrizado
Coluna 3: Proporções ideais

Altura: max(h1, h2, h3)
Largura: w1 + w2 + w3
```

---

## Actionability Tiers

Usado para classificar quando uma ação é realizável:

| Tier | Descrição | `time_to_result` típico | `cost_level` |
|------|-----------|------------------------|--------------|
| 0 | Grátis / imediato (postura, foto, hábito simples) | imediato ou dias | 0 |
| 1 | Hábito de semanas (exercício, skincare, mewing) | semanas a meses | 0–1 |
| 2 | Intervenção profissional (dermato, fisio, cirurgia) | meses | 1–3 |

Mapeamento por tipo de ação:
```python
{"habito": 0, "postura": 0, "exercicio": 1, "profissional": 2}
```
