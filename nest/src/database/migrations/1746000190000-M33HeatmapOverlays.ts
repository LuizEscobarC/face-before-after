import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M3.3 — Heatmap overlay catalog seed (PR-39).
 *
 * Adds two new entries to ``overlay_definition`` (already created by
 * 1746000160000-M3OverlayCatalog) corresponding to the heatmap renderers
 * implemented in PR-37 + PR-38:
 *
 *   * ``heatmap_asymmetry``       (z=30, default_visible=FALSE, alpha=0.55)
 *   * ``heatmap_ideal_adherence`` (z=30, default_visible=FALSE, alpha=0.55)
 *
 * Both use ``category='heatmap'`` and ``rendered_asset_type_enum`` values
 * that the M3OverlayCatalog migration already declared (heatmap_asymmetry,
 * heatmap_ideal_adherence) — so no enum DDL is needed.
 *
 * Metric dependencies (PLAN_M3_OVERLAYS §1.1 cascade):
 *
 *   heatmap_asymmetry — CRITICAL on:
 *     - midline_deviation         (drives sample magnitudes)
 *     - global_asymmetry_index    (gate scalar, used for legend annotation)
 *
 *   heatmap_ideal_adherence — NON-CRITICAL on every region's representative
 *   metric. Per-region degraded rendering is performed by the renderer
 *   (regions with confidence_final < 0.4 are silently dropped — L3); the
 *   overlay only fully suppresses if NO region clears the gate (handled
 *   by HeatmapSuppressedError on the Python side).
 *
 * Refs:
 *   - PLAN_M3_OVERLAYS.md §1.1 (cascade), §2 (PR-39 row), §3 (DEC-21..26)
 *   - backend/app/vision/services/heatmap_renderer.py (PR-37+38 commit 8d5e4e2)
 *   - https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.griddata.html
 */
