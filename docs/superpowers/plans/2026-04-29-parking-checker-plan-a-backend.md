# Parking Checker — Plan A: Foundation + Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working REST API for nearby Swiss parking lookups, backed by PostgreSQL+PostGIS with seeded mock data. After this plan, `docker compose up` runs everything and `curl localhost:3001/api/parkings?lat=47.378&lng=8.540&radius=2000` returns JSON. All backend tests pass.

**Architecture:** Three Docker services (`db`, `db-test`, `backend`) orchestrated via `docker-compose.yml`. NestJS API with Prisma for ORM and `$queryRaw` for PostGIS `ST_DWithin` geo queries. PostgreSQL+PostGIS with a custom migration for the `GEOGRAPHY` column + GIST index + auto-update trigger. Vitest as the test runner with a separate test DB.

**Tech Stack:** Node 20, pnpm, TypeScript, NestJS 10, Prisma 5, PostgreSQL 16 + PostGIS 3.4, Vitest, Supertest, Docker Compose. (Plan B will add Next.js + Leaflet for the frontend.)

**Spec:** `docs/superpowers/specs/2026-04-29-parking-checker-design.md`

---

## File Structure (Plan A)

**Repo root:**
- `docker-compose.yml` — Service orchestration (`db`, `db-test`, `backend`)
- `.env.example` — Template for environment variables
- `.gitignore` — Node/IDE/build artifacts
- `README.md` — Setup instructions
- `docs/` — Already exists from spec

**Backend (`backend/`):**
- `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tsconfig.build.json`
- `nest-cli.json`
- `Dockerfile` — Dev image (Node 20 + pnpm)
- `.env.example`
- `vitest.config.ts`, `vitest.config.integration.ts`
- `test/setup.ts` — Truncate test DB between tests
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/migrations/<timestamp>_init/migration.sql`
- `src/main.ts` — Bootstrap, global pipes, CORS
- `src/app.module.ts` — Root module
- `src/prisma/prisma.module.ts` — `@Global()` Prisma provider
- `src/prisma/prisma.service.ts` — `PrismaClient` with lifecycle
- `src/health/health.controller.ts`
- `src/health/health.controller.spec.ts`
- `src/parking/parking.module.ts`
- `src/parking/parking.controller.ts`
- `src/parking/parking.controller.spec.ts` — HTTP-level tests (Supertest)
- `src/parking/parking.service.ts`
- `src/parking/parking.service.spec.ts` — Unit (mocked repo)
- `src/parking/parking.repository.ts`
- `src/parking/parking.repository.spec.ts` — Integration (real test DB)
- `src/parking/dto/find-nearby.dto.ts`
- `src/parking/dto/parking-response.dto.ts`
- `src/parking/parking.types.ts` — Shared types/enums
- `src/common/filters/http-exception.filter.ts`

**Database (`database/`):**
- `README.md` — Notes on raw SQL, link to `backend/prisma/`

---

## Phase 1 — Repo & Docker Foundation

### Task 1: Initialize repo skeleton

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`
- Create: `database/README.md`

- [ ] **Step 1: Create `.gitignore`**

```
# Dependencies
node_modules/
.pnpm-store/

# Build output
dist/
.next/
out/

# Test coverage
coverage/

# Environment
.env
.env.local
.env.*.local
!.env.example
!.env.test

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Prisma
*.db
*.db-journal

# Logs
*.log
npm-debug.log*
pnpm-debug.log*
```

- [ ] **Step 2: Create `.env.example`**

```
# Backend
DATABASE_URL=postgresql://parking:parking@localhost:5432/parking
DATABASE_URL_TEST=postgresql://parking:parking@localhost:5433/parking_test
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Frontend (used in Plan B)
NEXT_PUBLIC_API_URL=http://localhost:3001
```

- [ ] **Step 3: Create `README.md`**

```markdown
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
```

- [ ] **Step 4: Create `database/README.md`**

```markdown
# Database

Das Prisma-Schema und die Migrationen leben in `backend/prisma/`.
Dieser Folder ist für ergänzende Artefakte (raw SQL für Referenz,
ad-hoc-Skripte). Die App selbst liest keine Files aus diesem Folder.
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore .env.example README.md database/README.md
git commit -m "chore: initialize repo skeleton"
```

---

### Task 2: Docker Compose mit Postgres + PostGIS

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `docker-compose.yml` (DB-Services only — Backend wird in Task 9 hinzugefügt)**

```yaml
services:
  db:
    image: postgis/postgis:16-3.4
    container_name: parking-db
    environment:
      POSTGRES_DB: parking
      POSTGRES_USER: parking
      POSTGRES_PASSWORD: parking
    ports:
      - "5432:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U parking"]
      interval: 5s
      retries: 10

  db-test:
    image: postgis/postgis:16-3.4
    container_name: parking-db-test
    environment:
      POSTGRES_DB: parking_test
      POSTGRES_USER: parking
      POSTGRES_PASSWORD: parking
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U parking"]
      interval: 5s
      retries: 10

volumes:
  db-data:
```

- [ ] **Step 2: Run DB-Services und verifiziere PostGIS verfügbar**

```bash
docker compose up -d db db-test
docker compose exec db psql -U parking -d parking -c "SELECT PostGIS_Version();"
```

Expected: Eine Zeile mit der PostGIS-Version (z.B. `3.4 USE_GEOS=1 USE_PROJ=1 ...`).

- [ ] **Step 3: Verifiziere Test-DB ist erreichbar**

```bash
docker compose exec db-test psql -U parking -d parking_test -c "SELECT 1;"
```

Expected: `?column? \n----------\n        1\n(1 row)`

- [ ] **Step 4: Stop DBs (cleanup before commit)**

```bash
docker compose down
```

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add docker-compose with postgres+postgis services"
```

---

## Phase 2 — Backend Scaffold

### Task 3: Backend NestJS Skeleton

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/tsconfig.build.json`
- Create: `backend/nest-cli.json`
- Create: `backend/.env.example`
- Create: `backend/src/main.ts`
- Create: `backend/src/app.module.ts`

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "parking-checker-backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "nest start",
    "start:dev": "nest start --watch",
    "build": "nest build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run --config vitest.config.integration.ts",
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:seed": "prisma db seed",
    "db:reset": "prisma migrate reset --force"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-express": "^10.4.0",
    "@prisma/client": "^5.22.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0",
    "@nestjs/testing": "^10.4.0",
    "@types/node": "^20.14.0",
    "@types/supertest": "^6.0.2",
    "@vitest/ui": "^2.1.0",
    "prisma": "^5.22.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "unplugin-swc": "^1.5.1",
    "@swc/core": "^1.7.0",
    "vitest": "^2.1.0"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "prisma/seed.ts", "test/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `backend/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*.spec.ts"]
}
```

- [ ] **Step 4: Create `backend/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 5: Create `backend/.env.example`**

```
DATABASE_URL=postgresql://parking:parking@localhost:5432/parking
DATABASE_URL_TEST=postgresql://parking:parking@localhost:5433/parking_test
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

- [ ] **Step 6: Create `backend/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common'

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 7: Create `backend/src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api', { exclude: ['health'] })
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  })

  const port = Number(process.env.PORT ?? 3001)
  await app.listen(port)
  console.log(`Backend listening on http://localhost:${port}`)
}

bootstrap()
```

- [ ] **Step 8: Install dependencies**

```bash
cd backend
pnpm install
```

Expected: `node_modules/` populated, no errors.

- [ ] **Step 9: Build backend**

```bash
cd backend
pnpm build
```

Expected: `dist/main.js` exists, no TS errors.

- [ ] **Step 10: Commit**

```bash
git add backend/package.json backend/pnpm-lock.yaml backend/tsconfig*.json backend/nest-cli.json backend/.env.example backend/src/
git commit -m "feat(backend): scaffold NestJS app skeleton"
```

---

### Task 4: Vitest Setup für NestJS

**Files:**
- Create: `backend/vitest.config.ts`
- Create: `backend/vitest.config.integration.ts`
- Create: `backend/test/setup.ts`

- [ ] **Step 1: Create `backend/vitest.config.ts` (Unit-Tests)**

```typescript
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    exclude: ['src/**/*.integration.spec.ts'],
    environment: 'node',
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true },
        target: 'es2022',
      },
    }),
  ],
})
```

- [ ] **Step 2: Create `backend/vitest.config.integration.ts` (Integration-Tests gegen Test-DB)**

```typescript
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.integration.spec.ts', 'test/**/*.spec.ts'],
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    poolOptions: {
      threads: { singleThread: true },
    },
    testTimeout: 30000,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true },
        target: 'es2022',
      },
    }),
  ],
})
```

- [ ] **Step 3: Create `backend/test/setup.ts`**

```typescript
import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach } from 'vitest'

const databaseUrl = process.env.DATABASE_URL_TEST
if (!databaseUrl) {
  throw new Error('DATABASE_URL_TEST must be set for integration tests')
}

let prisma: PrismaClient

beforeAll(() => {
  execSync('pnpm prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  })
  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
})

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE parkings RESTART IDENTITY CASCADE')
})

