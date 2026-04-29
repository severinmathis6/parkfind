# Parking Checker

Schweizer Parkplatz-Verfügbarkeit MVP. Findet freie Parkplätze in der Nähe und zeigt sie auf einer Karte.

## Quick Start

```bash
cp .env.example .env
docker compose up
```

- Backend API: http://localhost:3001
- Frontend (Plan B): http://localhost:3000
- DB: postgres://parking:parking@localhost:5432/parking

## Documentation

- Design Spec: `docs/superpowers/specs/2026-04-29-parking-checker-design.md`
- Plan A (Backend): `docs/superpowers/plans/2026-04-29-parking-checker-plan-a-backend.md`

## Prerequisites

- Docker Desktop (with Compose v2)
- Node 20+ and npm (or pnpm)

## Backend (without Docker)

```bash
cd backend
npm install
npm run db:migrate:deploy   # requires DATABASE_URL set to a running Postgres+PostGIS
npm run db:seed
npm run start:dev
```
