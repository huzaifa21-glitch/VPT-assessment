# Community Health Field Survey — Backend

Backend for the take-home assignment: field workers collect household/health data offline via a
mobile app; a web app lets a Super Admin manage field workers and review what's been collected.
This repo is the **backend only** — a Node.js/Express API, a Postgres database (via Prisma), Redis
caching, and a BullMQ background worker.

## Tech stack & why

- **Node.js + Express** — plain JavaScript (CommonJS, `require`/`module.exports`), no TypeScript,
  no build step. Run the `.js` files directly.
- **PostgreSQL + Prisma** — Prisma is the ORM and migration tool.
- **Redis** — used for (a) BullMQ's queue storage and (b) caching dashboard stats.
- **BullMQ** — background job queue, processed by a worker process kept separate from the API.
- **JWT (access + refresh)** — see Authentication below.
- **Zod** — request validation.
- **Vitest** — test runner.

## Project layout

```
.
├── prisma/
│   ├── schema.prisma      # database schema (source of truth)
│   └── seed.js            # creates the super admin + sample data
├── src/
│   ├── app.js             # Express app: middleware + route mounting
│   ├── server.js          # HTTP server entry point (the API process)
│   ├── worker.js           # BullMQ worker entry point (a SEPARATE process)
│   ├── config/env.js       # reads & validates environment variables
│   ├── prisma/client.js    # shared PrismaClient instance
│   ├── redis/              # shared ioredis client + a small cache-aside helper
│   ├── jobs/               # BullMQ queue definition + the urgent-assessment processor
│   ├── common/
│   │   ├── errors/         # AppError hierarchy (BadRequest, Unauthorized, Forbidden, ...)
│   │   ├── middleware/      # authenticate, authorize, validate, error-handler
│   │   └── utils/           # asyncHandler, assertAreaAccess
│   └── modules/             # one folder per resource: auth, users, areas, households,
│                             # household-members, health-assessments, sync, dashboard
│                             # each with routes.js -> controller.js -> service.js (+ schema.js)
├── test/                    # vitest tests, mirrors src/ layout
├── docker-compose.yml       # local Postgres + Redis (optional — see "Running the backend" below)
├── Dockerfile               # containerizes the API itself (optional)
├── .env.example
└── vitest.config.js
```

Every module follows the same request flow:

```
routes.js → middleware (authenticate, authorize, validate) → controller.js → service.js → Prisma
```

Reusable pieces used across every module, so logic isn't repeated per route:
- `asyncHandler(fn)` — wraps async handlers so a thrown/rejected error reaches Express's error
  middleware instead of crashing the process.
- `validate(schema, target)` — a Zod-validation middleware factory (`target` is `'body'`, `'query'`,
  or `'params'`).
- `authenticate` — verifies the JWT access token, attaches `req.user = { id, role, areaId }`.
- `authorize(...roles)` — rejects the request with `403` if `req.user.role` isn't in the allowed list.
- `assertAreaAccess(user, resourceAreaId)` — the single place that decides whether a field worker
  is allowed to touch a given household/member/assessment (admins always pass).
- `errorHandler` — turns any thrown error (or a known Prisma error) into one consistent JSON shape.

## What's implemented

- **Auth**: login, JWT access token (15 min) + rotating/revocable refresh token (30 days), logout,
  bcrypt password hashing.
- **RBAC**: `SUPER_ADMIN` and `FIELD_WORKER` roles, enforced on the backend (not just hidden in a
  UI) — every admin-only route rejects a field-worker token with `403`, and every household/member/
  assessment route checks the record's actual area against the caller's assigned area.
- **Areas, Households, Household Members, Health Assessments**: full CRUD, with soft deletes
  (`deletedAt`) and an incrementing `version` column on every syncable entity.
- **Offline sync**: `POST /api/v1/sync/push` (batched, idempotent, version-conflict-aware) and
  `GET /api/v1/sync/pull` (area-scoped delta pull, including tombstones for deletions).