afterAll(async () => {
  await prisma.$disconnect()
})
```

- [ ] **Step 4: Run Unit-Tests (sollte 0 Tests haben, aber funktionieren)**

```bash
cd backend
pnpm test
```

Expected: `No test files found, exiting with code 1` ODER `Test Files: 0 passed`. Akzeptabel — wir haben noch keine Tests.

- [ ] **Step 5: Commit**

```bash
git add backend/vitest.config.ts backend/vitest.config.integration.ts backend/test/setup.ts
git commit -m "feat(backend): add vitest configs (unit + integration)"
```

---

## Phase 3 — Prisma & Database

### Task 5: Prisma Schema + Init Migration

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/migration_lock.toml`

- [ ] **Step 1: Create `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [postgis]
}

model Parking {
  id              Int          @id @default(autoincrement())
  name            String
  address         String
  city            String
  parkingType     ParkingType  @map("parking_type")
  latitude        Float
  longitude       Float
  totalSpots      Int          @map("total_spots")
  availableSpots  Int          @map("available_spots")
  pricePerHour    Decimal      @map("price_per_hour") @db.Decimal(10, 2)
  isEvCharging    Boolean      @default(false) @map("is_ev_charging")
  maxHeight       Float?       @map("max_height")
  openingHours    String?      @map("opening_hours")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  @@map("parkings")
}

enum ParkingType {
  street
  garage
  private

  @@map("parking_type")
}
```

- [ ] **Step 2: Stelle sicher, dass DB läuft**

```bash
docker compose up -d db
docker compose exec db pg_isready -U parking
```

Expected: `accepting connections`

- [ ] **Step 3: Erstelle Initial-Migration**

```bash
cd backend
DATABASE_URL=postgresql://parking:parking@localhost:5432/parking pnpm prisma migrate dev --name init --create-only
```

Expected: Eine neue Datei `backend/prisma/migrations/<timestamp>_init/migration.sql` wird erstellt. Der Befehl mit `--create-only` führt sie noch nicht aus, damit wir sie um PostGIS-Spalte/Index/Trigger erweitern können.

- [ ] **Step 4: Verifiziere die Migration existiert**

```bash
ls backend/prisma/migrations/
```

Expected: `migration_lock.toml` und ein Folder `<timestamp>_init/`.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(backend): add prisma schema and initial migration"
```

---

### Task 6: PostGIS-Erweiterung der Migration

**Files:**
- Modify: `backend/prisma/migrations/<timestamp>_init/migration.sql`

- [ ] **Step 1: Öffne die Init-Migration und ergänze am Anfang die PostGIS-Extension**

Die generierte Datei beginnt mit etwas wie:

```sql
-- CreateEnum
CREATE TYPE "parking_type" AS ENUM ('street', 'garage', 'private');

-- CreateTable
CREATE TABLE "parkings" (
    ...
);
```

Füge **ganz oben**, vor allem anderen, hinzu:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

- [ ] **Step 2: Ergänze am **Ende** der Datei die GEOGRAPHY-Spalte, den Trigger und die Indexe**

Füge ans Ende der Migration an:

```sql
-- PostGIS GEOGRAPHY column (auto-filled by trigger from latitude/longitude)
ALTER TABLE "parkings" ADD COLUMN "location" GEOGRAPHY(Point, 4326);

CREATE OR REPLACE FUNCTION update_parking_location() RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parkings_location_trigger
BEFORE INSERT OR UPDATE ON "parkings"
FOR EACH ROW EXECUTE FUNCTION update_parking_location();

-- GIST index for spatial queries (ST_DWithin, etc.)
CREATE INDEX "parkings_location_gix" ON "parkings" USING GIST (location);

-- B-tree indexes for filter columns
CREATE INDEX "parkings_is_ev_charging_idx" ON "parkings"("is_ev_charging");
CREATE INDEX "parkings_parking_type_idx" ON "parkings"("parking_type");
```

- [ ] **Step 3: Wende die Migration auf die DB an**

```bash
cd backend
DATABASE_URL=postgresql://parking:parking@localhost:5432/parking pnpm prisma migrate deploy
```

Expected: `Applying migration ...` und `All migrations have been successfully applied.`

- [ ] **Step 4: Verifiziere Schema in der DB**

```bash
docker compose exec db psql -U parking -d parking -c "\d parkings"
```

Expected: Tabelle `parkings` mit allen Spalten inkl. `location` (Type `geography`).

```bash
docker compose exec db psql -U parking -d parking -c "\di parkings*"
```

Expected: Drei Indizes (`parkings_pkey`, `parkings_location_gix`, `parkings_is_ev_charging_idx`, `parkings_parking_type_idx`).

- [ ] **Step 5: Generate Prisma Client**

```bash
cd backend
DATABASE_URL=postgresql://parking:parking@localhost:5432/parking pnpm prisma generate
```

Expected: `✔ Generated Prisma Client (...) to ./node_modules/.prisma/client`

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/migrations/
git commit -m "feat(backend): extend init migration with PostGIS column, trigger, and indexes"
```

---

### Task 7: PrismaService + PrismaModule

**Files:**
- Create: `backend/src/prisma/prisma.service.ts`
- Create: `backend/src/prisma/prisma.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create `backend/src/prisma/prisma.service.ts`**

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
```

- [ ] **Step 2: Create `backend/src/prisma/prisma.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 3: Update `backend/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 4: Build to verify**

```bash
cd backend
pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/prisma backend/src/app.module.ts
git commit -m "feat(backend): add PrismaService and global PrismaModule"
```

---

## Phase 4 — Health Endpoint (TDD-Warmup)

### Task 8: Health Endpoint via TDD

**Files:**
- Create: `backend/src/health/health.controller.spec.ts`
- Create: `backend/src/health/health.controller.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1 (RED): Write failing test `backend/src/health/health.controller.spec.ts`**

```typescript
import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'
import { HealthController } from './health.controller'

describe('HealthController', () => {
  it('returns status ok with current timestamp', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile()

    const controller = moduleRef.get(HealthController)
    const result = controller.check()

    expect(result.status).toBe('ok')
    expect(typeof result.timestamp).toBe('string')
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow()
  })
})
```

- [ ] **Step 2 (RED): Run test, verify it fails**

```bash
cd backend
pnpm test src/health/health.controller.spec.ts
```

Expected: FAIL with `Cannot find module './health.controller'` or similar.

- [ ] **Step 3 (GREEN): Create minimal `backend/src/health/health.controller.ts`**

```typescript
import { Controller, Get } from '@nestjs/common'

@Controller('health')
export class HealthController {
  check(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}

```

Note: We need `@Get()` for the actual HTTP route. Add it:

```typescript
import { Controller, Get } from '@nestjs/common'

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}
```

- [ ] **Step 4 (GREEN): Run test, verify it passes**

```bash
cd backend
pnpm test src/health/health.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Wire up in `backend/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { HealthController } from './health/health.controller'

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 6: Build to verify**

```bash
cd backend
pnpm build
```

Expected: No TS errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/health backend/src/app.module.ts
git commit -m "feat(backend): add /health endpoint (TDD)"
```

---

## Phase 5 — Backend Dockerfile + Docker Compose Integration

### Task 9: Backend Dockerfile + add to compose

**Files:**
- Create: `backend/Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Create `backend/Dockerfile`**

```dockerfile
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3001
CMD ["pnpm", "start:dev"]
```

- [ ] **Step 2: Update `docker-compose.yml` to add `backend` service**

Append after the `db-test` service block, before `volumes:`:

```yaml
  backend:
    build: ./backend
    container_name: parking-backend
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://parking:parking@db:5432/parking
      PORT: "3001"
      CORS_ORIGIN: http://localhost:3000
    ports:
      - "3001:3001"
    volumes:
      - ./backend:/app
      - /app/node_modules
    command: sh -c "pnpm prisma migrate deploy && pnpm start:dev"
```

The full file should now look like:

```yaml
services:
  db:
    image: postgis/postgis:16-3.4
    container_name: parking-db
    environment:
      POSTGRES_DB: parking
      POSTGRES_USER: parking
      POSTGRES_PASSWORD: parking
    ports:
      - "5432:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U parking"]
      interval: 5s
      retries: 10

  db-test:
    image: postgis/postgis:16-3.4
    container_name: parking-db-test
    environment:
      POSTGRES_DB: parking_test
      POSTGRES_USER: parking
      POSTGRES_PASSWORD: parking
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U parking"]
      interval: 5s
      retries: 10

  backend:
    build: ./backend
    container_name: parking-backend
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://parking:parking@db:5432/parking
      PORT: "3001"
      CORS_ORIGIN: http://localhost:3000
    ports:
      - "3001:3001"
    volumes:
      - ./backend:/app
      - /app/node_modules
    command: sh -c "pnpm prisma migrate deploy && pnpm start:dev"

volumes:
  db-data:
```

- [ ] **Step 3: Build & start backend**

```bash
docker compose up -d --build
docker compose logs -f backend
```

Wait for `Backend listening on http://localhost:3001`. Press `Ctrl+C` to stop tailing.

- [ ] **Step 4: Hit /health endpoint**

