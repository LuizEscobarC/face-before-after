/**
 * PR-59 — DiagnosticTemplateEntity
 *
 * TypeORM entity for ``diagnostic_template``. Created for the
 * NarrativeService (PR-59) template lookup — the table was provisioned
 * by migration ``1746000180000-M41DiagnosticTemplates.ts`` (PR-50) but
 * no TypeORM entity existed yet.
 *
 * Schema:
 *   id                UUID PK
 *   version           TEXT (FK → diagnostic_template_version.version)
 *   metric_id         TEXT (soft snapshot — no FK)
 *   severity          severity_5_enum
 *   direction         TEXT ('neutral'|'left_dominant'|'right_dominant'|'any')
 *   size              TEXT CHECK ('short'|'medium'|'long')
 *   template_pt       TEXT
 *   placeholders_used JSONB (string[])
 *   created_at        TIMESTAMPTZ
 *
 * Unique constraint: (version, metric_id, severity, direction, size)
 */
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'diagnostic_template' })
export class DiagnosticTemplateEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'version', type: 'text' })
  version!: string;

  @Column({ name: 'metric_id', type: 'text' })
  metricId!: string;

  @Column({
    name: 'severity',
    type: 'enum',
    enum: ['ideal', 'mild', 'moderate', 'strong', 'extreme'],
    enumName: 'severity_5_enum',
  })
  severity!: string;

  /** Direction key: 'neutral' | 'left_dominant' | 'right_dominant' | 'any' */
  @Column({ name: 'direction', type: 'text' })
  direction!: string;

  /** 'short' | 'medium' | 'long' */
  @Column({ name: 'size', type: 'text' })
  size!: string;

  @Column({ name: 'template_pt', type: 'text' })
  templatePt!: string;

  @Column({ name: 'placeholders_used', type: 'jsonb', default: () => "'[]'::jsonb" })
  placeholdersUsed!: string[];

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
