import { Controller, Get, Patch, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminGlobalWeightsService } from './admin-global-weights.service.js';

@ApiTags('Admin / GlobalWeights')
@Controller('v1/admin/global-weights')
export class AdminGlobalWeightsController {
  constructor(private readonly svc: AdminGlobalWeightsService) {}

  @Get('versions')
  @ApiOperation({ summary: 'List available global weight versions' })
  getVersions() { return this.svc.getVersions(); }

  @Get()
  @ApiOperation({ summary: 'List global weights optionally filtered by version' })
  @ApiQuery({ name: 'version', required: false })
  list(@Query('version') version?: string) { return this.svc.list(version); }

  @Get(':id')
  @ApiOperation({ summary: 'Get global weight by id' })
  getById(@Param('id') id: string) { return this.svc.getById(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update weight value for a region' })
  update(@Param('id') id: string, @Body() body: { weight: number }) {
    if (body?.weight === undefined) throw new BadRequestException('Campo weight obrigatório.');
    return this.svc.update(id, body.weight);
  }
}