```bash
curl -s http://localhost:3001/health | jq .
```

Expected: `{ "status": "ok", "timestamp": "..." }`

- [ ] **Step 5: Stop services**

```bash
docker compose down
```

- [ ] **Step 6: Commit**

```bash
git add backend/Dockerfile docker-compose.yml
git commit -m "feat: add backend service to docker-compose"
```

---

## Phase 6 — Parking Domain (Types, DTOs)

### Task 10: Parking-Types und Response DTO

**Files:**
- Create: `backend/src/parking/parking.types.ts`
- Create: `backend/src/parking/dto/parking-response.dto.ts`

- [ ] **Step 1: Create `backend/src/parking/parking.types.ts`**

```typescript
export const PARKING_TYPES = ['street', 'garage', 'private'] as const
export type ParkingType = (typeof PARKING_TYPES)[number]

export type ParkingRow = {
  id: number
  name: string
  address: string
  city: string
  parking_type: ParkingType
  latitude: number
  longitude: number
  total_spots: number
  available_spots: number
  price_per_hour: string  // Prisma Decimal serialized as string
  is_ev_charging: boolean
  max_height: number | null
  opening_hours: string | null
  distance_m?: number      // only present for nearby queries
}
```

- [ ] **Step 2: Create `backend/src/parking/dto/parking-response.dto.ts`**

```typescript
import type { ParkingType } from '../parking.types'

export class ParkingResponseDto {
  id!: number
  name!: string
  address!: string
  city!: string
  parkingType!: ParkingType
  latitude!: number
  longitude!: number
  totalSpots!: number
  availableSpots!: number
  pricePerHour!: number       // serialized as number (NOT Decimal/string)
  isEvCharging!: boolean
  maxHeight!: number | null
  openingHours!: string | null
  distanceM?: number          // present for nearby queries

  static fromRow(row: import('../parking.types').ParkingRow): ParkingResponseDto {
    const dto = new ParkingResponseDto()
    dto.id = row.id
    dto.name = row.name
    dto.address = row.address
    dto.city = row.city
    dto.parkingType = row.parking_type
    dto.latitude = row.latitude
    dto.longitude = row.longitude
    dto.totalSpots = row.total_spots
    dto.availableSpots = row.available_spots
    dto.pricePerHour = Number(row.price_per_hour)
    dto.isEvCharging = row.is_ev_charging
    dto.maxHeight = row.max_height
    dto.openingHours = row.opening_hours
    if (row.distance_m !== undefined) {
      dto.distanceM = row.distance_m
    }
    return dto
  }
}
```

- [ ] **Step 3: Build to verify**

```bash
cd backend
pnpm build
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/parking/parking.types.ts backend/src/parking/dto/parking-response.dto.ts
git commit -m "feat(backend): add Parking types and response DTO"
```

---

### Task 11: FindNearbyDto mit Validation (TDD)

**Files:**
- Create: `backend/src/parking/dto/find-nearby.dto.spec.ts`
- Create: `backend/src/parking/dto/find-nearby.dto.ts`

- [ ] **Step 1 (RED): Create `backend/src/parking/dto/find-nearby.dto.spec.ts`**

```typescript
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { FindNearbyDto } from './find-nearby.dto'

describe('FindNearbyDto', () => {
  it('accepts valid lat/lng/radius', async () => {
    const dto = plainToInstance(FindNearbyDto, { lat: '47.378', lng: '8.540', radius: '2000' })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
    expect(dto.lat).toBe(47.378)
    expect(dto.lng).toBe(8.540)
    expect(dto.radius).toBe(2000)
  })

  it('uses default radius of 2000 when omitted', async () => {
    const dto = plainToInstance(FindNearbyDto, { lat: '47.378', lng: '8.540' })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
    expect(dto.radius).toBe(2000)
  })

  it('rejects out-of-range latitude', async () => {
    const dto = plainToInstance(FindNearbyDto, { lat: '95', lng: '8.540' })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].property).toBe('lat')
  })

  it('rejects radius below 50 m', async () => {
    const dto = plainToInstance(FindNearbyDto, { lat: '47.378', lng: '8.540', radius: '10' })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].property).toBe('radius')
  })

  it('rejects radius above 20000 m', async () => {
    const dto = plainToInstance(FindNearbyDto, { lat: '47.378', lng: '8.540', radius: '999999' })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].property).toBe('radius')
  })

  it('parses parking_type CSV into array', async () => {
    const dto = plainToInstance(FindNearbyDto, {
      lat: '47.378',
      lng: '8.540',
      parking_type: 'street,garage',
    })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
    expect(dto.parkingType).toEqual(['street', 'garage'])
  })

  it('rejects unknown parking_type values', async () => {
    const dto = plainToInstance(FindNearbyDto, {
      lat: '47.378',
      lng: '8.540',
      parking_type: 'street,helipad',
    })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].property).toBe('parkingType')
  })

  it('parses is_ev_charging=true as boolean true', async () => {
    const dto = plainToInstance(FindNearbyDto, {
      lat: '47.378',
      lng: '8.540',
      is_ev_charging: 'true',
    })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
    expect(dto.isEvCharging).toBe(true)
  })

  it('parses is_free=false as boolean false', async () => {
    const dto = plainToInstance(FindNearbyDto, {
      lat: '47.378',
      lng: '8.540',
      is_free: 'false',
    })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
    expect(dto.isFree).toBe(false)
  })
})
```

- [ ] **Step 2 (RED): Run test, verify it fails**

```bash
cd backend
pnpm test src/parking/dto/find-nearby.dto.spec.ts
```

Expected: FAIL with `Cannot find module './find-nearby.dto'`.

- [ ] **Step 3 (GREEN): Create `backend/src/parking/dto/find-nearby.dto.ts`**

```typescript
import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  Max,
  Min,
} from 'class-validator'
import { PARKING_TYPES, type ParkingType } from '../parking.types'

export class FindNearbyDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number

  @Type(() => Number)
  @IsLongitude()
  lng!: number

  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(20000)
  @IsOptional()
  radius: number = 2000

  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined
    return String(value).split(',').map((v) => v.trim())
  })
  @IsOptional()
  @IsArray()
  @IsEnum(PARKING_TYPES, { each: true })
  parkingType?: ParkingType[]

  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined
    return value === 'true' || value === true
  })
  @IsOptional()
  @IsBoolean()
  isEvCharging?: boolean

  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined
    return value === 'true' || value === true
  })
  @IsOptional()
  @IsBoolean()
  isFree?: boolean
}
```

Note about query-string field names: NestJS `@Query()` reads request query keys directly. To map snake_case query keys to camelCase properties, we need name mapping. Add `@Expose({ name: 'parking_type' })` etc., OR rely on `@Transform`/explicit assignment.

The cleanest way: use `@Expose` with `{ name: 'parking_type' }` etc. via `class-transformer`. Update the DTO:

```typescript
import { Expose, Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  Max,
  Min,
} from 'class-validator'
import { PARKING_TYPES, type ParkingType } from '../parking.types'

export class FindNearbyDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number

  @Type(() => Number)
  @IsLongitude()
  lng!: number

  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(20000)
  @IsOptional()
  radius: number = 2000

  @Expose({ name: 'parking_type' })
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined
    return String(value).split(',').map((v) => v.trim())
  })
  @IsOptional()
  @IsArray()
  @IsEnum(PARKING_TYPES, { each: true })
  parkingType?: ParkingType[]

  @Expose({ name: 'is_ev_charging' })
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined
    return value === 'true' || value === true
  })
  @IsOptional()
  @IsBoolean()
  isEvCharging?: boolean

  @Expose({ name: 'is_free' })
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined
    return value === 'true' || value === true
  })
  @IsOptional()
  @IsBoolean()
  isFree?: boolean
}
```

For `@Expose` to work, `plainToInstance` must be called with `{ excludeExtraneousValues: false }` (default) AND we need to enable `exposeUnsetFields: false`. Actually for our case, simplest: rely on the class-validator default and add `enableImplicitConversion`. Switch the test to use snake_case keys directly (which is what NestJS will receive from query strings).

Actually, the cleanest approach: NestJS `@Query()` returns a plain object with the original key names. To get snake_case → camelCase mapping, we need to either:
1. Use `@Expose({ name: 'snake_case' })` AND configure `class-transformer` with `excludeExtraneousValues: false` (default)
2. Manually map in the controller

Approach 1 with the test setup using `plainToInstance(FindNearbyDto, {...snake_case...})` — `@Expose({ name: 'parking_type' })` together with `class-transformer`'s default behavior should work.

But there's a subtlety: `plainToInstance` only respects `@Expose` when `excludeExtraneousValues: true` is set. Without that flag, both the original key AND the @Expose name might be assigned.

The simpler approach for class-validator with NestJS: use a custom transform on the DTO.

Let me use a different, clearer approach: have the controller pass `@Query()` to `plainToInstance` explicitly with `{ excludeExtraneousValues: true }`. But that means renaming all properties via @Expose and turning off ValidationPipe's `transform: true`.

The cleanest, most idiomatic NestJS approach: **rename DTO properties to match query keys** (use snake_case in DTO when query is snake_case):

