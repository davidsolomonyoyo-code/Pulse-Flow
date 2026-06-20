# PulseFlow

Healthcare patient-flow orchestration platform. Built phase-by-phase, starting
with a single-region, single-hospital MVP, per the roadmap in
`docs/MASTER_SPEC.md`.

## What's in this repo right now (Phase 1, in progress)

| Component | Status | Path |
|---|---|---|
| Identity Service (auth, RBAC) | Working scaffold, needs DB + tests run against real Postgres | `services/identity-service` |
| Queue Service (queue state machine, priority scoring) | Working scaffold + unit-tested priority scorer | `services/queue-service` |
| Shared event contracts | Initial topic/version constants | `packages/shared-events` |
| Local dev environment | Postgres + Redis via Docker Compose | `infra/docker-compose.yml` |
| CI | Lint + build + test on push/PR | `.github/workflows/ci.yml` |

**Not built yet:** Appointment Service, Notification Service, Analytics
Service, AI Service, frontend apps (`apps/`), Kafka event bus, Kubernetes
deployment (a sample manifest exists in `infra/k8s/` as a target, not yet
wired to a live cluster). These are sequenced in
`docs/MASTER_SPEC.md` Section 9 (Roadmap). Building all of this in one pass
and claiming it's production-ready would be the kind of dishonesty that gets
healthcare software pulled from real hospitals — so it isn't being claimed.

## Why this structure

Three planning documents fed into this repo:

- `PulseFlow_Master_Handbook_v1` — original vision/roadmap outline
- `PulseFlow_Master_Blueprint_v2` — technical module specs, K8s layout
- `pulseflow-enterprise-engineering-blueprint` (14-volume HTML) — the deepest
  source: DDD bounded contexts, ERD, priority-scoring formula, threat model,
  event contracts

`docs/MASTER_SPEC.md` reconciles all three into one canonical reference and
explicitly calls out where they disagreed. `docs/KENYA_CONTEXT.md` covers
what none of the three originals addressed: Kenyan regulatory anchors,
connectivity assumptions, and device/channel reality for the actual
deployment target.

## Quick start (local dev)

```bash
# 1. Start Postgres + Redis
docker compose -f infra/docker-compose.yml up -d

# 2. Identity service
cd services/identity-service
cp .env.example .env
npm install
npm run start:dev   # http://localhost:3001

# 3. Queue service (separate terminal)
cd services/queue-service
cp .env.example .env
npm install
npm run start:dev   # http://localhost:3002
```

## Repo conventions

- TypeScript, NestJS, TypeORM, PostgreSQL — locked in from `v1`, kept
  consistent across services rather than re-litigated per service.
- Each service owns its own database schema. No cross-service joins, no
  shared tables. Cross-domain reads belong in a future analytics/read-model
  layer, not in service code.
- `synchronize: true` in TypeORM config is for local dev only. Real
  migrations are required before this touches a shared or production
  database — this is flagged again in each service's README because it is
  the single easiest way to lose data in a careless deploy.
- Conventional commits recommended (`feat:`, `fix:`, `docs:`, `chore:`) once
  this is pushed to GitHub, to keep history legible across services.

## Pushing this to your GitHub repo

This was built in a sandboxed environment without push access to your
GitHub account, so it's packaged for you to add to your existing repo:

```bash
# from inside the unzipped pulseflow/ folder
git init                      # skip if your repo already exists
git remote add origin <your-repo-url>   # skip if already set
git add .
git commit -m "feat: Phase 1 scaffold — identity + queue services, master spec"
git push origin main
```

If you'd rather I push directly, connect a GitHub integration in this chat
and tell me your repo URL — I can then clone, branch, and open a PR instead
of you copy-pasting files.