- **Redis caching**: dashboard stats, cache-aside with a 60s TTL + explicit invalidation on writes.
- **BullMQ background job**: an assessment with fever + breathing difficulty (or a manual
  "flag for review") enqueues a job that writes an `ActivityLog` row the admin dashboard can read —
  processed by a worker running as its own process, with retries and duplicate-processing guards.
- **Tests**: RBAC/area-scoping logic, auth middleware, and the sync module's conflict-detection and
  idempotency behavior (see `test/`).

Full details on auth, RBAC, the sync contract, conflict resolution, caching, and background jobs
are in the "Design notes" section further down — read that if you want the *why*, not just the *how*.

## Running the backend

You have **two ways to get Postgres + Redis** — pick whichever is easier for you. Everything else
(installing Node deps, running migrations, starting the API) is identical either way.

### Option A — Docker Compose (runs Postgres + Redis on your machine)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
(the whale icon in your system tray/menu bar should say "Engine running", not "stopped").

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` and Redis on `localhost:6379` — matching the defaults
already in `.env.example`, so you won't need to edit `DATABASE_URL` / `REDIS_URL` at all.

To stop them later: `docker compose down` (add `-v` to also wipe the data volume).

### Option B — Hosted free-tier Postgres + Redis (no Docker needed)

If you don't want to run Docker locally, use two free hosted services instead:

- **[Neon](https://neon.tech)** for Postgres — sign up, create a project, copy the connection
  string it shows you. That's your `DATABASE_URL`.
- **[Upstash](https://upstash.com)** for Redis — sign up, create a Redis database, copy the
  `rediss://...` connection string. That's your `REDIS_URL`.

Both have generous free tiers and need no credit card. `rediss://` (note the double `s`) means TLS —
the Redis client in this project already handles that automatically, no code changes needed.

### Then, either way:

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env:
#   - If you used Option A (Docker), you can leave DATABASE_URL / REDIS_URL as-is.
#   - If you used Option B (Neon/Upstash), paste in the connection strings you copied.

# 3. Generate the Prisma client (downloads a query engine binary — needs internet access)
npm run prisma:generate

# 4. Create the database tables
npm run prisma:migrate -- --name init

# 5. Seed a super admin + sample data
npm run seed

# 6. Run the API
npm run dev
# → http://localhost:4000  (try http://localhost:4000/health to confirm it's up)

