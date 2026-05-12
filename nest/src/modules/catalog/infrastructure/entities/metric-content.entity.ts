/**
 * MetricContent — i18n editorial content for metric explainers.
 *
 * Holds the human-facing text that used to live in the frontend bundle
 * (``frontend/src/data/glossary.ts`` and ``frontend/src/data/feynman.ts``).
 *
 * One row per (metric_id, locale). The endpoint ``GET /v1/catalog/glossary``
 * joins this with ``metric_definition`` and returns a denormalised payload
 * keyed by metric_id, so the frontend can drop ``glossaryKeyFor()`` aliases.
 */
import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'metric_content' })
@Index('idx_metric_content_metric_id', ['metricId'])
export class MetricContentEntity {
  @PrimaryColumn({ name: 'metric_id', type: 'text' })
  metricId!: string;

  @PrimaryColumn({ name: 'locale', type: 'text' })
  locale!: string;

  /** Layer 1 — plain language analogy (Feynman style). */
  @Column({ name: 'feynman_text', type: 'text', nullable: true })
  feynmanText!: string | null;

  /** Layer 2 — short technical description (one sentence). */
  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  /** Layer 3 — measurement method narrative. */
  @Column({ name: 'how_measured', type: 'text', nullable: true })
  howMeasured!: string | null;

  /** Layer 4 — typical value ranges (free text). */
  @Column({ name: 'ranges_text', type: 'text', nullable: true })
  rangesText!: string | null;

  /** Layer 5 — known caveats / failure modes (string[]). */
  @Column({ name: 'common_issues', type: 'jsonb', default: () => "'[]'::jsonb" })
  commonIssues!: string[];

  /** External references — ``{titulo, url}[]``. */
  @Column({ name: 'references', type: 'jsonb', default: () => "'[]'::jsonb" })
  references!: Array<{ titulo: string; url: string }>;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
