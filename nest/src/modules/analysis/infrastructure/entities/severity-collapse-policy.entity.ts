import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { Severity3, Severity5 } from '../../domain/types/catalog.types.js';

/**
 * DEC-3: 5-level severity collapses to 3-level for the diagnostic_candidate
 * surface. Stored as a versioned JSONB document so calibration changes don't
 * require a deploy.
 */
export type SeverityCollapseMapping = Record<Severity5, Severity3>;

@Entity({ name: 'severity_collapse_policy' })
export class SeverityCollapsePolicyEntity {
  @PrimaryColumn({ name: 'version', type: 'text' })
  version!: string;

  @Column({ name: 'mapping', type: 'jsonb' })
  mapping!: SeverityCollapseMapping;

  @Index('uq_severity_collapse_policy_active', { unique: true, where: 'is_active = TRUE' })
  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
