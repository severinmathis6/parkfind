# ParkFind Zürich v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den bestehenden MVP (Backend NestJS + Frontend Next.js, beide lokal lauffähig) zu „ParkFind Zürich" v1 ausbauen: Live-PLS-Daten + Magic-Link-Auth + Favorites + Reports + Layout-Port + Production-Deployment auf Vercel/Render/Supabase/Resend.

**Architecture:** Monorepo bleibt. Backend bekommt drei neue Module (`sync`, `auth`, `favorites`, `reports`). Frontend bekommt Tab-Bar + Two-Pane-Layout + Account-Bereich. Datenmodell wird um `User`, `Favorite`, `Report`, `AuthToken` und `Parking.status/externalId/lastSyncedAt` erweitert.

**Tech Stack:** NestJS, Prisma, Postgres+PostGIS, `@nestjs/schedule`, `jsonwebtoken`, `nodemailer` (mit Resend SMTP) ODER `resend` npm-Paket, Next.js 14 App-Router, Tailwind v3, TanStack Query, Leaflet, next-intl.

**Spec:** `docs/superpowers/specs/2026-05-14-parkfind-zurich-v1-design.md`

---

## File Structure

```
backend/
├── prisma/
│   ├── schema.prisma          (extend: User, Favorite, Report, AuthToken; add Parking.status/externalId/lastSyncedAt)
│   └── migrations/
├── src/
│   ├── sync/                  (NEW)
│   │   ├── pls-feed.parser.ts (RSS → ParsedItem[])
│   │   ├── pls-sync.service.ts(fetcht + upserted)
│   │   └── sync.module.ts
│   ├── auth/                  (NEW)
│   │   ├── auth.controller.ts (request-link, verify, me, logout)
│   │   ├── auth.service.ts    (token generation, email send, JWT signing)
│   │   ├── auth.guard.ts      (JWT-Cookie → req.user)
│   │   ├── mailer.service.ts  (Resend wrapper)
│   │   └── auth.module.ts
│   ├── favorites/             (NEW)
│   │   ├── favorites.controller.ts
│   │   ├── favorites.service.ts
│   │   └── favorites.module.ts
│   ├── reports/               (NEW)
│   │   ├── reports.controller.ts
│   │   ├── reports.service.ts (Rate-Limit-Logik)
│   │   └── reports.module.ts
│   ├── parking/               (extend ParkingResponseDto: + status, isFavorite, recentReports)
│   ├── db/seed.ts             (replace with 17 Zürich PHs)
│   └── app.module.ts          (wire ScheduleModule, neue Module)
└── package.json               (+ rss-parser, resend, jsonwebtoken, cookie-parser, @nestjs/schedule)

frontend/
├── tailwind.config.ts         (extend: brand colors, fonts, radii)
├── app/[locale]/
│   ├── layout.tsx             (font links Instrument Serif + DM Mono + Geist)
│   ├── page.tsx               (Karte-Tab als Default)
│   ├── account/page.tsx       (NEW: Favoriten + Logout)
│   └── auth/verify/page.tsx   (NEW: Token einlösen, redirect)
├── components/
│   ├── Layout/
│   │   ├── TabBar.tsx         (NEW: Logo + Tabs + LocaleSwitcher)
│   │   └── LocaleSwitcher.tsx (restyle)
│   ├── Map/
│   │   ├── MapView.tsx        (NEW: Two-Pane container)
│   │   ├── MapSidebar.tsx     (NEW: Search + Filter + List)
│   │   ├── ParkingListItem.tsx(NEW)
│   │   ├── MapClient.tsx      (restyle marker)
│   │   └── ParkingMarker.tsx  (restyle with brand colors)
│   ├── Filters/
│   │   ├── FilterBar.tsx      (restyle pills)
│   │   └── FilterChip.tsx     (restyle)
│   ├── Detail/
│   │   ├── ParkingDetail.tsx  (restyle + add FavoriteToggle + ReportButton)
│   │   ├── FavoriteToggle.tsx (NEW)
│   │   └── ReportButton.tsx   (NEW)
│   ├── Account/
│   │   ├── LoginForm.tsx      (NEW)
│   │   └── FavoritesList.tsx  (NEW)
│   └── PageShell.tsx          (refactor: TabBar + active-tab state)
├── lib/
│   ├── api.ts                 (extend: auth, favorites, reports endpoints)
│   ├── queries.ts             (add useAuth, useFavorites, useReportParking)
│   └── types.ts               (add User, Favorite, Report, AuthState; default-Coords = Zürich HB)
├── i18n/messages/
│   ├── de.json                (extend: account, login, favorites, report, errors)
│   └── en.json                (parity)
└── __tests__/
    ├── components/
    │   ├── TabBar.spec.tsx
    │   ├── LoginForm.spec.tsx
    │   ├── FavoriteToggle.spec.tsx
    │   ├── ReportButton.spec.tsx
    │   └── MapSidebar.spec.tsx
    └── lib/
        └── api.spec.ts        (extend with auth/fav/report cases)

docs/
└── superpowers/specs/...      (existing)
```

---

## Phase 0 — PLS Spike (highest risk first)

### Task 0: PLS-Feed-Format verifizieren

Vor allem anderen muss das RSS-Format real-checked sein, sonst kollabieren Phase 2+.

**Files:**
- Create: `backend/scripts/pls-spike.ts`

- [ ] **Step 1: Spike-Skript anlegen**

```typescript
// backend/scripts/pls-spike.ts
import { XMLParser } from 'fast-xml-parser'

async function main() {
  const res = await fetch('https://www.pls-zh.ch/plsFeed/rss')
  if (!res.ok) {
    console.error('FETCH FAILED', res.status, res.statusText)
    process.exit(1)
  }
  const xml = await res.text()
  console.log('--- raw (first 2000 chars) ---')
  console.log(xml.slice(0, 2000))
  console.log('--- parsed ---')
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const obj = parser.parse(xml)
  console.log(JSON.stringify(obj.rss?.channel?.item?.slice(0, 3) ?? obj, null, 2))
}

main().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Run spike**

```bash
cd backend
npx tsx scripts/pls-spike.ts > /tmp/pls-spike.out 2>&1 || true
head -200 /tmp/pls-spike.out
```

Expected: Output zeigt RSS-Struktur. Achten auf:
- `title` Format (z. B. `"Hohe Promenade / besetzt / 12"` oder anderes Delimiter)
- `link` enthält Parkhaus-ID? Oder muss Name als Key dienen?
- `pubDate` vorhanden?
- HTML-Body in `description`?

- [ ] **Step 3: Beobachtungen in Plan-Anhang dokumentieren**

In `docs/superpowers/plans/2026-05-14-parkfind-zurich-v1-plan.md` am Ende einen Abschnitt „## Anhang: PLS-Feed Findings" anhängen mit:
- Exaktem Title-Pattern
- Anzahl Items
- Status-Werte-Wertebereich

Wenn Format anders als angenommen: Parser-Regex in Task 5 anpassen.

- [ ] **Step 4: Spike committen**

```bash
git add backend/scripts/pls-spike.ts docs/superpowers/plans/2026-05-14-parkfind-zurich-v1-plan.md
git commit -m "spike(backend): verify PLS RSS feed format"
```

---

## Phase 1 — Backend: Schema-Erweiterung

### Task 1: Prisma-Schema erweitern

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_v1_user_favorite_report/migration.sql` (via prisma migrate)

- [ ] **Step 1: Schema erweitern**

In `backend/prisma/schema.prisma` ergänzen (bestehendes `Parking`-Model anpassen, restliche Models hinzufügen):

```prisma
model Parking {
  // ... bestehende Felder bleiben ...
  externalId   String?       @unique
  status       ParkingStatus @default(UNKNOWN)
  lastSyncedAt DateTime?
  favorites    Favorite[]
  reports      Report[]
}

enum ParkingStatus {
  OPEN
  CLOSED
  FULL
  UNKNOWN
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
  favorites Favorite[]
  reports   Report[]
}

model Favorite {
  id        Int      @id @default(autoincrement())
  userId    String
  parkingId Int
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  parking   Parking  @relation(fields: [parkingId], references: [id], onDelete: Cascade)

  @@unique([userId, parkingId])
}

model Report {
  id            Int      @id @default(autoincrement())
  userId        String
  parkingId     Int
  reportedSpots Int
  createdAt     DateTime @default(now())
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  parking       Parking  @relation(fields: [parkingId], references: [id], onDelete: Cascade)

  @@index([parkingId, createdAt])
}

model AuthToken {
  token      String    @id
  email      String
  expiresAt  DateTime
  consumedAt DateTime?

  @@index([email])
}
```

- [ ] **Step 2: Migration erzeugen**

```bash
cd backend
DATABASE_URL=$DATABASE_URL_LOCAL npx prisma migrate dev --name v1_user_favorite_report --create-only
```

Hinweis: Bei lokalem Postgres-Lauf via docker compose. Wenn Docker fehlt, generate-only Befehl reicht für Schema-Validierung:

```bash
npx prisma generate
```

Und Migration manuell ausführen, wenn DB läuft.

- [ ] **Step 3: Generate Client**

```bash
npx prisma generate
```

Erwartet: Kein Fehler, Client kennt neue Typen.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(backend): extend schema with User, Favorite, Report, AuthToken + Parking.status"
```

---

### Task 2: Stammdaten Zürich seed

**Files:**
- Modify: `backend/src/db/seed.ts` (oder Pfad gemäß bestehendem Code)
- Create: `backend/src/db/zurich-parkings.ts` (17 Stammdatensätze)

- [ ] **Step 1: Stammdaten-Modul anlegen**

```typescript
// backend/src/db/zurich-parkings.ts
// 17 Zürcher Parkhäuser mit Stammdaten.
// externalId = Name aus dem PLS-Feed (kebab-case oder gemäß Feed).
// TODO nach Spike (Task 0): externalId-Format finalisieren.

export type SeedParking = {
  externalId: string
  name: string
  address: string
  city: string
  parkingType: 'garage'
  latitude: number
  longitude: number
  totalSpots: number
  pricePerHour: number
  isEvCharging: boolean
  maxHeight: number | null
  openingHours: string | null
}

