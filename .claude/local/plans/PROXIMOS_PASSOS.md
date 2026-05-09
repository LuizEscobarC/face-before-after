# Próximos passos — onde estamos e o que falta

> Documento humano. Leia em voz de café, não de tabela de PR.
> Última atualização: 2026-05-09.
> Para a tabela técnica completa, ver [`PLAN_METRICS.md`](./PLAN_METRICS.md). Para detalhes por marco, ver [`marcos/`](./marcos/).

---

## 1. O que já está em pé

Em uma frase: **o motor que mede um rosto, calcula confiança, pontua e desenha overlays está pronto.** Tudo a jusante (texto, recomendações, PDF) ainda não.

### Engenharia entregue

- **Motor de análise (M0–M1):** Postgres + 14 entidades + migrations + endpoint `POST /v1/analysis/evaluate` que recebe landmarks, chama Python (`/vision/metrics-v2`), compara contra ideais do banco e persiste relatório em transação única. Endpoints de leitura `GET /v1/analysis/reports/:id` e catálogo `GET /v1/catalog/*` também prontos.
- **Catálogo de métricas (M2 — parcial):** 66 métricas em 9 regiões (simetria, terços, quintos, olhos, mandíbula, nariz, boca, sobrancelhas, maçãs, testa, global, phi). 59 ideais calibrados por literatura (Farkas, Naini, Powell & Humphreys). Multi-foto + estabilidade de landmarks ativa.
- **Pesos provisórios (PR-21 v1.5):** rebalanceamento estrutural — antes os pesos eram dominados por "região com mais métricas ganha"; agora cada região contribui com fatia explícita e justificada por literatura. Versão **provisória** (`is_provisional=true`) — segue ativa em paralelo com v1.0 até PR-22.
- **Overlays visuais (M3 inteiro ✅):**
  - Eixos, grids de terços e quintos, contorno do rosto.
  - Setas de melhoria por métrica (vetores ICU, com cores por severidade).
  - Heatmaps de assimetria (Marquardt mirror) e aderência ao ideal.
  - Composição lado-a-lado *before* (foto original) × *ideal* (com wireframe alvo em ciano).
  - Cascata de supressão por confiança em 3 níveis (não desenhar pior do que não desenhar).
- **Infra de texto diagnóstico (M4.1 ✅):** tabelas `diagnostic_template`, renderer com 4 gates de allowlist, lint script de blacklist (sem palavras tipo "diagnóstico", "patologia", "garantimos"). Mas só **5 templates exemplares** existem — falta escrever o catálogo.

### Tamanho do que existe hoje

- **1110 testes Python** + **161 testes Vitest** verdes.
- DB local em `localhost:9019` (`face_analysis` / `faceanalysis` / `faceanalysis`).
- Frontend buildando limpo, deploy via `just frontend-deploy`.

---

## 2. Onde estamos travados

Há **dois bloqueios reais** e o restante é trabalho mecânico.

### Bloqueio 1 — Calibração com fotos reais (PR-22) **Bloqueio 1 deve ser ignorado, vou revisar depois que o produto estiver pronto**


**O quê:** rodar o sistema em ≥30 fotos variadas, ajustar manualmente as faixas verde/amarelo de cada métrica, validar que o score global se distribui bem entre as 4 bandas (`<50`, `50–70`, `70–85`, `>85`).

**Por que importa:** hoje os ideais vêm de literatura acadêmica (Farkas 1994, Naini 2011). Eles são **defensáveis**, mas não foram calibrados em rostos reais brasileiros. Antes desse passo, qualquer score que o produto exibe está suspeito — e qualquer overlay aponta para um ideal não-validado, o que é dívida ética + legal.

**Quem faz:** **você**, ou um operador humano. IA ajuda na ferramenta, mas o julgamento ("esta foto está 'harmônica'? esta faixa está apertada demais?") é seu. Roadmap detalhado em [`marcos/M2_PR22_real_photos.md`](./marcos/M2_PR22_real_photos.md).

**Esforço estimado:** 50 fotos = ~3 horas coletando + anotando. 100 fotos = um dia.

**Datasets sugeridos:** CelebA-HQ ou FFHQ (uso interno only — não redistribuir as fotos, só os números agregados). Ou fotos próprias / clientes com consentimento.

