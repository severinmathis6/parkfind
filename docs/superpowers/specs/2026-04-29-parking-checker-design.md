# Parking Availability Checker — Design Spec

**Datum:** 2026-04-29
**Status:** Approved (pending user spec review)
**Scope:** MVP — Lokal lauffähige Anwendung mit Mock-Daten

---

## 1. Ziel

Eine Schweiz-fokussierte Web-Anwendung, die User schnell freie Parkplätze in ihrer Nähe finden lässt. MVP läuft komplett lokal (Docker) mit Mock-Daten und ohne externe API-Abhängigkeiten.

## 2. Getroffene Entscheidungen (Brainstorming-Session)

| # | Entscheidung | Gewählt | Alternativen |
|---|---|---|---|
| 1 | Scope | Lokaler MVP mit Mock-Daten | Echte Schweizer Open Data; Production-Deployment |
| 2 | Map-Bibliothek | Leaflet + OpenStreetMap | Mapbox GL JS |
| 3 | Backend-Framework | NestJS + TypeScript | Express + TypeScript |
| 4 | Reporting-Feature | Skip im MVP | Inkludiert |
| 5 | UI-Sprachen | Deutsch + Englisch (i18n via next-intl) | Nur DE; Nur EN |
| 6 | Repo-Struktur | Plain Folders | npm/pnpm Workspaces |
| 7 | Test-Strategie | Volles TDD | Smoke-Tests; Keine Tests |
| 8 | DB-Zugriff | Prisma + `$queryRaw` für Geo | TypeORM; Raw `pg` |

## 3. High-Level Architektur

```
┌─────────────────────────────────────┐
│  Browser (User)                     │
└──────────────┬──────────────────────┘
               │  HTTPS / Geolocation API
               ▼
┌─────────────────────────────────────┐
│  Next.js 14 (App Router)            │
│  - Server Components für i18n       │
│  - Client Component für Map         │
│  - TanStack Query für API-Calls     │
└──────────────┬──────────────────────┘
               │  REST (JSON)
               ▼
┌─────────────────────────────────────┐
│  NestJS API (Express adapter)       │
│  - Module: ParkingModule, Health    │
│  - Prisma Client als Provider       │
│  - Validation via class-validator   │
└──────────────┬──────────────────────┘
               │  Prisma + $queryRaw (ST_DWithin)
               ▼
┌─────────────────────────────────────┐
│  PostgreSQL 16 + PostGIS 3.4        │
│  - Tabelle: parkings                │
│  - GIST-Index auf location          │
└─────────────────────────────────────┘
```

**Drei Docker-Services**, orchestriert via `docker-compose.yml`:
- `db` — Postgres 16 + PostGIS 3.4 (`postgis/postgis:16-3.4`), Port 5432
- `db-test` — gleiches Image für Tests, Port 5433, tmpfs für Speed
- `backend` — NestJS, Port 3001, hot-reload via `start:dev`
- `frontend` — Next.js, Port 3000, hot-reload via `dev`

## 4. Repo-Struktur

```
parking-checker/
├── frontend/             # Next.js 14
├── backend/              # NestJS (enthält backend/prisma/)
├── database/             # SQL-Referenzen, manuelle Skripte, README
├── docs/                 # Specs (dieses File hier)
├── docker-compose.yml
├── .env.example
└── README.md
```

**Hinweis:** Die CLAUDE.md-Spec listet `database/` als top-level Folder. Praktisch lebt Prisma jedoch in `backend/prisma/` — das ist die NestJS+Prisma-Standardkonvention und vermeidet ein separates Package nur für die DB-Schicht. Der `database/` Folder dient für ergänzende DB-Artefakte (raw SQL für Referenz, ad-hoc-Migrationsskripte, README mit Setup-Steps), enthält aber **nicht** das Prisma-Schema selbst.

## 5. Backend (NestJS)

### 5.1 Module-Struktur

