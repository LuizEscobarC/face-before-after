import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TemplateBlacklistTermEntity,
  TemplateBlacklistVersionEntity,
  type BlacklistCategory,
} from './entities/template-blacklist.entity.js';

const VALID_CATEGORIES: BlacklistCategory[] = [
  'diagnostic_verb',
  'pathology_word',
  'guarantee_word',
  'medical_intervention',
  'pejorative',
];

@Injectable()
export class AdminBlacklistService {
  constructor(
    @InjectRepository(TemplateBlacklistTermEntity)
    private readonly termRepo: Repository<TemplateBlacklistTermEntity>,
    @InjectRepository(TemplateBlacklistVersionEntity)
    private readonly versionRepo: Repository<TemplateBlacklistVersionEntity>,
  ) {}

  async getVersions() {
    return this.versionRepo.find({ order: { version: 'ASC' } });
  }

  async list(filter?: { version?: string; category?: string }) {
    let q = this.termRepo.createQueryBuilder('t');
    if (filter?.version) q = q.where('t.version = :v', { v: filter.version });
    if (filter?.category) q = q.andWhere('t.category = :c', { c: filter.category });
    return q.orderBy('t.category', 'ASC').addOrderBy('t.term', 'ASC').getMany();
  }

  async create(body: { version: string; term: string; category: BlacklistCategory; notes?: string }) {
    if (!body.version?.trim()) throw new BadRequestException('version obrigatório.');
    if (!body.term?.trim()) throw new BadRequestException('term obrigatório.');
    if (!VALID_CATEGORIES.includes(body.category)) {
      throw new BadRequestException(`category inválido. Use: ${VALID_CATEGORIES.join(', ')}`);
    }
    const item = this.termRepo.create({
      version: body.version,
      term: body.term.toLowerCase().trim(),
      category: body.category,
      notes: body.notes ?? null,
    });
    return this.termRepo.save(item);
  }

  async update(id: string, body: { notes?: string; category?: BlacklistCategory }) {
    const item = await this.termRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Term não encontrado: ${id}`);
    if (body.category && !VALID_CATEGORIES.includes(body.category)) {
      throw new BadRequestException(`category inválido.`);
    }
    Object.assign(item, body);
    return this.termRepo.save(item);
  }

  async remove(id: string) {
    const item = await this.termRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Term não encontrado: ${id}`);
    await this.termRepo.remove(item);
    return { deleted: true, id };
  }
}
