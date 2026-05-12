python   := ".venv/bin/python"
pip      := ".venv/bin/pip"
pytest   := ".venv/bin/pytest"
npm      := "npm"

img_antes  := `if [ -f antes.png ]; then echo antes.png; elif [ -f antes.jpg ]; then echo antes.jpg; elif [ -f antes.jpeg ]; then echo antes.jpeg; else echo antes.png; fi`
img_depois := `if [ -f depois.png ]; then echo depois.png; elif [ -f depois.jpg ]; then echo depois.jpg; elif [ -f depois.jpeg ]; then echo depois.jpeg; else echo depois.png; fi`

out_antes  := "resultado_analise_antes"
out_depois := "resultado_analise_depois"
out_mvp    := "resultado_mvp"

json_antes  := out_antes  + "/05_reports/antes_report.json"
json_depois := out_depois + "/05_reports/depois_report.json"

report_out := "relatorio_comparativo.txt"
html_out   := "relatorio.html"

# Lista todos os comandos disponíveis
default:
    @just --list

# ──────────────────────────────────────────────
# PIPELINE CLÁSSICO (face_asymmetry + compare)
# ──────────────────────────────────────────────

# Roda pipeline completo: antes → depois → report → html
all: antes depois report web
    @echo ""
    @echo "OK → {{out_antes}}/  {{out_depois}}/  {{report_out}}  {{html_out}}"

# Analisa foto ANTES
antes:
    @echo "Analisando ANTES..."
    {{python}} face_asymmetry.py -i {{img_antes}} -o {{out_antes}}

# Analisa foto DEPOIS
depois:
    @echo "Analisando DEPOIS..."
    {{python}} face_asymmetry.py -i {{img_depois}} -o {{out_depois}}

# Gera relatório comparativo TXT
report:
    @echo "Gerando relatório ANTES → DEPOIS..."
    {{python}} compare_report.py \
        --before {{json_antes}} \
        --after  {{json_depois}} \
        --label-before ANTES \
        --label-after  DEPOIS \
        --output {{report_out}}

# Gera relatório HTML autocontido
web:
    @echo "Gerando relatório HTML..."
    {{python}} build_html_report.py \
        --before {{json_antes}} \
        --after  {{json_depois}} \
        --label-before ANTES \
        --label-after  DEPOIS \
        --output {{html_out}}

# ──────────────────────────────────────────────
# MVP PIPELINE (produto completo)
# ──────────────────────────────────────────────

# Roda MVP completo em ambas as fotos
mvp: mvp-antes mvp-depois
    @echo ""
    @echo "OK → {{out_mvp}}/"

# Roda MVP na foto ANTES
mvp-antes:
    @echo "MVP analisando ANTES..."
    {{python}} mvp_pipeline.py {{img_antes}} --mode premium

# Roda MVP na foto DEPOIS
mvp-depois:
    @echo "MVP analisando DEPOIS..."
    {{python}} mvp_pipeline.py {{img_depois}} --mode premium

# Roda MVP premium em uma foto específica: just mvp-premium minha_foto.png
mvp-premium foto:
    {{python}} mvp_pipeline.py {{foto}} --mode premium

# Roda MVP gratuito (teaser) em uma foto específica: just mvp-free minha_foto.png
mvp-free foto:
    {{python}} mvp_pipeline.py {{foto}} --mode teaser

# Alias legado (premium): just mvp-foto minha_foto.png
mvp-foto foto:
    @just mvp-premium {{foto}}

# Gera HTML premium para foto DEPOIS (padrão, alias legado)
mvp-web: mvp-depois
    @echo "Gerando HTML visual MVP..."
    {{python}} build_mvp_html.py {{out_mvp}}/$(basename {{img_depois}} | sed 's/\.[^.]*$//')_mvp_report.json -o relatorio_mvp.html
    @echo "✓ Abra relatorio_mvp.html no navegador"

# Gera HTML premium para uma foto específica: just mvp-web-foto minha_foto.png (alias legado)
mvp-web-foto foto:
    @echo "MVP premium analisando {{foto}}..."
    {{python}} mvp_pipeline.py {{foto}} --mode premium
    @echo "Gerando HTML visual MVP para {{foto}}..."
    {{python}} build_mvp_html.py {{out_mvp}}/$(basename {{foto}} | sed 's/\.[^.]*$//')_mvp_report.json -o $(basename {{foto}} | sed 's/\.[^.]*$//')_relatorio.html
    @echo "✓ Pronto"

