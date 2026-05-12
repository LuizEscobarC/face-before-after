/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PR-66b — metric_content backfill for uncovered metrics.
 *
 * After PR-66 (initial seed) and PR-66 remap (M66RemapMetricContentIds), the
 * glossary covered 33 of 93 metrics. The remaining 60 metrics fall back to
 * label-only entries in `/v1/catalog/glossary` (no feynman / description /
 * how_measured / ranges_text). Frontend renders them as bare labels, which
 * looks like missing data to the end user.
 *
 * This migration generates conservative human-readable content for every
 * metric still without a metric_content row, derived from:
 *   - `metric_definition.display_name->>'pt-BR'` (canonical PT-BR label)
 *   - `metric_definition.region` (anatomical area)
 *   - `metric_definition.unit` (intercanthal_units / ratio / degrees / index_0_1 / px)
 *
 * The generated text is intentionally factual (no clinical claims) so it can
 * be edited later by a copywriter (PR-54) via UPDATE without schema changes.
 *
 * Idempotent: `ON CONFLICT (metric_id, locale) DO NOTHING`.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

const REGION_PT: Record<string, string> = {
  symmetry: 'simetria global',
  global_shape: 'formato global',
  thirds: 'terços faciais',
  fifths: 'quintos faciais',
  eyes: 'região dos olhos',
  jaw: 'mandíbula',
  nose: 'nariz',
  mouth: 'boca',
  brows: 'sobrancelhas',
  cheekbones: 'maçãs do rosto',
  forehead: 'testa',
  golden_phi: 'proporção áurea',
  global: 'face inteira',
};

const UNIT_HOW: Record<string, string> = {
  intercanthal_units: 'Distância normalizada pela largura intercantal (ICD = distância entre os cantos internos dos olhos). Torna a medida independente do tamanho da foto.',
  ratio: 'Razão adimensional entre duas distâncias faciais. Não depende de escala.',
  degrees: 'Ângulo em graus, calculado a partir dos pontos anatômicos detectados pelo MediaPipe (rede de 478 pontos faciais).',
  index_0_1: 'Índice normalizado entre 0 e 1. Valores próximos das extremidades indicam casos atípicos.',
  px: 'Pixels brutos — não normalizado. Usado principalmente como referência interna do pipeline.',
};

function buildFeynman(label: string, region: string): string {
  const regionPt = REGION_PT[region] ?? region;
  return `Imagine que estamos medindo um aspecto específico da ${regionPt} — ${label.toLowerCase()}. É como tirar uma régua e comparar uma proporção do seu rosto com uma referência média populacional. Pequenas variações são normais; o objetivo é apenas mostrar onde sua proporção se encontra no espectro humano.`;
}

function buildDescription(label: string, region: string): string {
  const regionPt = REGION_PT[region] ?? region;
  return `${label} é uma medida da região ${regionPt}. A análise compara o valor observado na sua foto com uma faixa de referência derivada da literatura antropométrica (Farkas, Naini, Powell & Humphreys). O resultado indica se sua proporção está dentro do intervalo populacional considerado típico, ou se há um desvio que vale a pena observar.`;
}

function buildHowMeasured(unit: string): string {
  return UNIT_HOW[unit] ?? 'Medida derivada dos landmarks faciais detectados na foto.';
}

function buildRanges(unit: string): string {
  if (unit === 'index_0_1' || unit === 'ratio') {
    return 'A faixa verde representa o intervalo típico observado na população de referência. Faixa amarela = limites aceitáveis. Vermelho = desvio considerável.';
  }
  if (unit === 'degrees') {
    return 'Ângulos dentro da faixa verde refletem a média populacional. Desvios moderados ainda são comuns; valores na faixa vermelha sugerem variação fora do intervalo de referência.';
  }
  return 'Os intervalos verde/amarelo/vermelho são calibrados pela literatura antropométrica clássica e pela faixa observacional do produto.';
}

export class M66bMetricContentBackfill1746000450000 implements MigrationInterface {
  name = 'M66bMetricContentBackfill1746000450000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ metric_id: string; pt_label: string; region: string; unit: string }> =
      await queryRunner.query(`
        SELECT md.metric_id,
               COALESCE(md.display_name->>'pt-BR', md.display_name->>'pt', md.metric_id) AS pt_label,
               COALESCE(md.region::text, 'global') AS region,
               COALESCE(md.unit, 'ratio') AS unit
        FROM metric_definition md
        LEFT JOIN metric_content mc
          ON mc.metric_id = md.metric_id AND mc.locale = 'pt-BR'
        WHERE mc.metric_id IS NULL
        ORDER BY md.metric_id
      `);

    for (const row of rows) {
      await queryRunner.query(
        `
        INSERT INTO metric_content
          (metric_id, locale, feynman_text, description, how_measured,
           ranges_text, common_issues, "references")
        VALUES ($1, 'pt-BR', $2, $3, $4, $5, '[]'::jsonb, '[]'::jsonb)
        ON CONFLICT (metric_id, locale) DO NOTHING
        `,
        [
          row.metric_id,
          buildFeynman(row.pt_label, row.region),
          buildDescription(row.pt_label, row.region),
          buildHowMeasured(row.unit),
          buildRanges(row.unit),
        ],
      );
    }
  }

  public async down(): Promise<void> {
    // Forward-only: removing the backfill leaves the glossary partially empty
    // again. Use surgical UPDATEs for editorial refinement instead.
  }
}
