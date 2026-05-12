/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PR-53c — Diagnostic Template backfill (programmatic).
 *
 * Closes two gaps in v1.0 template coverage observed in production:
 *   1. Severity 'extreme' had ZERO templates (only mild/moderate/strong existed).
 *      Result: any analysis_report with extreme findings fell into the English
 *      `metric_id.replace(/_/g,' ')` fallback in NarrativeService.
 *   2. 37 of 93 active metrics had no templates at all.
 *
 * This migration generates templates using each metric's canonical PT-BR label
 * (`metric_definition.display_name->>'pt-BR'`). The text is intentionally
 * conservative and reuses existing v1.0 phrasing patterns — Opus refinement
 * pass (PR-54 tone review) can later UPDATE individual rows without schema
 * changes.
 *
 * Placeholders used: only `{value}` and `{deviation_pct}` — both already
 * available in the NarrativeService context. No `{ideal}` here because the
 * uncovered metrics (proxies, indexes, classifications) don't always have a
 * literature ideal to cite.
 *
 * Idempotent: `ON CONFLICT DO NOTHING` on the natural unique key
 * (version, metric_id, severity, direction, size).
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

type Sev = 'mild' | 'moderate' | 'strong' | 'extreme';
const SIZES = ['short', 'medium', 'long'] as const;

const SEVERITY_PT: Record<Sev, string> = {
  mild: 'leve',
  moderate: 'moderada',
  strong: 'considerável',
  extreme: 'extrema',
};

/**
 * Generates the three sized templates (short/medium/long) for a (metric, severity) pair.
 * The PT-BR label is the canonical display_name from metric_definition.
 */
function makeTemplates(label: string, sev: Sev): Record<typeof SIZES[number], { text: string; placeholders: string[] }> {
  const sevLabel = SEVERITY_PT[sev];
  const shortLabel = label.length > 40 ? label.split('(')[0].trim() : label;

  return {
    short: {
      text: `${shortLabel} — magnitude ${sevLabel}.`,
      placeholders: [],
    },
    medium: {
      text: `${label} apresenta divergência de {deviation_pct}% em relação à referência, em magnitude ${sevLabel}.`,
      placeholders: ['deviation_pct'],
    },
    long:
      sev === 'extreme'
        ? {
            text: `${label} apresenta divergência de {deviation_pct}% em relação à referência clínica, em magnitude ${sevLabel}. Por estar fora da faixa esperada, recomenda-se avaliação profissional (médico ou especialista) para análise individualizada antes de qualquer intervenção.`,
            placeholders: ['deviation_pct'],
          }
        : sev === 'strong'
          ? {
              text: `${label} apresenta divergência de {deviation_pct}% em relação à referência, em magnitude ${sevLabel}. Variações desta intensidade podem ser exploradas com profissional habilitado para entender contexto anatômico e opções não-invasivas.`,
              placeholders: ['deviation_pct'],
            }
          : sev === 'moderate'
            ? {
                text: `${label} apresenta divergência de {deviation_pct}% em relação à referência, em magnitude ${sevLabel}. Pequenos ajustes de postura, iluminação ou ângulo da foto frequentemente atenuam a percepção desta variação.`,
                placeholders: ['deviation_pct'],
              }
            : {
                text: `${label} apresenta divergência de {deviation_pct}% em relação à referência, em magnitude ${sevLabel}. Trata-se de variação dentro do espectro habitual da população.`,
                placeholders: ['deviation_pct'],
              },
  };
}

export class M53cTemplateBackfill1746000440000 implements MigrationInterface {
  name = 'M53cTemplateBackfill1746000440000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: list every active metric with its PT-BR label.
    const rows: Array<{ metric_id: string; pt_label: string }> = await queryRunner.query(`
      SELECT md.metric_id,
             COALESCE(md.display_name->>'pt-BR',
                      md.display_name->>'pt',
                      md.metric_id) AS pt_label
      FROM metric_definition md
      ORDER BY md.metric_id
    `);

    const severities: Sev[] = ['mild', 'moderate', 'strong', 'extreme'];
    const inserts: Array<[string, string, Sev, string, string, string, string]> = [];

    for (const row of rows) {
      const label = row.pt_label;
      for (const sev of severities) {
        const tpls = makeTemplates(label, sev);
        for (const size of SIZES) {
          const tpl = tpls[size];
          inserts.push([
            'v1.0',
            row.metric_id,
            sev,
            'any',
            size,
            tpl.text,
            JSON.stringify(tpl.placeholders),
          ]);
        }
      }
    }

    // Bulk insert in chunks (one INSERT per row keeps the query simple and
    // lets ON CONFLICT skip rows that already exist from PR-53/PR-53a).
    for (const params of inserts) {
      await queryRunner.query(
        `INSERT INTO diagnostic_template
           (version, metric_id, severity, direction, size, template_pt, placeholders_used)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         ON CONFLICT ON CONSTRAINT uq_diagnostic_template_lookup DO NOTHING`,
        params,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Forward-only: removing the backfill would re-open the fallback gap.
    // If a clean rollback is needed, drop by created_at >= migration timestamp
    // via a manual SQL — not automated here to avoid losing edited rows.
  }
}