# Gera HTML premium (pay-per-report) para uma foto específica
mvp-premium-web foto:
    @echo "MVP premium analisando {{foto}}..."
    {{python}} mvp_pipeline.py {{foto}} --mode premium
    @echo "Gerando HTML premium para {{foto}}..."
    {{python}} build_mvp_html.py {{out_mvp}}/$(basename {{foto}} | sed 's/\.[^.]*$//')_mvp_report.json -o $(basename {{foto}} | sed 's/\.[^.]*$//')_premium_relatorio.html
    @echo "✓ Pronto"

# Gera HTML teaser gratuito para uma foto específica
mvp-free-web foto:
    @echo "MVP teaser analisando {{foto}}..."
    {{python}} mvp_pipeline.py {{foto}} --mode teaser
    @echo "Gerando HTML teaser para {{foto}}..."
    {{python}} build_mvp_html.py {{out_mvp}}/$(basename {{foto}} | sed 's/\.[^.]*$//')_mvp_report.json -o $(basename {{foto}} | sed 's/\.[^.]*$//')_teaser_relatorio.html
    @echo "✓ Pronto"

# ──────────────────────────────────────────────
# API + FRONTEND REACT
# ──────────────────────────────────────────────

# Instala dependências da API HTTP
api-install:
    {{pip}} install -r requirements-api.txt

# Sobe API local em http://localhost:8000
api-dev:
    {{python}} -m uvicorn api_server:app --reload --host 0.0.0.0 --port 8000

# Instala dependências do frontend React
react-install:
    cd frontend && {{npm}} install

# Sobe frontend React em http://localhost:5173
react-dev:
    cd frontend && {{npm}} run dev

# Build de produção do frontend
react-build:
    cd frontend && {{npm}} run build

# ──────────────────────────────────────────────
# TESTES
# ──────────────────────────────────────────────

# Roda todos os testes
test:
    PYTHONPATH=. {{pytest}} tests/ -v

# Roda testes silencioso (só falhas)
test-q:
    PYTHONPATH=. {{pytest}} tests/ -q

# Roda um módulo de testes específico: just test-mod face_metrics
test-mod modulo:
    PYTHONPATH=. {{pytest}} tests/test_{{modulo}}.py -v

# Roda testes com cobertura resumida
test-cov:
    PYTHONPATH=. {{pytest}} tests/ -q

# Roda testes de integração apenas
test-integration:
    PYTHONPATH=. {{pytest}} tests/test_pipeline_integration.py -v

# Roda testes de um arquivo e para no primeiro erro
test-x modulo:
    PYTHONPATH=. {{pytest}} tests/test_{{modulo}}.py -x -v

# ──────────────────────────────────────────────
# DESENVOLVIMENTO
# ──────────────────────────────────────────────

# Instala dependências no venv
install:
    {{pip}} install -r requirements.txt 2>/dev/null || {{pip}} install opencv-python numpy dlib pytest

# Verifica sintaxe de todos os módulos Python
lint:
    {{python}} -m py_compile \
        face_asymmetry.py face_metrics.py face.py \
        impression_layer.py visual_status.py top_leverage.py \
        recommendations.py evolution_path.py mvp_pipeline.py \
        simulate_before_after.py compare_report.py build_html_report.py build_mvp_html.py api_server.py
    @echo "✓ Sintaxe OK"

# Mostra saída MVP resumida (score + ações)
preview foto=img_depois:
    {{python}} mvp_pipeline.py {{foto}} 2>&1 | grep -E "SCORE|100|Muito|Boa|Moderada|Baixa|REFINAMENTO|ALAVANCA|→|CTA|\[" | head -20

# Limpa outputs gerados (mantém fotos e venv)
clean:
    rm -rf {{out_antes}} {{out_depois}} {{report_out}} {{html_out}}

# Limpa tudo incluindo outputs MVP
clean-all: clean
    rm -rf {{out_mvp}} __pycache__ .pytest_cache
    find . -name "*.pyc" -delete

##############################
# OVERLAY REVIEW (autopilot rig)
##############################

# Renderiza TODAS as visualizações do front (axes, grids, contour, extents,
# vetores, heatmaps, comparativo, mapa de métricas, proporções ideais) como
# PNGs em review/<stem>/ + um index.html de contact-sheet. Requer a API do
# vision-service rodando em http://localhost:9015 (docker compose up -d).
# Uso: just review bradpitt-reference.jpg
review foto:
    {{python}} scripts/render_all_overlays.py {{foto}}

# Variante com URL custom da API: just review-api antes.png http://localhost:9015
review-api foto api:
    {{python}} scripts/render_all_overlays.py {{foto}} --api {{api}}