# 7. In a SECOND terminal, run the background worker
npm run worker:dev
```

### Seeded login credentials

Printed to the console by `npm run seed`, and also documented here:

| Role         | Email                              | Password          |
|--------------|-------------------------------------|--------------------|
| Super Admin  | `admin@healthsurvey.local`          | `ChangeMe123!`     |
| Field Worker | `fieldworker1@healthsurvey.local`   | `FieldWorker123!`  |

(Override the super admin's via `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` in `.env`.)

### Tests

```bash
npm test
```

> Two of the four test files (`test/modules/*`) mock Prisma directly and need the generated client
> to exist first (step 3 above) — run `npm run prisma:generate` before `npm test` if you haven't
> already. The other two (`test/common/*`) have no dependency on Prisma/DB/Redis and always run.

---

## Design notes

### Authentication

- **Access token**: JWT, 15 minutes, signed with `JWT_ACCESS_SECRET`. Payload: `{ sub, role, areaId }`.
  Sent as `Authorization: Bearer <token>`.
- **Refresh token**: JWT, 30 days, signed with a *separate* secret (`JWT_REFRESH_SECRET`). Its
  SHA-256 hash (never the raw token) is stored in the `RefreshToken` table with a `revoked` flag.
- `POST /api/v1/auth/login` issues both. `POST /api/v1/auth/refresh` verifies the refresh token,
  checks it against the stored hash, then **rotates** it — the old one is revoked, a new pair is
  issued. A stolen refresh token replayed after rotation fails immediately.
- `POST /api/v1/auth/logout` marks the refresh token's row `revoked`. The short-lived access token
  in flight just expires naturally — there's no access-token blacklist, which keeps this simple
  while still making logout meaningful.

### Authorization (RBAC)

- `authenticate` populates `req.user`. `authorize(...roles)` is applied per-route — e.g. every
  `/users/field-workers/*` route requires `SUPER_ADMIN`; calling it with a field-worker token
  returns `403`.
- Data-level scoping isn't trusted from request input — `assertAreaAccess` resolves the *actual*
  area of the household/member/assessment being touched from the database, then compares it to
  `req.user.areaId`. A field worker can't page through another area's data by editing a query param.

### Synchronization

`POST /api/v1/sync/push` takes a batch of offline-queued changes:

```jsonc
{
  "changes": [
    {
      "clientChangeId": "uuid",       // generated on-device — drives idempotency
      "entityType": "HOUSEHOLD" | "HOUSEHOLD_MEMBER" | "HEALTH_ASSESSMENT",
      "entityId": "uuid",             // client-generated on CREATE, so ids are stable offline
      "operation": "CREATE" | "UPDATE" | "DELETE",
      "baseVersion": number | null,   // version the client last saw; null for CREATE
      "payload": { /* ... */ },
      "clientTimestamp": "ISO string"
    }
  ]
}
```

Each change is processed independently — one failing/conflicting change never blocks the rest of
the batch. Every processed `clientChangeId` is recorded in a `SyncLog` table; a repeated request
(retry, duplicate network send) replays the stored result instead of reapplying it.

`GET /api/v1/sync/pull?since=<ISO timestamp>` returns everything created/updated/soft-deleted since
that time, scoped to the caller's area (or unscoped for an admin) — used both to warm a mobile
client's local store and to pick up changes made elsewhere while it was offline.

### Conflict resolution

Version-based optimistic concurrency, not last-write-wins. Every syncable entity has an integer
`version`, incremented on every write. If a queued change's `baseVersion` doesn't match the current
server version, the change is **not applied** — the response is `CONFLICT` with the current server
copy, and it's up to the client to reconcile (re-show the user the current state, let them redo
their edit as a fresh change against the new version).

### Offline deletions

All deletes are soft (`deletedAt` timestamp, not a removed row). A queued `DELETE` follows the same
version-check as an update; if the record's already deleted, it's a no-op (idempotent replay); if
someone edited it since the client last saw it, it comes back as a `CONFLICT` rather than silently
deleting data someone just changed.

### Caching

Cache-aside pattern on `GET /dashboard/stats`: check Redis first, compute via Prisma `count()`
queries on a miss, cache for 60 seconds. Every write that changes those counts (household create/
delete, field-worker create, assessment create/delete) explicitly invalidates the cache key, so the
60s TTL is a safety net rather than the only mechanism.

### Background jobs

An assessment is "urgent" if `hasFever && hasBreathingDifficulty`, or a manual `flagForReview: true`
is set. A job is enqueued only on the **false → true transition** (editing an already-urgent
assessment doesn't spam jobs), with a stable `jobId` so BullMQ itself dedupes a re-add, and the
worker also checks for an existing `ActivityLog` row before writing one (covers a crash-and-reprocess
edge case). Jobs retry 3 times with exponential backoff; failures are logged with the attempt count.
The worker (`src/worker.js`) is a separate process from the API (`src/server.js`) — a slow or
failing job never blocks HTTP requests.

## Trade-offs / what I'd do with more time

- No field-level merge for conflicts — version conflicts are surfaced, not auto-resolved.
- No rate limiting on `/auth/login`.
- No refresh-token-reuse detection (flagging all of a user's tokens if a revoked one is replayed).
- No pagination on `/sync/pull` — fine at this scale, would need chunking for a very large area.
- Minimal logging/tracing (just `morgan` + `console`).
- The web (React admin) and mobile (React Native field-worker) apps aren't part of this repo/branch.
