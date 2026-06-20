import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('healthz')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get('livez')
  livez() {
    return { status: 'ok' };
  }

  @Get('readyz')
  async readyz() {
    const isDbConnected = this.dataSource.isInitialized;
    return {
      status: isDbConnected ? 'ok' : 'degraded',
      database: isDbConnected ? 'connected' : 'disconnected',
    };
  }
}
