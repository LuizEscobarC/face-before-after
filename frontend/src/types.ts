export type AnalyzeMode = "free" | "premium";

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
  score: number;
  tier: string;
  tier_description: string;
  benchmark_message?: string;
  score_context?: string;
  first_impression?: {
    headline?: string;
  };
  top_leverage?: TopLeverage;
  visual_status?: VisualStatus;
  top3_actions_v2?: Array<{
    rank: number;
    short_action: string;
    why_it_matters: string;
    time_to_result: string;
  }>;
  evolution_path?: {
    phase_1?: EvolutionPhase;
    phase_2?: EvolutionPhase;
    phase_3?: EvolutionPhase;
  };
  auto_crop?: {
    applied?: boolean;
    reason?: string;
  };
  premium_metrics_catalog?: PremiumMetricCategory[];
};
