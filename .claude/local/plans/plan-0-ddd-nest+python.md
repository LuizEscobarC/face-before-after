# Plan: Módulo 0 + Arquitetura Híbrida (Vision Service + NestJS + Front)

## Contexto absorvido
- Hoje existe um único FastAPI (`backend/`) que faz tudo: detecta rosto (dlib), extrai landmarks 68pt, calcula métricas (`face_metrics.py`), roda pipeline MVP, expõe `/api/analyze/free`, `/api/analyze/premium`, `/api/compare`.
- Frontend React/Vite chama esses endpoints diretamente.
- Decisão arquitetural nova: NestJS vira backend principal (full DDD bootstrapped), FastAPI vira microserviço **vision-service** com 2 endpoints (`/vision/landmarks`, `/vision/metrics`), reusando os cálculos atuais. Sem RetinaFace/MediaPipe/etc — só dlib + OpenCV que já existem.
- Foco: rodar Módulo 0 (Photo Quality Gatekeeper) + manter pipeline atual funcionando, agora intermediado pelo NestJS.

## Decisões confirmadas
- **NestJS scope**: full DDD com módulos `photo-quality`, `vision`, `diagnosis`, `decision`, `execution`, `tracking`, `identity`, `shared` — alguns só bootstrapped.
- **Python reuse**: refatorar `backend/` atual — adicionar `/vision/*`, desativar `/api/analyze/*` e `/api/compare`. Frontend deixa de chamar Python direto.
- **Frontend**: aponta para NestJS, exibe `PhotoQualityReport` (grade, flags, penalidades, recomendações de recaptura). Sem MediaPipe WASM agora — modo `SERVER_FALLBACK` permanente nesta fase.
- **Sem persistência**: NestJS roda em memória nesta fase (sem DB). `processingMode` sempre `SERVER_FALLBACK` por enquanto.

---

## Arquitetura alvo (após o plano)

```
React/Vite (9016)
   │  multipart/form-data foto
   ▼
NestJS (novo, 9020)
   │  HTTP JSON (axios)
   ▼
FastAPI vision-service (9015) — código Python atual reaproveitado
```

Endpoints NestJS expostos pro front:
- `POST /api/photo-quality/analyze` (foto → `PhotoQualityReport`)
- `POST /api/analysis/free`, `POST /api/analysis/premium` (foto → roda quality + pipeline completo)
- `POST /api/analysis/compare` (run_id_before, run_id_after → comparação)
- `GET  /api/capture-guidelines`

Endpoints vision-service (Python):
- `POST /vision/landmarks` (foto base64) → `LandmarkPayload` (landmarks + pose + qualityScore + flags + regional_penalties + fingerprint)
- `POST /vision/metrics` (landmarks + qualityContext) → `MetricResult[]`
- `POST /vision/full-pipeline` (foto base64 + mode) → resultado MVP existente (transição — mantém compat até NestJS portar comparação completa)
- `GET  /vision/capture-guidelines`
- `POST /vision/compare` (dois run_ids) — chamado internamente pelo NestJS

---

## Fases e prompts (divide & conquer)

Cada item abaixo é um **prompt independente** que pode ser executado separadamente. Dependências marcadas. Os prompts serão materializados como arquivos `.prompt.md` na fase de execução; aqui está o conteúdo.

### Phase A — Vision Service (Python refactor)

#### Prompt A1 — Refatorar FastAPI atual em vision-service com /vision/*
**Depende de**: nada (ponto de partida)

**Objetivo**: transformar o backend Python atual num microserviço de visão puro, expondo `/vision/landmarks`, `/vision/metrics`, `/vision/full-pipeline`, `/vision/compare`, `/vision/capture-guidelines`. Remover endpoints `/api/analyze/*` e `/api/compare`.

