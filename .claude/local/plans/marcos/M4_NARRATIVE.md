---
tenant_id: "face-before-after"
project: "face-before-after"
module: "marcos/M4_NARRATIVE"
file_path: ".claude/plans/marcos/M4_NARRATIVE.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  > Plano detalhado do Marco 4 — diagnóstico textual + recomendações + PDF + disclaimer. > Releia junto com ../PLANMETRICS.md, ./M2BACKLOG.md e ./M3OVERLAYS.md. > Atualização: 2026-05-08 split do PLANMETRICS §8, ainda não iniciado.
tags:
  - "planning"
  - "narrative"
rag_keywords:
  - "marcos"
  - "narrative"
  - "plans"
  - "report narrative"
  - "scorer narrative"
related_modules: []
depends_on: []
used_by: []
---
# M4_NARRATIVE.md — Marco 4: diagnóstico textual + recomendações + PDF + disclaimer

> Plano detalhado do **Marco 4 — diagnóstico textual + recomendações + PDF + disclaimer**.
> Releia junto com `../PLAN_METRICS.md`, `./M2_BACKLOG.md` e `./M3_OVERLAYS.md`.
> Atualização: 2026-05-08 (split do PLAN_METRICS §8, ainda não iniciado).

---

## 0. Quando iniciar

**Pré-requisito duro:** M2 fechado + M3.1 e M3.2 fechados (ao menos overlays simples e setas). Heatmaps (M3.3) podem ser paralelos.

**Por quê:** o texto de diagnóstico cita medições. Sem score regional/global confiável (M2) e overlays funcionando (M3), o texto fica desconectado da imagem que o usuário vê e vira falar sozinho.

---

## 1. Princípios duros — onde a coisa pode dar problema sério

> **Aviso do prompt do usuário (literal):**
> *"Copywriting dos disclaimers e templates. Tom de produto sensível (estética, sem virar diagnóstico médico), priorização de findings, escolha de quais recomendações são 'professional referral' vs 'lifestyle'. Tem implicação legal e ética."*

### 1.1 Linha vermelha: nunca diagnosticar

Toda string que sai para o usuário **DEVE**:

- Usar verbos de **observação geométrica**: "observa-se", "a medida indica", "padrão visual de", "tende a apresentar". 
- **NÃO** usar verbos diagnósticos: "você tem", "diagnostica-se", "patologia", "deficiência", "distúrbio", "deformidade", "anomalia", "assimetria patológica".
- **NÃO** prometer resultado: "vai melhorar", "garantimos", "transforma", "corrige".
- **NÃO** sugerir intervenção médica direta sem qualificar como "buscar avaliação profissional".

Implementação:
- `LinterTemplateService` que roda em CI sobre `diagnostic_templates.yaml` e barra build se encontrar palavras da blacklist.
- Blacklist editável em `nest/src/config/yaml/template_blacklist.yaml` (curada por revisão de produto).

### 1.2 Disclaimer congelado (DEC-3 + texto canônico já em PLAN_METRICS §3)

O disclaimer é **TEXT congelado** em `analysis_report.disclaimer_text_snapshot`. Mudar o texto requer:
1. Nova `analysis_threshold_config.version` (incrementa).
2. Migration explícita marcando v_anterior `is_active=FALSE`.
3. Análises antigas mantêm o texto que o usuário viu na época (RNF auditoria).

### 1.3 Tom emocional

- **Evitar superlativos negativos** ("muito ruim", "péssimo", "grave").
- **Quando severidade é `extreme`**, usar tom factual + recomendar avaliação profissional, não dramatizar.
- **Banding `<50` (no_number)**: mensagem padrão é *"Aspectos a refinar antes de medir o conjunto. Vamos focar em ajustes pontuais."* — nunca um número, nunca a palavra "baixo".

---

## 2. Backlog de PRs do M4

### Sub-marco M4.1 — infra de templates

