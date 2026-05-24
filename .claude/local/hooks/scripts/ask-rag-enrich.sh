#!/usr/bin/env bash
# Hook: UserPromptSubmit (project-local)
# Enriquecedor RAG para face-before-after — monorepo com 4 slugs (raiz + 3 subprojetos).
# Detecta subprojeto pelo cwd e consulta o slug correspondente no ai-first.

set -euo pipefail

PROJECT_ROOT="/home/luizescobal/study/face-before-after"
SLUG_BASE="face-before-after"
CACHE_DIR="/tmp/ask-rag-cache"
CACHE_TTL_SEC=$((5 * 60))
TIMEOUT_SEC=30
MAX_OUTPUT_BYTES=8000
MIN_PROMPT_LEN=60
KEYWORDS_RE='(como|onde|por que|porque|qual|quais|funciona|implementa|implementação|arquitetura|fluxo|estrutura|criar|cria|endpoint|módulo|module|service|repository|controller|metric|score|landmark|ideal|recommendation|narrative|scorer|bisenet|face|frontend|backend|nest)'

mkdir -p "$CACHE_DIR"

if [ -t 0 ]; then
  echo "ask-rag-enrich.sh: hook UserPromptSubmit. Espera JSON via stdin." >&2
  exit 2
fi

TMPDIR_HOOK=$(mktemp -d)
trap 'rm -rf "$TMPDIR_HOOK"' EXIT
INPUT_FILE="$TMPDIR_HOOK/in.json"
timeout 5 cat > "$INPUT_FILE" || exit 0
[ ! -s "$INPUT_FILE" ] && exit 0

PROMPT=$(python3 -c "
import json, sys, re
d = json.load(open(sys.argv[1]))
p = d.get('prompt', '')
p = re.sub(r'<ide_opened_file>.*?</ide_opened_file>', '', p, flags=re.DOTALL)
p = re.sub(r'<system-reminder>.*?</system-reminder>', '', p, flags=re.DOTALL)
p = re.sub(r'<ide_selection>.*?</ide_selection>', '', p, flags=re.DOTALL)
print(p.strip())
" "$INPUT_FILE")
CWD=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get('cwd','$PROJECT_ROOT'))" "$INPUT_FILE")

[ "${#PROMPT}" -lt "$MIN_PROMPT_LEN" ] && exit 0
echo "$PROMPT" | grep -iqE "$KEYWORDS_RE" || exit 0

# Detecta subprojeto pelo cwd
PROJECT="$SLUG_BASE"
case "$CWD" in
  */frontend|*/frontend/*)  PROJECT="${SLUG_BASE}-frontend" ;;
  */backend|*/backend/*)    PROJECT="${SLUG_BASE}-backend" ;;
  */nest|*/nest/*)          PROJECT="${SLUG_BASE}-nest" ;;
esac

HASH=$(printf '%s|%s' "$PROJECT" "$PROMPT" | sha256sum | cut -d' ' -f1)
CACHE_FILE="$CACHE_DIR/$HASH.txt"

emit_context() {
  local file="$1"
  [ ! -s "$file" ] && exit 0
  python3 -c "
import json, sys
body = open(sys.argv[1]).read()
project = sys.argv[2]
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'UserPromptSubmit', 'additionalContext': f'## RAG context [{project}]\n\n{body}'}}))
" "$file" "$PROJECT"
}

if [ -f "$CACHE_FILE" ]; then
  AGE=$(( $(date +%s) - $(stat -c %Y "$CACHE_FILE") ))
  if [ "$AGE" -lt "$CACHE_TTL_SEC" ]; then
    emit_context "$CACHE_FILE"
    exit 0
  fi
fi

IA_FIRST_URL="${IA_FIRST_URL:-http://localhost:3099}"
TOKEN="${AI_INTERNAL_TOKEN:-test-token-123}"
PAYLOAD_FILE="$TMPDIR_HOOK/payload.json"
python3 -c "
import json, sys
json.dump({'query': sys.argv[1], 'project': sys.argv[2], 'top_k': 15, 'min_score': 0.55}, open(sys.argv[3], 'w'))
" "$PROMPT" "$PROJECT" "$PAYLOAD_FILE"

RAG_FILE="$TMPDIR_HOOK/rag.json"
LOG_FILE="$CACHE_DIR/last-error.log"
HTTP_CODE=$(curl -sS --max-time "$TIMEOUT_SEC" -X POST "$IA_FIRST_URL/api/rag" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: $TOKEN" \
  -d @"$PAYLOAD_FILE" -o "$RAG_FILE" -w '%{http_code}' 2>>"$LOG_FILE" || echo 000)

if [ "$HTTP_CODE" != "200" ] || [ ! -s "$RAG_FILE" ]; then
  printf '[%s] http=%s project=%s prompt=%.80s\n' "$(date -Iseconds)" "$HTTP_CODE" "$PROJECT" "$PROMPT" >> "$LOG_FILE"
  exit 0
fi

RESP_FILE="$TMPDIR_HOOK/resp.txt"
python3 -c "
import json, sys
try:
    rag = json.load(open(sys.argv[1]))
    chunks = rag.get('chunks', [])
    out = []
    for i, c in enumerate(chunks[:7], 1):
        s = c.get('score', 0)
        t = (c.get('text') or '').strip()
        fp = c.get('file_path') or c.get('source') or ''
        meta = f' [{fp}]' if fp else ''
        if t: out.append(f'[{i}] (score={s:.2f}){meta}\n{t[:600]}')
    if out: print('\n\n'.join(out))
except Exception:
    pass
" "$RAG_FILE" | head -c "$MAX_OUTPUT_BYTES" > "$RESP_FILE"

[ ! -s "$RESP_FILE" ] && exit 0
cp "$RESP_FILE" "$CACHE_FILE"
emit_context "$CACHE_FILE"