```typescript
import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  Max,
  Min,
} from 'class-validator'
import { PARKING_TYPES, type ParkingType } from '../parking.types'

export class FindNearbyDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number

  @Type(() => Number)
  @IsLongitude()
  lng!: number

  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(20000)
  @IsOptional()
  radius: number = 2000

  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined
    return String(value).split(',').map((v) => v.trim())
  })
  @IsOptional()
  @IsArray()
  @IsEnum(PARKING_TYPES, { each: true })
  parking_type?: ParkingType[]

  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined
    return value === 'true' || value === true
  })
  @IsOptional()
  @IsBoolean()
  is_ev_charging?: boolean

  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined
    return value === 'true' || value === true
  })
  @IsOptional()
  @IsBoolean()
  is_free?: boolean
}
```

And update the test to use snake_case property names:

Modify the spec to read `dto.parking_type`, `dto.is_ev_charging`, `dto.is_free` instead of camelCase.

The test (overwrite the previous spec content):

```typescript
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { FindNearbyDto } from './find-nearby.dto'

describe('FindNearbyDto', () => {
  it('accepts valid lat/lng/radius', async () => {
    const dto = plainToInstance(FindNearbyDto, { lat: '47.378', lng: '8.540', radius: '2000' })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
    expect(dto.lat).toBe(47.378)
    expect(dto.lng).toBe(8.540)
    expect(dto.radius).toBe(2000)
  })

  it('uses default radius of 2000 when omitted', async () => {
    const dto = plainToInstance(FindNearbyDto, { lat: '47.378', lng: '8.540' })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
    expect(dto.radius).toBe(2000)
  })

  it('rejects out-of-range latitude', async () => {
    const dto = plainToInstance(FindNearbyDto, { lat: '95', lng: '8.540' })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].property).toBe('lat')
  })

  it('rejects radius below 50 m', async () => {
    const dto = plainToInstance(FindNearbyDto, { lat: '47.378', lng: '8.540', radius: '10' })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].property).toBe('radius')
  })

  it('rejects radius above 20000 m', async () => {
    const dto = plainToInstance(FindNearbyDto, { lat: '47.378', lng: '8.540', radius: '999999' })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].property).toBe('radius')
  })

  it('parses parking_type CSV into array', async () => {
    const dto = plainToInstance(FindNearbyDto, {
      lat: '47.378',
      lng: '8.540',
      parking_type: 'street,garage',
    })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
    expect(dto.parking_type).toEqual(['street', 'garage'])
  })

  it('rejects unknown parking_type values', async () => {
    const dto = plainToInstance(FindNearbyDto, {
      lat: '47.378',
      lng: '8.540',
      parking_type: 'street,helipad',
    })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].property).toBe('parking_type')
  })

  it('parses is_ev_charging=true as boolean true', async () => {
    const dto = plainToInstance(FindNearbyDto, {
      lat: '47.378',
      lng: '8.540',
      is_ev_charging: 'true',
    })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
    expect(dto.is_ev_charging).toBe(true)
  })

  it('parses is_free=false as boolean false', async () => {
    const dto = plainToInstance(FindNearbyDto, {
      lat: '47.378',
      lng: '8.540',
      is_free: 'false',
    })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
    expect(dto.is_free).toBe(false)
  })
})
```

Save the updated test file (overwriting the earlier version from Step 1 — same path: `backend/src/parking/dto/find-nearby.dto.spec.ts`). Then save the DTO file with the snake_case version above.

- [ ] **Step 4 (GREEN): Run tests, verify all pass**

```bash
cd backend
pnpm test src/parking/dto/find-nearby.dto.spec.ts
```

Expected: 9 tests passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/parking/dto/find-nearby.dto.ts backend/src/parking/dto/find-nearby.dto.spec.ts
git commit -m "feat(backend): add FindNearbyDto with validation (TDD, 9 tests)"
```

---

## Phase 7 — ParkingRepository (Integration Tests gegen Test-DB)

### Task 12: ParkingRepository.findNearby() (TDD)

**Files:**
- Create: `backend/src/parking/parking.repository.integration.spec.ts`
- Create: `backend/src/parking/parking.repository.ts`

- [ ] **Step 1 (RED): Create `backend/src/parking/parking.repository.integration.spec.ts`**

```typescript
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaService } from '../prisma/prisma.service'
import { ParkingRepository } from './parking.repository'

const databaseUrl = process.env.DATABASE_URL_TEST!

let prisma: PrismaClient
let repo: ParkingRepository

beforeAll(() => {
  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
  repo = new ParkingRepository(prisma as unknown as PrismaService)
})

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE parkings RESTART IDENTITY CASCADE')
})

const ZRH_HB = { lat: 47.3779, lng: 8.5403 }  // Zürich HB

async function seed(rows: Array<Partial<{
  name: string
  address: string
  city: string
  parkingType: 'street' | 'garage' | 'private'
  latitude: number
  longitude: number
  totalSpots: number
  availableSpots: number
  pricePerHour: number
  isEvCharging: boolean
  maxHeight: number | null
  openingHours: string | null
}>>): Promise<void> {
  for (const row of rows) {
    await prisma.parking.create({
      data: {
        name: row.name ?? 'Test',
        address: row.address ?? 'Teststr. 1',
        city: row.city ?? 'Zürich',
        parkingType: row.parkingType ?? 'garage',
        latitude: row.latitude!,
        longitude: row.longitude!,
        totalSpots: row.totalSpots ?? 100,
        availableSpots: row.availableSpots ?? 50,
        pricePerHour: row.pricePerHour ?? 3.5,
        isEvCharging: row.isEvCharging ?? false,
        maxHeight: row.maxHeight ?? 2.1,
        openingHours: row.openingHours ?? '24/7',
      },
    })
  }
}

