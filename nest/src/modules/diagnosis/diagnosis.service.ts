import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { DiagnosisReportDto, ConcernDto } from './dto/diagnosis.dto.js';
import { DiagnosticTemplateEntity } from './infrastructure/entities/diagnostic-template.entity.js';

interface AnalysisCompletedPayload {
  session_id?: string;
  run_id: string;
  mode: string;
  result?: Record<string, unknown>;
}

@Injectable()
export class DiagnosisService {
  private readonly logger = new Logger(DiagnosisService.name);
  private readonly reports = new Map<string, DiagnosisReportDto>();

  constructor(
    @InjectRepository(DiagnosticTemplateEntity)
    private readonly templateRepository: Repository<DiagnosticTemplateEntity>,
  ) {}

  @OnEvent('analysis.completed')
  handleAnalysisCompleted(payload: AnalysisCompletedPayload): void {
    const report = this._buildReport(payload.run_id, payload.result ?? {});
    this.reports.set(payload.run_id, report);
    this.logger.log(`DiagnosisReport stored for run_id=${payload.run_id}`);
  }

  getReport(runId: string): DiagnosisReportDto {
    const report = this.reports.get(runId);
    if (!report) {
      throw new NotFoundException(`Diagnóstico não encontrado para run_id=${runId}`);
    }
    return report;
  }

  private _buildReport(runId: string, result: Record<string, unknown>): DiagnosisReportDto {
    const concerns = this._extractConcerns(result);
    const topConcerns = concerns.slice(0, 3);
    const summary = this._buildSummary(topConcerns);

    return {
      run_id: runId,
      top_concerns: topConcerns,
      summary,
      timestamp: new Date().toISOString(),
    };
  }

  private _extractConcerns(result: Record<string, unknown>): ConcernDto[] {
    const concerns: ConcernDto[] = [];

    // photo_warnings from the MVP pipeline
    const warnings = result['photo_warnings'];
    if (Array.isArray(warnings)) {
      for (const rawWarning of warnings) {
        const msg = typeof rawWarning === 'string' ? rawWarning : String(rawWarning);
        concerns.push({
          metric_id: 'photo_warning',
          label: 'Alerta de captura',
          severity: 0.6,
          message: msg,
        });
      }
    }

    // top_leverage from the MVP pipeline — pre-ranked improvement opportunities
    const leverage = result['top_leverage'];
    if (Array.isArray(leverage)) {
      for (const item of leverage) {
        const leverageItem = item as Record<string, unknown>;
        const metricId = String(leverageItem['metric'] ?? leverageItem['metric_id'] ?? 'unknown');
        const label = String(leverageItem['label'] ?? leverageItem['insight'] ?? metricId);
        const severity = typeof leverageItem['impact'] === 'number' ? Math.min(1, leverageItem['impact'] as number / 10) : 0.5;
        concerns.push({
          metric_id: metricId,
          label,
          severity: Math.round(severity * 100) / 100,
          message: String(leverageItem['recommendation'] ?? leverageItem['action'] ?? label),
        });
      }
    }

    // score-based concern when overall score is low
    const score = result['score'] as number | undefined;
    if (typeof score === 'number' && score < 6.5 && concerns.length === 0) {
      concerns.push({
        metric_id: 'overall_score',
        label: 'Pontuação geral',
        severity: Math.round((1 - score / 10) * 100) / 100,
        message: `Pontuação ${score.toFixed(1)}/10 — há oportunidades de melhora na proporcionalidade facial.`,
      });
    }

    // Sort descending by severity
    return concerns.sort((a, b) => b.severity - a.severity);
  }

  private _buildSummary(topConcerns: ConcernDto[]): string {
    if (topConcerns.length === 0) {
      return 'Análise concluída. Nenhum ponto crítico identificado.';
    }
    const labels = topConcerns.map((concern) => concern.label).join(', ');
    return `Principais pontos de atenção: ${labels}.`;
  }

  // ─────────────────────────────────────────────────────────
  // PR-53 — Templates CRUD for admin UI
  // ─────────────────────────────────────────────────────────

  async getTemplates(filter?: { metricId?: string; size?: string }) {
    let query = this.templateRepository.createQueryBuilder('t');

    if (filter?.metricId) {
      query = query.where('t.metricId = :metricId', { metricId: filter.metricId });
    }
    if (filter?.size) {
      query = query.andWhere('t.size = :size', { size: filter.size });
    }

    return query
      .orderBy('t.metricId', 'ASC')
      .addOrderBy('t.severity', 'ASC')
      .addOrderBy('t.size', 'ASC')
      .getMany();
  }

  async getTemplateById(id: string) {
    const template = await this.templateRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template não encontrado: ${id}`);
    }
    return template;
  }

  async getTemplateMetrics() {
    const templates = await this.templateRepository
      .createQueryBuilder('t')
      .select('DISTINCT t.metricId', 'metricId')
      .orderBy('t.metricId', 'ASC')
      .getRawMany();
    return templates.map((row: any) => ({ metricId: row.metricId }));
  }

  async updateTemplate(id: string, templatePt: string) {
    const template = await this.getTemplateById(id);
    template.templatePt = templatePt;
    return this.templateRepository.save(template);
  }
}
