python   := ".venv/bin/python"
pip      := ".venv/bin/pip"
pytest   := ".venv/bin/pytest"

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
        simulate_before_after.py compare_report.py build_html_report.py build_mvp_html.py
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
