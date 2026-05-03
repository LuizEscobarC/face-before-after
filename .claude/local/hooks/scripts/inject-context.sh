#!/usr/bin/env bash
# UserPromptSubmit hook — inject session context, napkin learnings, and workflow protocol.
python3 << 'PYEOF'
import json
import os
import sys

# Log stdin for debugging
stdin_raw = sys.stdin.read()
os.makedirs(".claude/local/logs", exist_ok=True)
with open(".claude/local/logs/hook-stdin-latest.json", "w") as f:
    f.write(stdin_raw)
try:
    stdin_data = json.loads(stdin_raw) if stdin_raw.strip() else {}
except Exception:
    stdin_data = {}

NAPKIN = ".claude/local/napkin.md"
SESSION = ".claude/local/window-context/current.md"
PROTOCOL = ".claude/local/protocols/workflow-protocol.md"

parts = []

# Session context from previous session
if os.path.exists(SESSION):
    content = open(SESSION).read().strip()
    if content:
        parts.append(f"## Session Context (previous session — apply silently)\n\n{content}")

# Napkin learnings — only if real content exists beyond headers/comments
if os.path.exists(NAPKIN):
    raw = open(NAPKIN).read()
    real_lines = [
        l for l in raw.split('\n')
        if l.strip()
        and not l.startswith('#')
        and not l.startswith('---')
        and not l.startswith('>')
        and not l.startswith('<!--')
        and not l.startswith('-->')
    ]
    if ''.join(real_lines).strip():
        parts.append(f"## Napkin — Learned Patterns (read-only, apply silently)\n\n{raw.strip()}")

# Workflow protocol — always inject if exists
if os.path.exists(PROTOCOL):
    content = open(PROTOCOL).read().strip()
    if content:
        parts.append(content)

if not parts:
    sys.exit(0)

full_context = "\n\n---\n\n".join(parts)

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": full_context
    }
}))
PYEOF
