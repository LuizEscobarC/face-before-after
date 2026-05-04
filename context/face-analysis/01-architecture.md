# Arquitetura do Pipeline — Face Analysis

## Arquivos-chave

| Arquivo | Responsabilidade |
|---------|-----------------|
| `mvp_pipeline.py` | Orquestrador principal — detecta face, extrai landmarks, calcula score, gera relatório |
| `face_asymmetry.py` | Cálculo de assimetria bilateral por par de landmarks |
| `face_metrics.py` | ~25 métricas avançadas (proporções, olhos, nariz, boca, pele, qualidade) |
| `impression_layer.py` | Camada de percepção social (first impression, tags, main_risk) |
| `visual_status.py` | 3 scores compostos: dominância, atratividade, frescor |
| `top_leverage.py` | Alavancagem: ação de maior retorno percebido + top-3 |
| `recommendations.py` | Catálogo REC_CATALOG + geração de plano de ação priorizado |
| `evolution_path.py` | Trilha de evolução em 3 fases (7/30/90 dias) |
| `simulate_before_after.py` | Geração de 3 imagens de simulação OpenCV |
| `glossary.py` | Glossário de todos os termos e métricas |
| `compare_report.py` | Relatório comparativo antes/depois |
| `api_server.py` | FastAPI: `/api/analyze/free`, `/api/analyze/premium`, endpoints de imagem |
| `build_html_report.py` | Gera `relatorio.html` standalone a partir do JSON de resultado |

---

## Fluxo de dados (Pipeline `mvp_pipeline.run()`)

```
Imagem (JPG/PNG)
    │
    ▼
1. Pré-processamento
   - Carrega imagem com OpenCV (BGR)
   - Salva cópia original em resultado_api/{run_id}/

    │
    ▼
2. Detecção facial (dlib HOG + shape predictor 68 pontos)
   - Detecta bounding box da face
   - Extrai 68 landmarks (x, y em pixels)

    │
    ▼
3. Alinhamento (opcional)
   - Rotaciona para corrigir roll usando linha interpupilar

    │
    ▼
4. Assimetria bilateral (face_asymmetry.py)
   - Para cada par de landmarks espelhados, mede distância ao eixo médio
   - Retorna overall_asymmetry_score (px) e overall_asymmetry_score_pct_ipd (% IPD)
   - Retorna também assimetrias regionais (olhos, nariz, boca, queixo, mandíbula)

    │
    ▼
5. Métricas avançadas (face_metrics.compute_all)   [só premium]
   - Proporções clássicas (terços, quintos, fWHR, lower_third)
   - Dimorfismo masculino (ângulo gonial, jaw_width, bizygomatic/bigonial)
   - Olhos (canthal tilt, EAR, intercanthal, brow tilt)
   - Nariz (razões alar/boca, comprimento nasal, alar/IPD)
   - Boca (largura, lábios, fíltro)
   - Forma facial (oval, retangular, oblongo, etc.)
   - Desvio Marquardt (RMSE bilateral normalizado por IPD)
   - Qualidade da foto (pose PnP, sharpness, focal distortion, iluminação ΔE)
   - Pele (uniformidade Lab, olheiras)

    │
    ▼
6. Score de simetria
   score = int(round((1 - min(pct_ipd, 15.0) / 15.0) × 100))
   Tier: Alta(≥80), Boa(≥60), Moderada(≥40), Baixa(<40)

    │
    ▼
7. Camadas de análise  [só premium]
   - impression_layer.build_first_impression()
   - visual_status.build_visual_status()
   - top_leverage.get_top_leverage_recommendation()
   - top_leverage.get_top3_actions()
   - recommendations.recommend()
   - evolution_path.build_evolution_path()

    │
    ▼
8. Simulações visuais  [só premium]
   - simulate_before_after.simulate()
     → {run_id}_symmetrized.jpg
     → {run_id}_ideal_proportions.jpg
     → {run_id}_comparison_grid.jpg

    │
    ▼
9. Relatório JSON + HTML
   - Salva em resultado_api/{run_id}/
   - HTML gerado por build_html_report.py (seções: score, comparativo, ações)
```

---

## Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/analyze/free` | Análise básica (score + assimetria) |
| POST | `/api/analyze/premium` | Análise completa com métricas, recomendações, simulações |
| GET | `/api/result/{run_id}/annotated` | Imagem com landmarks desenhados |
| GET | `/api/result/{run_id}/simulation/{sim_type}` | Imagem de simulação (symmetrized / ideal_proportions / comparison_grid) |

---

## Estrutura de saída (`resultado_api/{run_id}/`)

```
resultado_api/{run_id}/
├── original.jpg            ← foto original salva
├── annotated.jpg           ← foto com landmarks e anotações
├── {id}_symmetrized.jpg    ← simulação: rosto simetrizado
├── {id}_ideal_proportions.jpg ← simulação: proporções ideais
├── {id}_comparison_grid.jpg ← grid 3 colunas
├── result.json             ← JSON completo da análise
└── report.html             ← relatório HTML standalone
```

---

## Modelo de landmarks dlib (68 pontos)

```
Jawline:       0–16   (17 pontos, contorno mandíbula)
Brow esq:     17–21   (5 pontos)
Brow dir:     22–26   (5 pontos)
Ponte nasal:  27–30   (4 pontos)
Ponta nasal:  31–35   (5 pontos)
Olho esq:     36–41   (6 pontos)
Olho dir:     42–47   (6 pontos)
Boca externa: 48–59   (12 pontos)
Boca interna: 60–67   (8 pontos)
```

Pontos de referência chave:

| Índice | Ponto anatômico |
|--------|----------------|
| 8 | Menton (queixo inferior) |
| 27 | Nasion (topo da ponte nasal) |
| 30 | Nose tip (ponta do nariz) |
| 33 | Subnasale (base do nariz) |
| 36 | Canto lateral olho esquerdo |
| 39 | Canto medial olho esquerdo |
| 42 | Canto medial olho direito |
| 45 | Canto lateral olho direito |
| 48 | Canto esquerdo da boca |
| 51 | Ponto superior do lábio (labiale superius) |
| 54 | Canto direito da boca |
| 57 | Ponto inferior do lábio (labiale inferius) |
| 4 | Gônio esquerdo (ângulo mandibular) |
| 12 | Gônio direito |

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
