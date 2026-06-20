import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class ReserveQueueItemDto {
  @IsString()
  @MinLength(1)
  reservedBy: string; // actor id (staff member / system component)

  @IsOptional()
  @IsInt()
  holdMinutes?: number; // defaults to 10 in the service if omitted
}

export class EscalateQueueItemDto {
  @IsString()
  @MinLength(1)
  actor: string;

  @IsString()
  @MinLength(5, {
    message:
      'Escalation reason must be meaningful — overrides are audited and a one-word reason is not an acceptable record for a clinical override.',
  })
  reason: string;
}
