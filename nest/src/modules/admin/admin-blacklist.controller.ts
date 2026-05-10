import { Controller, Get, Post, Patch, Delete, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminBlacklistService } from './admin-blacklist.service.js';
import type { BlacklistCategory } from './entities/template-blacklist.entity.js';

@ApiTags('Admin / TemplateBlacklist')
@Controller('v1/admin/blacklist')
export class AdminBlacklistController {
  constructor(private readonly svc: AdminBlacklistService) {}

  @Get('versions')
  @ApiOperation({ summary: 'List blacklist versions' })
  getVersions() { return this.svc.getVersions(); }

  @Get()
  @ApiOperation({ summary: 'List blacklist terms with optional filter' })
  @ApiQuery({ name: 'version', required: false })
  @ApiQuery({ name: 'category', required: false })
  list(@Query('version') version?: string, @Query('category') category?: string) {
    return this.svc.list({ version, category });
  }

  @Post()
  @ApiOperation({ summary: 'Add a new blacklist term' })
  create(@Body() body: { version: string; term: string; category: BlacklistCategory; notes?: string }) {
    if (!body) throw new BadRequestException('Body vazio.');
    return this.svc.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update notes or category for a blacklist term' })
  update(@Param('id') id: string, @Body() body: { notes?: string; category?: BlacklistCategory }) {
    if (!body || Object.keys(body).length === 0) throw new BadRequestException('Body vazio.');
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a blacklist term' })
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