**Escopo**:
1. Criar `backend/app/vision/` com:
   - `routers/landmarks.py` → `POST /vision/landmarks` (recebe `image_base64`, `session_id`; usa `app/domain/face.py` para detectar+landmarks; calcula `pose` (yaw/pitch/roll a partir dos landmarks 68pt — usar solvePnP do OpenCV com modelo 3D simples), `qualityScore`/`qualityGrade` via novo `quality_evaluator.py`, `flags` heurísticas básicas (beard/glasses/smile = false por enquanto, hair_covering = false), `regional_penalties` zeradas, `fingerprint` (sha1 do base64), `processing_mode: "SERVER_FALLBACK"`).
   - `routers/metrics.py` → `POST /vision/metrics` (recebe `landmarks: float[][]`, `quality_context`; chama `face_metrics.compute_all` adaptado para receber landmarks já normalizados; padroniza output como `MetricResult[]` com `metric_id, value, error, confidence, region, direction`).
   - `routers/full_pipeline.py` → `POST /vision/full-pipeline` (recebe `image_base64`, `mode`, opcional `session_id`; reusa `app/domain/pipeline.run` integralmente; mantém transição até NestJS portar tudo).
   - `routers/compare.py` → `POST /vision/compare` (mesma lógica do `app/api/endpoints/compare.py` atual).
   - `routers/meta.py` → `GET /vision/capture-guidelines` (igual o atual mas no novo prefixo).
   - `services/quality_evaluator.py` (novo) — implementa Photo Quality real:
     - `evaluate(image_bgr, landmarks, pose) -> QualityReport` calculando: `face_ok` (1 face), `pose_score` (1.0 se yaw/pitch/roll dentro de 8°/8°/5°, decai linear até 0 nos limites de 20°/20°/15°), `sharpness_score` (variance of Laplacian normalizada — limiar 100), `lighting_score` (combina exposição global média no canal L do LAB + uniformidade L/R) e `lighting_asymmetry` (diff de luminância média entre metade esquerda e direita do bbox da face), `occlusion_score` (placeholder 1.0 nesta fase — flags ficam false), `expression_score` (placeholder 1.0).
     - `quality_score = face_ok * pose_score * sharpness_score * lighting_score * occlusion_score * expression_score`.
     - `quality_grade`: ALTA ≥0.85, MEDIA ≥0.70, BAIXA ≥0.55, REJEITADA <0.55.
     - `recommendations`: lista priorizada com no máx 3 itens em pt-BR ("Aproxime um pouco", "Mais luz frontal", "Endireite a cabeça", "Reduza desfoque").
     - `regional_penalties`: por enquanto todas 0.0 (ganchos preparados pra crescer).
   - `services/pose_estimator.py` (novo) — `estimate(landmarks_2d) -> {yaw, pitch, roll}` via `cv2.solvePnP` com modelo 3D canônico de 6 pontos (nariz, queixo, cantos olhos, cantos boca).
   - `schemas/landmark_payload.py`, `schemas/metric_result.py`, `schemas/quality_report.py` (Pydantic models batendo o contrato definido na conversa).
2. Atualizar `backend/main.py` para registrar somente o router `vision.router` com prefixo já incluso. Remover include de `app.api.router` (endpoints antigos).
3. Manter `app/domain/*` intocado (reusado).
4. Apagar (ou marcar deprecated) `app/api/endpoints/analysis.py` e `compare.py` — mover lógica útil para `vision/routers/full_pipeline.py` e `compare.py`.
5. Atualizar `pyproject.toml`: nada novo (sem pacotes externos).
6. Smoke test manual: `curl -F` ou Python script chamando os 5 endpoints novos com a foto `bkp/01/antes.png`.

**Não fazer**: substituir dlib, adicionar MediaPipe/RetinaFace, persistência, autenticação.

---

#### Prompt A2 — Tornar quality_evaluator robusto + fingerprint de sessão
**Depende de**: A1

**Objetivo**: refinar `quality_evaluator.py` e formalizar fingerprint para `ConsistencyScore` futuro.

**Escopo**:
1. Adicionar em `quality_evaluator.py`:
   - `compute_lighting_asymmetry(image_bgr, landmarks) -> float` usando bbox da face dividido na vertical pela linha do nariz (landmark 27→8). Saída: `delta_L / 100` clamped a [0,1].
   - `compute_blur_score(image_bgr, face_bbox) -> float` aplicando Laplacian dentro do bbox apenas (mais sensível).
   - Mapeamento de subscores → recomendação principal (1 só, prioridade: pose > sharpness > lighting > occlusion).
2. Criar `services/fingerprint.py`:
   - `build_session_fingerprint(quality_report, flags) -> str` = sha1 de `f"{beard}|{glasses}|{smile}|{lighting_bucket}|{pose_bucket}|{distance_bucket}"`. Buckets discretos para permitir matching futuro.
3. Adicionar resposta de `/vision/landmarks` os campos `lighting_asymmetry`, `sharpness_score`, `pose_score`, `subscore_breakdown` (dict com cada subscore) — pra facilitar debug e UI.
4. Atualizar `tests/` com 2 testes de smoke: foto boa → `quality_grade in {ALTA, MEDIA}`; foto borrada (gerada via cv2.GaussianBlur) → `quality_grade in {BAIXA, REJEITADA}`.

