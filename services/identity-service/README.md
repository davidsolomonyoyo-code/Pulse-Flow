# Identity Service

Registration, login, token refresh, RBAC. See `docs/MASTER_SPEC.md`
Section 4.1 at the repo root for the full spec this implements.

## Run locally

```bash
cp .env.example .env   # then edit the secrets
npm install
npm run start:dev      # http://localhost:3001
```

Requires a reachable Postgres instance matching the `DB_*` vars in `.env`
(`infra/docker-compose.yml` at the repo root provides one).

## Test

```bash
npm test
```

Covers: password hashing on register (never stores or returns a raw
password), successful login issuing both tokens, and — the one that
matters most for a real deployment — that login returns an identical
error for "no such account" and "wrong password," so the endpoint can't be
used to enumerate valid email addresses.

## Known gaps (intentional, see root `docs/MASTER_SPEC.md` Section 7)

- No password reset flow yet.
- No account lockout / rate limiting on login attempts yet — needed before
  any real deployment, not optional.
- `synchronize: true` in TypeORM config is dev-only. Real migrations are
  required before production.
