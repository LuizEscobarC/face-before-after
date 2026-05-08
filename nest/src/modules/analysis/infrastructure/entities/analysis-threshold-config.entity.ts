import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

const numericTransformer = {
  to: (v: number) => v,
  from: (v: string | null) => (v === null ? null : parseFloat(v)),
};

@Entity({ name: 'analysis_threshold_config' })
export class AnalysisThresholdConfigEntity {
  @PrimaryColumn({ name: 'version', type: 'text' })
  version!: string;

  @Column({ name: 'min_confidence_to_display_metric', type: 'numeric', precision: 10, scale: 6, default: 0.4, transformer: numericTransformer })
  minConfidenceToDisplayMetric!: number;

  @Column({ name: 'min_confidence_to_show_global_score', type: 'numeric', precision: 10, scale: 6, default: 0.5, transformer: numericTransformer })
  minConfidenceToShowGlobalScore!: number;

  @Column({ name: 'score_band_no_number_max', type: 'numeric', precision: 10, scale: 6, default: 50.0, transformer: numericTransformer })
  scoreBandNoNumberMax!: number;

  @Column({ name: 'score_band_refine_max', type: 'numeric', precision: 10, scale: 6, default: 70.0, transformer: numericTransformer })
  scoreBandRefineMax!: number;

  @Column({ name: 'score_band_good_max', type: 'numeric', precision: 10, scale: 6, default: 85.0, transformer: numericTransformer })
  scoreBandGoodMax!: number;

  @Column({ name: 'disclaimer_text_snapshot', type: 'text' })
  disclaimerTextSnapshot!: string;

  @Index('uq_analysis_threshold_config_active', { unique: true, where: 'is_active = TRUE' })
  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
