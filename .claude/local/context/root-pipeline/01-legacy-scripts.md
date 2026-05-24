---
tenant_id: "face-before-after"
project: "face-before-after"
module: "root-pipeline/legacy-scripts"
file_path: ".claude/local/context/root-pipeline/01-legacy-scripts.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Scripts Python na raiz são a primeira versão do pipeline de face-analysis, anterior à
  refactor que moveu o domínio para backend/app. Continuam servindo como referência funcional
  (algoritmos de métricas, recomendações, simulação) e geradores de relatórios HTML/PDF
  standalone. Foram superados pela arquitetura DDD em backend/, mas permanecem porque
  build_mvp_html.py e mvp_pipeline.py ainda são usados para gerar relatórios MVP avulsos.
tags:
  - "root-pipeline"
  - "legacy"
  - "python"
  - "reports"
rag_keywords:
  - "MVP pipeline standalone"
  - "HTML report builder reportlab"
  - "before/after simulation deterministic"
  - "dlib 68 landmarks legacy"
  - "evolution path heuristics"
  - "impression layer scoring"
  - "top leverage metrics"
  - "glossary metric names"
related_modules:
  - "backend"
depends_on: []
used_by: []
---

# Root Pipeline — Scripts Legacy

## Visão geral

Os arquivos Python na raiz são o pipeline original do projeto, anterior à migração para
`backend/app/`. Continuam coexistindo porque alguns geram relatórios MVP completos sem
depender do backend dockerizado (rodam diretamente com `python <script>.py`).

## Inventário

| Script | Função | Status |
|---|---|---|
| [mvp_pipeline.py](../../../../mvp_pipeline.py) | Pipeline completo MVP — entry script | usado |
| [build_mvp_html.py](../../../../build_mvp_html.py) | Gera relatório MVP em HTML standalone | usado |
| [build_html_report.py](../../../../build_html_report.py) | Relatório HTML legado (pré-MVP) | legacy |
| [compare_report.py](../../../../compare_report.py) | Geração de relatório comparativo antes/depois | legacy |
| [api_server.py](../../../../api_server.py) | FastAPI mini-server pré-DDD | legacy (substituído por `backend/main.py`) |
| [start_api.py](../../../../start_api.py) | Bootstrap de `api_server.py` | legacy |
| [face_metrics.py](../../../../face_metrics.py) | Cálculo de métricas (origem do domain/face_metrics.py) | referência |
| [face_asymmetry.py](../../../../face_asymmetry.py) | Simetria (origem do domain/face_asymmetry.py) | referência |
| [face.py](../../../../face.py) | Wrapper de landmarks (legacy) | referência |
| [evolution_path.py](../../../../evolution_path.py) | Heurísticas de evolução longitudinal | referência |
| [impression_layer.py](../../../../impression_layer.py) | Camada de "impressão" / scoring | referência |
| [recommendations.py](../../../../recommendations.py) | Geração de recomendações por métrica | usado (cross-ref com backend) |
| [simulate_before_after.py](../../../../simulate_before_after.py) | Simulação de "depois" sem IA | referência |
| [top_leverage.py](../../../../top_leverage.py) | Ranking de métricas com maior leverage | referência |
| [visual_status.py](../../../../visual_status.py) | Status visual (pass/warn/fail por métrica) | referência |
| [glossary.py](../../../../glossary.py) | Dicionário de nomes humanos de métricas | usado (consumido por reports) |
| [minio_client.py](../../../../minio_client.py) | Helper MinIO antes da migração para `backend/app/infra` | legacy |

## Decisão arquitetural

Manter os scripts até que:

1. `mvp_pipeline.py` esteja 100% portado para `backend/app/` com paridade de saída.
2. `build_mvp_html.py` seja substituído por geração de relatório no Nest/backend.
3. `recommendations.py` + `glossary.py` sejam absorvidos pelo módulo de diagnosis do Nest.

Até lá, qualquer mudança em métrica/simulação deve ser refletida em **ambos** os lugares
(raiz e `backend/app/domain/`). Ver [.claude/local/face-analysis/CALIBRATION_AUDIT_2026-05-12.md](../../face-analysis/CALIBRATION_AUDIT_2026-05-12.md)
para a fonte canônica de calibrações.

## Modelos pesados

- [shape_predictor_68_face_landmarks.dat](../../../../shape_predictor_68_face_landmarks.dat)
  (99 MB) — dlib 68 landmarks pretrained. Versionado no repo (não está em LFS).

## Não-objetivos

- Não documentar comportamento legado em detalhe — fonte canônica é o código em
  `backend/app/domain/` + `.claude/face-analysis/`.
