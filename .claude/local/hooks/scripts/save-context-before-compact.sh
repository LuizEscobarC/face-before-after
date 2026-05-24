#!/usr/bin/env bash
# PreCompact hook — saves session context before compaction
STDIN_DATA=$(cat)
export _HOOK_STDIN="$STDIN_DATA"
python3 << 'PYEOF'
import json, os, re, sys
from pathlib import Path
from datetime import datetime

stdin_raw = os.environ.get('_HOOK_STDIN', '').strip()
if not stdin_raw:
    print('{}'); sys.exit(0)

try:
    hook_data = json.loads(stdin_raw)
except Exception:
    print('{}'); sys.exit(0)

transcript_path = hook_data.get('transcript_path', '')
session_id      = hook_data.get('session_id', '')
cwd             = hook_data.get('cwd', '')

cwd_path = Path(cwd) if cwd else Path.cwd()
log_file = cwd_path / '.claude/local/hooks/logs/precompact.log'
log_file.parent.mkdir(parents=True, exist_ok=True)

def log(msg):
    ts = datetime.now().isoformat()
    with open(log_file, 'a') as f:
        f.write(f'[{ts}] {msg}\n')

if not transcript_path or not os.path.exists(transcript_path):
    print('{}'); sys.exit(0)

try:
    lines = open(transcript_path).readlines()
except Exception:
    print('{}'); sys.exit(0)

def extract_text(entry):
    msg     = entry.get('message', {}) if isinstance(entry.get('message'), dict) else {}
    role    = msg.get('role') or entry.get('type') or 'unknown'
    content = msg.get('content', entry.get('content', ''))
    text    = ''
    if isinstance(content, str):
        text = content
    elif isinstance(content, list):
        parts = []
        for p in content:
            if not isinstance(p, dict): continue
            if p.get('type') == 'text' and p.get('text'):
                parts.append(p['text'])
            elif p.get('type') == 'tool_use':
                parts.append(f"[tool: {p.get('name','?')}]")
        text = ' '.join(parts)
    for tag in ['local-command-caveat','ide_opened_file','command-name','command-message',
                'command-args','local-command-stdout','system-reminder']:
        text = re.sub(rf'<{tag}>.*?</{tag}>', '', text, flags=re.DOTALL)
    return role, text.strip()

messages = []
for line in lines:
    try:
        entry = json.loads(line)
        role, text = extract_text(entry)
        if text:
            messages.append((role, text))
    except Exception:
        pass

now_ts = datetime.now().isoformat()
section_lines = [
    '## Auto-saved before compaction',
    f'**Timestamp:** {now_ts[:19].replace("T", " ")}  |  Session: {session_id}',
    '',
    '### Recent Messages',
]
for role, text in messages[-6:]:
    snippet = text.replace('\n', ' ')[:300]
    section_lines.append(f'- **{role.upper()}:** {snippet}')

section_lines.append('')
section_lines.append('### Last User Request')
last_user = next((t for r, t in reversed(messages) if r == 'user'), '')
snippet = last_user.replace('\n', ' ')[:500] if last_user else ''
section_lines.append(f'> {snippet}' if snippet else '> (none)')

new_section = '\n'.join(section_lines)
output_file = cwd_path / '.claude/local/window-context/current.md'
output_file.parent.mkdir(parents=True, exist_ok=True)
existing = output_file.read_text() if output_file.exists() else ''

cleaned = re.sub(
    r'(?m)^## Auto-saved before compaction.*?(?=\n^## |\Z)', '',
    existing, flags=re.DOTALL | re.MULTILINE
).strip()

if session_id:
    cleaned = re.sub(
        r'<!-- Session: ' + re.escape(session_id) + r'.*?PreCompact.*?-->\s*\n.*?(?=\n---\n|\Z)',
        '', cleaned, flags=re.DOTALL
    ).strip()

header_comment = f'<!-- Session: {session_id} | PreCompact | {now_ts} -->'
tagged_section = header_comment + '\n\n' + new_section

output_file.write_text(
    (cleaned + '\n\n---\n\n' + tagged_section) if cleaned else tagged_section
)
log(f'Saved PreCompact -- {len(messages)} msgs')
print('{}')
PYEOF
