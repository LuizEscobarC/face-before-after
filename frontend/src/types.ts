import type { AnimationConfig } from './types/animationConfig';
import type { BiometricExerciseConfig } from './biometric/types';

export type ClientLandmarkPayload = {
  landmarks: number[][];
  pose: { yaw: number; pitch: number; roll: number };
  processing_mode: 'CLIENT_SIDE';
  session_id?: string;
};

export type RealtimeFeedback = {
  face_detected: boolean;
  pose_ok: boolean;
  light_ok: boolean;
};

export type AnalyzeMode = "free" | "premium" | "compare";

export type CaptureGuidelines = {
  title: string;
  distance_meters: string;
  zoom: string;
  tips: string[];
};

export type TopLeverage = {
  short_action?: string;
  why_it_matters?: string;
  time_to_result?: string;
};

/**
 * One metric evaluation row from Nest's POST /v1/analysis/evaluate response.
 * Mirrors MetricEvaluationResultDto (PR-10, extended in PR-34 M3.2).
 *
 * Sources: PLAN_METRICS.md §5, PLAN_M3_OVERLAYS §2 (improvement_vector)
 */
export type MetricEvaluationResult = {
  metric_id: string;
  region: string;
  family: string;
  unit: string;
  value: number | null;
  confidence_raw: number | null;
  confidence_final: number | null;
  is_low_confidence: boolean;
  direction: string | null;
  deviation_raw: number | null;
  deviation_normalized: number | null;
  /** 5-level severity: ideal | mild | moderate | strong | extreme (DEC-3). */
  severity_5: string | null;
  /** Collapsed 3-level severity: LEVE | MODERADO | SEVERO (DEC-3). */
  severity_3: string | null;
  direction_label: Record<string, string>;
  /** Horizontal improvement vector in normalised intercanthal units. Null = N/A. */
  improvement_vector_x: number | null;
  /** Vertical improvement vector in normalised intercanthal units. Positive = downward. Null = N/A. */
  improvement_vector_y: number | null;
  /**
   * MediaPipe Mesh-478 landmark index used as the visual anchor when drawing
   * the improvement vector overlay for this metric. Sourced server-side from
   * ``metric_definition.dependency_landmarks[0]``. Null when the metric has
   * no anchor landmarks.
   */
  anchor_landmark_index: number | null;
};

export type VisualStatus = {
  dominance_score?: number;
  attractiveness_score?: number;
  freshness_score?: number;
  narrative?: string;
};

export type EvolutionPhase = {
  label?: string;
  focus?: string;
  confidence_label?: string;
  confidence_score?: number;
  requires_professional?: boolean;
  reanalysis_date?: string;
  reanalysis_label?: string;
  actions?: Array<{
    titulo: string;
    descricao: string;
    frequencia: string;
    metric_label?: string;
  }>;
};

export type RecommendationAction = {
  tipo: string;
  titulo: string;
  descricao: string;
  frequencia: string;
  fonte?: { titulo: string; url: string };
};

export type MetricRecommendation = {
  metric_key: string;
  metric_label: string;
  severity: string;
  value: unknown;
  ideal: string;
  what_is: string;
  how_measured: string;
  why_matters: string;
  actions: RecommendationAction[];
  references: { titulo: string; url: string }[];
};

export type GlossaryTerm = {
  /** Always present — comes from metric_definition.display_name. */
  termo: string;
  /** Always present — comes from metric_definition.unit. */
  unidade: string;
  /** Layer 1 — plain-language analogy ("Feynman"). */
  feynman?: string | null;
  /** Layer 2 — short technical description. */
  descricao?: string | null;
  /** Layer 3 — measurement method. */
  como_medido?: string | null;
  /** Layer 4 — typical value ranges. */
  faixas?: string | null;
  /** Layer 5 — known caveats / failure modes. */
  problemas_comuns?: string[];
  /** External references. */
  referencias?: { titulo: string; url: string }[];
};

export type CompareMetric = {
  key: string;
  label: string;
  before: number;
  after: number;
  delta: number;
  improved: boolean;
};

export type CompareResult = {
  score_before: number;
  score_after: number;
  score_delta: number;
  tier_before: string;
  tier_after: string;
  metrics: CompareMetric[];
  improved_count: number;
  worsened_count: number;
  top_improvements: CompareMetric[];
  top_regressions: CompareMetric[];
};