| PR | Escopo | Modelo |
|----|--------|--------|
| **PR-50** | Migration `0020_DiagnosticTemplates`: tabelas `diagnostic_template_version`, `diagnostic_template` (`metric_id`, `severity`, `direction`, `size`, `template_pt`, `placeholders_used` JSONB), `template_blacklist_version`, `template_blacklist_term`. Seed v0.1 com 5 templates exemplares (1 por região M1) + blacklist mínima. | Sonnet |
| **PR-51** | Nest `TemplateRendererService` com `render(template, placeholders)` (similar a Mustache mas seguro — só `{value}`, `{ideal}`, `{deviation_pct}`, `{direction_label}`, `{region_pt}`). Lança erro se template usar placeholder não declarado. | Sonnet |
| **PR-52** | CI lint: roda blacklist sobre TODA `template_pt` ativa. Build quebra se hit. | Sonnet |

### Sub-marco M4.2 — catálogo + escrita inicial

| PR | Escopo | Modelo |
|----|--------|--------|
| **PR-53** | **Escrita do catálogo de templates v1.0**: 3 tamanhos (short/medium/long) × N severidades × M direções, para as ~60 métricas. Total esperado: ~300-500 templates. | **Opus** (judgment de tom) |
| **PR-54** | Revisão de produto + ajustes de tom. Pode envolver passar por revisor humano com perfil de copy. | **Opus** |

### Sub-marco M4.3 — recomendações

| PR | Escopo | Modelo |
|----|--------|--------|
| **PR-55** | Migration `0021_RecommendationCatalog`: `recommendation_catalog_version`, `recommendation_catalog`, `recommendation_trigger`, `recommendation_link`. Categorias enum: `photo`, `posture`, `lifestyle`, `styling`, `professional_referral`, `presentation_only`. | Sonnet |
| **PR-56** | **Escrita do catálogo v1.0**: ~50 recomendações cobrindo todas as categorias. Para cada `metric_id × severity` definir gatilho. **Decisão crítica em cada uma:** é `lifestyle` ou `professional_referral`? Critério: se a única intervenção viável é clínica (ortodontia, cirurgia, dermato), é `professional_referral`. Se há ajuste viável (postura, foto, styling), é `lifestyle/styling/photo`. | **Opus** (judgment legal/ético) |
| **PR-57** | Nest `RecommendationEngine`: dado um `analysis_report`, faz match dos triggers, prioriza por (severity × confidence × peso da métrica × `priority_default`), aplica corte (top 5), persiste `recommendation_link`. | Sonnet |

### Sub-marco M4.4 — priorização

| PR | Escopo | Modelo |
|----|--------|--------|
| **PR-58** | `DiagnosticPriorityService`: aplica fórmula `(I × S × C × A) × (1−R) × (1 − E×0.5)` definida no DDL legado, ajustada para usar `metric_evaluation_against_ideal.severity` + `confidence_final` + `recommendation.risk_level` + `recommendation.effort_estimate`. Persiste em `priority_score_audit`. | **Opus** (calibração da fórmula) |
| **PR-59** | Endpoint `GET /api/analysis/:id/narrative` que devolve: top-3 findings (texto medium), top-5 recommendations (texto short), disclaimer. | Sonnet |

### Sub-marco M4.5 — PDF

| PR | Escopo | Modelo |
|----|--------|--------|
| **PR-60** | Python `PdfBuilder` (ReportLab ou WeasyPrint): consome `analysis_report` + `rendered_asset[]` + narrative do endpoint acima. Gera PDF estruturado: capa → score global → top findings → overlays principais → recomendações → disclaimer. | Sonnet |
| **PR-61** | Nest endpoint `POST /api/analysis/:id/pdf` que dispara, salva em MinIO `/reports/pdf/{report_id}.pdf`, persiste `rendered_asset.asset_type='report_pdf'`. | Sonnet |
| **PR-62** | Frontend: botão "Baixar relatório completo (PDF)" + email opcional. | Sonnet |

---

## 3. Decisões a travar antes do PR-50

