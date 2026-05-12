/**
 * PR-56 Admin — RecommendationCatalogService
 *
 * CRUD interface for managing the recommendation catalog.
 * Provides list, getById, and update operations for the admin UI.
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecommendationCatalogEntity } from './infrastructure/entities/recommendation-catalog.entity.js';
import { RecommendationTriggerEntity } from './infrastructure/entities/recommendation-trigger.entity.js';
import {
  CATEGORY_TO_INVASIVENESS,
  EVIDENCE_LEVELS,
  PROFESSIONAL_TYPES,
  RECOMMENDATION_CATEGORIES,
  FACIAL_PRIMITIVE_IDS,
  HEAT_REGION_IDS,
  type EvidenceLevel,
  type ProfessionalType,
  type RecommendationCategory,
  type RecommendationReference,
  type AnimationConfig,
  ANATOMICAL_ZONE_IDS,
  MOVEMENT_VERBS,
  PIVOT_IDS,
  type BiometricExerciseConfig,
} from './domain/types/recommendation.types.js';

function validateAnimationConfig(c: AnimationConfig): string | null {
  if (c.schema_version !== 1) return 'schema_version deve ser 1.';
  const hasRecordedFrames = Array.isArray(c.recorded_timeline?.frames) && c.recorded_timeline!.frames.length > 0;
  if (!Array.isArray(c.primitives) || (c.primitives.length === 0 && !hasRecordedFrames))
    return 'primitives[] não pode estar vazio (ou forneça recorded_timeline com frames).';
  for (const p of c.primitives) {
    if (!(FACIAL_PRIMITIVE_IDS as readonly string[]).includes(p.id)) return `primitive.id inválido: "${p.id}".`;
    if (p.intensity !== undefined && (p.intensity < 0 || p.intensity > 1))
      return `intensity fora de 0..1 (id="${p.id}").`;
  }
  if (typeof c.duration_ms !== 'number' || c.duration_ms <= 0) return 'duration_ms deve ser número positivo.';
  if (!['infinite', 'reverse', 'once'].includes(c.repeat)) return 'repeat deve ser "infinite", "reverse" ou "once".';
  if (c.heat_regions)
    for (const hr of c.heat_regions)
      if (!(HEAT_REGION_IDS as readonly string[]).includes(hr.region)) return `heat_region inválida: "${hr.region}".`;
  return null;
}

function validateBiometricConfig(cfg: BiometricExerciseConfig | null): void {
  if (cfg === null) return;
  if (cfg.schema_version !== 1) {
    throw new BadRequestException('biometricConfig.schema_version deve ser 1.');
  }
  if (!Array.isArray(cfg.steps) || cfg.steps.length < 1) {
    throw new BadRequestException('biometricConfig.steps deve conter ao menos 1 item.');
  }
  for (const step of cfg.steps) {
    if (!(ANATOMICAL_ZONE_IDS as readonly string[]).includes(step.zone)) {
      throw new BadRequestException(`biometricConfig zone inválida: "${step.zone}".`);
    }
    if (!(MOVEMENT_VERBS as readonly string[]).includes(step.verb)) {
      throw new BadRequestException(`biometricConfig verb inválido: "${step.verb}".`);
    }
    if (step.pivot !== undefined && !(PIVOT_IDS as readonly string[]).includes(step.pivot)) {
      throw new BadRequestException(`biometricConfig pivot inválido: "${step.pivot}".`);
    }
  }
  if (typeof cfg.cycle_ms !== 'number' || cfg.cycle_ms <= 0) {
    throw new BadRequestException('biometricConfig.cycle_ms deve ser > 0.');
  }
  if (!['infinite', 'once', 'reverse'].includes(cfg.repeat)) {
    throw new BadRequestException('biometricConfig.repeat deve ser "infinite", "once" ou "reverse".');
  }
}

@Injectable()
export class RecommendationCatalogService {
  private readonly logger = new Logger(RecommendationCatalogService.name);

  constructor(
    @InjectRepository(RecommendationCatalogEntity)
    private readonly catalogRepository: Repository<RecommendationCatalogEntity>,
    @InjectRepository(RecommendationTriggerEntity)
    private readonly triggerRepository: Repository<RecommendationTriggerEntity>,
  ) {}

  /**
   * List all recommendations with optional filters
   */
  async getRecommendations(filter?: {
    category?: string;
    version?: string;
  }) {
    let query = this.catalogRepository.createQueryBuilder('r');

    if (filter?.category) {
      query = query.where('r.category = :category', { category: filter.category });
    }

    if (filter?.version) {
      query = query.andWhere('r.version = :version', { version: filter.version });
    } else {
      // Default to latest active version if not specified
      query = query.andWhere('r.version = :version', { version: 'v1.0' });
    }

    return query
      .orderBy('r.category', 'ASC')
      .addOrderBy('r.id', 'ASC')
      .getMany();
  }

  /**
   * Get single recommendation by ID with its triggers
   */
  async getRecommendationById(id: string) {
    const recommendation = await this.catalogRepository.findOne({
      where: { id },
      relations: ['triggers'],
    });

    if (!recommendation) {
      throw new NotFoundException(`Recomendação não encontrada: ${id}`);
    }

    return recommendation;
  }

  /**
   * Get all categories for filtering
   */
  async getCategories() {
    const result = await this.catalogRepository
      .createQueryBuilder('r')
      .select('DISTINCT r.category', 'category')
      .orderBy('r.category', 'ASC')
      .getRawMany();

    return result.map((row: any) => ({ category: row.category }));
  }

  /**
   * Update recommendation text fields and ladder metadata.
   *
   * PR-55b additions: invasivenessLevel, evidenceLevel,
   * clinicalPathwayRequired, references, disclaimerTemplate.
   * If category changes and invasivenessLevel is not provided, it is auto-
   * derived from CATEGORY_TO_INVASIVENESS.
   */
  async updateRecommendation(
    id: string,
    updates: {
      displayTextShortPt?: string;
      displayTextLongPt?: string;
      category?: string;
      priorityDefault?: number;
      effortEstimate?: string;
      riskLevel?: number;
      requiresProfessional?: boolean;
      professionalType?: string | null;
      invasivenessLevel?: number;
      evidenceLevel?: string;
      clinicalPathwayRequired?: boolean;
      references?: RecommendationReference[];
      disclaimerTemplate?: string | null;
      animationConfig?: AnimationConfig | null;
      biometricConfig?: BiometricExerciseConfig | null;
    },
  ) {
    const recommendation = await this.getRecommendationById(id);

    if (updates.displayTextShortPt !== undefined && !updates.displayTextShortPt?.trim()) {
      throw new BadRequestException('displayTextShortPt não pode estar vazio.');
    }

    if (updates.displayTextLongPt !== undefined && !updates.displayTextLongPt?.trim()) {
      throw new BadRequestException('displayTextLongPt não pode estar vazio.');
    }

    if (updates.priorityDefault !== undefined) {
      if (typeof updates.priorityDefault !== 'number' || updates.priorityDefault < 1 || updates.priorityDefault > 5) {
        throw new BadRequestException('priorityDefault deve ser um número entre 1 e 5.');
      }
    }

    if (updates.riskLevel !== undefined) {
      if (typeof updates.riskLevel !== 'number' || updates.riskLevel < 0 || updates.riskLevel > 1) {
        throw new BadRequestException('riskLevel deve ser um número entre 0 e 1.');
      }
    }

    if (updates.category !== undefined) {
      if (!RECOMMENDATION_CATEGORIES.includes(updates.category as RecommendationCategory)) {
        throw new BadRequestException(
          `category inválida. Aceitos: ${RECOMMENDATION_CATEGORIES.join(', ')}.`,
        );
      }
    }

    if (updates.evidenceLevel !== undefined) {
      if (!EVIDENCE_LEVELS.includes(updates.evidenceLevel as EvidenceLevel)) {
        throw new BadRequestException(
          `evidenceLevel inválido. Aceitos: ${EVIDENCE_LEVELS.join(', ')}.`,
        );
      }
    }

    if (updates.professionalType !== undefined && updates.professionalType !== null) {
      if (!PROFESSIONAL_TYPES.includes(updates.professionalType as ProfessionalType)) {
        throw new BadRequestException(
          `professionalType inválido. Aceitos: ${PROFESSIONAL_TYPES.join(', ')}.`,
        );
      }
    }

    if (updates.invasivenessLevel !== undefined) {
      if (
        typeof updates.invasivenessLevel !== 'number' ||
        updates.invasivenessLevel < 0 ||
        updates.invasivenessLevel > 4
      ) {
        throw new BadRequestException('invasivenessLevel deve estar entre 0 e 4.');
      }
    }

    // Auto-derive invasivenessLevel when category changes and caller didn't pin it.
    if (updates.category !== undefined && updates.invasivenessLevel === undefined) {
      updates = {
        ...updates,
        invasivenessLevel: CATEGORY_TO_INVASIVENESS[updates.category as RecommendationCategory],
      };
    }

    // Anecdotal evidence requires disclaimer (mirrors DB CHECK).
    const nextEvidence = (updates.evidenceLevel ?? recommendation.evidenceLevel) as EvidenceLevel;
    const nextDisclaimer =
      updates.disclaimerTemplate !== undefined
        ? updates.disclaimerTemplate
        : recommendation.disclaimerTemplate;
    if (nextEvidence === 'anecdotal' && (!nextDisclaimer || !nextDisclaimer.trim())) {
      throw new BadRequestException(
        'evidenceLevel=anecdotal exige disclaimerTemplate não-vazio.',
      );
    }

    if (updates.animationConfig !== undefined && updates.animationConfig !== null) {
      const animErr = validateAnimationConfig(updates.animationConfig);
      if (animErr) throw new BadRequestException(animErr);
    }

    if (updates.biometricConfig !== undefined) {
      validateBiometricConfig(updates.biometricConfig);
    }

    Object.assign(recommendation, updates);

    return this.catalogRepository.save(recommendation);
  }

  /**
   * Get triggers for a specific recommendation (for debugging/audit)
   */
  async getRecommendationTriggers(recommendationId: string) {
    return this.triggerRepository.find({
      where: { recommendationId },
    });
  }
}
