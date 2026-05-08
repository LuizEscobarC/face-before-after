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
  termo: string;
  unidade: string;
  descricao: string;
  como_medido: string;
  faixas: string;
  problemas_comuns: string[];
  referencias: { titulo: string; url: string }[];
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
};
