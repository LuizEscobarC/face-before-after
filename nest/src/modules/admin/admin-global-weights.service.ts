import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlobalWeightEntity } from '../analysis/infrastructure/entities/global-weight.entity.js';

@Injectable()
export class AdminGlobalWeightsService {
  constructor(
    @InjectRepository(GlobalWeightEntity)
    private readonly repo: Repository<GlobalWeightEntity>,
  ) {}

  async getVersions() {
    const rows = await this.repo
      .createQueryBuilder('g')
      .select('DISTINCT g.version', 'version')
      .orderBy('g.version', 'ASC')
      .getRawMany();
    return rows.map((r: any) => ({ version: r.version }));
  }

  async list(version?: string) {
    let q = this.repo.createQueryBuilder('g');
    if (version) q = q.where('g.version = :v', { v: version });
    return q.orderBy('g.region', 'ASC').getMany();
  }

  async getById(id: string) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`GlobalWeight não encontrado: ${id}`);
    return item;
  }

  async update(id: string, weight: number) {
    if (typeof weight !== 'number' || weight < 0 || weight > 10) {
      throw new BadRequestException('weight deve ser número entre 0 e 10.');
    }
    const item = await this.getById(id);
    item.weight = weight;
    return this.repo.save(item);
  }
}
