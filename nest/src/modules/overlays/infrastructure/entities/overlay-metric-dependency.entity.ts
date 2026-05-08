import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { OverlayDefinitionEntity } from './overlay-definition.entity.js';
import { MetricDefinitionEntity } from '../../../analysis/infrastructure/entities/metric-definition.entity.js';

/**
 * PR-30 — overlay_metric_dependency
 *
 * N:N association between an overlay snapshot ``(overlay_id, overlay_version)``
 * and a metric snapshot ``(metric_id, metric_definition_version)``. Drives the
 * confidence cascade described in PLAN_M3_OVERLAYS §1.1:
 *   - is_critical=TRUE  → overlay fully suppressed if dependency
 *                         confidence_final < min_confidence_to_display (L2).
 *   - is_critical=FALSE → overlay renders degraded; legend explains
 *                         which component was hidden (L3).
 */
@Entity({ name: 'overlay_metric_dependency' })
@Unique('uq_overlay_metric_dep', [
  'overlayId',
  'overlayVersion',
  'metricId',
  'metricDefinitionVersion',
])
@Index('idx_overlay_metric_dep_overlay', ['overlayId', 'overlayVersion'])
@Index('idx_overlay_metric_dep_metric', ['metricId'])
export class OverlayMetricDependencyEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'overlay_id', type: 'text' })
  overlayId!: string;

  @Column({ name: 'overlay_version', type: 'text' })
  overlayVersion!: string;

  @ManyToOne(() => OverlayDefinitionEntity, (o) => o.dependencies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([
    { name: 'overlay_id', referencedColumnName: 'overlayId' },
    { name: 'overlay_version', referencedColumnName: 'version' },
  ])
  overlay!: Relation<OverlayDefinitionEntity>;

  @Column({ name: 'metric_id', type: 'text' })
  metricId!: string;

  @Column({ name: 'metric_definition_version', type: 'text' })
  metricDefinitionVersion!: string;

  @ManyToOne(() => MetricDefinitionEntity)
  @JoinColumn([
    { name: 'metric_id', referencedColumnName: 'metricId' },
    { name: 'metric_definition_version', referencedColumnName: 'version' },
  ])
  metric!: Relation<MetricDefinitionEntity>;

  @Column({ name: 'is_critical', type: 'boolean', default: false })
  isCritical!: boolean;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
