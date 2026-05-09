# Plano: Refatoramento Backend Python — Padrão API 2025

## Goal
Reorganizar 18 arquivos Python soltos no root em estrutura de pacotes com separação de camadas. Zero alteração de lógica de negócio.

## Recommended Execution Model
sonnet

## Decomposição

1. Criar estrutura de diretórios `backend/app/{api,core,domain,infra,reports,schemas}/`
2. `app/core/config.py` — pydantic-settings (substituir variáveis de ambiente soltas)
3. `app/core/exceptions.py` — FaceNotDetectedError, InvalidImageError, RunNotFoundError
4. `app/core/logging.py` — JSON structured logger
5. `app/schemas/` — Pydantic models para request/response (AnalyzeResponse, CompareRequest, etc.)
6. `app/infra/storage.py` — mover minio_client.py
7. `app/domain/` — mover face_asymmetry.py, face_metrics.py, face.py, simulate_before_after.py
8. `app/domain/layers/` — mover impression_layer.py, visual_status.py, top_leverage.py, evolution_path.py, recommendations.py, glossary.py
9. `app/domain/pipeline.py` — mover mvp_pipeline.py, ajustar imports
10. `app/api/deps.py` — Depends: get_pipeline(), get_storage()
11. `app/api/endpoints/` — dividir api_server.py em analysis.py, results.py, compare.py, meta.py
12. `app/api/router.py` — agregar todos os routers
13. `main.py` — entry point limpo (substituir api_server.py + start_api.py)
14. `pyproject.toml` — substituir requirements-api.txt
15. Atualizar Dockerfile.api e docker-compose.yml
16. Mover tests/ → backend/tests/, atualizar imports
17. Deletar arquivos legacy (build_html_report.py, start_api.py)

## Verificação
- `pytest backend/tests/ -v`
- `curl -F "photo=@foto.jpg" http://localhost:8000/api/analyze/free`
- `curl http://localhost:8000/docs`