```
backend/src/
├── main.ts                       # Bootstrap, Pipes, CORS
├── app.module.ts                 # Root-Modul
├── prisma/
│   ├── prisma.module.ts          # Global @Module → PrismaService
│   └── prisma.service.ts         # PrismaClient mit lifecycle hooks
├── parking/
│   ├── parking.module.ts
│   ├── parking.controller.ts     # HTTP-Layer
│   ├── parking.service.ts        # Business-Logic
│   ├── parking.repository.ts     # Prisma + raw queries
│   ├── dto/
│   │   ├── find-nearby.dto.ts    # Query-Validation
│   │   └── parking-response.dto.ts
│   └── *.spec.ts                 # TDD-Tests
└── health/
    └── health.controller.ts       # GET /health
```

### 5.2 Endpoints

| Methode | Pfad | Beschreibung | Query / Body |
|---|---|---|---|
| `GET` | `/api/parkings` | Liste in Radius | `lat` (float), `lng` (float), `radius` (int, m, default 2000), optional `is_ev_charging` (bool), `parking_type` (CSV: `street,garage` o. ä.), `is_free` (bool) |
| `GET` | `/api/parkings/:id` | Einzelnes Parking | `id` (int, path) |
| `GET` | `/health` | Health-Check | — |

### 5.3 DTOs (Validation)

`FindNearbyDto`:
- `lat: number` — `@IsLatitude()`
- `lng: number` — `@IsLongitude()`
- `radius?: number` — `@IsInt() @Min(50) @Max(20000)`, default 2000
- `is_ev_charging?: boolean` — `@IsBooleanString()` optional
- `parking_type?: ParkingType[]` — angenommen als Comma-Separated-Value Query-String (`?parking_type=street,garage`); via `@Transform(({value}) => value.split(','))` zu Array, `@IsArray() @IsEnum(ParkingType, { each: true })`
- `is_free?: boolean` — `@IsBooleanString()` optional

### 5.4 Geo-Query

```sql
SELECT id, name, address, city, latitude, longitude,
       total_spots, available_spots, price_per_hour,
       is_ev_charging, max_height, parking_type, opening_hours,
       ST_Distance(location, ST_MakePoint($lng, $lat)::geography) AS distance_m
FROM parkings
WHERE ST_DWithin(location, ST_MakePoint($lng, $lat)::geography, $radius)
  -- + dynamische Filter-Klauseln
ORDER BY distance_m ASC
LIMIT 200;
```

### 5.5 Error-Handling

- Globaler `HttpExceptionFilter` mappt:
  - `class-validator` Fail → 400
  - `NotFoundException` → 404
  - Prisma `PrismaClientKnownRequestError` → 400/500 je nach Code
  - Sonstiges → 500 (sanitized message, full Stack im Logger)
- CORS: nur `http://localhost:3000` in dev erlaubt

## 6. Frontend (Next.js 14)

### 6.1 Verzeichnis-Struktur

```
frontend/
├── app/
│   └── [locale]/
│       ├── layout.tsx           # NextIntlClientProvider + QueryProvider
│       └── page.tsx             # Main Map Page (Server Component)
├── components/
│   ├── Map/
│   │   ├── Map.tsx              # Leaflet Wrapper (dynamic, ssr:false)
│   │   ├── ParkingMarker.tsx    # Farb-codierter Pin
│   │   └── UserLocationMarker.tsx
│   ├── Filters/
│   │   ├── FilterBar.tsx        # Bottom-Sheet (mobile) / Sidebar (desktop)
│   │   └── FilterChip.tsx
│   ├── Detail/
│   │   ├── ParkingDetail.tsx    # Modal/Slide-Up bei Marker-Klick
│   │   └── NavigateButton.tsx   # Google Maps Deep Link
│   └── Location/
│       └── LocationButton.tsx   # Geolocation API
├── lib/
│   ├── api.ts                   # fetch-Wrapper
│   ├── queries.ts               # TanStack Query Hooks
│   ├── colors.ts                # availability → Farbe
│   └── types.ts                 # Shared TS-Types
├── i18n/
│   ├── config.ts                # next-intl Setup
│   ├── routing.ts               # Locale-Routing
│   └── messages/
│       ├── de.json
│       └── en.json
├── styles/globals.css           # Tailwind
├── next.config.mjs
├── tailwind.config.ts
└── package.json
```

