import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthController } from './health/health.controller';
import { User } from './users/entities/user.entity';

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
        database: process.env.DB_NAME ?? 'pulseflow_identity',
        entities: [User],
        // Local dev convenience only — see README and .env.example.
        synchronize: process.env.DB_SYNCHRONIZE === 'true',
      }),
    }),
    AuthModule,
    UsersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