# Loop rápido para iteração: roda review e ecoa o caminho do index.html para
# o agente abrir via view_image.
review-loop foto:
    {{python}} scripts/render_all_overlays.py {{foto}}
    @echo ""
    @echo "→ review/$(basename {{foto}} | sed 's/\.[^.]*$//')/$(basename {{foto}} | sed 's/\.[^.]*$//')_index.html"

# Roda todos os smoke-tests de overlay (node .mjs) contra a API em localhost:9015.
# Uso: just overlay-tests
# Override da imagem: OVERLAY_TEST_IMAGE=bradpitt-reference.jpg just overlay-tests
overlay-tests:
    node scripts/test-all-overlays.mjs

# Roda o smoke-test de um overlay específico.
# Uso: just overlay-test axis_vertical
# ou:  just overlay-test grid_thirds
overlay-test id:
    node scripts/test-overlay-{{id}}.mjs

##############################
# DOCKER
#############################

# Build das imagens Docker
docker-build:
    docker-compose build

# Deploy completo do frontend: build Vite → rebuild imagem → restart container
frontend-deploy:
    cd frontend && npm run build
    docker compose build frontend
    docker compose up -d frontend

# Sobe os serviços Docker (desenvolvimento local)
docker-up:
    docker-compose up -d

# Sobe os serviços Docker (produção)
docker-prod-up:
    docker-compose -f docker-compose.prod.yml up -d

# Para os serviços Docker
docker-down:
    docker-compose down

# Para os serviços Docker (produção)
docker-prod-down:
    docker-compose -f docker-compose.prod.yml down

# Mostra logs dos serviços (desenvolvimento)
docker-logs:
    docker-compose logs -f

# Mostra logs dos serviços (produção)
docker-prod-logs:
    docker-compose -f docker-compose.prod.yml logs -f

# Reinicia os serviços (desenvolvimento)
docker-restart:
    docker-compose restart

# Reinicia os serviços (produção)
docker-prod-restart:
    docker-compose -f docker-compose.prod.yml restart

##############################
# DATABASE MIGRATIONS (NestJS backend)
#############################

# Mostra o status de todas as migrations (executadas + pendentes)
migration-show:
    docker compose exec orchestrator npm run migration:show

# Executa as migrations pendentes
migration-run:
    docker compose exec orchestrator npm run migration:run

# Reverte a última migration executada
migration-revert:
    docker compose exec orchestrator npm run migration:revert

# Cria uma nova migration com um nome descritivo: just migration-create AddNewTable
migration-create nome:
    docker compose exec orchestrator npm run migration:create -- src/database/migrations/{{nome}}

# Gera uma migration automática comparando as entities com o DB
migration-generate nome:
    docker compose exec orchestrator npm run migration:generate -- src/database/migrations/{{nome}}

# Remove imagens e volumes (desenvolvimento)
docker-clean:
    docker-compose down --volumes --rmi all

# Remove imagens e volumes (produção)
docker-prod-clean:
    docker-compose -f docker-compose.prod.yml down --volumes --rmi all

# Status dos serviços (desenvolvimento)
docker-status:
    docker-compose ps

# Status dos serviços (produção)
docker-prod-status:
    docker-compose -f docker-compose.prod.yml ps

# Abre frontend no navegador (assumindo Linux)
docker-open:
    xdg-open http://localhost:9016 2>/dev/null || echo "Abra http://localhost:9016 no navegador"

# Alias para up (desenvolvimento)
up: docker-up

##############################
# NESTJS ORCHESTRATOR (face-orchestrator)
##############################

# Instala deps do orchestrator (NestJS)
nest-install:
    cd nest && npm install

# Sobe o orchestrator localmente (sem Docker) em http://localhost:3001
nest-dev:
    cd nest && PORT=3001 npm run start:dev-local

# Build TypeScript do orchestrator
nest-build:
    cd nest && npm run build

# Lint do orchestrator
nest-lint:
    cd nest && npm run lint

# Build da imagem Docker do orchestrator
nest-docker-build:
    docker compose build orchestrator

# Restart só do orchestrator
nest-restart:
    docker compose restart orchestrator

# Logs do orchestrator
nest-logs:
    docker compose logs -f orchestrator

##############################
# VISION-SERVICE (face-vision-service)
##############################

# Logs do vision-service
vision-logs:
    docker compose logs -f vision-service

# Restart só do vision-service
vision-restart:
    docker compose restart vision-service

##############################
# STACK COMPLETA (vision + orchestrator + frontend)
##############################

# Sobe todos os microserviços (vision + orchestrator + frontend + minio)
stack-up:
    docker compose up -d --build

# Derruba tudo
stack-down:
    docker compose down

# Logs de toda a stack
stack-logs:
    docker compose logs -f

# Status
stack-status:
    docker compose ps
