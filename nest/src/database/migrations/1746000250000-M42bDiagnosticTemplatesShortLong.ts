import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-53b — M4.2 Diagnostic Templates v1.0 (short + long sizes, Opus content)
 *
 * Adds 336 templates to `diagnostic_template` v1.0 covering all 56 M1-active
 * scoreable metrics × 3 severities (mild, moderate, strong) × 2 sizes
 * (short, long) × direction='any'. Strictly additive on top of PR-53 (M42)
 * which seeded 168 mediums.
 *
 * Size contract (DEC-31)
 * ----------------------
 *   short  ≤ 120 chars  → frontend cards / chips / chamadas curtas
 *   medium ≤ 350 chars  → corpo de detalhamento (já existente em M42)
 *   long   ≤ 500 chars  → parágrafo de PDF / drill-down clínico
 *
 * Tone enforcement (PLAN_M4_NARRATIVE §1.1 — linha vermelha)
 * ----------------------------------------------------------
 * Verbs allowed: "observa-se", "indica", "apresenta", "tende a apresentar".
 * Strong severity NEVER uses "severo" → always "considerável".
 * Forbidden vocab tracked by template_blacklist v0.1 + v0.2 (M42c).
 *
 * Placeholders allowed (PR-51 — TemplateRendererService.ALLOWED_PLACEHOLDERS)
 *   value, ideal, deviation_pct, direction_label, region_pt
 *
 * Idempotent: ON CONFLICT (version, metric_id, severity, direction, size)
 * DO NOTHING. Re-running the migration is a no-op.
 *
 * References
 * ----------
 *   - PLAN_M4_NARRATIVE.md §1.1, §2.2, DEC-30, DEC-31
 *   - PLAN_METRICS.md §0 (PR-53b row)
 *   - 1746000220000-M42DiagnosticTemplatesV1.ts (mediums baseline / vocab)
 *   - nest/src/modules/diagnosis/template-renderer.service.ts (4 gates)
 *   - nest/scripts/lint-templates.ts (CI lint)
 *   - Naini 2011, Powell & Humphreys 1984, Farkas 1994, Bashour 2006,
 *     Sarver & Jacobson 2014.
 */

interface TemplateRow {
  metric_id: string;
  severity: 'mild' | 'moderate' | 'strong';
  size: 'short' | 'long';
  template_pt: string;
}

const VERSION = 'v1.0';
const DIRECTION = 'any';

const PLACEHOLDER_RE = /\{([a-z_][a-z0-9_]*)\}/g;
function extractPlaceholders(tpl: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER_RE.exec(tpl)) !== null) found.add(m[1]);
  return [...found];
}

