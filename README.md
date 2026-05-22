<p align="right">
  <b>🇬🇧 English</b> · <a href="./README.es.md">🇪🇸 Español</a>
</p>

# Aligné — Pilates Studio Booking

A booking platform for a boutique Pilates studio. Students reserve classes from packs, instructors manage attendance, and admins run the schedule. Built end-to-end by a single developer.

> **Status:** MVP under active development (Phase 0). Single-studio today; multi-tenant SaaS is on the roadmap.

## What it does

- **Students** browse the weekly schedule (or today-only view), book classes against an active pack (4 / 8 / 12 / unlimited per month), set recurring weekday bookings, and cancel up to 4 h before class.
- **Instructors** see their upcoming sessions, mark attendance and manage their day.
- **Admins** manage classes, schedules, packs, payments and users; review materialization proposals when recurring bookings overflow capacity.

## Tech stack

| Layer        | Choice                                                     |
| ------------ | ---------------------------------------------------------- |
| Frontend     | Next.js 16 · React 19 · Tailwind 4 · shadcn/ui · Base UI   |
| Backend      | NestJS 11 · TypeORM · Passport JWT                         |
| Database     | PostgreSQL (Docker for local dev)                          |
| Scheduling   | `@nestjs/schedule` cron jobs (auto-cancel, materialization)|
| Timezone     | `America/Argentina/Buenos_Aires`, SSR-stable date handling |

## Run locally

### With Docker (recommended — one command)

Prerequisites: Docker 24+.

```bash
docker compose up --build
```

That brings up PostgreSQL, the NestJS API and the Next.js frontend on the same network. First build takes ~2 minutes; subsequent runs reuse the layer cache.

- Frontend: <http://localhost:3001>
- API: <http://localhost:3000/api/v1>
- DB: `postgres://postgres:postgres@localhost:5432/pilates_db`

Tear down (keeping data): `docker compose down`. Tear down (wiping the volume): `docker compose down -v`.

### Without Docker (faster HMR for frontend work)

Prerequisites: Node 20+, Docker (for the DB), npm.

```bash
# 1. PostgreSQL via Docker
docker compose up -d db

# 2. Backend (NestJS, port 3000)
cd backend
cp .env.example .env
npm install
npm run start:dev

# 3. Frontend (Next.js, port 3001)
cd ../frontend
npm install
npm run dev
```

## Notable design decisions

- **Hydration-safe time handling.** The server passes `serverNowMs` as a prop; clients initialize state from it and refresh after mount. Avoids SSR/CSR mismatches when rendering "today" views.
- **Soft enforcement with visual warnings.** Booking rules (pack quotas, time-overlap, weekly cadence) prefer surfacing context to the user over hard blocks — except where data integrity demands it (e.g. no two bookings at the same hour).
- **Proposal-based overflow resolution.** When recurring bookings can't be materialized (schedule full), the system creates a `MaterializationProposal` instead of failing silently; the student resolves it explicitly.
- **Monorepo, two apps.** `backend/` and `frontend/` are kept independent — easier to dockerize and deploy separately later.

## Roadmap

Built as a DevOps portfolio piece alongside being a real product. Each phase is independently shippable.

- [x] **Phase 0** — Public repo, `.gitignore`, README, branch protection
- [ ] **Phase 1** — Dockerfile (multi-stage) + full `docker compose` (app + DB)
- [ ] **Phase 2** — CI on PRs (lint + test + build), required status checks before merge to `main`
- [ ] **Phase 3** — Terraform IaC (ECR, RDS, ECS Fargate, ALB, secrets), remote state in S3 + DynamoDB lock
- [ ] **Phase 4** — Deploy on AWS (ECS Fargate, HTTPS via ACM + CloudFront/Route 53)
- [ ] **Phase 5** — Observability (CloudWatch + Grafana dashboards, alerting)
- [ ] Multi-tenant (per-studio isolation)
- [ ] PWA (installable, offline shell, push notifications)

## License

UNLICENSED — portfolio / personal project.
