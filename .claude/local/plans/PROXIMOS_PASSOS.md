# Próximos passos — onde estamos e o que falta

> Documento humano. Leia em voz de café, não de tabela de PR.
> Última atualização: 2026-05-11 (revisão pós-PR-64 — Landmark-Driven Face Rig).
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
- **Admin UX / Live Preview (M5 ✅ até PR-64):** `SvgAnatomicalHand` parametrizável + 10 presets (PR-60), bridge MediaPipe→FaceState `landmarkToFaceState` + hook `useLiveFaceState` (PR-61), `SvgFaceInstructor liveState` + 3 seções de preview no admin + hand pairings nos cards de exercício (PR-62), MediaPipe WASM 100% offline (PR-63), e — **entregue 2026-05-11** — `LandmarkRig` que renderiza o SVG facial **direto dos 478 landmarks MediaPipe** com normalização por 4 âncoras + One-Euro filter, substituindo o `FaceRig` hardcoded; modo scripted continua funcional via `applyFaceStateDeformation` sobre `canonical_face_model.obj` oficial; pseudo-3D matrix preservada (PR-64).

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
                  PR-22 fotos reais  ──┐ FEITO
                  (humano, ~1 dia)     │
                                       ▼
                  PR-21 v2.0 promoção  ──┐ FEITO
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

### Detalhamento dos próximos PRs (revisado 2026-05-11 pós-PR-64)

**Conflito de numeração resolvido:** o PROXIMOS_PASSOS antigo previa PR-63..67 para asset pipeline / 3D / AR / assinatura, mas a numeração canônica do `PLAN_METRICS.md` chegou a **PR-64** consumindo a faixa para o eixo M5 (Admin UX). Os PRs futuros foram **shiftados para PR-70+** para evitar colisão.

| PR | O que entrega | Status | Modelo | Esforço |
|----|---------------|--------|--------|---------|
| **PR-22** | 30–50 fotos analisadas + planilha de override de faixas | ⏳ humano (adiado) | humano | 3h–1 dia |
| **PR-21 v2.0** | Pesos validados empiricamente, promove `is_active=TRUE` | ⏳ bloqueado em PR-22 | Opus | 1 dia |
| **PR-53** | ~300–500 templates de diagnóstico em PT-BR (`diagnostic_template`) — escrita Opus + revisão | 🟡 168 entregues em PR-53a (medium-only); falta short+long e cobrir ~30 métricas restantes | Opus | 1–2 dias |
| **PR-54** | Revisão humana dos templates antes de virar v1.0 | ⏳ depende de PR-53 fechar | humano + Opus | 1 dia |
| **PR-55** | DDL `recommendation_catalog` + 4 tabelas | ✅ DONE | Sonnet | — |
| **PR-55b** | Migration `M44RecommendationLadder` — adiciona `exercise` + `aesthetic_procedure`, `evidence_level`, `invasiveness_level`, `clinical_pathway_required`, `disclaimer_template`, `references_jsonb` + extensão de `professional_type` | ✅ DONE (1746000225000+230000) | Sonnet | — |
| **PR-56** | ~50 recomendações com gatilho `metric × severity` + categoria | ✅ DONE — **427 recomendações + 8.352 triggers** entregues | Sonnet+humano | — |
| **PR-56b** | Catálogo `aesthetic_procedure` (nível 4a) — botox masseter, preenchimento labial/malar/mento, fios PDO, rinomodelação. ~10–15 entradas com risk_level + disclaimer estético | ⏳ TODO | Opus | 4h |
| **PR-57** | `RecommendationEngine` que faz match + ranqueia + persiste — **com regra "menor invasiveness primeiro, max 2 categorias, nunca 4b isolado"** (escada PR-55b) | ⏳ próximo | Sonnet | 1 dia |
| **PR-58** | `DiagnosticPriorityService` (fórmula I×S×C×A) — usar `risk_level` + `effort_estimate` + `invasiveness_level` na fórmula | ⏳ TODO | Opus | 1 dia |
| **PR-59** | `GET /v1/analysis/:id/narrative` (top-3 findings + top-5 recs + disclaimer) | ⏳ TODO | Sonnet | 4h |
| **PR-60..63** | M5 Admin UX (SvgAnatomicalHand + liveState + WASM offline) | ✅ DONE | Sonnet | — |
| **PR-64** | **Landmark-Driven Face Rig** — SVG renderizado direto dos 478 landmarks + canonical mesh oficial + One-Euro filter | ✅ DONE [2026-05-11] | Sonnet | — |
| **PR-65** | **Validação visual do PR-64** — abrir `/admin/animations/preview` (seção "Live Face") + RecordExerciseModal e validar pixel-perfect entre rig SVG e mesh overlay; testar mandíbula lateral, abrir/fechar olho, sorrir, yaw 30° | ⏳ próximo (humano) | humano | 30 min |
| **PR-66** | **Mapping completo `FaceState → regiões da malha`** no scripted mode. Hoje cobrimos só jaw/lips/eye-openness/brow-lift+rotate/lip-corner — campos de `FaceState` como `cheekScale`/`noseDx`/`forehead*`/`facePinch` ainda degradam para neutro. Adicionar deformações regionais correspondentes em `applyFaceStateDeformation` | ⏳ TODO | Sonnet | 4h |
| **PR-67** | Python `PdfBuilder` (capa → score → findings → overlays → recs → disclaimer) | ⏳ TODO | Sonnet | 1–2 dias |
| **PR-68** | Nest endpoint que dispara PDF, salva em MinIO | ⏳ TODO | Sonnet | 4h |
| **PR-69** | Botão "Baixar relatório completo" no frontend | ⏳ TODO | Sonnet | 4h |
| **PR-70** | Asset pipeline para exercícios (Lottie/Rive MVP). Esquema `recommendation_asset` + admin CRUD para upload | ⏳ TODO (era PR-63 na versão antiga) | Sonnet | 1 dia |
| **PR-71** | Player Lottie/Rive no frontend. Card de exercício com loop visual + cronômetro isométrico + "onde deve sentir queimar" | ⏳ TODO (era PR-64) | Sonnet | 1–2 dias |
| **PR-72** | Modo 3D (Three.js + Ready Player Me + 52 BlendShapes ARKit). Avatar com músculos visíveis. Feature flag, custo de bandwidth elevado | ⏳ futuro (era PR-65) | Opus | 3–5 dias |
| **PR-73** | Modo Espelho com IA — agora **viável imediato** porque PR-64 já entregou MediaPipe live + landmark normalization. Reaproveitar `useLiveFaceState` + `LandmarkRig.showMesh` + adicionar overlay AR sobre vídeo (em vez de canvas SVG isolado) | ⏳ destrambou pós-PR-64 (era PR-66) | Opus | 3–5 dias (÷2 vs original — infra pronta) |
| **PR-74** | Módulo de assinatura + tracking longitudinal (rotina diária, before/after semanal/mensal). Tabelas `treatment_routine` + `progress_snapshot` | ⏳ futuro (era PR-67) | Opus | 5–7 dias |

