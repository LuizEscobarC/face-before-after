#!/usr/bin/env python3
"""
Idempotent frontmatter enricher for RAG ingestion.

For every .md under PROJECT_ROOT (excluding node_modules / dist / .venv / .pytest_cache):
- If file already starts with `---\n` (existing frontmatter), skip it untouched.
- Else, prepend an Obsidian YAML frontmatter block tuned for the ai-first
  RAG pipeline. Slug routes by subprojeto path; doc_type by directory taxonomy.
"""
from __future__ import annotations
import os, re, sys, datetime
from pathlib import Path

ROOT = Path("/home/luizescobal/study/face-before-after")
TODAY = datetime.date.today().isoformat()

EXCLUDE_PARTS = {"node_modules", "dist", ".venv", ".pytest_cache", "__pycache__", ".cache", "bkp", "review", "resultado_analise", "resultado_analise_antes", "resultado_analise_depois", "resultado_api", "resultado_mvp", ".wheelhouse", "python3.10-bin"}

def slug_for(path: Path) -> str:
    rel = path.relative_to(ROOT)
    parts = rel.parts
    if parts and parts[0] == "frontend":
        return "face-before-after-frontend"
    if parts and parts[0] == "backend":
        return "face-before-after-backend"
    if parts and parts[0] == "nest":
        return "face-before-after-nest"
    return "face-before-after"

def doc_type_for(path: Path) -> str:
    rel = str(path.relative_to(ROOT))
    if "/plans/" in rel or rel.startswith(".claude/plans"):
        return "decision"
    if "/audits/" in rel:
        return "decision"
    if "/prompts/" in rel:
        return "decision"
    if "/face-analysis/" in rel:
        return "concept"
    if "/docs/calcs/" in rel:
        return "concept"
    if "/skills/" in rel:
        return "architecture"
    if "/context/" in rel:
        return "architecture"
    if rel.startswith("CLAUDE.md") or rel.startswith("AGENTS.md") or rel.startswith("DEPLOY") or rel.startswith("DOCKER"):
        return "architecture"
    if rel.startswith("EXOESQUELETO") or rel.startswith("ANIMATION_CONFIG"):
        return "concept"
    if rel.startswith("initial-plan") or rel.startswith("solucoes"):
        return "decision"
    return "concept"

def module_for(path: Path) -> str:
    rel = path.relative_to(ROOT)
    parts = list(rel.parts)
    stem = path.stem
    if len(parts) == 1:
        return f"root/{stem}"
    parent = parts[-2]
    return f"{parent}/{stem}"

def tags_for(path: Path) -> list[str]:
    rel = str(path.relative_to(ROOT))
    tags = []
    if "/face-analysis/" in rel: tags.append("face-analysis")
    if "/plans/" in rel: tags.append("planning")
    if "/audits/" in rel: tags.append("audit")
    if "/prompts/" in rel: tags.append("task-prompt")
    if "/context/" in rel: tags.append("context")
    if "/calcs/" in rel: tags.append("calculations")
    if "/skills/" in rel: tags.append("skill")
    if "/overlays" in rel.lower(): tags.append("overlays")
    if "bisenet" in rel.lower(): tags.append("bisenet")
    if "landmark" in rel.lower(): tags.append("landmark")
    if "frontend" in rel.lower(): tags.append("frontend")
    if "backend" in rel.lower() or "python" in rel.lower(): tags.append("backend")
    if "narrative" in rel.lower(): tags.append("narrative")
    if "recommend" in rel.lower(): tags.append("recommendations")
    if "metric" in rel.lower(): tags.append("metrics")
    if "ideal" in rel.lower(): tags.append("ideal-proportions")
    if "exoesqueleto" in rel.lower(): tags.append("face-rig")
    if "animation" in rel.lower(): tags.append("animation")
    if "deploy" in rel.lower() or "docker" in rel.lower(): tags.append("infra")
    if not tags: tags.append("misc")
    return tags

