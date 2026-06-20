import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('healthz')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Liveness: process is up and able to respond at all.
  @Get('livez')
  livez() {
    return { status: 'ok' };
  }

  // Readiness: dependencies (DB) are actually reachable. A pod that's
  // alive but can't reach Postgres should not receive traffic.
  @Get('readyz')
  async readyz() {
    const isDbConnected = this.dataSource.isInitialized;
    return {
      status: isDbConnected ? 'ok' : 'degraded',
      database: isDbConnected ? 'connected' : 'disconnected',
    };
  }
}