### 6.2 Color-Logik (`lib/colors.ts`)

```ts
function availabilityColor(available: number, total: number): 'green' | 'yellow' | 'red' {
  if (total <= 0) return 'red'
  const ratio = available / total
  if (ratio >= 0.3) return 'green'
  if (ratio >= 0.1) return 'yellow'
  return 'red'
}
```

### 6.3 State-Management

| Bereich | Tool |
|---|---|
| Server-State (parkings list, parking details) | TanStack Query, staleTime 30s |
| Filter-State | URL-Search-Params (`useSearchParams`) — bookmarkbar |
| Karten-Viewport | lokaler Component-State |

### 6.4 Filter (matching CLAUDE.md-Spec)

1. `is_free` — Toggle (Free vs Paid)
2. `parking_type` — Multi-Select Chips: `street`, `garage`, `private`
3. `is_ev_charging` — Toggle

Jede Änderung schreibt in URL-Search-Params; React-Query refetcht automatisch via Query-Key.

### 6.5 Geolocation-Flow

1. Page-Load → `navigator.geolocation.getCurrentPosition()`-Prompt
2. Erfolg → Karte zentriert auf User-Coords; Query mit User-Coords
3. Verweigert/Error → Toast "Standort nicht verfügbar"; Karte zentriert auf Zürich HB (`47.378, 8.540`)
4. Karten-`moveend`-Event → Query mit neuem Center triggert Refetch

### 6.6 Mobile-First Responsive

- **Karte:** full-screen Hintergrund
- **Top-Bar:** App-Name, Locate-Me-Button, Sprache-Switcher
- **Filter:**
  - Mobile (<768px): Bottom-Sheet (slide-up)
  - Desktop (≥768px): linke Sidebar
- **Detail:**
  - Mobile: Bottom-Sheet
  - Desktop: rechtes Panel

### 6.7 Wichtige Implementierungs-Details

- Leaflet braucht `window` → Map-Component via `dynamic(() => import('./Map'), { ssr: false })`
- "Navigieren"-Button öffnet `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>` in neuem Tab
- Marker-Icons: Custom SVG-Pins in den drei Farben grün/gelb/rot
- Sprach-Switcher ändert URL von `/de/...` ↔ `/en/...`

## 7. Datenbank-Schema

### 7.1 Prisma-Schema (`backend/prisma/schema.prisma`)

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
  id              Int       @id @default(autoincrement())
  name            String
  address         String
  city            String
  parkingType     ParkingType @map("parking_type")
  latitude        Float
  longitude       Float
  // location als raw GEOGRAPHY-Spalte (über Migration), nicht in Prisma-Schema
  totalSpots      Int       @map("total_spots")
  availableSpots  Int       @map("available_spots")
  pricePerHour    Decimal   @map("price_per_hour") @db.Decimal(10, 2)
  isEvCharging    Boolean   @default(false) @map("is_ev_charging")
  maxHeight       Float?    @map("max_height")
  openingHours    String?   @map("opening_hours")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@map("parkings")
}

enum ParkingType {
  street
  garage
  private

