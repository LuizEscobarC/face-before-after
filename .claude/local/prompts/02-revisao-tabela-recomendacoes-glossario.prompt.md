---
tenant_id: "face-before-after"
project: "face-before-after"
module: "prompts/02-revisao-tabela-recomendacoes-glossario.prompt"
file_path: ".claude/prompts/02-revisao-tabela-recomendacoes-glossario.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Pipeline Python dlib 68 landmarks + OpenCV que analisa duas fotos frontais antes/depois e gera:
tags:
  - "task-prompt"
rag_keywords:
  - "glossario"
  - "prompt"
  - "prompts"
  - "recomendacoes"
  - "revisao"
  - "tabela"
related_modules: []
depends_on: []
used_by: []
---
# Prompt 02 — Revisão de tabela, recomendações, glossário e leitura de imagens

## Contexto do projeto

Pipeline Python (dlib 68 landmarks + OpenCV) que analisa duas fotos frontais
(antes/depois) e gera:

- JSON por foto em `resultado_analise_<antes|depois>/05_reports/*_report.json`
- Relatório de texto `relatorio_comparativo.txt` (`compare_report.py`)
- Relatório HTML autocontido `relatorio.html` (`build_html_report.py`,
  imagens em base64)
- Pipeline orquestrado por `Makefile` (`make all`)

Módulos:
- `face_asymmetry.py` — detecção, alinhamento, heatmap, JSON
- `face_metrics.py` — proporções, dimorfismo, olhos, nariz, boca, forma,
  Marquardt, head pose, qualidade da foto, pele
- `compare_report.py` — diff antes/depois em texto
- `build_html_report.py` — relatório HTML autocontido
- `tests/test_face_metrics.py`

Schema de `measurements`:
- chaves antigas em `_px` e normalizadas em `_pct_ipd`
- `advanced`, `photo_quality`, `skin`

Restrições:
- Manter compatibilidade do JSON (apenas adicionar)
- Sem novas dependências Python
- HTML autocontido, links externos abrem em nova aba
- pt-BR
- Sem CDNs bloqueantes; CSS sempre inline

## Tarefa 1 — Corrigir alinhamento da tabela "Análise Avançada"

A tabela atual no HTML está desalinhada entre colunas e linhas.

Em `build_html_report.py → render_advanced(...)`:

1. Substituir o markup por `<table class="adv-table">` com 5 colunas:
   **Métrica · Antes · Depois · Ideal · Severidade**.
2. Adicionar ao `<style>` do template:
   ```css
   .adv-table { width:100%; border-collapse:collapse; table-layout:fixed;
                font-variant-numeric:tabular-nums; }
   .adv-table th, .adv-table td { padding:8px 10px;
                border-bottom:1px solid #2a2f3a; text-align:left;
                vertical-align:middle; }
   .adv-table th { background:#1a1f2a; font-weight:600; font-size:.9em;
                text-transform:uppercase; letter-spacing:.04em; color:#9aa4b2; }
   .adv-table td.num { text-align:right; font-feature-settings:"tnum"; }
   .adv-table col.metric { width:40%; }
   .adv-table col.val    { width:12%; }
   .adv-table col.ideal  { width:18%; }
   .adv-table col.sev    { width:18%; }
   ```
3. Usar `<colgroup>` para garantir larguras estáveis.
4. Aplicar mesma correção em `render_quality(...)`.
5. Pílula `.pill` deve ter `display:inline-block; min-width:90px; text-align:center`.

Métricas a aparecer (na ordem; ampliar `ADVANCED_DISPLAY` se faltar):
- fWHR (largura/altura sup.)
- Razão do terço inferior
- Canthal tilt médio (°)
- Intercanthal / largura do olho
- Nariz / boca (largura)
- Boca / IPD
- Desvio dos 3 terços
- Desvio dos 5 quintos
- Desvio bilateral global (%IPD)
- Largura mandibular (%IPD)
- Definição da linha mandibular
- Razão lábio sup/inf
- Filtro nasolabial (%IPD)
- Forma facial (linha textual sem severidade — `colspan` na coluna sev.)

## Tarefa 2 — Bloco de recomendações

Antes de codar, pesquisar e listar fontes na PR/commit:
- Estética facial masculina, dimorfismo (Hammond et al., Lefevre 2012 fWHR)
- Mewing/ortotrópica (cuidado com evidência fraca)
- Northwestern facial exercise study (2018)
- Postura craniocervical, respiração nasal, sono e olheiras (Stockholm Sleep 2010)
- AAD/SBD para pele
- Chin tucks, scalene/SCM stretches

Implementação:

1. Criar `recommendations.py`:
   ```python
   def recommend(measurements_after: Dict[str, Any]) -> List[Dict[str, Any]]:
       """Item: {
         'metric_key', 'metric_label', 'severity', 'value', 'ideal',
         'what_is', 'how_measured', 'why_matters',
         'actions': [{'tipo','titulo','descricao','frequencia',
                       'fonte':{'titulo','url'}}],
         'references': [{'titulo','url'}]
       }"""
   ```
