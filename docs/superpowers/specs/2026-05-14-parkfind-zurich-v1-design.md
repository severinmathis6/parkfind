# ParkFind Zürich v1 — Design Spec

**Datum:** 2026-05-14
**Sprint:** 7 Tage (Vollausbau)
**Ersetzt:** `2026-04-29-parking-checker-design.md` (MVP) bezüglich Scope/Region/Daten; Architektur-Basis bleibt.

---

## 1. Ziel

Aus dem MVP-Code (Backend NestJS + Frontend Next.js, beide getestet & lokal lauffähig) und dem HTML-Prototyp (Layout & Visual-Sprache) ein deploytes Produkt **„ParkFind Zürich"** machen, das:

- Live-Belegung von ~17 Zürcher Parkhäusern aus der offiziellen PLS-Quelle zeigt
- Im Two-Pane-Layout (Sidebar-Liste + Karte) und mit Prototype-Palette/Typo läuft
- Eingeloggten Usern erlaubt, Parkhäuser zu favorisieren und Verfügbarkeit zu reporten
- Auf Vercel + Render + Supabase + Resend deployed ist und unter einer URL aufrufbar

## 2. Getroffene Entscheidungen (Brainstorming)

| Frage | Entscheidung |
|---|---|
| Scope | „Vollausbau D" — Deployment + Look + Live-Daten + Report + Auth |
| Zeitrahmen | 7 Tage statt 3 |
| Geografisch | Zürich-only (statt CH-weit) |
| Datenquelle | Stadt Zürich PLS RSS-Feed (Live) + opendata.swiss Stammdaten |
| Auth-Zweck | Favorites + Report freischalten |
| Auth-Provider | Magic Link per E-Mail (Resend), kein Passwort |
| Visual-Fidelity | „Layout-Port" — Two-Pane (Sidebar + Karte) + Tab-Bar + Palette/Typo aus Prototyp, ohne Hero-Page/Micro-Animations/custom Pin-Mono-Zahlen |
| i18n | DE + EN bleiben (Infra existiert) |
| Hosting | Vercel (FE) · Render (BE, Docker) · Supabase (DB, PostGIS) · Resend (Mail) |
| Branch-Modell | Direkt auf `main`, Commits pro Schritt |

## 3. Architektur — Ist + Delta

**Ist (Plan A+B abgeschlossen):**
- Backend: NestJS + Prisma + Postgres/PostGIS, Endpoint `GET /api/parkings`, `GET /api/parkings/:id`, `GET /health`
- Frontend: Next.js 14 App-Router + Tailwind + TanStack Query + Leaflet + next-intl
- Tests: 38 Frontend + Backend grün
- Daten: 30 Seed-Parkings (CH-weit)

**Delta für v1:**

```
┌──────────────────────┐    ┌─────────────────────┐
│  Vercel              │    │  Render             │
│  Next.js Frontend    │────│  NestJS Backend     │
│  (DE/EN, Layout-Port)│    │  + PLS-Cron (60s)   │
└──────────────────────┘    │  + Auth Module      │
                            │  + Report Module    │
                            └─────────┬───────────┘
                                      │
                            ┌─────────▼───────────┐
                            │  Supabase           │
                            │  Postgres + PostGIS │
                            │  + Email (Resend)   │
                            └─────────────────────┘
```

## 4. Daten

### 4.1 PLS-Feed
- **URL:** `https://www.pls-zh.ch/plsFeed/rss`
- **Format:** RSS 2.0, ein `<item>` pro Parkhaus mit `<title>` (Name + Status + freie Plätze)
- **Beispiel (zur Verifikation beim Implementieren):** Backend-Code parsed `<title>` als `"Name / Status / N"` (Status ∈ {`offen`, `geschlossen`, `besetzt`}).
- **Polling:** Backend-Cron alle 60 s → Update `availableSpots` + `status` in DB
- **Fehlerfall:** Letzter erfolgreicher Snapshot bleibt aktiv, `lastSyncedAt` zeigt Alter. Bei initialem Sync-Fehler bleibt `status = UNKNOWN`, Marker grau.

