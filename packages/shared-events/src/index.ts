/**
 * Shared event contracts. Topic naming follows the 14-volume blueprint's
 * convention: {domain}.{entity}.{event}.v{major}
 *
 * Phase 1 has no live event bus yet (Kafka is deferred to Phase 3 — see
 * docs/MASTER_SPEC.md Section 2). These constants exist now so that the
 * eventual outbox/event-emission code in each service has a single,
 * shared source of truth for topic names instead of magic strings
 * scattered across services.
 */

export const EventTopics = {
  IDENTITY_USER_REGISTERED: 'identity.user.registered.v1',
  IDENTITY_USER_LOGGED_IN: 'identity.user.logged_in.v1',
  FLOW_QUEUE_ITEM_CREATED: 'flow.queue_item.created.v1',
  FLOW_QUEUE_REORDERED: 'flow.queue.reordered.v1',
  FLOW_QUEUE_ITEM_RESERVED: 'flow.queue_item.reserved.v1',
  FLOW_QUEUE_ITEM_COMPLETED: 'flow.queue_item.completed.v1',
  FLOW_QUEUE_ITEM_ESCALATED: 'flow.queue_item.escalated.v1',
} as const;

export type EventTopic = (typeof EventTopics)[keyof typeof EventTopics];

export interface DomainEventEnvelope<TPayload = unknown> {
  eventId: string;
  eventType: EventTopic;
  eventVersion: number;
  occurredAt: string; // ISO-8601
  tenantId?: string; // facility/tenant scope — added now per Kenya context
  payload: TPayload;
}
