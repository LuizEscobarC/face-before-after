# M2_PR22_real_photos.md — Calibração com fotos reais (operação humana)

> Roadmap operacional para **PR-22: Calibração com fotos reais**.
> Esta é uma tarefa **humana** (operador) — IA pode preparar tooling, mas a coleta + julgamento são seus.
> Pré-requisito para promover `region_metric_weights v1.5 → v2.0` e `metric_ideal v1.0 → v2.0`.
> Última atualização: 2026-05-08.

---

## 0. Objetivo

Calibrar empiricamente:

1. **`metric_ideal` v2.0** — ajustar `green_range_min/max` e `yellow_range_min/max` de cada métrica com base na distribuição observada em ≥30 fotos reais variadas.
2. **`region_metric_weights v2.0`** — confirmar (ou ajustar) os pesos provisórios da v1.5 com base em quais métricas mostram **discriminação real** (variância) na amostra.
3. **`global_weights v2.0`** — confirmar pesos das 9 regiões observando quais regiões mais diferenciam rostos "harmônicos" de "não-harmônicos" segundo julgamento humano.
4. **Validar bandas de score** (`<50` / `50–70` / `70–85` / `>85`, DEC-9) — distribuição em 30 fotos cobre as 4 faixas? Se 100% caem em uma só, calibração está errada.

---

## 1. Tamanho mínimo da amostra

| Cenário | Fotos | Justificativa |
|---------|-------|---------------|
| **Mínimo aceitável** | 30 | DEC do plano. Suficiente para detectar viés grosseiro (ex: ideal mal colocado em 15% das amostras). |
| **Confiável** | 100 | Permite estratificação (sex × age band × ethnicity proxy) e percentis estáveis. |
| **Robusto** | 300+ | Permite split treino/validação para ajustar pesos sem overfitting. |

**Recomendação:** começar com **50 fotos** (esforço ~3h coletando + anotando). É o mínimo que dá pra rodar uma calibração defensável sem ter que voltar amanhã pra coletar mais.

---

## 2. Fontes de fotos — opções viáveis

### 2.1 Datasets públicos com licença permissiva (RECOMENDADO)

| Dataset | Tamanho | Licença | Link | Notas para uso aqui |
|---------|---------|---------|------|---------------------|
| **CelebA-HQ** | 30k 1024×1024 | Research only (não-comercial) | https://github.com/tkarras/progressive_growing_of_gans | Frontal (mostly), alta qualidade, diverso. Bom pra calibração interna. **NÃO redistribuir as fotos** — só use os números agregados. |
| **FFHQ (Flickr-Faces-HQ)** | 70k 1024×1024 | CC BY-NC-SA 4.0 | https://github.com/NVlabs/ffhq-dataset | Igual CelebA-HQ. Diversidade demográfica boa. NVIDIA licenciou só pra research. |
| **UTKFace** | 20k+ | Research only | https://susanqq.github.io/UTKFace/ | Bom porque tem age/gender/ethnicity labels — útil pra estratificar. |
| **Chicago Face Database (CFD)** | 1207 | Free for research (registro requerido) | https://www.chicagofaces.org/ | **Padrão-ouro acadêmico**: fotos padronizadas, frontal, neutral expression, iluminação controlada, demografia balanceada. Inclui ratings de atratividade por painel humano (média de 30 raters). **Use isto se conseguir.** |
| **AFAD (Asian Face Age Dataset)** | 165k | Research only | https://afad-dataset.github.io/ | Para balancear viés caucasiano de FFHQ/CelebA. |
| **DiveFace** | 24k | CC BY-NC | https://github.com/BiDAlab/DiveFace | Balanceado em ethnicity (East Asian / Sub-Saharan / Caucasian). |

**Como acessar:**
- CelebA-HQ + FFHQ: `git clone` ou download direto. ~50GB cada — baixe só 100 imagens via amostragem.
- CFD: registro acadêmico em https://www.chicagofaces.org/default/registration/ (dão acesso em 1–3 dias).
- UTKFace + AFAD: download direto sem registro.

### 2.2 Auto-coleta supervisionada

Se preferir 100% controlado (sem dependência de licença de dataset):

