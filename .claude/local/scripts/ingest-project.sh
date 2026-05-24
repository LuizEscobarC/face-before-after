#!/usr/bin/env bash
# Gerado por rag-project-setup — ingestão multi-serviço no ai-first
# Uso: bash .claude/local/scripts/ingest-project.sh [slug|all]
set -euo pipefail

AI_FIRST_DIR="${AI_FIRST_DIR:-$HOME/ai-first}"
TARGET="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

ingest() {
  local slug="$1"
  local path="$2"
  echo "→ Ingestando $slug ($path)"
  (
    cd "$AI_FIRST_DIR"
    if [ -f .env ]; then
      while IFS='=' read -r k v; do
        [[ "$k" =~ ^(NEO4J_|OPENAI_|EMBEDDING_|AI_INTERNAL_) ]] && export "$k=$v"
      done < <(grep -E '^[A-Z_]+=' .env)
    fi
    if [ -f "dist/scripts/ingest-md.js" ]; then
      INGEST_PROJECT="$slug" INGEST_PATH="$path" \
        node "dist/scripts/ingest-md.js" "$path"
    else
      INGEST_PROJECT="$slug" INGEST_PATH="$path" \
        npx tsx "scripts/ingest-md.ts" "$path"
    fi
  )
}

FILTER="${1:-all}"

# ── Slugs configurados ──────────────────────────────────────────────────
# [SLUG_MAP] — editável manualmente
declare -A SLUG_MAP=(
  ["face-before-after"]="."
  ["face-before-after-frontend"]="frontend"
  ["face-before-after-backend"]="backend"
  ["face-before-after-nest"]="nest"
)
# [/SLUG_MAP]

if [ "${#SLUG_MAP[@]}" -eq 0 ]; then
  echo "⚠ SLUG_MAP vazio — edite .claude/local/scripts/ingest-project.sh"
  exit 1
fi

for slug in "${!SLUG_MAP[@]}"; do
  path="${SLUG_MAP[$slug]}"
  if [[ "$FILTER" == "all" || "$FILTER" == "$slug" ]]; then
    ingest "$slug" "$TARGET/$path"
  fi
done

echo "✅ Ingestão concluída"
