---
tenant_id: "face-before-after"
project: "face-before-after"
module: "root/DOCKER_README"
file_path: "DOCKER_README.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Este projeto inclui configurações Docker otimizadas para ambientes de desenvolvimento local e produção.
tags:
  - "infra"
rag_keywords:
  - "docker"
  - "readme"
related_modules: []
depends_on: []
used_by: []
---
# Face Before After - Docker Setup

Este projeto inclui configurações Docker otimizadas para ambientes de desenvolvimento local e produção.

## Arquivos Criados

- `Dockerfile.api`: Multi-stage build para API Python/FastAPI
- `Dockerfile.frontend`: Multi-stage build para frontend React/Nginx
- `docker-compose.yml`: Configuração para desenvolvimento local
- `docker-compose.prod.yml`: Configuração para produção
- `nginx.conf`: Configuração Nginx com proxy para API
- `.dockerignore`: Otimização do contexto de build
- `requirements-api.txt`: Dependências API atualizadas

## Versões Atualizadas

- Python 3.12
- Node 20
- FastAPI >=0.112.0
- Uvicorn >=0.30.0
- React 18.3.1
- Nginx Alpine

## Portas

- API: 9015 (host) -> 8000 (container)
- Frontend: 9016 (host) -> 80 (container)

## Ambientes

### Desenvolvimento Local
- Hot reload para código fonte
- Volumes montados para desenvolvimento
- Reload automático da API
- Configurações de debug

### Produção
- Imagens otimizadas sem volumes de dev
- Restart policies robustas (`always`)
- Limites de recursos (memória)
- Healthchecks mais rigorosos
- Configurações de produção

## Como Usar (via just)

### Desenvolvimento Local
```bash
just docker-build     # Build das imagens
just docker-up        # Sobe serviços (desenvolvimento)
just docker-status    # Status dos serviços
just docker-logs      # Logs em tempo real
just docker-restart   # Reinicia serviços
just docker-down      # Para serviços
just docker-clean     # Remove tudo
just docker-open      # Abre frontend no navegador
```

### Produção
```bash
just docker-build          # Mesmo build
just docker-prod-up        # Sobe serviços (produção)
just docker-prod-status    # Status produção
just docker-prod-logs      # Logs produção
just docker-prod-restart   # Reinicia produção
just docker-prod-down      # Para produção
just docker-prod-clean     # Remove tudo produção
```

### Alias
```bash
just up              # Alias para docker-up (desenvolvimento)
```

## Acessar

- Frontend: http://localhost:9016
- API: http://localhost:9015
- API docs: http://localhost:9015/docs

## Diferenças entre Ambientes

| Recurso | Desenvolvimento | Produção |
|---------|----------------|----------|
| Volumes | Código fonte montado | Apenas dados read-only |
| Reload | Automático | Não |
| Restart | unless-stopped | always |
| Recursos | Sem limites | Limites de memória |
| Healthcheck | 3 retries | 5 retries |
| Ambiente | ENV=development | ENV=production |

## Otimizações Implementadas

- Multi-stage builds para imagens menores
- Non-root user para segurança
- Healthchecks
- .dockerignore para contexto reduzido
- Nginx proxy para comunicação frontend-API
- Volumes read-only para dados
- Restart policies apropriadas por ambiente
- Cache eficiente com venv isolado
- Limites de recursos em produção