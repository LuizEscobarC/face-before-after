import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface HarvestCtx {
  root: string;
  outDir: string;
  dbAvailable: boolean;
}

export function frontmatter(opts: {
  module: string;
  docType: string;
  filePath: string;
  summary: string;
  keywords?: string[];
  dependsOn?: string[];
  usedBy?: string[];
  tags?: string[];
}): string {
  const today = new Date().toISOString().slice(0, 10);
  const yamlList = (xs?: string[]) =>
    xs && xs.length ? xs.map(x => `  - "${x}"`).join('\n') : '  []';
  return `---
tenant_id: "face-before-after"
project: "face-before-after"
module: "${opts.module}"
file_path: "${opts.filePath}"
doc_type: "${opts.docType}"
created_at: "${today}"
updated_at: "${today}"
version: "1.0.0"
summary_context: >
  ${opts.summary.replace(/\n/g, '\n  ')}
tags:
${opts.tags && opts.tags.length ? opts.tags.map(t => `  - "${t}"`).join('\n') : '  - "harvest"'}
rag_keywords:
${yamlList(opts.keywords)}
related_modules: []
depends_on:
${yamlList(opts.dependsOn)}
used_by:
${yamlList(opts.usedBy)}
---
`;
}

export function writeOut(ctx: HarvestCtx, filename: string, body: string): string {
  const full = join(ctx.outDir, filename);
  writeFileSync(full, body);
  return full;
}

const SENSITIVE = /^(email|phone|cpf|cnpj|token|access_token|refresh_token|photo_url|user_id|password|password_hash)$/i;

export function anonymize(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v == null) { out[k] = v; continue; }
    if (SENSITIVE.test(k)) { out[k] = '***REDACTED***'; continue; }
    out[k] = v;
  }
  return out;
}
