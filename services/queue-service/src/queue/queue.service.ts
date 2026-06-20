import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OptimisticLockVersionMismatchError, Repository } from 'typeorm';
import { QueueItem, QueueItemStatus } from './entities/queue-item.entity';
import { CreateQueueItemDto } from './dto/create-queue-item.dto';
import { ReserveQueueItemDto, EscalateQueueItemDto } from './dto/queue-actions.dto';
import { PriorityScorer } from './priority/priority-scorer';

const DEFAULT_HOLD_MINUTES = 10;

// Explicit allowed-transition map. Anything not listed here is rejected.
// This exists specifically because "double reservation" and "invalid
// state jump" are the failure modes the source blueprint calls out by
// name — an explicit map is easier to audit than scattered if-statements.
const ALLOWED_TRANSITIONS: Record<QueueItemStatus, QueueItemStatus[]> = {
  [QueueItemStatus.CREATED]: [QueueItemStatus.ELIGIBLE, QueueItemStatus.BLOCKED_BY_DEPENDENCY],
  [QueueItemStatus.ELIGIBLE]: [
    QueueItemStatus.RESERVED,
    QueueItemStatus.RESERVED_BY_OVERRIDE,
    QueueItemStatus.BLOCKED_BY_DEPENDENCY,
    QueueItemStatus.CANCELLED,
  ],
  [QueueItemStatus.RESERVED]: [
    QueueItemStatus.IN_SERVICE,
    QueueItemStatus.ELIGIBLE, // release / reservation expired
    QueueItemStatus.CANCELLED,
  ],
  [QueueItemStatus.RESERVED_BY_OVERRIDE]: [
    QueueItemStatus.IN_SERVICE,
    QueueItemStatus.ELIGIBLE,
    QueueItemStatus.CANCELLED,
  ],
  [QueueItemStatus.IN_SERVICE]: [QueueItemStatus.COMPLETED, QueueItemStatus.CANCELLED],
  [QueueItemStatus.BLOCKED_BY_DEPENDENCY]: [
    QueueItemStatus.ELIGIBLE,
    QueueItemStatus.CANCELLED,
  ],
  [QueueItemStatus.COMPLETED]: [],
  [QueueItemStatus.CANCELLED]: [],
};

@Injectable()
export class QueueService {
  private readonly priorityScorer = new PriorityScorer();

  constructor(
    @InjectRepository(QueueItem)
    private readonly queueItemRepository: Repository<QueueItem>,
  ) {}

  async create(dto: CreateQueueItemDto): Promise<QueueItem> {
    const result = this.priorityScorer.score(
      {
        acuityIndex: dto.acuityIndex,
        normalizedWaitTime: dto.normalizedWaitTime,
        deteriorationRisk: dto.deteriorationRisk,
        serviceLevelBreachRisk: dto.serviceLevelBreachRisk,
        vulnerabilityAdjustment: dto.vulnerabilityAdjustment,
        transferUrgency: dto.transferUrgency,
        unresolvedDependencyPenalty: dto.unresolvedDependencyPenalty,
      },
      {
        specialtyMatch: dto.specialtyMatch,
        infectionIsolationCompatible: dto.infectionIsolationCompatible,
        ageBandCompatible: dto.ageBandCompatible,
        payerRuleAllows: dto.payerRuleAllows,
        jurisdictionRuleAllows: dto.jurisdictionRuleAllows,
      },
    );

    if (!result.eligible) {
      // A hard-constraint failure means this queue is not a valid
      // destination for this patient at all — not "low priority." With
      // only a single queue per facility in this Phase 1 scaffold, the
      // correct behavior is to refuse creation and surface exactly which
      // constraints failed, rather than silently queueing an unsafe match.
      throw new BadRequestException({
        message: 'Patient does not satisfy hard constraints for this queue.',
        failedConstraints: result.failedConstraints,
      });
    }

    const queueItem = this.queueItemRepository.create({
      queueId: dto.queueId,
      encounterRef: dto.encounterRef,
      status: QueueItemStatus.ELIGIBLE,
      priorityScore: result.score,
      priorityBreakdown: result.breakdown,
    });

    return this.queueItemRepository.save(queueItem);
  }

