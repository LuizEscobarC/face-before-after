---
tenant_id: "face-before-after"
project: "face-before-after"
module: ".claude/settings.json"
file_path: ".claude/settings.json.md"
doc_type: "concept"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  { '$schema': 'https://json.schemastore.org/claude-code-settings.json', 'autoCompact': true // 'hooks': { // 'UserPromptSubmit': // { // 'hooks': // { // 'type': 'command', // 'command': 'bash .claude/hooks/scripts/inject-context.sh', // 'timeout': 5 // } // // } // , // 'PreToolU
tags:
  - "misc"
rag_keywords:
  - "json"
  - "settings"
related_modules: []
depends_on: []
used_by: []
---
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "autoCompact": true
//   "hooks": {
//     "UserPromptSubmit": [
//       {
//         "hooks": [
//           {
//             "type": "command",
//             "command": "bash .claude/hooks/scripts/inject-context.sh",
//             "timeout": 5
//           }
//         ]
//       }
//     ],
//     "PreToolUse": [
//       {
//         "matcher": "Bash",
//         "hooks": [
//           {
//             "type": "command",
//             "command": "bash .claude/hooks/scripts/block-dangerous-bash.sh",
//             "timeout": 5
//           }
//         ]
//       }
//     ],
//     "PreCompact": [
//       {
//         "hooks": [
//           {
//             "type": "command",
//             "command": "bash .claude/hooks/scripts/save-context-before-compact.sh",
//             "timeout": 5
//           }
//         ]
//       }
//     ],
//     "Stop": [
//       {
//         "hooks": [
//           {
//             "type": "command",
//             "command": "bash .claude/hooks/scripts/save-session-summary.sh",
//             "timeout": 15
//           }
//         ]
//       }
//     ]
//   }
}
