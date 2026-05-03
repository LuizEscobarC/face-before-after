#!/usr/bin/env bash
# Scans .claude/local/skills/*/SKILL.md, extracts name+description from frontmatter,
# generates a markdown table, and injects it into AGENTS.md between marker comments.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
SKILLS_DIR="$ROOT/.claude/local/skills"
AGENTS_FILE="$ROOT/AGENTS.md"

if [ ! -f "$AGENTS_FILE" ]; then
  echo "Error: $AGENTS_FILE not found" >&2
  exit 1
fi

python3 << PYEOF
import os, re
from pathlib import Path

skills_dir = Path("$SKILLS_DIR")
agents_file = Path("$AGENTS_FILE")

rows = []
for skill_md in sorted(skills_dir.glob("*/SKILL.md")):
    text = skill_md.read_text()
    # Extract frontmatter block between first two ---
    fm_match = re.match(r'^---\s*\n(.*?)\n---', text, re.DOTALL)
    if not fm_match:
        continue
    fm = fm_match.group(1)
    name_m = re.search(r'^name:[ \t]*([^\n]*)$', fm, re.MULTILINE)
    if not name_m:
        continue
    name = name_m.group(1).strip().strip('"\'')
    if not name:
        # derive name from directory when frontmatter name is empty
        name = skill_md.parent.name

    # description: single line or block scalar (|)
    desc_m = re.search(r'^description:[ \t]*([^\n]+)$', fm, re.MULTILINE)
    if desc_m:
        first_line = desc_m.group(1).strip().strip('"\'')
        if first_line == '|':
            # block scalar: take next non-empty line in frontmatter
            after = fm[desc_m.end():]
            block_m = re.search(r'^\s{2,}(.+)$', after, re.MULTILINE)
            desc = block_m.group(1).strip() if block_m else ''
        else:
            desc = first_line
    else:
        desc = ''

    if not desc:
        continue
    rows.append((name, desc))

if not rows:
    print("No skills found with valid frontmatter.")
    exit(0)

table_lines = [
    "| Skill | Descrição |",
    "|-------|-----------|",
]
for name, desc in rows:
    # Truncate long descriptions for readability
    if len(desc) > 120:
        desc = desc[:117] + "..."
    table_lines.append(f"| {name} | {desc} |")

table = "\n".join(table_lines)

content = agents_file.read_text()
start_marker = "<!-- skills-index-start -->"
end_marker = "<!-- skills-index-end -->"

if start_marker in content and end_marker in content:
    new_content = re.sub(
        re.escape(start_marker) + r'.*?' + re.escape(end_marker),
        start_marker + "\n" + table + "\n" + end_marker,
        content,
        flags=re.DOTALL
    )
else:
    new_content = content + "\n\n## Skills Disponíveis\n\n" + start_marker + "\n" + table + "\n" + end_marker + "\n"

agents_file.write_text(new_content)
print(f"Injected {len(rows)} skills into AGENTS.md")
PYEOF