**Não fazer**: detectar barba/óculos por ML (fica como `false` placeholder com TODO no código).

---

### Phase B — NestJS bootstrap (clonar template `general-reporting-api`)

#### Prompt B1 — Scaffold NestJS copiando o esqueleto de `~/cursobeta/general-reporting-api/`
**Depende de**: nada (paralelo a A1)

**Objetivo**: criar `nest/` na raiz reproduzindo **exatamente** a configuração base do projeto template (`~/cursobeta/general-reporting-api/`), removendo apenas o que é específico do domínio dele (Prisma, MongoDB, Auth, Blacklist, Report). Sem perder tempo redesenhando setup.

**Cópia direta (sem reinventar)**:
1. Copiar do template e adaptar nomes:
   - `package.json` → trocar `name`, `description`, remover deps de DB (`@prisma/*`, `prisma`, `mongoose`, `@nestjs/mongoose`, `mysql2`, `postgres`, `bcryptjs`, `@nestjs/jwt`, `nodemailer`, `@aws-sdk/client-s3`, `exceljs`, `@fastify/static`). Manter: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-fastify`, `@nestjs/swagger`, `@nestjs/schedule`, `@fastify/multipart`, `class-validator`, `class-transformer`, `pino`, `pino-http`, `pino-pretty`, `reflect-metadata`, `rxjs`, `dotenv`. Adicionar: `axios` (para `VisionClient`).
   - Manter `"type": "module"`, `engines.node >=24 <25`, `imports` (`#src/*`, `#modules/*`, `#shared/*`).
   - Scripts mantidos: `build` (sem prisma generate), `start`, `start:dev`, `start:dev-local`, `lint`, `format`.
   - Remover scripts: `prisma:*`, `db:push`, `context:*`.
2. Copiar arquivos de config raiz **inalterados** (só ajustar nomes onde aplicável):
   - `tsconfig.json`, `tsconfig.build.json`
   - `eslint.config.mjs`, `.prettierrc`, `.prettierignore`
   - `.dockerignore`, `.npmrc`
   - `.gitignore`
3. Copiar `Dockerfile.dev` → adaptar:
   - Remover bloco `COPY prisma ./prisma`, `COPY prisma.config.ts ./` e `RUN npx prisma generate`.
   - Trocar `migrate-and-start-dev.sh` por `CMD ["npm", "run", "start:dev"]`.
   - Manter `node:24-alpine`, `dumb-init`, usuário non-root `nestjs`, `EXPOSE 3000 9229`.
4. Copiar `src/main.ts` e adaptar:
   - Remover bloco do título Swagger específico ("API de Relatórios..." → "Face Analysis Orchestrator API"), tags ("EAD", "Hotwebinar" → "Photo Quality", "Analysis", "Vision Bridge").
   - Manter: FastifyAdapter + pino + multipart (50MB) + ValidationPipe global + ApiExceptionFilter + Swagger em `/api/docs` + escrita de `swagger/openapi.json` em dev + CORS.
   - `process.on('unhandledRejection')` e `uncaughtException` mantidos.
   - Porta lida de `PORT` env (default 3000 dentro do container; mapeado para 9020 externo no compose).