### 4.2 Stammdaten Zürich
- 17 Parkhäuser per One-Off-Seed aus opendata.swiss (Manual-Mapping in Spec-Anhang)
- Felder: `id, name, address, latitude, longitude, totalSpots, pricePerHour, isEvCharging, maxHeight, openingHours`
- Aktuelle 30 Seed-Parkings (CH-weit) werden ersetzt — keine Hybrid-Phase

### 4.3 Schema-Delta (Prisma)

```prisma
model Parking {
  id              Int      @id @default(autoincrement())
  externalId      String   @unique          // PLS-Identifier zum Matchen
  name            String
  // ... existing fields ...
  status          ParkingStatus @default(UNKNOWN)
  lastSyncedAt    DateTime?
}

enum ParkingStatus { OPEN CLOSED FULL UNKNOWN }

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
  id           Int      @id @default(autoincrement())
  userId       String
  parkingId    Int
  reportedSpots Int                            // User-supplied "frei laut Beobachtung"
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  parking      Parking  @relation(fields: [parkingId], references: [id], onDelete: Cascade)
  @@index([parkingId, createdAt])
}

// Magic-Link Tokens (kurzlebig, einmalig)
model AuthToken {
  token     String   @id                      // random 32-byte hex
  email     String
  expiresAt DateTime
  consumedAt DateTime?
  @@index([email])
}
```

## 5. Backend — Neue Module

### 5.1 PLS Sync (`backend/src/sync/`)
- `PlsSyncService` — fetcht RSS, parsed Items, upserted nach `externalId`
- `@Cron('*/60 * * * * *')` aus `@nestjs/schedule`
- Erste Synchronisation beim Boot
- Tests: Mock RSS-Response, verifiziere DB-Mutationen

### 5.2 Auth (`backend/src/auth/`)
- `POST /api/auth/request-link { email }` → erzeugt `AuthToken`, schickt Magic-Link via Resend
- `GET /api/auth/verify?token=...` → setzt HttpOnly-Cookie mit JWT (7 Tage), redirect zu `/`
- `POST /api/auth/logout` → cookie clear
- `GET /api/auth/me` → aktuellen User (oder 401)
- JWT signed mit `JWT_SECRET` aus env
- `AuthGuard` für geschützte Routen

### 5.3 Favorites (`backend/src/favorites/`)
- `GET /api/favorites` (auth) → Liste der Parkings mit `isFavorite=true`
- `POST /api/favorites/:parkingId` (auth) → upsert
- `DELETE /api/favorites/:parkingId` (auth) → soft-skip wenn nicht da

### 5.4 Reports (`backend/src/reports/`)
- `POST /api/parkings/:id/report { reportedSpots }` (auth)
- Rate-limit: max 5 Reports / 10 min pro User, max 1 / 30 min pro (User, Parking)
- Schreibt nach `Report`-Table, kein direkter Effekt auf `availableSpots` (nur PLS schreibt)
- Trends sichtbar als „N User haben in den letzten 30 min reportet"

### 5.5 Env-Variablen (neu)
```
DATABASE_URL              # Supabase pooled connection
JWT_SECRET                # 32+ byte random
RESEND_API_KEY            # from Resend dashboard
PUBLIC_APP_URL            # https://parkfind.example
EMAIL_FROM                # noreply@parkfind.example
PLS_FEED_URL              # https://www.pls-zh.ch/plsFeed/rss
```

## 6. Frontend — Layout-Port

### 6.1 Visuelle Tokens (Tailwind-Theme-Extend)

```js
// tailwind.config.ts (extend)
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
    green:    '#2D6A4F', 'green-bg':  '#D8EDDF',
    yellow:   '#B5830A', 'yellow-bg': '#FDF3DC',
    red:      '#C0392B', 'red-bg':    '#FAE0DC',
  },
},
fontFamily: {
  serif: ['"Instrument Serif"', 'serif'],
  sans:  ['Geist', 'system-ui', 'sans-serif'],
  mono:  ['"DM Mono"', 'monospace'],
},
borderRadius: { md: '10px', lg: '16px' },
```

