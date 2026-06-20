# PulseFlow — Master Specification (Canonical)

Status: living document. Supersedes `PulseFlow_Master_Handbook_v1`,
`PulseFlow_Master_Blueprint_v2`, and the 14-volume
`pulseflow-enterprise-engineering-blueprint` for anything where they
disagreed. Those three remain useful as deep-dive reference material
(especially the 14-volume blueprint — its DDD modeling, threat matrix, and
event-storming spine are sound and are inherited here), but this document is
what the build follows.

## 1. What PulseFlow is

An operational coordination layer for patient flow — triage, queueing,
appointments, routing, capacity, and the analytics/AI layered on top of
that — sitting alongside the hospital's EHR/HIS, not replacing it as the
legal clinical record.

Non-negotiable design stance, inherited from the 14-volume blueprint because
it's the single most important sentence across all three sources: in
healthcare operations, **being explicitly and visibly delayed is better than
being silently wrong**. The system favors observable eventual consistency
with explicit reconciliation over pretending to be globally synchronous.

## 2. Where the three source documents disagreed

| Topic | v1 Handbook | v2 Blueprint | 14-Volume Blueprint | Resolution used here |
|---|---|---|---|---|
| AI's role | "AI Prediction Engine" listed as a standalone product | "AI Service" with defined responsibilities | AI explicitly bounded: rules-first, ML-assist second, human override always possible, per-use-case risk/control table | **14-volume framing wins.** AI never makes an unreviewable routing or staffing decision. This is a patient-safety line, not a style preference. |
| Compliance anchor | Not specified | HIPAA, GDPR | HIPAA-aligned PHI handling, GDPR lawful processing | **Neither is sufficient alone.** HIPAA is a US statute with no force in Kenya. See `KENYA_CONTEXT.md` for the actual applicable regime. |
| Tech stack | Explicitly named: NestJS, React/Next.js, React Native, PostgreSQL, Redis, Kafka, Elasticsearch, Docker, Kubernetes | Stack-agnostic | Stack-agnostic | **v1's stack is kept and locked.** Re-opening framework choice mid-project is a common, avoidable failure mode. Kafka is deferred to Phase 3 (see Section 9) rather than introduced in Phase 1 — outbox + polling is enough for a single hospital and avoids operating a Kafka cluster before there's a second hospital to justify it. |
| Offline operation | Not mentioned | Not mentioned | Mentioned once ("offline-tolerant edge operations") with no architecture behind it | **Net-new work, not inherited from anywhere.** See `KENYA_CONTEXT.md` Section 3. |

## 3. Core domains (bounded contexts)

Identity · Patient · Triage & Flow · Scheduling · Clinical · Operations ·
Analytics & AI · Audit & Compliance.

Each owns its own write schema. Cross-domain reads happen in read models or
a future analytics layer — never via direct cross-service database access.
This rule exists specifically to prevent the "giant operational monolith
with extra network hops" failure mode that kills systems this size.

## 4. Phase 1 services (what's actually built in this repo)

### 4.1 Identity Service

Responsibilities: registration, login, token refresh, RBAC.

```
POST /auth/register   { email, password, fullName, role }
POST /auth/login       { email, password } -> { accessToken, refreshToken }
POST /auth/refresh      { refreshToken } -> { accessToken }
GET  /healthz/livez
GET  /healthz/readyz
```

Roles at MVP: `PATIENT`, `NURSE`, `DOCTOR`, `RECEPTIONIST`, `ADMIN`.
Passwords hashed with bcrypt. Access tokens short-lived (15 min), refresh
tokens longer-lived and rotated on use.

### 4.2 Queue Service

Responsibilities: queue item lifecycle, priority scoring, reservation.

State machine (inherited from the 14-volume blueprint, Volume 5):

```
Created -> Eligible -> Reserved -> InService -> Completed
              |            |
              |            +--> ReservationExpired -> Eligible
              +--> BlockedByDependency -> Eligible
              +--> Escalated -> ReservedByOverride
```

Priority scoring (inherited from the 14-volume blueprint, Volume 3 — this
formula is the right shape and is implemented as written):