  @@map("parking_type")
}
```

### 7.2 Custom Migration (PostGIS)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

-- ... Prisma generated CREATE ENUM / CREATE TABLE ...

-- PostGIS-Spalte
ALTER TABLE parkings ADD COLUMN location GEOGRAPHY(Point, 4326);

-- Trigger füllt location automatisch aus latitude/longitude
CREATE OR REPLACE FUNCTION update_parking_location() RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parkings_location_trigger
BEFORE INSERT OR UPDATE ON parkings
FOR EACH ROW EXECUTE FUNCTION update_parking_location();

-- Räumlicher Index
CREATE INDEX parkings_location_gix ON parkings USING GIST (location);

-- Filter-Indexe
CREATE INDEX parkings_is_ev_charging_idx ON parkings(is_ev_charging);
CREATE INDEX parkings_parking_type_idx ON parkings(parking_type);
```

### 7.3 Warum dieser Hybrid-Ansatz

- Prisma kennt `GEOGRAPHY` nicht → `location` ist nur in der Migration definiert, nicht im Prisma-Schema
- Trigger garantiert Konsistenz — App schreibt nur `latitude`/`longitude`
- App liest aus `location` via `$queryRaw` für `ST_DWithin`
- GIST-Index macht Geo-Queries effizient (~O(log n))

## 8. Mock-Daten (~30 Parkplätze)

### 8.1 Verteilung

| Stadt | Anzahl | Beispiele |
|---|---|---|
| Zürich | 10 | PH Hohe Promenade, PH Urania, PH Globus, PH Talgarten, Niederdorf-Strasse … |
| Bern | 6 | PH Casino, PH Rathaus, PH Metro … |
| Genf | 6 | Parking du Mont-Blanc, Cornavin, Plainpalais … |
| Basel | 4 | Elisabethen, Steinen … |
| Luzern | 4 | PH Bahnhof, Flora … |

### 8.2 Charakteristika

- ~50 % `garage`, ~30 % `street`, ~20 % `private`
- ~30 % gratis (`price_per_hour = 0.00`), ~70 % kostenpflichtig (CHF 1.50–4.50/h)
- ~25 % mit `is_ev_charging = true`
- Available/Total-Ratios bunt verteilt → alle drei Farb-Zustände sichtbar
- Realistische `max_height` für Garagen (1.90 m – 2.30 m), `null` für Strassenparkplätze
- `opening_hours` Beispiele: `"24/7"`, `"Mo-Fr 06:00-22:00, Sa 08:00-20:00"`

### 8.3 Seed

`backend/prisma/seed.ts` mit hardcoded Liste; Aufruf via `pnpm prisma db seed` (oder automatisch nach `prisma migrate reset`). Der Seed-Befehl ist in `backend/package.json` unter `prisma.seed` registriert.

## 9. Test-Strategie (volles TDD)

### 9.1 Test-Pyramide

```
        ┌──────────┐
        │   E2E    │  Playwright (1-2 Smoke-Pfade, optional)
        ├──────────┤
        │   API    │  Supertest (Controller HTTP)
        ├──────────┤
        │ Service  │  Vitest + Test-DB (Repository, Service)
        ├──────────┤
        │   Unit   │  Vitest (pure functions: colors, formatters)
        └──────────┘
```

### 9.2 Backend-Tests

| Typ | Tooling | Bereich | DB |
|---|---|---|---|
| Unit | Vitest | DTOs, Mapping, pure Funktionen | — |
| Repository | Vitest | `parking.repository.ts` mit echtem PostGIS | Test-DB |
| Service | Vitest | `parking.service.ts` mit mocked Repository | — |
| Controller (HTTP) | Vitest + Supertest | NestJS Test-Module | Test-DB |

### 9.3 Frontend-Tests

| Typ | Tooling | Bereich |
|---|---|---|
| Unit | Vitest | `lib/colors.ts`, `lib/api.ts` (mocked fetch) |
| Component | Vitest + RTL + jsdom | `FilterBar`, `ParkingDetail`, `LocationButton` |
| Hook | Vitest + RTL | `useNearbyParkings` (TanStack Query mock) |

Map-Component selbst wird **nicht** getestet (Leaflet braucht echtes DOM). Stattdessen: Wrapper-Logik in pure Funktionen extrahiert.