### 6.2 Layout-Komponenten

```
app/[locale]/
├── layout.tsx          (Geist als Default-Font, Instrument Serif für Logo)
├── page.tsx            → <PageShell /> mit Tab "Karte" aktiv
├── account/page.tsx    → Profile + Favorites (auth-gated)
└── auth/
    └── verify/page.tsx → Token-Verifikation, Redirect

components/
├── Layout/
│   ├── TabBar.tsx          (Logo + Tabs Karte/Liste/Account)
│   └── LocaleSwitcher.tsx  (bestehend, restyled)
├── Map/
│   ├── MapView.tsx         (Two-Pane: Sidebar + Karte)
│   ├── MapSidebar.tsx      (Search + Filter + List)
│   ├── ParkingListItem.tsx (selected-state + mono-Zahlen)
│   ├── MapClient.tsx       (bestehend, restyled Markers)
│   └── ParkingMarker.tsx   (custom Pin mit Mono-Zahl drin)
├── Filters/                (bestehend, Style auf brand.text-Pills)
├── Detail/                 (bestehend, Drawer-Style)
├── Account/
│   ├── LoginForm.tsx       (E-Mail-Input + Send-Magic-Link)
│   ├── FavoritesList.tsx
│   └── ReportButton.tsx
└── PageShell.tsx           (orchestriert Tabs + Views)
```

### 6.3 Layout-Skizze

```
┌─ TabBar ────────────────────────────────────────────┐
│  ParkFind  Zürich      Karte · Liste · Account · DE │
├─────────────────────────────────────────────────────┤
│ Sidebar (360 px)        │  Karte (rest)             │
│ ┌─ Search ────────────┐ │                           │
│ │ 🔍 Suche / Standort │ │     [ Leaflet Map         │
│ └─────────────────────┘ │       mit Markern,        │
│ Chips: Parkhaus│Frei│⚡│ │       Klick → Detail ]    │
│ ─────────────────────── │                           │
│ ▸ PH Hohe Promenade     │                           │
│   130 / 220  · 4.50/h   │                           │
│ ─────────────────────── │                           │
│ ▸ PH Opéra              │                           │
│   12 / 290  · 5.00/h    │                           │
└─────────────────────────┴───────────────────────────┘
```

Mobile: Sidebar wird zu Bottom-Sheet (≤640 px).

### 6.4 Neue Frontend-Hooks
- `useAuth()` — wrappt `/api/auth/me`, cached via TanStack
- `useFavorites()` — `/api/favorites`, optimistic toggle (UI flippt sofort, rollt zurück bei 4xx/5xx + Toast)
- `useReportParking(parkingId)` — Mutation mit Rate-Limit-Toast

### 6.5 Auth-UX
- Nicht eingeloggt: Account-Tab zeigt `<LoginForm>`
- Submit → POST request-link → „E-Mail geschickt" Toast
- User klickt Link → `/auth/verify?token=…` setzt Cookie → Redirect `/account`
- Eingeloggt: Account-Tab zeigt Favoriten-Liste + Logout-Button
- Favorit-Stern im Detail-Panel (nur sichtbar wenn eingeloggt)
- Report-Button im Detail-Panel (nur sichtbar wenn eingeloggt)

## 7. Test-Strategie

Beibehaltung des TDD-Ansatzes aus Plan A/B.

**Backend (Vitest + Supertest):**
- `PlsSyncService.spec.ts` — Mock-RSS-Response → DB-Mutation verifiziert
- `auth.controller.spec.ts` — Request-Link, Verify, Me, Logout
- `favorites.spec.ts` — CRUD mit Auth-Guard
- `reports.spec.ts` — Rate-Limit-Logik, 429er bei Überschreitung

