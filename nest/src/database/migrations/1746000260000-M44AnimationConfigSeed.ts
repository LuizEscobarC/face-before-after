/**
 * PR-D — Seed de animation_config para os exercícios faciais visíveis.
 *
 * Curadoria anatômica seguindo a tabela do plano
 * `.claude/plans/fa-a-mais-uma-revis-o-quirky-hopper.md` §"Mapeamento exigido":
 *
 *   família           → primitives típicas              → heat regions
 *   sobrancelha       → brow_lift_*, brow_furrow         → frontalis, corrugator
 *   olho              → eye_squeeze_*, eye_track_*       → orbicularis_oculi_l/r
 *   boca              → lip_pucker, lip_seal, lip_*      → orbicularis_oris, zygomaticus_l/r
 *   língua (raio-x)   → tongue_*                         → (show_xray=true)
 *   mandíbula         → jaw_clench, jaw_*                → masseter_l/r, temporalis
 *   bochecha          → cheek_puff_*                     → buccinator_l/r
 *   pescoço           → neck_chin_tuck, neck_*           → scm_l/r, suboccipital, platysma
 *
 * Exercícios cuja "ação" é manual / postural-corporal / massagem (drenagem
 * linfática, gua sha, peanut roller, wall slides, etc.) ficam com
 * animation_config NULL nesta entrega — não há movimento facial visível
 * para ilustrar e o plano (§"Itens que não ganham animação") os exclui
 * explicitamente. Podem receber `static_*` num futuro PR.
 *
 * Down: anula apenas os ids tocados aqui.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';
import type { AnimationConfig } from '../../modules/diagnosis/domain/types/recommendation.types.js';

type SeedRow = { id: string; cfg: AnimationConfig };

const SEED: SeedRow[] = [
  // ─── SOBRANCELHA / FRONTAL ────────────────────────────────────────────────
  { id: 'exercise-brow-lift-isometric', cfg: { schema_version: 1, primitives: [{ id: 'brow_lift_both', intensity: 0.9 }], duration_ms: 1500, hold_ms: 5000, repeat: 'infinite', heat_regions: [{ region: 'frontalis', pulse: true }], caption_pt: 'Eleve as sobrancelhas contra resistência dos dedos — mantenha isométrico.' } },
  { id: 'exercise-frontalis-conscious-relaxation', cfg: { schema_version: 1, primitives: [{ id: 'brow_relax', intensity: 1 }], duration_ms: 3000, repeat: 'infinite', heat_regions: [{ region: 'frontalis', pulse: false }], caption_pt: 'Solte a testa conscientemente — observe sem corrigir.' } },
  { id: 'routine-lt-31-nasalis-transversus-activation', cfg: { schema_version: 1, primitives: [{ id: 'brow_furrow', intensity: 0.7 }], duration_ms: 1200, hold_ms: 1000, repeat: 'infinite', heat_regions: [{ region: 'corrugator', pulse: true }], caption_pt: 'Enrugue o nariz como se cheirasse algo forte — sinta o nasal transverso.' } },
  { id: 'routine-lt-35-frontalis-elastic-band', cfg: { schema_version: 1, primitives: [{ id: 'brow_lift_both', intensity: 1 }], duration_ms: 1500, hold_ms: 6000, repeat: 'infinite', heat_regions: [{ region: 'frontalis', pulse: true }], caption_pt: 'Levante as sobrancelhas contra a faixa elástica — sustente.' } },
  { id: 'routine-lt-36-reverse-squinting', cfg: { schema_version: 1, primitives: [{ id: 'eye_wide_open', intensity: 1 }], duration_ms: 1200, hold_ms: 3000, repeat: 'infinite', heat_regions: [{ region: 'frontalis', pulse: true }], caption_pt: 'Arregale os olhos focando um ponto fixo — sustente sem piscar.' } },

  // ─── OLHO ─────────────────────────────────────────────────────────────────
  { id: 'exercise-eye-tracking-pencil-pushups', cfg: { schema_version: 1, primitives: [{ id: 'eye_track_horizontal', intensity: 1 }], duration_ms: 3000, repeat: 'reverse', caption_pt: 'Acompanhe a ponta do lápis se aproximando lentamente do nariz.' } },
  { id: 'exercise-orbicularis-oculi-isometric', cfg: { schema_version: 1, primitives: [{ id: 'eye_squeeze_both', intensity: 0.8 }], duration_ms: 1500, hold_ms: 3000, repeat: 'infinite', heat_regions: [{ region: 'orbicularis_oculi_l', pulse: true }, { region: 'orbicularis_oculi_r', pulse: true }], caption_pt: 'Aperte os olhos com força moderada — sustente sem franzir a testa.' } },
  { id: 'routine-lt-37-saccadic-eye-movements', cfg: { schema_version: 1, primitives: [{ id: 'eye_track_horizontal', intensity: 1 }], duration_ms: 800, repeat: 'reverse', caption_pt: 'Movimentos oculares rápidos entre dois pontos — saltos sacádicos.' } },
  { id: 'routine-lt-38-pendulum-tracking', cfg: { schema_version: 1, primitives: [{ id: 'eye_track_horizontal', intensity: 0.8 }], duration_ms: 4000, repeat: 'reverse', caption_pt: 'Acompanhe um pêndulo lateralmente — movimento suave e contínuo.' } },
  { id: 'routine-lt-39-thumb-horizon-shift', cfg: { schema_version: 1, primitives: [{ id: 'eye_track_horizontal', intensity: 0.9 }], duration_ms: 2500, repeat: 'reverse', caption_pt: 'Foque o polegar perto, depois o horizonte — alterne ritmicamente.' } },
  { id: 'routine-lt-40-extreme-360-rotation-closed', cfg: { schema_version: 1, primitives: [{ id: 'eye_track_figure8', intensity: 1 }], duration_ms: 4000, repeat: 'infinite', heat_regions: [{ region: 'orbicularis_oculi_l', pulse: false }, { region: 'orbicularis_oculi_r', pulse: false }], caption_pt: 'Rotação ocular 360° de olhos fechados — amplitude máxima.' } },
  { id: 'routine-lt-41-lower-eyelid-isometric', cfg: { schema_version: 1, primitives: [{ id: 'eye_squeeze_lower', intensity: 0.8 }], duration_ms: 1500, hold_ms: 4000, repeat: 'infinite', heat_regions: [{ region: 'orbicularis_oculi_l', pulse: true }, { region: 'orbicularis_oculi_r', pulse: true }], caption_pt: 'Ative só a pálpebra inferior — pálpebra superior parada.' } },
  { id: 'routine-lt-42-asymmetric-eyelid-blink', cfg: { schema_version: 1, primitives: [{ id: 'eye_blink_asymmetric', intensity: 1 }], duration_ms: 3000, repeat: 'infinite', caption_pt: 'Piscadela super lenta de um olho só — controle a assimetria.' } },
  { id: 'routine-lt-29-temple-isometric-blink', cfg: { schema_version: 1, primitives: [{ id: 'eye_squeeze_both', intensity: 0.6 }, { id: 'brow_furrow', intensity: 0.4 }], duration_ms: 1800, hold_ms: 2500, repeat: 'infinite', heat_regions: [{ region: 'temporalis', pulse: true }], caption_pt: 'Puxe a pele das têmporas para trás-cima e pisque com força.' } },

  // ─── BOCA / LÁBIOS ────────────────────────────────────────────────────────
  { id: 'exercise-cheek-lift-smile-hold', cfg: { schema_version: 1, primitives: [{ id: 'lip_wide_smile', intensity: 0.9 }, { id: 'cheek_lift_smile', intensity: 0.8 }], duration_ms: 2000, hold_ms: 6000, repeat: 'infinite', heat_regions: [{ region: 'zygomaticus_l', pulse: true }, { region: 'zygomaticus_r', pulse: true }], caption_pt: 'Sorriso fechado sustentado — sinta as maçãs do rosto subirem.' } },
  { id: 'exercise-mouth-corner-symmetry-drill', cfg: { schema_version: 1, primitives: [{ id: 'lip_corner_lift_left', intensity: 0.8, delay_ms: 0 }, { id: 'lip_corner_lift_right', intensity: 0.8, delay_ms: 1000 }], duration_ms: 2000, repeat: 'infinite', heat_regions: [{ region: 'zygomaticus_l', pulse: true }, { region: 'zygomaticus_r', pulse: true }], caption_pt: 'Eleve um canto da boca de cada vez — espelho à frente.' } },
  { id: 'exercise-orbicularis-oris-pursing', cfg: { schema_version: 1, primitives: [{ id: 'lip_pucker', intensity: 1 }], duration_ms: 1500, hold_ms: 5000, repeat: 'infinite', heat_regions: [{ region: 'orbicularis_oris', pulse: true }], caption_pt: 'Beicinho sustentado — lábios projetados como para um beijo.' } },
  { id: 'exercise-phoneme-mn-ng-training', cfg: { schema_version: 1, primitives: [{ id: 'lip_seal', intensity: 0.7 }], duration_ms: 1500, repeat: 'infinite', heat_regions: [{ region: 'orbicularis_oris', pulse: true }], caption_pt: 'Repita "M-N-NG" alongando cada som — lábios selados em M.' } },
  { id: 'routine-lt-02-horizontal-pencil-lips', cfg: { schema_version: 1, primitives: [{ id: 'lip_seal', intensity: 0.8 }], duration_ms: 2000, hold_ms: 8000, repeat: 'infinite', heat_regions: [{ region: 'orbicularis_oris', pulse: true }], caption_pt: 'Segure um lápis horizontal apenas com os lábios — sem dentes.' } },
  { id: 'routine-lt-13-upper-lip-resistance', cfg: { schema_version: 1, primitives: [{ id: 'lip_resistance_pull', intensity: 0.9 }], duration_ms: 1500, hold_ms: 4000, repeat: 'infinite', heat_regions: [{ region: 'orbicularis_oris', pulse: true }], caption_pt: 'Puxe o lábio superior para baixo contra resistência manual.' } },
  { id: 'routine-lt-26-dao-isometric', cfg: { schema_version: 1, primitives: [{ id: 'lip_corner_lift_left', intensity: 0.3 }, { id: 'lip_corner_lift_right', intensity: 0.3 }], duration_ms: 1500, hold_ms: 4000, repeat: 'infinite', heat_regions: [{ region: 'mentalis', pulse: true }], caption_pt: 'Force os cantos da boca para baixo — "sorriso triste" isométrico.' } },
  { id: 'routine-lt-27-risorius-tension', cfg: { schema_version: 1, primitives: [{ id: 'lip_wide_smile', intensity: 1 }], duration_ms: 1500, hold_ms: 5000, repeat: 'infinite', heat_regions: [{ region: 'zygomaticus_l', pulse: true }, { region: 'zygomaticus_r', pulse: true }], caption_pt: 'Sorriso esticado horizontal sem mostrar dentes — tensão no risório.' } },
  { id: 'routine-lt-30-disgust-lip-elevation', cfg: { schema_version: 1, primitives: [{ id: 'lip_corner_lift_left', intensity: 0.9 }], duration_ms: 1500, hold_ms: 3000, repeat: 'infinite', heat_regions: [{ region: 'zygomaticus_l', pulse: true }], caption_pt: 'Levante apenas um lábio superior — face de "nojo" unilateral.' } },
  { id: 'routine-lt-66-lip-corner-static-stretch', cfg: { schema_version: 1, primitives: [{ id: 'lip_wide_smile', intensity: 0.7 }], duration_ms: 2000, hold_ms: 7000, repeat: 'infinite', heat_regions: [{ region: 'orbicularis_oris', pulse: false }], caption_pt: 'Alongue lentamente as comissuras labiais para fora.' } },
  { id: 'exercise-water-suction-control', cfg: { schema_version: 1, primitives: [{ id: 'lip_pucker', intensity: 0.8 }], duration_ms: 2500, repeat: 'infinite', heat_regions: [{ region: 'orbicularis_oris', pulse: true }], caption_pt: 'Sucção lenta e controlada com canudo — mantenha lábios firmes.' } },

  // ─── LÍNGUA (show_xray=true) ──────────────────────────────────────────────
  { id: 'exercise-cave-suction-hold', cfg: { schema_version: 1, primitives: [{ id: 'tongue_palate_press', intensity: 1 }], duration_ms: 2000, hold_ms: 8000, repeat: 'infinite', show_xray: true, caption_pt: 'Vácuo intraoral — toda a língua aderida ao palato, mandíbula relaxada.' } },
  { id: 'exercise-swallow-sweep', cfg: { schema_version: 1, primitives: [{ id: 'tongue_sweep_circular', intensity: 0.8 }], duration_ms: 3000, repeat: 'infinite', show_xray: true, caption_pt: 'Engula lentamente com a língua varrendo o palato anterior.' } },
  { id: 'exercise-tongue-chewing', cfg: { schema_version: 1, primitives: [{ id: 'tongue_palate_press', intensity: 0.7 }], duration_ms: 1500, repeat: 'infinite', show_xray: true, caption_pt: '"Mastigue" um chiclete imaginário pressionando a língua no palato.' } },
  { id: 'exercise-tongue-click', cfg: { schema_version: 1, primitives: [{ id: 'tongue_click', intensity: 1 }], duration_ms: 1000, repeat: 'infinite', show_xray: true, caption_pt: 'Estale a língua contra o palato — som forte e seco.' } },
  { id: 'exercise-tongue-posture-mewing', cfg: { schema_version: 1, primitives: [{ id: 'tongue_palate_press', intensity: 0.9 }], duration_ms: 3000, hold_ms: 10000, repeat: 'infinite', show_xray: true, caption_pt: 'Toda a língua pressionando o palato — postura sustentada ao longo do dia.' } },
  { id: 'exercise-tongue-roof-press', cfg: { schema_version: 1, primitives: [{ id: 'tongue_palate_press', intensity: 1 }], duration_ms: 1500, hold_ms: 5000, repeat: 'infinite', show_xray: true, caption_pt: 'Pressione a língua no palato com força máxima — isometria.' } },
  { id: 'exercise-tongue-sweep', cfg: { schema_version: 1, primitives: [{ id: 'tongue_sweep_circular', intensity: 1 }], duration_ms: 2500, repeat: 'infinite', show_xray: true, caption_pt: 'Varra a língua pelo palato em círculos — limpeza completa.' } },
  { id: 'routine-lt-01-tongue-segmental-click', cfg: { schema_version: 1, primitives: [{ id: 'tongue_click', intensity: 0.9 }], duration_ms: 1200, repeat: 'infinite', show_xray: true, caption_pt: 'Estalo segmentar — ápice, médio, base da língua em sequência.' } },
  { id: 'routine-lt-03-pastille-palate-suction', cfg: { schema_version: 1, primitives: [{ id: 'tongue_palate_press', intensity: 0.8 }], duration_ms: 3000, hold_ms: 8000, repeat: 'infinite', show_xray: true, caption_pt: 'Sustente uma pastilha contra o palato — não mastigue.' } },
  { id: 'routine-lt-04-tongue-cheek-resistance', cfg: { schema_version: 1, primitives: [{ id: 'tongue_lateral_left', intensity: 0.9 }], duration_ms: 1500, hold_ms: 3000, repeat: 'infinite', show_xray: true, heat_regions: [{ region: 'buccinator_l', pulse: true }], caption_pt: 'Empurre a língua contra a bochecha — resista por fora com o dedo.' } },
  { id: 'routine-lt-05-tongue-vestibular-sweep', cfg: { schema_version: 1, primitives: [{ id: 'tongue_sweep_circular', intensity: 0.8 }], duration_ms: 4000, repeat: 'infinite', show_xray: true, caption_pt: 'Varra os dentes pela face vestibular — 360° lento.' } },
  { id: 'routine-lt-06-tongue-extra-oral-stretch', cfg: { schema_version: 1, primitives: [{ id: 'tongue_extra_oral_down', intensity: 1 }], duration_ms: 2000, hold_ms: 4000, repeat: 'infinite', show_xray: true, caption_pt: 'Língua para fora e para baixo — alongamento extra-oral máximo.' } },
  { id: 'routine-lt-07-horse-click-floor', cfg: { schema_version: 1, primitives: [{ id: 'tongue_click', intensity: 1 }], duration_ms: 800, repeat: 'infinite', show_xray: true, caption_pt: 'Estalo "cavalinho" forte — ative o assoalho da boca.' } },
  { id: 'routine-lt-08-tongue-tip-lower-teeth', cfg: { schema_version: 1, primitives: [{ id: 'tongue_palate_press', intensity: 0.6 }], duration_ms: 1500, hold_ms: 4000, repeat: 'infinite', show_xray: true, caption_pt: 'Ápice da língua pressionando dentes inferiores — isometria.' } },
  { id: 'routine-lt-09-tongue-base-elevation', cfg: { schema_version: 1, primitives: [{ id: 'tongue_palate_press', intensity: 0.7 }], duration_ms: 2000, hold_ms: 3000, repeat: 'infinite', show_xray: true, caption_pt: 'Boca aberta — eleve a base da língua sem fechar a mandíbula.' } },
  { id: 'routine-lt-10-fake-smile-swallow-isolation', cfg: { schema_version: 1, primitives: [{ id: 'lip_wide_smile', intensity: 0.7 }, { id: 'tongue_sweep_circular', intensity: 0.6 }], duration_ms: 3000, repeat: 'infinite', show_xray: true, caption_pt: 'Engula com sorriso forçado — isola o trabalho da língua.' } },
  { id: 'routine-lt-64-atypical-swallow-inhibition', cfg: { schema_version: 1, primitives: [{ id: 'tongue_palate_press', intensity: 0.8 }], duration_ms: 2500, hold_ms: 2000, repeat: 'infinite', show_xray: true, caption_pt: 'Antes de engolir, posicione a língua no palato — inibe o reflexo atípico.' } },

  // ─── MANDÍBULA ────────────────────────────────────────────────────────────
  { id: 'exercise-mandibular-decompression', cfg: { schema_version: 1, primitives: [{ id: 'jaw_open_wide', intensity: 0.5 }], duration_ms: 3000, hold_ms: 5000, repeat: 'infinite', heat_regions: [{ region: 'masseter_l', pulse: false }, { region: 'masseter_r', pulse: false }], caption_pt: 'Abertura passiva — deixe a mandíbula cair pelo próprio peso.' } },
  { id: 'exercise-mandibular-isometric-resistance', cfg: { schema_version: 1, primitives: [{ id: 'jaw_clench', intensity: 0.7 }], duration_ms: 1500, hold_ms: 5000, repeat: 'infinite', heat_regions: [{ region: 'masseter_l', pulse: true }, { region: 'masseter_r', pulse: true }], caption_pt: 'Cerre os dentes contra resistência manual no queixo — isometria.' } },
  { id: 'exercise-mandibular-opening-resistance', cfg: { schema_version: 1, primitives: [{ id: 'jaw_open_wide', intensity: 0.7 }], duration_ms: 1800, hold_ms: 3000, repeat: 'infinite', heat_regions: [{ region: 'masseter_l', pulse: true }, { region: 'masseter_r', pulse: true }], caption_pt: 'Abra a mandíbula contra resistência sob o queixo.' } },
  { id: 'exercise-masseter-isometric-clench', cfg: { schema_version: 1, primitives: [{ id: 'jaw_clench', intensity: 0.7 }], duration_ms: 1500, hold_ms: 5000, repeat: 'infinite', heat_regions: [{ region: 'masseter_l', pulse: true }, { region: 'masseter_r', pulse: true }, { region: 'temporalis', pulse: false }], caption_pt: 'Cerre os dentes com firmeza moderada — sinta a lateral da mandíbula tensionar.' } },
  { id: 'exercise-jaw-side-symmetrize', cfg: { schema_version: 1, primitives: [{ id: 'jaw_lateral_left', intensity: 0.6 }], duration_ms: 2000, repeat: 'infinite', heat_regions: [{ region: 'masseter_l', pulse: true }], caption_pt: 'Mastigação direcionada ao lado de menor tônus — atenção plena.' } },
  { id: 'exercise-hyoid-suprahyoid-strengthening', cfg: { schema_version: 1, primitives: [{ id: 'jaw_open_wide', intensity: 0.8 }], duration_ms: 2000, hold_ms: 4000, repeat: 'infinite', heat_regions: [{ region: 'mentalis', pulse: true }, { region: 'platysma', pulse: true }], caption_pt: 'Boca aberta — empurre a língua contra os dentes inferiores.' } },
  { id: 'routine-lt-15-mentalis-tactile-inhibition', cfg: { schema_version: 1, primitives: [{ id: 'jaw_clench', intensity: 0.2 }], duration_ms: 2500, repeat: 'infinite', heat_regions: [{ region: 'mentalis', pulse: false }], caption_pt: 'Toque o queixo ao engolir — inibe a contração do mentual.' } },
  { id: 'routine-lt-16-mandibular-rotation-mirror', cfg: { schema_version: 1, primitives: [{ id: 'jaw_infinity', intensity: 0.8 }], duration_ms: 4000, repeat: 'infinite', heat_regions: [{ region: 'masseter_l', pulse: false }, { region: 'masseter_r', pulse: false }], caption_pt: 'Abertura mandibular em "infinito" — controle ao espelho.' } },
  { id: 'routine-lt-17-mandibular-protrusion-isometric', cfg: { schema_version: 1, primitives: [{ id: 'jaw_protrusion', intensity: 0.9 }], duration_ms: 1500, hold_ms: 5000, repeat: 'infinite', heat_regions: [{ region: 'masseter_l', pulse: true }, { region: 'masseter_r', pulse: true }], caption_pt: 'Projete a mandíbula para frente — sustente isométrico.' } },
  { id: 'routine-lt-18-mandibular-retrusion-isometric', cfg: { schema_version: 1, primitives: [{ id: 'jaw_retrusion', intensity: 0.8 }], duration_ms: 1500, hold_ms: 5000, repeat: 'infinite', heat_regions: [{ region: 'masseter_l', pulse: true }, { region: 'masseter_r', pulse: true }], caption_pt: 'Recue a mandíbula contra a posição de descanso — sustente.' } },
  { id: 'routine-lt-19-hinge-jaw-tongue-up', cfg: { schema_version: 1, primitives: [{ id: 'jaw_open_wide', intensity: 0.6 }, { id: 'tongue_palate_press', intensity: 0.9 }], duration_ms: 2500, hold_ms: 3000, repeat: 'infinite', show_xray: true, caption_pt: 'Abra a mandíbula mantendo a língua presa no palato — dobradiça pura.' } },
  { id: 'routine-lt-21-mandibular-caudal-traction', cfg: { schema_version: 1, primitives: [{ id: 'jaw_open_wide', intensity: 0.4 }], duration_ms: 4000, hold_ms: 6000, repeat: 'infinite', heat_regions: [{ region: 'masseter_l', pulse: false }, { region: 'masseter_r', pulse: false }], caption_pt: 'Tração caudal passiva — peso da mandíbula descomprime a ATM.' } },
  { id: 'routine-lt-23-jaw-wood-spatula-stretch', cfg: { schema_version: 1, primitives: [{ id: 'jaw_open_wide', intensity: 0.7 }], duration_ms: 3000, hold_ms: 8000, repeat: 'infinite', heat_regions: [{ region: 'masseter_l', pulse: false }, { region: 'masseter_r', pulse: false }], caption_pt: 'Espátulas empilhadas entre os dentes — alongamento progressivo.' } },
  { id: 'routine-lt-69-mandibular-bite-block', cfg: { schema_version: 1, primitives: [{ id: 'jaw_lateral_left', intensity: 0.7 }], duration_ms: 1800, hold_ms: 3000, repeat: 'infinite', heat_regions: [{ region: 'masseter_l', pulse: true }, { region: 'masseter_r', pulse: false }], caption_pt: 'Deslize lateral contra bloqueio do dedo — força lateral controlada.' } },

  // ─── BOCHECHA ─────────────────────────────────────────────────────────────
  { id: 'exercise-buccinator-puff', cfg: { schema_version: 1, primitives: [{ id: 'cheek_puff_left', intensity: 1, delay_ms: 0 }, { id: 'cheek_puff_right', intensity: 1, delay_ms: 1000 }], duration_ms: 2000, repeat: 'infinite', heat_regions: [{ region: 'buccinator_l', pulse: true }, { region: 'buccinator_r', pulse: true }], caption_pt: 'Insufle uma bochecha de cada vez — alterne ritmicamente.' } },
  { id: 'routine-lt-11-air-rotation-upper-lip', cfg: { schema_version: 1, primitives: [{ id: 'cheek_puff_both', intensity: 0.7 }], duration_ms: 2500, repeat: 'infinite', heat_regions: [{ region: 'orbicularis_oris', pulse: true }], caption_pt: 'Gire o ar sob o lábio superior — círculos amplos.' } },
  { id: 'routine-lt-12-air-rotation-lower-lip', cfg: { schema_version: 1, primitives: [{ id: 'cheek_puff_both', intensity: 0.7 }], duration_ms: 2500, repeat: 'infinite', heat_regions: [{ region: 'orbicularis_oris', pulse: true }], caption_pt: 'Gire o ar sob o lábio inferior — círculos amplos.' } },
  { id: 'routine-lt-14-unilateral-cheek-puff', cfg: { schema_version: 1, primitives: [{ id: 'cheek_puff_left', intensity: 1 }], duration_ms: 2000, hold_ms: 3000, repeat: 'infinite', heat_regions: [{ region: 'buccinator_l', pulse: true }], caption_pt: 'Bochecho de ar unilateral — sustente uma bochecha cheia.' } },

  // ─── PESCOÇO / PLATISMA ───────────────────────────────────────────────────
  { id: 'exercise-chin-jut-platysma', cfg: { schema_version: 1, primitives: [{ id: 'jaw_protrusion', intensity: 0.9 }, { id: 'neck_extension', intensity: 0.6 }], duration_ms: 2000, hold_ms: 4000, repeat: 'infinite', heat_regions: [{ region: 'platysma', pulse: true }, { region: 'mentalis', pulse: false }], caption_pt: 'Projete o queixo para cima e para frente — sinta o platisma alongar.' } },
  { id: 'routine-lt-48-supine-cervical-retraction', cfg: { schema_version: 1, primitives: [{ id: 'neck_chin_tuck', intensity: 1 }], duration_ms: 2000, hold_ms: 5000, repeat: 'infinite', heat_regions: [{ region: 'suboccipital', pulse: true }, { region: 'scm_l', pulse: false }, { region: 'scm_r', pulse: false }], caption_pt: 'Em decúbito dorsal — recue o queixo pressionando a nuca no chão.' } },

  // ─── BREATHING (informativo) ──────────────────────────────────────────────
  { id: 'exercise-nasal-breathing-retraining', cfg: { schema_version: 1, primitives: [{ id: 'static_breathing_indicator', intensity: 1 }], duration_ms: 4000, repeat: 'infinite', caption_pt: 'Respiração exclusivamente nasal — boca selada o dia todo.' } },
];

export class M44AnimationConfigSeed1746000260000 implements MigrationInterface {
  name = 'M44AnimationConfigSeed1746000260000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const row of SEED) {
      await queryRunner.query(
        `UPDATE recommendation_catalog
            SET animation_config = $1::jsonb
          WHERE id = $2 AND category = 'exercise'`,
        [JSON.stringify(row.cfg), row.id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ids = SEED.map((r) => r.id);
    await queryRunner.query(
      `UPDATE recommendation_catalog
          SET animation_config = NULL
        WHERE id = ANY($1::text[])`,
      [ids],
    );
  }
}