```
priority_score(p) =
    w_acuity        * acuity_index(p)
  + w_wait          * normalized_wait_time(p)
  + w_deterioration * deterioration_risk(p)
  + w_service       * service_level_breach_risk(p)
  + w_equity        * vulnerability_adjustment(p)
  + w_transfer      * transfer_urgency(p)
  - w_blocker       * unresolved_dependency_penalty(p)

subject to hard constraints (any failure -> ineligible, not just low-scored):
  specialty_match == true
  infection_isolation_compatible == true
  age_band_compatible == true
  payer_rule_allows == true
  jurisdiction_rule_allows == true
```

Implemented in `services/queue-service/src/queue/priority/priority-scorer.ts`
with unit tests covering: normal scoring, each individual hard-constraint
rejection, and the case where multiple constraints fail simultaneously.

**Concurrency control:** the source documents correctly flag double
reservation (two routing decisions consuming the same scarce slot) as a real
risk. This is handled with an optimistic-locking version column on
`queue_item` plus a transactional reserve operation — not left as a TODO.

```
POST   /queue/:queueId/items                create queue item
GET    /queue/:queueId/items                list, ordered by priority_score desc
POST   /queue/items/:id/reserve             transactional reserve (optimistic lock)
POST   /queue/items/:id/release              return to Eligible
POST   /queue/items/:id/complete
POST   /queue/items/:id/escalate             emergency override — requires reason + actor, always audited
GET    /healthz/livez
GET    /healthz/readyz
```

Emergency overrides bypass normal ranking but never bypass auditing —
inherited directly from the 14-volume blueprint's framing: "Silent overrides
are malpractice in software form." Every escalate call requires an actor ID
and a reason string; both are persisted on the queue item record.

## 5. Database (Phase 1 scope only)

```
users (id, email, password_hash, full_name, role, created_at)
queue_items (id, queue_id, encounter_ref, status, priority_score,
             priority_breakdown_json, reserved_by, reserved_until,
             version, created_at, updated_at)
```

Full ERD for later phases (patient, encounter, appointment, audit_event,
routing_decision, event_outbox, etc.) is specified in the 14-volume
blueprint, Volume 4, and is not re-derived here — it's sound as written and
will be implemented service-by-service as each phase begins.

## 6. Security baseline (applies now, not "later")

- JWT access + refresh tokens, short-lived access tokens.
- Passwords: bcrypt, never logged, never returned in any response body.
- RBAC enforced via guard + decorator on every non-public route.
- No secrets in source control — `.env` is gitignored, `.env.example`
  contains only placeholder values.
- TLS termination assumed at the ingress/load balancer in any real
  deployment; this repo's local dev setup is plaintext HTTP and is **not**
  representative of a deployable configuration.

## 7. What this repo deliberately does not do yet

- No Kafka / event bus (deferred to Phase 3 per Section 2).
- No frontend apps.
- No AI/prediction service.
- No multi-hospital or multi-tenant data isolation — Phase 1 is explicitly
  single-hospital, single-region, per the 14-volume blueprint's own roadmap.
- No production Kubernetes deployment — a sample manifest exists in
  `infra/k8s/` as a forward-looking target, it is not connected to a live
  cluster, and should not be treated as "deployed" until it has been.

Listing these isn't hedging — it's what separates a real Phase 1 from a
slide that says "Phase 1: done."

## 8. Roadmap (inherited from the 14-volume blueprint, Volume 14)

1. **MVP** — single clinic: triage, appointments, queue visibility,
   notifications, audit. *(This repo covers identity + queue only, the
   narrowest useful slice of MVP.)*
2. **Production** — hospital-grade resilience, role hardening, integration
   suite, formal DR.
3. **Multi-Hospital** — transfer workflows, capacity-aware routing, bed
   coordination. Kafka introduced here.
4. **Regional** — command center, forecasting, partner APIs.
5. **National** — sovereign data controls, policy overlays, public-health
   visibility.
6. **Global** — cross-border templates, localization, compliance
   modularization.

Each phase gate requires the previous phase's KPIs to actually be met, not
just code-complete. The 14-volume blueprint's own closing line is worth
repeating here because it's correct: the biggest risk isn't Kubernetes,
Kafka, or AI — it's semantic inconsistency between institutions and the
politics of operational change. No amount of good architecture substitutes
for a real pilot-hospital partnership and a governance plan, and neither
exists yet for this project.
