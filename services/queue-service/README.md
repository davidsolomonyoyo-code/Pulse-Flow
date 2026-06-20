# Queue Service

Queue item lifecycle, deterministic priority scoring, reservation. See
`docs/MASTER_SPEC.md` Section 4.2 at the repo root for the full spec this
implements.

## Run locally

```bash
cp .env.example .env
npm install
npm run start:dev      # http://localhost:3002
```

Requires a reachable Postgres instance matching the `DB_*` vars in `.env`
(`infra/docker-compose.yml` at the repo root provides one).

## Test

```bash
npm test
```

The test suite that matters most here is `priority-scorer.spec.ts`: it
verifies that no amount of urgency on the soft-scored factors (acuity,
wait time, deterioration risk, etc.) can make a patient eligible when a
hard constraint — specialty match, infection isolation, age band, payer
rule, jurisdiction rule — fails. That property is load-bearing for patient
safety and is the one thing in this service that must never regress
silently.

## Concurrency

Reservation uses TypeORM's optimistic locking (`@VersionColumn` on
`QueueItem`) so two concurrent attempts to reserve the same item can't both
succeed — the second one gets a `409 Conflict` and has to reload and retry.
This exists specifically because the source planning documents flagged
double-reservation as a known failure mode for this kind of system.

## Known gaps (intentional, see root `docs/MASTER_SPEC.md` Section 7)

- No automatic expiry of stale reservations yet (a `reservedUntil` field
  exists on the entity; nothing currently sweeps it). A scheduled job or
  TTL-based check is the next piece of work here.
- No event emission yet — Kafka is deferred to Phase 3 per the master spec.
- `synchronize: true` in TypeORM config is dev-only. Real migrations are
  required before production.