describe('ParkingRepository.findNearby (integration)', () => {
  it('returns empty array when DB is empty', async () => {
    const result = await repo.findNearby({ lat: ZRH_HB.lat, lng: ZRH_HB.lng, radius: 2000 })
    expect(result).toEqual([])
  })

  it('returns parking within the given radius', async () => {
    await seed([{ name: 'Near', latitude: 47.3780, longitude: 8.5410 }])  // ~50 m from ZRH HB
    const result = await repo.findNearby({ lat: ZRH_HB.lat, lng: ZRH_HB.lng, radius: 200 })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Near')
    expect(result[0].distance_m).toBeLessThan(200)
  })

  it('excludes parking outside the radius', async () => {
    await seed([{ name: 'Far', latitude: 47.5000, longitude: 8.7000 }])  // ~25 km away
    const result = await repo.findNearby({ lat: ZRH_HB.lat, lng: ZRH_HB.lng, radius: 2000 })
    expect(result).toEqual([])
  })

  it('orders results by ascending distance', async () => {
    await seed([
      { name: 'Far', latitude: 47.3850, longitude: 8.5500 },
      { name: 'Close', latitude: 47.3782, longitude: 8.5408 },
      { name: 'Mid', latitude: 47.3800, longitude: 8.5440 },
    ])
    const result = await repo.findNearby({ lat: ZRH_HB.lat, lng: ZRH_HB.lng, radius: 5000 })
    expect(result.map((r) => r.name)).toEqual(['Close', 'Mid', 'Far'])
  })

  it('filters by is_ev_charging', async () => {
    await seed([
      { name: 'EV', latitude: 47.3780, longitude: 8.5410, isEvCharging: true },
      { name: 'NoEV', latitude: 47.3781, longitude: 8.5412, isEvCharging: false },
    ])
    const result = await repo.findNearby({
      lat: ZRH_HB.lat,
      lng: ZRH_HB.lng,
      radius: 1000,
      isEvCharging: true,
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('EV')
  })

  it('filters by parkingType (multi-select)', async () => {
    await seed([
      { name: 'Street', latitude: 47.3780, longitude: 8.5410, parkingType: 'street' },
      { name: 'Garage', latitude: 47.3781, longitude: 8.5412, parkingType: 'garage' },
      { name: 'Private', latitude: 47.3782, longitude: 8.5414, parkingType: 'private' },
    ])
    const result = await repo.findNearby({
      lat: ZRH_HB.lat,
      lng: ZRH_HB.lng,
      radius: 1000,
      parkingType: ['street', 'garage'],
    })
    expect(result.map((r) => r.name).sort()).toEqual(['Garage', 'Street'])
  })

  it('filters by isFree=true (price_per_hour = 0)', async () => {
    await seed([
      { name: 'Free', latitude: 47.3780, longitude: 8.5410, pricePerHour: 0 },
      { name: 'Paid', latitude: 47.3781, longitude: 8.5412, pricePerHour: 3.5 },
    ])
    const result = await repo.findNearby({
      lat: ZRH_HB.lat,
      lng: ZRH_HB.lng,
      radius: 1000,
      isFree: true,
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Free')
  })

  it('filters by isFree=false (price_per_hour > 0)', async () => {
    await seed([
      { name: 'Free', latitude: 47.3780, longitude: 8.5410, pricePerHour: 0 },
      { name: 'Paid', latitude: 47.3781, longitude: 8.5412, pricePerHour: 3.5 },
    ])
    const result = await repo.findNearby({
      lat: ZRH_HB.lat,
      lng: ZRH_HB.lng,
      radius: 1000,
      isFree: false,
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Paid')
  })
})
```

- [ ] **Step 2 (RED): Run, expect FAIL (no repository file yet)**

Stelle sicher, die Test-DB läuft:

```bash
docker compose up -d db-test
```

Dann:

```bash
cd backend
DATABASE_URL_TEST=postgresql://parking:parking@localhost:5433/parking_test pnpm test:integration src/parking/parking.repository.integration.spec.ts
```

Expected: FAIL with `Cannot find module './parking.repository'`.

- [ ] **Step 3 (GREEN): Create `backend/src/parking/parking.repository.ts`**

```typescript
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { ParkingRow, ParkingType } from './parking.types'

export type FindNearbyParams = {
  lat: number
  lng: number
  radius: number
  parkingType?: ParkingType[]
  isEvCharging?: boolean
  isFree?: boolean
}

@Injectable()
export class ParkingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findNearby(params: FindNearbyParams): Promise<ParkingRow[]> {
    const { lat, lng, radius, parkingType, isEvCharging, isFree } = params

    const filters: Prisma.Sql[] = []
    if (parkingType !== undefined && parkingType.length > 0) {
      filters.push(
        Prisma.sql`AND parking_type::text = ANY(${parkingType}::text[])`,
      )
    }
    if (isEvCharging !== undefined) {
      filters.push(Prisma.sql`AND is_ev_charging = ${isEvCharging}`)
    }
    if (isFree !== undefined) {
      filters.push(
        isFree
          ? Prisma.sql`AND price_per_hour = 0`
          : Prisma.sql`AND price_per_hour > 0`,
      )
    }

    const filterSql = filters.length > 0 ? Prisma.join(filters, ' ') : Prisma.empty

    const rows = await this.prisma.$queryRaw<ParkingRow[]>(Prisma.sql`
      SELECT
        id,
        name,
        address,
        city,
        parking_type,
        latitude,
        longitude,
        total_spots,
        available_spots,
        price_per_hour::text AS price_per_hour,
        is_ev_charging,
        max_height,
        opening_hours,
        ST_Distance(location, ST_MakePoint(${lng}::float, ${lat}::float)::geography)::float AS distance_m
      FROM parkings
      WHERE ST_DWithin(location, ST_MakePoint(${lng}::float, ${lat}::float)::geography, ${radius})
      ${filterSql}
      ORDER BY distance_m ASC
      LIMIT 200
    `)

    return rows
  }

  async findById(id: number): Promise<ParkingRow | null> {
    const rows = await this.prisma.$queryRaw<ParkingRow[]>(Prisma.sql`
      SELECT
        id,
        name,
        address,
        city,
        parking_type,
        latitude,
        longitude,
        total_spots,
        available_spots,
        price_per_hour::text AS price_per_hour,
        is_ev_charging,
        max_height,
        opening_hours
      FROM parkings
      WHERE id = ${id}
      LIMIT 1
    `)
    return rows[0] ?? null
  }
}
```

Note: `parking_type` is cast to text in the WHERE clause because Postgres ENUM doesn't support `= ANY(text[])` directly without a cast.

- [ ] **Step 4 (GREEN): Run integration test**

```bash
cd backend
DATABASE_URL_TEST=postgresql://parking:parking@localhost:5433/parking_test pnpm test:integration src/parking/parking.repository.integration.spec.ts
```

Expected: All 8 tests pass.

If you see PostGIS errors: re-apply migrations to the test DB:

```bash
DATABASE_URL=postgresql://parking:parking@localhost:5433/parking_test pnpm prisma migrate deploy
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/parking/parking.repository.ts backend/src/parking/parking.repository.integration.spec.ts
git commit -m "feat(backend): add ParkingRepository.findNearby with PostGIS (TDD, 8 tests)"
```

---

### Task 13: ParkingRepository.findById() — Integration Test

**Files:**
- Modify: `backend/src/parking/parking.repository.integration.spec.ts`
- (No code change — `findById` was implemented in Task 12; we add tests now)

- [ ] **Step 1 (RED): Append a new `describe` block to `backend/src/parking/parking.repository.integration.spec.ts`**

After the existing `describe('ParkingRepository.findNearby (integration)', ...)` block, add:

```typescript
describe('ParkingRepository.findById (integration)', () => {
  it('returns null when no parking matches the id', async () => {
    const result = await repo.findById(999)
    expect(result).toBeNull()
  })

  it('returns the parking row when id matches', async () => {
    await prisma.parking.create({
      data: {
        name: 'Hohe Promenade',
        address: 'Promenadengasse 1',
        city: 'Zürich',
        parkingType: 'garage',
        latitude: 47.3700,
        longitude: 8.5453,
        totalSpots: 200,
        availableSpots: 80,
        pricePerHour: 4.5,
        isEvCharging: true,
        maxHeight: 2.1,
        openingHours: '24/7',
      },
    })
    const result = await repo.findById(1)
    expect(result).not.toBeNull()
    expect(result?.name).toBe('Hohe Promenade')
    expect(result?.is_ev_charging).toBe(true)
    expect(Number(result?.price_per_hour)).toBe(4.5)
  })
})
```

- [ ] **Step 2 (GREEN): Run integration tests**

```bash
cd backend
DATABASE_URL_TEST=postgresql://parking:parking@localhost:5433/parking_test pnpm test:integration src/parking/parking.repository.integration.spec.ts
```

Expected: All 10 tests pass (8 from findNearby + 2 from findById).

- [ ] **Step 3: Commit**

```bash
git add backend/src/parking/parking.repository.integration.spec.ts
git commit -m "test(backend): add findById integration tests"
```

---

## Phase 8 — ParkingService (Unit Tests, mocked Repository)

### Task 14: ParkingService mit findNearby + findById (TDD)

**Files:**
- Create: `backend/src/parking/parking.service.spec.ts`
- Create: `backend/src/parking/parking.service.ts`

- [ ] **Step 1 (RED): Create `backend/src/parking/parking.service.spec.ts`**

```typescript
import { NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { describe, expect, it, vi } from 'vitest'
import { ParkingRepository } from './parking.repository'
import { ParkingService } from './parking.service'
import type { ParkingRow } from './parking.types'

function makeRow(overrides: Partial<ParkingRow> = {}): ParkingRow {
  return {
    id: 1,
    name: 'Test',
    address: 'Teststr. 1',
    city: 'Zürich',
    parking_type: 'garage',
    latitude: 47.378,
    longitude: 8.540,
    total_spots: 100,
    available_spots: 40,
    price_per_hour: '3.50',
    is_ev_charging: false,
    max_height: 2.1,
    opening_hours: '24/7',
    distance_m: 50,
    ...overrides,
  }
}

async function build(repoOverrides: Partial<ParkingRepository> = {}) {
  const repoMock = {
    findNearby: vi.fn(),
    findById: vi.fn(),
    ...repoOverrides,
  } as unknown as ParkingRepository

  const moduleRef = await Test.createTestingModule({
    providers: [
      ParkingService,
      { provide: ParkingRepository, useValue: repoMock },
    ],
  }).compile()

  return { service: moduleRef.get(ParkingService), repo: repoMock }
}

describe('ParkingService.findNearby', () => {
  it('returns DTOs mapped from repository rows', async () => {
    const { service, repo } = await build()
    ;(repo.findNearby as any).mockResolvedValue([makeRow({ name: 'A' }), makeRow({ id: 2, name: 'B' })])

    const result = await service.findNearby({ lat: 47.378, lng: 8.540, radius: 2000 })

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('A')
    expect(result[0].pricePerHour).toBe(3.5)
    expect(result[0].distanceM).toBe(50)
  })

  it('forwards filters to the repository', async () => {
    const { service, repo } = await build()
    ;(repo.findNearby as any).mockResolvedValue([])

    await service.findNearby({
      lat: 47.378,
      lng: 8.540,
      radius: 1000,
      parkingType: ['garage'],
      isEvCharging: true,
      isFree: false,
    })

    expect(repo.findNearby).toHaveBeenCalledWith({
      lat: 47.378,
      lng: 8.540,
      radius: 1000,
      parkingType: ['garage'],
      isEvCharging: true,
      isFree: false,
    })
  })
})

describe('ParkingService.findById', () => {
  it('returns DTO when parking found', async () => {
    const { service, repo } = await build()
    ;(repo.findById as any).mockResolvedValue(makeRow({ id: 42, name: 'Hohe Promenade' }))

    const result = await service.findById(42)

    expect(result.id).toBe(42)
    expect(result.name).toBe('Hohe Promenade')
  })

  it('throws NotFoundException when parking missing', async () => {
    const { service, repo } = await build()
    ;(repo.findById as any).mockResolvedValue(null)

    await expect(service.findById(999)).rejects.toThrow(NotFoundException)
  })
})
```

- [ ] **Step 2 (RED): Run tests, expect FAIL**

```bash
cd backend
pnpm test src/parking/parking.service.spec.ts
```

Expected: FAIL with `Cannot find module './parking.service'`.

- [ ] **Step 3 (GREEN): Create `backend/src/parking/parking.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common'
import { ParkingResponseDto } from './dto/parking-response.dto'
import { ParkingRepository, type FindNearbyParams } from './parking.repository'

@Injectable()
export class ParkingService {
  constructor(private readonly repo: ParkingRepository) {}

  async findNearby(params: FindNearbyParams): Promise<ParkingResponseDto[]> {
    const rows = await this.repo.findNearby(params)
    return rows.map((row) => ParkingResponseDto.fromRow(row))
  }

  async findById(id: number): Promise<ParkingResponseDto> {
    const row = await this.repo.findById(id)
    if (row === null) {
      throw new NotFoundException(`Parking with id ${id} not found`)
    }
    return ParkingResponseDto.fromRow(row)
  }
}
```

- [ ] **Step 4 (GREEN): Run tests, verify pass**

```bash
cd backend
pnpm test src/parking/parking.service.spec.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/parking/parking.service.ts backend/src/parking/parking.service.spec.ts
git commit -m "feat(backend): add ParkingService (TDD, 4 tests)"
```

---

## Phase 9 — ParkingController + Module-Wire-Up

### Task 15: ParkingController + ParkingModule

**Files:**
- Create: `backend/src/parking/parking.controller.ts`
- Create: `backend/src/parking/parking.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create `backend/src/parking/parking.controller.ts`**

```typescript
import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common'
import { ParkingResponseDto } from './dto/parking-response.dto'
import { FindNearbyDto } from './dto/find-nearby.dto'
import { ParkingService } from './parking.service'

@Controller('parkings')
export class ParkingController {
  constructor(private readonly service: ParkingService) {}

  @Get()
  async findNearby(@Query() query: FindNearbyDto): Promise<ParkingResponseDto[]> {
    return this.service.findNearby({
      lat: query.lat,
      lng: query.lng,
      radius: query.radius,
      parkingType: query.parking_type,
      isEvCharging: query.is_ev_charging,
      isFree: query.is_free,
    })
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number): Promise<ParkingResponseDto> {
    return this.service.findById(id)
  }
}
```

- [ ] **Step 2: Create `backend/src/parking/parking.module.ts`**

```typescript
import { Module } from '@nestjs/common'
import { ParkingController } from './parking.controller'
import { ParkingRepository } from './parking.repository'
import { ParkingService } from './parking.service'

@Module({
  controllers: [ParkingController],
  providers: [ParkingService, ParkingRepository],
})
export class ParkingModule {}
```

- [ ] **Step 3: Update `backend/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common'
import { HealthController } from './health/health.controller'
import { ParkingModule } from './parking/parking.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [PrismaModule, ParkingModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 4: Build to verify**

```bash
cd backend
pnpm build
```

Expected: No TS errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/parking/parking.controller.ts backend/src/parking/parking.module.ts backend/src/app.module.ts
git commit -m "feat(backend): wire ParkingController and ParkingModule into app"
```

---

### Task 16: ParkingController HTTP-Tests (Supertest, Integration)

**Files:**
- Create: `backend/src/parking/parking.controller.integration.spec.ts`

- [ ] **Step 1 (RED): Create `backend/src/parking/parking.controller.integration.spec.ts`**

```typescript
import { ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../app.module'
import { PrismaService } from '../prisma/prisma.service'

const databaseUrl = process.env.DATABASE_URL_TEST!

let app: INestApplication
let prisma: PrismaClient

beforeAll(async () => {
  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile()

  app = moduleRef.createNestApplication()
  app.setGlobalPrefix('api', { exclude: ['health'] })
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  )
  await app.init()
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE parkings RESTART IDENTITY CASCADE')
})

describe('GET /api/parkings', () => {
  it('returns 400 when lat is missing', async () => {
    const res = await request(app.getHttpServer()).get('/api/parkings').query({ lng: '8.540' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when lat is out of range', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/parkings')
      .query({ lat: '95', lng: '8.540' })
    expect(res.status).toBe(400)
  })

  it('returns empty array when no parkings in radius', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/parkings')
      .query({ lat: '47.378', lng: '8.540', radius: '500' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns nearby parkings sorted by distance', async () => {
    await prisma.parking.createMany({
      data: [
        { name: 'A', address: 'A', city: 'Zürich', parkingType: 'garage', latitude: 47.3782, longitude: 8.5408, totalSpots: 100, availableSpots: 40, pricePerHour: 3.5 },
        { name: 'B', address: 'B', city: 'Zürich', parkingType: 'garage', latitude: 47.3850, longitude: 8.5500, totalSpots: 100, availableSpots: 40, pricePerHour: 3.5 },
      ],
    })
    const res = await request(app.getHttpServer())
      .get('/api/parkings')
      .query({ lat: '47.378', lng: '8.540', radius: '5000' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].name).toBe('A')
    expect(res.body[1].name).toBe('B')
    expect(res.body[0].distanceM).toBeLessThan(res.body[1].distanceM)
  })

  it('applies parking_type filter (CSV)', async () => {
    await prisma.parking.createMany({
      data: [
        { name: 'Garage', address: 'A', city: 'Zürich', parkingType: 'garage', latitude: 47.3782, longitude: 8.5408, totalSpots: 100, availableSpots: 40, pricePerHour: 3.5 },
        { name: 'Street', address: 'B', city: 'Zürich', parkingType: 'street', latitude: 47.3782, longitude: 8.5409, totalSpots: 10, availableSpots: 5, pricePerHour: 1.5 },
      ],
    })
    const res = await request(app.getHttpServer())
      .get('/api/parkings')
      .query({ lat: '47.378', lng: '8.540', radius: '1000', parking_type: 'garage' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('Garage')
  })
})

describe('GET /api/parkings/:id', () => {
  it('returns 404 when id not found', async () => {
    const res = await request(app.getHttpServer()).get('/api/parkings/999')
    expect(res.status).toBe(404)
  })

  it('returns 400 when id is not numeric', async () => {
    const res = await request(app.getHttpServer()).get('/api/parkings/abc')
    expect(res.status).toBe(400)
  })

  it('returns parking details when id exists', async () => {
    const created = await prisma.parking.create({
      data: {
        name: 'Hohe Promenade',
        address: 'Promenadengasse 1',
        city: 'Zürich',
        parkingType: 'garage',
        latitude: 47.3700,
        longitude: 8.5453,
        totalSpots: 200,
        availableSpots: 80,
        pricePerHour: 4.5,
        isEvCharging: true,
      },
    })
    const res = await request(app.getHttpServer()).get(`/api/parkings/${created.id}`)
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Hohe Promenade')
    expect(res.body.isEvCharging).toBe(true)
    expect(res.body.pricePerHour).toBe(4.5)
  })
})

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app.getHttpServer()).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
```

- [ ] **Step 2 (GREEN): Run tests, verify all pass**

```bash
cd backend
DATABASE_URL_TEST=postgresql://parking:parking@localhost:5433/parking_test pnpm test:integration src/parking/parking.controller.integration.spec.ts
```

Expected: All 9 tests pass.

If any fail with PrismaService injection issues: ensure the test imports `AppModule` directly and overrides `PrismaService` (already done above).

- [ ] **Step 3: Commit**

```bash
git add backend/src/parking/parking.controller.integration.spec.ts
git commit -m "test(backend): add ParkingController HTTP integration tests (9 tests)"
```

---

## Phase 10 — Global Exception Filter

### Task 17: HttpExceptionFilter (TDD)

**Files:**
- Create: `backend/src/common/filters/http-exception.filter.spec.ts`
- Create: `backend/src/common/filters/http-exception.filter.ts`
- Modify: `backend/src/main.ts`

- [ ] **Step 1 (RED): Create `backend/src/common/filters/http-exception.filter.spec.ts`**

```typescript
import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { HttpExceptionFilter } from './http-exception.filter'

function makeHost(): { host: ArgumentsHost; status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; req: { url: string } } {
  const json = vi.fn()
  const status = vi.fn().mockReturnValue({ json })
  const req = { url: '/api/test' }
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost
  return { host, status, json, req }
}

describe('HttpExceptionFilter', () => {
  it('formats NotFoundException as 404 JSON response', () => {
    const filter = new HttpExceptionFilter()
    const { host, status, json } = makeHost()

    filter.catch(new NotFoundException('Parking with id 42 not found'), host)

    expect(status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Parking with id 42 not found',
        path: '/api/test',
      }),
    )
  })

  it('formats BadRequestException as 400 JSON response', () => {
    const filter = new HttpExceptionFilter()
    const { host, status, json } = makeHost()

    filter.catch(new BadRequestException(['lat must be a latitude']), host)

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    )
  })

  it('formats unknown errors as 500 JSON response', () => {
    const filter = new HttpExceptionFilter()
    const { host, status, json } = makeHost()

    filter.catch(new Error('boom'), host)

    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Internal server error' }),
    )
  })
})
```

- [ ] **Step 2 (RED): Run, expect FAIL**

```bash
cd backend
pnpm test src/common/filters/http-exception.filter.spec.ts
```

Expected: FAIL with `Cannot find module './http-exception.filter'`.

- [ ] **Step 3 (GREEN): Create `backend/src/common/filters/http-exception.filter.ts`**

```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { Request, Response } from 'express'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR
    let message: string | string[] = 'Internal server error'

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus()
      const body = exception.getResponse()
      if (typeof body === 'string') {
        message = body
      } else if (typeof body === 'object' && body !== null && 'message' in body) {
        message = (body as { message: string | string[] }).message
      } else {
        message = exception.message
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack)
    }

    response.status(statusCode).json({
      statusCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    })
  }
}
```

- [ ] **Step 4 (GREEN): Run, expect PASS**

```bash
cd backend
pnpm test src/common/filters/http-exception.filter.spec.ts
```

Expected: All 3 tests pass.

- [ ] **Step 5: Wire into `backend/src/main.ts`**

Update `main.ts` to use the filter globally:

```typescript
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api', { exclude: ['health'] })
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  app.useGlobalFilters(new HttpExceptionFilter())
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  })

  const port = Number(process.env.PORT ?? 3001)
  await app.listen(port)
  console.log(`Backend listening on http://localhost:${port}`)
}

bootstrap()
```

- [ ] **Step 6: Build to verify**

```bash
cd backend
pnpm build
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/common backend/src/main.ts
git commit -m "feat(backend): add global HttpExceptionFilter (TDD, 3 tests)"
```

---

## Phase 11 — Seed-Daten

### Task 18: Mock-Parkplätze (~30) seeden

**Files:**
- Create: `backend/prisma/seed.ts`

- [ ] **Step 1: Create `backend/prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type SeedRow = {
  name: string
  address: string
  city: string
  parkingType: 'street' | 'garage' | 'private'
  latitude: number
  longitude: number
  totalSpots: number
  availableSpots: number
  pricePerHour: number
  isEvCharging?: boolean
  maxHeight?: number | null
  openingHours?: string | null
}

const PARKINGS: SeedRow[] = [
  // ────────── ZÜRICH (10) ──────────
  { name: 'PH Hohe Promenade', address: 'Promenadengasse 1, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3700, longitude: 8.5453, totalSpots: 220, availableSpots: 130, pricePerHour: 4.50, isEvCharging: true, maxHeight: 2.10, openingHours: '24/7' },
  { name: 'PH Urania', address: 'Uraniastrasse 3, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3744, longitude: 8.5407, totalSpots: 380, availableSpots: 95, pricePerHour: 4.00, isEvCharging: true, maxHeight: 2.00, openingHours: '24/7' },
  { name: 'PH Globus', address: 'Lintheschergasse 1, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3766, longitude: 8.5396, totalSpots: 540, availableSpots: 40, pricePerHour: 4.00, isEvCharging: false, maxHeight: 2.00, openingHours: 'Mo-Sa 06:00-24:00, So 08:00-22:00' },
  { name: 'PH Talgarten', address: 'Talstrasse 82, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3712, longitude: 8.5358, totalSpots: 130, availableSpots: 8, pricePerHour: 3.50, isEvCharging: false, maxHeight: 1.95, openingHours: '24/7' },
  { name: 'Strassenparkplätze Niederdorfstrasse', address: 'Niederdorfstrasse, 8001 Zürich', city: 'Zürich', parkingType: 'street', latitude: 47.3722, longitude: 8.5446, totalSpots: 25, availableSpots: 12, pricePerHour: 2.00, isEvCharging: false, maxHeight: null, openingHours: 'Mo-Fr 08:00-19:00, Sa 08:00-16:00' },
  { name: 'PH Opéra', address: 'Falkenstrasse 1, 8008 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3672, longitude: 8.5469, totalSpots: 290, availableSpots: 150, pricePerHour: 4.50, isEvCharging: true, maxHeight: 2.05, openingHours: '24/7' },
  { name: 'PH Jelmoli', address: 'Steinmühleplatz 1, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3742, longitude: 8.5350, totalSpots: 320, availableSpots: 18, pricePerHour: 4.00, isEvCharging: false, maxHeight: 2.00, openingHours: 'Mo-Sa 06:30-24:00, So 09:00-22:00' },
  { name: 'PH USZ', address: 'Sternwartstrasse 14, 8091 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3766, longitude: 8.5519, totalSpots: 220, availableSpots: 90, pricePerHour: 3.50, isEvCharging: true, maxHeight: 2.10, openingHours: '24/7' },
  { name: 'Strassenparkplätze Bellevue', address: 'Bellevueplatz, 8001 Zürich', city: 'Zürich', parkingType: 'street', latitude: 47.3666, longitude: 8.5455, totalSpots: 18, availableSpots: 0, pricePerHour: 2.50, isEvCharging: false, maxHeight: null, openingHours: 'Mo-Sa 08:00-21:00' },
  { name: 'Privatparkplatz Volkshaus', address: 'Stauffacherstrasse 60, 8004 Zürich', city: 'Zürich', parkingType: 'private', latitude: 47.3742, longitude: 8.5269, totalSpots: 12, availableSpots: 7, pricePerHour: 0.00, isEvCharging: false, maxHeight: null, openingHours: 'Mo-So 06:00-23:00' },

  // ────────── BERN (6) ──────────
  { name: 'PH Casino', address: 'Kochergasse 1, 3011 Bern', city: 'Bern', parkingType: 'garage', latitude: 46.9479, longitude: 7.4474, totalSpots: 320, availableSpots: 110, pricePerHour: 3.50, isEvCharging: true, maxHeight: 2.00, openingHours: '24/7' },
  { name: 'PH Rathaus', address: 'Rathausgasse 18, 3011 Bern', city: 'Bern', parkingType: 'garage', latitude: 46.9487, longitude: 7.4513, totalSpots: 260, availableSpots: 25, pricePerHour: 3.50, isEvCharging: false, maxHeight: 2.05, openingHours: '24/7' },
  { name: 'PH Metro', address: 'Waisenhausplatz 32, 3011 Bern', city: 'Bern', parkingType: 'garage', latitude: 46.9490, longitude: 7.4435, totalSpots: 360, availableSpots: 180, pricePerHour: 3.00, isEvCharging: true, maxHeight: 2.00, openingHours: '24/7' },
  { name: 'Strassenparkplätze Münsterplatz', address: 'Münsterplatz, 3011 Bern', city: 'Bern', parkingType: 'street', latitude: 46.9466, longitude: 7.4514, totalSpots: 35, availableSpots: 14, pricePerHour: 2.00, isEvCharging: false, maxHeight: null, openingHours: 'Mo-Sa 08:00-19:00' },
  { name: 'PH PostParc', address: 'Schanzenstrasse 5, 3008 Bern', city: 'Bern', parkingType: 'garage', latitude: 46.9495, longitude: 7.4380, totalSpots: 600, availableSpots: 320, pricePerHour: 3.00, isEvCharging: true, maxHeight: 2.10, openingHours: '24/7' },
  { name: 'Privatparkplatz Reitschule', address: 'Neubrückstrasse 8, 3012 Bern', city: 'Bern', parkingType: 'private', latitude: 46.9525, longitude: 7.4395, totalSpots: 15, availableSpots: 9, pricePerHour: 0.00, isEvCharging: false, maxHeight: null, openingHours: 'Mo-So 24/7' },

  // ────────── GENF (6) ──────────
  { name: 'Parking du Mont-Blanc', address: 'Rue du Mont-Blanc 19, 1201 Genève', city: 'Genève', parkingType: 'garage', latitude: 46.2087, longitude: 6.1457, totalSpots: 720, availableSpots: 230, pricePerHour: 3.80, isEvCharging: true, maxHeight: 2.05, openingHours: '24/7' },
  { name: 'Parking Cornavin', address: 'Place de Cornavin 7, 1201 Genève', city: 'Genève', parkingType: 'garage', latitude: 46.2096, longitude: 6.1421, totalSpots: 900, availableSpots: 450, pricePerHour: 3.50, isEvCharging: true, maxHeight: 2.00, openingHours: '24/7' },
  { name: 'Parking Plainpalais', address: 'Rond-Point de Plainpalais, 1205 Genève', city: 'Genève', parkingType: 'garage', latitude: 46.1972, longitude: 6.1410, totalSpots: 350, availableSpots: 60, pricePerHour: 2.80, isEvCharging: false, maxHeight: 2.10, openingHours: '24/7' },
  { name: 'Strassenparkplätze Bel-Air', address: 'Place de Bel-Air, 1204 Genève', city: 'Genève', parkingType: 'street', latitude: 46.2050, longitude: 6.1430, totalSpots: 22, availableSpots: 5, pricePerHour: 2.00, isEvCharging: false, maxHeight: null, openingHours: 'Mo-Sa 08:00-19:00' },
  { name: 'Parking de la Gare', address: 'Place de Cornavin, 1201 Genève', city: 'Genève', parkingType: 'garage', latitude: 46.2103, longitude: 6.1425, totalSpots: 280, availableSpots: 140, pricePerHour: 3.50, isEvCharging: false, maxHeight: 2.05, openingHours: '24/7' },
  { name: 'Privatparkplatz Pâquis', address: 'Rue de Berne 28, 1201 Genève', city: 'Genève', parkingType: 'private', latitude: 46.2120, longitude: 6.1480, totalSpots: 18, availableSpots: 11, pricePerHour: 0.00, isEvCharging: true, maxHeight: 1.95, openingHours: '24/7' },

  // ────────── BASEL (4) ──────────
  { name: 'PH Elisabethen', address: 'Steinentorstrasse 13, 4051 Basel', city: 'Basel', parkingType: 'garage', latitude: 47.5546, longitude: 7.5859, totalSpots: 540, availableSpots: 220, pricePerHour: 3.00, isEvCharging: true, maxHeight: 2.00, openingHours: '24/7' },
  { name: 'PH Steinen', address: 'Steinentorberg 25, 4051 Basel', city: 'Basel', parkingType: 'garage', latitude: 47.5552, longitude: 7.5895, totalSpots: 460, availableSpots: 35, pricePerHour: 2.80, isEvCharging: false, maxHeight: 2.05, openingHours: 'Mo-Sa 06:00-24:00, So 08:00-22:00' },
  { name: 'Strassenparkplätze Marktplatz', address: 'Marktplatz, 4051 Basel', city: 'Basel', parkingType: 'street', latitude: 47.5582, longitude: 7.5878, totalSpots: 14, availableSpots: 6, pricePerHour: 2.50, isEvCharging: false, maxHeight: null, openingHours: 'Mo-Sa 08:00-19:00' },
  { name: 'Privatparkplatz Kleinbasel', address: 'Riehenstrasse 154, 4058 Basel', city: 'Basel', parkingType: 'private', latitude: 47.5685, longitude: 7.6068, totalSpots: 22, availableSpots: 14, pricePerHour: 0.00, isEvCharging: false, maxHeight: null, openingHours: '24/7' },

  // ────────── LUZERN (4) ──────────
  { name: 'PH Bahnhof', address: 'Zentralstrasse 1, 6002 Luzern', city: 'Luzern', parkingType: 'garage', latitude: 47.0501, longitude: 8.3094, totalSpots: 460, availableSpots: 100, pricePerHour: 3.00, isEvCharging: true, maxHeight: 2.05, openingHours: '24/7' },
  { name: 'PH Flora', address: 'Hirschmattstrasse 13, 6003 Luzern', city: 'Luzern', parkingType: 'garage', latitude: 47.0497, longitude: 8.3056, totalSpots: 220, availableSpots: 12, pricePerHour: 2.50, isEvCharging: false, maxHeight: 2.00, openingHours: 'Mo-Sa 06:00-24:00' },
  { name: 'Strassenparkplätze Schwanenplatz', address: 'Schwanenplatz, 6004 Luzern', city: 'Luzern', parkingType: 'street', latitude: 47.0531, longitude: 8.3091, totalSpots: 18, availableSpots: 4, pricePerHour: 2.00, isEvCharging: false, maxHeight: null, openingHours: 'Mo-Sa 08:00-19:00' },
  { name: 'Privatparkplatz Tribschen', address: 'Tribschenstrasse 60, 6005 Luzern', city: 'Luzern', parkingType: 'private', latitude: 47.0421, longitude: 8.3197, totalSpots: 16, availableSpots: 11, pricePerHour: 0.00, isEvCharging: true, maxHeight: null, openingHours: '24/7' },
]

async function main(): Promise<void> {
  console.log(`Seeding ${PARKINGS.length} parkings...`)
  await prisma.parking.deleteMany()
  await prisma.parking.createMany({ data: PARKINGS })
  console.log(`Done. Inserted ${PARKINGS.length} rows.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

- [ ] **Step 2: Run seed**

```bash
cd backend
DATABASE_URL=postgresql://parking:parking@localhost:5432/parking pnpm db:seed
```

Expected: `Seeding 30 parkings...` then `Done. Inserted 30 rows.`

- [ ] **Step 3: Verify count**

```bash
docker compose exec db psql -U parking -d parking -c "SELECT COUNT(*) FROM parkings;"
```

Expected: `count = 30`.

- [ ] **Step 4: Verify location-Trigger funktioniert**

```bash
docker compose exec db psql -U parking -d parking -c "SELECT id, name, ST_AsText(location) FROM parkings LIMIT 3;"
```

Expected: Drei Zeilen mit `POINT(<lng> <lat>)`-Werten.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat(backend): add seed data with 30 Swiss parkings"
```

---

## Phase 12 — End-to-End Manuelle Verifikation

### Task 19: Volle Backend-Test-Suite

**Files:** None (verification only)

- [ ] **Step 1: Stelle sicher, beide DBs laufen**

```bash
docker compose up -d db db-test
```

- [ ] **Step 2: Wende Migration auf Test-DB an**

```bash
cd backend
DATABASE_URL=postgresql://parking:parking@localhost:5433/parking_test pnpm prisma migrate deploy
```

Expected: `All migrations have been successfully applied.`

- [ ] **Step 3: Run alle Unit-Tests**

```bash
cd backend
pnpm test
```

Expected: Alle Unit-Tests grün:
- `health.controller.spec.ts` (1)
- `find-nearby.dto.spec.ts` (9)
- `parking.service.spec.ts` (4)
- `http-exception.filter.spec.ts` (3)

Total: 17 Unit-Tests, alle PASS.

- [ ] **Step 4: Run alle Integration-Tests**

```bash
cd backend
DATABASE_URL_TEST=postgresql://parking:parking@localhost:5433/parking_test pnpm test:integration
```

Expected:
- `parking.repository.integration.spec.ts` (10)
- `parking.controller.integration.spec.ts` (9)

Total: 19 Integration-Tests, alle PASS.

- [ ] **Step 5: Stop DBs für sauberen Restart**

```bash
docker compose down
```

---

### Task 20: End-to-End-Smoke-Test (live API)

**Files:** None (verification only)

- [ ] **Step 1: Starte alle Services**

```bash
docker compose up -d --build
```

- [ ] **Step 2: Wait for backend ready**

```bash
docker compose logs backend | grep -m1 "Backend listening" || sleep 5
curl -s http://localhost:3001/health | jq .
```

Expected: `{ "status": "ok", "timestamp": "..." }`

- [ ] **Step 3: Seed via the running container**

```bash
docker compose exec backend pnpm db:seed
```

Expected: `Done. Inserted 30 rows.`

- [ ] **Step 4: Hit /api/parkings around Zürich HB**

```bash
curl -s "http://localhost:3001/api/parkings?lat=47.378&lng=8.540&radius=2000" | jq 'length'
```

Expected: A number ≥ 5 (most Zürich entries should fall within 2 km of Zürich HB).

```bash
curl -s "http://localhost:3001/api/parkings?lat=47.378&lng=8.540&radius=2000" | jq '.[0]'
```

Expected: A JSON object with `name`, `address`, `pricePerHour`, `distanceM`, etc.

- [ ] **Step 5: Test parking_type-Filter**

```bash
curl -s "http://localhost:3001/api/parkings?lat=47.378&lng=8.540&radius=2000&parking_type=street" | jq '[.[].parkingType] | unique'
```

Expected: `["street"]`

- [ ] **Step 6: Test combined filters**

```bash
curl -s "http://localhost:3001/api/parkings?lat=47.378&lng=8.540&radius=5000&is_ev_charging=true&is_free=false" | jq 'all(.[]; .isEvCharging == true and .pricePerHour > 0)'
```

Expected: `true`

- [ ] **Step 7: Test Detail-Endpoint**

```bash
curl -s http://localhost:3001/api/parkings/1 | jq .
```

Expected: A single object (the first seeded parking, "PH Hohe Promenade").

- [ ] **Step 8: Test 404**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/parkings/9999
```

Expected: `404`

- [ ] **Step 9: Test 400 (invalid query)**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/parkings?lat=999&lng=8.540"
```

Expected: `400`

- [ ] **Step 10: Stop services**

```bash
docker compose down
```

- [ ] **Step 11: Final commit (cosmetic — only if anything changed)**

```bash
git status
# If clean, skip; otherwise:
# git add -A && git commit -m "chore: end-to-end verification"
```

---

## Definition of Done — Plan A

After all tasks pass, you should have:

1. ✅ Repo with `.gitignore`, `.env.example`, `README.md`, `database/`
2. ✅ `docker compose up` starts `db`, `db-test`, `backend`
3. ✅ NestJS app at `http://localhost:3001`
4. ✅ `GET /health` → `{ status: "ok" }`
5. ✅ `GET /api/parkings?lat=&lng=&radius=` returns nearby parkings, sorted by distance
6. ✅ `GET /api/parkings/:id` returns one parking or 404
7. ✅ Filter `is_ev_charging`, `parking_type` (CSV), `is_free` work
8. ✅ Validation: 400 on invalid input
9. ✅ 30 seeded mock parkings across 5 Swiss cities
10. ✅ All 17 unit tests pass (`pnpm test`)
11. ✅ All 19 integration tests pass (`pnpm test:integration`)

**Plan B (Frontend) baut auf diesem API auf — wird geschrieben, sobald Plan A abgeschlossen ist.**