2. Cobrir todas as métricas avançadas + assimetria global:
   - Severidade `excelente` → manter (apenas hábitos preventivos)
   - Severidade ≥ `leve` → ações específicas, da menos invasiva à profissional
   - Conteúdos por categoria (`tipo`): exercicio, habito, postura, pele,
     profissional
3. Exemplos:
   - **fWHR alto + jaw def baixo** → Hammond facial exercise, redução de bf%,
     mastigação bilateral
   - **Canthal tilt negativo** → ósseo, cantoplastia/preenchimento, tom cauteloso
   - **Olheiras** → sono 7–9h, elevar cabeceira, retinoide noturno, FPS, HA
   - **Pele uniformidade ruim** → limpador + retinoide + FPS 50
   - **Pose não frontal** → re-fotografar; iluminação, distância ≥1.5 m, fundo neutro
   - **Definição mandibular baixa** → chin-up, redução de bf%, postura, mastigação
   - **Assimetria global moderada+** → fisio orofacial, DTM, bucomaxilo
4. Adicionar seção **PLANO DE AÇÃO** em:
   - `compare_report.py` (texto, agrupado por prioridade — severas primeiro)
   - `build_html_report.py` (card com `<details>` por métrica;
     `<summary>` com rótulo + pílula de severidade; corpo:
     "O que é", "Como o algoritmo mediu", "Por que importa",
     ações com `tipo`/`frequencia`/`fonte`, referências)
5. Todos os links externos: `target="_blank" rel="noopener noreferrer"`.

## Tarefa 3 — Glossário

Adicionar seção **GLOSSÁRIO** ao final do HTML (resumida no .txt).

1. Criar `glossary.py`:
   ```python
   GLOSSARY = {
     'ipd': {'termo','unidade','descricao','como_medido',
             'por_que_normalizamos','problemas_comuns',
             'referencias':[{'titulo','url'}]},
     'fwhr': {...},
     'canthal_tilt': {...},
     'gonial_angle': {...},
     'marquardt': {...},
     'lab_delta_e': {...},
     'laplacian_sharpness': {...},
     'solvepnp_pose': {...},
     # uma entrada por métrica do projeto
   }
   ```
2. Cada entrada: termo, unidade, descrição leiga, como é medido (técnico),
   faixas típicas, problemas comuns, causas, soluções gerais, ≥2 referências
   públicas (Wikipedia/PubMed/AAD/SBD/OpenCV docs).
3. Render em `<dl>`/tabela com colunas: Termo · Unidade · O que é ·
   Como medimos · Referências. Linhas colapsáveis em `<details>`.

## Tarefa 4 — Explicação de como ler cada imagem

Cada figura no relatório recebe um bloco "Como ler esta imagem".

Tipos: `annotated`, `aligned`, `heatmap`, `landmarks`, `comparison`.

Em `build_html_report.py`:

1. Adicionar `IMAGE_GUIDES = { tipo: {titulo, paragrafos, checklist} }`.
   Exemplo `heatmap`:
   - Cores quentes = maior diferença esq/dir espelhado
   - Cores frias = simetria
   - JET aplicado sobre a diferença pixel-a-pixel
   - Checklist: manchas vermelhas localizadas? distribuição uniforme?
     pontos quentes no contorno (pose/iluminação)?
2. Renderizar abaixo de cada `<img>`:
   ```html
   <details class="img-guide">
     <summary>Como ler esta imagem</summary>
     <p>...</p>
     <ul class="checklist">...</ul>
   </details>
   ```
3. Para o par antes/depois, bloco extra "O que comparar visualmente":
   - Calor total diminuiu?
   - Linha média cruza pontos diferentes?
   - Cores quentes mudaram de localização?

## Critérios de aceite

- [ ] `make clean && make all` continua sem erro
- [ ] `pytest tests/ -q` 100% verde
- [ ] Testes adicionados em `tests/test_recommendations.py` e
      `tests/test_glossary.py`
- [ ] HTML em `file://` mostra:
  - Tabela "Análise Avançada" com colunas alinhadas e larguras estáveis
  - Seção "Plano de Ação" com `<details>` por métrica acionável
  - Seção "Glossário" colapsável com referências
  - Sob cada imagem, "Como ler esta imagem" com checklist
- [ ] JSON em `05_reports/*_report.json` opcional ganha bloco `recommendations`
      (HTML/TXT é suficiente)
- [ ] Sem novas dependências
- [ ] Links externos públicos e oficiais, abrem em nova aba

## Como entregar

1. Pesquisar fontes; consolidar lista de referências antes de codar.
2. `face_metrics.py` só muda se precisar expor novos rótulos.
3. Criar `recommendations.py` e `glossary.py`.
4. Atualizar `build_html_report.py` (CSS, render_advanced, render_quality,
   novos `render_action_plan`, `render_glossary`, `render_image_with_guide`)
   e `compare_report.py` (versões texto).
5. Adicionar testes em `tests/test_recommendations.py` e `tests/test_glossary.py`.
6. `make clean && make all` + `pytest -q`.

Não modificar lógica existente de detecção/alinhamento/heatmap. Não alterar o
schema atual do JSON (apenas campos novos opcionais).
