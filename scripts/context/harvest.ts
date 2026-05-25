/**
 * face-before-after context harvester (orchestrator).
 *
 * Read-only. Project-exclusive. Writes only under .claude/local/context/.
 * Triggered by skill `context-harvester` (local) or `just harvest-context`.
 */
import { config as loadEnv } from 'dotenv';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runGoldenStep } from './steps/golden.ts';
import { runDbStep } from './steps/db.ts';
import { runCatalogsStep } from './steps/catalogs.ts';

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const ROOT = resolve(HERE, '..', '..');

loadEnv({ path: join(ROOT, '.claude', '.env.harvest') });

const OUTPUT_PATH = process.env.OUTPUT_PATH
  ? resolve(process.env.OUTPUT_PATH)
  : join(ROOT, '.claude', 'local', 'context');

mkdirSync(OUTPUT_PATH, { recursive: true });

type StepId = 'golden' | 'db' | 'catalogs';
const ALL: StepId[] = ['golden', 'db', 'catalogs'];

const args = process.argv.slice(2);
let only: StepId[] | null = null;
const skip = new Set<StepId>();
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--only') only = (args[++i] ?? '').split(',').filter(Boolean) as StepId[];
  else if (a?.startsWith('--only=')) only = a.slice('--only='.length).split(',').filter(Boolean) as StepId[];
  else if (a === '--skip-db') skip.add('db').add('catalogs');
  else if (a?.startsWith('--skip=')) a.slice('--skip='.length).split(',').forEach(s => skip.add(s as StepId));
  else if (a === '--help' || a === '-h') {
    console.log(`Usage: tsx scripts/context/harvest.ts [--only step[,step]] [--skip-db]
Steps: ${ALL.join(', ')}
Output: ${OUTPUT_PATH}`);
    process.exit(0);
  }
}

const steps: StepId[] = (only ?? ALL).filter(s => !skip.has(s));

const dbAvailable = !!process.env.PG_URL;
const dbNeeded = steps.some(s => s === 'db' || s === 'catalogs');
if (dbNeeded && !dbAvailable) {
  console.warn('⚠  PG_URL not set in .claude/.env.harvest — db/catalogs steps will be skipped.');
}

const ctx = { root: ROOT, outDir: OUTPUT_PATH, dbAvailable };

const t0 = Date.now();
for (const step of steps) {
  const started = Date.now();
  try {
    switch (step) {
      case 'golden':     await runGoldenStep(ctx);     break;
      case 'db':         if (dbAvailable) await runDbStep(ctx);         else console.log(`[${step}] skipped (no PG_URL)`); break;
      case 'catalogs':   if (dbAvailable) await runCatalogsStep(ctx);   else console.log(`[${step}] skipped (no PG_URL — running static-only fallback)`) || await runCatalogsStep({ ...ctx, dbAvailable: false }); break;
    }
    console.log(`[${step}] ok (${Date.now() - started}ms)`);
  } catch (err) {
    console.error(`[${step}] FAILED:`, err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}
console.log(`Done in ${Date.now() - t0}ms. Output: ${OUTPUT_PATH}`);