- **Fotos de operador interno** (você, equipe, voluntários consentidos) — N=10–20.
- **Fotos públicas de pessoas conhecidas** (atores, atletas) com **único uso interno de calibração** — Wikimedia Commons (CC BY-SA): https://commons.wikimedia.org/wiki/Category:Portrait_photographs
- **Stock photos com licença** — Unsplash (https://unsplash.com/s/photos/portrait-front), Pexels (https://www.pexels.com/search/portrait/) — ambos têm licença permissiva (similar a CC0).
  - **Filtro recomendado:** "frontal portrait", "passport style", "headshot", "neutral expression".
  - Baixe ~50 e descarte as que não tiverem yaw/pitch < 10°.

### 2.3 Critérios de exclusão (rejeitar foto se)

- [ ] Yaw > 15° ou Pitch > 10° (perfil/3-quartos).
- [ ] Oclusão facial (óculos cobrindo olho, máscara, cabelo cobrindo testa/sobrancelha).
- [ ] Resolução < 600×600px na ROI da face.
- [ ] Sorriso largo (deforma boca/mouth metrics).
- [ ] Sombra forte (uma metade do rosto >2 stops mais escura que outra).
- [ ] Make-up extremo (contouring, eye liner pesado — distorce landmarks).
- [ ] Idade aparente < 18.

---

## 3. Pipeline operacional (como rodar a calibração)

### Passo 1 — Coleta + curadoria
- Baixar 50–100 candidatas de uma das fontes acima.
- Aplicar critérios de exclusão (Sec 2.3) → ficar com ≥30 válidas.
- **Anonimizar:** renomear arquivos para `cal_001.jpg`, `cal_002.jpg`, … Manter um CSV `mapping.csv` (não-versionado, fora do git) ligando arquivo ↔ origem para auditoria.
- Estratificar por sex (M/F/other), age band (18–29 / 30–44 / 45–59 / 60+), ethnicity proxy (a olho nu — só pra ter cobertura mínima).

### Passo 2 — Rodar pipeline em batch
**Tooling necessário (NÃO existe ainda — será PR-22-tooling):**

```bash
# Script proposto: backend/scripts/run_calibration_batch.py
# Input: pasta com 30+ fotos
# Output: CSV com uma linha por (foto, metric_id, value, confidence_final)

python backend/scripts/run_calibration_batch.py \
  --input-dir ./calibration/photos/ \
  --output ./calibration/results.csv \
  --capture-mode multi-frame  # opcional: usa PR-23 stability se foto tiver 3+ frames
```

### Passo 3 — Análise estatística (Jupyter notebook)
**Tooling proposto:** `backend/scripts/analyze_calibration.ipynb`

Por métrica:
- Histograma + boxplot dos valores observados em N fotos.
- Comparar distribuição observada vs `metric_ideal.green_range`:
  - Se >70% das fotos caem fora da `green_range` → ideal está mal colocado, **reajustar** `green_range_min/max` para cobrir o **percentil 25–75** observado.
  - Se <10% das fotos caem na `yellow_range` mas há cluster claro fora dela → expandir yellow.
  - Se variance da métrica é ~0 (todo mundo tem o mesmo valor) → métrica não discrimina, considerar **rebaixar peso** para 0.5 ou marcar `presentation_only=true`.
- Correlação entre métricas (heatmap): se duas métricas correlacionam r > 0.85, são redundantes — manter só a com maior `dependency_landmarks` count (mais robusta).

### Passo 4 — Ajustes manuais
**Tooling proposto:** `backend/scripts/calibration_overrides.csv`

Operador edita CSV com colunas:
```csv
metric_id,new_green_min,new_green_max,new_yellow_min,new_yellow_max,new_weight,justification
jaw_width_ratio,0.78,0.83,0.74,0.87,1.5,"Coorte BR 50 fotos: P25=0.78 P75=0.83 (Farkas tinha 0.75-0.85 — encolheu green)"
phi_face_height_to_width,,,,,0,"100% das fotos fora de phi±2% → confirma DEC-6, mantém presentation_only"
```

### Passo 5 — Migration
Script gera migration TypeORM `1746000160000-CalibrateIdealsAndWeightsV2_0.ts` que:
1. Cria `ideals_version v2.0` + `metric_ideal` rows novas (uma por métrica ajustada).
2. Cria `region_metric_weights_version v2.0` (sem `is_provisional`) + `region_metric_weight` rows novas.
3. **Marca v1.5 como `is_active=FALSE`** (mantém row pra histórico).
4. **Marca v2.0 como `is_active=TRUE`**.
5. v1.0 permanece intocada (`is_active=TRUE` em paralelo durante grace period — opcional).

### Passo 6 — Re-run em histórico (opcional)
Re-roda comparação contra ideal v2.0 em `analysis_report` antigos sem refazer landmarks (vantagem do design DDL §2.3 — comparação é tabela 1:1 separada).

---

## 4. Tooling que falta construir (sub-PRs sugeridas)

| Sub-PR | Escopo | Esforço | Modelo |
|--------|--------|---------|--------|
| **PR-22a** | `backend/scripts/run_calibration_batch.py` — batch runner com auto-detection MediaPipe + reuso da pipeline `/vision/metrics-v2` | 2h | Sonnet |
| **PR-22b** | `backend/scripts/analyze_calibration.ipynb` — notebook de análise com histogramas, correlações, sugestão automática de ranges | 2h | Sonnet |
| **PR-22c** | `backend/scripts/generate_calibration_migration.py` — gera TypeORM migration a partir de `calibration_overrides.csv` | 1h | Sonnet |
| **PR-22d** | DDL: tabela `calibration_session` (registro auditável de cada calibração: data, N fotos, fontes, hash do dataset, operador, decisões) | 1h | Sonnet |
| **PR-22-FINAL** | Operação humana: coletar fotos, rodar pipeline, editar CSV, gerar migration, validar | ~6h humano + Opus para revisão das decisões | **Opus + humano** |

---

## 5. Considerações de privacidade e licença

- **NUNCA committar fotos reais no git** (`.gitignore` já cobre `calibration/photos/`).
- Mesmo para datasets de pesquisa, **só guarde números agregados** (CSV de resultados pode ir pro git; imagens não).
- Se usar fotos de pessoas reconhecíveis para auto-coleta, **obtenha consentimento por escrito** antes da operação. Template: `docs/consent_form_calibration.md` (a criar).
- LGPD: dados biométricos faciais são **dados pessoais sensíveis** (Art. 5º II + Art. 11 da Lei 13.709/2018). Use só dados agregados para calibração, não armazene fotos > 90 dias, dê opção de deleção.

---

## 6. Critérios de aceitação para fechar PR-22

- [ ] N ≥ 30 fotos válidas processadas com sucesso.
- [ ] CSV `results.csv` no formato esperado.
- [ ] Notebook `analyze_calibration.ipynb` rodado e salvo com gráficos.
- [ ] CSV `calibration_overrides.csv` com decisões justificadas para **todas** as métricas que receberam ajuste.
- [ ] Migration `CalibrateIdealsAndWeightsV2_0` criada e aplicada em staging.
- [ ] Distribuição de score global em 30 fotos cobre **≥3 das 4 bandas** (DEC-9).
- [ ] PR description com tabela "antes vs depois" para cada métrica ajustada + fonte/justificativa.

---

## 7. Fontes acadêmicas (para citar em `population_reference_note` v2.0)

- **Farkas LG (1994)**. *Anthropometry of the Head and Face*, 2nd ed. Raven Press. ISBN 0-7817-0159-7.
  → Padrão-ouro de medidas; faltam dados não-caucasianos.
- **Naini FB (2011)**. *Facial Aesthetics: Concepts and Clinical Diagnosis*. Wiley-Blackwell. ISBN 978-1-4051-8192-7.
  → Síntese clínica; cita Farkas + Sarver + Edler.
- **Sarver DM, Ackerman MB (2003)**. "Dynamic smile visualization and quantification". *Am J Orthod Dentofacial Orthop* 124(2):116–127. DOI: [10.1016/S0889-5406(03)00307-X](https://doi.org/10.1016/S0889-5406(03)00307-X)
- **Bashour M (2006)**. "An objective system for measuring facial attractiveness". *Plast Reconstr Surg* 118(3):757–774. DOI: [10.1097/01.prs.0000232980.81704.83](https://doi.org/10.1097/01.prs.0000232980.81704.83)
  → Único trabalho que tenta operacionalizar atratividade — referência crítica para PR-22.
- **Edler RJ (2001)**. "Background considerations to facial aesthetics". *J Orthod* 28(2):159–168. DOI: [10.1093/ortho/28.2.159](https://doi.org/10.1093/ortho/28.2.159)
- **Ma DS, Correll J, Wittenbrink B (2015)**. "The Chicago face database: A free stimulus set of faces and norming data". *Behav Res Methods* 47:1122–1135. DOI: [10.3758/s13428-014-0532-5](https://doi.org/10.3758/s13428-014-0532-5)
  → Paper do CFD — descreve metodologia de rating perceptual.
- **Karras T et al. (2019)**. "A Style-Based Generator Architecture for GANs" (FFHQ paper). CVPR. arXiv:[1812.04948](https://arxiv.org/abs/1812.04948)
- **Liu Z et al. (2015)**. "Deep Learning Face Attributes in the Wild" (CelebA paper). ICCV. arXiv:[1411.7766](https://arxiv.org/abs/1411.7766)

---

## 8. Cronograma sugerido (operação humana)

| Etapa | Tempo | Quando |
|-------|-------|--------|
| Construir tooling (PR-22a–d) | 6h IA | **Antes** de coletar fotos |
| Solicitar acesso ao CFD | 5min + 1–3 dias espera | Em paralelo |
| Baixar amostra FFHQ/UTKFace (50 fotos) | 30min | Quando tooling pronto |
| Curadoria + exclusão | 1h | Após download |
| Rodar batch | 5min | Após curadoria |
| Análise notebook | 2h | Após batch |
| Edição overrides CSV (decisão por métrica) | 2h (Opus ajuda) | Após análise |
| Gerar + rodar migration | 30min | Após overrides |
| Validar bandas + commit | 30min | Final |
| **TOTAL** | **~6h** humano (+6h IA prep) | Sessão dedicada |