export type CompareWithConsistency = CompareResult & {
  consistency_score: number;
  consistency_issues: string[];
  is_comparable: boolean;
  baseline_group_id_before?: string;
  baseline_group_id_after?: string;
};

export type PremiumMetric = {
  key: string;
  label: string;
  display_value: string;
  unit: string;
  ideal: string;
  severity: string;
  metric_class: string;
};

export type PremiumMetricCategory = {
  slug: string;
  title: string;
  count: number;
  metrics: PremiumMetric[];
};

export type AnalysisResult = {
  analysis_mode: "teaser" | "premium";
  access_tier: string;
  input_file: string;
  run_id?: string;
  /** Raw pixel landmark coordinates from MediaPipe Mesh-478. Each entry is [x, y]. */
  landmarks?: Array<[number, number]>;
  /** Metric evaluations from POST /v1/analysis/evaluate (M1 pipeline, PR-34 M3.2). */
  metric_evaluations?: MetricEvaluationResult[];
  /** Canonical (cropped + Frankfort-aligned) image URL — base of every overlay.
   * Always prefer this over photo_url; the latter is a legacy alias. */
  canonical_url?: string;
  /** Textual annotations rendered next to overlays (formerly burned into PNGs). */
  overlay_annotations?: {
    grid_thirds?: {
      ideal_pct: number;
      rows: Array<{ id: string; label: string; pct: number;
                    deviation_pct: number; severity_5: string | null }>;
      legend?: Record<string, string>;
    };
    grid_fifths?: {
      rows: Array<{ id: string; deviation_px: number }>;
      legend?: Record<string, string>;
    };
    face_extents?: {
      trichion_source: "bisenet" | "mesh";
      trichion_label: string;
      menton_label: string;
      face_height_px: number;
      face_width_px: number;
      legend?: string;
    };
    ideal_proportions?: Array<{
      metric_id?: string; value?: number | null;
      severity_5?: string | null; direction?: string | null;
    }>;
  };
  score: number;
  tier: string;
  tier_description: string;
  benchmark_message?: string;
  score_context?: string;
  first_impression?: {
    headline?: string;
    positive_signal?: string;
    main_risk?: string;
    tags?: string[];
  };
  top_leverage?: TopLeverage;
  visual_status?: VisualStatus;
  top3_actions_v2?: Array<{
    rank: number;
    short_action: string;
    why_it_matters: string;
    time_to_result: string;
    tier?: number;
    metric_key?: string;
  }>;
  evolution_path?: {
    phase_1?: EvolutionPhase;
    phase_2?: EvolutionPhase;
    phase_3?: EvolutionPhase;
    skin_alert?: boolean;
    mutable_metrics?: string[];
  };
  auto_crop?: {
    applied?: boolean;
    reason?: string;
  };
  premium_metrics_catalog?: PremiumMetricCategory[];
  photo_warnings?: string[];
  capture_recommendations?: Array<{ area: string; tip: string }>;
  annotated_image_path?: string;
  rotation_correction_degrees?: number;
  simulation_paths?: {
    symmetrized?: string;
    ideal_proportions?: string;
    comparison_grid?: string;
  } | null;
  simulation_error?: string | null;
  capture_confidence?: number;
  measurements?: Record<string, number | string | boolean | null>;
  measurements_blocks?: {
    advanced?: Record<string, number | string | boolean | null>;
    skin?: Record<string, number | string | boolean | null>;
    photo_quality?: Record<string, number | string | boolean | null | string[]>;
  };
  main_insight?: {
    metric_key?: string;
    short_name?: string;
    detail?: string;
  };
  recommendations?: MetricRecommendation[];
  /** report_id from POST /v1/analysis/evaluate — set after narrative is resolved (Phase A). */
  report_id?: string;
};

// ── Narrative types (M4.4 / PR-59) ──────────────────────────────────────────

export type NarrativeFindingDto = {
  metric_id: string;
  severity_3: string | null;
  severity_5: string | null;
  direction_label_pt: string | null;
  narrative_text: string;
  deviation_normalized: number | null;
};

export type NarrativeRecommendationDto = {
  recommendation_id: string;
  rank: number;
  score: number;
  category: string;
  display_text_short_pt: string;
  requires_professional: boolean;
  professional_type: string | null;
};

export type NarrativeResponseDto = {
  report_id: string;
  generated_at: string;
  global_score: number | null;
  findings: NarrativeFindingDto[];
  recommendations: NarrativeRecommendationDto[];
  disclaimer: string;
};

