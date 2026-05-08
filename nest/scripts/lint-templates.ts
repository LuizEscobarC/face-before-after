#!/usr/bin/env tsx
/**
 * PR-52 — CI lint: scan active diagnostic_template rows against active blacklist.
 *
 * Loads the currently active `template_blacklist_version` and the currently
 * active `diagnostic_template_version`, then asserts that no `template_pt`
 * (lowercased) contains any blacklist `term`.
 *
 * Exit codes:
 *   0 — clean (or no active versions, with a warning)
 *   1 — at least one violation found
 *   2 — runtime error (DB unreachable, missing schema, etc.)
 *
 * Invocation:
 *   npm run lint:templates
 *
 * CI integration:
 *   This script is intended to be wired into the same CI pipeline that runs
 *   `npm test`. It REQUIRES a live DB connection (DATABASE_URL env var) — in
 *   CI it should run against the freshly-migrated test/staging DB, not prod.
 *
 * References
 * ----------
 *   - PLAN_M4_NARRATIVE.md §1.1 (linha vermelha), §2 (PR-52 row)
 *   - PLAN_METRICS.md §0 (PR-52 row, M4.1 sub-marco)
 *   - Migration 1746000180000-M41DiagnosticTemplates.ts (DDL + seed)
 */
import { AppDataSource } from '../src/database/data-source.js';

interface TemplateRow {
  metric_id: string;
  severity: string;
  direction: string;
  size: string;
  template_pt: string;
}

interface BlacklistRow {
  term: string;
  category: string;
}

interface Violation {
  metric_id: string;
  severity: string;
  direction: string;
  size: string;
  term: string;
  category: string;
  excerpt: string;
}

const EXCERPT_RADIUS = 30;

async function main(): Promise<number> {
  await AppDataSource.initialize();
  try {
    // Active template version
    const tplVerRows = await AppDataSource.query<{ version: string }[]>(
      `SELECT version FROM diagnostic_template_version WHERE is_active = TRUE LIMIT 1`,
    );
    if (tplVerRows.length === 0) {
      console.warn(
        '[lint:templates] WARN: no active diagnostic_template_version — nothing to lint.',
      );
      return 0;
    }
    const tplVersion = tplVerRows[0].version;

    // Active blacklist version
    const blVerRows = await AppDataSource.query<{ version: string }[]>(
      `SELECT version FROM template_blacklist_version WHERE is_active = TRUE LIMIT 1`,
    );
    if (blVerRows.length === 0) {
      console.warn(
        '[lint:templates] WARN: no active template_blacklist_version — skipping lint.',
      );
      return 0;
    }
    const blVersion = blVerRows[0].version;

    // Load all templates of active version
    const templates = await AppDataSource.query<TemplateRow[]>(
      `SELECT metric_id, severity::text AS severity, direction, size, template_pt
         FROM diagnostic_template
        WHERE version = $1`,
      [tplVersion],
    );

    // Load all blacklist terms of active version
    const terms = await AppDataSource.query<BlacklistRow[]>(
      `SELECT term, category
         FROM template_blacklist_term
        WHERE version = $1`,
      [blVersion],
    );

    console.log(
      `[lint:templates] template_version=${tplVersion} (${templates.length} rows)  blacklist_version=${blVersion} (${terms.length} terms)`,
    );

    const violations: Violation[] = [];
    for (const tpl of templates) {
      const haystack = tpl.template_pt.toLowerCase();
      for (const t of terms) {
        const idx = haystack.indexOf(t.term);
        if (idx !== -1) {
          const start = Math.max(0, idx - EXCERPT_RADIUS);
          const end = Math.min(
            tpl.template_pt.length,
            idx + t.term.length + EXCERPT_RADIUS,
          );
          violations.push({
            metric_id: tpl.metric_id,
            severity: tpl.severity,
            direction: tpl.direction,
            size: tpl.size,
            term: t.term,
            category: t.category,
            excerpt: tpl.template_pt.slice(start, end),
          });
        }
      }
    }

    if (violations.length === 0) {
      console.log('[lint:templates] OK — no blacklist hits.');
      return 0;
    }

    console.error(
      `[lint:templates] FAIL — ${violations.length} blacklist hit(s):`,
    );
    for (const v of violations) {
      console.error(
        `  - [${v.metric_id} ${v.severity}/${v.direction}/${v.size}] term="${v.term}" (${v.category})`,
      );
      console.error(`      … ${v.excerpt} …`);
    }
    return 1;
  } finally {
    await AppDataSource.destroy();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[lint:templates] runtime error:', err);
    process.exit(2);
  });
