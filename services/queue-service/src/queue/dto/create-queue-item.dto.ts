import { IsBoolean, IsNumber, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateQueueItemDto {
  @IsString()
  @MinLength(1)
  queueId: string;

  @IsString()
  @MinLength(1)
  encounterRef: string;

  @IsNumber() @Min(0) @Max(1) acuityIndex: number;
  @IsNumber() @Min(0) @Max(1) normalizedWaitTime: number;
  @IsNumber() @Min(0) @Max(1) deteriorationRisk: number;
  @IsNumber() @Min(0) @Max(1) serviceLevelBreachRisk: number;
  @IsNumber() @Min(0) @Max(1) vulnerabilityAdjustment: number;
  @IsNumber() @Min(0) @Max(1) transferUrgency: number;
  @IsNumber() @Min(0) @Max(1) unresolvedDependencyPenalty: number;

  @IsBoolean() specialtyMatch: boolean;
  @IsBoolean() infectionIsolationCompatible: boolean;
  @IsBoolean() ageBandCompatible: boolean;
  @IsBoolean() payerRuleAllows: boolean;
  @IsBoolean() jurisdictionRuleAllows: boolean;
}