### Bloqueio 2 — Promoção dos pesos (PR-21 v2.0) **Bloqueio 1 deve ser ignorado, vou revisar depois que o produto estiver pronto**

**O quê:** depois do PR-22, validar com dados reais que os pesos provisórios v1.5 (symmetry=0.18, eyes=0.16, jaw=0.14, …) batem com o que o operador acha "harmônico". Se Spearman ρ > 0.3 entre score e ranking subjetivo, promove para v2.0; senão, ajusta e volta.

**Bloqueia em:** PR-22.

**Esforço:** ~1 dia depois das fotos coletadas. Roadmap em [`marcos/M2_PR21_v15_to_v20.md`](./marcos/M2_PR21_v15_to_v20.md).

---

## 3. O que falta tecnicamente (em ordem de dependência)

```
                  PR-22 fotos reais  ──┐
                  (humano, ~1 dia)     │
                                       ▼
                  PR-21 v2.0 promoção  ──┐
                  (Opus, ~1 dia)         │
                                         ▼
M2 ✅ ────────────────────────────────────┐
                                          │  M3 já ✅
                                          ▼
                   M4.2 — escrita do catálogo de texto (PR-53)
                          ~300-500 templates × 3 tamanhos
                          (Opus required, judgment de tom)
                                          │
                                          ▼
                   M4.3 — recomendações (PR-55..57)
                          ~50 recomendações categorizadas
                          decisão crítica: lifestyle vs professional_referral
                          (Opus required em PR-56)
                                          │
                                          ▼
                   M4.4 — priorização (PR-58..59)
                          fórmula I×S×C×A com penalidades
                          endpoint GET /v1/analysis/:id/narrative
                                          │
                                          ▼
                   M4.5 — PDF (PR-60..62)
                          ReportLab/WeasyPrint
                          POST /v1/analysis/:id/pdf
                          botão "baixar relatório" no frontend
                                          │
                                          ▼
                                       🎉 produto completo
```

### Detalhamento dos próximos PRs

| PR | O que entrega | Modelo | Esforço |
|----|---------------|--------|---------|
| **PR-22** | 30–50 fotos analisadas + planilha de override de faixas | humano | 3h–1 dia |
| **PR-21 v2.0** | Pesos validados empiricamente, promove `is_active=TRUE` | Opus | 1 dia |
| **PR-53** | ~300–500 templates de diagnóstico em PT-BR (`diagnostic_template`) | **Opus** | 2–3 dias (revisão de tom é o gargalo) |
| **PR-54** | Revisão humana dos templates antes de virar v1.0 | humano + Opus | 1 dia |
| **PR-55** | DDL `recommendation_catalog` + 4 tabelas | Sonnet | 4h |
| **PR-56** | ~50 recomendações com gatilho `metric × severity` + categoria | **Opus** | 2 dias |
| **PR-57** | `RecommendationEngine` que faz match + ranqueia + persiste | Sonnet | 1 dia |
| **PR-58** | `DiagnosticPriorityService` (fórmula I×S×C×A) | **Opus** | 1 dia |
| **PR-59** | `GET /v1/analysis/:id/narrative` (top-3 findings + top-5 recs + disclaimer) | Sonnet | 4h |
| **PR-60** | Python `PdfBuilder` (capa → score → findings → overlays → recs → disclaimer) | Sonnet | 1–2 dias |
| **PR-61** | Nest endpoint que dispara PDF, salva em MinIO | Sonnet | 4h |
| **PR-62** | Botão "Baixar relatório completo" no frontend | Sonnet | 4h |

**Total estimado para fechar o produto (depois de PR-22):** ~10 dias de trabalho de IA + ~3 dias de revisão humana de tom.

---

## 4. Decisões abertas que você precisa tomar

Não dá pra começar M4 sem responder estas três:

### 4.1 Quem revisa o tom dos textos?

PR-53 produz ~300-500 strings em português que vão sair direto pro usuário. A regra é "linha vermelha — nunca diagnosticar". A IA segue a regra, mas **decisões de tom** (quão assertivo? quão emocional? quão "produto premium"?) são editoriais.

**Opções:**
- **(a)** Você revisa pessoalmente as 300 strings (1 dia inteiro de leitura).
- **(b)** Contrata um copywriter freelance com perfil de produto sensível (estética, saúde mental). ~R$ 1k–2k.
- **(c)** Aceita o output do Opus sem revisão humana (risco legal/reputacional não-zero).

