---
tenant_id: "face-before-after"
project: "face-before-after"
module: "_meta"
file_path: ".claude/local/context/_meta/harvest-policy.md"
doc_type: "policy"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Regra obrigatória para qualquer skill de harvest/context (context-harvester,
  semantic-mapper, instance-sampler, golden-queries-enricher, query-context-documenter,
  context-injector, notebooklm-context-generator).
tags: ["policy", "harvest", "context"]
---

# Harvest Policy — face-before-after

**Regra:** todos os scripts e arquivos `.md` gerados por skills de harvest/context
DEVEM ser exclusivos deste projeto. Nada de output genérico ou de outros projetos.

## Stack alvo (única fonte)
- **DB:** PostgreSQL 16 (container `face-postgres`, db `face_analysis`,
  user `faceanalysis`, host `localhost:9019` ou `face-postgres:5432` dentro da rede `face-analysis`).
- **Object storage:** MinIO (`face-minio`, bucket `face-analysis`).
- **Backend:** Python (FastAPI) em `backend/`. SQLAlchemy/asyncpg — sem Eloquent, sem Tinker, sem Artisan.
- **Frontend:** React + Vite em `frontend/`.

## Onde gravar
- Output canônico: `.claude/local/context/<subsistema>/` (subsistemas existentes:
  `backend/`, `database/`, `frontend/`, `infra/`, `nest/`, `root-pipeline/`, `_meta/`).
- Scripts utilitários de harvest: `.claude/local/scripts/<subsistema>/`.
- **Nunca** gravar fora deste repo. **Nunca** misturar com outputs de neo-backend, lume, chamados, ai-first, etc.

## Comandos a usar (Postgres, não MySQL/Tinker)
```bash
# query ad-hoc
docker exec face-postgres psql -U faceanalysis -d face_analysis -c "SELECT ..."

# sample de tabela
docker exec face-postgres psql -U faceanalysis -d face_analysis \
  -c "SELECT * FROM <table> ORDER BY random() LIMIT 10"

# listar schema
docker exec face-postgres psql -U faceanalysis -d face_analysis -c "\dt"
```

## Proibido
- Rodar harvest contra qualquer DB que não seja `face_analysis` no container `face-postgres`.
- Gerar artefatos de Laravel (`app/Modules/...`, `app/Enums/...`, connections `mysql_dados`, etc.).
- Usar `php artisan tinker`, `composer`, ou comandos MySQL — este projeto é Python+Postgres.
- Copiar templates de outros projetos sem traduzir para o stack daqui.
