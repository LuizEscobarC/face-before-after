#!/usr/bin/env bash
# PreToolUse(Bash) hook — block catastrophically dangerous commands
INPUT="$(cat)"
COMMAND="$(echo "$INPUT" | grep -oE '"command"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"command"\s*:\s*"\(.*\)"/\1/')"

DANGEROUS=(
  'rm[[:space:]]+-rf[[:space:]]+/[[:space:]]*$'
  'rm[[:space:]]+-rf[[:space:]]+/(home|var|etc|usr|opt)'
  'rm[[:space:]]+-rf[[:space:]]+\$HOME'
  'rm[[:space:]]+-rf[[:space:]]+~'
  '> /dev/sd[a-z]'
  'mkfs\.'
  ':(){ :|:& };:'
  'git[[:space:]]+push[[:space:]]+.*--force.*\b(main|master)\b'
  'git[[:space:]]+reset[[:space:]]+--hard[[:space:]]+origin/(main|master)'
)

for pattern in "${DANGEROUS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"🚫 Blocked dangerous pattern: $pattern"}}
EOF
    exit 0
  fi
done

# Allow by default — empty output = no interference
exit 0
