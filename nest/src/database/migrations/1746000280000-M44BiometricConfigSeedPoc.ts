/**
 * PR-D — Seed PoC de biometric_config para 3 exercícios faciais.
 *
 * Mirror estrutural de M44AnimationConfigSeed: queryRunner UPDATE por id,
 * down() anula apenas os ids tocados.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

type SeedRow = { id: string; cfg: Record<string, unknown> };

const SEED: SeedRow[] = [
  {
    id: 'exercise-masseter-isometric-clench',
    cfg: {
      schema_version: 1,
      steps: [
        { zone: 'masseter_l', verb: 'stretch', vector: { x: -0.7, y: 0.3 }, amplitude: 0.18, duration_ms: 1500, hold_ms: 4000, heat_intensity: 1 },
        { zone: 'masseter_r', verb: 'stretch', vector: { x: 0.7, y: 0.3 }, amplitude: 0.18, duration_ms: 1500, hold_ms: 4000, heat_intensity: 1 },
      ],
      cycle_ms: 5500,
      repeat: 'infinite',
      caption_pt: 'Empurre a mandíbula para fora — sinta o masseter alongar bilateralmente.',
    },
  },
  {
    id: 'exercise-orbicularis-oris-pursing',
    cfg: {
      schema_version: 1,
      steps: [
        { zone: 'orbicularis_oris', verb: 'compress', vector: { x: 0, y: 0 }, amplitude: 0.25, duration_ms: 1200, hold_ms: 3000, heat_intensity: 1 },
        { zone: 'orbicularis_oris', verb: 'isometric_hold', amplitude: 0.05, duration_ms: 3000, delay_ms: 1200, heat_intensity: 0.6 },
      ],
      cycle_ms: 4200,
      repeat: 'infinite',
      caption_pt: 'Beicinho sustentado — comprima e segure a tensão nos lábios.',
    },
  },
  {
    id: 'exercise-mandibular-decompression',
    cfg: {
      schema_version: 1,
      steps: [
        { zone: 'mentalis', verb: 'rotate_around_pivot', pivot: 'tmj_center', angle_deg: 25, duration_ms: 1500, hold_ms: 3000, heat_intensity: 0.8 },
        { zone: 'masseter_l', verb: 'rotate_around_pivot', pivot: 'tmj_l', angle_deg: 25, duration_ms: 1500, hold_ms: 3000, heat_intensity: 1 },
        { zone: 'masseter_r', verb: 'rotate_around_pivot', pivot: 'tmj_r', angle_deg: 25, duration_ms: 1500, hold_ms: 3000, heat_intensity: 1 },
      ],
      cycle_ms: 4500,
      repeat: 'infinite',
      caption_pt: 'Abra a mandíbula até 2 dedos — rotação articular controlada na ATM.',
    },
  },
];

export class M44BiometricConfigSeedPoc1746000280000 implements MigrationInterface {
  name = 'M44BiometricConfigSeedPoc1746000280000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const row of SEED) {
      await queryRunner.query(
        `UPDATE recommendation_catalog
            SET biometric_config = $1::jsonb
          WHERE id = $2 AND category = 'exercise'`,
        [JSON.stringify(row.cfg), row.id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ids = SEED.map((r) => r.id);
    await queryRunner.query(
      `UPDATE recommendation_catalog
          SET biometric_config = NULL
        WHERE id = ANY($1::text[])`,
      [ids],
    );
  }
}
