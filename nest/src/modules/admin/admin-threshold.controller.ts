import { Controller, Get, Patch, Post, Param, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminThresholdService } from './admin-threshold.service.js';

@ApiTags('Admin / ThresholdConfig')
@Controller('v1/admin/threshold-configs')
export class AdminThresholdController {
  constructor(private readonly svc: AdminThresholdService) {}

  @Get()
  @ApiOperation({ summary: 'List all threshold config versions' })
  list() { return this.svc.list(); }

  @Get(':version')
  @ApiOperation({ summary: 'Get threshold config by version' })
  getByVersion(@Param('version') version: string) { return this.svc.getByVersion(version); }

  @Patch(':version')
  @ApiOperation({ summary: 'Update threshold config values' })
  update(@Param('version') version: string, @Body() body: {
    minConfidenceToDisplayMetric?: number;
    minConfidenceToShowGlobalScore?: number;
    scoreBandNoNumberMax?: number;
    scoreBandRefineMax?: number;
    scoreBandGoodMax?: number;
    disclaimerTextSnapshot?: string;
  }) {
    if (!body || Object.keys(body).length === 0) throw new BadRequestException('Body vazio.');
    return this.svc.update(version, body);
  }

  @Post(':version/activate')
  @ApiOperation({ summary: 'Set this config version as active (deactivates others)' })
  setActive(@Param('version') version: string) { return this.svc.setActive(version); }
}
