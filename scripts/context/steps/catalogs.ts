import { Client } from 'pg';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Project, SyntaxKind, Node, ObjectLiteralExpression, ArrayLiteralExpression } from 'ts-morph';
import { HarvestCtx, frontmatter, writeOut } from './_shared.ts';

const MIG_DIR = 'nest/src/database/migrations';

// migration file glob → catalog table name hint (best-effort)
const TABLE_HINTS: Record<string, string[]> = {
  metric_catalog: ['MetricCatalog', 'SeedMetricCatalog', 'RebalanceWeights'],
  jaw_family: ['SeedJawFamily'],
  nose_family: ['SeedNoseFamily'],
  mouth_family: ['SeedMouthFamily'],
  brow_family: ['SeedBrowFamily'],
  cheekbones_family: ['SeedCheekbonesFamily', 'AddCheekbonesEnumValue'],
  forehead_family: ['SeedForeheadFamily'],
  global_shape_family: ['SeedGlobalShapeFamily'],
  phi_golden_family: ['SeedPhiGoldenFamily'],
  overlay_catalog: ['M3OverlayCatalog'],
  improvement_vector: ['M32AddImprovementVector'],
  diagnostic_template: ['M41DiagnosticTemplates'],
};

interface SeedRow { source: string; literal: Record<string, unknown> }

