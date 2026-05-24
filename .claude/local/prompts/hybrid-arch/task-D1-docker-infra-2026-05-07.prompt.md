---
tenant_id: "face-before-after"
project: "face-before-after"
module: "hybrid-arch/task-D1-docker-infra-2026-05-07.prompt"
file_path: ".claude/prompts/hybrid-arch/task-D1-docker-infra-2026-05-07.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  ---
tags:
  - "task-prompt"
  - "infra"
rag_keywords:
  - "arch"
  - "docker"
  - "hybrid"
  - "infra"
  - "prompt"
  - "prompts"
related_modules: []
depends_on: []
used_by: []
---
# Task D1 — Docker Compose + nginx + justfile
**Created**: 2026-05-07
**Status**: ✅ CONCLUÍDO
**Stack**: Docker Compose v3, nginx, just (justfile)

---

## 0. O que foi feito

Configuração completa da infraestrutura local: `docker-compose.yml` com 5 serviços, `nginx.conf` com proxying `/v1` → orchestrator e `/api` → vision-service, e `justfile` com receitas operacionais.

---

## 1. Serviços no `docker-compose.yml`

| Serviço | Container | Porta externa | Imagem/Build |
|---------|-----------|---------------|--------------|
| `minio` | face-minio | 9017:9000 (API), 9018:9001 (console) | minio/minio:latest |
| `minio-init` | face-minio-init | — | minio/mc (init bucket) |
| `vision-service` | face-vision-service | **9015**:8000 | `./Dockerfile.api` |
| `orchestrator` | face-orchestrator | **9020**:3000 | `./nest/Dockerfile.dev` |
| `frontend` | face-frontend | **9016**:80 | `./Dockerfile.frontend` |

### Rede
Todos na network `face-analysis` (bridge). Comunicação interna por nome de container:
- orchestrator → vision-service via `http://vision-service:8000`
- nginx (dentro do frontend) → orchestrator via `http://orchestrator:3000`

### Healthchecks
- `minio`: `curl -f http://localhost:9000/minio/health/live`
- `vision-service`: `curl -f http://localhost:8000/docs`
- `orchestrator`: `wget --spider http://localhost:3000/health`
- `frontend`: `wget --spider http://127.0.0.1/`

### Variáveis de ambiente — orchestrator
```
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
VISION_SERVICE_URL=http://vision-service:8000
VISION_SERVICE_TIMEOUT_MS=60000
```

---

## 2. `nginx.conf`

```nginx
client_max_body_size 100M;

location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;    # SPA routing
}

location /v1 {
    proxy_pass http://orchestrator:3000;
    proxy_connect_timeout 300s;
    proxy_send_timeout    300s;
    proxy_read_timeout    300s;
}

location /api {
    proxy_pass http://vision-service:8000;
    # mesmo timeouts
}
```

Rota `/v1` → NestJS orchestrator (porta interna 3000)  
Rota `/api` → FastAPI vision-service (porta interna 8000, legado/debug)

---

## 3. `justfile` — receitas adicionadas

### Stack completa
```just
stack-up    → docker compose up -d --build
stack-down  → docker compose down
stack-logs  → docker compose logs -f
stack-status → docker compose ps
```

### Orchestrator (NestJS)
```just
nest-install       → cd nest && npm install
nest-dev           → cd nest && PORT=3001 npm run start:dev-local   (sem Docker)
nest-build         → cd nest && npm run build
nest-lint          → cd nest && npm run lint
nest-docker-build  → docker compose build orchestrator
nest-restart       → docker compose restart orchestrator
nest-logs          → docker compose logs -f orchestrator
```

### Vision service
```just
vision-logs    → docker compose logs -f vision-service
vision-restart → docker compose restart vision-service
```

### Frontend
```just
frontend-deploy → cd frontend && npm run build && docker compose build frontend && docker compose up -d frontend
```

---

## 4. Portas — resumo

| Serviço | Porta |
|---------|-------|
| Frontend (nginx) | **9016** |
| Vision Service API | **9015** |
| Orchestrator | **9020** |
| MinIO API | **9017** |
| MinIO Console | **9018** |

---

## 5. Verificação

```bash
# Subir tudo
just stack-up

# Status
just stack-status
# Esperado: todos com status "Up"

# Health checks
curl http://localhost:9015/vision/health    # vision-service direto
curl http://localhost:9020/health           # orchestrator direto
curl http://localhost:9016/v1/vision/capture-guidelines  # via nginx

# Logs em tempo real
just stack-logs

# Problema de permissão no build do orchestrator?
# Garantir: chown /app ANTES de USER nestjs no Dockerfile.dev
# Certificar: npm run build (tsc) é executado no build da imagem, NÃO no CMD
```

---

## 6. Decisões de build registradas

| Problema | Solução |
|----------|---------|
| `EACCES: permission denied on /app/dist` | `chown -R nestjs:nodejs /app` antes de `USER nestjs` no Dockerfile.dev |
| `tsx watch` quebra `reflect-metadata` | Build com `tsc` no build-time; runtime com `node dist/src/main.js` |
| Orphan container `face-api` (legado) | `docker rm -f face-api` uma vez; não mais criado |
