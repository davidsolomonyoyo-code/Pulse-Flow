import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueItem } from './entities/queue-item.entity';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';

@Module({
  imports: [TypeOrmModule.forFeature([QueueItem])],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