**Frontend (Vitest + RTL):**
- `LoginForm.spec.tsx` — Submit → Toast
- `FavoritesList.spec.tsx` — leer/gefüllt/toggle
- `ReportButton.spec.tsx` — Klick → Mutation, Rate-Limit-Feedback
- `MapSidebar.spec.tsx` — Liste rendert, Klick selektiert
- `TabBar.spec.tsx` — Aktiver Tab, Locale-Switch

**E2E (Smoke nach Deployment):**
- Live-URL liefert HTML 200
- `/api/parkings` liefert > 0 Items
- Magic-Link-Flow manuell verifiziert

## 8. Deployment-Plan

### 8.1 Supabase
- Neues Projekt, Region eu-central-1
- PostGIS via SQL-Editor: `CREATE EXTENSION IF NOT EXISTS postgis;`
- Connection-String (pooled, port 6543) als `DATABASE_URL`
- Prisma-Migrationen via `npx prisma migrate deploy`

### 8.2 Render
- Backend als Docker-Service deployed (existing `backend/Dockerfile`)
- ENV-Vars siehe 5.5
- Health-Check: `/health`
- Auto-Deploy on push to `main`

### 8.3 Vercel
- Frontend, Framework-Preset Next.js
- ENV: `NEXT_PUBLIC_API_URL` = Render-URL
- Domain optional: `parkfind.<custom>` oder Vercel-Subdomain

### 8.4 Resend
- Account, Sender-Domain verifiziert (oder Default-Sandbox)
- API-Key → Render-Env `RESEND_API_KEY`

## 9. Akzeptanzkriterien (v1 „fertig" wenn)

1. `https://<vercel-url>` lädt, zeigt Two-Pane-Layout mit Zürich-Parkhäusern
2. Marker-Farben spiegeln Live-PLS-Daten (geprüft durch Vergleich mit `pls-zh.ch`)
3. Liste links und Karte rechts sind synchronisiert (Selected-State sichtbar)
4. Sprache umschaltbar DE ↔ EN, gesamtes UI übersetzt
5. Magic-Link-Login funktioniert: E-Mail kommt an, Klick loggt ein
6. Eingeloggte können Parkhaus favorisieren — bleibt nach Reload sichtbar
7. Eingeloggte können `reportedSpots` posten — Rate-Limit greift bei 6. Versuch innerhalb 10 min
8. Alle bestehenden Tests + neue Tests grün
9. Backend-`/health` liefert 200 in production
10. PLS-Cron updated DB nachweisbar (z. B. `lastSyncedAt` < 2 min)

## 10. Nicht im Scope (für später)

- Reservierungen, History, Predictions, Push-Notifications
- FR/IT-Sprachen
- Multi-City (Basel/Bern/Genf)
- Mobile-App
- Bezahlfunktion

## 11. Risiken & Mitigation

| Risiko | Mitigation |
|---|---|
| PLS-Feed-Format ändert sich / ist anders als angenommen | Spike als allererster Schritt; bei Mismatch: Fallback auf Stammdaten + „Live coming soon" |
| Resend Sender-Verifikation dauert | Sandbox-Mode mit Test-Adressen für die ersten Tage |
| Supabase Free-Tier zu klein | < 17 Parkings + < 100 Users: weit unter 500 MB |
| Render Cold-Start lähmt UX | Frontend zeigt Skeleton, Backend hat Health-Pre-Warm |
| User-übergebene Credentials fehlen (Resend, Supabase, Vercel) | Plan listet diese als „USER ACTION REQUIRED"-Blöcke, Implementation kann offline weitergehen |

## 12. USER-ACTION-REQUIRED Punkte

Während ich autonom arbeite, gibt es Schritte, die ich nicht ohne User-Aktion abschließen kann. Sie werden im Plan klar markiert und einzeln verifizierbar gemacht.

1. **Resend-Account + Domain-Verify** → liefert `RESEND_API_KEY`
2. **Supabase-Projekt anlegen** → liefert `DATABASE_URL`
3. **Render-Account + Service-Create** → deployt Backend
4. **Vercel-Account + Project-Import** → deployt Frontend
5. **Optional: Custom Domain**
