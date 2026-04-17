# Makefile para Análise de Assimetria Facial
# antes.png = estado inicial; depois.png = estado final.

PYTHON   := /home/luizescobal/study/face-before-after/.venv/bin/python
SCRIPT   := face_asymmetry.py
COMPARE  := compare_report.py
WEB      := build_html_report.py

IMG_ANTES   := antes.png
IMG_DEPOIS  := depois.png

OUT_ANTES   := resultado_analise_antes
OUT_DEPOIS  := resultado_analise_depois

JSON_ANTES  := $(OUT_ANTES)/05_reports/antes_report.json
JSON_DEPOIS := $(OUT_DEPOIS)/05_reports/depois_report.json

REPORT_OUT  := relatorio_comparativo.txt
HTML_OUT    := relatorio.html

.PHONY: all antes depois report web clean help

all: antes depois report web
	@echo ""
	@echo "OK -> $(OUT_ANTES)/  $(OUT_DEPOIS)/  $(REPORT_OUT)  $(HTML_OUT)"

antes:
	@echo "Analisando ANTES..."
	$(PYTHON) $(SCRIPT) -i $(IMG_ANTES) -o $(OUT_ANTES)

depois:
	@echo "Analisando DEPOIS..."
	$(PYTHON) $(SCRIPT) -i $(IMG_DEPOIS) -o $(OUT_DEPOIS)

report:
	@echo "Gerando relatorio ANTES -> DEPOIS..."
	$(PYTHON) $(COMPARE) --before $(JSON_ANTES) --after $(JSON_DEPOIS) --label-before ANTES --label-after DEPOIS --output $(REPORT_OUT)

web:
	@echo "Gerando relatorio HTML autocontido..."
	$(PYTHON) $(WEB) --before $(JSON_ANTES) --after $(JSON_DEPOIS) --label-before ANTES --label-after DEPOIS --output $(HTML_OUT)

clean:
	rm -rf $(OUT_ANTES) $(OUT_DEPOIS) $(REPORT_OUT) $(HTML_OUT)

help:
	@echo "make all | antes | depois | report | web | clean"
