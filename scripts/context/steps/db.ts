import { Client } from 'pg';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HarvestCtx, frontmatter, writeOut, anonymize } from './_shared.ts';

async function withReadOnlyClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const url = process.env.PG_URL;
  if (!url) throw new Error('PG_URL not set (expected in .claude/.env.harvest)');
  const c = new Client({ connectionString: url, statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? 30000) });
  await c.connect();
  try {
    await c.query('SET TRANSACTION READ ONLY');
    return await fn(c);
  } finally {
    await c.end();
  }
}

export async function runDbStep(ctx: HarvestCtx): Promise<void> {
  const ddlPath = join(ctx.root, '.claude/local/database/ddl.sql');
  const ddlBlurb = existsSync(ddlPath)
    ? `DDL snapshot: \`${relative(ctx.root, ddlPath)}\` (${readFileSync(ddlPath, 'utf8').split('\n').length} lines).`
    : `_(no DDL snapshot found; regenerate via \`pg_dump --schema-only\`)_`;

  const parts: string[] = [];

  await withReadOnlyClient(async c => {
    const tables = await c.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );
    parts.push(`## Tables (${tables.rowCount})\n\n| Table | Rows | Columns |\n|---|---:|---|`);
    for (const t of tables.rows) {
      const name = t.table_name;
      const cnt = await c.query<{ n: string }>(`SELECT count(*)::text AS n FROM "${name}"`);
      const cols = await c.query<{ column_name: string; data_type: string }>(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [name]
      );
      const colList = cols.rows.map(r => `${r.column_name}:${r.data_type}`).join(', ');
      parts.push(`| \`${name}\` | ${cnt.rows[0]?.n ?? '?'} | ${colList} |`);
    }
    parts.push('');

    // 10-row samples
    parts.push(`## Samples (10 rows / table, anonymized)\n`);
    for (const t of tables.rows) {
      const name = t.table_name;
      try {
        const sample = await c.query(`SELECT * FROM "${name}" ORDER BY random() LIMIT 10`);
        if (!sample.rowCount) { parts.push(`### \`${name}\` — _(empty)_\n`); continue; }
        parts.push(`### \`${name}\`\n`);
        parts.push('```json');
        parts.push(JSON.stringify(sample.rows.map(anonymize), null, 2));
        parts.push('```\n');
      } catch (err) {
        parts.push(`### \`${name}\` — _error: ${(err as Error).message}_\n`);
      }
    }
  });

  const body =
    frontmatter({
      module: 'database',
      docType: 'reference',
      filePath: '.claude/local/context/ai_context_master.md',
      summary: 'Schema overview + per-table row counts + 10 anonymized samples per table (Postgres, read-only).',
      keywords: ['schema', 'postgres', 'samples', 'ddl'],
      dependsOn: ['nest/src/database/data-source.ts'],
      usedBy: ['catalog_semantic_map', 'rag-ingest'],
      tags: ['database', 'schema', 'harvest'],
    }) +
    `\n# AI Context Master — face-before-after\n\n` +
    `${ddlBlurb}\n\n` +
    parts.join('\n') + '\n';

  writeOut(ctx, 'ai_context_master.md', body);
}
