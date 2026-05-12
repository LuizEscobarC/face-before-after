#!/usr/bin/env bash
# PreToolUse(Bash) hook — block catastrophically dangerous commands
INPUT="$(cat)"
COMMAND="$(echo "$INPUT" | grep -oE '"command"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"command"\s*:\s*"\(.*\)"/\1/')"

DANGEROUS=(
  'migrate:fresh.*--force'
  'migrate:fresh[^-]'
  'db:wipe'
  'DROP[[:space:]]+DATABASE'
  'TRUNCATE.*production'
  'rm[[:space:]]+-rf[[:space:]]+/[[:space:]]*$'
  'rm[[:space:]]+-rf[[:space:]]+/(home|var|etc|usr|opt)'
  'rm[[:space:]]+-rf[[:space:]]+\$HOME'
  'rm[[:space:]]+-rf[[:space:]]+~'
  '> /dev/sd[a-z]'
  'mkfs\.'
  ':(){ :|:& };:'
)

for pattern in "${DANGEROUS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"🚫 Blocked dangerous pattern: $pattern"}}
EOF
    exit 0
  fi
done

# Warn on destructive table operations
if echo "$COMMAND" | grep -qE "DROP TABLE|TRUNCATE TABLE"; then
  cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"⚠️ Destructive table operation — confirm context and environment."}}
EOF
  exit 0
fi

# Allow by default — empty output = no interference
exit 0
