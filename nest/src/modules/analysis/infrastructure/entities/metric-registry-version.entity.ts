import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { MetricDefinitionEntity } from './metric-definition.entity.js';

@Entity({ name: 'metric_registry_version' })
export class MetricRegistryVersionEntity {
  @PrimaryColumn({ name: 'version', type: 'text' })
  version!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Index('uq_metric_registry_version_active', { unique: true, where: 'is_active = TRUE' })
  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @OneToMany(() => MetricDefinitionEntity, (m) => m.registryVersion)
  metricDefinitions!: Relation<MetricDefinitionEntity>[];
}
