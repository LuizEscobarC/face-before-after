import { Controller, Get, Patch, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminMetricIdealService } from './admin-metric-ideal.service.js';

@ApiTags('Admin / MetricIdeal')
@Controller('v1/admin/metric-ideals')
export class AdminMetricIdealController {
  constructor(private readonly svc: AdminMetricIdealService) {}

  @Get('versions')
  @ApiOperation({ summary: 'List available ideals versions' })
  getVersions() { return this.svc.getVersions(); }

  @Get('labels')
  @ApiOperation({ summary: 'List metric IDs with their pt-BR display names' })
  getMetricLabels() { return this.svc.getMetricLabels(); }

  @Get()
  @ApiOperation({ summary: 'List metric ideals with optional filter' })
  @ApiQuery({ name: 'idealsVersion', required: false })
  @ApiQuery({ name: 'metricId', required: false })
  list(@Query('idealsVersion') idealsVersion?: string, @Query('metricId') metricId?: string) {
    return this.svc.list({ idealsVersion, metricId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single metric ideal by id' })
  getById(@Param('id') id: string) { return this.svc.getById(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update numeric ranges and notes for a metric ideal' })
  update(@Param('id') id: string, @Body() body: {
    idealCentralValue?: number | null;
    greenRangeMin?: number | null;
    greenRangeMax?: number | null;
    yellowRangeMin?: number | null;
    yellowRangeMax?: number | null;
    populationReferenceNote?: string | null;
  }) {
    if (!body || Object.keys(body).length === 0) throw new BadRequestException('Body vazio.');
    return this.svc.update(id, body);
  }
}