| ID | Decisão | Default sugerido |
|----|---------|------------------|
| DEC-30 | **Idioma único v1** | pt-BR. Schema permite multi-locale (`template.locale` + `display_name JSONB`) mas só pt-BR populado. |
| DEC-31 | **Quantos `size`s?** | 3: `short` (1 frase, ≤120 char, para card), `medium` (2-3 frases, ≤350 char, para detalhamento), `long` (parágrafo completo, para PDF). |
| DEC-32 | **Onde a recomendação aparece?** | Na narrativa (medium/long) **e** no PDF. Card resumo só mostra `short` da recomendação top-1. |
| DEC-33 | **Limite de recommendations exibidas** | top-5. `is_displayed_to_user=FALSE` para o resto. |
| DEC-34 | **Quando dispara `professional_referral`** | **REVISADO 2026-05-09** — fronteira é uma escada de 5 níveis (0–4) com 8 categorias: `photo`/`presentation_only` (0), `posture`/`lifestyle` (1), `exercise` (2, novo), `styling` (3), `aesthetic_procedure` (4a, novo), `professional_referral` (4b). Engine sempre tenta o menor nível primeiro; max 2 categorias por sessão. Nível 4b (cirúrgico/clínico) só dispara em `severity=extreme` **OU** trigger marca `clinical_pathway_required=true` (oclusão dentária, função respiratória, derma clara). Caso `gonial_angle_asymmetry strong`: resolve em mioterapia (2) + barba (3) + botox masseter (4a); só `extreme` libera bucomaxilo (4b). Pseudo-ciência (mewing, face yoga) entra com `evidence_level='anecdotal'` + disclaimer obrigatório. Plano: `.claude/plans/fa-a-mais-uma-revis-o-quirky-hopper.md`. |
| DEC-35 | **Disclaimer de cada recomendação `professional_referral`** | **REVISADO 2026-05-09** — tom informativo não-prescritivo, sobrepõe o texto defensivo: "A rotina do app cobre as principais melhorias possíveis sem intervenção clínica. Em casos como o seu, alguns usuários optam por consultar [{professional_type_pt}] para resolução estrutural — não é exigência nem condição de melhora. Esta menção é informativa, não prescrição médica." Implementado em `recommendation_catalog.disclaimer_template` (CHECK obrigatório quando `evidence_level='anecdotal'`). |
| DEC-36 | **Validação humana antes de produção** | PR-53 (templates) + PR-56 (recomendações) **devem** passar por revisor humano (prompt-author + alguém com background de produto/legal). Sem isso, M4 não é "DONE". |
| DEC-37 | **NOVO — Linha vermelha editorial** (B2C+B2B) | Banido: "você precisa", "isso só se resolve com", "é necessário", "indispensável". Permitido: "alguns usuários optam por", "para resolução estrutural completa, há a opção de", "o app cobre as melhorias possíveis sem intervenção clínica". Templates **devem** comunicar quanto da melhoria o app cobre **antes** de mencionar profissional. |
| DEC-38 | **NOVO — Regra de seleção do engine (PR-57)** | (1) Sempre exibir o degrau mais baixo da escada disponível primeiro. (2) Listar até 2 níveis em paralelo. (3) Nível 4b (`professional_referral`) **nunca isolado** — se entra no top-5, **pelo menos 2** das outras 4 vagas devem ser nível ≤3 (rotina do app). (4) Max 2 recomendações da mesma `category` no top-5 (mitiga armadilha #7). |
| DEC-39 | **ARQUIVADO — Asset pipeline para exercícios** | Arquivado. Não faz parte dos próximos passos. |
| DEC-40 | **NOVO — Tracking longitudinal (PR-67, futuro)** | Modelo de assinatura: rotina diária + before/after semanal/mensal. Tabelas `treatment_routine` (rotina ativa do usuário) + `progress_snapshot` (foto + métricas + delta). Justifica o app como "protagonista do tratamento", não consultório. |

---

## 4. Estrutura de placeholders permitidos

Para evitar que template injete texto perigoso, `TemplateRendererService` só aceita um set fechado:

```ts
type TemplatePlaceholder =
  | 'value'              // valor numérico da métrica, formatado
  | 'value_unit'         // unidade pt-BR (ex: "graus", "razão", "unidades intercanthais")
  | 'ideal'              // ideal_central_value formatado
  | 'deviation_pct'      // |deviation_normalized| × 100, formatado
  | 'direction_label'    // direction_label do metric_ideal (já em pt-BR)
  | 'region_pt'          // nome da região em pt-BR
  | 'severity_pt'        // "leve" | "moderado" | "considerável"  (nota: NÃO usar "severo" no texto user-facing)
  | 'metric_display_name'; // display_name[locale] da metric_definition
```

Templates que usem placeholder fora dessa lista **falham no render** com `UnknownPlaceholderError`. CI test obrigatório.

---

## 5. Exemplos de templates (referência para PR-53)

**`metric_id=midline_deviation, severity=mild, direction=left_dominant, size=short`**:
> "Pequeno desvio do eixo facial para a esquerda — {deviation_pct}% além da faixa ideal. Sutil em fotos casuais."

**`severity=moderate, size=medium`**:
> "Observa-se um desvio do eixo facial de {deviation_pct}% para a esquerda. Esse padrão é comum e geralmente não impacta funcionalidade. Para harmonização visual, ajustes de pose na foto e styling de cabelo já produzem mudança perceptível."

**`severity=strong, size=long`**:
> "A medida de alinhamento do eixo facial indica um padrão de desvio para a esquerda mais marcado ({deviation_pct}% além da faixa ideal). Essa observação é puramente geométrica — pode estar associada à pose adotada na foto, padrão habitual de postura cervical, ou diferenças estruturais. Recomendamos: (1) refazer a foto com a câmera ao nível dos olhos e queixo paralelo ao chão; (2) se o padrão persistir em fotos com pose corrigida, considerar avaliação postural com fisioterapeuta. Esta análise não constitui diagnóstico clínico."

(Note o tom: factual, qualificado, sem promessa, com `professional_referral` quando severidade ≥ strong.)

---

## 6. Armadilhas listadas

1. **Template com tom de venda** — *"Você merece o melhor de si"* — REJEITAR. Pode parecer copy ok, mas vira manipulação.
2. **Recomendação `professional_referral` sem disclaimer adicional** — DEC-35 não é opcional.
3. **Severidade `extreme` traduzida como "severo" ou "grave"** — UX: usar "considerável" / "marcado". Reservar `extreme` para métricas estruturais com claro caminho clínico.
4. **PDF que mostra score global mesmo quando `is_displayable=FALSE`** — bug fácil. Test obrigatório.
5. **Recomendação `professional_referral` para algo cosmético** — viola DEC-34. Match deve passar por trigger explícito.
6. **Templates com palavra "diagnóstico" ou "tratamento"** — CI lint barra.
7. **Top-5 recommendations todas da mesma categoria** — diversificação explícita: max 2 por categoria.

---

## 7. Critérios de saída do M4

- [x] **PR-50/51/52 (M4.1 infra de templates)** ✅ DONE.
- [x] **PR-55 (DDL recommendation_catalog)** ✅ DONE.
- [x] **PR-55b (escada de invasividade — `exercise` + `aesthetic_procedure` + `evidence_level` + `clinical_pathway_required`)** ✅ DONE (migration 1746000225000+230000).
- [x] **PR-56 (catálogo Opus)** ✅ DONE — **427 recomendações** populadas (vs ~50 originalmente planejadas), 8.352 triggers, 84 anecdotal com disclaimer obrigatório.
- [x] **PR-53b/PR-54 (templates v1.0 — 504 rows)** ✅ DONE 2026-05-11 (M42b + M42c). Cobertura para 30 métricas novas (fase C) DEFERRED.
- [ ] **PR-56b** — catálogo `aesthetic_procedure` (nível 4a): botox, preenchimentos, fios PDO, rinomodelação. ~10–15 entradas.
- [x] **PR-57 (RecommendationEngine)** ✅ DONE 2026-05-24 (`nest/src/modules/diagnosis/recommendation-engine.service.ts:_applyLadderRule`).
- [ ] **PR-58 (DiagnosticPriorityService)** — usar `risk_level` + `effort_estimate` + `invasiveness_level` na fórmula.
- [ ] **PR-59 (endpoint narrative)**, **PR-60–62 (PDF)**.
- [ ] ~~**PR-70 + PR-71 (vídeo — DEC-39)**~~ Arquivado.
- [ ] Lint de blacklist verde em CI.
- [ ] Revisor humano aprovou catálogo de templates e recomendações.
- [ ] Em ≥10 fotos reais distintas, narrative + PDF inspecionados manualmente sem ressalvas.
- [ ] Disclaimer aparece em 100% dos PDFs e em 100% das narrativas.
- [ ] Recomendação `professional_referral` carrega disclaimer adicional sempre **e nunca aparece isolada no top-5** (DEC-38).

Após isso → produto pode entrar em soft-launch interno. **Hard-launch externo exige revisão jurídica final** sobre o disclaimer e sobre `professional_referral`.

**Pós-MVP** (futuro, fora do M4): PR-74 (módulo de assinatura + tracking longitudinal).
