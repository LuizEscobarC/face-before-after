import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalysisThresholdConfigEntity } from '../analysis/infrastructure/entities/analysis-threshold-config.entity.js';

@Injectable()
export class AdminThresholdService {
  constructor(
    @InjectRepository(AnalysisThresholdConfigEntity)
    private readonly repo: Repository<AnalysisThresholdConfigEntity>,
  ) {}

  async list() {
    return this.repo.find({ order: { version: 'ASC' } });
  }

  async getByVersion(version: string) {
    const item = await this.repo.findOne({ where: { version } });
    if (!item) throw new NotFoundException(`ThresholdConfig não encontrado: ${version}`);
    return item;
  }

  async update(version: string, body: {
    minConfidenceToDisplayMetric?: number;
    minConfidenceToShowGlobalScore?: number;
    scoreBandNoNumberMax?: number;
    scoreBandRefineMax?: number;
    scoreBandGoodMax?: number;
    disclaimerTextSnapshot?: string;
  }) {
    const item = await this.getByVersion(version);
    if (body.minConfidenceToDisplayMetric !== undefined && (body.minConfidenceToDisplayMetric < 0 || body.minConfidenceToDisplayMetric > 1)) {
      throw new BadRequestException('minConfidenceToDisplayMetric deve ser entre 0 e 1.');
    }
    if (body.minConfidenceToShowGlobalScore !== undefined && (body.minConfidenceToShowGlobalScore < 0 || body.minConfidenceToShowGlobalScore > 1)) {
      throw new BadRequestException('minConfidenceToShowGlobalScore deve ser entre 0 e 1.');
    }
    Object.assign(item, body);
    return this.repo.save(item);
  }

  async setActive(version: string) {
    // Deactivate all first, then activate the target
    await this.repo.update({}, { isActive: false });
    const item = await this.getByVersion(version);
    item.isActive = true;
    return this.repo.save(item);
  }
}