5. Copiar `src/shared/config/pino-logger.config.ts`, `src/shared/config/logger.module.ts`, `src/shared/errors/api-exception.filter.ts`, `src/shared/utils/*` **inalterados**.
6. Estrutura `src/modules/` (DDD) — criar do zero seguindo o **estilo** do template (cada módulo: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `application/`, `domain/`, `infrastructure/` quando aplicável):
```
src/
├── main.ts                          (copiado/adaptado do template)
├── app.module.ts                    (registra módulos abaixo + LoggerModule)
├── shared/
│   ├── config/
│   │   ├── pino-logger.config.ts    (copiado)
│   │   └── logger.module.ts         (copiado)
│   ├── errors/
│   │   └── api-exception.filter.ts  (copiado)
│   ├── utils/                       (copiado)
│   └── events/event-bus.module.ts   (novo — EventEmitterModule.forRoot())
├── modules/
│   ├── health/                      (copiado do template — controller GET /health)
│   ├── vision/
│   │   ├── vision.module.ts
│   │   ├── vision.client.ts         ← axios → FastAPI
│   │   └── dto/
│   ├── photo-quality/
│   │   ├── photo-quality.module.ts
│   │   ├── photo-quality.controller.ts    ← POST /api/photo-quality/analyze
│   │   ├── application/photo-quality.orchestrator.ts
│   │   ├── domain/value-objects/quality-grade.vo.ts
│   │   ├── domain/services/photo-storage-policy.ts
│   │   └── infrastructure/in-memory-quality.repository.ts
│   ├── analysis/
│   │   ├── analysis.module.ts
│   │   ├── analysis.controller.ts         ← /api/analysis/free|premium|compare, /api/capture-guidelines
│   │   └── application/analysis.orchestrator.ts
│   ├── diagnosis/diagnosis.module.ts      (stub + README)
│   ├── decision/decision.module.ts        (stub + README)
│   ├── execution/execution.module.ts      (stub + README)
│   ├── tracking/tracking.module.ts        (stub + README)
│   └── identity/identity.module.ts        (stub + README)
└── types/                                  (espelha do template se houver tipos globais úteis)
```
7. `.env.example`:
```
NODE_ENV=development
PORT=3000
VISION_SERVICE_URL=http://vision-service:8000
```
8. README curto em `nest/README.md` apenas com: comandos do template (`npm install`, `npm run start:dev`), porta interna 3000 / externa 9020, env vars, link para Swagger `/api/docs`.

**Não fazer**: redesenhar config (já está pronta no template), instalar Prisma/Mongo/MySQL, autenticação, ESLint custom — usar exatamente o que vem do template.

**Validação**: `cd nest && npm install && npm run start:dev` sobe a API com `/health` 200 e `/api/docs` acessível.

---

#### Prompt B2 — VisionClient + DTOs + tratamento de erros
**Depende de**: B1, A1 (precisa do contrato real)

**Objetivo**: implementar `VisionClient` chamando os 5 endpoints do vision-service, com DTOs tipados.

**Escopo**:
1. `vision.client.ts` é um `@Injectable()` que instancia `axios.create({ baseURL: process.env.VISION_SERVICE_URL, timeout: 30000 })` no construtor (sem `@nestjs/axios` — segue o padrão "leve" do template, que evita wrappers desnecessários).
   - `getLandmarks(imageBuffer: Buffer, sessionId: string): Promise<LandmarkPayloadDto>` → converte buffer→base64, chama `/vision/landmarks`.
   - `getMetrics(landmarks: number[][], sessionId: string, qualityContext: QualityContextDto): Promise<MetricResultDto[]>` → `/vision/metrics`.
   - `runFullPipeline(imageBuffer: Buffer, mode: 'teaser'|'premium', sessionId: string): Promise<unknown>` → `/vision/full-pipeline` (retorna o resultado MVP completo cru, tipado como `Record<string, unknown>` por enquanto).
   - `compare(runIdBefore: string, runIdAfter: string): Promise<CompareResponseDto>` → `/vision/compare`.
   - `getCaptureGuidelines(): Promise<CaptureGuidelinesDto>` → `/vision/capture-guidelines`.
2. Tratamento de erro: Axios error → lança `VisionServiceError` (custom Error com `status`, `detail`). NestJS exception filter global em `main.ts` mapeia para `HttpException`.
3. Timeouts: 30s no `HttpModule.register`.
4. Testes unitários com `nock` ou `axios-mock-adapter` para os 5 métodos.

---

#### Prompt B3 — PhotoQualityModule (Módulo 0)
**Depende de**: B2

**Objetivo**: implementar o gatekeeper de qualidade no NestJS.

**Escopo**:
1. `photo-quality.controller.ts`:
   - `POST /api/photo-quality/analyze` recebe `multipart/form-data` com `photo` (UploadedFile via Multer, in-memory). Validações: ext em {png,jpg,jpeg}, tamanho ≤15MB.
   - Delega para `PhotoQualityOrchestrator.analyze(file)`.
2. `application/photo-quality.orchestrator.ts`:
   - Gera `sessionId = uuid`.
   - Chama `visionClient.getLandmarks(buffer, sessionId)` → `LandmarkPayloadDto`.
   - Constrói `PhotoQualityReport` com:
     - `sessionId`, `qualityScore`, `qualityGrade`, `pose`, `flags`, `regionalPenalties`, `recommendations`, `fingerprint`, `processingMode: 'SERVER_FALLBACK'`, `analyzedAt: ISO`.
   - Retorna o report como JSON.
