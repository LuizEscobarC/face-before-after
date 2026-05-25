import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HarvestCtx, frontmatter, writeOut } from './_shared.ts';

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue;
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.ts$/.test(e) && !/\.d\.ts$/.test(e)) out.push(p);
  }
  return out;
}

interface Hit { file: string; line: number; snippet: string; entity: string; kind: string }

const PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: 'queryBuilder', re: /createQueryBuilder\s*\(\s*['"`](\w+)['"`]/g },
  { kind: 'repository',   re: /this\.(\w+Repository|\w+Repo)\.(find\w*|count|query)\(/g },
  { kind: 'rawSql',       re: /\.query\s*\(\s*[`'"]([\s\S]{20,400}?)[`'"]/g },
];

export async function runGoldenStep(ctx: HarvestCtx): Promise<void> {
  const nestSrc = join(ctx.root, 'nest/src');
  const files = walk(nestSrc);
  const hits: Hit[] = [];

  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const lines = src.split('\n');
    for (const { kind, re } of PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const line = src.slice(0, m.index).split('\n').length;
        const ctxLine = lines[line - 1]?.trim() ?? '';
        const entity = m[1] ?? '?';
        hits.push({ file: relative(ctx.root, f), line, snippet: ctxLine.slice(0, 200), entity, kind });
      }
    }
  }

  const byEntity = new Map<string, Hit[]>();
  for (const h of hits) {
    const arr = byEntity.get(h.entity) ?? [];
    arr.push(h);
    byEntity.set(h.entity, arr);
  }

  const body =
    frontmatter({
      module: 'queries',
      docType: 'reference',
      filePath: '.claude/local/context/golden-queries.md',
      summary: `Non-trivial queries extracted from Nest services. ${hits.length} hits across ${byEntity.size} entities.`,
      keywords: ['queries', 'typeorm', 'sql', 'nest'],
      dependsOn: ['business_logic_map'],
      usedBy: ['golden-queries-enricher'],
      tags: ['queries', 'golden', 'harvest'],
    }) +
    `\n# Golden Queries (raw) — face-before-after\n\n` +
    `> Pós-processar com a skill global \`golden-queries-enricher\` para gerar versões por módulo.\n\n` +
    [...byEntity.entries()].sort((a, b) => b[1].length - a[1].length).map(([entity, list]) => {
      return `## \`${entity}\` (${list.length})\n\n` +
        list.slice(0, 30).map(h =>
          `- [${h.kind}] \`${h.file}:${h.line}\`\n  \`\`\`ts\n  ${h.snippet}\n  \`\`\``
        ).join('\n');
    }).join('\n\n') + '\n';

  writeOut(ctx, 'golden-queries.md', body);
}
