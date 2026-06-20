import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueModule } from './queue/queue.module';
import { HealthController } from './health/health.controller';
import { QueueItem } from './queue/entities/queue-item.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
        username: process.env.DB_USERNAME ?? 'pulseflow',
        password: process.env.DB_PASSWORD ?? 'changeme',
        database: process.env.DB_NAME ?? 'pulseflow_queue',
        entities: [QueueItem],
        // Local dev convenience only — see README and .env.example.
        synchronize: process.env.DB_SYNCHRONIZE === 'true',
      }),
    }),
    QueueModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