3. `domain/value-objects/quality-grade.vo.ts`: enum + helper `isAcceptableForOfficialAnalysis(grade): boolean` (ALTA/MEDIA = true).
4. `domain/services/photo-storage-policy.ts`: `shouldStore() => false` sempre nesta fase, com TODO documentado.
5. `infrastructure/in-memory-quality.repository.ts`: Map<sessionId, PhotoQualityReport>. Método `save`/`findById` — usado para auditoria de logs (não persistente entre restarts).

---

#### Prompt B4 — AnalysisModule (proxy free/premium/compare + gating por qualidade)
**Depende de**: B3

**Objetivo**: orquestrar o fluxo completo (qualidade → pipeline → resposta) reusando vision-service.

**Escopo**:
1. `analysis.controller.ts`:
   - `POST /api/analysis/free` (multipart) → orchestrator com `mode='teaser'`.
   - `POST /api/analysis/premium` → orchestrator com `mode='premium'`.
   - `POST /api/analysis/compare` (JSON `{run_id_before, run_id_after}`) → `visionClient.compare`.
   - `GET /api/capture-guidelines` → cache 5min do `visionClient.getCaptureGuidelines`.
2. `application/analysis.orchestrator.ts`:
   - 1) Roda `photoQualityOrchestrator.analyze(file)` para obter `PhotoQualityReport`.
   - 2) Se `qualityGrade === 'REJEITADA'` → resposta 422 `{ error: 'photo_rejected', report }`.
   - 3) Caso contrário, chama `visionClient.runFullPipeline(buffer, mode, sessionId)`.
   - 4) Mescla resultado: `{ ...pipelineResult, photo_quality: report }`. Mantém compat com `AnalysisResult` que o front já consome (campos atuais preservados).
3. Repassar `run_id` retornado pelo Python como está (front depende disso para `compare`).

---

#### Prompt B5 — Stubs dos demais DDD modules + EventBus
**Depende de**: B1

**Objetivo**: deixar os módulos futuros (`diagnosis`, `decision`, `execution`, `tracking`, `identity`) prontos pra evolução com README curto e domain event placeholders.

**Escopo**:
1. Cada módulo tem: `*.module.ts` vazio, `domain/`, `application/`, `infrastructure/` com `.gitkeep`, e `README.md` de 5-10 linhas explicando responsabilidade futura.
2. `shared/events/event-bus.module.ts` registra `EventEmitterModule.forRoot()` global. Cria 1 evento de exemplo `PhotoQualityEvaluated` emitido pelo `PhotoQualityOrchestrator` (sem listener real ainda — só prova o canal).
3. README curto em `nest/README.md` documentando bootstrap, comandos (`npm run start:dev`), env vars e contratos com vision-service.

---

### Phase C — Frontend (apontar para NestJS + UI Photo Quality)

#### Prompt C1 — Repointar API e exibir PhotoQualityReport
**Depende de**: B3, B4

**Objetivo**: front consome NestJS e mostra o report de qualidade na CapturePage antes/depois do submit.

**Escopo**:
1. `frontend/src/api.ts`:
   - Adicionar `analyzePhotoQuality(file: File): Promise<PhotoQualityReport>` chamando `/api/photo-quality/analyze`.
   - `analyzePhoto(mode, file)` continua igual mas agora bate em `/api/analysis/{mode}` (proxy via Vite/nginx aponta pro NestJS, não mais FastAPI).
   - Tratar `422 photo_rejected` retornando o report no error.
2. `frontend/src/types.ts`: adicionar `PhotoQualityReport`, `QualityGrade`, `RegionalPenalties`, `PoseAngles`, `QualityFlags` (espelho dos DTOs do NestJS).
3. Novo componente `frontend/src/components/PhotoQualityCard.tsx`:
   - Recebe `PhotoQualityReport`. Renderiza badge de grade (cores: ALTA=verde, MEDIA=âmbar, BAIXA=laranja, REJEITADA=vermelho), `qualityScore` (0-100), pose angles (yaw/pitch/roll com indicador), flags (chips), até 3 recomendações.
   - Usa CSS variables do design system (`--surface2`, `--accent`, etc) conforme `claude.md`.
4. `CapturePage.tsx`:
   - Após o usuário escolher foto, chama `analyzePhotoQuality` automaticamente (debounce). Mostra `<PhotoQualityCard>`.
   - Se `qualityGrade === 'REJEITADA'`, desabilita botão "Analisar" e mostra mensagem clara.
   - Se ALTA/MEDIA, libera análise normalmente.