function literalToObj(node: Node): Record<string, unknown> | unknown[] | unknown {
  if (Node.isObjectLiteralExpression(node)) {
    const obj: Record<string, unknown> = {};
    for (const p of (node as ObjectLiteralExpression).getProperties()) {
      if (Node.isPropertyAssignment(p)) {
        const name = p.getName().replace(/^['"]|['"]$/g, '');
        obj[name] = literalToObj(p.getInitializer() as Node);
      }
    }
    return obj;
  }
  if (Node.isArrayLiteralExpression(node)) {
    return (node as ArrayLiteralExpression).getElements().map(e => literalToObj(e));
  }
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralText();
  if (Node.isNumericLiteral(node)) return Number(node.getLiteralText());
  if (Node.isTrueLiteral(node)) return true;
  if (Node.isFalseLiteral(node)) return false;
  if (Node.isNullLiteral(node)) return null;
  if (Node.isPrefixUnaryExpression(node) && node.getOperatorToken() === SyntaxKind.MinusToken) {
    const op = node.getOperand();
    if (Node.isNumericLiteral(op)) return -Number(op.getLiteralText());
  }
  // fallback: textual
  return node.getText().slice(0, 120);
}

function parseSeeds(ctx: HarvestCtx): { rowsByCatalog: Map<string, SeedRow[]>; filesScanned: string[] } {
  const dir = join(ctx.root, MIG_DIR);
  if (!existsSync(dir)) return { rowsByCatalog: new Map(), filesScanned: [] };
  const candidates = readdirSync(dir).filter(f => /(Seed|Rebalance|Catalog|Template|ImprovementVector|Overlay).*\.ts$/i.test(f));
  const proj = new Project({ skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true });
  for (const f of candidates) proj.addSourceFileAtPath(join(dir, f));

  const rowsByCatalog = new Map<string, SeedRow[]>();

  for (const sf of proj.getSourceFiles()) {
    const fileName = sf.getBaseName();
    const src = sf.getFullText();

    // identify candidate catalog by hints
    const targets = Object.entries(TABLE_HINTS)
      .filter(([, hints]) => hints.some(h => fileName.includes(h)))
      .map(([t]) => t);
    if (!targets.length) continue;
    const target = targets[0];

    // collect array/object literals passed to insert/values/save and INSERT INTO ... VALUES
    sf.forEachDescendant(node => {
      if (Node.isCallExpression(node)) {
        const expr = node.getExpression().getText();
        if (/\b(values|insert|save)\b/i.test(expr)) {
          for (const arg of node.getArguments()) {
            const v = literalToObj(arg);
            if (Array.isArray(v)) {
              for (const item of v) if (item && typeof item === 'object') {
                const arr = rowsByCatalog.get(target) ?? [];
                arr.push({ source: fileName, literal: item as Record<string, unknown> });
                rowsByCatalog.set(target, arr);
              }
            } else if (v && typeof v === 'object') {
              const arr = rowsByCatalog.get(target) ?? [];
              arr.push({ source: fileName, literal: v as Record<string, unknown> });
              rowsByCatalog.set(target, arr);
            }
          }
        }
      }
    });

    // raw INSERT INTO statements in template strings
    const inserts = [...src.matchAll(/INSERT\s+INTO\s+["']?(\w+)["']?\s*\(([^)]+)\)\s*VALUES\s*([\s\S]+?);/gi)];
    for (const ins of inserts) {
      const table = ins[1];
      const tgt = Object.keys(TABLE_HINTS).find(t => t === table) ?? table;
      const cols = ins[2].split(',').map(c => c.trim().replace(/["']/g, ''));
      const valuesBlock = ins[3];
      const tuples = [...valuesBlock.matchAll(/\(([^()]+)\)/g)];
      for (const tup of tuples) {
        const vals = tup[1].split(',').map(v => v.trim().replace(/^'(.*)'$/, '$1'));
        const row: Record<string, unknown> = {};
        cols.forEach((c, i) => { row[c] = vals[i]; });
        const arr = rowsByCatalog.get(tgt) ?? [];
        arr.push({ source: fileName, literal: row });
        rowsByCatalog.set(tgt, arr);
      }
    }
  }

  return { rowsByCatalog, filesScanned: candidates };
}

async function fetchLive(table: string): Promise<Record<string, unknown>[] | { error: string }> {
  const url = process.env.PG_URL;
  if (!url) return { error: 'no PG_URL' };
  const c = new Client({ connectionString: url, statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? 30000) });
  await c.connect();
  try {
    await c.query('SET TRANSACTION READ ONLY');
    const r = await c.query(`SELECT * FROM "${table}" LIMIT 500`);
    return r.rows;
  } catch (err) {
    return { error: (err as Error).message };
  } finally {
    await c.end();
  }
}

export async function runCatalogsStep(ctx: HarvestCtx): Promise<void> {
  const { rowsByCatalog, filesScanned } = parseSeeds(ctx);

  const sections: string[] = [];
  for (const [table, rows] of rowsByCatalog) {
    sections.push(`## \`${table}\`\n`);
    sections.push(`- Seeded rows extracted (static AST): **${rows.length}**`);

    const live = ctx.dbAvailable ? await fetchLive(table) : { error: 'db not available — static only' };
    if (Array.isArray(live)) {
      sections.push(`- Live row count (sample limit 500): **${live.length}**`);

      // diff: codes present in seed vs live
      const seedCodes = new Set(rows.map(r => String((r.literal as any).code ?? (r.literal as any).key ?? '')).filter(Boolean));
      const liveCodes = new Set(live.map(r => String((r as any).code ?? (r as any).key ?? '')).filter(Boolean));
      const onlySeed = [...seedCodes].filter(c => !liveCodes.has(c));
      const onlyLive = [...liveCodes].filter(c => !seedCodes.has(c));
      if (onlySeed.length) sections.push(`- ⚠ Only in seed (not in live): ${onlySeed.slice(0, 20).map(c => `\`${c}\``).join(', ')}`);
      if (onlyLive.length) sections.push(`- ⚠ Only in live (drift from seed): ${onlyLive.slice(0, 20).map(c => `\`${c}\``).join(', ')}`);
      if (!onlySeed.length && !onlyLive.length && seedCodes.size) sections.push(`- ✅ Seed codes match live`);
    } else {
      sections.push(`- Live diff skipped: ${live.error}`);
    }

    // table of seed rows
    if (rows.length) {
      const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r.literal)))).slice(0, 8);
      sections.push(`\n| source | ${keys.join(' | ')} |`);
      sections.push(`|---|${keys.map(() => '---').join('|')}|`);
      for (const r of rows.slice(0, 50)) {
        const vals = keys.map(k => {
          const v = (r.literal as any)[k];
          if (v == null) return '';
          const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
          return s.slice(0, 60).replace(/\|/g, '\\|');
        });
        sections.push(`| ${r.source} | ${vals.join(' | ')} |`);
      }
      if (rows.length > 50) sections.push(`\n_+${rows.length - 50} more rows truncated_`);
    }
    sections.push('');
  }

  const body =
    frontmatter({
      module: 'catalogs',
      docType: 'reference',
      filePath: '.claude/local/context/catalog_semantic_map.md',
      summary: 'Semantic map of catalog tables: seeds parsed via ts-morph from Seed*.ts migrations, optionally diffed against live Postgres rows.',
      keywords: ['catalogs', 'seeds', 'metric-catalog', 'families', 'overlays', 'diagnostic-templates', 'semantic-map'],
      dependsOn: ['migrations_index', 'ai_context_master'],
      usedBy: ['rag-ingest', 'business_logic_map'],
      tags: ['catalogs', 'semantic-map', 'harvest'],
    }) +
    `\n# Catalog Semantic Map — face-before-after\n\n` +
    `Scanned **${filesScanned.length}** migration files for seed literals.\n\n` +
    `Catalogs extracted: ${rowsByCatalog.size}.\n` +
    (ctx.dbAvailable ? `Live DB diff: **enabled**.` : `Live DB diff: **disabled** (no PG_URL — static-only).`) + `\n\n` +
    sections.join('\n') + '\n';

  writeOut(ctx, 'catalog_semantic_map.md', body);
}