Recomendação: **(a) ou (b)**. (c) só se você tem cobertura legal já pensada.

### 4.2 Onde fica a fronteira `lifestyle` vs `professional_referral` em PR-56?

Para cada métrica × severidade, você precisa decidir: a recomendação é "ajuste a postura"/"mude o ângulo da foto" (lifestyle) ou "procure um ortodontista/dermatologista/cirurgião" (professional referral).

Critério proposto no plano: se a única intervenção viável é clínica, é `professional_referral`. Se há ajuste viável de postura/styling/foto, é `lifestyle`.

**Cinza intencional:** `gonial_angle_asymmetry` severo. Ortognática? Postura cervical? Os dois? Decidir junto com produto antes de PR-56.

### 4.3 Banding do PDF — relatório só com score >70 ou todos?

Hoje o sistema esconde score quando `confidence < threshold` ou quando `<50` (banding "no_number"). Para o PDF: quando o usuário tem score 42, ele recebe um relatório "vazio" ou um relatório com só recomendações sem número?

Recomendação: PDF sempre tem **conteúdo positivo** (overlays, recomendações de styling/postura, próximos passos), mesmo sem número. Senão paga e fica frustrado.

---

## 5. O que você pode começar agora (sem esperar nada)

**Hoje à noite, sem ajuda nenhuma:**

1. Escolher dataset (CelebA-HQ ou FFHQ ou fotos próprias).
2. Baixar 50 imagens variadas (sexo, idade, etnia, ângulo).
3. Rodar o pipeline em todas e exportar score + métricas para uma planilha.
4. Ler [`marcos/M2_PR22_real_photos.md`](./marcos/M2_PR22_real_photos.md) §3 (template da planilha de override).

**Em paralelo (não bloqueia PR-22):**

5. Decidir 4.1, 4.2 e 4.3 acima.
6. Escrever 5–10 templates "padrão ouro" à mão para servir de referência ao Opus em PR-53. Cada um vira um exemplo few-shot.
7. Listar 10 recomendações que você **sabe** que quer no produto (ex: "se canthal_tilt baixo → sugerir consulta com oftalmologista plástico"). Vira o seed do PR-56.

**Não comece ainda:**

- Escrita do catálogo full de templates (PR-53). Esperar PR-22 para ter ideais reais.
- PDF (M4.5). Esperar M4.2–M4.4 fecharem.
- Frontend novo. M3 cobriu o que precisa.

---

## 6. Estado dos artefatos

| Coisa | Onde está | Status |
|-------|-----------|--------|
| Plano-mestre | [`PLAN_METRICS.md`](./PLAN_METRICS.md) §0 | ✅ atualizado até PR-43 |
| Backlog M2 | [`marcos/M2_BACKLOG.md`](./marcos/M2_BACKLOG.md) | ✅ |
| Roadmap PR-22 | [`marcos/M2_PR22_real_photos.md`](./marcos/M2_PR22_real_photos.md) | ✅ pronto pra executar |
| Roadmap PR-21 v2.0 | [`marcos/M2_PR21_v15_to_v20.md`](./marcos/M2_PR21_v15_to_v20.md) | ✅ |
| Plano M3 | [`marcos/M3_OVERLAYS.md`](./marcos/M3_OVERLAYS.md) | ✅ implementado |
| Plano M4 | [`marcos/M4_NARRATIVE.md`](./marcos/M4_NARRATIVE.md) | 🟡 M4.1 ✅, M4.2–M4.5 a fazer |
| Review do schema | [`DDL_REVIEW.md`](./DDL_REVIEW.md) | ✅ checklist arquitetural |
| Histórico/brainstorms | [`archive/`](./archive/) | ⚪ ignorável |

---

## 7. TL;DR — se você só vai ler 5 linhas

1. **M2 e M3 estão prontos** — motor de análise + overlays funcionam.
2. **Falta calibrar com 50 fotos reais (PR-22)** — sem isso o produto está "academicamente correto" mas empiricamente cego.
3. **Depois disso, M4 inteiro** (~10 dias de trabalho técnico + ~3 dias de revisão de tom): texto diagnóstico, recomendações, priorização, PDF.
4. **Decida agora** quem revisa o tom dos templates e onde fica a fronteira lifestyle/clínico.
5. **Próxima ação concreta:** baixar 50 fotos e rodar a planilha de override.
