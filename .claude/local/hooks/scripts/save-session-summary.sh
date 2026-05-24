#!/usr/bin/env bash
# Stop hook — generates compact session summary and updates window-context/current.md
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
log_dir  = cwd_path / '.claude/local/hooks/logs'
log_dir.mkdir(parents=True, exist_ok=True)
log_file = log_dir / 'stop-hook.log'

def log(msg):
    ts = datetime.now().isoformat()
    with open(log_file, 'a') as f:
        f.write(f'[{ts}] {msg}\n')

log('Stop hook started')

if not transcript_path or not os.path.exists(transcript_path):
    print('{}'); sys.exit(0)

try:
    with open(transcript_path, 'r') as f:
        lines = f.readlines()
except Exception as e:
    log(f'Read error: {e}'); print('{}'); sys.exit(0)

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
                parts.append('[tool:' + p.get('name', '?') + ']')
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

if not messages:
    print('{}'); sys.exit(0)

user_msgs   = [(r, t) for r, t in messages if r == 'user']
assist_msgs = [(r, t) for r, t in messages if r == 'assistant']

last_user_snip = (user_msgs[-1][1] if user_msgs else '').replace('\n', ' ')[:400]
recent_text    = ' '.join(t.lower() for _, t in messages[-20:])

phase_label = 'Discovery'
if any(kw in recent_text for kw in ['implement','create','write','add ','fix','refactor']):
    phase_label = 'Execution'
elif any(kw in recent_text for kw in ['plan','approach','should we','strategy','how to']):
    phase_label = 'Planning'

decisions = []
for _, text in assist_msgs[-30:]:
    if len(text) < 40: continue
    snip = text.replace('\n', ' ')[:200]
    if snip not in decisions:
        decisions.append(snip)
decisions = decisions[-7:]

now = datetime.now().isoformat()

section_lines = [
    f'## Session Summary -- {phase_label} Phase',
    f'**Saved:** {now[:19].replace("T", " ")}  |  Session: {session_id}',
    '',
    '### Last User Request',
    ('> ' + last_user_snip) if last_user_snip else '> (none)',
    '',
    '### Key Decisions & Actions',
]
for d in (decisions or ['(none recorded)']):
    section_lines.append('- ' + d)
section_lines += [
    '',
    '### Chain-of-Session',
    '```',
    'Discovery  -- read code, generate summary',
    'Planning   -- read summary, create task plan',
    'Execution  -- read plan, build',
    '```',
    f'**Current phase:** [{phase_label}] {phase_label}',
    '',
    '### Recent Messages (last 8)',
]
for role, text in messages[-8:]:
    snip  = text.replace('\n', ' ')[:250]
    label = 'USER' if role == 'user' else 'ASSISTANT'
    section_lines.append(f'- **{label}:** {snip}')

new_section = '\n'.join(section_lines)
output_file = cwd_path / '.claude/local/window-context/current.md'
output_file.parent.mkdir(parents=True, exist_ok=True)
existing = output_file.read_text() if output_file.exists() else ''

MAX_STOP_SESSIONS = 10
blocks = re.split(r'\n---\n', existing)
kept = []
stop_session_count = 0
for block in blocks:
    b = block.strip()
    if not b: continue
    if ('Session: ' + session_id) in b and '| Stop hook |' in b: continue
    is_stop_block = '## Session Summary' in b and '| Stop hook |' in b
    if is_stop_block:
        stop_session_count += 1
        if stop_session_count >= MAX_STOP_SESSIONS: continue
    kept.append(b)

header_comment = f'<!-- Session: {session_id} | Stop hook | {now} -->'
parts = [header_comment + '\n\n' + new_section]
parts.extend(kept)
output_file.write_text('\n\n---\n\n'.join(parts))
log(f'Saved -- phase={phase_label}')
print('{}')
PYEOF