def extract_title_summary(body: str, fallback_name: str) -> tuple[str, str]:
    """Return (title, summary). Title = first H1 or fallback. Summary = first
    non-heading paragraph trimmed to ~280 chars."""
    title = fallback_name
    m = re.search(r"^#\s+(.+?)\s*$", body, re.MULTILINE)
    if m:
        title = m.group(1).strip()
    # First prose block
    summary = ""
    paragraphs = re.split(r"\n\s*\n", body)
    for p in paragraphs:
        p = p.strip()
        if not p: continue
        if p.startswith("#"): continue
        if p.startswith("```"): continue
        if p.startswith("|"): continue
        if p.startswith("- ") or p.startswith("* "): continue
        # Strip markdown markers
        clean = re.sub(r"[`*_\[\]()]", "", p)
        clean = re.sub(r"\s+", " ", clean)
        summary = clean[:280].strip()
        break
    if not summary:
        summary = f"{title} — documento técnico de face-before-after."
    return title, summary

def build_frontmatter(path: Path, body: str) -> str:
    slug = slug_for(path)
    rel = str(path.relative_to(ROOT))
    title, summary = extract_title_summary(body, path.stem)
    doctype = doc_type_for(path)
    module = module_for(path)
    tags = tags_for(path)
    # rag_keywords: pull jargony filename tokens + path tokens
    tokens = re.split(r"[-_/\.]+", rel.lower())
    stop = {"md", "claude", "task", "the", "and", "of", "for", "to", "from", "v1", "v2"}
    kws = sorted({t for t in tokens if len(t) >= 4 and t not in stop and not t.isdigit()})
    if "bisenet" in rel.lower(): kws += ["BiSeNet", "hair segmentation"]
    if "landmark" in rel.lower(): kws += ["dlib 68 landmarks", "MediaPipe FaceMesh"]
    if "narrative" in rel.lower(): kws += ["scorer narrative", "report narrative"]
    if "overlay" in rel.lower(): kws += ["SVG overlay", "face overlay"]
    if "ideal" in rel.lower(): kws += ["ideal proportions", "golden ratio facial"]
    kws = sorted(set(kws))[:12]

    lines = ["---"]
    lines.append(f'tenant_id: "{slug}"')
    lines.append(f'project: "{slug}"')
    lines.append(f'module: "{module}"')
    lines.append(f'file_path: "{rel}"')
    lines.append(f'doc_type: "{doctype}"')
    lines.append(f'created_at: "{TODAY}"')
    lines.append(f'updated_at: "{TODAY}"')
    lines.append('version: "1.0.0"')
    summary_escaped = summary.replace('"', "'")
    lines.append("summary_context: >")
    lines.append(f"  {summary_escaped}")
    lines.append("tags:")
    for t in tags:
        lines.append(f'  - "{t}"')
    if kws:
        lines.append("rag_keywords:")
        for k in kws:
            lines.append(f'  - "{k}"')
    lines.append("related_modules: []")
    lines.append("depends_on: []")
    lines.append("used_by: []")
    lines.append("---")
    lines.append("")
    return "\n".join(lines)

def should_skip(path: Path) -> bool:
    for part in path.parts:
        if part in EXCLUDE_PARTS:
            return True
    return False

def process_file(path: Path) -> str:
    try:
        text = path.read_text(encoding="utf-8")
    except Exception as e:
        return f"ERR {path}: {e}"
    if text.startswith("---\n"):
        return f"SKIP {path.relative_to(ROOT)} (already has frontmatter)"
    fm = build_frontmatter(path, text)
    path.write_text(fm + text, encoding="utf-8")
    return f"OK   {path.relative_to(ROOT)} [{slug_for(path)}/{doc_type_for(path)}]"

def main():
    targets = []
    for md in ROOT.rglob("*.md"):
        if should_skip(md):
            continue
        targets.append(md)
    print(f"Scanning {len(targets)} markdown files...\n")
    counts = {"OK": 0, "SKIP": 0, "ERR": 0}
    for f in sorted(targets):
        result = process_file(f)
        print(result)
        counts[result.split()[0]] += 1
    print(f"\nDone: {counts['OK']} added, {counts['SKIP']} skipped, {counts['ERR']} errors")

if __name__ == "__main__":
    main()