**Total estimado para fechar o MVP (depois de PR-22, sem PR-72/73/74):** ~7 dias de trabalho técnico + ~2 dias de revisão de tom.

**Total estimado para o "estado da arte" (com 3D + AR):** +8–12 dias adicionais (reduzido vs estimativa anterior porque PR-64 destravou parte da infra do AR).

---

## 4. Decisões abertas que você precisa tomar

Não dá pra começar M4 sem responder estas três:

### 4.1 Quem revisa o tom dos textos? Decisão: **(c)** Aceito o output do Opus sem revisão humana (risco legal/reputacional não-zero).

PR-53 produz ~300-500 strings em português que vão sair direto pro usuário. A regra é "linha vermelha — nunca diagnosticar". A IA segue a regra, mas **decisões de tom** (quão assertivo? quão emocional? quão "produto premium"?) são editoriais.

**Opções:**
- **(a)** Você revisa pessoalmente as 300 strings (1 dia inteiro de leitura).
- **(b)** Contrata um copywriter freelance com perfil de produto sensível (estética, saúde mental). ~R$ 1k–2k.
- **(c)** Aceita o output do Opus sem revisão humana (risco legal/reputacional não-zero).

Recomendação: **(a) ou (b)**. (c) só se você tem cobertura legal já pensada.

### 4.2 Onde fica a fronteira `lifestyle` vs `professional_referral` em PR-56? **DECIDIDO (2026-05-09)**

Não é uma fronteira binária — é uma **escada de 5 níveis de invasividade** com 8 categorias:

| nível | categoria(s) | exemplo |
|---|---|---|
| 0 | `photo`, `presentation_only` | "refaça a foto com câmera ao nível dos olhos" |
| 1 | `posture`, `lifestyle` | postura cervical, sono, hidratação, respiração nasal |
| 2 | `exercise` *(novo)* | mioterapia mandibular, exercício orofacial, face yoga |
| 3 | `styling` | corte de cabelo, design de sobrancelha, barba |
| 4a | `aesthetic_procedure` *(novo)* | botox masseter, preenchimento, fios de PDO |
| 4b | `professional_referral` | ortodontia, rinoplastia, ortognática, derma |