export const ZURICH_SEED: SeedParking[] = [
  { externalId: 'hohe-promenade', name: 'Hohe Promenade', address: 'Promenadengasse 1, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3686, longitude: 8.5485, totalSpots: 220, pricePerHour: 4.50, isEvCharging: true, maxHeight: 2.10, openingHours: '24/7' },
  { externalId: 'opera', name: 'Opéra', address: 'Falkenstrasse 1, 8008 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3661, longitude: 8.5466, totalSpots: 290, pricePerHour: 5.00, isEvCharging: true, maxHeight: 2.00, openingHours: '24/7' },
  { externalId: 'urania', name: 'Urania', address: 'Uraniastrasse 3, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3744, longitude: 8.5404, totalSpots: 320, pricePerHour: 4.00, isEvCharging: false, maxHeight: 2.00, openingHours: '24/7' },
  { externalId: 'jelmoli', name: 'Jelmoli', address: 'Steinmühleplatz, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3737, longitude: 8.5391, totalSpots: 250, pricePerHour: 4.00, isEvCharging: false, maxHeight: 2.00, openingHours: '06:00–23:00' },
  { externalId: 'gessnerallee', name: 'Gessnerallee', address: 'Gessnerallee 14, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3754, longitude: 8.5359, totalSpots: 290, pricePerHour: 4.00, isEvCharging: true, maxHeight: 2.00, openingHours: '24/7' },
  { externalId: 'globus', name: 'Globus', address: 'Schweizergasse 10, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3729, longitude: 8.5380, totalSpots: 210, pricePerHour: 4.00, isEvCharging: false, maxHeight: 2.00, openingHours: '24/7' },
  { externalId: 'talgarten', name: 'Talgarten', address: 'Talstrasse 50, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3697, longitude: 8.5380, totalSpots: 350, pricePerHour: 4.50, isEvCharging: false, maxHeight: 2.00, openingHours: '24/7' },
  { externalId: 'parkhaus-utoquai', name: 'Utoquai', address: 'Utoquai 47, 8008 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3582, longitude: 8.5499, totalSpots: 180, pricePerHour: 3.50, isEvCharging: false, maxHeight: 2.00, openingHours: '24/7' },
  { externalId: 'pfingstweid', name: 'Pfingstweid', address: 'Pfingstweidstrasse 11, 8005 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3870, longitude: 8.5230, totalSpots: 400, pricePerHour: 3.00, isEvCharging: true, maxHeight: 2.10, openingHours: '24/7' },
  { externalId: 'sihlporte', name: 'Sihlporte', address: 'Sihlporte 3, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3717, longitude: 8.5365, totalSpots: 290, pricePerHour: 4.00, isEvCharging: false, maxHeight: 2.00, openingHours: '24/7' },
  { externalId: 'parkhaus-helvetiaplatz', name: 'Helvetiaplatz', address: 'Helvetiaplatz, 8004 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3739, longitude: 8.5290, totalSpots: 90, pricePerHour: 3.00, isEvCharging: false, maxHeight: 2.00, openingHours: '24/7' },
  { externalId: 'parkhaus-stampfenbach', name: 'Stampfenbach', address: 'Stampfenbachstrasse 65, 8006 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3825, longitude: 8.5448, totalSpots: 180, pricePerHour: 3.50, isEvCharging: false, maxHeight: 2.00, openingHours: '24/7' },
  { externalId: 'parkhaus-bahnhofquai', name: 'Bahnhofquai/Bahnhofplatz', address: 'Bahnhofquai, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3784, longitude: 8.5403, totalSpots: 120, pricePerHour: 4.50, isEvCharging: false, maxHeight: 2.00, openingHours: '24/7' },
  { externalId: 'parkhaus-feldegg', name: 'Feldegg', address: 'Feldeggstrasse, 8008 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3585, longitude: 8.5560, totalSpots: 140, pricePerHour: 3.50, isEvCharging: false, maxHeight: 2.00, openingHours: '24/7' },
  { externalId: 'parkhaus-uni-irchel', name: 'Uni Irchel', address: 'Winterthurerstrasse 190, 8057 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3974, longitude: 8.5497, totalSpots: 270, pricePerHour: 2.00, isEvCharging: false, maxHeight: 2.00, openingHours: '06:00–22:00' },
  { externalId: 'parkhaus-usz-nord', name: 'USZ Nord', address: 'Schmelzbergstrasse, 8091 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3771, longitude: 8.5526, totalSpots: 290, pricePerHour: 4.00, isEvCharging: true, maxHeight: 2.00, openingHours: '24/7' },
  { externalId: 'parkhaus-talstrasse', name: 'Talstrasse', address: 'Talstrasse 82, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3691, longitude: 8.5384, totalSpots: 230, pricePerHour: 4.50, isEvCharging: false, maxHeight: 2.00, openingHours: '24/7' },
]
```

Hinweis: Lat/Lng sind Approximationen aus öffentlichen Karten. Bei Mismatch mit PLS in der Production werden sie über opendata.swiss CSV nachgezogen (Follow-up).

- [ ] **Step 2: Seed-Skript ersetzen**

In `backend/src/db/seed.ts` (oder vorhandenem Seed-Punkt) den 30-Items-Seed durch ZURICH_SEED ersetzen:

```typescript
import { PrismaClient } from '@prisma/client'
import { ZURICH_SEED } from './zurich-parkings'

const prisma = new PrismaClient()

async function main() {
  await prisma.report.deleteMany()
  await prisma.favorite.deleteMany()
  await prisma.parking.deleteMany()

  for (const p of ZURICH_SEED) {
    await prisma.$executeRaw`
      INSERT INTO "Parking" ("externalId","name","address","city","parkingType","latitude","longitude","location","totalSpots","availableSpots","pricePerHour","isEvCharging","maxHeight","openingHours","status","createdAt")
      VALUES (${p.externalId}, ${p.name}, ${p.address}, ${p.city}, ${p.parkingType}, ${p.latitude}, ${p.longitude}, ST_SetSRID(ST_MakePoint(${p.longitude}, ${p.latitude}), 4326)::geography, ${p.totalSpots}, ${p.totalSpots}, ${p.pricePerHour}, ${p.isEvCharging}, ${p.maxHeight}, ${p.openingHours}, 'UNKNOWN', NOW())
    `
  }
  console.log(`Seeded ${ZURICH_SEED.length} Zurich parkings`)
}

main().finally(() => prisma.$disconnect())
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/zurich-parkings.ts backend/src/db/seed.ts
git commit -m "feat(backend): replace seed with 17 Zürich parking houses"
```

---

## Phase 2 — Backend: PLS-Sync

### Task 3: RSS-Parser

**Files:**
- Create: `backend/src/sync/pls-feed.parser.ts`
- Create: `backend/src/sync/pls-feed.parser.spec.ts`
- Modify: `backend/package.json` (+ `rss-parser` or `fast-xml-parser`)

- [ ] **Step 1: Dependency installieren**

```bash
cd backend
npm install fast-xml-parser
```

- [ ] **Step 2 (RED): Parser-Test schreiben**

```typescript
// backend/src/sync/pls-feed.parser.spec.ts
import { describe, expect, it } from 'vitest'
import { parsePlsFeed } from './pls-feed.parser'

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Parkleitsystem Zürich</title>
    <item>
      <title>Hohe Promenade / offen / 130</title>
      <link>https://www.pls-zh.ch/?p=hohe-promenade</link>
    </item>
    <item>
      <title>Opéra / besetzt / 12</title>
    </item>
    <item>
      <title>Urania / geschlossen / 0</title>
    </item>
  </channel>
</rss>`

describe('parsePlsFeed', () => {
  it('parses title into name, status, freeSpots', () => {
    const items = parsePlsFeed(SAMPLE_RSS)
    expect(items).toHaveLength(3)
    expect(items[0]).toEqual({ name: 'Hohe Promenade', status: 'OPEN', freeSpots: 130 })
    expect(items[1]).toEqual({ name: 'Opéra', status: 'FULL', freeSpots: 12 })
    expect(items[2]).toEqual({ name: 'Urania', status: 'CLOSED', freeSpots: 0 })
  })

  it('returns empty array on malformed input', () => {
    expect(parsePlsFeed('<not valid')).toEqual([])
  })

  it('skips items with unparseable titles', () => {
    const bad = `<rss><channel><item><title>weird format no slashes</title></item></channel></rss>`
    expect(parsePlsFeed(bad)).toEqual([])
  })
})
```

- [ ] **Step 3 (RED): Test laufen lassen**

```bash
cd backend
npx vitest run src/sync/pls-feed.parser.spec.ts
```

Erwartet: FAIL „Cannot find module './pls-feed.parser'".

- [ ] **Step 4 (GREEN): Parser implementieren**

```typescript
// backend/src/sync/pls-feed.parser.ts
import { XMLParser } from 'fast-xml-parser'

export type ParsedPlsItem = {
  name: string
  status: 'OPEN' | 'FULL' | 'CLOSED'
  freeSpots: number
}

const STATUS_MAP: Record<string, ParsedPlsItem['status']> = {
  offen: 'OPEN',
  open: 'OPEN',
  frei: 'OPEN',
  besetzt: 'FULL',
  voll: 'FULL',
  full: 'FULL',
  geschlossen: 'CLOSED',
  closed: 'CLOSED',
}

export function parsePlsFeed(xml: string): ParsedPlsItem[] {
  let parsed: unknown
  try {
    const parser = new XMLParser({ ignoreAttributes: true })
    parsed = parser.parse(xml)
  } catch {
    return []
  }
  // @ts-expect-error duck-typing
  const rawItems = parsed?.rss?.channel?.item
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []

  return items.flatMap((item: { title?: string }) => {
    const title = item.title ?? ''
    const parts = title.split('/').map((p) => p.trim())
    if (parts.length !== 3) return []

    const [name, statusRaw, freeRaw] = parts
    const status = STATUS_MAP[statusRaw.toLowerCase()]
    const freeSpots = Number.parseInt(freeRaw, 10)
    if (status === undefined || Number.isNaN(freeSpots)) return []

    return [{ name, status, freeSpots }]
  })
}
```

- [ ] **Step 5 (GREEN): Tests grün**

```bash
npx vitest run src/sync/pls-feed.parser.spec.ts
```

Erwartet: PASS (3 tests).

Wenn nach Phase 0 Spike-Output zeigt, dass das Title-Format anders ist (z. B. `Name; Status; N` oder JSON-Description): Parser-Logik in diesem Schritt anpassen, Tests entsprechend mit echten Sample-Strings updaten.

- [ ] **Step 6: Commit**

```bash
git add backend/src/sync/pls-feed.parser.ts backend/src/sync/pls-feed.parser.spec.ts backend/package.json backend/package-lock.json
git commit -m "feat(backend): add PLS RSS parser (TDD, 3 tests)"
```

---

### Task 4: PlsSyncService + Cron

**Files:**
- Create: `backend/src/sync/pls-sync.service.ts`
- Create: `backend/src/sync/pls-sync.service.spec.ts`
- Create: `backend/src/sync/sync.module.ts`
- Modify: `backend/src/app.module.ts` (wire SyncModule + ScheduleModule)
- Modify: `backend/package.json` (+ `@nestjs/schedule`)

- [ ] **Step 1: Dependencies**

```bash
cd backend
npm install @nestjs/schedule
```

- [ ] **Step 2 (RED): Sync-Service-Test**

```typescript
// backend/src/sync/pls-sync.service.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { PlsSyncService } from './pls-sync.service'

const prismaMock = {
  parking: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}

beforeEach(() => {
  prismaMock.parking.findUnique.mockReset()
  prismaMock.parking.update.mockReset()
  vi.stubGlobal('fetch', vi.fn())
})

describe('PlsSyncService.syncOnce', () => {
  it('updates parking by externalId match', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => `<rss><channel><item><title>Hohe Promenade / offen / 130</title></item></channel></rss>`,
    })
    prismaMock.parking.findUnique.mockResolvedValueOnce({ id: 1, externalId: 'hohe-promenade' })

    const svc = new PlsSyncService(prismaMock as any, 'http://test/feed', (name) => name.toLowerCase().replace(/\s/g, '-'))
    await svc.syncOnce()

    expect(prismaMock.parking.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        availableSpots: 130,
        status: 'OPEN',
        lastSyncedAt: expect.any(Date),
      }),
    })
  })

  it('skips items not in DB', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => `<rss><channel><item><title>Unknown PH / offen / 5</title></item></channel></rss>`,
    })
    prismaMock.parking.findUnique.mockResolvedValue(null)

    const svc = new PlsSyncService(prismaMock as any, 'http://test/feed', (name) => name.toLowerCase().replace(/\s/g, '-'))
    await svc.syncOnce()

    expect(prismaMock.parking.update).not.toHaveBeenCalled()
  })

  it('does not throw on fetch failure', async () => {
    ;(global.fetch as any).mockResolvedValue({ ok: false, status: 503, statusText: 'down' })

    const svc = new PlsSyncService(prismaMock as any, 'http://test/feed', (n) => n)
    await expect(svc.syncOnce()).resolves.toBeUndefined()
    expect(prismaMock.parking.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3 (RED): Run**

```bash
npx vitest run src/sync/pls-sync.service.spec.ts
```

Erwartet: FAIL.

- [ ] **Step 4 (GREEN): Service implementieren**

```typescript
// backend/src/sync/pls-sync.service.ts
import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { parsePlsFeed } from './pls-feed.parser'

export type NameToExternalId = (name: string) => string

@Injectable()
export class PlsSyncService implements OnModuleInit {
  private readonly logger = new Logger(PlsSyncService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly feedUrl = process.env.PLS_FEED_URL ?? 'https://www.pls-zh.ch/plsFeed/rss',
    @Optional() private readonly nameToExternalId: NameToExternalId = defaultNameToExternalId,
  ) {}

  async onModuleInit() {
    // Erstkonfiguration: einmal sofort syncen, ohne den Boot zu blockieren wenn der Feed down ist.
    void this.syncOnce()
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduledSync() {
    await this.syncOnce()
  }

  async syncOnce(): Promise<void> {
    let xml: string
    try {
      const res = await fetch(this.feedUrl)
      if (!res.ok) {
        this.logger.warn(`PLS fetch failed: ${res.status} ${res.statusText}`)
        return
      }
      xml = await res.text()
    } catch (err) {
      this.logger.warn(`PLS fetch threw: ${(err as Error).message}`)
      return
    }

    const items = parsePlsFeed(xml)
    const now = new Date()

    for (const item of items) {
      const externalId = this.nameToExternalId(item.name)
      const existing = await this.prisma.parking.findUnique({ where: { externalId } })
      if (existing === null) {
        this.logger.debug(`PLS item not in DB: ${item.name} (${externalId})`)
        continue
      }
      await this.prisma.parking.update({
        where: { id: existing.id },
        data: {
          availableSpots: item.freeSpots,
          status: item.status,
          lastSyncedAt: now,
        },
      })
    }

    this.logger.log(`PLS sync ok: ${items.length} items`)
  }
}

function defaultNameToExternalId(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
```

- [ ] **Step 5: Module + Wiring**

```typescript
// backend/src/sync/sync.module.ts
import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { PlsSyncService } from './pls-sync.service'

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [PlsSyncService],
  exports: [PlsSyncService],
})
export class SyncModule {}
```

In `backend/src/app.module.ts` `SyncModule` zu `imports` hinzufügen.

- [ ] **Step 6 (GREEN): Run**

```bash
npx vitest run src/sync/pls-sync.service.spec.ts
```

Erwartet: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/sync backend/src/app.module.ts backend/package.json backend/package-lock.json
git commit -m "feat(backend): add PlsSyncService with 60s cron (TDD, 3 tests)"
```

---

## Phase 3 — Backend: Auth (Magic Link)

### Task 5: AuthService — Token-Erzeugung + JWT

**Files:**
- Create: `backend/src/auth/auth.service.ts`
- Create: `backend/src/auth/auth.service.spec.ts`
- Modify: `backend/package.json` (+ `jsonwebtoken`, `@types/jsonwebtoken`)

- [ ] **Step 1: Dependency**

```bash
cd backend
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
```

- [ ] **Step 2 (RED): Test**

```typescript
// backend/src/auth/auth.service.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AuthService } from './auth.service'

const prismaMock = {
  authToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  user: { upsert: vi.fn(), findUnique: vi.fn() },
}
const mailerMock = { sendMagicLink: vi.fn() }

beforeEach(() => {
  Object.values(prismaMock).forEach((m) => Object.values(m).forEach((f) => f.mockReset()))
  mailerMock.sendMagicLink.mockReset()
})

describe('AuthService.requestLink', () => {
  it('creates a token and sends the email', async () => {
    prismaMock.authToken.create.mockResolvedValue({})
    const svc = new AuthService(prismaMock as any, mailerMock as any, { jwtSecret: 's', appUrl: 'http://app' })

    await svc.requestLink('a@b.com')

    expect(prismaMock.authToken.create).toHaveBeenCalled()
    expect(mailerMock.sendMagicLink).toHaveBeenCalledWith(
      'a@b.com',
      expect.stringMatching(/^http:\/\/app\/auth\/verify\?token=[a-f0-9]+$/),
    )
  })
})

describe('AuthService.verify', () => {
  it('returns a JWT for a valid token and marks it consumed', async () => {
    prismaMock.authToken.findUnique.mockResolvedValue({
      token: 't', email: 'a@b.com', expiresAt: new Date(Date.now() + 60_000), consumedAt: null,
    })
    prismaMock.authToken.update.mockResolvedValue({})
    prismaMock.user.upsert.mockResolvedValue({ id: 'u1', email: 'a@b.com' })

    const svc = new AuthService(prismaMock as any, mailerMock as any, { jwtSecret: 's', appUrl: 'http://app' })
    const result = await svc.verify('t')

    expect(result.jwt).toBeTypeOf('string')
    expect(result.user).toEqual({ id: 'u1', email: 'a@b.com' })
    expect(prismaMock.authToken.update).toHaveBeenCalledWith({
      where: { token: 't' }, data: { consumedAt: expect.any(Date) },
    })
  })

  it('throws on expired token', async () => {
    prismaMock.authToken.findUnique.mockResolvedValue({
      token: 't', email: 'a@b.com', expiresAt: new Date(Date.now() - 1000), consumedAt: null,
    })
    const svc = new AuthService(prismaMock as any, mailerMock as any, { jwtSecret: 's', appUrl: 'http://app' })

    await expect(svc.verify('t')).rejects.toThrow(/expired/i)
  })

  it('throws on already-consumed token', async () => {
    prismaMock.authToken.findUnique.mockResolvedValue({
      token: 't', email: 'a@b.com', expiresAt: new Date(Date.now() + 60_000), consumedAt: new Date(),
    })
    const svc = new AuthService(prismaMock as any, mailerMock as any, { jwtSecret: 's', appUrl: 'http://app' })

    await expect(svc.verify('t')).rejects.toThrow(/already/i)
  })
})
```

- [ ] **Step 3 (GREEN): Implementation**

```typescript
// backend/src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'
import * as crypto from 'crypto'
import * as jwt from 'jsonwebtoken'
import { PrismaService } from '../prisma/prisma.service'
import { MailerService } from './mailer.service'

const TOKEN_TTL_MS = 15 * 60 * 1000 // 15 min
const JWT_TTL_SEC = 7 * 24 * 3600   // 7 days

export type AuthConfig = { jwtSecret: string; appUrl: string }

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: AuthConfig = {
      jwtSecret: process.env.JWT_SECRET ?? '',
      appUrl: process.env.PUBLIC_APP_URL ?? 'http://localhost:3000',
    },
  ) {
    if (this.config.jwtSecret === '') {
      throw new Error('JWT_SECRET must be set')
    }
  }

  async requestLink(email: string): Promise<void> {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new BadRequestException('invalid email')
    }
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
    await this.prisma.authToken.create({ data: { token, email, expiresAt } })

    const url = `${this.config.appUrl}/auth/verify?token=${token}`
    await this.mailer.sendMagicLink(email, url)
  }

  async verify(token: string): Promise<{ jwt: string; user: { id: string; email: string } }> {
    const row = await this.prisma.authToken.findUnique({ where: { token } })
    if (row === null) throw new UnauthorizedException('invalid token')
    if (row.consumedAt !== null) throw new UnauthorizedException('token already used')
    if (row.expiresAt < new Date()) throw new UnauthorizedException('token expired')

    const user = await this.prisma.user.upsert({
      where: { email: row.email },
      create: { email: row.email },
      update: {},
    })
    await this.prisma.authToken.update({ where: { token }, data: { consumedAt: new Date() } })

    const jwtStr = jwt.sign({ sub: user.id, email: user.email }, this.config.jwtSecret, {
      expiresIn: JWT_TTL_SEC,
    })
    return { jwt: jwtStr, user: { id: user.id, email: user.email } }
  }

  verifyJwt(token: string): { sub: string; email: string } | null {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as jwt.JwtPayload
      if (typeof decoded.sub !== 'string' || typeof decoded.email !== 'string') return null
      return { sub: decoded.sub, email: decoded.email }
    } catch {
      return null
    }
  }
}
```

- [ ] **Step 4: Tests grün**

```bash
npx vitest run src/auth/auth.service.spec.ts
```

Erwartet: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/auth.service.ts backend/src/auth/auth.service.spec.ts backend/package.json backend/package-lock.json
git commit -m "feat(backend): add AuthService (magic-link token + JWT, TDD, 4 tests)"
```

---

### Task 6: MailerService (Resend)

**Files:**
- Create: `backend/src/auth/mailer.service.ts`
- Create: `backend/src/auth/mailer.service.spec.ts`
- Modify: `backend/package.json` (+ `resend`)

- [ ] **Step 1: Dependency**

```bash
cd backend
npm install resend
```

- [ ] **Step 2 (RED): Test**

```typescript
// backend/src/auth/mailer.service.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MailerService } from './mailer.service'

const sendMock = vi.fn()
beforeEach(() => sendMock.mockReset())

describe('MailerService.sendMagicLink', () => {
  it('calls Resend with subject + body containing the URL', async () => {
    const mailer = new MailerService({ apiKey: 'k', from: 'a@b' } as any, { send: sendMock } as any)
    await mailer.sendMagicLink('user@x.com', 'http://app/verify?token=abc')

    expect(sendMock).toHaveBeenCalledOnce()
    const args = sendMock.mock.calls[0][0]
    expect(args.to).toBe('user@x.com')
    expect(args.from).toBe('a@b')
    expect(args.subject).toMatch(/parkfind/i)
    expect(args.html ?? args.text).toContain('http://app/verify?token=abc')
  })

  it('throws on missing config', () => {
    expect(() => new MailerService({ apiKey: '', from: 'a@b' } as any)).toThrow(/api key/i)
  })
})
```

- [ ] **Step 3 (GREEN): Implementation**

```typescript
// backend/src/auth/mailer.service.ts
import { Injectable } from '@nestjs/common'
import { Resend } from 'resend'

export type MailerConfig = { apiKey: string; from: string }

type SendableClient = {
  send: (args: { from: string; to: string; subject: string; html: string }) => Promise<unknown>
}

@Injectable()
export class MailerService {
  private readonly client: SendableClient
  private readonly from: string

  constructor(
    config: MailerConfig = {
      apiKey: process.env.RESEND_API_KEY ?? '',
      from: process.env.EMAIL_FROM ?? 'noreply@example.com',
    },
    client?: SendableClient,
  ) {
    if (config.apiKey === '') throw new Error('RESEND_API_KEY (api key) must be set')
    this.from = config.from
    this.client = client ?? {
      send: (args) => new Resend(config.apiKey).emails.send(args),
    }
  }

  async sendMagicLink(email: string, url: string): Promise<void> {
    await this.client.send({
      from: this.from,
      to: email,
      subject: 'Dein ParkFind Login-Link',
      html: `
        <p>Hi,</p>
        <p>Klicke auf den Link, um dich bei ParkFind anzumelden:</p>
        <p><a href="${url}">${url}</a></p>
        <p>Der Link ist 15 Minuten gültig.</p>
      `,
    })
  }
}
```

- [ ] **Step 4: Tests grün**

```bash
npx vitest run src/auth/mailer.service.spec.ts
```

Erwartet: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/mailer.service.ts backend/src/auth/mailer.service.spec.ts backend/package.json backend/package-lock.json
git commit -m "feat(backend): add MailerService wrapping Resend (TDD, 2 tests)"
```

---

### Task 7: AuthController + AuthGuard + Cookies

**Files:**
- Create: `backend/src/auth/auth.controller.ts`
- Create: `backend/src/auth/auth.guard.ts`
- Create: `backend/src/auth/auth.module.ts`
- Modify: `backend/src/main.ts` (cookie-parser middleware)
- Modify: `backend/package.json` (+ `cookie-parser`, `@types/cookie-parser`)

- [ ] **Step 1: Dependencies**

```bash
cd backend
npm install cookie-parser
npm install -D @types/cookie-parser
```

- [ ] **Step 2: AuthGuard implementieren**

```typescript
// backend/src/auth/auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Request } from 'express'
import { AuthService } from './auth.service'

declare module 'express-serve-static-core' {
  interface Request { user?: { id: string; email: string } }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>()
    const cookies = (req as any).cookies as Record<string, string> | undefined
    const jwtCookie = cookies?.['pf_token']
    if (!jwtCookie) throw new UnauthorizedException()

    const decoded = this.auth.verifyJwt(jwtCookie)
    if (decoded === null) throw new UnauthorizedException()

    req.user = { id: decoded.sub, email: decoded.email }
    return true
  }
}
```

- [ ] **Step 3: AuthController**

```typescript
// backend/src/auth/auth.controller.ts
import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { AuthGuard } from './auth.guard'

const COOKIE_NAME = 'pf_token'

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('request-link')
  async requestLink(@Body() body: { email?: string }) {
    if (typeof body.email !== 'string') return { sent: false }
    await this.auth.requestLink(body.email)
    return { sent: true }
  }

  @Get('verify')
  async verify(@Query('token') token: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.verify(token)
    res.cookie(COOKIE_NAME, result.jwt, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 3600 * 1000,
      path: '/',
    })
    return { user: result.user }
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/' })
    return { ok: true }
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: Request) {
    return req.user!
  }
}
```

- [ ] **Step 4: AuthModule**

```typescript
// backend/src/auth/auth.module.ts
import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { MailerService } from './mailer.service'
import { AuthGuard } from './auth.guard'

@Module({
  controllers: [AuthController],
  providers: [AuthService, MailerService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
```

In `app.module.ts` zu `imports` hinzufügen.

- [ ] **Step 5: cookie-parser in main.ts**

```typescript
// backend/src/main.ts (extend bootstrap)
import * as cookieParser from 'cookie-parser'
// ...
app.use(cookieParser())
```

- [ ] **Step 6: Integration-Test (e2e)**

```typescript
// backend/test/auth.e2e-spec.ts (oder bestehender e2e-Ort)
import { Test } from '@nestjs/testing'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import * as cookieParser from 'cookie-parser'

describe('Auth e2e', () => {
  let app: any

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret'
    process.env.RESEND_API_KEY = 'test-key'
    process.env.EMAIL_FROM = 'test@example.com'
    process.env.PUBLIC_APP_URL = 'http://localhost:3000'
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = mod.createNestApplication()
    app.use(cookieParser())
    await app.init()
  })

  afterAll(() => app.close())

  it('POST /api/auth/request-link returns {sent: true} for valid email', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/request-link')
      .send({ email: 'e2e@example.com' })
    expect(res.status).toBe(201)
    expect(res.body.sent).toBe(true)
  })

  it('GET /api/auth/me without cookie returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})
```

Hinweis: für e2e muss DB erreichbar sein. Bei lokalem Lauf ohne Docker: Test überspringen oder DB-Mock via Prisma-Mock-Adapter einrichten. Wenn Compose läuft: `docker compose up -d db-test`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth backend/src/main.ts backend/test/auth.e2e-spec.ts backend/package.json backend/package-lock.json
git commit -m "feat(backend): add auth controller (request-link, verify, me, logout) + AuthGuard"
```

---

## Phase 4 — Backend: Favorites + Reports

### Task 8: Favorites Module

**Files:**
- Create: `backend/src/favorites/favorites.controller.ts`
- Create: `backend/src/favorites/favorites.service.ts`
- Create: `backend/src/favorites/favorites.service.spec.ts`
- Create: `backend/src/favorites/favorites.module.ts`

- [ ] **Step 1 (RED): Service-Test**

```typescript
// backend/src/favorites/favorites.service.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { FavoritesService } from './favorites.service'

const prismaMock = {
  favorite: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
}
beforeEach(() => Object.values(prismaMock.favorite).forEach((f) => f.mockReset()))

describe('FavoritesService', () => {
  it('add upserts favorite', async () => {
    prismaMock.favorite.upsert.mockResolvedValue({ id: 1 })
    const svc = new FavoritesService(prismaMock as any)
    await svc.add('u1', 42)
    expect(prismaMock.favorite.upsert).toHaveBeenCalledWith({
      where: { userId_parkingId: { userId: 'u1', parkingId: 42 } },
      create: { userId: 'u1', parkingId: 42 },
      update: {},
    })
  })

  it('remove deletes by composite key', async () => {
    prismaMock.favorite.deleteMany.mockResolvedValue({ count: 1 })
    const svc = new FavoritesService(prismaMock as any)
    await svc.remove('u1', 42)
    expect(prismaMock.favorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', parkingId: 42 },
    })
  })

  it('list returns parkings of user', async () => {
    prismaMock.favorite.findMany.mockResolvedValue([
      { parking: { id: 1, name: 'A' } },
      { parking: { id: 2, name: 'B' } },
    ])
    const svc = new FavoritesService(prismaMock as any)
    const r = await svc.list('u1')
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ id: 1, name: 'A' })
  })
})
```

- [ ] **Step 2 (GREEN): Service**

```typescript
// backend/src/favorites/favorites.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async add(userId: string, parkingId: number): Promise<void> {
    await this.prisma.favorite.upsert({
      where: { userId_parkingId: { userId, parkingId } },
      create: { userId, parkingId },
      update: {},
    })
  }

  async remove(userId: string, parkingId: number): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, parkingId } })
  }

  async list(userId: string) {
    const rows = await this.prisma.favorite.findMany({
      where: { userId },
      include: { parking: true },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => r.parking)
  }
}
```

- [ ] **Step 3: Controller**

```typescript
// backend/src/favorites/favorites.controller.ts
import { Controller, Delete, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common'
import { Request } from 'express'
import { AuthGuard } from '../auth/auth.guard'
import { FavoritesService } from './favorites.service'

@Controller('api/favorites')
@UseGuards(AuthGuard)
export class FavoritesController {
  constructor(private readonly svc: FavoritesService) {}

  @Get()
  list(@Req() req: Request) {
    return this.svc.list(req.user!.id)
  }

  @Post(':parkingId')
  async add(@Req() req: Request, @Param('parkingId', ParseIntPipe) parkingId: number) {
    await this.svc.add(req.user!.id, parkingId)
    return { ok: true }
  }

  @Delete(':parkingId')
  async remove(@Req() req: Request, @Param('parkingId', ParseIntPipe) parkingId: number) {
    await this.svc.remove(req.user!.id, parkingId)
    return { ok: true }
  }
}
```

- [ ] **Step 4: Module + wiring**

```typescript
// backend/src/favorites/favorites.module.ts
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { FavoritesController } from './favorites.controller'
import { FavoritesService } from './favorites.service'

@Module({
  imports: [AuthModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
```

In `app.module.ts` registrieren.

- [ ] **Step 5: Tests grün + Commit**

```bash
npx vitest run src/favorites/favorites.service.spec.ts
git add backend/src/favorites backend/src/app.module.ts
git commit -m "feat(backend): add Favorites module (TDD, 3 tests)"
```

---

### Task 9: Reports Module mit Rate-Limit

**Files:**
- Create: `backend/src/reports/reports.controller.ts`
- Create: `backend/src/reports/reports.service.ts`
- Create: `backend/src/reports/reports.service.spec.ts`
- Create: `backend/src/reports/reports.module.ts`

- [ ] **Step 1 (RED): Service-Test mit Rate-Limit**

```typescript
// backend/src/reports/reports.service.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ReportsService } from './reports.service'

const prismaMock = {
  report: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
}
beforeEach(() => Object.values(prismaMock.report).forEach((f) => f.mockReset()))

describe('ReportsService.create rate-limit', () => {
  it('creates when below limits', async () => {
    prismaMock.report.count.mockResolvedValue(0)
    prismaMock.report.findFirst.mockResolvedValue(null)
    prismaMock.report.create.mockResolvedValue({ id: 1 })

    const svc = new ReportsService(prismaMock as any)
    const r = await svc.create('u1', 42, 50)

    expect(r).toMatchObject({ id: 1 })
  })

  it('throws when user has >= 5 reports in last 10 min', async () => {
    prismaMock.report.count.mockResolvedValue(5)

    const svc = new ReportsService(prismaMock as any)
    await expect(svc.create('u1', 42, 50)).rejects.toThrow(/too many requests/i)
  })

  it('throws when same parking reported in last 30 min', async () => {
    prismaMock.report.count.mockResolvedValue(0)
    prismaMock.report.findFirst.mockResolvedValue({ id: 99, createdAt: new Date() })

    const svc = new ReportsService(prismaMock as any)
    await expect(svc.create('u1', 42, 50)).rejects.toThrow(/cooldown/i)
  })
})
```

- [ ] **Step 2 (GREEN): Service**

```typescript
// backend/src/reports/reports.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const USER_WINDOW_MS = 10 * 60 * 1000   // 10 min
const USER_LIMIT = 5
const PARKING_COOLDOWN_MS = 30 * 60 * 1000 // 30 min

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, parkingId: number, reportedSpots: number) {
    const since = new Date(Date.now() - USER_WINDOW_MS)
    const userCount = await this.prisma.report.count({
      where: { userId, createdAt: { gte: since } },
    })
    if (userCount >= USER_LIMIT) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS)
    }
    const cooldownSince = new Date(Date.now() - PARKING_COOLDOWN_MS)
    const recent = await this.prisma.report.findFirst({
      where: { userId, parkingId, createdAt: { gte: cooldownSince } },
    })
    if (recent !== null) {
      throw new HttpException('Cooldown active for this parking', HttpStatus.TOO_MANY_REQUESTS)
    }

    return this.prisma.report.create({
      data: { userId, parkingId, reportedSpots },
    })
  }
}
```

- [ ] **Step 3: Controller**

```typescript
// backend/src/reports/reports.controller.ts
import { Body, Controller, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common'
import { Request } from 'express'
import { AuthGuard } from '../auth/auth.guard'
import { ReportsService } from './reports.service'

@Controller('api/parkings/:id/report')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Post()
  async report(
    @Req() req: Request,
    @Param('id', ParseIntPipe) parkingId: number,
    @Body() body: { reportedSpots: number },
  ) {
    const r = await this.svc.create(req.user!.id, parkingId, body.reportedSpots)
    return { id: r.id }
  }
}
```

- [ ] **Step 4: Module + wiring**

```typescript
// backend/src/reports/reports.module.ts
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ReportsController } from './reports.controller'
import { ReportsService } from './reports.service'

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
```

In `app.module.ts` registrieren.

- [ ] **Step 5: Tests + Commit**

```bash
npx vitest run src/reports/reports.service.spec.ts
git add backend/src/reports backend/src/app.module.ts
git commit -m "feat(backend): add Reports module with rate-limit (TDD, 3 tests)"
```

---

### Task 10: ParkingResponseDto erweitern (status, lastSyncedAt)

**Files:**
- Modify: `backend/src/parking/parking-response.dto.ts` (oder bestehender Pfad)
- Modify: `backend/src/parking/parking.service.ts` (Status mappen)

- [ ] **Step 1: DTO erweitern**

In `ParkingResponseDto` (oder vergleichbarer Datei) ergänzen:

```typescript
status: 'OPEN' | 'CLOSED' | 'FULL' | 'UNKNOWN'
lastSyncedAt: string | null
```

und im Mapper `toResponse(parking)` die neuen Felder durchreichen.

- [ ] **Step 2: Test anpassen**

Bestehende Service-Tests, die ein Parking zurückgeben, mit den neuen Feldern erweitern (UNKNOWN default).

- [ ] **Step 3: Run + Commit**

```bash
cd backend && npx vitest run
git add backend/src/parking
git commit -m "feat(backend): include status + lastSyncedAt in ParkingResponseDto"
```

---

## Phase 5 — Frontend: Tailwind-Tokens + Fonts

### Task 11: Tailwind-Theme + Fonts

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/app/[locale]/layout.tsx` (Font-Links)

- [ ] **Step 1: Tailwind-Config**

```typescript
// frontend/tailwind.config.ts (extend)
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg:      '#F5F2EE',
          bg2:     '#EDE9E3',
          surface: '#FDFCFB',
          text:    '#1A1714',
          text2:   '#5C5650',
          text3:   '#9C958D',
          border:  'rgba(26,23,20,0.10)',
          border2: 'rgba(26,23,20,0.06)',
          accent:  '#3B5BDB',
        },
        availability: {
          green:    '#2D6A4F',
          'green-bg': '#D8EDDF',
          yellow:   '#B5830A',
          'yellow-bg': '#FDF3DC',
          red:      '#C0392B',
          'red-bg': '#FAE0DC',
        },
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'serif'],
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      borderRadius: { md: '10px', lg: '16px' },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Font-Links in Layout**

In `frontend/app/[locale]/layout.tsx` im `<head>` (durch Next-Pattern: `next/font/google` oder direkt `<link>`):

```typescript
// Easiest path: inline link in <head>
return (
  <html lang={locale}>
    <head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@400;500&family=Geist:wght@300;400;500;600&display=swap"
        rel="stylesheet"
      />
    </head>
    <body className="h-screen overflow-hidden font-sans bg-brand-bg text-brand-text">
      {/* ... */}
    </body>
  </html>
)
```

- [ ] **Step 3: globals.css aktualisieren**

`frontend/app/globals.css` Body-Default auf `bg-brand-bg` + `font-sans` setzen (Tailwind base styles weiterhin via @tailwind layers).

- [ ] **Step 4: Bestehende `bg-availability-green` etc. weiter laufen lassen**

Test: `frontend/__tests__/lib/colors.spec.ts` darf nicht brechen. `availabilityColorClass` returnt z. B. `bg-availability-green` — das mappt nun auf den neuen Hex. Run:

```bash
cd frontend && npx vitest run
```

Erwartet: alle 38 Tests grün bleiben.

- [ ] **Step 5: Commit**

```bash
git add frontend/tailwind.config.ts frontend/app/[locale]/layout.tsx frontend/app/globals.css
git commit -m "feat(frontend): extend Tailwind theme with brand palette + custom fonts"
```

---

## Phase 6 — Frontend: TabBar + Two-Pane Layout

### Task 12: TabBar-Komponente

**Files:**
- Create: `frontend/components/Layout/TabBar.tsx`
- Create: `frontend/__tests__/components/TabBar.spec.tsx`
- Modify: `frontend/i18n/messages/de.json`, `en.json` (Tab-Labels)

- [ ] **Step 1: i18n erweitern**

In `de.json`:
```json
"tabs": { "map": "Karte", "list": "Liste", "account": "Konto" }
```

In `en.json`:
```json
"tabs": { "map": "Map", "list": "List", "account": "Account" }
```

- [ ] **Step 2 (RED): Test**

```typescript
// frontend/__tests__/components/TabBar.spec.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import { TabBar } from '@/components/Layout/TabBar'
import deMessages from '@/i18n/messages/de.json'

function renderBar(active: 'map' | 'list' | 'account' = 'map', onChange = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <TabBar active={active} onChange={onChange} />
    </NextIntlClientProvider>,
  )
}

describe('TabBar', () => {
  it('renders logo and three tabs', () => {
    renderBar()
    expect(screen.getByText(/parkfind/i)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /karte/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /liste/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /konto/i })).toBeInTheDocument()
  })

  it('marks active tab', () => {
    renderBar('list')
    expect(screen.getByRole('tab', { name: /liste/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /karte/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onChange when tab clicked', async () => {
    const onChange = vi.fn()
    renderBar('map', onChange)
    await userEvent.click(screen.getByRole('tab', { name: /konto/i }))
    expect(onChange).toHaveBeenCalledWith('account')
  })
})
```

- [ ] **Step 3 (GREEN): Komponente**

```typescript
// frontend/components/Layout/TabBar.tsx
'use client'

import { useTranslations } from 'next-intl'
import { LocaleSwitcher } from './LocaleSwitcher'

type TabKey = 'map' | 'list' | 'account'

type Props = {
  active: TabKey
  onChange: (next: TabKey) => void
}

const TABS: TabKey[] = ['map', 'list', 'account']

export function TabBar({ active, onChange }: Props) {
  const t = useTranslations('tabs')

  return (
    <header
      role="tablist"
      className="sticky top-0 z-[1000] flex items-center gap-0 border-b border-brand-border bg-brand-bg px-5 pt-3"
    >
      <span className="font-serif text-xl tracking-tight text-brand-text mr-7 pb-3 select-none">
        ParkFind <em className="text-brand-text3 not-italic font-serif italic">Zürich</em>
      </span>
      {TABS.map((tab) => {
        const isActive = tab === active
        return (
          <button
            key={tab}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab)}
            className={[
              'font-sans text-sm px-4 pb-3 transition-colors border-b-2 -mb-px',
              isActive
                ? 'text-brand-text font-medium border-brand-text'
                : 'text-brand-text3 border-transparent hover:text-brand-text',
            ].join(' ')}
          >
            {t(tab)}
          </button>
        )
      })}
      <div className="ml-auto pb-2">
        <LocaleSwitcher />
      </div>
    </header>
  )
}
```

- [ ] **Step 4 (GREEN): Run + Commit**

```bash
cd frontend && npx vitest run __tests__/components/TabBar.spec.tsx
git add frontend/components/Layout/TabBar.tsx frontend/__tests__/components/TabBar.spec.tsx frontend/i18n/messages
git commit -m "feat(frontend): add TabBar component (TDD, 3 tests)"
```

---

### Task 13: MapSidebar (Search + Filter + List)

**Files:**
- Create: `frontend/components/Map/MapSidebar.tsx`
- Create: `frontend/components/Map/ParkingListItem.tsx`
- Create: `frontend/__tests__/components/MapSidebar.spec.tsx`
- Modify: `frontend/i18n/messages/de.json`, `en.json` (`map.search_placeholder`, `map.no_results`)

- [ ] **Step 1: i18n**

In `de.json` → `map`:
```json
"map": { "search_placeholder": "Suche / Standort", "no_results": "Keine Parkhäuser gefunden", "spots_free": "frei" }
```

Same Schlüssel in `en.json`:
```json
"map": { "search_placeholder": "Search / location", "no_results": "No parkings found", "spots_free": "free" }
```

- [ ] **Step 2: ParkingListItem-Komponente**

```typescript
// frontend/components/Map/ParkingListItem.tsx
'use client'

import { useTranslations } from 'next-intl'
import type { Parking } from '@/lib/types'
import { availabilityColor } from '@/lib/colors'

type Props = {
  parking: Parking
  selected: boolean
  onSelect: (id: number) => void
}

const COLOR_BG: Record<'green' | 'yellow' | 'red', string> = {
  green: 'bg-availability-green-bg text-availability-green',
  yellow: 'bg-availability-yellow-bg text-availability-yellow',
  red: 'bg-availability-red-bg text-availability-red',
}

export function ParkingListItem({ parking, selected, onSelect }: Props) {
  const t = useTranslations('map')
  const color = availabilityColor(parking.availableSpots, parking.totalSpots)
  return (
    <button
      type="button"
      onClick={() => onSelect(parking.id)}
      className={[
        'w-full text-left px-3 py-3 border-b border-brand-border2 transition-colors',
        selected ? 'bg-brand-bg border-l-[3px] border-l-brand-text pl-[11px]' : 'hover:bg-brand-bg',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-sans text-sm text-brand-text font-medium truncate">{parking.name}</span>
        <span className={`font-mono text-xs px-2 py-0.5 rounded-md ${COLOR_BG[color]}`}>
          {parking.availableSpots} {t('spots_free')}
        </span>
      </div>
      <div className="mt-1 font-mono text-xs text-brand-text3">
        {parking.totalSpots} total · CHF {parking.pricePerHour.toFixed(2)}/h
      </div>
    </button>
  )
}
```

- [ ] **Step 3: MapSidebar-Komponente**

```typescript
// frontend/components/Map/MapSidebar.tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { FilterBar } from '../Filters/FilterBar'
import type { Filters } from '@/lib/url-state'
import type { Parking } from '@/lib/types'
import { ParkingListItem } from './ParkingListItem'

type Props = {
  parkings: Parking[]
  filters: Filters
  onFiltersChange: (next: Filters) => void
  selectedId: number | null
  onSelect: (id: number) => void
}

export function MapSidebar({ parkings, filters, onFiltersChange, selectedId, onSelect }: Props) {
  const t = useTranslations('map')
  const [query, setQuery] = useState('')

  const filtered = parkings.filter((p) =>
    query.trim() === '' ? true : p.name.toLowerCase().includes(query.toLowerCase()) || p.address.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <aside className="hidden sm:flex flex-col w-[360px] border-r border-brand-border bg-brand-surface">
      <div className="p-3 border-b border-brand-border">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search_placeholder')}
          className="w-full bg-brand-bg2 border border-brand-border rounded-md px-3 py-2 text-sm font-sans focus:outline-none focus:border-brand-text"
        />
      </div>
      <div className="p-3 border-b border-brand-border">
        <FilterBar filters={filters} onChange={onFiltersChange} />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-brand-text3">{t('no_results')}</p>
        ) : (
          filtered.map((p) => (
            <ParkingListItem
              key={p.id}
              parking={p}
              selected={p.id === selectedId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </aside>
  )
}
```

- [ ] **Step 4 (TDD): Tests**

```typescript
// frontend/__tests__/components/MapSidebar.spec.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import { MapSidebar } from '@/components/Map/MapSidebar'
import deMessages from '@/i18n/messages/de.json'
import type { Parking } from '@/lib/types'

const PARKINGS: Parking[] = [
  { id: 1, name: 'Hohe Promenade', address: 'Promenadengasse', city: 'Zürich', parkingType: 'garage', latitude: 47.37, longitude: 8.55, totalSpots: 220, availableSpots: 130, pricePerHour: 4.5, isEvCharging: false, maxHeight: null, openingHours: null },
  { id: 2, name: 'Urania', address: 'Uraniastrasse', city: 'Zürich', parkingType: 'garage', latitude: 47.37, longitude: 8.54, totalSpots: 320, availableSpots: 2, pricePerHour: 4.0, isEvCharging: false, maxHeight: null, openingHours: null },
]

function renderSidebar(overrides: Partial<React.ComponentProps<typeof MapSidebar>> = {}) {
  const props: React.ComponentProps<typeof MapSidebar> = {
    parkings: PARKINGS, filters: {}, onFiltersChange: vi.fn(),
    selectedId: null, onSelect: vi.fn(), ...overrides,
  }
  return render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <MapSidebar {...props} />
    </NextIntlClientProvider>,
  )
}

describe('MapSidebar', () => {
  it('renders all parkings in list', () => {
    renderSidebar()
    expect(screen.getByText('Hohe Promenade')).toBeInTheDocument()
    expect(screen.getByText('Urania')).toBeInTheDocument()
  })

  it('filters by search query (name)', async () => {
    renderSidebar()
    await userEvent.type(screen.getByPlaceholderText(/suche/i), 'urania')
    expect(screen.queryByText('Hohe Promenade')).not.toBeInTheDocument()
    expect(screen.getByText('Urania')).toBeInTheDocument()
  })

  it('calls onSelect when item clicked', async () => {
    const onSelect = vi.fn()
    renderSidebar({ onSelect })
    await userEvent.click(screen.getByText('Urania'))
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('shows no_results when query matches nothing', async () => {
    renderSidebar()
    await userEvent.type(screen.getByPlaceholderText(/suche/i), 'xyznothing')
    expect(screen.getByText(/keine parkhäuser/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run + Commit**

```bash
npx vitest run __tests__/components/MapSidebar.spec.tsx
git add frontend/components/Map/MapSidebar.tsx frontend/components/Map/ParkingListItem.tsx frontend/__tests__/components/MapSidebar.spec.tsx frontend/i18n/messages
git commit -m "feat(frontend): add MapSidebar + ParkingListItem (TDD, 4 tests)"
```

---

### Task 14: PageShell-Refactor (Tab-State + Two-Pane)

**Files:**
- Modify: `frontend/components/PageShell.tsx`
- Modify: `frontend/lib/types.ts` (ZURICH_HB confirmed; bestehend OK)

- [ ] **Step 1: PageShell rewrite**

```typescript
// frontend/components/PageShell.tsx
'use client'

import { useState } from 'react'
import { TabBar } from './Layout/TabBar'
import { LocationButton } from './Location/LocationButton'
import { MapContainer } from './Map/MapContainer'
import { MapSidebar } from './Map/MapSidebar'
import { ParkingDetail } from './Detail/ParkingDetail'
import { useFilterState } from '@/lib/use-filter-state'
import { useNearbyParkings, useParkingById } from '@/lib/queries'
import { ZURICH_HB, type Coords } from '@/lib/types'

type TabKey = 'map' | 'list' | 'account'

export function PageShell() {
  const [tab, setTab] = useState<TabKey>('map')
  const [center, setCenter] = useState<Coords>(ZURICH_HB)
  const [userCoords, setUserCoords] = useState<Coords | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filters, setFilters] = useFilterState()

  const nearbyQuery = useNearbyParkings({
    lat: center.lat,
    lng: center.lng,
    radius: 2000,
    parkingType: filters.parkingType,
    isEvCharging: filters.isEvCharging,
    isFree: filters.isFree,
  })

  const detailQuery = useParkingById(selectedId)
  const parkings = nearbyQuery.data ?? []

  return (
    <div className="flex flex-col h-screen w-full bg-brand-bg">
      <TabBar active={tab} onChange={setTab} />
      {tab === 'map' && (
        <div className="flex-1 flex overflow-hidden">
          <MapSidebar
            parkings={parkings}
            filters={filters}
            onFiltersChange={setFilters}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <div className="relative flex-1">
            <MapContainer
              center={center}
              parkings={parkings}
              userCoords={userCoords}
              onMoveEnd={setCenter}
              onMarkerClick={setSelectedId}
            />
            <div className="absolute top-3 right-3 z-[999]">
              <LocationButton
                onLocate={(c) => { setUserCoords(c); setCenter(c) }}
                onError={() => setUserCoords(null)}
              />
            </div>
            <ParkingDetail
              parking={detailQuery.data ?? null}
              onClose={() => setSelectedId(null)}
            />
          </div>
        </div>
      )}
      {tab === 'list' && (
        <div className="flex-1 overflow-y-auto bg-brand-surface">
          <MapSidebar
            parkings={parkings}
            filters={filters}
            onFiltersChange={setFilters}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      )}
      {tab === 'account' && (
        <div className="flex-1 overflow-y-auto bg-brand-surface flex items-center justify-center text-brand-text3">
          {/* Account-Inhalt kommt in Task 17 */}
          (Konto-Bereich)
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run alle Tests**

```bash
cd frontend && npx vitest run
```

Erwartet: alle bestehenden Tests + neue grün.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/PageShell.tsx
git commit -m "feat(frontend): refactor PageShell to TabBar + Two-Pane Map view"
```

---

## Phase 7 — Frontend: Auth + Account

### Task 15: lib/api.ts erweitern (auth/favorites/reports)

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/__tests__/lib/api.spec.ts`
- Modify: `frontend/lib/types.ts` (+ User, Favorite, AuthState)

- [ ] **Step 1: Types erweitern**

```typescript
// frontend/lib/types.ts (append)
export type User = { id: string; email: string }
export type AuthState = { user: User | null }
```

- [ ] **Step 2 (TDD): Tests erweitern**

In `frontend/__tests__/lib/api.spec.ts` neuen `describe`-Block hinzufügen:

```typescript
describe('auth API', () => {
  it('postRequestLink POSTs email', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sent: true }) })
    const { postRequestLink } = await import('@/lib/api')
    const r = await postRequestLink('a@b.com')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/request-link'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'a@b.com' }) }),
    )
    expect(r).toEqual({ sent: true })
  })

  it('fetchMe returns null on 401', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 })
    const { fetchMe } = await import('@/lib/api')
    expect(await fetchMe()).toBeNull()
  })

  it('postLogout calls /api/auth/logout', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    const { postLogout } = await import('@/lib/api')
    await postLogout()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/logout'),
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('favorites API', () => {
  it('fetchFavorites returns list', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [{ id: 1, name: 'X' }] })
    const { fetchFavorites } = await import('@/lib/api')
    const r = await fetchFavorites()
    expect(r).toHaveLength(1)
  })

  it('postFavorite uses POST', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    const { postFavorite } = await import('@/lib/api')
    await postFavorite(42)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/favorites/42'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('deleteFavorite uses DELETE', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    const { deleteFavorite } = await import('@/lib/api')
    await deleteFavorite(42)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/favorites/42'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})

describe('reports API', () => {
  it('postReport sends body', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) })
    const { postReport } = await import('@/lib/api')
    await postReport(42, 50)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/parkings/42/report'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reportedSpots: 50 }),
      }),
    )
  })
})
```

- [ ] **Step 3 (GREEN): API erweitern**

```typescript
// frontend/lib/api.ts (extend)
import type { FindNearbyParams, Parking, User } from './types'

// ... existing API_BASE_URL, buildNearbyUrl, fetchNearbyParkings, fetchParkingById ...

const baseFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  return fetch(`${API_BASE_URL()}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

export async function postRequestLink(email: string): Promise<{ sent: boolean }> {
  const res = await baseFetch('/api/auth/request-link', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
  if (!res.ok) throw new Error(`request-link failed: ${res.status}`)
  return (await res.json()) as { sent: boolean }
}

export async function fetchMe(): Promise<User | null> {
  const res = await baseFetch('/api/auth/me')
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`me failed: ${res.status}`)
  return (await res.json()) as User
}

export async function postLogout(): Promise<void> {
  const res = await baseFetch('/api/auth/logout', { method: 'POST' })
  if (!res.ok) throw new Error(`logout failed: ${res.status}`)
}

export async function fetchFavorites(): Promise<Parking[]> {
  const res = await baseFetch('/api/favorites')
  if (!res.ok) throw new Error(`favorites failed: ${res.status}`)
  return (await res.json()) as Parking[]
}

export async function postFavorite(parkingId: number): Promise<void> {
  const res = await baseFetch(`/api/favorites/${parkingId}`, { method: 'POST' })
  if (!res.ok) throw new Error(`fav-add failed: ${res.status}`)
}

export async function deleteFavorite(parkingId: number): Promise<void> {
  const res = await baseFetch(`/api/favorites/${parkingId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`fav-del failed: ${res.status}`)
}

export async function postReport(parkingId: number, reportedSpots: number): Promise<{ id: number }> {
  const res = await baseFetch(`/api/parkings/${parkingId}/report`, {
    method: 'POST',
    body: JSON.stringify({ reportedSpots }),
  })
  if (!res.ok) {
    const err = new Error(`report failed: ${res.status}`)
    ;(err as any).status = res.status
    throw err
  }
  return (await res.json()) as { id: number }
}
```

- [ ] **Step 4 (GREEN): Tests laufen**

```bash
cd frontend && npx vitest run __tests__/lib/api.spec.ts
```

Erwartet: alle (alt + neu) grün.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api.ts frontend/lib/types.ts frontend/__tests__/lib/api.spec.ts
git commit -m "feat(frontend): add auth/favorites/reports API client (TDD)"
```

---

### Task 16: LoginForm

**Files:**
- Create: `frontend/components/Account/LoginForm.tsx`
- Create: `frontend/__tests__/components/LoginForm.spec.tsx`
- Modify: `frontend/i18n/messages/de.json` + `en.json` (`account.login_*`)

- [ ] **Step 1: i18n**

In `de.json`:
```json
"account": {
  "login_title": "Anmelden",
  "login_hint": "E-Mail-Adresse eingeben — wir senden dir einen Login-Link.",
  "email_placeholder": "deine@email.ch",
  "send_link": "Login-Link senden",
  "sent_toast": "Schau in dein Postfach.",
  "favorites_title": "Favoriten",
  "no_favorites": "Noch keine Favoriten",
  "logout": "Abmelden"
}
```

Parität in `en.json`.

- [ ] **Step 2 (RED): Test**

```typescript
// frontend/__tests__/components/LoginForm.spec.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginForm } from '@/components/Account/LoginForm'
import deMessages from '@/i18n/messages/de.json'

vi.mock('@/lib/api', () => ({
  postRequestLink: vi.fn(),
}))

import { postRequestLink } from '@/lib/api'

afterEach(() => vi.clearAllMocks())

function renderForm() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="de" messages={deMessages}>
        <LoginForm />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )
}

describe('LoginForm', () => {
  it('renders input and button', () => {
    renderForm()
    expect(screen.getByPlaceholderText(/deine@email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login-link senden/i })).toBeInTheDocument()
  })

  it('submits email and shows success', async () => {
    ;(postRequestLink as any).mockResolvedValue({ sent: true })
    renderForm()
    await userEvent.type(screen.getByPlaceholderText(/deine@email/i), 'a@b.com')
    await userEvent.click(screen.getByRole('button', { name: /senden/i }))

    await waitFor(() => {
      expect(postRequestLink).toHaveBeenCalledWith('a@b.com')
    })
    expect(await screen.findByText(/schau in dein postfach/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3 (GREEN): Komponente**

```typescript
// frontend/components/Account/LoginForm.tsx
'use client'

import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'
import { postRequestLink } from '@/lib/api'

export function LoginForm() {
  const t = useTranslations('account')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const mutation = useMutation({
    mutationFn: (e: string) => postRequestLink(e),
    onSuccess: () => setSent(true),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (email.trim() === '') return
    mutation.mutate(email.trim())
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <h2 className="font-serif text-2xl text-brand-text mb-2">{t('login_title')}</h2>
      <p className="text-sm text-brand-text2 mb-4">{t('login_hint')}</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder={t('email_placeholder')}
          className="w-full bg-brand-surface border border-brand-border rounded-md px-3 py-2 text-sm font-sans focus:outline-none focus:border-brand-text"
        />
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-brand-text text-brand-surface rounded-md px-3 py-2 text-sm font-medium hover:bg-brand-text2 disabled:opacity-60"
        >
          {t('send_link')}
        </button>
      </form>
      {sent && (
        <p className="mt-4 text-sm text-availability-green">{t('sent_toast')}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run + Commit**

```bash
cd frontend && npx vitest run __tests__/components/LoginForm.spec.tsx
git add frontend/components/Account/LoginForm.tsx frontend/__tests__/components/LoginForm.spec.tsx frontend/i18n/messages
git commit -m "feat(frontend): add LoginForm (TDD, 2 tests)"
```

---

### Task 17: Account-View mit Favorites + Logout

**Files:**
- Create: `frontend/components/Account/FavoritesList.tsx`
- Create: `frontend/lib/queries.ts` Erweiterungen — `useAuth`, `useFavorites`, `useToggleFavorite`, `useReport`
- Modify: `frontend/components/PageShell.tsx` (Account-Tab konkret)
- Create: `frontend/app/[locale]/account/page.tsx` (für deep-link)

- [ ] **Step 1: Hooks erweitern**

```typescript
// frontend/lib/queries.ts (extend)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchNearbyParkings, fetchParkingById,
  fetchMe, postLogout,
  fetchFavorites, postFavorite, deleteFavorite,
  postReport,
} from './api'
import type { FindNearbyParams, Parking } from './types'

export const queryKeys = {
  // ... existing
  me: () => ['me'] as const,
  favorites: () => ['favorites'] as const,
}

// existing useNearbyParkings, useParkingById ...

export function useAuth() {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: fetchMe,
    staleTime: 60_000,
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: postLogout,
    onSuccess: () => qc.setQueryData(queryKeys.me(), null),
  })
}

export function useFavorites() {
  return useQuery({
    queryKey: queryKeys.favorites(),
    queryFn: fetchFavorites,
  })
}

export function useToggleFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ parkingId, makeFavorite }: { parkingId: number; makeFavorite: boolean }) => {
      if (makeFavorite) await postFavorite(parkingId)
      else await deleteFavorite(parkingId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.favorites() }),
  })
}

export function useReport() {
  return useMutation({
    mutationFn: ({ parkingId, reportedSpots }: { parkingId: number; reportedSpots: number }) =>
      postReport(parkingId, reportedSpots),
  })
}
```

- [ ] **Step 2: FavoritesList**

```typescript
// frontend/components/Account/FavoritesList.tsx
'use client'

import { useTranslations } from 'next-intl'
import { useFavorites, useToggleFavorite } from '@/lib/queries'

export function FavoritesList() {
  const t = useTranslations('account')
  const q = useFavorites()
  const toggle = useToggleFavorite()

  if (q.isLoading) return <p className="p-4 text-sm text-brand-text3">…</p>
  if (q.isError) return <p className="p-4 text-sm text-availability-red">Failed to load.</p>
  const list = q.data ?? []
  if (list.length === 0) return <p className="p-4 text-sm text-brand-text3">{t('no_favorites')}</p>

  return (
    <ul className="divide-y divide-brand-border2">
      {list.map((p) => (
        <li key={p.id} className="flex items-center justify-between px-3 py-3">
          <div>
            <p className="text-sm text-brand-text font-medium">{p.name}</p>
            <p className="text-xs text-brand-text3 font-mono">{p.address}</p>
          </div>
          <button
            type="button"
            onClick={() => toggle.mutate({ parkingId: p.id, makeFavorite: false })}
            className="text-xs text-brand-text3 hover:text-availability-red"
            aria-label="remove favorite"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Account-View Logik in PageShell**

Ersetze den Account-Tab-Inhalt in `PageShell.tsx`:

```typescript
{tab === 'account' && <AccountView />}
```

Neue Datei:

```typescript
// frontend/components/Account/AccountView.tsx
'use client'

import { useTranslations } from 'next-intl'
import { useAuth, useLogout } from '@/lib/queries'
import { LoginForm } from './LoginForm'
import { FavoritesList } from './FavoritesList'

export function AccountView() {
  const t = useTranslations('account')
  const { data: user, isLoading } = useAuth()
  const logout = useLogout()

  if (isLoading) return <p className="p-4 text-sm text-brand-text3">…</p>
  if (user === undefined || user === null) return <LoginForm />

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-brand-text3 uppercase tracking-wider">{user.email}</p>
          <h2 className="font-serif text-2xl text-brand-text">{t('favorites_title')}</h2>
        </div>
        <button
          type="button"
          onClick={() => logout.mutate()}
          className="text-sm text-brand-text2 hover:text-brand-text"
        >
          {t('logout')}
        </button>
      </div>
      <div className="bg-brand-surface rounded-lg border border-brand-border">
        <FavoritesList />
      </div>
    </div>
  )
}
```

Importiere `AccountView` in `PageShell.tsx`.

- [ ] **Step 4: Deep-link page**

```typescript
// frontend/app/[locale]/account/page.tsx
import { AccountView } from '@/components/Account/AccountView'

export default function Page() {
  return <AccountView />
}
```

- [ ] **Step 5: Tests grün + Commit**

```bash
cd frontend && npx vitest run
git add frontend/components/Account frontend/lib/queries.ts frontend/components/PageShell.tsx frontend/app/[locale]/account
git commit -m "feat(frontend): add AccountView with FavoritesList + Logout"
```

---

### Task 18: /auth/verify page

**Files:**
- Create: `frontend/app/[locale]/auth/verify/page.tsx`

- [ ] **Step 1: Page**

```typescript
// frontend/app/[locale]/auth/verify/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function VerifyPage() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending')

  useEffect(() => {
    if (token === null) { setStatus('error'); return }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify?token=${encodeURIComponent(token)}`, {
      credentials: 'include',
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        setStatus('ok')
        setTimeout(() => router.replace('/account'), 800)
      })
      .catch(() => setStatus('error'))
  }, [token, router])

  return (
    <main className="h-screen flex items-center justify-center bg-brand-bg font-sans text-brand-text">
      {status === 'pending' && <p>…</p>}
      {status === 'ok' && <p>Eingeloggt — weiter geht's.</p>}
      {status === 'error' && <p className="text-availability-red">Link ungültig oder abgelaufen.</p>}
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/[locale]/auth/verify/page.tsx
git commit -m "feat(frontend): add /auth/verify page (token redemption + redirect)"
```

---

### Task 19: FavoriteToggle + ReportButton in ParkingDetail

**Files:**
- Create: `frontend/components/Detail/FavoriteToggle.tsx`
- Create: `frontend/components/Detail/ReportButton.tsx`
- Modify: `frontend/components/Detail/ParkingDetail.tsx`
- Create: `frontend/__tests__/components/FavoriteToggle.spec.tsx`
- Create: `frontend/__tests__/components/ReportButton.spec.tsx`

- [ ] **Step 1: FavoriteToggle**

```typescript
// frontend/components/Detail/FavoriteToggle.tsx
'use client'

import { useAuth, useFavorites, useToggleFavorite } from '@/lib/queries'

type Props = { parkingId: number }

export function FavoriteToggle({ parkingId }: Props) {
  const { data: user } = useAuth()
  const { data: favorites } = useFavorites()
  const toggle = useToggleFavorite()

  if (user === undefined || user === null) return null

  const isFav = (favorites ?? []).some((p) => p.id === parkingId)
  return (
    <button
      type="button"
      onClick={() => toggle.mutate({ parkingId, makeFavorite: !isFav })}
      aria-pressed={isFav}
      aria-label={isFav ? 'Favorit entfernen' : 'Favorit hinzufügen'}
      className="text-2xl"
    >
      {isFav ? '★' : '☆'}
    </button>
  )
}
```

- [ ] **Step 2: ReportButton**

```typescript
// frontend/components/Detail/ReportButton.tsx
'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useAuth, useReport } from '@/lib/queries'

type Props = { parkingId: number; totalSpots: number }

export function ReportButton({ parkingId, totalSpots }: Props) {
  const t = useTranslations('detail')
  const { data: user } = useAuth()
  const report = useReport()
  const [open, setOpen] = useState(false)
  const [spots, setSpots] = useState(0)

  if (user === undefined || user === null) return null

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full border border-brand-border rounded-md py-2 text-sm text-brand-text hover:bg-brand-bg"
        >
          Melde Verfügbarkeit
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            report.mutate(
              { parkingId, reportedSpots: spots },
              { onSuccess: () => setOpen(false) },
            )
          }}
          className="flex items-center gap-2"
        >
          <input
            type="number"
            min={0}
            max={totalSpots}
            value={spots}
            onChange={(e) => setSpots(Math.max(0, Math.min(totalSpots, Number(e.target.value))))}
            className="w-24 bg-brand-surface border border-brand-border rounded-md px-2 py-1 text-sm font-mono"
          />
          <button
            type="submit"
            disabled={report.isPending}
            className="bg-brand-text text-brand-surface rounded-md px-3 py-1 text-sm hover:bg-brand-text2 disabled:opacity-60"
          >
            Senden
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-brand-text3">
            Abbrechen
          </button>
        </form>
      )}
      {report.isError && (
        <p className="mt-1 text-xs text-availability-red">
          {(report.error as any)?.status === 429
            ? 'Zu viele Meldungen. Bitte später erneut versuchen.'
            : 'Fehler beim Senden.'}
        </p>
      )}
      {report.isSuccess && (
        <p className="mt-1 text-xs text-availability-green">Danke fürs Melden.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: ParkingDetail integration**

In `frontend/components/Detail/ParkingDetail.tsx` direkt unterhalb des Navigate-Buttons hinzufügen:

```typescript
import { FavoriteToggle } from './FavoriteToggle'
import { ReportButton } from './ReportButton'
// ...
<div className="flex items-center justify-between">
  <FavoriteToggle parkingId={parking.id} />
  <NavigateButton lat={parking.latitude} lng={parking.longitude} />
</div>
<ReportButton parkingId={parking.id} totalSpots={parking.totalSpots} />
```

- [ ] **Step 4: Tests für beide Komponenten**

```typescript
// frontend/__tests__/components/FavoriteToggle.spec.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FavoriteToggle } from '@/components/Detail/FavoriteToggle'

const useAuth = vi.fn()
const useFavorites = vi.fn()
const useToggleFavorite = vi.fn()
vi.mock('@/lib/queries', () => ({
  useAuth: () => useAuth(),
  useFavorites: () => useFavorites(),
  useToggleFavorite: () => useToggleFavorite(),
}))

afterEach(() => vi.clearAllMocks())

function renderToggle(parkingId = 1) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <FavoriteToggle parkingId={parkingId} />
    </QueryClientProvider>,
  )
}

describe('FavoriteToggle', () => {
  it('renders nothing when logged out', () => {
    useAuth.mockReturnValue({ data: null })
    useFavorites.mockReturnValue({ data: [] })
    useToggleFavorite.mockReturnValue({ mutate: vi.fn() })
    const { container } = renderToggle()
    expect(container.firstChild).toBeNull()
  })

  it('renders empty star when no favorite', () => {
    useAuth.mockReturnValue({ data: { id: 'u', email: 'a@b' } })
    useFavorites.mockReturnValue({ data: [] })
    useToggleFavorite.mockReturnValue({ mutate: vi.fn() })
    renderToggle()
    expect(screen.getByRole('button', { name: /hinzufügen/i })).toHaveTextContent('☆')
  })

  it('calls toggle.mutate with makeFavorite=true on click', async () => {
    const mutate = vi.fn()
    useAuth.mockReturnValue({ data: { id: 'u', email: 'a@b' } })
    useFavorites.mockReturnValue({ data: [] })
    useToggleFavorite.mockReturnValue({ mutate })
    renderToggle(42)
    await userEvent.click(screen.getByRole('button'))
    expect(mutate).toHaveBeenCalledWith({ parkingId: 42, makeFavorite: true })
  })

  it('renders filled star when parking is favorite', () => {
    useAuth.mockReturnValue({ data: { id: 'u', email: 'a@b' } })
    useFavorites.mockReturnValue({ data: [{ id: 42 }] })
    useToggleFavorite.mockReturnValue({ mutate: vi.fn() })
    renderToggle(42)
    expect(screen.getByRole('button', { name: /entfernen/i })).toHaveTextContent('★')
  })
})
```

```typescript
// frontend/__tests__/components/ReportButton.spec.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReportButton } from '@/components/Detail/ReportButton'
import deMessages from '@/i18n/messages/de.json'

const useAuth = vi.fn()
const useReport = vi.fn()
vi.mock('@/lib/queries', () => ({
  useAuth: () => useAuth(),
  useReport: () => useReport(),
}))

afterEach(() => vi.clearAllMocks())

function renderBtn(props: Partial<React.ComponentProps<typeof ReportButton>> = {}) {
  const final: React.ComponentProps<typeof ReportButton> = { parkingId: 1, totalSpots: 100, ...props }
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="de" messages={deMessages}>
        <ReportButton {...final} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )
}

describe('ReportButton', () => {
  it('renders nothing when logged out', () => {
    useAuth.mockReturnValue({ data: null })
    useReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, isSuccess: false })
    const { container } = renderBtn()
    expect(container.firstChild).toBeNull()
  })

  it('opens form on click', async () => {
    useAuth.mockReturnValue({ data: { id: 'u', email: 'a@b' } })
    useReport.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false, isSuccess: false })
    renderBtn()
    await userEvent.click(screen.getByRole('button', { name: /verfügbarkeit/i }))
    expect(screen.getByRole('button', { name: /senden/i })).toBeInTheDocument()
  })

  it('submits with reportedSpots', async () => {
    const mutate = vi.fn((_, opts) => opts?.onSuccess?.())
    useAuth.mockReturnValue({ data: { id: 'u', email: 'a@b' } })
    useReport.mockReturnValue({ mutate, isPending: false, isError: false, isSuccess: false })
    renderBtn({ parkingId: 7, totalSpots: 100 })
    await userEvent.click(screen.getByRole('button', { name: /verfügbarkeit/i }))
    const input = screen.getByRole('spinbutton')
    await userEvent.clear(input)
    await userEvent.type(input, '42')
    await userEvent.click(screen.getByRole('button', { name: /senden/i }))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        { parkingId: 7, reportedSpots: 42 },
        expect.any(Object),
      )
    })
  })
})
```

- [ ] **Step 5: Run + Commit**

```bash
cd frontend && npx vitest run
git add frontend/components/Detail frontend/__tests__/components/FavoriteToggle.spec.tsx frontend/__tests__/components/ReportButton.spec.tsx
git commit -m "feat(frontend): add FavoriteToggle + ReportButton in ParkingDetail (TDD)"
```

---

## Phase 8 — Deployment-Prep

### Task 20: Backend für Render vorbereiten

**Files:**
- Modify: `backend/Dockerfile` (production-mode)
- Create: `backend/.env.example`
- Create: `render.yaml` (root) — Blueprint für Render

- [ ] **Step 1: backend/Dockerfile**

Wenn aktueller Dockerfile bereits `npm run start:dev` macht, ersetze für Production:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package.json ./
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

- [ ] **Step 2: render.yaml**

```yaml
services:
  - type: web
    name: parkfind-backend
    env: docker
    plan: free
    dockerfilePath: backend/Dockerfile
    dockerContext: backend
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: DATABASE_URL
        sync: false           # set manually in Render UI to Supabase URL
      - key: JWT_SECRET
        generateValue: true
      - key: RESEND_API_KEY
        sync: false
      - key: EMAIL_FROM
        sync: false
      - key: PUBLIC_APP_URL
        sync: false
      - key: PLS_FEED_URL
        value: https://www.pls-zh.ch/plsFeed/rss
      - key: CORS_ORIGIN
        sync: false
      - key: NODE_ENV
        value: production
```

- [ ] **Step 3: .env.example**

```
DATABASE_URL=postgresql://parking:parking@localhost:5432/parking
JWT_SECRET=replace-me-with-32-byte-hex
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@parkfind.example
PUBLIC_APP_URL=http://localhost:3000
PLS_FEED_URL=https://www.pls-zh.ch/plsFeed/rss
CORS_ORIGIN=http://localhost:3000
```

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile render.yaml backend/.env.example
git commit -m "build(backend): production Dockerfile + Render blueprint + .env.example"
```

---

### Task 21: Frontend für Vercel vorbereiten

**Files:**
- Modify: `frontend/next.config.mjs` (allow images / output if needed)
- Create: `frontend/.env.example`
- Create: `vercel.json` (root) — only if non-default needed

- [ ] **Step 1: frontend/.env.example**

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

- [ ] **Step 2: README-Snippet**

In `README.md` (oder neu anlegen) eine Sektion „Deployment" mit Verweis auf `docs/superpowers/specs/2026-05-14-parkfind-zurich-v1-design.md` §8.

- [ ] **Step 3: Commit**

```bash
git add frontend/.env.example README.md
git commit -m "docs: add frontend .env.example + deployment README"
```

---

## Phase 9 — Verification

### Task 22: Full Test-Suite

- [ ] **Step 1: Backend**

```bash
cd backend && npx vitest run
```

Erwartet: alle alten + neu (PLS parser/sync + Auth + Favorites + Reports) grün.

- [ ] **Step 2: Frontend**

```bash
cd frontend && npx vitest run
```

Erwartet: alle 38 alten + neu (TabBar + MapSidebar + LoginForm + FavoriteToggle + ReportButton) grün.

- [ ] **Step 3: Type-Check**

```bash
cd frontend && npx tsc --noEmit
cd backend && npx tsc --noEmit
```

Erwartet: exit 0.

- [ ] **Step 4: Commit (falls Anpassungen nötig)**

---

## Phase 10 — USER-ACTION-REQUIRED

Diese Schritte muss der User manuell ausführen, weil sie Account-Setup mit externen Diensten erfordern.

### Task 23: Resend einrichten (USER)

1. Account auf https://resend.com erstellen
2. Domain hinzufügen ODER Sandbox-Mode mit Test-Adresse aktivieren
3. API-Key generieren → speichern als `RESEND_API_KEY`
4. Absender-Adresse festlegen → `EMAIL_FROM=…`

**Was Claude nicht tun kann:** Account-Erstellung, Domain-DNS-Verify.

### Task 24: Supabase einrichten (USER)

1. Account auf https://supabase.com erstellen
2. Neues Projekt, Region eu-central-1, Passwort wählen
3. Im SQL-Editor: `CREATE EXTENSION IF NOT EXISTS postgis;`
4. Connection-String (Pooled, Port 6543) kopieren → `DATABASE_URL`

### Task 25: Render Backend deployen (USER)

1. Account auf https://render.com erstellen
2. „New → Blueprint" → Repo verbinden → `render.yaml` wird erkannt
3. Env-Vars in Render-UI setzen: `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `PUBLIC_APP_URL`, `CORS_ORIGIN`
4. Deploy starten, Health-Check `/health` warten

### Task 26: Vercel Frontend deployen (USER)

1. Account auf https://vercel.com erstellen
2. „Import Project" → Repo wählen → Root = `frontend/`
3. Env-Var setzen: `NEXT_PUBLIC_API_URL=https://parkfind-backend.onrender.com`
4. Deploy

### Task 27: End-to-End Smoke-Test (USER + Claude)

1. Vercel-URL aufrufen — Karte mit Zürich-Markern
2. Locale-Switch testen
3. Account-Tab → E-Mail eingeben → E-Mail empfangen
4. Magic-Link klicken → /auth/verify → /account
5. Parkhaus markieren als Favorit → erscheint in Account-Liste
6. Report-Button: 50 abgeben → Toast
7. 5× Report in 10 min → 6. = 429
8. PLS-Daten-Check: nach 1 min Wartezeit `lastSyncedAt` < 2 min

Wenn alle 8 Schritte grün: v1 = fertig.

---

## Anhang: PLS-Feed Findings

(Wird in Phase 0 / Task 0 nach dem Spike-Lauf befüllt.)