// ── Diagnostic Templates (Admin CRUD) ────────────────────────────────────

export type DiagnosticTemplate = {
  id: string;
  version: string;
  metricId: string;
  severity: 'ideal' | 'mild' | 'moderate' | 'strong' | 'extreme';
  direction: string;
  size: 'short' | 'medium' | 'long';
  templatePt: string;
  placeholdersUsed: string[];
  createdAt: string;
};

export type TemplateMetricOption = {
  metricId: string;
};

export type TemplateFilter = {
  metricId?: string;
  size?: 'short' | 'medium' | 'long';
};

export type TemplateRenderPreview = {
  value: string;
  ideal: string;
  deviationPct: string;
  directionLabel: string;
  regionPt: string;
  severityPt: string;
};

// ── Recommendation Catalog (Admin CRUD - PR-56) ────────────────────────────────

export type RecommendationCategory =
  | 'photo'
  | 'presentation_only'
  | 'posture'
  | 'lifestyle'
  | 'exercise'
  | 'styling'
  | 'aesthetic_procedure'
  | 'professional_referral';

export type EffortEstimate = 'minimal' | 'low' | 'medium' | 'high' | 'very_high';

export type EvidenceLevel = 'strong' | 'moderate' | 'anecdotal';

export type ProfessionalType =
  | 'dentist'
  | 'physiotherapist'
  | 'dermatologist'
  | 'otolaryngologist'
  | 'plastic_surgeon'
  | 'orthodontist'
  | 'oral_maxillofacial_surgeon';

export type RecommendationReference = {
  citation: string;
  url?: string;
};

export type RecommendationCatalog = {
  id: string;
  version: string;
  category: RecommendationCategory;
  displayTextShortPt: string;
  displayTextLongPt: string;
  priorityDefault: number;
  effortEstimate: EffortEstimate;
  riskLevel: number;
  requiresProfessional: boolean;
  professionalType: ProfessionalType | null;
  invasivenessLevel: number;
  evidenceLevel: EvidenceLevel;
  requiresAnecdotalDisclaimer: boolean;
  clinicalPathwayRequired: boolean;
  references: RecommendationReference[];
  disclaimerTemplate: string | null;
  animationConfig: AnimationConfig | null;
  biometricConfig: BiometricExerciseConfig | null;
  createdAt: string;
};

export type RecommendationCategory_Option = {
  category: RecommendationCategory;
};

export type RecommendationFilter = {
  category?: RecommendationCategory;
  version?: string;
};

// ── Admin CRUDs ────────────────────────────────────────────────────────────────

export type MetricIdeal = {
  id: string;
  metricId: string;
  metricDefinitionVersion: string;
  idealsVersion: string;
  idealType: string;
  idealCentralValue: number | null;
  greenRangeMin: number | null;
  greenRangeMax: number | null;
  yellowRangeMin: number | null;
  yellowRangeMax: number | null;
  populationReferenceNote: string | null;
  createdAt: string;
};

export type GlobalWeight = {
  id: string;
  version: string;
  region: string;
  weight: number;
  createdAt: string;
};

export type BlacklistTerm = {
  id: string;
  version: string;
  term: string;
  category: string;
  notes: string | null;
};

export type ThresholdConfig = {
  version: string;
  minConfidenceToDisplayMetric: number;
  minConfidenceToShowGlobalScore: number;
  scoreBandNoNumberMax: number;
  scoreBandRefineMax: number;
  scoreBandGoodMax: number;
  disclaimerTextSnapshot: string;
  isActive: boolean;
  createdAt: string;
};

/**
 * Active score band configuration returned by GET /v1/catalog/score-bands.
 * Mirrors ScoreBandConfigDto in nest/src/modules/catalog/dto/catalog.dto.ts.
 *
 * Band mapping (DEC-9):
 *   score < no_number_max         → "no_number" (do not display number)
 *   no_number_max ≤ s < refine_max → "refine"   (low band)
 *   refine_max    ≤ s < good_max  → "good"     (mid band)
 *   good_max      ≤ s             → "high"     (top band)
 */
export type ScoreBandConfig = {
  no_number_max: number;
  refine_max: number;
  good_max: number;
  min_confidence_to_display_metric: number;
  min_confidence_to_show_global_score: number;
  version: string;
  disclaimer_text_snapshot: string;
};

export type ScoreBandName = "no_number" | "refine" | "good" | "high";