// ─────────────────────────────────────────────────────────────────────────────
// SHORT + LONG TEMPLATE CATALOG (336 rows = 56 metrics × 3 sevs × 2 sizes)
// ─────────────────────────────────────────────────────────────────────────────
// Authoring rules:
//   short → ≤120 chars, 1 placeholder max, 1 sentence, headline-style.
//   long  → ~280–500 chars, paragraph with anatomical context + suggested
//           follow-up consistent with the medium's recommendation.
//   Both sizes preserve the medium's vocabulary (region terms, verbs, refs).
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATES: TemplateRow[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // SYMMETRY (14 metrics) — includes thirds & fifths under region='symmetry'
  // ═══════════════════════════════════════════════════════════════════════════

  // ── brow_height_asymmetry ──
  { metric_id: 'brow_height_asymmetry', severity: 'mild', size: 'short',
    template_pt: 'Sobrancelhas com diferença leve de altura ({deviation_pct}%), variação habitual.' },
  { metric_id: 'brow_height_asymmetry', severity: 'mild', size: 'long',
    template_pt: 'A altura entre as sobrancelhas apresenta diferença leve de {deviation_pct}%. Trata-se de variação dentro do espectro habitual, frequentemente equilibrada por design de sobrancelhas e não exige acompanhamento específico — observa-se em grande parte das pessoas em fotos frontais padrão.' },
  { metric_id: 'brow_height_asymmetry', severity: 'moderate', size: 'short',
    template_pt: 'Sobrancelhas com diferença de altura de {deviation_pct}%, magnitude moderada.' },
  { metric_id: 'brow_height_asymmetry', severity: 'moderate', size: 'long',
    template_pt: 'A altura entre as sobrancelhas apresenta diferença de {deviation_pct}% em magnitude moderada. Tende a ser perceptível em fotos frontais e responde bem a design de sobrancelhas — penteado de cauda alongada do lado mais baixo costuma equilibrar opticamente o conjunto.' },
  { metric_id: 'brow_height_asymmetry', severity: 'strong', size: 'short',
    template_pt: 'Sobrancelhas com diferença de altura considerável ({deviation_pct}%).' },
  { metric_id: 'brow_height_asymmetry', severity: 'strong', size: 'long',
    template_pt: 'A altura entre as sobrancelhas apresenta diferença considerável de {deviation_pct}%. Pode envolver componente muscular do frontal — exercícios faciais direcionados ao lado mais caído ou avaliação dermatológica para opções como toxina botulínica equilibrante podem contribuir conforme objetivo individual.' },

  // ── eye_height_asymmetry ──
  { metric_id: 'eye_height_asymmetry', severity: 'mild', size: 'short',
    template_pt: 'Olhos com diferença leve de altura ({deviation_pct}%), discretamente comum.' },
  { metric_id: 'eye_height_asymmetry', severity: 'mild', size: 'long',
    template_pt: 'A altura entre os olhos apresenta diferença leve de {deviation_pct}%. Variação visualmente discreta e bastante comum no espectro populacional — não compromete a percepção global de simetria e raramente é notada em interações casuais.' },
  { metric_id: 'eye_height_asymmetry', severity: 'moderate', size: 'short',
    template_pt: 'Olhos com diferença de altura de {deviation_pct}%, magnitude moderada.' },
  { metric_id: 'eye_height_asymmetry', severity: 'moderate', size: 'long',
    template_pt: 'A altura entre os olhos apresenta diferença de {deviation_pct}% em magnitude moderada. Tende a ser perceptível em fotos frontais; maquiagem com sombra esfumada ou eyeliner direcionado pode equilibrar opticamente a percepção entre os hemifaces.' },
  { metric_id: 'eye_height_asymmetry', severity: 'strong', size: 'short',
    template_pt: 'Olhos com diferença de altura considerável ({deviation_pct}%).' },
  { metric_id: 'eye_height_asymmetry', severity: 'strong', size: 'long',
    template_pt: 'A altura entre os olhos apresenta diferença considerável de {deviation_pct}%. Pode envolver componente palpebral ou postural — avaliação dermatológica para opções de elevação palpebral ou avaliação fisioterapêutica de cintura escapular e cervical pode esclarecer a origem.' },

  // ── fifth_1_ratio ──
  { metric_id: 'fifth_1_ratio', severity: 'mild', size: 'short',
    template_pt: 'Têmpora esquerda mede {value}, leve divergência da referência.' },
  { metric_id: 'fifth_1_ratio', severity: 'mild', size: 'long',
    template_pt: 'O primeiro quinto facial (têmpora esquerda) mede {value}, com {deviation_pct}% de divergência da referência {ideal} de Powell & Humphreys 1984. Variação leve e comum dentro do espectro habitual, sem necessidade de intervenção específica para a maioria dos perfis.' },
  { metric_id: 'fifth_1_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Têmpora esquerda mede {value}, magnitude moderada.' },
  { metric_id: 'fifth_1_ratio', severity: 'moderate', size: 'long',
    template_pt: 'O primeiro quinto facial (têmpora esquerda) mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Recursos de styling como volume capilar lateral controlado podem equilibrar visualmente a proporção dos quintos clássicos.' },
  { metric_id: 'fifth_1_ratio', severity: 'strong', size: 'short',
    template_pt: 'Têmpora esquerda mede {value}, magnitude considerável.' },
  { metric_id: 'fifth_1_ratio', severity: 'strong', size: 'long',
    template_pt: 'O primeiro quinto facial (têmpora esquerda) mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Cabeleireiro especializado em análise de formato facial pode personalizar o volume capilar lateral e o corte para equilibrar visualmente a proporção dos quintos.' },

  // ── fifth_2_ratio ──
  { metric_id: 'fifth_2_ratio', severity: 'mild', size: 'short',
    template_pt: 'Olho esquerdo mede {value} no quinto facial, leve divergência.' },
  { metric_id: 'fifth_2_ratio', severity: 'mild', size: 'long',
    template_pt: 'O segundo quinto facial (olho esquerdo) mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual; permite explorar maquiagem ocular livremente sem necessidade de correção visual da proporção.' },
  { metric_id: 'fifth_2_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Olho esquerdo mede {value} no quinto facial, magnitude moderada.' },
  { metric_id: 'fifth_2_ratio', severity: 'moderate', size: 'long',
    template_pt: 'O segundo quinto facial (olho esquerdo) mede {value}, indicando {deviation_pct}% de divergência da referência {ideal}, em magnitude moderada. Maquiagem direcionada à região ocular (sombras, eyeliner, técnica de cut crease) pode equilibrar visualmente a percepção da proporção entre os quintos.' },
  { metric_id: 'fifth_2_ratio', severity: 'strong', size: 'short',
    template_pt: 'Olho esquerdo mede {value} no quinto facial, magnitude considerável.' },
  { metric_id: 'fifth_2_ratio', severity: 'strong', size: 'long',
    template_pt: 'O segundo quinto facial (olho esquerdo) mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Maquiagem direcionada à região ocular costuma equilibrar visualmente as proporções e profissionais de design de sobrancelha podem ajustar o enquadramento.' },

  // ── fifth_3_ratio ──
  { metric_id: 'fifth_3_ratio', severity: 'mild', size: 'short',
    template_pt: 'Quinto central (intercanthal) mede {value}, leve divergência.' },
  { metric_id: 'fifth_3_ratio', severity: 'mild', size: 'long',
    template_pt: 'O quinto central (intercanthal) mede {value}, com {deviation_pct}% de divergência da referência {ideal} de Powell & Humphreys 1984. Variação leve dentro do habitual, dentro do espectro populacional comum em fotos frontais padrão.' },
  { metric_id: 'fifth_3_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Quinto central (intercanthal) mede {value}, magnitude moderada.' },
  { metric_id: 'fifth_3_ratio', severity: 'moderate', size: 'long',
    template_pt: 'O quinto central (intercanthal) mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Maquiagem com técnica de contouring nasal e design de sobrancelha podem ajustar opticamente a percepção do espaçamento ocular.' },
  { metric_id: 'fifth_3_ratio', severity: 'strong', size: 'short',
    template_pt: 'Quinto central (intercanthal) mede {value}, magnitude considerável.' },
  { metric_id: 'fifth_3_ratio', severity: 'strong', size: 'long',
    template_pt: 'O quinto central (intercanthal) mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Maquiagem com técnica de contouring nasal pode ajustar opticamente a percepção de espaçamento; design profissional de sobrancelhas reposiciona o enquadramento ocular percebido.' },

  // ── fifth_4_ratio ──
  { metric_id: 'fifth_4_ratio', severity: 'mild', size: 'short',
    template_pt: 'Olho direito mede {value} no quinto facial, leve divergência.' },
  { metric_id: 'fifth_4_ratio', severity: 'mild', size: 'long',
    template_pt: 'O quarto quinto facial (olho direito) mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve, comum no espectro populacional — permite uso livre de maquiagem sem necessidade de correção visual da proporção dos quintos.' },
  { metric_id: 'fifth_4_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Olho direito mede {value} no quinto facial, magnitude moderada.' },
  { metric_id: 'fifth_4_ratio', severity: 'moderate', size: 'long',
    template_pt: 'O quarto quinto facial (olho direito) mede {value}, indicando {deviation_pct}% de divergência da referência {ideal} em magnitude moderada. Recursos de maquiagem na região ocular (sombras, eyeliner, técnica de cut crease) podem equilibrar visualmente a proporção entre os quintos.' },
  { metric_id: 'fifth_4_ratio', severity: 'strong', size: 'short',
    template_pt: 'Olho direito mede {value} no quinto facial, magnitude considerável.' },
  { metric_id: 'fifth_4_ratio', severity: 'strong', size: 'long',
    template_pt: 'O quarto quinto facial (olho direito) mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos de maquiagem na região ocular podem equilibrar visualmente; design profissional de sobrancelha ajusta o enquadramento percebido.' },

  // ── fifth_5_ratio ──
  { metric_id: 'fifth_5_ratio', severity: 'mild', size: 'short',
    template_pt: 'Têmpora direita mede {value}, leve divergência da referência.' },
  { metric_id: 'fifth_5_ratio', severity: 'mild', size: 'long',
    template_pt: 'O quinto facial direito (têmpora) mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do habitual, comum no espectro populacional e visualmente discreta em fotografias frontais.' },
  { metric_id: 'fifth_5_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Têmpora direita mede {value}, magnitude moderada.' },
  { metric_id: 'fifth_5_ratio', severity: 'moderate', size: 'long',
    template_pt: 'O quinto facial direito (têmpora) mede {value}, indicando {deviation_pct}% de divergência da referência {ideal} em magnitude moderada. Volume capilar lateral controlado e penteados com camadas podem equilibrar visualmente a proporção entre os quintos.' },
  { metric_id: 'fifth_5_ratio', severity: 'strong', size: 'short',
    template_pt: 'Têmpora direita mede {value}, magnitude considerável.' },
  { metric_id: 'fifth_5_ratio', severity: 'strong', size: 'long',
    template_pt: 'O quinto facial direito (têmpora) mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Volume capilar lateral pode equilibrar visualmente; cabeleireiro especializado em formato facial personaliza recursos de styling de alto impacto para o caso.' },

  // ── global_asymmetry_index ──
  { metric_id: 'global_asymmetry_index', severity: 'mild', size: 'short',
    template_pt: 'Índice global de assimetria mede {value}, variação leve.' },
  { metric_id: 'global_asymmetry_index', severity: 'mild', size: 'long',
    template_pt: 'O índice global de assimetria mede {value}, indicando variação leve entre os hemifaces — padrão presente na maioria das pessoas. Não compromete a percepção global de simetria e geralmente passa despercebido em interações casuais.' },
  { metric_id: 'global_asymmetry_index', severity: 'moderate', size: 'short',
    template_pt: 'Índice global de assimetria mede {value}, magnitude moderada.' },
  { metric_id: 'global_asymmetry_index', severity: 'moderate', size: 'long',
    template_pt: 'O índice global de assimetria mede {value} ({deviation_pct}% acima da referência {ideal}), indicando diferença moderada entre os hemifaces. Maquiagem com técnica de iluminação assimétrica pode equilibrar opticamente a percepção do conjunto facial.' },
  { metric_id: 'global_asymmetry_index', severity: 'strong', size: 'short',
    template_pt: 'Índice global de assimetria mede {value}, magnitude considerável.' },
  { metric_id: 'global_asymmetry_index', severity: 'strong', size: 'long',
    template_pt: 'O índice global de assimetria mede {value} ({deviation_pct}% acima da referência {ideal}), em magnitude considerável. Pode refletir componente postural, muscular ou estrutural — avaliação fisioterapêutica especializada em postura cervical e cintura escapular pode esclarecer a origem.' },

  // ── intercanthal_to_eye_width_ratio ──
  { metric_id: 'intercanthal_to_eye_width_ratio', severity: 'mild', size: 'short',
    template_pt: 'Relação intercanthal/largura ocular mede {value}, leve divergência.' },
  { metric_id: 'intercanthal_to_eye_width_ratio', severity: 'mild', size: 'long',
    template_pt: 'A relação entre distância intercanthal e largura ocular mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve no padrão de quintos, dentro do espectro populacional comum em análise de fotos frontais.' },
  { metric_id: 'intercanthal_to_eye_width_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Relação intercanthal/largura ocular mede {value}, magnitude moderada.' },
  { metric_id: 'intercanthal_to_eye_width_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A relação entre distância intercanthal e largura ocular mede {value}, indicando {deviation_pct}% de divergência da referência {ideal} de Naini 2011. Maquiagem ocular direcionada e design de sobrancelhas podem ajustar opticamente o espaçamento percebido.' },
  { metric_id: 'intercanthal_to_eye_width_ratio', severity: 'strong', size: 'short',
    template_pt: 'Relação intercanthal/largura ocular mede {value}, magnitude considerável.' },
  { metric_id: 'intercanthal_to_eye_width_ratio', severity: 'strong', size: 'long',
    template_pt: 'A relação entre distância intercanthal e largura ocular mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Maquiagem com técnica de contouring nasal ou design profissional de sobrancelha podem ajustar a percepção do espaçamento ocular.' },

  // ── lip_canting_angle ──
  { metric_id: 'lip_canting_angle', severity: 'mild', size: 'short',
    template_pt: 'Linha labial com leve inclinação de {value} graus.' },
  { metric_id: 'lip_canting_angle', severity: 'mild', size: 'long',
    template_pt: 'A linha labial apresenta inclinação leve de {value} graus em relação à horizontal — padrão presente na maioria das pessoas e visualmente discreto em fotografias frontais padrão. Não exige intervenção específica.' },
  { metric_id: 'lip_canting_angle', severity: 'moderate', size: 'short',
    template_pt: 'Linha labial com inclinação de {value} graus, magnitude moderada.' },
  { metric_id: 'lip_canting_angle', severity: 'moderate', size: 'long',
    template_pt: 'A linha labial apresenta inclinação de {value} graus em relação à horizontal, indicando canting de magnitude moderada. Maquiagem labial com lápis pode redesenhar o contorno opticamente; padrões de mastigação bilateral consciente podem contribuir.' },
  { metric_id: 'lip_canting_angle', severity: 'strong', size: 'short',
    template_pt: 'Linha labial com inclinação considerável de {value} graus.' },
  { metric_id: 'lip_canting_angle', severity: 'strong', size: 'long',
    template_pt: 'A linha labial apresenta inclinação considerável de {value} graus em relação à horizontal. Pode envolver componente oclusal ou postural — avaliação ortodôntica especializada pode esclarecer a origem e indicar caminhos de correção pertinentes ao caso.' },

  // ── lower_third_ratio ──
  { metric_id: 'lower_third_ratio', severity: 'mild', size: 'short',
    template_pt: 'Terço inferior da face mede {value}, leve divergência.' },
  { metric_id: 'lower_third_ratio', severity: 'mild', size: 'long',
    template_pt: 'O terço inferior da face mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do habitual e do espectro populacional, sem necessidade de intervenção estrutural específica.' },
  { metric_id: 'lower_third_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Terço inferior da face mede {value}, magnitude moderada.' },
  { metric_id: 'lower_third_ratio', severity: 'moderate', size: 'long',
    template_pt: 'O terço inferior da face mede {value}, indicando {deviation_pct}% de divergência da referência {ideal}. Proporção moderadamente fora do padrão clássico — estilo de barba (em homens) ou contouring submentoniano podem ajustar opticamente a proporção visual.' },
  { metric_id: 'lower_third_ratio', severity: 'strong', size: 'short',
    template_pt: 'Terço inferior da face mede {value}, magnitude considerável.' },
  { metric_id: 'lower_third_ratio', severity: 'strong', size: 'long',
    template_pt: 'O terço inferior da face mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação ortodôntica para análise cefalométrica e/ou avaliação cirúrgica ortognática podem ser cogitadas conforme orientação especializada.' },

  // ── middle_third_ratio ──
  { metric_id: 'middle_third_ratio', severity: 'mild', size: 'short',
    template_pt: 'Terço médio da face mede {value}, leve divergência.' },
  { metric_id: 'middle_third_ratio', severity: 'mild', size: 'long',
    template_pt: 'O terço médio da face mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve, comum no espectro populacional, sem necessidade de avaliação estrutural específica para o perfil observado.' },
  { metric_id: 'middle_third_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Terço médio da face mede {value}, magnitude moderada.' },
  { metric_id: 'middle_third_ratio', severity: 'moderate', size: 'long',
    template_pt: 'O terço médio da face mede {value}, indicando {deviation_pct}% de divergência da referência {ideal}. Proporção moderadamente fora do padrão canônico — recursos de styling capilar e contouring frontal podem ajustar a percepção do conjunto.' },
  { metric_id: 'middle_third_ratio', severity: 'strong', size: 'short',
    template_pt: 'Terço médio da face mede {value}, magnitude considerável.' },
  { metric_id: 'middle_third_ratio', severity: 'strong', size: 'long',
    template_pt: 'O terço médio da face mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Pode justificar avaliação ortodôntica para análise cefalométrica detalhada do componente esquelético do mídface.' },

  // ── midline_deviation ──
  { metric_id: 'midline_deviation', severity: 'mild', size: 'short',
    template_pt: 'Linha mediana com leve deslocamento de {deviation_pct}%.' },
  { metric_id: 'midline_deviation', severity: 'mild', size: 'long',
    template_pt: 'A linha mediana facial apresenta um leve deslocamento de {deviation_pct}% em relação ao eixo central. Padrão visual de assimetria axial sutil, dentro de variação comum e raramente notada em interações casuais.' },
  { metric_id: 'midline_deviation', severity: 'moderate', size: 'short',
    template_pt: 'Linha mediana com deslocamento de {deviation_pct}%, magnitude moderada.' },
  { metric_id: 'midline_deviation', severity: 'moderate', size: 'long',
    template_pt: 'A linha mediana facial apresenta deslocamento de {deviation_pct}% em relação ao eixo central, indicando assimetria axial de magnitude moderada. Maquiagem com técnica de contouring central pode atenuar opticamente a percepção do desvio.' },
  { metric_id: 'midline_deviation', severity: 'strong', size: 'short',
    template_pt: 'Linha mediana com deslocamento considerável de {deviation_pct}%.' },
  { metric_id: 'midline_deviation', severity: 'strong', size: 'long',
    template_pt: 'A linha mediana facial apresenta deslocamento de {deviation_pct}% em relação ao eixo central, em magnitude considerável. Pode justificar avaliação ortodôntica especializada para investigar componente oclusal ou postural subjacente ao desalinhamento observado.' },

  // ── upper_third_ratio ──
  { metric_id: 'upper_third_ratio', severity: 'mild', size: 'short',
    template_pt: 'Terço superior da face mede {value}, leve divergência.' },
  { metric_id: 'upper_third_ratio', severity: 'mild', size: 'long',
    template_pt: 'O terço superior da face mede {value} ({deviation_pct}% de divergência do valor de referência {ideal}). Variação leve dentro do espectro habitual, sem necessidade de intervenção estrutural específica.' },
  { metric_id: 'upper_third_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Terço superior da face mede {value}, magnitude moderada.' },
  { metric_id: 'upper_third_ratio', severity: 'moderate', size: 'long',
    template_pt: 'O terço superior da face mede {value}, com {deviation_pct}% de divergência da referência {ideal}, indicando proporção moderadamente fora do padrão clássico de Powell & Humphreys 1984. Corte de cabelo com franja pode equilibrar visualmente.' },
  { metric_id: 'upper_third_ratio', severity: 'strong', size: 'short',
    template_pt: 'Terço superior da face mede {value}, magnitude considerável.' },
  { metric_id: 'upper_third_ratio', severity: 'strong', size: 'long',
    template_pt: 'O terço superior da face mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos de styling como corte de cabelo personalizado e franja podem equilibrar visualmente; avaliação ortodôntica investiga componente esquelético frontal.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // EYES (6 metrics)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── canthal_tilt_l ──
  { metric_id: 'canthal_tilt_l', severity: 'mild', size: 'short',
    template_pt: 'Ângulo cantal esquerdo mede {value} graus, leve divergência.' },
  { metric_id: 'canthal_tilt_l', severity: 'mild', size: 'long',
    template_pt: 'O ângulo cantal esquerdo mede {value} graus, com {deviation_pct}% de divergência da referência {ideal} de Naini 2011. Variação leve dentro do espectro populacional, sem necessidade de intervenção visual ou estrutural específica.' },
  { metric_id: 'canthal_tilt_l', severity: 'moderate', size: 'short',
    template_pt: 'Ângulo cantal esquerdo mede {value} graus, magnitude moderada.' },
  { metric_id: 'canthal_tilt_l', severity: 'moderate', size: 'long',
    template_pt: 'O ângulo cantal esquerdo mede {value} graus, indicando {deviation_pct}% de divergência da referência {ideal} em magnitude moderada. Maquiagem com eyeliner direcionado (estendido ou cat-eye) pode ajustar opticamente o ângulo percebido.' },
  { metric_id: 'canthal_tilt_l', severity: 'strong', size: 'short',
    template_pt: 'Ângulo cantal esquerdo mede {value} graus, magnitude considerável.' },
  { metric_id: 'canthal_tilt_l', severity: 'strong', size: 'long',
    template_pt: 'O ângulo cantal esquerdo mede {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Maquiagem com eyeliner direcionado pode ajustar opticamente o ângulo percebido; avaliação dermatológica para opções não-cirúrgicas pode ser cogitada.' },

  // ── canthal_tilt_r ──
  { metric_id: 'canthal_tilt_r', severity: 'mild', size: 'short',
    template_pt: 'Ângulo cantal direito mede {value} graus, leve divergência.' },
  { metric_id: 'canthal_tilt_r', severity: 'mild', size: 'long',
    template_pt: 'O ângulo cantal direito mede {value} graus, com {deviation_pct}% de divergência da referência {ideal}. Variação leve dentro do habitual e do espectro populacional comum em análise de fotos frontais padrão.' },
  { metric_id: 'canthal_tilt_r', severity: 'moderate', size: 'short',
    template_pt: 'Ângulo cantal direito mede {value} graus, magnitude moderada.' },
  { metric_id: 'canthal_tilt_r', severity: 'moderate', size: 'long',
    template_pt: 'O ângulo cantal direito mede {value} graus, indicando {deviation_pct}% de divergência da referência {ideal} em magnitude moderada. Maquiagem com eyeliner direcionado pode ajustar opticamente o ângulo percebido na região ocular direita.' },
  { metric_id: 'canthal_tilt_r', severity: 'strong', size: 'short',
    template_pt: 'Ângulo cantal direito mede {value} graus, magnitude considerável.' },
  { metric_id: 'canthal_tilt_r', severity: 'strong', size: 'long',
    template_pt: 'O ângulo cantal direito mede {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Maquiagem com eyeliner direcionado pode ajustar opticamente o ângulo percebido; avaliação dermatológica esclarece opções não-cirúrgicas para o caso.' },

  // ── eye_aperture_ratio_l ──
  { metric_id: 'eye_aperture_ratio_l', severity: 'mild', size: 'short',
    template_pt: 'Abertura ocular esquerda mede {value}, leve divergência.' },
  { metric_id: 'eye_aperture_ratio_l', severity: 'mild', size: 'long',
    template_pt: 'A abertura ocular esquerda mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual e visualmente discreta em fotos frontais padrão.' },
  { metric_id: 'eye_aperture_ratio_l', severity: 'moderate', size: 'short',
    template_pt: 'Abertura ocular esquerda mede {value}, magnitude moderada.' },
  { metric_id: 'eye_aperture_ratio_l', severity: 'moderate', size: 'long',
    template_pt: 'A abertura ocular esquerda mede {value}, indicando {deviation_pct}% de divergência da referência {ideal} em magnitude moderada. Maquiagem com sombra esfumada e máscara curvante pode equilibrar opticamente a percepção da abertura.' },
  { metric_id: 'eye_aperture_ratio_l', severity: 'strong', size: 'short',
    template_pt: 'Abertura ocular esquerda mede {value}, magnitude considerável.' },
  { metric_id: 'eye_aperture_ratio_l', severity: 'strong', size: 'long',
    template_pt: 'A abertura ocular esquerda mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Pode envolver componente palpebral — avaliação dermatológica ou oftalmológica esclarece a origem e opções pertinentes ao caso.' },

  // ── eye_aperture_ratio_r ──
  { metric_id: 'eye_aperture_ratio_r', severity: 'mild', size: 'short',
    template_pt: 'Abertura ocular direita mede {value}, leve divergência.' },
  { metric_id: 'eye_aperture_ratio_r', severity: 'mild', size: 'long',
    template_pt: 'A abertura ocular direita mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do habitual e do espectro populacional, sem necessidade de intervenção específica.' },
  { metric_id: 'eye_aperture_ratio_r', severity: 'moderate', size: 'short',
    template_pt: 'Abertura ocular direita mede {value}, magnitude moderada.' },
  { metric_id: 'eye_aperture_ratio_r', severity: 'moderate', size: 'long',
    template_pt: 'A abertura ocular direita mede {value}, indicando {deviation_pct}% de divergência da referência {ideal} em magnitude moderada. Maquiagem ocular direcionada (sombra e máscara curvante) pode equilibrar a percepção visual da abertura.' },
  { metric_id: 'eye_aperture_ratio_r', severity: 'strong', size: 'short',
    template_pt: 'Abertura ocular direita mede {value}, magnitude considerável.' },
  { metric_id: 'eye_aperture_ratio_r', severity: 'strong', size: 'long',
    template_pt: 'A abertura ocular direita mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Pode envolver componente palpebral — avaliação dermatológica ou oftalmológica esclarece a origem e indica caminhos pertinentes.' },

  // ── intercanthal_distance ──
  { metric_id: 'intercanthal_distance', severity: 'mild', size: 'short',
    template_pt: 'Distância intercanthal mede {value}, leve divergência.' },
  { metric_id: 'intercanthal_distance', severity: 'mild', size: 'long',
    template_pt: 'A distância intercanthal mede {value} unidades, com {deviation_pct}% de divergência da referência {ideal} de Farkas 1994. Variação leve dentro do espectro populacional, sem implicação visual ou estrutural relevante.' },
  { metric_id: 'intercanthal_distance', severity: 'moderate', size: 'short',
    template_pt: 'Distância intercanthal mede {value}, magnitude moderada.' },
  { metric_id: 'intercanthal_distance', severity: 'moderate', size: 'long',
    template_pt: 'A distância intercanthal mede {value} unidades, indicando {deviation_pct}% de divergência da referência {ideal} em magnitude moderada. Maquiagem com contouring nasal pode ajustar opticamente a percepção do espaçamento entre os olhos.' },
  { metric_id: 'intercanthal_distance', severity: 'strong', size: 'short',
    template_pt: 'Distância intercanthal mede {value}, magnitude considerável.' },
  { metric_id: 'intercanthal_distance', severity: 'strong', size: 'long',
    template_pt: 'A distância intercanthal mede {value} unidades ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Maquiagem com contouring nasal e design de sobrancelha podem equilibrar visualmente o espaçamento percebido.' },

  // ── interpupillary_distance ──
  { metric_id: 'interpupillary_distance', severity: 'mild', size: 'short',
    template_pt: 'Distância interpupilar mede {value}, leve divergência.' },
  { metric_id: 'interpupillary_distance', severity: 'mild', size: 'long',
    template_pt: 'A distância interpupilar mede {value} unidades ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual, útil como referência métrica para enquadramento de óculos e fotografia.' },
  { metric_id: 'interpupillary_distance', severity: 'moderate', size: 'short',
    template_pt: 'Distância interpupilar mede {value}, magnitude moderada.' },
  { metric_id: 'interpupillary_distance', severity: 'moderate', size: 'long',
    template_pt: 'A distância interpupilar mede {value} unidades, com {deviation_pct}% de divergência da referência {ideal}, indicando padrão moderadamente fora do canônico. Métrica útil para selecionar enquadramento de óculos com largura ponte adequada.' },
  { metric_id: 'interpupillary_distance', severity: 'strong', size: 'short',
    template_pt: 'Distância interpupilar mede {value}, magnitude considerável.' },
  { metric_id: 'interpupillary_distance', severity: 'strong', size: 'long',
    template_pt: 'A distância interpupilar mede {value} unidades ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Métrica útil para selecionar enquadramento de óculos e fotografia profissional; ótica especializada em medição precisa de DPN orienta seleção.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // BROWS (6 metrics)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── brow_arch_peak_l ──
  { metric_id: 'brow_arch_peak_l', severity: 'mild', size: 'short',
    template_pt: 'Pico do arco esquerdo mede {value}, leve divergência.' },
  { metric_id: 'brow_arch_peak_l', severity: 'mild', size: 'long',
    template_pt: 'A posição do pico do arco da sobrancelha esquerda mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual, sem necessidade de redesenho específico do arco.' },
  { metric_id: 'brow_arch_peak_l', severity: 'moderate', size: 'short',
    template_pt: 'Pico do arco esquerdo mede {value}, magnitude moderada.' },
  { metric_id: 'brow_arch_peak_l', severity: 'moderate', size: 'long',
    template_pt: 'A posição do pico do arco da sobrancelha esquerda mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Design de sobrancelhas pode reposicionar visualmente o arco para um perfil mais equilibrado.' },
  { metric_id: 'brow_arch_peak_l', severity: 'strong', size: 'short',
    template_pt: 'Pico do arco esquerdo mede {value}, magnitude considerável.' },
  { metric_id: 'brow_arch_peak_l', severity: 'strong', size: 'long',
    template_pt: 'A posição do pico do arco da sobrancelha esquerda mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Design profissional de sobrancelhas é particularmente útil para reposicionar visualmente o pico e equilibrar o enquadramento ocular.' },

  // ── brow_arch_peak_r ──
  { metric_id: 'brow_arch_peak_r', severity: 'mild', size: 'short',
    template_pt: 'Pico do arco direito mede {value}, leve divergência.' },
  { metric_id: 'brow_arch_peak_r', severity: 'mild', size: 'long',
    template_pt: 'A posição do pico do arco da sobrancelha direita mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro populacional, sem implicação visual relevante.' },
  { metric_id: 'brow_arch_peak_r', severity: 'moderate', size: 'short',
    template_pt: 'Pico do arco direito mede {value}, magnitude moderada.' },
  { metric_id: 'brow_arch_peak_r', severity: 'moderate', size: 'long',
    template_pt: 'A posição do pico do arco da sobrancelha direita mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Design de sobrancelhas pode reposicionar visualmente o arco para perfil mais equilibrado.' },
  { metric_id: 'brow_arch_peak_r', severity: 'strong', size: 'short',
    template_pt: 'Pico do arco direito mede {value}, magnitude considerável.' },
  { metric_id: 'brow_arch_peak_r', severity: 'strong', size: 'long',
    template_pt: 'A posição do pico do arco da sobrancelha direita mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Design profissional de sobrancelhas é recomendável para reposicionar visualmente o pico e equilibrar o enquadramento ocular.' },

  // ── brow_height_l ──
  { metric_id: 'brow_height_l', severity: 'mild', size: 'short',
    template_pt: 'Altura da sobrancelha esquerda mede {value}, leve divergência.' },
  { metric_id: 'brow_height_l', severity: 'mild', size: 'long',
    template_pt: 'A altura da sobrancelha esquerda mede {value} unidades intercanthais, com {deviation_pct}% de divergência da referência {ideal}. Variação leve dentro do habitual e do espectro populacional comum em análise frontal.' },
  { metric_id: 'brow_height_l', severity: 'moderate', size: 'short',
    template_pt: 'Altura da sobrancelha esquerda mede {value}, magnitude moderada.' },
  { metric_id: 'brow_height_l', severity: 'moderate', size: 'long',
    template_pt: 'A altura da sobrancelha esquerda mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Design de sobrancelhas com cauda elevada pode equilibrar visualmente a posição.' },
  { metric_id: 'brow_height_l', severity: 'strong', size: 'short',
    template_pt: 'Altura da sobrancelha esquerda mede {value}, magnitude considerável.' },
  { metric_id: 'brow_height_l', severity: 'strong', size: 'long',
    template_pt: 'A altura da sobrancelha esquerda mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica para opções como toxina botulínica equilibrante pode ser cogitada conforme objetivo individual.' },

  // ── brow_height_r ──
  { metric_id: 'brow_height_r', severity: 'mild', size: 'short',
    template_pt: 'Altura da sobrancelha direita mede {value}, leve divergência.' },
  { metric_id: 'brow_height_r', severity: 'mild', size: 'long',
    template_pt: 'A altura da sobrancelha direita mede {value} unidades intercanthais, com {deviation_pct}% de divergência da referência {ideal}. Variação leve dentro do habitual, sem necessidade de intervenção específica.' },
  { metric_id: 'brow_height_r', severity: 'moderate', size: 'short',
    template_pt: 'Altura da sobrancelha direita mede {value}, magnitude moderada.' },
  { metric_id: 'brow_height_r', severity: 'moderate', size: 'long',
    template_pt: 'A altura da sobrancelha direita mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Design de sobrancelhas equilibra visualmente a posição entre os lados.' },
  { metric_id: 'brow_height_r', severity: 'strong', size: 'short',
    template_pt: 'Altura da sobrancelha direita mede {value}, magnitude considerável.' },
  { metric_id: 'brow_height_r', severity: 'strong', size: 'long',
    template_pt: 'A altura da sobrancelha direita mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica esclarece opções de equilibrio entre os hemifaces conforme objetivo individual.' },

  // ── brow_tail_drop_l ──
  { metric_id: 'brow_tail_drop_l', severity: 'mild', size: 'short',
    template_pt: 'Cauda da sobrancelha esquerda com queda leve de {value}.' },
  { metric_id: 'brow_tail_drop_l', severity: 'mild', size: 'long',
    template_pt: 'A cauda da sobrancelha esquerda apresenta queda de {value} unidades ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual, sem necessidade de intervenção específica.' },
  { metric_id: 'brow_tail_drop_l', severity: 'moderate', size: 'short',
    template_pt: 'Cauda da sobrancelha esquerda com queda de {value}, moderada.' },
  { metric_id: 'brow_tail_drop_l', severity: 'moderate', size: 'long',
    template_pt: 'A cauda da sobrancelha esquerda apresenta queda de {value} unidades ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Exercícios de elevação do frontal podem contribuir; design de sobrancelhas com cauda alongada equilibra visualmente.' },
  { metric_id: 'brow_tail_drop_l', severity: 'strong', size: 'short',
    template_pt: 'Cauda da sobrancelha esquerda com queda considerável de {value}.' },
  { metric_id: 'brow_tail_drop_l', severity: 'strong', size: 'long',
    template_pt: 'A cauda da sobrancelha esquerda apresenta queda de {value} unidades ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica para lifting não-cirúrgico (toxina botulínica direcionada) pode ser cogitada conforme objetivo individual.' },

  // ── interbrow_distance_ratio ──
  { metric_id: 'interbrow_distance_ratio', severity: 'mild', size: 'short',
    template_pt: 'Distância entre sobrancelhas mede {value}, leve divergência.' },
  { metric_id: 'interbrow_distance_ratio', severity: 'mild', size: 'long',
    template_pt: 'A distância entre as sobrancelhas mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do habitual e do espectro populacional comum em fotos frontais.' },
  { metric_id: 'interbrow_distance_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Distância entre sobrancelhas mede {value}, magnitude moderada.' },
  { metric_id: 'interbrow_distance_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A distância entre as sobrancelhas mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Design de sobrancelhas pode ajustar a percepção do espaçamento entre os arcos.' },
  { metric_id: 'interbrow_distance_ratio', severity: 'strong', size: 'short',
    template_pt: 'Distância entre sobrancelhas mede {value}, magnitude considerável.' },
  { metric_id: 'interbrow_distance_ratio', severity: 'strong', size: 'long',
    template_pt: 'A distância entre as sobrancelhas mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Design profissional de sobrancelhas pode ajustar significativamente a proporção visual entre os arcos.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // NOSE (7 metrics)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── alar_base_asymmetry ──
  { metric_id: 'alar_base_asymmetry', severity: 'mild', size: 'short',
    template_pt: 'Base alar com leve assimetria de {value} unidades.' },
  { metric_id: 'alar_base_asymmetry', severity: 'mild', size: 'long',
    template_pt: 'A base alar apresenta assimetria leve de {value} unidades entre os lados. Variação dentro do espectro habitual, comum em fotos frontais e visualmente discreta em interações casuais.' },
  { metric_id: 'alar_base_asymmetry', severity: 'moderate', size: 'short',
    template_pt: 'Base alar com assimetria de {value}, magnitude moderada.' },
  { metric_id: 'alar_base_asymmetry', severity: 'moderate', size: 'long',
    template_pt: 'A base alar apresenta assimetria de {value} unidades entre os lados, em magnitude moderada. Maquiagem com contouring nasal pode equilibrar opticamente a percepção das asas nasais.' },
  { metric_id: 'alar_base_asymmetry', severity: 'strong', size: 'short',
    template_pt: 'Base alar com assimetria considerável de {value}.' },
  { metric_id: 'alar_base_asymmetry', severity: 'strong', size: 'long',
    template_pt: 'A base alar apresenta assimetria considerável de {value} unidades entre os lados. Pode envolver componente estrutural — avaliação cirúrgica plástica especializada esclarece origem e opções pertinentes ao caso.' },

  // ── alar_to_face_width_ratio ──
  { metric_id: 'alar_to_face_width_ratio', severity: 'mild', size: 'short',
    template_pt: 'Largura alar/face mede {value}, leve divergência.' },
  { metric_id: 'alar_to_face_width_ratio', severity: 'mild', size: 'long',
    template_pt: 'A relação entre largura da base alar e largura da face mede {value} ({deviation_pct}% de divergência da referência {ideal} de Powell & Humphreys 1984). Variação leve dentro do espectro habitual.' },
  { metric_id: 'alar_to_face_width_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Largura alar/face mede {value}, magnitude moderada.' },
  { metric_id: 'alar_to_face_width_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A relação entre largura da base alar e largura da face mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Maquiagem com contouring nasal pode equilibrar opticamente a proporção percebida.' },
  { metric_id: 'alar_to_face_width_ratio', severity: 'strong', size: 'short',
    template_pt: 'Largura alar/face mede {value}, magnitude considerável.' },
  { metric_id: 'alar_to_face_width_ratio', severity: 'strong', size: 'long',
    template_pt: 'A relação entre largura da base alar e largura da face mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação otorrinolaringológica esclarece componente funcional; cirurgia plástica avalia componente estético.' },

  // ── dorsum_deviation ──
  { metric_id: 'dorsum_deviation', severity: 'mild', size: 'short',
    template_pt: 'Dorso nasal com leve desvio de {value} graus.' },
  { metric_id: 'dorsum_deviation', severity: 'mild', size: 'long',
    template_pt: 'O dorso nasal apresenta desvio leve de {value} graus em relação ao eixo facial. Variação visualmente discreta em fotografias frontais padrão e dentro do espectro populacional comum.' },
  { metric_id: 'dorsum_deviation', severity: 'moderate', size: 'short',
    template_pt: 'Dorso nasal com desvio de {value} graus, magnitude moderada.' },
  { metric_id: 'dorsum_deviation', severity: 'moderate', size: 'long',
    template_pt: 'O dorso nasal apresenta desvio de {value} graus em relação ao eixo facial, indicando inclinação de magnitude moderada. Maquiagem com contouring nasal direcionado pode equilibrar opticamente a percepção do dorso.' },
  { metric_id: 'dorsum_deviation', severity: 'strong', size: 'short',
    template_pt: 'Dorso nasal com desvio considerável de {value} graus.' },
  { metric_id: 'dorsum_deviation', severity: 'strong', size: 'long',
    template_pt: 'O dorso nasal apresenta desvio considerável de {value} graus em relação ao eixo facial. Pode envolver componente funcional como desvio de septo — avaliação otorrinolaringológica é particularmente indicada para esclarecer origem e opções.' },

  // ── nasal_tip_deviation ──
  { metric_id: 'nasal_tip_deviation', severity: 'mild', size: 'short',
    template_pt: 'Ponta nasal com leve desvio de {value} unidades.' },
  { metric_id: 'nasal_tip_deviation', severity: 'mild', size: 'long',
    template_pt: 'A ponta nasal apresenta desvio leve de {value} unidades em relação ao eixo central. Variação discreta dentro do espectro populacional comum, raramente notada em interações casuais.' },
  { metric_id: 'nasal_tip_deviation', severity: 'moderate', size: 'short',
    template_pt: 'Ponta nasal com desvio de {value}, magnitude moderada.' },
  { metric_id: 'nasal_tip_deviation', severity: 'moderate', size: 'long',
    template_pt: 'A ponta nasal apresenta desvio de {value} unidades em relação ao eixo central, indicando inclinação de magnitude moderada. Maquiagem com contouring nasal direcionado pode equilibrar opticamente a percepção.' },
  { metric_id: 'nasal_tip_deviation', severity: 'strong', size: 'short',
    template_pt: 'Ponta nasal com desvio considerável de {value}.' },
  { metric_id: 'nasal_tip_deviation', severity: 'strong', size: 'long',
    template_pt: 'A ponta nasal apresenta desvio considerável de {value} unidades em relação ao eixo central. Avaliação especializada (otorrinolaringologista, cirurgião plástico) esclarece origem estrutural e opções pertinentes ao caso.' },

  // ── nose_length_to_icd ──
  { metric_id: 'nose_length_to_icd', severity: 'mild', size: 'short',
    template_pt: 'Comprimento nasal mede {value}, leve divergência.' },
  { metric_id: 'nose_length_to_icd', severity: 'mild', size: 'long',
    template_pt: 'O comprimento nasal mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual, sem implicação visual relevante.' },
  { metric_id: 'nose_length_to_icd', severity: 'moderate', size: 'short',
    template_pt: 'Comprimento nasal mede {value}, magnitude moderada.' },
  { metric_id: 'nose_length_to_icd', severity: 'moderate', size: 'long',
    template_pt: 'O comprimento nasal mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Maquiagem com contouring nasal pode equilibrar visualmente a percepção do comprimento.' },
  { metric_id: 'nose_length_to_icd', severity: 'strong', size: 'short',
    template_pt: 'Comprimento nasal mede {value}, magnitude considerável.' },
  { metric_id: 'nose_length_to_icd', severity: 'strong', size: 'long',
    template_pt: 'O comprimento nasal mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação com cirurgião plástico ou otorrinolaringologista pode ser cogitada conforme objetivo individual.' },

  // ── nose_to_mouth_width_ratio ──
  { metric_id: 'nose_to_mouth_width_ratio', severity: 'mild', size: 'short',
    template_pt: 'Largura nariz/boca mede {value}, leve divergência.' },
  { metric_id: 'nose_to_mouth_width_ratio', severity: 'mild', size: 'long',
    template_pt: 'A relação entre largura nasal e largura da boca mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual em análise frontal.' },
  { metric_id: 'nose_to_mouth_width_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Largura nariz/boca mede {value}, magnitude moderada.' },
  { metric_id: 'nose_to_mouth_width_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A relação entre largura nasal e largura da boca mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Maquiagem labial direcionada pode equilibrar visualmente a proporção entre as estruturas.' },
  { metric_id: 'nose_to_mouth_width_ratio', severity: 'strong', size: 'short',
    template_pt: 'Largura nariz/boca mede {value}, magnitude considerável.' },
  { metric_id: 'nose_to_mouth_width_ratio', severity: 'strong', size: 'long',
    template_pt: 'A relação entre largura nasal e largura da boca mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos combinados de design labial e contouring nasal podem ajustar a proporção percebida.' },

  // ── nose_width_to_icd ──
  { metric_id: 'nose_width_to_icd', severity: 'mild', size: 'short',
    template_pt: 'Largura nasal mede {value}, leve divergência.' },
  { metric_id: 'nose_width_to_icd', severity: 'mild', size: 'long',
    template_pt: 'A largura nasal mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual em fotos frontais padrão.' },
  { metric_id: 'nose_width_to_icd', severity: 'moderate', size: 'short',
    template_pt: 'Largura nasal mede {value}, magnitude moderada.' },
  { metric_id: 'nose_width_to_icd', severity: 'moderate', size: 'long',
    template_pt: 'A largura nasal mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Maquiagem com contouring nasal pode equilibrar visualmente a largura percebida.' },
  { metric_id: 'nose_width_to_icd', severity: 'strong', size: 'short',
    template_pt: 'Largura nasal mede {value}, magnitude considerável.' },
  { metric_id: 'nose_width_to_icd', severity: 'strong', size: 'long',
    template_pt: 'A largura nasal mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação especializada (otorrinolaringologista, cirurgião plástico) pode esclarecer opções funcionais e estéticas.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MOUTH (7 metrics)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── lip_corner_canting ──
  { metric_id: 'lip_corner_canting', severity: 'mild', size: 'short',
    template_pt: 'Canto labial com leve inclinação de {value} graus.' },
  { metric_id: 'lip_corner_canting', severity: 'mild', size: 'long',
    template_pt: 'O canto labial apresenta inclinação leve de {value} graus entre os lados. Variação visualmente discreta em fotografias frontais padrão e dentro do espectro populacional comum.' },
  { metric_id: 'lip_corner_canting', severity: 'moderate', size: 'short',
    template_pt: 'Canto labial com inclinação de {value} graus, moderada.' },
  { metric_id: 'lip_corner_canting', severity: 'moderate', size: 'long',
    template_pt: 'O canto labial apresenta inclinação de {value} graus entre os lados, em magnitude moderada. Maquiagem labial com lápis pode redesenhar o contorno opticamente para equilibrar a percepção entre os cantos.' },
  { metric_id: 'lip_corner_canting', severity: 'strong', size: 'short',
    template_pt: 'Canto labial com inclinação considerável de {value} graus.' },
  { metric_id: 'lip_corner_canting', severity: 'strong', size: 'long',
    template_pt: 'O canto labial apresenta inclinação considerável de {value} graus entre os lados. Pode envolver componente muscular ou oclusal — avaliação dermatológica ou ortodôntica esclarece a origem e opções pertinentes ao caso.' },

  // ── lower_lip_height_ratio ──
  { metric_id: 'lower_lip_height_ratio', severity: 'mild', size: 'short',
    template_pt: 'Lábio inferior mede {value} de altura, leve divergência.' },
  { metric_id: 'lower_lip_height_ratio', severity: 'mild', size: 'long',
    template_pt: 'A altura do lábio inferior mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do habitual e do espectro populacional, sem necessidade de intervenção específica.' },
  { metric_id: 'lower_lip_height_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Lábio inferior mede {value} de altura, magnitude moderada.' },
  { metric_id: 'lower_lip_height_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A altura do lábio inferior mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Maquiagem labial com gloss central pode equilibrar a proporção percebida entre os lábios.' },
  { metric_id: 'lower_lip_height_ratio', severity: 'strong', size: 'short',
    template_pt: 'Lábio inferior mede {value}, magnitude considerável.' },
  { metric_id: 'lower_lip_height_ratio', severity: 'strong', size: 'long',
    template_pt: 'A altura do lábio inferior mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica para preenchimento pode ser cogitada conforme objetivo individual.' },

  // ── mouth_midline_deviation ──
  { metric_id: 'mouth_midline_deviation', severity: 'mild', size: 'short',
    template_pt: 'Linha mediana da boca com leve desvio de {value}.' },
  { metric_id: 'mouth_midline_deviation', severity: 'mild', size: 'long',
    template_pt: 'A linha mediana da boca apresenta desvio leve de {value} unidades em relação ao eixo facial. Variação discreta dentro do espectro populacional, raramente notada em interações casuais.' },
  { metric_id: 'mouth_midline_deviation', severity: 'moderate', size: 'short',
    template_pt: 'Linha mediana da boca com desvio de {value}, moderada.' },
  { metric_id: 'mouth_midline_deviation', severity: 'moderate', size: 'long',
    template_pt: 'A linha mediana da boca apresenta desvio de {value} unidades em relação ao eixo facial, em magnitude moderada. Maquiagem labial com lápis pode redesenhar o contorno opticamente para atenuar a percepção.' },
  { metric_id: 'mouth_midline_deviation', severity: 'strong', size: 'short',
    template_pt: 'Linha mediana da boca com desvio considerável de {value}.' },
  { metric_id: 'mouth_midline_deviation', severity: 'strong', size: 'long',
    template_pt: 'A linha mediana da boca apresenta desvio considerável de {value} unidades em relação ao eixo facial. Pode envolver componente oclusal — avaliação ortodôntica é particularmente útil para esclarecer a origem.' },

  // ── mouth_to_face_width_ratio ──
  { metric_id: 'mouth_to_face_width_ratio', severity: 'mild', size: 'short',
    template_pt: 'Largura boca/face mede {value}, leve divergência.' },
  { metric_id: 'mouth_to_face_width_ratio', severity: 'mild', size: 'long',
    template_pt: 'A relação entre largura da boca e largura da face mede {value} ({deviation_pct}% de divergência da referência {ideal} de Naini 2011). Variação leve dentro do espectro habitual.' },
  { metric_id: 'mouth_to_face_width_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Largura boca/face mede {value}, magnitude moderada.' },
  { metric_id: 'mouth_to_face_width_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A relação entre largura da boca e largura da face mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Maquiagem labial com lápis e contouring podem ajustar visualmente a proporção.' },
  { metric_id: 'mouth_to_face_width_ratio', severity: 'strong', size: 'short',
    template_pt: 'Largura boca/face mede {value}, magnitude considerável.' },
  { metric_id: 'mouth_to_face_width_ratio', severity: 'strong', size: 'long',
    template_pt: 'A relação entre largura da boca e largura da face mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos combinados de contouring facial e design labial podem ajustar a proporção visual.' },

  // ── mouth_width_to_icd ──
  { metric_id: 'mouth_width_to_icd', severity: 'mild', size: 'short',
    template_pt: 'Largura da boca mede {value}, leve divergência.' },
  { metric_id: 'mouth_width_to_icd', severity: 'mild', size: 'long',
    template_pt: 'A largura da boca mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual em fotos frontais padrão.' },
  { metric_id: 'mouth_width_to_icd', severity: 'moderate', size: 'short',
    template_pt: 'Largura da boca mede {value}, magnitude moderada.' },
  { metric_id: 'mouth_width_to_icd', severity: 'moderate', size: 'long',
    template_pt: 'A largura da boca mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Design labial com lápis pode ajustar a proporção visual percebida.' },
  { metric_id: 'mouth_width_to_icd', severity: 'strong', size: 'short',
    template_pt: 'Largura da boca mede {value}, magnitude considerável.' },
  { metric_id: 'mouth_width_to_icd', severity: 'strong', size: 'long',
    template_pt: 'A largura da boca mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Maquiagem com lápis labial pode ajustar opticamente a percepção do contorno e da extensão.' },

  // ── upper_lip_height_ratio ──
  { metric_id: 'upper_lip_height_ratio', severity: 'mild', size: 'short',
    template_pt: 'Lábio superior mede {value} de altura, leve divergência.' },
  { metric_id: 'upper_lip_height_ratio', severity: 'mild', size: 'long',
    template_pt: 'A altura do lábio superior mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual em análise frontal padrão.' },
  { metric_id: 'upper_lip_height_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Lábio superior mede {value} de altura, magnitude moderada.' },
  { metric_id: 'upper_lip_height_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A altura do lábio superior mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Maquiagem labial com técnica de overline sutil pode ajustar visualmente a percepção da altura.' },
  { metric_id: 'upper_lip_height_ratio', severity: 'strong', size: 'short',
    template_pt: 'Lábio superior mede {value}, magnitude considerável.' },
  { metric_id: 'upper_lip_height_ratio', severity: 'strong', size: 'long',
    template_pt: 'A altura do lábio superior mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica para opções de preenchimento pode ser cogitada conforme objetivo individual.' },

  // ── vermilion_height_total ──
  { metric_id: 'vermilion_height_total', severity: 'mild', size: 'short',
    template_pt: 'Vermelhão labial total mede {value}, leve divergência.' },
  { metric_id: 'vermilion_height_total', severity: 'mild', size: 'long',
    template_pt: 'A altura total do vermelhão labial mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual, sem necessidade de intervenção.' },
  { metric_id: 'vermilion_height_total', severity: 'moderate', size: 'short',
    template_pt: 'Vermelhão labial mede {value}, magnitude moderada.' },
  { metric_id: 'vermilion_height_total', severity: 'moderate', size: 'long',
    template_pt: 'A altura total do vermelhão labial mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Design labial com gloss central pode ajustar a percepção de volume.' },
  { metric_id: 'vermilion_height_total', severity: 'strong', size: 'short',
    template_pt: 'Vermelhão labial mede {value}, magnitude considerável.' },
  { metric_id: 'vermilion_height_total', severity: 'strong', size: 'long',
    template_pt: 'A altura total do vermelhão labial mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica para preenchimento esclarece opções pertinentes conforme objetivo individual.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // JAW (6 metrics)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── chin_height_ratio ──
  { metric_id: 'chin_height_ratio', severity: 'mild', size: 'short',
    template_pt: 'Altura do queixo mede {value}, leve divergência.' },
  { metric_id: 'chin_height_ratio', severity: 'mild', size: 'long',
    template_pt: 'A altura do queixo mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal} de Powell & Humphreys 1984). Variação leve dentro do espectro habitual.' },
  { metric_id: 'chin_height_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Altura do queixo mede {value}, magnitude moderada.' },
  { metric_id: 'chin_height_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A altura do queixo mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Estilo de barba ou contouring submentoniano pode ajustar a proporção visual.' },
  { metric_id: 'chin_height_ratio', severity: 'strong', size: 'short',
    template_pt: 'Altura do queixo mede {value}, magnitude considerável.' },
  { metric_id: 'chin_height_ratio', severity: 'strong', size: 'long',
    template_pt: 'A altura do queixo mede {value} unidades intercanthais ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação ortodôntica ou cirúrgica especializada esclarece opções estruturais pertinentes ao caso.' },

  // ── gonial_angle_asymmetry ──
  { metric_id: 'gonial_angle_asymmetry', severity: 'mild', size: 'short',
    template_pt: 'Ângulos goniais com diferença leve de {value} graus.' },
  { metric_id: 'gonial_angle_asymmetry', severity: 'mild', size: 'long',
    template_pt: 'Os ângulos goniais apresentam diferença leve de {value} graus entre os lados. Variação discreta dentro do espectro populacional, sem implicação visual relevante.' },
  { metric_id: 'gonial_angle_asymmetry', severity: 'moderate', size: 'short',
    template_pt: 'Ângulos goniais com diferença de {value} graus, moderada.' },
  { metric_id: 'gonial_angle_asymmetry', severity: 'moderate', size: 'long',
    template_pt: 'Os ângulos goniais apresentam diferença de {value} graus entre os lados, em magnitude moderada. Padrões de mastigação bilateral consciente podem contribuir para reequilíbrio muscular gradual.' },
  { metric_id: 'gonial_angle_asymmetry', severity: 'strong', size: 'short',
    template_pt: 'Ângulos goniais com diferença considerável de {value} graus.' },
  { metric_id: 'gonial_angle_asymmetry', severity: 'strong', size: 'long',
    template_pt: 'Os ângulos goniais apresentam diferença considerável de {value} graus entre os lados. Avaliação fisioterapêutica especializada em disfunção temporomandibular esclarece componente muscular vs estrutural.' },

  // ── gonial_angle_l ──
  { metric_id: 'gonial_angle_l', severity: 'mild', size: 'short',
    template_pt: 'Ângulo gonial esquerdo mede {value} graus, leve divergência.' },
  { metric_id: 'gonial_angle_l', severity: 'mild', size: 'long',
    template_pt: 'O ângulo gonial esquerdo mede {value} graus, com {deviation_pct}% de divergência da referência {ideal}. Variação leve dentro do espectro habitual em análise mandibular frontal.' },
  { metric_id: 'gonial_angle_l', severity: 'moderate', size: 'short',
    template_pt: 'Ângulo gonial esquerdo mede {value} graus, moderada.' },
  { metric_id: 'gonial_angle_l', severity: 'moderate', size: 'long',
    template_pt: 'O ângulo gonial esquerdo mede {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Estilo de barba (em homens) pode ajustar a percepção do contorno mandibular.' },
  { metric_id: 'gonial_angle_l', severity: 'strong', size: 'short',
    template_pt: 'Ângulo gonial esquerdo mede {value} graus, considerável.' },
  { metric_id: 'gonial_angle_l', severity: 'strong', size: 'long',
    template_pt: 'O ângulo gonial esquerdo mede {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação fisioterapêutica para disfunção temporomandibular pode ser indicada para esclarecer componente muscular.' },

  // ── gonial_angle_r ──
  { metric_id: 'gonial_angle_r', severity: 'mild', size: 'short',
    template_pt: 'Ângulo gonial direito mede {value} graus, leve divergência.' },
  { metric_id: 'gonial_angle_r', severity: 'mild', size: 'long',
    template_pt: 'O ângulo gonial direito mede {value} graus, com {deviation_pct}% de divergência da referência {ideal}. Variação leve dentro do espectro habitual em análise mandibular frontal padrão.' },
  { metric_id: 'gonial_angle_r', severity: 'moderate', size: 'short',
    template_pt: 'Ângulo gonial direito mede {value} graus, moderada.' },
  { metric_id: 'gonial_angle_r', severity: 'moderate', size: 'long',
    template_pt: 'O ângulo gonial direito mede {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Estilo de barba pode ajustar a percepção do contorno mandibular direito.' },
  { metric_id: 'gonial_angle_r', severity: 'strong', size: 'short',
    template_pt: 'Ângulo gonial direito mede {value} graus, considerável.' },
  { metric_id: 'gonial_angle_r', severity: 'strong', size: 'long',
    template_pt: 'O ângulo gonial direito mede {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação fisioterapêutica para disfunção temporomandibular pode ser indicada para esclarecer origem.' },

  // ── jaw_width_ratio ──
  { metric_id: 'jaw_width_ratio', severity: 'mild', size: 'short',
    template_pt: 'Largura mandibular relativa mede {value}, leve divergência.' },
  { metric_id: 'jaw_width_ratio', severity: 'mild', size: 'long',
    template_pt: 'A largura mandibular relativa mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual em análise de formato facial.' },
  { metric_id: 'jaw_width_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Largura mandibular mede {value}, magnitude moderada.' },
  { metric_id: 'jaw_width_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A largura mandibular relativa mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Estilo de barba e contouring podem ajustar a proporção percebida do contorno.' },
  { metric_id: 'jaw_width_ratio', severity: 'strong', size: 'short',
    template_pt: 'Largura mandibular mede {value}, magnitude considerável.' },
  { metric_id: 'jaw_width_ratio', severity: 'strong', size: 'long',
    template_pt: 'A largura mandibular relativa mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Pode justificar avaliação ortodôntica ou cirúrgica especializada para análise estrutural.' },

  // ── mandibular_plane_angle ──
  { metric_id: 'mandibular_plane_angle', severity: 'mild', size: 'short',
    template_pt: 'Plano mandibular com inclinação de {value} graus, leve.' },
  { metric_id: 'mandibular_plane_angle', severity: 'mild', size: 'long',
    template_pt: 'O plano mandibular apresenta inclinação de {value} graus, com {deviation_pct}% de divergência da referência {ideal}. Variação leve dentro do espectro habitual em análise mandibular frontal padrão.' },
  { metric_id: 'mandibular_plane_angle', severity: 'moderate', size: 'short',
    template_pt: 'Plano mandibular com inclinação de {value} graus, moderada.' },
  { metric_id: 'mandibular_plane_angle', severity: 'moderate', size: 'long',
    template_pt: 'O plano mandibular apresenta inclinação de {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Estilo de barba (em homens) pode ajustar a percepção do contorno.' },
  { metric_id: 'mandibular_plane_angle', severity: 'strong', size: 'short',
    template_pt: 'Plano mandibular com inclinação considerável de {value} graus.' },
  { metric_id: 'mandibular_plane_angle', severity: 'strong', size: 'long',
    template_pt: 'O plano mandibular apresenta inclinação de {value} graus ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Pode justificar avaliação ortodôntica com cefalometria detalhada do componente esquelético.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHEEKBONES (5 metrics)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── cheekbone_to_jaw_ratio ──
  { metric_id: 'cheekbone_to_jaw_ratio', severity: 'mild', size: 'short',
    template_pt: 'Largura malar/mandibular mede {value}, leve divergência.' },
  { metric_id: 'cheekbone_to_jaw_ratio', severity: 'mild', size: 'long',
    template_pt: 'A relação entre largura malar e mandibular mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual em análise de formato facial.' },
  { metric_id: 'cheekbone_to_jaw_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Largura malar/mandibular mede {value}, magnitude moderada.' },
  { metric_id: 'cheekbone_to_jaw_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A relação entre largura malar e mandibular mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Corte de cabelo e contouring podem equilibrar visualmente o formato facial.' },
  { metric_id: 'cheekbone_to_jaw_ratio', severity: 'strong', size: 'short',
    template_pt: 'Largura malar/mandibular mede {value}, magnitude considerável.' },
  { metric_id: 'cheekbone_to_jaw_ratio', severity: 'strong', size: 'long',
    template_pt: 'A relação entre largura malar e mandibular mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos combinados de styling capilar, barba (em homens) e contouring podem ajustar significativamente a percepção do formato.' },

  // ── malar_projection_index ──
  { metric_id: 'malar_projection_index', severity: 'mild', size: 'short',
    template_pt: 'Projeção malar mede {value}, leve divergência.' },
  { metric_id: 'malar_projection_index', severity: 'mild', size: 'long',
    template_pt: 'O índice de projeção malar mede {value} ({deviation_pct}% de divergência da referência {ideal} de Bashour 2006). Variação leve dentro do espectro habitual em análise de mídface.' },
  { metric_id: 'malar_projection_index', severity: 'moderate', size: 'short',
    template_pt: 'Projeção malar mede {value}, magnitude moderada.' },
  { metric_id: 'malar_projection_index', severity: 'moderate', size: 'long',
    template_pt: 'O índice de projeção malar mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Iluminador e contouring nas maçãs do rosto realçam visualmente a projeção percebida.' },
  { metric_id: 'malar_projection_index', severity: 'strong', size: 'short',
    template_pt: 'Projeção malar mede {value}, magnitude considerável.' },
  { metric_id: 'malar_projection_index', severity: 'strong', size: 'long',
    template_pt: 'O índice de projeção malar mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica para opções de bioestimuladores ou preenchimento pode ser cogitada conforme objetivo.' },

  // ── midface_height_ratio ──
  { metric_id: 'midface_height_ratio', severity: 'mild', size: 'short',
    template_pt: 'Altura do mídface mede {value}, leve divergência.' },
  { metric_id: 'midface_height_ratio', severity: 'mild', size: 'long',
    template_pt: 'A altura do mídface mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual em análise de proporção vertical do mídface.' },
  { metric_id: 'midface_height_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Altura do mídface mede {value}, magnitude moderada.' },
  { metric_id: 'midface_height_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A altura do mídface mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Recursos de styling e contouring podem ajustar a percepção da proporção vertical.' },
  { metric_id: 'midface_height_ratio', severity: 'strong', size: 'short',
    template_pt: 'Altura do mídface mede {value}, magnitude considerável.' },
  { metric_id: 'midface_height_ratio', severity: 'strong', size: 'long',
    template_pt: 'A altura do mídface mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Pode justificar avaliação ortodôntica para análise cefalométrica detalhada do componente esquelético.' },

  // ── submalar_hollow_index ──
  { metric_id: 'submalar_hollow_index', severity: 'mild', size: 'short',
    template_pt: 'Depressão submalar mede {value}, leve divergência.' },
  { metric_id: 'submalar_hollow_index', severity: 'mild', size: 'long',
    template_pt: 'O índice de depressão submalar mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual em análise da região zigomática.' },
  { metric_id: 'submalar_hollow_index', severity: 'moderate', size: 'short',
    template_pt: 'Depressão submalar mede {value}, magnitude moderada.' },
  { metric_id: 'submalar_hollow_index', severity: 'moderate', size: 'long',
    template_pt: 'O índice de depressão submalar mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Exercícios de tonificação do mídface podem contribuir conforme rotina individual.' },
  { metric_id: 'submalar_hollow_index', severity: 'strong', size: 'short',
    template_pt: 'Depressão submalar mede {value}, magnitude considerável.' },
  { metric_id: 'submalar_hollow_index', severity: 'strong', size: 'long',
    template_pt: 'O índice de depressão submalar mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação dermatológica para opções de preenchimento submalar pode ser cogitada conforme objetivo.' },

  // ── zygomatic_width_ratio ──
  { metric_id: 'zygomatic_width_ratio', severity: 'mild', size: 'short',
    template_pt: 'Largura zigomática mede {value}, leve divergência.' },
  { metric_id: 'zygomatic_width_ratio', severity: 'mild', size: 'long',
    template_pt: 'A largura zigomática mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual em análise de proporção transversal do mídface.' },
  { metric_id: 'zygomatic_width_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Largura zigomática mede {value}, magnitude moderada.' },
  { metric_id: 'zygomatic_width_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A largura zigomática mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Corte de cabelo e contouring podem equilibrar visualmente as proporções da metade superior da face.' },
  { metric_id: 'zygomatic_width_ratio', severity: 'strong', size: 'short',
    template_pt: 'Largura zigomática mede {value}, magnitude considerável.' },
  { metric_id: 'zygomatic_width_ratio', severity: 'strong', size: 'long',
    template_pt: 'A largura zigomática mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Volume capilar lateral, contouring e estilo de barba (em homens) podem ajustar a proporção visual percebida.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // FOREHEAD (3 metrics)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── forehead_height_ratio ──
  { metric_id: 'forehead_height_ratio', severity: 'mild', size: 'short',
    template_pt: 'Altura da testa mede {value}, leve divergência.' },
  { metric_id: 'forehead_height_ratio', severity: 'mild', size: 'long',
    template_pt: 'A altura da testa mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual em análise de proporção vertical do terço superior.' },
  { metric_id: 'forehead_height_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Altura da testa mede {value}, magnitude moderada.' },
  { metric_id: 'forehead_height_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A altura da testa mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Corte de cabelo com franja pode equilibrar visualmente a proporção do terço superior.' },
  { metric_id: 'forehead_height_ratio', severity: 'strong', size: 'short',
    template_pt: 'Altura da testa mede {value}, magnitude considerável.' },
  { metric_id: 'forehead_height_ratio', severity: 'strong', size: 'long',
    template_pt: 'A altura da testa mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Estilo capilar com franja ou volume frontal pode ajustar significativamente a percepção da proporção.' },

  // ── forehead_width_ratio ──
  { metric_id: 'forehead_width_ratio', severity: 'mild', size: 'short',
    template_pt: 'Largura da testa mede {value}, leve divergência.' },
  { metric_id: 'forehead_width_ratio', severity: 'mild', size: 'long',
    template_pt: 'A largura da testa mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual em análise de proporção transversal frontal.' },
  { metric_id: 'forehead_width_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Largura da testa mede {value}, magnitude moderada.' },
  { metric_id: 'forehead_width_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A largura da testa mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Volume capilar lateral pode ajustar a proporção visual percebida.' },
  { metric_id: 'forehead_width_ratio', severity: 'strong', size: 'short',
    template_pt: 'Largura da testa mede {value}, magnitude considerável.' },
  { metric_id: 'forehead_width_ratio', severity: 'strong', size: 'long',
    template_pt: 'A largura da testa mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos de styling como volume nas têmporas e contouring frontal podem equilibrar a proporção visual.' },

  // ── temporal_width_ratio ──
  { metric_id: 'temporal_width_ratio', severity: 'mild', size: 'short',
    template_pt: 'Largura temporal mede {value}, leve divergência.' },
  { metric_id: 'temporal_width_ratio', severity: 'mild', size: 'long',
    template_pt: 'A largura temporal mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve dentro do espectro habitual em análise da região temporal frontal.' },
  { metric_id: 'temporal_width_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Largura temporal mede {value}, magnitude moderada.' },
  { metric_id: 'temporal_width_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A largura temporal mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Volume capilar lateral nas têmporas pode equilibrar visualmente as proporções.' },
  { metric_id: 'temporal_width_ratio', severity: 'strong', size: 'short',
    template_pt: 'Largura temporal mede {value}, magnitude considerável.' },
  { metric_id: 'temporal_width_ratio', severity: 'strong', size: 'long',
    template_pt: 'A largura temporal mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Recursos de styling capilar com volume controlado nas têmporas podem ajustar significativamente a proporção visual.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL (2 metrics)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── face_height_to_width_ratio ──
  { metric_id: 'face_height_to_width_ratio', severity: 'mild', size: 'short',
    template_pt: 'Relação altura/largura facial mede {value}, leve divergência.' },
  { metric_id: 'face_height_to_width_ratio', severity: 'mild', size: 'long',
    template_pt: 'A relação altura/largura facial mede {value} ({deviation_pct}% de divergência da referência {ideal}). Variação leve no formato global, dentro do espectro habitual em análise de proporção facial.' },
  { metric_id: 'face_height_to_width_ratio', severity: 'moderate', size: 'short',
    template_pt: 'Relação altura/largura facial mede {value}, magnitude moderada.' },
  { metric_id: 'face_height_to_width_ratio', severity: 'moderate', size: 'long',
    template_pt: 'A relação altura/largura facial mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Corte de cabelo personalizado para o formato pode equilibrar visualmente as proporções globais.' },
  { metric_id: 'face_height_to_width_ratio', severity: 'strong', size: 'short',
    template_pt: 'Relação altura/largura facial mede {value}, magnitude considerável.' },
  { metric_id: 'face_height_to_width_ratio', severity: 'strong', size: 'long',
    template_pt: 'A relação altura/largura facial mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Cabeleireiro especializado em análise de formato facial pode personalizar recursos de styling de alto impacto.' },

  // ── total_facial_convexity ──
  { metric_id: 'total_facial_convexity', severity: 'mild', size: 'short',
    template_pt: 'Convexidade facial mede {value}, leve divergência.' },
  { metric_id: 'total_facial_convexity', severity: 'mild', size: 'long',
    template_pt: 'O índice de convexidade facial total mede {value} ({deviation_pct}% de divergência da referência {ideal} de Sarver & Jacobson 2014). Variação leve dentro do espectro habitual em análise de perfil global.' },
  { metric_id: 'total_facial_convexity', severity: 'moderate', size: 'short',
    template_pt: 'Convexidade facial mede {value}, magnitude moderada.' },
  { metric_id: 'total_facial_convexity', severity: 'moderate', size: 'long',
    template_pt: 'O índice de convexidade facial total mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude moderada. Pode envolver componente postural — fisioterapia cervical pode contribuir conforme avaliação individual.' },
  { metric_id: 'total_facial_convexity', severity: 'strong', size: 'short',
    template_pt: 'Convexidade facial mede {value}, magnitude considerável.' },
  { metric_id: 'total_facial_convexity', severity: 'strong', size: 'long',
    template_pt: 'O índice de convexidade facial total mede {value} ({deviation_pct}% de divergência da referência {ideal}), em magnitude considerável. Avaliação ortodôntica com cefalometria esclarece componente esquelético; fisioterapia postural avalia componente cervical.' },
];

export class M42bDiagnosticTemplatesShortLong1746000250000 implements MigrationInterface {
  name = 'M42bDiagnosticTemplatesShortLong1746000250000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const row of TEMPLATES) {
      const placeholders = extractPlaceholders(row.template_pt);
      await queryRunner.query(
        `INSERT INTO diagnostic_template (
           version, metric_id, severity, direction, size,
           template_pt, placeholders_used
         ) VALUES (
           $1, $2, $3::severity_5_enum, $4, $5,
           $6, $7::jsonb
         ) ON CONFLICT (version, metric_id, severity, direction, size) DO NOTHING`,
        [
          VERSION,
          row.metric_id,
          row.severity,
          DIRECTION,
          row.size,
          row.template_pt,
          JSON.stringify(placeholders),
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const row of TEMPLATES) {
      await queryRunner.query(
        `DELETE FROM diagnostic_template
         WHERE version = $1 AND metric_id = $2 AND severity = $3::severity_5_enum
           AND direction = $4 AND size = $5`,
        [VERSION, row.metric_id, row.severity, DIRECTION, row.size],
      );
    }
  }
}