**Regra do engine (PR-57):** sempre exibir o degrau mais baixo disponível primeiro. Pode listar até 2 níveis em paralelo. Nível 4b só dispara quando `severity=extreme` OU flag `clinical_pathway_required=true` no trigger (oclusão dentária, função respiratória, derma clara).

**Pseudo-ciência** (mewing, face yoga sem RCT) entra com `evidence_level='anecdotal'` e disclaimer obrigatório. Estudos com evidência (mioterapia em TMJ, postura cervical) ficam como `'moderate'`. RCTs / consensos viram `'strong'`.

**`gonial_angle_asymmetry` resolvido:**
- mild → moderate: mioterapia mandibular + postura cervical (níveis 1-2).
- strong: adiciona barba estruturada (3) + botox masseter (4a, com disclaimer estético).
- extreme: aí sim libera professional_referral para bucomaxilo.

Plano detalhado da implementação: [`/home/luizescobal/.claude/plans/fa-a-mais-uma-revis-o-quirky-hopper.md`](../../../.claude/plans/fa-a-mais-uma-revis-o-quirky-hopper.md). Migration aditiva: `1746000230000-M44RecommendationLadder.ts`.

**Estado em 2026-05-09:** catálogo v1.0 ativo com **427 recomendações** distribuídas:
- 24 photo (nível 0) · 2 presentation_only (0) · 30 posture (1) · 142 lifestyle (1)
- **160 exercise (2)** · 49 styling (3) · **27 professional_referral (4b)** · 0 aesthetic_procedure (4a — pendente em PR-56b)
- 350 com evidência (strong/moderate) · 84 anecdotal com disclaimer obrigatório

Todas `professional_referral` carregam disclaimer **informativo não-prescritivo**: "A rotina do app cobre as principais melhorias possíveis sem intervenção clínica. Em casos como o seu, alguns usuários optam por consultar [especialidade]... não é exigência nem condição de melhora."

### 4.4 Como ensinar exercícios ao usuário? (NOVA — surge de [`solucoes-para-rotina-de-exercicios.md`](../../../solucoes-para-rotina-de-exercicios.md))

160 exercícios catalogados são inúteis se o usuário não consegue executar corretamente. Foto + texto não funcionam para músculo facial — usuário comum erra a forma e pode piorar assimetria.

**Caminho recomendado em 3 níveis** (PR-63 → PR-64 → PR-65 → PR-66):

| nível | tecnologia | efeito | esforço |
|---|---|---|---|
| **MVP** | Lottie/Rive (animação 2D vetorial) | Setas + áreas vermelhas + visão raio-X esquemática | 1–2 dias por lote de 30 animações |
| **State of the Art** | Three.js + Ready Player Me + 52 ARKit BlendShapes | Avatar 3D com músculos visíveis; modo "raio-x" mostra masseter/hioide contraindo | 3–5 dias |
| **Diferencial matador** | MediaPipe FaceMesh AR overlay | Câmera frontal + linhas guia em tempo real + feedback "relaxe a testa, segure 5s" | 5–7 dias |

**Decisão recomendada:** começar MVP (PR-63 + PR-64 com Lottie/Rive) e adiar 3D + AR (PR-65 + PR-66) para pós-validação. Asset pipeline + ilustrador freelance para 30 animações de alta prioridade ≈ R$ 3-6k.

**Schema sugerido:** tabela `recommendation_asset` (recommendation_id, asset_type, storage_url, duration_ms, alt_text, thumbnail_url) — 1:N com `recommendation_catalog`. Admin CRUD em `/admin/recommendations/:id/assets`.

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

1. **M2, M3 e M5 (Admin UX) estão prontos** — motor de análise + overlays + admin live preview com SVG renderizado direto dos 478 landmarks (PR-64, 2026-05-11).
2. **Falta calibrar com 50 fotos reais (PR-22)** — sem isso o produto está "academicamente correto" mas empiricamente cego.
3. **Depois disso, M4 inteiro** (~10 dias de trabalho técnico + ~3 dias de revisão de tom): texto diagnóstico, recomendações, priorização, PDF.
4. **Decida agora** quem revisa o tom dos templates (4.1) e como ensinar exercícios (4.4 — Lottie/Rive MVP recomendado, 3D/AR pós-validação).
5. **Próxima ação concreta:** **PR-65** (validação visual do LandmarkRig — 30 min, abre `/admin/animations/preview` e confirma pixel-perfect) **OU** baixar 50 fotos para PR-22 — escolha sua aposta de impacto.