### 9.4 Test-DB-Setup

- Eigener Container `db-test` (Port 5433, tmpfs)
- `.env.test` mit `DATABASE_URL=postgresql://...@localhost:5433/parking_test`
- Vitest `globalSetup`: `prisma migrate deploy` einmalig
- `beforeEach`: `TRUNCATE parkings RESTART IDENTITY CASCADE`

### 9.5 TDD-Disziplin

1. **Red:** Test schreiben → Test schlägt mit erwartetem Grund fehl
2. **Green:** Minimaler Code, der Test grün macht — kein Over-Engineering
3. **Refactor:** Sauber machen, Tests bleiben grün
4. Erst dann nächste Test-Idee

### 9.6 Beispiel-Reihenfolge (`parking.service.spec.ts`)

1. `findNearby()` returns empty array when DB has no parkings
2. `findNearby()` returns parkings within radius
3. `findNearby()` excludes parkings outside radius
4. `findNearby()` applies `is_ev_charging` filter
5. `findNearby()` applies `parking_type` filter
6. `findNearby()` applies `is_free` filter (combined with above)
7. `findNearby()` orders by distance ascending
8. `findById()` returns parking when found
9. `findById()` throws `NotFoundException` for missing id

## 10. Docker-Compose

```yaml
services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: parking
      POSTGRES_USER: parking
      POSTGRES_PASSWORD: parking
    ports: ["5432:5432"]
    volumes: ["db-data:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U parking"]
      interval: 5s
      retries: 10

  db-test:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: parking_test
      POSTGRES_USER: parking
      POSTGRES_PASSWORD: parking
    ports: ["5433:5432"]
    tmpfs: ["/var/lib/postgresql/data"]

  backend:
    build: ./backend
    depends_on:
      db: { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql://parking:parking@db:5432/parking
      PORT: "3001"
      CORS_ORIGIN: http://localhost:3000
    ports: ["3001:3001"]
    volumes: ["./backend:/app", "/app/node_modules"]
    command: pnpm start:dev

  frontend:
    build: ./frontend
    depends_on: [backend]
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
    ports: ["3000:3000"]
    volumes: ["./frontend:/app", "/app/node_modules"]
    command: pnpm dev

volumes:
  db-data:
```

## 11. Environment-Variablen

`.env.example`:

```
# Backend
DATABASE_URL=postgresql://parking:parking@localhost:5432/parking
DATABASE_URL_TEST=postgresql://parking:parking@localhost:5433/parking_test
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 12. Akzeptanzkriterien (MVP "fertig" wenn)

1. `docker compose up` startet alle Services in <30 s
2. `localhost:3000` zeigt Karte zentriert auf User-Location oder Zürich-Fallback
3. ~30 farbige Parkplatz-Marker erscheinen in der Schweiz
4. Klick auf Marker → Detail-Panel mit allen Spec-Feldern (Adresse, Plätze, Preis, Öffnungszeiten, Constraints)
5. Drei Filter funktionieren und filtern Karten-Marker live
6. "Navigieren"-Button öffnet Google Maps in neuem Tab
7. Sprache umschaltbar zwischen DE und EN (URL: `/de/...` ↔ `/en/...`)
8. Alle Backend-Tests grün (`pnpm test` im `backend/`)
9. Alle Frontend-Tests grün (`pnpm test` im `frontend/`)
10. Erste Page-Load <2 s auf localhost (Lighthouse-Check)

## 13. Nicht im Scope (für spätere Iterationen)

- Reporting-Endpoint (`POST /api/parkings/:id/report`)
- Echte Schweizer Open-Data-Integration
- Production-Deployment (Vercel, Railway, Supabase)
- Auth/User-Accounts
- Verfügbarkeits-Vorhersage (historische Daten)
- Push-Notifications
- Reservierungen
- 3. & 4. Landessprachen (Französisch, Italienisch)
