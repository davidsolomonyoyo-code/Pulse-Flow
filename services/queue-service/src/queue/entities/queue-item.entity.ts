import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

export enum QueueItemStatus {
  CREATED = 'CREATED',
  ELIGIBLE = 'ELIGIBLE',
  RESERVED = 'RESERVED',
  IN_SERVICE = 'IN_SERVICE',
  COMPLETED = 'COMPLETED',
  BLOCKED_BY_DEPENDENCY = 'BLOCKED_BY_DEPENDENCY',
  RESERVED_BY_OVERRIDE = 'RESERVED_BY_OVERRIDE',
  CANCELLED = 'CANCELLED',
}

@Entity({ name: 'queue_items' })
export class QueueItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Scoped per facility/department. Kept as a plain string for Phase 1;
  // see docs/KENYA_CONTEXT.md — this is the field a KMHFL facility code
  // attaches to once multi-facility support exists.
  @Index()
  @Column({ type: 'varchar', length: 128 })
  queueId: string;

  // Reference to the encounter this ticket belongs to. No FK to a
  // patient/encounter table yet — Patient Service doesn't exist in this
  // repo yet (see docs/MASTER_SPEC.md Section 7).
  @Column({ type: 'varchar', length: 128 })
  encounterRef: string;

  @Column({ type: 'enum', enum: QueueItemStatus, default: QueueItemStatus.CREATED })
  status: QueueItemStatus;

  @Column({ type: 'float', nullable: true })
  priorityScore: number | null;

  @Column({ type: 'jsonb', nullable: true })
  priorityBreakdown: Record<string, number> | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  reservedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reservedUntil: Date | null;

  // Set only when status is an override-related state. Always paired with
  // escalationReason — see docs/MASTER_SPEC.md Section 4.2 on overrides
  // never being silent.
  @Column({ type: 'varchar', length: 128, nullable: true })
  escalatedBy: string | null;

  @Column({ type: 'text', nullable: true })
  escalationReason: string | null;

  // Optimistic locking. TypeORM increments this automatically on every
  // save and rejects a save whose version doesn't match what's in the DB,
  // which is exactly the compare-and-swap behavior the source blueprint
  // calls for to prevent double reservation of the same queue item.
  @VersionColumn()
  version: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
