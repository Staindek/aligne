<p align="right">
  <a href="./README.md">🇬🇧 English</a> · <b>🇪🇸 Español</b>
</p>

# Aligné — Reservas para Estudio de Pilates

Plataforma de reservas para un estudio boutique de Pilates. Las alumnas reservan clases contra un pack activo, los instructores gestionan asistencia, y los administradores manejan la grilla. Construida end-to-end por una sola persona.

> **Estado:** MVP en desarrollo activo (Fase 0). Single-studio hoy; multi-tenant SaaS está en el roadmap.

## Qué hace

- **Alumnas** ven la grilla semanal (o la vista del día), reservan clases contra un pack activo (4 / 8 / 12 / libre por mes), arman reservas fijas semanales y cancelan hasta 4 h antes.
- **Instructores** ven sus sesiones próximas, marcan asistencia y gestionan el día.
- **Administradores** gestionan clases, horarios, packs, pagos y usuarias; resuelven propuestas de materialización cuando las reservas fijas exceden la capacidad.

## Stack técnico

| Capa         | Elección                                                   |
| ------------ | ---------------------------------------------------------- |
| Frontend     | Next.js 16 · React 19 · Tailwind 4 · shadcn/ui · Base UI   |
| Backend      | NestJS 11 · TypeORM · Passport JWT                         |
| Base de datos| PostgreSQL (Docker para desarrollo local)                  |
| Scheduling   | Cron jobs con `@nestjs/schedule` (auto-cancel, materialización) |
| Zona horaria | `America/Argentina/Buenos_Aires`, manejo de fechas SSR-safe |

## Correrlo en local

### Con Docker (recomendado — un solo comando)

Requisitos: Docker 24+.

```bash
docker compose up --build
```

Levanta PostgreSQL, la API NestJS y el frontend Next.js en la misma red. El primer build tarda ~2 minutos; los siguientes reutilizan el layer cache.

- Frontend: <http://localhost:3001>
- API: <http://localhost:3000/api/v1>
- DB: `postgres://postgres:postgres@localhost:5432/pilates_db`

Bajar el stack (manteniendo datos): `docker compose down`. Bajar borrando el volume: `docker compose down -v`.

### Sin Docker (HMR más rápido para trabajar el frontend)

Requisitos: Node 20+, Docker (para la DB), npm.

```bash
# 1. PostgreSQL via Docker
docker compose up -d db

# 2. Backend (NestJS, puerto 3000)
cd backend
cp .env.example .env
npm install
npm run start:dev

# 3. Frontend (Next.js, puerto 3001)
cd ../frontend
npm install
npm run dev
```

## Decisiones de diseño destacables

- **Manejo de tiempo seguro en hidratación.** El servidor pasa `serverNowMs` como prop; los componentes cliente inicializan estado desde ese valor y refrescan después del mount. Evita mismatches SSR/CSR al renderizar vistas de "hoy".
- **Enforcement blando con avisos visuales.** Las reglas de reserva (cupo de pack, solape horario, cadencia semanal) priorizan mostrar contexto al usuario antes que bloquear — excepto cuando la integridad de datos lo exige (ej: no permitir dos reservas en el mismo horario).
- **Resolución de overflow por propuestas.** Cuando una reserva fija no se puede materializar (horario lleno), el sistema crea una `MaterializationProposal` en vez de fallar en silencio; la alumna la resuelve explícitamente.
- **Monorepo, dos apps.** `backend/` y `frontend/` son independientes — más simple dockerizar y desplegar por separado más adelante.

## Roadmap

Construido como pieza de portfolio DevOps además de ser un producto real. Cada fase es desplegable de forma independiente.

- [x] **Fase 0** — Repo público, `.gitignore`, README, protección de branch
- [ ] **Fase 1** — Dockerfile (multi-stage) + `docker compose` completo (app + DB)
- [ ] **Fase 2** — CI en PRs (lint + test + build), checks obligatorios antes de mergear a `main`
- [ ] **Fase 3** — IaC con Terraform (ECR, RDS, ECS Fargate, ALB, secrets), estado remoto en S3 + lock en DynamoDB
- [ ] **Fase 4** — Deploy en AWS (ECS Fargate, HTTPS via ACM + CloudFront/Route 53)
- [ ] **Fase 5** — Observabilidad (dashboards CloudWatch + Grafana, alertas)
- [ ] Multi-tenant (aislamiento por estudio)
- [ ] PWA (instalable, shell offline, push notifications)

## Licencia

UNLICENSED — proyecto personal / portfolio.