5. `nginx.conf` e `nginx.local.conf`: alterar proxy `/api/*` para apontar para `nest:9020` em vez de `api:8000`. Manter `/static/*` (se houver) intacto.

**Não fazer**: MediaPipe WASM, captura em tempo real com feedback frame-a-frame, persistência local.

---

### Phase D — Infra/orquestração

#### Prompt D1 — Docker compose + entrypoints
**Depende de**: A1, B1

**Objetivo**: subir tudo com `docker compose up`.

**Escopo**:
1. Renomear container Python no compose: `face-vision-service`, porta interna 8000, externa 9015 (mantém). Variável: `RESULTADO_API_DIR=/app/resultado_api`.
2. Adicionar service `nest`:
   - `build: ./nest`, usando o `Dockerfile.dev` (copiado do template, ajustado em B1).
   - Porta `9020:3000` (externa:interna — interna fica 3000 igual ao template).
   - Env: `VISION_SERVICE_URL=http://vision-service:8000`, `PORT=3000`, `NODE_ENV=development`.
   - Volume `./nest:/app:cached` + `/app/node_modules` (igual o padrão do template para hot reload).
   - `depends_on: vision-service: condition: service_healthy`.
   - Healthcheck `curl -f http://localhost:3000/health`.
3. Service `frontend`:
   - `depends_on` muda de `api` para `nest`.
   - nginx (já editado em C1) proxy `/api/*` → `http://nest:9020`.
4. Atualizar `justfile`:
   - Novo target `up`: `docker compose up -d --build`.
   - Target `vision-shell`, `nest-shell`.
5. Atualizar `DOCKER_README.md` com diagrama atualizado e portas.

---

## Ordem de execução sugerida (com paralelismo)

```
A1 ─┬─► A2
    │
B1 ─┼─► B2 ──► B3 ──► B4 ──► C1 ──► D1
    └─► B5
```

- A1 e B1 podem rodar em paralelo (são pontos de partida independentes).
- A2 pode rodar paralelamente a B2-B5 depois que A1 estiver pronto.
- C1 só depois de B3+B4 prontos (precisa dos endpoints reais).
- D1 fecha tudo.

## Arquivos-chave (atalhos)

- Pipeline atual reaproveitado: [backend/app/domain/pipeline.py](backend/app/domain/pipeline.py), [backend/app/domain/face.py](backend/app/domain/face.py), [face_metrics.py](face_metrics.py)
- Endpoints atuais a remover/migrar: [backend/app/api/endpoints/analysis.py](backend/app/api/endpoints/analysis.py), [backend/app/api/endpoints/compare.py](backend/app/api/endpoints/compare.py), [backend/app/api/router.py](backend/app/api/router.py)
- Frontend: [frontend/src/api.ts](frontend/src/api.ts), [frontend/src/pages/CapturePage.tsx](frontend/src/pages/CapturePage.tsx), [frontend/src/types.ts](frontend/src/types.ts)
- Infra: [docker-compose.yml](docker-compose.yml), [nginx.conf](nginx.conf), [justfile](justfile)

## Verificação

1. `docker compose up --build` sobe `vision-service`, `nest`, `frontend`, `minio`.
2. `curl -F photo=@bkp/01/antes.png http://localhost:9020/api/photo-quality/analyze` → JSON com `qualityGrade`.
3. `curl -F photo=@bkp/01/antes.png http://localhost:9020/api/analysis/free` → JSON com `photo_quality` + métricas atuais (mesmas chaves do MVP).
4. Frontend (http://localhost:9016): fluxo Free, Premium e Compare continuam funcionais; PhotoQualityCard aparece após selecionar foto.
5. Foto borrada (intencional) → grade BAIXA/REJEITADA, botão de análise bloqueado quando REJEITADA.
6. Vision-service não responde mais em `/api/analyze/*` (404). Apenas `/vision/*`.

## Escopo deliberadamente fora

- Nenhum pacote de visão novo (RetinaFace, MediaPipe). Detecção de barba/óculos/smile fica como `false` placeholder.
- Sem persistência relacional (sem TypeORM/Prisma) — `In-Memory` only.
- Sem MediaPipe WASM no client — `processingMode` é sempre `SERVER_FALLBACK`.
- Sem `ConsistencyScore` cross-session (só fingerprint individual; comparação histórica fica para próxima fase).
- Sem autenticação/multi-tenant.
