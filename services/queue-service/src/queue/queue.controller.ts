import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { QueueService } from './queue.service';
import { CreateQueueItemDto } from './dto/create-queue-item.dto';
import { ReserveQueueItemDto, EscalateQueueItemDto } from './dto/queue-actions.dto';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateQueueItemDto) {
    return this.queueService.create(dto);
  }

  @Get('items')
  list(@Query('queueId') queueId: string) {
    return this.queueService.listByQueue(queueId);
  }

  @Post('items/:id/reserve')
  reserve(@Param('id') id: string, @Body() dto: ReserveQueueItemDto) {
    return this.queueService.reserve(id, dto);
  }

  @Post('items/:id/release')
  release(@Param('id') id: string) {
    return this.queueService.release(id);
  }

  @Post('items/:id/start')
  start(@Param('id') id: string) {
    return this.queueService.start(id);
  }

  @Post('items/:id/complete')
  complete(@Param('id') id: string) {
    return this.queueService.complete(id);
  }

  @Post('items/:id/escalate')
  escalate(@Param('id') id: string, @Body() dto: EscalateQueueItemDto) {
    return this.queueService.escalate(id, dto);
  }
}
