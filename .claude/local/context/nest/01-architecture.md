---
tenant_id: "face-before-after-nest"
project: "face-before-after-nest"
module: "nest/architecture"
file_path: ".claude/local/context/nest/01-architecture.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Nest bootstrap roda em FastifyAdapter (não Express), com Swagger, ValidationPipe global,
  ApiExceptionFilter, pino logger e @fastify/multipart. AppModule importa EventEmitterModule
  (wildcard), DatabaseModule (TypeORM com migrations em src/database/migrations), e 12 módulos
  funcionais. ESM puro: extensão .js obrigatória em imports relativos. Path imports configurados
  em package.json: #src/* #modules/* #shared/*.
tags:
  - "nest"
  - "architecture"
  - "fastify"
  - "typeorm"
  - "ddd"
rag_keywords:
  - "Fastify adapter NestJS"
  - "TypeORM migrations PostgreSQL"
  - "ApiExceptionFilter global"
  - "ValidationPipe class-validator"
  - "Pino HTTP logger"
  - "EventEmitterModule wildcard"
  - "Swagger DocumentBuilder"
  - "Node ESM .js extension"
related_modules:
  - "nest"
depends_on:
  - "backend"
used_by: []
---

# Nest — Arquitetura

## Bootstrap

Entry: [nest/src/main.ts](../../../../nest/src/main.ts). Cria
`NestFastifyApplication` (não Express) via `NestFactory.create(AppModule, new FastifyAdapter(...))`.

Setup global:

| Item | Onde | Comportamento |
|---|---|---|
| Logger | `pinoHttpLogger` em shared/config | Pino HTTP, formato JSON |
| Validation | `ValidationPipe` global | class-validator + transform |
| Filter | `ApiExceptionFilter` global | Normaliza erros para shape padrão |
| Multipart | `@fastify/multipart` | Upload de fotos |
| Swagger | `SwaggerModule.setup(...)` | Gera `swagger/openapi.json` no boot |
| EventEmitter | `EventEmitterModule.forRoot({wildcard: true})` | Pub/sub inter-módulos |

`process.on('unhandledRejection'/'uncaughtException')` faz exit em `development`/`local`,
loga e segue em produção.

## AppModule

[nest/src/app.module.ts](../../../../nest/src/app.module.ts) importa 12 módulos funcionais
+ `DatabaseModule` + `LoggerModule`. Sem providers próprios — apenas composição.

## Padrão de módulo (DDD)

Cada módulo segue o layout:

```
modules/<module>/
├── <module>.module.ts       # @Module — providers, imports, exports
├── <module>.controller.ts   # transport HTTP
├── <module>.service.ts      # application layer
├── domain/                  # entities, value objects, domain services
├── infrastructure/          # repositories (TypeORM), adapters externos
└── dto/                     # request/response DTOs (class-validator)
```

Não todos os módulos têm todas as camadas — só os com complexidade real (`analysis`,
`diagnosis`, `overlays`, `catalog`). Módulos leves (`health`, `identity`, `tracking`,
`decision`, `execution`) ficam só com `*.module.ts` + service.

## Database

[nest/src/database](../../../../nest/src/database) — TypeORM. Migrations em
`migrations/` numeradas por timestamp epoch (`1746000000000-Extensions.ts` etc.).
Inclui seeds de catálogos: MetricCatalogV1, JawFamily, NoseFamily, MouthFamily, BrowFamily.

## Vision client

[nest/src/modules/vision/vision.client.ts](../../../../nest/src/modules/vision/vision.client.ts)
é o HTTP client para o backend Python. Config em `vision.config.ts`. Toda chamada ao pipeline
Python passa por aqui — outros módulos NÃO chamam o backend diretamente.

## Pipeline orquestrado (fluxo típico de análise)

1. **POST /photo-quality/evaluate** — `PhotoQualityController` recebe imagem, gateia (Module 0).
2. Se passou, **vision client** envia para backend Python `/analyze`.
3. **analysis.service** recebe métricas, persiste evaluation.
4. **diagnosis.service** gera narrative + diagnostic priority.
5. **overlays.service** monta SVG overlays consolidados.
6. **decision** + **tracking** registram resultado.

## Convenções

- **ESM puro**: todo import relativo termina em `.js` (TS compila com `module: NodeNext`).
- **Path imports**: usar `#src/*`, `#modules/*`, `#shared/*` para evitar `../../..` profundo.
- **Dev local**: `npm run start:dev-local` usa `tsx watch --env-file=.env`.
- **Build**: `tsc -p tsconfig.build.json` — emite em `dist/`.
- **Node 24** (`engines.node: ">=24 <25"`).

## Configuração

YAML em [nest/src/config/yaml](../../../../nest/src/config/yaml). Carregado por
`@nestjs/config` com schema validation.

## Não-objetivos

- Não roda CV/IA — toda análise vai pro backend Python via vision client.
- Não serve frontend — frontend é build estático separado (Vite/React).
- Não armazena foto — só metadados; foto vive no MinIO via backend Python.