export class M33HeatmapOverlays1746000190000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ──────────────────────────────────────────────────────────────────
    // 1. overlay_definition — heatmap_asymmetry
    // ──────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO overlay_definition (
        overlay_id, version, display_name, description, category,
        default_visible, z_order, legend_text, is_decorative, rendering_hints
      ) VALUES (
        'heatmap_asymmetry',
        'v1.0',
        '{"pt-BR": "Mapa de calor — assimetria", "en": "Heatmap — asymmetry"}'::jsonb,
        '{"pt-BR": "Mapa de calor diferencial sobreposto à face. Para cada par de landmarks bilaterais (mandíbula, sobrancelhas, olhos), calcula a distância entre o ponto esquerdo e o reflexo do ponto direito sobre o eixo intercantal, normalizada pela distância intercantal (Naini 2011 §2). Tons azuis indicam baixa assimetria; brancos indicam neutralidade; tons vermelhos indicam assimetria forte. Pixels fora do convex hull facial e regiões com densidade insuficiente (<3 amostras em raio 0,5×ICD) são mascarados (PLAN_M3_OVERLAYS §1.1).", "en": "Differential heatmap overlaid on the face. For each bilateral landmark pair (jaw, brows, eyes), computes the distance between the left point and the right point mirrored across the intercanthal axis, normalised by intercanthal distance (Naini 2011 §2). Blue tones indicate low asymmetry; white indicates neutral; red indicates strong asymmetry. Pixels outside the facial convex hull and regions with insufficient density (<3 samples within 0.5×ICD radius) are masked (PLAN_M3_OVERLAYS §1.1)."}'::jsonb,
        'heatmap',
        FALSE,
        30,
        '{"pt-BR": "Vermelho = assimetria; azul = simetria. Áreas em branco = sem dados densos suficientes.", "en": "Red = asymmetry; blue = symmetry. Blank areas = insufficient sample density."}'::jsonb,
        FALSE,
        '{"colormap": "coolwarm", "alpha": 0.55, "saturation_icu": 0.10, "density_radius_icu": 0.5, "min_neighbours": 3, "grid_resolution": 512}'::jsonb
      )
    `);

    // ──────────────────────────────────────────────────────────────────
    // 2. overlay_definition — heatmap_ideal_adherence
    // ──────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO overlay_definition (
        overlay_id, version, display_name, description, category,
        default_visible, z_order, legend_text, is_decorative, rendering_hints
      ) VALUES (
        'heatmap_ideal_adherence',
        'v1.0',
        '{"pt-BR": "Mapa de calor — aderência ao ideal", "en": "Heatmap — ideal adherence"}'::jsonb,
        '{"pt-BR": "Mapa de calor por região mostrando proximidade aos valores-ideais centrais de cada métrica (Powell & Humphreys 1984; Farkas 1994). Para cada região (olhos, sobrancelhas, nariz, boca, mandíbula, queixo), aderência = 1 − |desvio_normalizado|, ponderada por confidence_final. Verde = aderência alta; âmbar = intermediária; vermelho = baixa. Regiões com confidence_final<0,4 são silenciosamente omitidas (degradação L3 — PLAN_M3_OVERLAYS §1.1).", "en": "Per-region heatmap showing proximity to each metric''s central ideal value (Powell & Humphreys 1984; Farkas 1994). For each region (eyes, brows, nose, mouth, jaw, chin), adherence = 1 − |normalised_deviation|, weighted by confidence_final. Green = high adherence; amber = mid; red = low. Regions with confidence_final<0.4 are silently dropped (L3 degraded rendering — PLAN_M3_OVERLAYS §1.1)."}'::jsonb,
        'heatmap',
        FALSE,
        30,
        '{"pt-BR": "Verde = ideal; vermelho = distante do ideal. Áreas em branco = região com baixa confiança.", "en": "Green = ideal; red = far from ideal. Blank areas = low-confidence region."}'::jsonb,
        FALSE,
        '{"colormap": "adherence_sequential", "alpha": 0.55, "confidence_threshold": 0.4, "density_radius_icu": 0.5, "min_neighbours": 3, "grid_resolution": 512}'::jsonb
      )
    `);

    // ──────────────────────────────────────────────────────────────────
    // 3. overlay_metric_dependency — heatmap_asymmetry (CRITICAL)
    // ──────────────────────────────────────────────────────────────────
    for (const metricId of ['midline_deviation', 'global_asymmetry_index']) {
      await queryRunner.query(`
        INSERT INTO overlay_metric_dependency (
          overlay_id, overlay_version, metric_id, metric_definition_version,
          is_critical, notes
        ) VALUES (
          'heatmap_asymmetry', 'v1.0', '${metricId}', 'v1.0',
          TRUE,
          'Critical: drives the magnitude scalar projected onto mirror-pair samples. If confidence_final<0.4 the heatmap is suppressed (L2 — PLAN_M3_OVERLAYS §1.1).'
        )
      `);
    }

    // ──────────────────────────────────────────────────────────────────
    // 4. overlay_metric_dependency — heatmap_ideal_adherence (NON-CRITICAL)
    //    Per region, the renderer skips low-confidence inputs (L3 degraded).
    //    The overlay only fully suppresses if NO region clears the gate.
    // ──────────────────────────────────────────────────────────────────
    const adherenceMetrics: Array<{ id: string; region: string }> = [
      // eyes
      { id: 'eye_height_asymmetry', region: 'eyes' },
      // brows
      { id: 'brow_height_asymmetry', region: 'brows' },
      // mouth
      { id: 'lip_canting_angle', region: 'mouth' },
      // global symmetry (jaw + chin contour anchor)
      { id: 'global_asymmetry_index', region: 'jaw' },
      // thirds (forehead + midface + chin region projection)
      { id: 'upper_third_ratio', region: 'forehead' },
      { id: 'middle_third_ratio', region: 'midface' },
      { id: 'lower_third_ratio', region: 'chin' },
      // fifths (cheekbones + lateral regions)
      { id: 'fifth_2_ratio', region: 'cheekbones' },
      { id: 'fifth_4_ratio', region: 'cheekbones' },
    ];

    for (const m of adherenceMetrics) {
      await queryRunner.query(`
        INSERT INTO overlay_metric_dependency (
          overlay_id, overlay_version, metric_id, metric_definition_version,
          is_critical, notes
        ) VALUES (
          'heatmap_ideal_adherence', 'v1.0', '${m.id}', 'v1.0',
          FALSE,
          'Non-critical (region=${m.region}): per-region adherence; if confidence_final<0.4 this region is dropped from the heatmap but the overlay still renders for other regions (L3 degraded — PLAN_M3_OVERLAYS §1.1).'
        )
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM overlay_metric_dependency
      WHERE overlay_id IN ('heatmap_asymmetry', 'heatmap_ideal_adherence')
        AND overlay_version = 'v1.0'
    `);
    await queryRunner.query(`
      DELETE FROM overlay_definition
      WHERE overlay_id IN ('heatmap_asymmetry', 'heatmap_ideal_adherence')
        AND version = 'v1.0'
    `);
  }
}