  async listByQueue(queueId: string): Promise<QueueItem[]> {
    return this.queueItemRepository.find({
      where: { queueId },
      order: { priorityScore: 'DESC' },
    });
  }

  async reserve(id: string, dto: ReserveQueueItemDto): Promise<QueueItem> {
    const item = await this.findOrThrow(id);
    this.assertTransitionAllowed(item.status, QueueItemStatus.RESERVED);

    item.status = QueueItemStatus.RESERVED;
    item.reservedBy = dto.reservedBy;
    item.reservedUntil = new Date(
      Date.now() + (dto.holdMinutes ?? DEFAULT_HOLD_MINUTES) * 60_000,
    );

    return this.saveWithOptimisticLock(item);
  }

  async release(id: string): Promise<QueueItem> {
    const item = await this.findOrThrow(id);
    this.assertTransitionAllowed(item.status, QueueItemStatus.ELIGIBLE);

    item.status = QueueItemStatus.ELIGIBLE;
    item.reservedBy = null;
    item.reservedUntil = null;

    return this.saveWithOptimisticLock(item);
  }

  async start(id: string): Promise<QueueItem> {
    const item = await this.findOrThrow(id);
    this.assertTransitionAllowed(item.status, QueueItemStatus.IN_SERVICE);

    item.status = QueueItemStatus.IN_SERVICE;

    return this.saveWithOptimisticLock(item);
  }

  async complete(id: string): Promise<QueueItem> {
    const item = await this.findOrThrow(id);
    this.assertTransitionAllowed(item.status, QueueItemStatus.COMPLETED);

    item.status = QueueItemStatus.COMPLETED;

    return this.saveWithOptimisticLock(item);
  }

  /**
   * Emergency override. Bypasses normal reservation eligibility checks on
   * purpose — that's what an override is for — but never bypasses
   * attribution. actor and reason are mandatory (enforced by the DTO) and
   * persisted on the record itself, not just in a separate log line that's
   * easy to lose track of.
   */
  async escalate(id: string, dto: EscalateQueueItemDto): Promise<QueueItem> {
    const item = await this.findOrThrow(id);
    this.assertTransitionAllowed(item.status, QueueItemStatus.RESERVED_BY_OVERRIDE);

    item.status = QueueItemStatus.RESERVED_BY_OVERRIDE;
    item.reservedBy = dto.actor;
    item.escalatedBy = dto.actor;
    item.escalationReason = dto.reason;
    item.reservedUntil = new Date(Date.now() + DEFAULT_HOLD_MINUTES * 60_000);

    return this.saveWithOptimisticLock(item);
  }

  private async findOrThrow(id: string): Promise<QueueItem> {
    const item = await this.queueItemRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Queue item ${id} not found.`);
    }
    return item;
  }

  private assertTransitionAllowed(from: QueueItemStatus, to: QueueItemStatus): void {
    if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
      throw new BadRequestException(
        `Invalid queue item transition: ${from} -> ${to}.`,
      );
    }
  }

  /**
   * Saves via the repository, relying on TypeORM's @VersionColumn
   * optimistic locking to reject the write if another request modified
   * this row first (e.g. two concurrent reserve() calls on the same
   * item). This is the compare-and-swap behavior the source blueprint
   * specifically calls for to prevent double reservation.
   */
  private async saveWithOptimisticLock(item: QueueItem): Promise<QueueItem> {
    try {
      return await this.queueItemRepository.save(item);
    } catch (error) {
      if (error instanceof OptimisticLockVersionMismatchError) {
        throw new ConflictException(
          'This queue item was modified by another request. Reload and retry.',
        );
      }
      throw error;
    }
  }
}
