import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service.js';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Root health check (ELB) — sem dependência externa' })
  @ApiResponse({ status: 200, description: 'OK' })
  root(): unknown {
    return {
      status: 'ok',
      service: 'face-orchestrator',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'OK' })
  check(): unknown {
    return this.healthService.check();
  }
}
