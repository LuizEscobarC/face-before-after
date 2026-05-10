import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';

/** Versioned container for blacklist entries */
@Entity({ name: 'template_blacklist_version' })
export class TemplateBlacklistVersionEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'version', type: 'text', unique: true })
  version!: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}

export type BlacklistCategory =
  | 'diagnostic_verb'
  | 'pathology_word'
  | 'guarantee_word'
  | 'medical_intervention'
  | 'pejorative';

/** Individual forbidden term per version */
@Entity({ name: 'template_blacklist_term' })
@Unique('uq_template_blacklist_term', ['version', 'term'])
export class TemplateBlacklistTermEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'version', type: 'text' })
  version!: string;

  @ManyToOne(() => TemplateBlacklistVersionEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'version', referencedColumnName: 'version' })
  versionRef!: Relation<TemplateBlacklistVersionEntity>;

  @Column({ name: 'term', type: 'text' })
  term!: string;

  @Column({ name: 'category', type: 'text' })
  category!: BlacklistCategory;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;
}
