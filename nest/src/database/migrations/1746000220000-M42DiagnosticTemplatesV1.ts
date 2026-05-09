import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-53 — M4.2 Diagnostic Templates v1.0 (Opus content)
 *
 * Populates `diagnostic_template` v1.0 with 168 production templates covering
 * all 56 M1-active scoreable metrics × 3 severities (mild, moderate, strong)
 * × 1 size (medium) × direction='any'.
 *
 * Design choices
 * --------------
 * - **direction='any'** (catchall). NarrativeService does NOT filter by
 *   direction at lookup time (`narrative.service.ts` queries by
 *   `metricId + severity + size`). Direction differentiation is deferred to
 *   v1.1 (DEC-39 allows the column for future granularity).
 * - **size='medium'** only. The renderer (PR-51) currently consumes medium
 *   for all surfaces (frontend cards + PDF body). short/long variants will
 *   come with PR-65 (frontend redesign) when card/PDF differ visually.
 * - **placeholders** restricted to `{value}`, `{ideal}`, `{deviation_pct}` —
 *   the three universally available metrics fields. `{direction_label}` and
 *   `{region_pt}` are reserved but unused in v1.0 (allowlist sanity).
 * - **v0.1 templates are DELETED** during this migration. PR-50 explicitly
 *   marked them as schema-validation placeholders. The flip to v1.0 removes
 *   them so NarrativeService's version-agnostic lookup never returns stale
 *   examples (which had specific directions like 'right_dominant').
 *
 * Tone enforcement (PLAN_M4_NARRATIVE §1.1 — linha vermelha)
 * ----------------------------------------------------------
 * Every template must use observational language:
 *   - mild     → "observa-se uma leve [...]"
 *   - moderate → "apresenta valor [...] em magnitude moderada"
 *   - strong   → "apresenta valor [...] em magnitude considerável;
 *                 pode justificar avaliação especializada"
 *
 * Forbidden (enforced by PR-52 lint + this PR's manual review):
 *   - diagnostic verbs: "diagnostica-se", "patologia", "deficiência"
 *   - guarantee verbs: "garantimos", "vai melhorar", "corrige"
 *   - pejorative tone: "feio", "ruim", "péssimo", "anomalia"
 *
 * Bibliographic provenance
 * ------------------------
 *   - Naini, F.B. (2011) Facial Aesthetics: Concepts and Clinical Diagnosis
 *     https://link.springer.com/book/10.1007/978-1-4419-7080-7
 *   - Powell, N. & Humphreys, B. (1984) Proportions of the Aesthetic Face
 *     Thieme-Stratton Inc.
 *   - Farkas, L.G. (1994) Anthropometric Facial Proportions in Medicine
 *     PMC excerpt: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7012027/
 *   - Bashour, M. (2006) An objective system for measuring facial attractiveness
 *     Plast Reconstr Surg. https://pubmed.ncbi.nlm.nih.gov/16772906/
 *   - Sarver D.M. & Jacobson R.S. (2014) Aesthetic dentofacial analysis
 *     https://www.sciencedirect.com/science/article/pii/S0889540606010407
 *   - Edler, R.J. (2001) Background considerations to facial aesthetics
 *     https://pubmed.ncbi.nlm.nih.gov/11320067/
 *
 * Counts
 * ------
 *   - symmetry  (5 metrics) × 3 sevs = 15 templates
 *   - thirds    (3) × 3 = 9
 *   - fifths    (6) × 3 = 18
 *   - eyes      (6) × 3 = 18
 *   - brows     (6) × 3 = 18
 *   - nose      (7) × 3 = 21
 *   - mouth     (7) × 3 = 21
 *   - jaw       (6) × 3 = 18
 *   - cheekbones (5) × 3 = 15
 *   - forehead  (3) × 3 = 9
 *   - global    (2) × 3 = 6
 *   TOTAL: 168 templates
 *
 * References
 * ----------
 *   - PLAN_M4_NARRATIVE.md §2.2 (M4.2 backlog, PR-53)
 *   - PLAN_METRICS.md §0 (PR-53 row)
 *   - PR-50 (1746000180000) — schema + 5 v0.1 placeholder rows (deleted here)
 *   - PR-51 — TemplateRendererService (placeholder allowlist)
 *   - PR-52 — npm run lint:templates (blacklist scan)
 *   - PR-54 — product review pass (planned next)
 */
export class M42DiagnosticTemplatesV1_1746000220000 implements MigrationInterface {
  name = 'M42DiagnosticTemplatesV1_1746000220000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─────────────────────────────────────────────────────────────────────────
    // 0. VERSION FLIP — deactivate v0.1, activate v1.0, drop v0.1 templates
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`UPDATE diagnostic_template_version SET is_active = FALSE WHERE is_active = TRUE`);
    await queryRunner.query(`
      INSERT INTO diagnostic_template_version (version, is_active, notes)
      VALUES (
        'v1.0',
        TRUE,
        'PR-53 (Opus) — full diagnostic template catalog v1.0: 168 templates covering all 56 M1-active scoreable metrics × 3 severities × medium size. Tone: PLAN_M4_NARRATIVE §1.1 (observation only). Direction=any (catchall). Sources: Naini 2011, Powell & Humphreys 1984, Farkas 1994, Bashour 2006, Sarver & Jacobson 2014.'
      )
      ON CONFLICT (version) DO UPDATE SET is_active = TRUE
    `);
    // Drop v0.1 placeholder templates (PR-50 marked them as schema-validation only)
    await queryRunner.query(`DELETE FROM diagnostic_template WHERE version = 'v0.1'`);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. SYMMETRY — midline, global asymmetry, eye/brow asymmetry, lip canting
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO diagnostic_template (version, metric_id, severity, direction, size, template_pt, placeholders_used) VALUES
        ('v1.0', 'midline_deviation', 'mild', 'any', 'medium',
         'A linha mediana facial apresenta um leve deslocamento de {deviation_pct}% em relação ao eixo central. Padrão visual de assimetria axial sutil, dentro de variação comum.',
         '["deviation_pct"]'::jsonb),
        ('v1.0', 'midline_deviation', 'moderate', 'any', 'medium',
         'A linha mediana facial apresenta deslocamento de {deviation_pct}% em relação ao eixo central, indicando assimetria axial de magnitude moderada.',
         '["deviation_pct"]'::jsonb),
        ('v1.0', 'midline_deviation', 'strong', 'any', 'medium',
         'A linha mediana facial apresenta deslocamento de {deviation_pct}% em relação ao eixo central, em magnitude considerável. Pode justificar avaliação ortodôntica especializada para investigar componente oclusal ou postural.',
         '["deviation_pct"]'::jsonb),

        ('v1.0', 'global_asymmetry_index', 'mild', 'any', 'medium',
         'O índice global de assimetria mede {value}, indicando variação leve entre os hemifaces — padrão presente na maioria das pessoas.',
         '["value"]'::jsonb),
        ('v1.0', 'global_asymmetry_index', 'moderate', 'any', 'medium',
         'O índice global de assimetria mede {value} ({deviation_pct}% acima da referência {ideal}), indicando diferença moderada entre os hemifaces.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'global_asymmetry_index', 'strong', 'any', 'medium',
         'O índice global de assimetria mede {value} ({deviation_pct}% acima da referência {ideal}), em magnitude considerável. Pode refletir componente postural, muscular ou estrutural — avaliação fisioterapêutica especializada pode esclarecer.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'eye_height_asymmetry', 'mild', 'any', 'medium',
         'A altura entre os olhos apresenta diferença leve de {deviation_pct}% — variação visualmente discreta e bastante comum.',
         '["deviation_pct"]'::jsonb),
        ('v1.0', 'eye_height_asymmetry', 'moderate', 'any', 'medium',
         'A altura entre os olhos apresenta diferença de {deviation_pct}%, indicando assimetria de magnitude moderada perceptível em fotos frontais.',
         '["deviation_pct"]'::jsonb),
        ('v1.0', 'eye_height_asymmetry', 'strong', 'any', 'medium',
         'A altura entre os olhos apresenta diferença considerável de {deviation_pct}%. Pode envolver componente palpebral ou postural — avaliação dermatológica ou fisioterapêutica pode contribuir.',
         '["deviation_pct"]'::jsonb),

        ('v1.0', 'brow_height_asymmetry', 'mild', 'any', 'medium',
         'A altura entre as sobrancelhas apresenta diferença leve de {deviation_pct}%. Variação habitual, frequentemente equilibrada por design de sobrancelhas.',
         '["deviation_pct"]'::jsonb),
        ('v1.0', 'brow_height_asymmetry', 'moderate', 'any', 'medium',
         'A altura entre as sobrancelhas apresenta diferença de {deviation_pct}%, em magnitude moderada. Tende a ser perceptível em fotos frontais e responde bem a design de sobrancelhas.',
         '["deviation_pct"]'::jsonb),
        ('v1.0', 'brow_height_asymmetry', 'strong', 'any', 'medium',
         'A altura entre as sobrancelhas apresenta diferença considerável de {deviation_pct}%. Pode ter componente muscular do frontal — exercícios faciais direcionados ou avaliação dermatológica podem contribuir.',
         '["deviation_pct"]'::jsonb),

        ('v1.0', 'lip_canting_angle', 'mild', 'any', 'medium',
         'A linha labial apresenta inclinação leve de {value} graus em relação à horizontal — padrão presente na maioria das pessoas.',
         '["value"]'::jsonb),
        ('v1.0', 'lip_canting_angle', 'moderate', 'any', 'medium',
         'A linha labial apresenta inclinação de {value} graus em relação à horizontal, indicando canting de magnitude moderada.',
         '["value"]'::jsonb),
        ('v1.0', 'lip_canting_angle', 'strong', 'any', 'medium',
         'A linha labial apresenta inclinação considerável de {value} graus em relação à horizontal. Pode envolver componente oclusal ou postural — avaliação ortodôntica especializada pode esclarecer a origem.',
         '["value"]'::jsonb)
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. THIRDS — upper, middle, lower (proporção vertical)
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO diagnostic_template (version, metric_id, severity, direction, size, template_pt, placeholders_used) VALUES
        ('v1.0', 'upper_third_ratio', 'mild', 'any', 'medium',
         'O terço superior da face mede {value} ({deviation_pct}% de divergência do valor de referência {ideal}). Variação leve dentro do espectro habitual.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'upper_third_ratio', 'moderate', 'any', 'medium',
         'O terço superior da face mede {value}, com {deviation_pct}% de divergência da referência {ideal}, indicando proporção moderadamente fora do padrão clássico de Powell & Humphreys 1984.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'upper_third_ratio', 'strong', 'any', 'medium',
         'O terço superior da face mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos de styling como corte de cabelo e franja podem equilibrar visualmente; avaliação ortodôntica investiga componente esquelético.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'middle_third_ratio', 'mild', 'any', 'medium',
         'O terço médio da face mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve, comum no espectro populacional.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'middle_third_ratio', 'moderate', 'any', 'medium',
         'O terço médio da face mede {value}, indicando {deviation_pct}% de divergência da referência {ideal}. Proporção moderadamente fora do padrão canônico.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'middle_third_ratio', 'strong', 'any', 'medium',
         'O terço médio da face mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Pode justificar avaliação ortodôntica para análise cefalométrica.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'lower_third_ratio', 'mild', 'any', 'medium',
         'O terço inferior da face mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do habitual.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'lower_third_ratio', 'moderate', 'any', 'medium',
         'O terço inferior da face mede {value}, indicando {deviation_pct}% de divergência da referência {ideal}. Proporção moderadamente fora do padrão clássico.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'lower_third_ratio', 'strong', 'any', 'medium',
         'O terço inferior da face mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação ortodôntica e/ou cirurgia ortognática podem ser cogitadas conforme orientação especializada.',
         '["value","ideal","deviation_pct"]'::jsonb)
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. FIFTHS — divisão vertical em 5 (Naini 2011 §6)
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO diagnostic_template (version, metric_id, severity, direction, size, template_pt, placeholders_used) VALUES
        ('v1.0', 'fifth_1_ratio', 'mild', 'any', 'medium',
         'O primeiro quinto facial (têmpora esquerda) mede {value}, com {deviation_pct}% de divergência da referência {ideal}. Variação leve, comum.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'fifth_1_ratio', 'moderate', 'any', 'medium',
         'O primeiro quinto facial (têmpora esquerda) mede {value} ({deviation_pct}% de divergência da referência {ideal}), indicando proporção moderadamente fora do padrão.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'fifth_1_ratio', 'strong', 'any', 'medium',
         'O primeiro quinto facial (têmpora esquerda) mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos de styling como volume capilar lateral podem equilibrar visualmente.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'fifth_2_ratio', 'mild', 'any', 'medium',
         'O segundo quinto facial (olho esquerdo) mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'fifth_2_ratio', 'moderate', 'any', 'medium',
         'O segundo quinto facial (olho esquerdo) mede {value}, indicando {deviation_pct}% de divergência da referência {ideal}, em magnitude moderada.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'fifth_2_ratio', 'strong', 'any', 'medium',
         'O segundo quinto facial (olho esquerdo) mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Maquiagem direcionada à região ocular pode equilibrar visualmente as proporções.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'fifth_3_ratio', 'mild', 'any', 'medium',
         'O terço central (intercanthal) mede {value}, com {deviation_pct}% de divergência da referência {ideal} de Powell & Humphreys 1984. Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'fifth_3_ratio', 'moderate', 'any', 'medium',
         'O terço central (intercanthal) mede {value} ({deviation_pct}% de divergência da referência {ideal}), indicando proporção moderadamente fora do padrão clássico.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'fifth_3_ratio', 'strong', 'any', 'medium',
         'O terço central (intercanthal) mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Maquiagem com técnica de contouring nasal pode ajustar opticamente a percepção de espaçamento.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'fifth_4_ratio', 'mild', 'any', 'medium',
         'O quarto quinto facial (olho direito) mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'fifth_4_ratio', 'moderate', 'any', 'medium',
         'O quarto quinto facial (olho direito) mede {value}, indicando {deviation_pct}% de divergência da referência {ideal}, em magnitude moderada.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'fifth_4_ratio', 'strong', 'any', 'medium',
         'O quarto quinto facial (olho direito) mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos de maquiagem na região ocular podem equilibrar.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'fifth_5_ratio', 'mild', 'any', 'medium',
         'O quinto facial (têmpora direita) mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve, comum.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'fifth_5_ratio', 'moderate', 'any', 'medium',
         'O quinto facial (têmpora direita) mede {value}, indicando {deviation_pct}% de divergência da referência {ideal}, em magnitude moderada.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'fifth_5_ratio', 'strong', 'any', 'medium',
         'O quinto facial (têmpora direita) mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Volume capilar lateral pode equilibrar visualmente.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'intercanthal_to_eye_width_ratio', 'mild', 'any', 'medium',
         'A relação entre distância intercanthal e largura ocular mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve no padrão de quintos.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'intercanthal_to_eye_width_ratio', 'moderate', 'any', 'medium',
         'A relação entre distância intercanthal e largura ocular mede {value}, indicando {deviation_pct}% de divergência da referência {ideal} de Naini 2011.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'intercanthal_to_eye_width_ratio', 'strong', 'any', 'medium',
         'A relação entre distância intercanthal e largura ocular mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Maquiagem com técnica de contouring nasal ou design de sobrancelha pode ajustar a percepção do espaçamento.',
         '["value","ideal","deviation_pct"]'::jsonb)
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. EYES — abertura, distâncias, canthal tilt
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO diagnostic_template (version, metric_id, severity, direction, size, template_pt, placeholders_used) VALUES
        ('v1.0', 'eye_aperture_ratio_l', 'mild', 'any', 'medium',
         'A abertura ocular esquerda mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'eye_aperture_ratio_l', 'moderate', 'any', 'medium',
         'A abertura ocular esquerda mede {value}, indicando {deviation_pct}% de divergência da referência {ideal}, em magnitude moderada.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'eye_aperture_ratio_l', 'strong', 'any', 'medium',
         'A abertura ocular esquerda mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Pode envolver componente palpebral — avaliação dermatológica ou oftalmológica esclarece a origem.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'eye_aperture_ratio_r', 'mild', 'any', 'medium',
         'A abertura ocular direita mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do habitual.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'eye_aperture_ratio_r', 'moderate', 'any', 'medium',
         'A abertura ocular direita mede {value}, indicando {deviation_pct}% de divergência da referência {ideal}, em magnitude moderada.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'eye_aperture_ratio_r', 'strong', 'any', 'medium',
         'A abertura ocular direita mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Pode envolver componente palpebral — avaliação dermatológica ou oftalmológica esclarece a origem.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'intercanthal_distance', 'mild', 'any', 'medium',
         'A distância intercanthal mede {value} unidades, com {deviation_pct}% de divergência da referência {ideal} de Farkas 1994. Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'intercanthal_distance', 'moderate', 'any', 'medium',
         'A distância intercanthal mede {value} unidades, indicando {deviation_pct}% de divergência da referência {ideal}, em magnitude moderada.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'intercanthal_distance', 'strong', 'any', 'medium',
         'A distância intercanthal mede {value} unidades ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos de maquiagem como contouring nasal podem equilibrar visualmente o espaçamento percebido.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'interpupillary_distance', 'mild', 'any', 'medium',
         'A distância interpupilar mede {value} unidades ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'interpupillary_distance', 'moderate', 'any', 'medium',
         'A distância interpupilar mede {value} unidades, com {deviation_pct}% de divergência da referência {ideal}, indicando padrão moderadamente fora do canônico.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'interpupillary_distance', 'strong', 'any', 'medium',
         'A distância interpupilar mede {value} unidades ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Métrica útil para selecionar enquadramento de óculos e fotografia profissional.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'canthal_tilt_l', 'mild', 'any', 'medium',
         'O ângulo cantal esquerdo mede {value} graus, com {deviation_pct}% de divergência da referência {ideal} de Naini 2011. Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'canthal_tilt_l', 'moderate', 'any', 'medium',
         'O ângulo cantal esquerdo mede {value} graus, indicando {deviation_pct}% de divergência da referência {ideal}, em magnitude moderada.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'canthal_tilt_l', 'strong', 'any', 'medium',
         'O ângulo cantal esquerdo mede {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Maquiagem com eyeliner direcionado pode ajustar opticamente o ângulo percebido.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'canthal_tilt_r', 'mild', 'any', 'medium',
         'O ângulo cantal direito mede {value} graus, com {deviation_pct}% de divergência da referência {ideal}. Variação leve dentro do habitual.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'canthal_tilt_r', 'moderate', 'any', 'medium',
         'O ângulo cantal direito mede {value} graus, indicando {deviation_pct}% de divergência da referência {ideal}, em magnitude moderada.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'canthal_tilt_r', 'strong', 'any', 'medium',
         'O ângulo cantal direito mede {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Maquiagem com eyeliner direcionado pode ajustar opticamente o ângulo percebido.',
         '["value","ideal","deviation_pct"]'::jsonb)
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 5. BROWS — altura, arco, queda da cauda, espaçamento
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO diagnostic_template (version, metric_id, severity, direction, size, template_pt, placeholders_used) VALUES
        ('v1.0', 'brow_height_l', 'mild', 'any', 'medium',
         'A altura da sobrancelha esquerda mede {value} unidades intercanthais, com {deviation_pct}% de divergência da referência {ideal}. Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'brow_height_l', 'moderate', 'any', 'medium',
         'A altura da sobrancelha esquerda mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Design de sobrancelhas pode equilibrar visualmente.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'brow_height_l', 'strong', 'any', 'medium',
         'A altura da sobrancelha esquerda mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica para opções como toxina botulínica pode ser cogitada.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'brow_height_r', 'mild', 'any', 'medium',
         'A altura da sobrancelha direita mede {value} unidades intercanthais, com {deviation_pct}% de divergência da referência {ideal}. Variação leve dentro do habitual.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'brow_height_r', 'moderate', 'any', 'medium',
         'A altura da sobrancelha direita mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Design de sobrancelhas pode equilibrar.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'brow_height_r', 'strong', 'any', 'medium',
         'A altura da sobrancelha direita mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica pode esclarecer opções.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'brow_arch_peak_l', 'mild', 'any', 'medium',
         'A posição do pico do arco da sobrancelha esquerda mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'brow_arch_peak_l', 'moderate', 'any', 'medium',
         'A posição do pico do arco da sobrancelha esquerda mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Design de sobrancelhas pode reposicionar visualmente o arco.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'brow_arch_peak_l', 'strong', 'any', 'medium',
         'A posição do pico do arco da sobrancelha esquerda mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Design profissional de sobrancelhas é particularmente útil neste caso.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'brow_arch_peak_r', 'mild', 'any', 'medium',
         'A posição do pico do arco da sobrancelha direita mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'brow_arch_peak_r', 'moderate', 'any', 'medium',
         'A posição do pico do arco da sobrancelha direita mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Design de sobrancelhas pode reposicionar visualmente.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'brow_arch_peak_r', 'strong', 'any', 'medium',
         'A posição do pico do arco da sobrancelha direita mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Design profissional de sobrancelhas é recomendável.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'brow_tail_drop_l', 'mild', 'any', 'medium',
         'A cauda da sobrancelha esquerda apresenta queda de {value} unidades ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'brow_tail_drop_l', 'moderate', 'any', 'medium',
         'A cauda da sobrancelha esquerda apresenta queda de {value} unidades ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Exercícios de elevação do frontal podem contribuir.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'brow_tail_drop_l', 'strong', 'any', 'medium',
         'A cauda da sobrancelha esquerda apresenta queda de {value} unidades ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica para lifting não-cirúrgico (toxina botulínica) pode ser cogitada.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'interbrow_distance_ratio', 'mild', 'any', 'medium',
         'A distância entre as sobrancelhas mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do habitual.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'interbrow_distance_ratio', 'moderate', 'any', 'medium',
         'A distância entre as sobrancelhas mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Design de sobrancelhas pode ajustar a percepção do espaçamento.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'interbrow_distance_ratio', 'strong', 'any', 'medium',
         'A distância entre as sobrancelhas mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Design profissional de sobrancelhas pode ajustar significativamente a proporção visual.',
         '["value","ideal","deviation_pct"]'::jsonb)
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 6. NOSE — comprimento, largura, dorso, ponta, base alar
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO diagnostic_template (version, metric_id, severity, direction, size, template_pt, placeholders_used) VALUES
        ('v1.0', 'nose_length_to_icd', 'mild', 'any', 'medium',
         'O comprimento nasal mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'nose_length_to_icd', 'moderate', 'any', 'medium',
         'O comprimento nasal mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Contouring nasal pode equilibrar visualmente.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'nose_length_to_icd', 'strong', 'any', 'medium',
         'O comprimento nasal mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação com cirurgião plástico ou otorrinolaringologista pode ser cogitada conforme objetivo individual.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'nose_width_to_icd', 'mild', 'any', 'medium',
         'A largura nasal mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'nose_width_to_icd', 'moderate', 'any', 'medium',
         'A largura nasal mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Contouring nasal pode equilibrar visualmente.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'nose_width_to_icd', 'strong', 'any', 'medium',
         'A largura nasal mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação especializada (otorrinolaringologista, cirurgião plástico) pode esclarecer opções funcionais e estéticas.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'alar_to_face_width_ratio', 'mild', 'any', 'medium',
         'A relação entre largura da base alar e da face mede {value} ({deviation_pct}% de divergência da referência {ideal} de Powell & Humphreys 1984). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'alar_to_face_width_ratio', 'moderate', 'any', 'medium',
         'A relação entre largura da base alar e da face mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'alar_to_face_width_ratio', 'strong', 'any', 'medium',
         'A relação entre largura da base alar e da face mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação otorrinolaringológica esclarece componente funcional; cirurgia plástica avalia componente estético.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'nose_to_mouth_width_ratio', 'mild', 'any', 'medium',
         'A relação entre largura nasal e largura da boca mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'nose_to_mouth_width_ratio', 'moderate', 'any', 'medium',
         'A relação entre largura nasal e largura da boca mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Maquiagem labial direcionada pode equilibrar visualmente.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'nose_to_mouth_width_ratio', 'strong', 'any', 'medium',
         'A relação entre largura nasal e largura da boca mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos combinados de design labial e contouring nasal podem ajustar a proporção percebida.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'dorsum_deviation', 'mild', 'any', 'medium',
         'O dorso nasal apresenta desvio leve de {value} graus em relação ao eixo facial. Variação visualmente discreta.',
         '["value"]'::jsonb),
        ('v1.0', 'dorsum_deviation', 'moderate', 'any', 'medium',
         'O dorso nasal apresenta desvio de {value} graus em relação ao eixo facial, indicando inclinação de magnitude moderada. Contouring nasal pode equilibrar opticamente.',
         '["value"]'::jsonb),
        ('v1.0', 'dorsum_deviation', 'strong', 'any', 'medium',
         'O dorso nasal apresenta desvio considerável de {value} graus em relação ao eixo facial. Pode envolver componente funcional (desvio de septo) — avaliação otorrinolaringológica é particularmente indicada.',
         '["value"]'::jsonb),

        ('v1.0', 'nasal_tip_deviation', 'mild', 'any', 'medium',
         'A ponta nasal apresenta desvio leve de {value} unidades em relação ao eixo central. Variação discreta.',
         '["value"]'::jsonb),
        ('v1.0', 'nasal_tip_deviation', 'moderate', 'any', 'medium',
         'A ponta nasal apresenta desvio de {value} unidades em relação ao eixo central, indicando inclinação de magnitude moderada.',
         '["value"]'::jsonb),
        ('v1.0', 'nasal_tip_deviation', 'strong', 'any', 'medium',
         'A ponta nasal apresenta desvio considerável de {value} unidades em relação ao eixo central. Avaliação especializada (otorrinolaringologista, cirurgião plástico) esclarece origem estrutural e opções.',
         '["value"]'::jsonb),

        ('v1.0', 'alar_base_asymmetry', 'mild', 'any', 'medium',
         'A base alar apresenta assimetria leve de {value} unidades entre os lados. Variação dentro do espectro habitual.',
         '["value"]'::jsonb),
        ('v1.0', 'alar_base_asymmetry', 'moderate', 'any', 'medium',
         'A base alar apresenta assimetria de {value} unidades entre os lados, em magnitude moderada. Contouring nasal pode equilibrar opticamente.',
         '["value"]'::jsonb),
        ('v1.0', 'alar_base_asymmetry', 'strong', 'any', 'medium',
         'A base alar apresenta assimetria considerável de {value} unidades entre os lados. Pode envolver componente estrutural — avaliação cirúrgica plástica especializada esclarece opções.',
         '["value"]'::jsonb)
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 7. MOUTH — largura, lábios, canto, linha mediana labial
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO diagnostic_template (version, metric_id, severity, direction, size, template_pt, placeholders_used) VALUES
        ('v1.0', 'mouth_width_to_icd', 'mild', 'any', 'medium',
         'A largura da boca mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'mouth_width_to_icd', 'moderate', 'any', 'medium',
         'A largura da boca mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Design labial pode ajustar a proporção visual.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'mouth_width_to_icd', 'strong', 'any', 'medium',
         'A largura da boca mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Maquiagem com lápis labial pode ajustar opticamente a percepção.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'mouth_to_face_width_ratio', 'mild', 'any', 'medium',
         'A relação entre largura da boca e da face mede {value} ({deviation_pct}% de divergência da referência {ideal} de Naini 2011). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'mouth_to_face_width_ratio', 'moderate', 'any', 'medium',
         'A relação entre largura da boca e da face mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'mouth_to_face_width_ratio', 'strong', 'any', 'medium',
         'A relação entre largura da boca e da face mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos combinados de contouring facial e design labial podem ajustar a proporção visual.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'upper_lip_height_ratio', 'mild', 'any', 'medium',
         'A altura do lábio superior mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'upper_lip_height_ratio', 'moderate', 'any', 'medium',
         'A altura do lábio superior mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Maquiagem labial pode ajustar visualmente.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'upper_lip_height_ratio', 'strong', 'any', 'medium',
         'A altura do lábio superior mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica para opções de preenchimento pode ser cogitada.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'lower_lip_height_ratio', 'mild', 'any', 'medium',
         'A altura do lábio inferior mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'lower_lip_height_ratio', 'moderate', 'any', 'medium',
         'A altura do lábio inferior mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Maquiagem labial com gloss central pode equilibrar a proporção percebida.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'lower_lip_height_ratio', 'strong', 'any', 'medium',
         'A altura do lábio inferior mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica para preenchimento pode ser cogitada conforme objetivo individual.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'vermilion_height_total', 'mild', 'any', 'medium',
         'A altura total do vermelhão labial mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'vermilion_height_total', 'moderate', 'any', 'medium',
         'A altura total do vermelhão labial mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Design labial pode ajustar a percepção de volume.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'vermilion_height_total', 'strong', 'any', 'medium',
         'A altura total do vermelhão labial mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica para preenchimento esclarece opções.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'lip_corner_canting', 'mild', 'any', 'medium',
         'O canto labial apresenta inclinação leve de {value} graus entre os lados. Variação visualmente discreta.',
         '["value"]'::jsonb),
        ('v1.0', 'lip_corner_canting', 'moderate', 'any', 'medium',
         'O canto labial apresenta inclinação de {value} graus entre os lados, em magnitude moderada. Maquiagem labial pode equilibrar opticamente.',
         '["value"]'::jsonb),
        ('v1.0', 'lip_corner_canting', 'strong', 'any', 'medium',
         'O canto labial apresenta inclinação considerável de {value} graus entre os lados. Pode envolver componente muscular ou oclusal — avaliação dermatológica ou ortodôntica esclarece a origem.',
         '["value"]'::jsonb),

        ('v1.0', 'mouth_midline_deviation', 'mild', 'any', 'medium',
         'A linha mediana da boca apresenta desvio leve de {value} unidades em relação ao eixo facial. Variação discreta.',
         '["value"]'::jsonb),
        ('v1.0', 'mouth_midline_deviation', 'moderate', 'any', 'medium',
         'A linha mediana da boca apresenta desvio de {value} unidades em relação ao eixo facial, em magnitude moderada.',
         '["value"]'::jsonb),
        ('v1.0', 'mouth_midline_deviation', 'strong', 'any', 'medium',
         'A linha mediana da boca apresenta desvio considerável de {value} unidades em relação ao eixo facial. Pode envolver componente oclusal — avaliação ortodôntica é particularmente útil.',
         '["value"]'::jsonb)
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 8. JAW — largura, ângulos goniais, plano mandibular, queixo
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO diagnostic_template (version, metric_id, severity, direction, size, template_pt, placeholders_used) VALUES
        ('v1.0', 'jaw_width_ratio', 'mild', 'any', 'medium',
         'A largura mandibular relativa mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'jaw_width_ratio', 'moderate', 'any', 'medium',
         'A largura mandibular relativa mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Estilo de barba e contouring podem ajustar a proporção percebida.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'jaw_width_ratio', 'strong', 'any', 'medium',
         'A largura mandibular relativa mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Pode justificar avaliação ortodôntica ou cirúrgica especializada.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'gonial_angle_l', 'mild', 'any', 'medium',
         'O ângulo gonial esquerdo mede {value} graus, com {deviation_pct}% de divergência da referência {ideal}. Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'gonial_angle_l', 'moderate', 'any', 'medium',
         'O ângulo gonial esquerdo mede {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Estilo de barba pode ajustar a percepção do contorno.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'gonial_angle_l', 'strong', 'any', 'medium',
         'O ângulo gonial esquerdo mede {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação fisioterapêutica para disfunção temporomandibular pode ser indicada.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'gonial_angle_r', 'mild', 'any', 'medium',
         'O ângulo gonial direito mede {value} graus, com {deviation_pct}% de divergência da referência {ideal}. Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'gonial_angle_r', 'moderate', 'any', 'medium',
         'O ângulo gonial direito mede {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Estilo de barba pode ajustar a percepção do contorno.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'gonial_angle_r', 'strong', 'any', 'medium',
         'O ângulo gonial direito mede {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação fisioterapêutica para disfunção temporomandibular pode ser indicada.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'gonial_angle_asymmetry', 'mild', 'any', 'medium',
         'Os ângulos goniais apresentam diferença leve de {value} graus entre os lados. Variação discreta.',
         '["value"]'::jsonb),
        ('v1.0', 'gonial_angle_asymmetry', 'moderate', 'any', 'medium',
         'Os ângulos goniais apresentam diferença de {value} graus entre os lados, em magnitude moderada. Padrões de mastigação bilateral consciente podem contribuir.',
         '["value"]'::jsonb),
        ('v1.0', 'gonial_angle_asymmetry', 'strong', 'any', 'medium',
         'Os ângulos goniais apresentam diferença considerável de {value} graus entre os lados. Avaliação fisioterapêutica especializada em disfunção temporomandibular esclarece componente muscular vs estrutural.',
         '["value"]'::jsonb),

        ('v1.0', 'mandibular_plane_angle', 'mild', 'any', 'medium',
         'O plano mandibular apresenta inclinação de {value} graus, com {deviation_pct}% de divergência da referência {ideal}. Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'mandibular_plane_angle', 'moderate', 'any', 'medium',
         'O plano mandibular apresenta inclinação de {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'mandibular_plane_angle', 'strong', 'any', 'medium',
         'O plano mandibular apresenta inclinação de {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Pode justificar avaliação ortodôntica com cefalometria.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'chin_height_ratio', 'mild', 'any', 'medium',
         'A altura do queixo mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal} de Powell & Humphreys 1984). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'chin_height_ratio', 'moderate', 'any', 'medium',
         'A altura do queixo mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Estilo de barba ou contouring submentoniano pode ajustar a proporção visual.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'chin_height_ratio', 'strong', 'any', 'medium',
         'A altura do queixo mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação ortodôntica ou cirúrgica especializada esclarece opções estruturais.',
         '["value","ideal","deviation_pct"]'::jsonb)
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 9. CHEEKBONES / MIDFACE — zigomático, projeção malar, altura, hollow
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO diagnostic_template (version, metric_id, severity, direction, size, template_pt, placeholders_used) VALUES
        ('v1.0', 'zygomatic_width_ratio', 'mild', 'any', 'medium',
         'A largura zigomática mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'zygomatic_width_ratio', 'moderate', 'any', 'medium',
         'A largura zigomática mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Corte de cabelo e contouring podem equilibrar visualmente as proporções.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'zygomatic_width_ratio', 'strong', 'any', 'medium',
         'A largura zigomática mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Volume capilar lateral, contouring e estilo de barba (em homens) podem ajustar a proporção visual.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'malar_projection_index', 'mild', 'any', 'medium',
         'O índice de projeção malar mede {value} ({deviation_pct}% de divergência da referência {ideal} de Bashour 2006). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'malar_projection_index', 'moderate', 'any', 'medium',
         'O índice de projeção malar mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Iluminador e contouring nas maçãs do rosto realçam visualmente.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'malar_projection_index', 'strong', 'any', 'medium',
         'O índice de projeção malar mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica para opções de bioestimuladores ou preenchimento pode ser cogitada.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'midface_height_ratio', 'mild', 'any', 'medium',
         'A altura do mídface mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'midface_height_ratio', 'moderate', 'any', 'medium',
         'A altura do mídface mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Recursos de styling e contouring podem ajustar a percepção da proporção.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'midface_height_ratio', 'strong', 'any', 'medium',
         'A altura do mídface mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Pode justificar avaliação ortodôntica para análise cefalométrica detalhada.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'cheekbone_to_jaw_ratio', 'mild', 'any', 'medium',
         'A relação entre largura malar e mandibular mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve no formato facial.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'cheekbone_to_jaw_ratio', 'moderate', 'any', 'medium',
         'A relação entre largura malar e mandibular mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Corte de cabelo e contouring podem equilibrar o formato visual.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'cheekbone_to_jaw_ratio', 'strong', 'any', 'medium',
         'A relação entre largura malar e mandibular mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos combinados de styling capilar, barba (em homens) e contouring podem ajustar significativamente a percepção do formato.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'submalar_hollow_index', 'mild', 'any', 'medium',
         'O índice de depressão submalar mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'submalar_hollow_index', 'moderate', 'any', 'medium',
         'O índice de depressão submalar mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Exercícios de tonificação do mídface podem contribuir.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'submalar_hollow_index', 'strong', 'any', 'medium',
         'O índice de depressão submalar mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica para opções de preenchimento submalar pode ser cogitada.',
         '["value","ideal","deviation_pct"]'::jsonb)
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 10. FOREHEAD — altura, largura, têmporas
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO diagnostic_template (version, metric_id, severity, direction, size, template_pt, placeholders_used) VALUES
        ('v1.0', 'forehead_height_ratio', 'mild', 'any', 'medium',
         'A altura da testa mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'forehead_height_ratio', 'moderate', 'any', 'medium',
         'A altura da testa mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Corte de cabelo e franja podem equilibrar visualmente a proporção.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'forehead_height_ratio', 'strong', 'any', 'medium',
         'A altura da testa mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Estilo capilar com franja ou volume frontal pode ajustar significativamente a percepção da proporção.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'forehead_width_ratio', 'mild', 'any', 'medium',
         'A largura da testa mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'forehead_width_ratio', 'moderate', 'any', 'medium',
         'A largura da testa mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Volume capilar lateral pode ajustar a proporção visual.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'forehead_width_ratio', 'strong', 'any', 'medium',
         'A largura da testa mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos de styling como volume nas têmporas e contouring frontal podem equilibrar a proporção visual.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'temporal_width_ratio', 'mild', 'any', 'medium',
         'A largura temporal mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'temporal_width_ratio', 'moderate', 'any', 'medium',
         'A largura temporal mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Volume capilar lateral nas têmporas pode equilibrar visualmente.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'temporal_width_ratio', 'strong', 'any', 'medium',
         'A largura temporal mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos de styling capilar com volume controlado nas têmporas podem ajustar significativamente a proporção visual.',
         '["value","ideal","deviation_pct"]'::jsonb)
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 11. GLOBAL SHAPE — height/width, total convexity
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO diagnostic_template (version, metric_id, severity, direction, size, template_pt, placeholders_used) VALUES
        ('v1.0', 'face_height_to_width_ratio', 'mild', 'any', 'medium',
         'A relação altura/largura facial mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve no formato global.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'face_height_to_width_ratio', 'moderate', 'any', 'medium',
         'A relação altura/largura facial mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Corte de cabelo personalizado para o formato pode equilibrar visualmente.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'face_height_to_width_ratio', 'strong', 'any', 'medium',
         'A relação altura/largura facial mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Cabeleireiro especializado em análise de formato facial pode personalizar recursos de styling de alto impacto.',
         '["value","ideal","deviation_pct"]'::jsonb),

        ('v1.0', 'total_facial_convexity', 'mild', 'any', 'medium',
         'O índice de convexidade facial total mede {value} ({deviation_pct}% de divergência da referência {ideal} de Sarver & Jacobson 2014). Variação leve.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'total_facial_convexity', 'moderate', 'any', 'medium',
         'O índice de convexidade facial total mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Pode envolver componente postural — fisioterapia cervical pode contribuir.',
         '["value","ideal","deviation_pct"]'::jsonb),
        ('v1.0', 'total_facial_convexity', 'strong', 'any', 'medium',
         'O índice de convexidade facial total mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação ortodôntica com cefalometria esclarece componente esquelético; fisioterapia postural avalia componente cervical.',
         '["value","ideal","deviation_pct"]'::jsonb)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove all v1.0 templates
    await queryRunner.query(`DELETE FROM diagnostic_template WHERE version = 'v1.0'`);
    // Deactivate v1.0
    await queryRunner.query(`UPDATE diagnostic_template_version SET is_active = FALSE WHERE version = 'v1.0'`);
    await queryRunner.query(`DELETE FROM diagnostic_template_version WHERE version = 'v1.0'`);
    // Restore v0.1 (note: original 5 templates were deleted; only the version row + blacklist remain)
    await queryRunner.query(`UPDATE diagnostic_template_version SET is_active = TRUE WHERE version = 'v0.1'`);
  }
}
