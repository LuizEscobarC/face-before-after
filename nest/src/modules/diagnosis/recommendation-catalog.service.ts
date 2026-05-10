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
      query = query.where('r.version = :version', { version: filter.version });
    } else {
      // Default to latest active version if not specified
      query = query.where('r.version = :version', { version: 'v1.0' });
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
   * Update recommendation text fields
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
    },
  ) {
    const recommendation = await this.getRecommendationById(id);

    // Validate required fields
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

    // Apply updates
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
