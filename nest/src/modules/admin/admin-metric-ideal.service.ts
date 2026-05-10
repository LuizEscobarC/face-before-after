import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MetricIdealEntity } from '../analysis/infrastructure/entities/metric-ideal.entity.js';

@Injectable()
export class AdminMetricIdealService {
  constructor(
    @InjectRepository(MetricIdealEntity)
    private readonly repo: Repository<MetricIdealEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async getVersions() {
    const rows = await this.repo
      .createQueryBuilder('m')
      .select('DISTINCT m.idealsVersion', 'idealsVersion')
      .orderBy('m.idealsVersion', 'ASC')
      .getRawMany();
    return rows.map((r: any) => ({ idealsVersion: r.idealsVersion }));
  }

  async list(filter?: { idealsVersion?: string; metricId?: string }) {
    let q = this.repo.createQueryBuilder('m');
    if (filter?.idealsVersion) {
      q = q.where('m.idealsVersion = :v', { v: filter.idealsVersion });
    }
    if (filter?.metricId) {
      q = q.andWhere('m.metricId ILIKE :m', { m: `%${filter.metricId}%` });
    }
    return q.orderBy('m.metricId', 'ASC').getMany();
  }

  async getById(id: string) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`MetricIdeal não encontrado: ${id}`);
    return item;
  }

  async getMetricLabels(): Promise<{ metricId: string; label: string }[]> {
    const rows = await this.dataSource.query(`
      SELECT md.metric_id, md.display_name->>'pt-BR' AS label
      FROM metric_definition md
      WHERE md.version = (
        SELECT version FROM metric_registry_version WHERE is_active = true ORDER BY version DESC LIMIT 1
      )
      ORDER BY md.metric_id
    `);
    return rows.map((r: any) => ({
      metricId: r.metric_id,
      label: r.label || r.metric_id,
    }));
  }

  async update(id: string, body: {
    idealCentralValue?: number | null;
    greenRangeMin?: number | null;
    greenRangeMax?: number | null;
    yellowRangeMin?: number | null;
    yellowRangeMax?: number | null;
    populationReferenceNote?: string | null;
  }) {
    const item = await this.getById(id);
    Object.assign(item, body);
    return this.repo.save(item);
  }
}
