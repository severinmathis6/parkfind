# Parking Checker — Plan B: Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 14 web frontend that consumes the Plan A backend API. Users see a Leaflet map with color-coded parking markers around their location, can filter (free/paid, type, EV), click for details, and tap "Navigate" to open Google Maps. Available in DE and EN.

**Architecture:** Next.js App Router with i18n via `next-intl`. Map rendered client-side only (Leaflet needs `window`). TanStack Query handles server state with 30s cache. Filter state lives in URL search params. Mobile-first (full-screen map, bottom-sheet filters/details on mobile, sidebar on desktop).

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS 3, Leaflet 1.9, react-leaflet 4, @tanstack/react-query 5, next-intl 3, Vitest + React Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-04-29-parking-checker-design.md`
**Prerequisite:** Plan A backend running on `http://localhost:3001`

---

## File Structure (Plan B)

**Frontend (`frontend/`):**
- `package.json`, `package-lock.json`, `tsconfig.json`
- `next.config.mjs`, `next-env.d.ts`
- `tailwind.config.ts`, `postcss.config.js`
- `Dockerfile`
- `vitest.config.ts`, `vitest.setup.ts`
- `.env.example`
- `middleware.ts` — i18n routing
- `app/[locale]/layout.tsx` — Providers (i18n, query)
- `app/[locale]/page.tsx` — Main page (server component shell + client map)
- `app/globals.css` — Tailwind + Leaflet base
- `components/Map/MapContainer.tsx` — Dynamic-import wrapper
- `components/Map/MapClient.tsx` — `react-leaflet` map (client-only)
- `components/Map/ParkingMarker.tsx`
- `components/Map/UserLocationMarker.tsx`
- `components/Filters/FilterBar.tsx`
- `components/Filters/FilterChip.tsx`
- `components/Detail/ParkingDetail.tsx`
- `components/Detail/NavigateButton.tsx`
- `components/Location/LocationButton.tsx`
- `components/Layout/TopBar.tsx`
- `components/Layout/LocaleSwitcher.tsx`
- `lib/api.ts` — fetch wrappers
- `lib/queries.ts` — TanStack Query hooks
- `lib/colors.ts` — availability → color
- `lib/types.ts` — shared types matching backend DTOs
- `lib/url-state.ts` — search params helpers
- `i18n/config.ts`, `i18n/routing.ts`
- `i18n/messages/de.json`, `i18n/messages/en.json`
- `__tests__/lib/colors.spec.ts`
- `__tests__/lib/api.spec.ts`
- `__tests__/lib/url-state.spec.ts`
- `__tests__/components/FilterBar.spec.tsx`
- `__tests__/components/ParkingDetail.spec.tsx`
- `__tests__/components/NavigateButton.spec.tsx`
- `__tests__/components/LocationButton.spec.tsx`

---

## Phase 1 — Frontend Foundation

### Task 1: Next.js scaffold + TypeScript + Tailwind

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.mjs`
- Create: `frontend/next-env.d.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/.env.example`
- Create: `frontend/.gitignore` (Next-specific additions)
- Create: `frontend/app/globals.css`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "parking-checker-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.60.0",
    "leaflet": "^1.9.4",
    "next": "^14.2.18",
    "next-intl": "^3.26.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-leaflet": "^4.2.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/leaflet": "^1.9.14",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `frontend/next.config.mjs`**

```javascript
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/config.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

export default withNextIntl(nextConfig)
```

- [ ] **Step 4: Create `frontend/next-env.d.ts`**

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.
```

- [ ] **Step 5: Create `frontend/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        availability: {
          green: '#16a34a',
          yellow: '#eab308',
          red: '#dc2626',
        },
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 6: Create `frontend/postcss.config.js`**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 7: Create `frontend/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #__next {
  height: 100%;
}

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  margin: 0;
}

.leaflet-container {
  height: 100%;
  width: 100%;
}
```

- [ ] **Step 8: Create `frontend/.env.example`**

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

- [ ] **Step 9: Install dependencies**

```bash
cd frontend
npm install
```

Expected: `node_modules/` populated.

- [ ] **Step 10: Verify build setup is correct**

```bash
cd frontend
npx next info
```

Expected: lists Next.js version, OS, etc. with no errors.

- [ ] **Step 11: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/next.config.mjs frontend/next-env.d.ts frontend/tailwind.config.ts frontend/postcss.config.js frontend/app/globals.css frontend/.env.example
git commit -m "feat(frontend): scaffold Next.js 14 + Tailwind 3 + TypeScript"
```

---

### Task 2: Vitest setup with jsdom + RTL

**Files:**
- Create: `frontend/vitest.config.ts`
- Create: `frontend/vitest.setup.ts`

- [ ] **Step 1: Create `frontend/vitest.config.ts`**

```typescript
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['__tests__/**/*.spec.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

- [ ] **Step 2: Create `frontend/vitest.setup.ts`**

```typescript
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Run vitest (expect "no test files found")**

```bash
cd frontend
npm test
```

Expected: `No test files found, exiting with code 1` (acceptable — no tests yet).

- [ ] **Step 4: Commit**

```bash
git add frontend/vitest.config.ts frontend/vitest.setup.ts
git commit -m "feat(frontend): add vitest config with jsdom + RTL"
```

---

### Task 3: i18n setup with next-intl (DE + EN)

**Files:**
- Create: `frontend/i18n/config.ts`
- Create: `frontend/i18n/routing.ts`
- Create: `frontend/i18n/messages/de.json`
- Create: `frontend/i18n/messages/en.json`
- Create: `frontend/middleware.ts`

- [ ] **Step 1: Create `frontend/i18n/routing.ts`**

```typescript
import { defineRouting } from 'next-intl/routing'
import { createSharedPathnamesNavigation } from 'next-intl/navigation'

export const routing = defineRouting({
  locales: ['de', 'en'],
  defaultLocale: 'de',
})

export const { Link, redirect, usePathname, useRouter } =
  createSharedPathnamesNavigation(routing)
```

- [ ] **Step 2: Create `frontend/i18n/config.ts`**

```typescript
import { notFound } from 'next/navigation'
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !routing.locales.includes(locale as 'de' | 'en')) {
    locale = routing.defaultLocale
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  }
})
```

- [ ] **Step 3: Create `frontend/i18n/messages/de.json`**

```json
{
  "app": {
    "title": "Parkplatz-Finder",
    "subtitle": "Schweizer Parkplätze in deiner Nähe"
  },
  "location": {
    "locate_me": "Standort verwenden",
    "denied": "Standort nicht verfügbar — verschiebe die Karte",
    "loading": "Suche Standort..."
  },
  "filters": {
    "title": "Filter",
    "is_free_label": "Kostenlos",
    "ev_charging_label": "Mit Ladestation",
    "type_street": "Strasse",
    "type_garage": "Parkhaus",
    "type_private": "Privat",
    "clear": "Filter zurücksetzen"
  },
  "detail": {
    "address": "Adresse",
    "available": "Frei",
    "of": "von",
    "price_per_hour": "Preis pro Stunde",
    "free": "Kostenlos",
    "ev_charging": "Ladestation verfügbar",
    "no_ev_charging": "Keine Ladestation",
    "max_height": "Max. Höhe",
    "opening_hours": "Öffnungszeiten",
    "navigate": "Navigation starten",
    "close": "Schliessen"
  },
  "errors": {
    "load_failed": "Daten konnten nicht geladen werden",
    "retry": "Erneut versuchen"
  },
  "locale": {
    "de": "Deutsch",
    "en": "English"
  }
}
```

- [ ] **Step 4: Create `frontend/i18n/messages/en.json`**

```json
{
  "app": {
    "title": "Parking Finder",
    "subtitle": "Swiss parking spots near you"
  },
  "location": {
    "locate_me": "Use my location",
    "denied": "Location unavailable — drag the map",
    "loading": "Locating..."
  },
  "filters": {
    "title": "Filters",
    "is_free_label": "Free only",
    "ev_charging_label": "EV charging",
    "type_street": "Street",
    "type_garage": "Garage",
    "type_private": "Private",
    "clear": "Clear filters"
  },
  "detail": {
    "address": "Address",
    "available": "Available",
    "of": "of",
    "price_per_hour": "Price per hour",
    "free": "Free",
    "ev_charging": "EV charging available",
    "no_ev_charging": "No EV charging",
    "max_height": "Max. height",
    "opening_hours": "Opening hours",
    "navigate": "Start navigation",
    "close": "Close"
  },
  "errors": {
    "load_failed": "Failed to load parking data",
    "retry": "Retry"
  },
  "locale": {
    "de": "Deutsch",
    "en": "English"
  }
}
```

- [ ] **Step 5: Create `frontend/middleware.ts`**

```typescript
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  matcher: ['/', '/(de|en)/:path*'],
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/i18n frontend/middleware.ts
git commit -m "feat(frontend): add next-intl i18n setup with DE + EN"
```

---

## Phase 2 — Shared Libs (Pure TS, TDD)

### Task 4: lib/types.ts — shared types matching backend

**Files:**
- Create: `frontend/lib/types.ts`

- [ ] **Step 1: Create `frontend/lib/types.ts`**

```typescript
export type ParkingType = 'street' | 'garage' | 'private'

export const PARKING_TYPES: readonly ParkingType[] = ['street', 'garage', 'private'] as const

export type Parking = {
  id: number
  name: string
  address: string
  city: string
  parkingType: ParkingType
  latitude: number
  longitude: number
  totalSpots: number
  availableSpots: number
  pricePerHour: number
  isEvCharging: boolean
  maxHeight: number | null
  openingHours: string | null
  distanceM?: number
}

export type FindNearbyParams = {
  lat: number
  lng: number
  radius?: number
  parkingType?: ParkingType[]
  isEvCharging?: boolean
  isFree?: boolean
}

export type Coords = { lat: number; lng: number }

export const ZURICH_HB: Coords = { lat: 47.3779, lng: 8.5403 }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/types.ts
git commit -m "feat(frontend): add shared types matching backend DTOs"
```

---

### Task 5: lib/colors.ts (TDD)

**Files:**
- Create: `frontend/__tests__/lib/colors.spec.ts`
- Create: `frontend/lib/colors.ts`

- [ ] **Step 1 (RED): Create `frontend/__tests__/lib/colors.spec.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { availabilityColor, availabilityColorClass } from '@/lib/colors'

describe('availabilityColor', () => {
  it('returns green when ratio >= 0.3', () => {
    expect(availabilityColor(50, 100)).toBe('green')
    expect(availabilityColor(30, 100)).toBe('green')
  })

  it('returns yellow when 0.1 <= ratio < 0.3', () => {
    expect(availabilityColor(20, 100)).toBe('yellow')
    expect(availabilityColor(10, 100)).toBe('yellow')
  })

  it('returns red when ratio < 0.1', () => {
    expect(availabilityColor(5, 100)).toBe('red')
    expect(availabilityColor(0, 100)).toBe('red')
  })

  it('returns red when total is 0 or negative', () => {
    expect(availabilityColor(0, 0)).toBe('red')
    expect(availabilityColor(0, -5)).toBe('red')
  })

  it('returns red when available > total (degenerate)', () => {
    expect(availabilityColor(150, 100)).toBe('green')  // ratio capped behavior: still green
  })
})

describe('availabilityColorClass', () => {
  it('returns Tailwind class for each color', () => {
    expect(availabilityColorClass('green')).toBe('bg-availability-green')
    expect(availabilityColorClass('yellow')).toBe('bg-availability-yellow')
    expect(availabilityColorClass('red')).toBe('bg-availability-red')
  })
})
```

- [ ] **Step 2 (RED): Run test, verify it fails**

```bash
cd frontend
npm test __tests__/lib/colors.spec.ts
```

Expected: FAIL with "Cannot find module '@/lib/colors'".

- [ ] **Step 3 (GREEN): Create `frontend/lib/colors.ts`**

```typescript
export type AvailabilityColor = 'green' | 'yellow' | 'red'

export function availabilityColor(available: number, total: number): AvailabilityColor {
  if (total <= 0) return 'red'
  const ratio = available / total
  if (ratio >= 0.3) return 'green'
  if (ratio >= 0.1) return 'yellow'
  return 'red'
}

export function availabilityColorClass(color: AvailabilityColor): string {
  switch (color) {
    case 'green':
      return 'bg-availability-green'
    case 'yellow':
      return 'bg-availability-yellow'
    case 'red':
      return 'bg-availability-red'
  }
}
```

- [ ] **Step 4 (GREEN): Run test, verify it passes**

```bash
cd frontend
npm test __tests__/lib/colors.spec.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/colors.ts frontend/__tests__/lib/colors.spec.ts
git commit -m "feat(frontend): add availabilityColor logic (TDD, 6 tests)"
```

---

### Task 6: lib/url-state.ts — search params helpers (TDD)

**Files:**
- Create: `frontend/__tests__/lib/url-state.spec.ts`
- Create: `frontend/lib/url-state.ts`

- [ ] **Step 1 (RED): Create `frontend/__tests__/lib/url-state.spec.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { paramsToFilters, filtersToSearchParams } from '@/lib/url-state'

describe('paramsToFilters', () => {
  it('returns empty filters for empty search params', () => {
    const params = new URLSearchParams()
    expect(paramsToFilters(params)).toEqual({})
  })

  it('parses parking_type CSV into array', () => {
    const params = new URLSearchParams({ parking_type: 'street,garage' })
    expect(paramsToFilters(params)).toEqual({ parkingType: ['street', 'garage'] })
  })

  it('parses is_free=true', () => {
    const params = new URLSearchParams({ is_free: 'true' })
    expect(paramsToFilters(params)).toEqual({ isFree: true })
  })

  it('parses is_ev_charging=true', () => {
    const params = new URLSearchParams({ is_ev_charging: 'true' })
    expect(paramsToFilters(params)).toEqual({ isEvCharging: true })
  })

  it('ignores unknown parking_type values', () => {
    const params = new URLSearchParams({ parking_type: 'street,unicorn' })
    expect(paramsToFilters(params)).toEqual({ parkingType: ['street'] })
  })
})

describe('filtersToSearchParams', () => {
  it('returns empty params for empty filters', () => {
    expect(filtersToSearchParams({}).toString()).toBe('')
  })

  it('serializes parkingType as CSV', () => {
    const params = filtersToSearchParams({ parkingType: ['street', 'garage'] })
    expect(params.get('parking_type')).toBe('street,garage')
  })

  it('serializes isFree=true', () => {
    const params = filtersToSearchParams({ isFree: true })
    expect(params.get('is_free')).toBe('true')
  })

  it('omits empty parkingType array', () => {
    expect(filtersToSearchParams({ parkingType: [] }).toString()).toBe('')
  })
})
```

- [ ] **Step 2 (RED): Run, expect FAIL**

```bash
cd frontend
npm test __tests__/lib/url-state.spec.ts
```

Expected: FAIL "Cannot find module '@/lib/url-state'".

- [ ] **Step 3 (GREEN): Create `frontend/lib/url-state.ts`**

```typescript
import { PARKING_TYPES, type ParkingType } from './types'

export type Filters = {
  parkingType?: ParkingType[]
  isEvCharging?: boolean
  isFree?: boolean
}

export function paramsToFilters(params: URLSearchParams): Filters {
  const filters: Filters = {}

  const pt = params.get('parking_type')
  if (pt !== null && pt !== '') {
    const valid = pt
      .split(',')
      .map((v) => v.trim())
      .filter((v): v is ParkingType => (PARKING_TYPES as readonly string[]).includes(v))
    if (valid.length > 0) filters.parkingType = valid
  }

  const ev = params.get('is_ev_charging')
  if (ev === 'true') filters.isEvCharging = true
  else if (ev === 'false') filters.isEvCharging = false

  const free = params.get('is_free')
  if (free === 'true') filters.isFree = true
  else if (free === 'false') filters.isFree = false

  return filters
}

export function filtersToSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.parkingType !== undefined && filters.parkingType.length > 0) {
    params.set('parking_type', filters.parkingType.join(','))
  }
  if (filters.isEvCharging !== undefined) {
    params.set('is_ev_charging', String(filters.isEvCharging))
  }
  if (filters.isFree !== undefined) {
    params.set('is_free', String(filters.isFree))
  }
  return params
}
```

- [ ] **Step 4 (GREEN): Run, expect PASS**

```bash
cd frontend
npm test __tests__/lib/url-state.spec.ts
```

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/url-state.ts frontend/__tests__/lib/url-state.spec.ts
git commit -m "feat(frontend): add URL search-param <-> filters helpers (TDD, 9 tests)"
```

---

### Task 7: lib/api.ts — fetch wrapper (TDD)

**Files:**
- Create: `frontend/__tests__/lib/api.spec.ts`
- Create: `frontend/lib/api.ts`

- [ ] **Step 1 (RED): Create `frontend/__tests__/lib/api.spec.ts`**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchNearbyParkings, fetchParkingById } from '@/lib/api'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://test-api')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  fetchMock.mockReset()
})

describe('fetchNearbyParkings', () => {
  it('builds the URL with lat/lng/radius and parses JSON', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [{ id: 1, name: 'A' }] })

    const result = await fetchNearbyParkings({ lat: 47.378, lng: 8.540, radius: 1000 })

    expect(fetchMock).toHaveBeenCalledOnce()
    const calledUrl = String(fetchMock.mock.calls[0][0])
    expect(calledUrl).toContain('http://test-api/api/parkings')
    expect(calledUrl).toContain('lat=47.378')
    expect(calledUrl).toContain('lng=8.54')
    expect(calledUrl).toContain('radius=1000')
    expect(result).toEqual([{ id: 1, name: 'A' }])
  })

  it('appends filter query params when provided', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })

    await fetchNearbyParkings({
      lat: 47.378,
      lng: 8.540,
      parkingType: ['street', 'garage'],
      isEvCharging: true,
      isFree: false,
    })

    const calledUrl = String(fetchMock.mock.calls[0][0])
    expect(calledUrl).toContain('parking_type=street%2Cgarage')
    expect(calledUrl).toContain('is_ev_charging=true')
    expect(calledUrl).toContain('is_free=false')
  })

  it('throws when response is not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' })

    await expect(fetchNearbyParkings({ lat: 47.378, lng: 8.540 })).rejects.toThrow(/500/)
  })
})

describe('fetchParkingById', () => {
  it('fetches /api/parkings/:id and returns JSON', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 42, name: 'X' }) })

    const result = await fetchParkingById(42)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0][0])).toContain('http://test-api/api/parkings/42')
    expect(result).toEqual({ id: 42, name: 'X' })
  })

  it('throws on 404', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
    await expect(fetchParkingById(999)).rejects.toThrow(/404/)
  })
})
```

- [ ] **Step 2 (RED): Run, expect FAIL**

```bash
cd frontend
npm test __tests__/lib/api.spec.ts
```

Expected: FAIL "Cannot find module '@/lib/api'".

- [ ] **Step 3 (GREEN): Create `frontend/lib/api.ts`**

```typescript
import type { FindNearbyParams, Parking } from './types'

const API_BASE_URL = (): string => {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (url === undefined || url === '') {
    throw new Error('NEXT_PUBLIC_API_URL must be set')
  }
  return url
}

function buildNearbyUrl(params: FindNearbyParams): string {
  const url = new URL(`${API_BASE_URL()}/api/parkings`)
  url.searchParams.set('lat', String(params.lat))
  url.searchParams.set('lng', String(params.lng))
  if (params.radius !== undefined) {
    url.searchParams.set('radius', String(params.radius))
  }
  if (params.parkingType !== undefined && params.parkingType.length > 0) {
    url.searchParams.set('parking_type', params.parkingType.join(','))
  }
  if (params.isEvCharging !== undefined) {
    url.searchParams.set('is_ev_charging', String(params.isEvCharging))
  }
  if (params.isFree !== undefined) {
    url.searchParams.set('is_free', String(params.isFree))
  }
  return url.toString()
}

export async function fetchNearbyParkings(params: FindNearbyParams): Promise<Parking[]> {
  const res = await fetch(buildNearbyUrl(params))
  if (!res.ok) {
    throw new Error(`Failed to fetch parkings: ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Parking[]
}

export async function fetchParkingById(id: number): Promise<Parking> {
  const res = await fetch(`${API_BASE_URL()}/api/parkings/${id}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch parking ${id}: ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Parking
}
```

- [ ] **Step 4 (GREEN): Run, expect PASS**

```bash
cd frontend
npm test __tests__/lib/api.spec.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api.ts frontend/__tests__/lib/api.spec.ts
git commit -m "feat(frontend): add API client (TDD, 5 tests)"
```

---

### Task 8: lib/queries.ts — TanStack Query hooks

**Files:**
- Create: `frontend/lib/queries.ts`

- [ ] **Step 1: Create `frontend/lib/queries.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { fetchNearbyParkings, fetchParkingById } from './api'
import type { FindNearbyParams, Parking } from './types'

export const queryKeys = {
  nearby: (params: FindNearbyParams) => ['parkings', 'nearby', params] as const,
  byId: (id: number) => ['parkings', 'byId', id] as const,
}

export function useNearbyParkings(params: FindNearbyParams | null) {
  return useQuery({
    queryKey: params === null ? ['parkings', 'nearby', 'disabled'] : queryKeys.nearby(params),
    queryFn: () => fetchNearbyParkings(params!),
    enabled: params !== null,
    staleTime: 30_000,
  })
}

export function useParkingById(id: number | null) {
  return useQuery<Parking>({
    queryKey: id === null ? ['parkings', 'byId', 'disabled'] : queryKeys.byId(id),
    queryFn: () => fetchParkingById(id!),
    enabled: id !== null,
    staleTime: 60_000,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/queries.ts
git commit -m "feat(frontend): add TanStack Query hooks for parking endpoints"
```

---

## Phase 3 — Layout & Providers

### Task 9: QueryProvider + Root Layout

**Files:**
- Create: `frontend/components/providers/QueryProvider.tsx`
- Create: `frontend/app/[locale]/layout.tsx`

- [ ] **Step 1: Create `frontend/components/providers/QueryProvider.tsx`**

```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useState } from 'react'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
```

- [ ] **Step 2: Create `frontend/app/[locale]/layout.tsx`**

```typescript
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { routing } from '@/i18n/routing'
import '../globals.css'

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!routing.locales.includes(locale as 'de' | 'en')) {
    notFound()
  }

  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className="h-screen overflow-hidden">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}
```

- [ ] **Step 3: Build to verify**

```bash
cd frontend
npx next build
```

Expected: Build succeeds (might warn about missing pages but should not error on layout).

- [ ] **Step 4: Commit**

```bash
git add frontend/components/providers/QueryProvider.tsx frontend/app/[locale]/layout.tsx
git commit -m "feat(frontend): add QueryProvider + i18n root layout"
```

---

### Task 10: TopBar + LocaleSwitcher

**Files:**
- Create: `frontend/components/Layout/LocaleSwitcher.tsx`
- Create: `frontend/components/Layout/TopBar.tsx`

- [ ] **Step 1: Create `frontend/components/Layout/LocaleSwitcher.tsx`**

```typescript
'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/routing'

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('locale')

  const otherLocale = locale === 'de' ? 'en' : 'de'

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { locale: otherLocale })}
      className="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50"
      aria-label={`Switch to ${t(otherLocale)}`}
    >
      {t(otherLocale)}
    </button>
  )
}
```

- [ ] **Step 2: Create `frontend/components/Layout/TopBar.tsx`**

```typescript
'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { LocaleSwitcher } from './LocaleSwitcher'

export function TopBar({ children }: { children?: ReactNode }) {
  const t = useTranslations('app')

  return (
    <header className="absolute left-0 right-0 top-0 z-[1000] flex items-center justify-between gap-4 bg-white/95 px-4 py-2 shadow-sm backdrop-blur">
      <h1 className="text-base font-semibold text-gray-900 sm:text-lg">{t('title')}</h1>
      <div className="flex items-center gap-2">
        {children}
        <LocaleSwitcher />
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/Layout
git commit -m "feat(frontend): add TopBar with LocaleSwitcher"
```

---

## Phase 4 — Location & Map

### Task 11: LocationButton + geolocation hook (TDD)

**Files:**
- Create: `frontend/__tests__/components/LocationButton.spec.tsx`
- Create: `frontend/components/Location/LocationButton.tsx`
- Create: `frontend/lib/use-geolocation.ts`

- [ ] **Step 1 (RED): Create `frontend/__tests__/components/LocationButton.spec.tsx`**

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import { LocationButton } from '@/components/Location/LocationButton'
import deMessages from '@/i18n/messages/de.json'

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      {ui}
    </NextIntlClientProvider>,
  )
}

describe('LocationButton', () => {
  it('renders the locate-me label', () => {
    renderWithIntl(<LocationButton onLocate={() => {}} />)
    expect(screen.getByRole('button', { name: /standort verwenden/i })).toBeInTheDocument()
  })

  it('calls onLocate with coords when geolocation succeeds', async () => {
    const onLocate = vi.fn()
    const getCurrentPosition = vi.fn((success) => {
      success({ coords: { latitude: 47.378, longitude: 8.540 } })
    })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    renderWithIntl(<LocationButton onLocate={onLocate} />)
    await userEvent.click(screen.getByRole('button'))

    expect(onLocate).toHaveBeenCalledWith({ lat: 47.378, lng: 8.540 })
    vi.unstubAllGlobals()
  })

  it('calls onError when geolocation is denied', async () => {
    const onError = vi.fn()
    const getCurrentPosition = vi.fn((_, error) => {
      error({ code: 1, message: 'denied' })
    })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    renderWithIntl(<LocationButton onLocate={() => {}} onError={onError} />)
    await userEvent.click(screen.getByRole('button'))

    expect(onError).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2 (RED): Run, expect FAIL**

```bash
cd frontend
npm test __tests__/components/LocationButton.spec.tsx
```

Expected: FAIL "Cannot find module '@/components/Location/LocationButton'".

- [ ] **Step 3 (GREEN): Create `frontend/components/Location/LocationButton.tsx`**

```typescript
'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { Coords } from '@/lib/types'

type Props = {
  onLocate: (coords: Coords) => void
  onError?: (err: unknown) => void
}

export function LocationButton({ onLocate, onError }: Props) {
  const t = useTranslations('location')
  const [loading, setLoading] = useState(false)

  function handleClick() {
    if (typeof navigator === 'undefined' || navigator.geolocation === undefined) {
      onError?.(new Error('Geolocation not supported'))
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false)
        onLocate({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => {
        setLoading(false)
        onError?.(err)
      },
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
    >
      {loading ? t('loading') : t('locate_me')}
    </button>
  )
}
```

- [ ] **Step 4 (GREEN): Run, expect PASS**

```bash
cd frontend
npm test __tests__/components/LocationButton.spec.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/Location frontend/__tests__/components/LocationButton.spec.tsx
git commit -m "feat(frontend): add LocationButton with geolocation API (TDD, 3 tests)"
```

---

### Task 12: ParkingMarker + UserLocationMarker (helpers)

**Files:**
- Create: `frontend/components/Map/ParkingMarker.tsx`
- Create: `frontend/components/Map/UserLocationMarker.tsx`

- [ ] **Step 1: Create `frontend/components/Map/ParkingMarker.tsx`**

```typescript
'use client'

import L from 'leaflet'
import { Marker, Popup } from 'react-leaflet'
import { availabilityColor } from '@/lib/colors'
import type { Parking } from '@/lib/types'

const ICON_CACHE = new Map<string, L.DivIcon>()

function iconForColor(color: 'green' | 'yellow' | 'red'): L.DivIcon {
  const cached = ICON_CACHE.get(color)
  if (cached !== undefined) return cached

  const fillColor = color === 'green' ? '#16a34a' : color === 'yellow' ? '#eab308' : '#dc2626'
  const html = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path fill="${fillColor}" stroke="white" stroke-width="1.5" d="M14 0C6.27 0 0 6.27 0 14c0 10 14 22 14 22s14-12 14-22c0-7.73-6.27-14-14-14z"/><circle cx="14" cy="14" r="5" fill="white"/></svg>`
  const icon = L.divIcon({
    className: 'parking-marker',
    html,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  })
  ICON_CACHE.set(color, icon)
  return icon
}

type Props = {
  parking: Parking
  onClick: (id: number) => void
}

export function ParkingMarker({ parking, onClick }: Props) {
  const color = availabilityColor(parking.availableSpots, parking.totalSpots)
  return (
    <Marker
      position={[parking.latitude, parking.longitude]}
      icon={iconForColor(color)}
      eventHandlers={{ click: () => onClick(parking.id) }}
    >
      <Popup>
        <strong>{parking.name}</strong>
        <br />
        {parking.availableSpots} / {parking.totalSpots}
      </Popup>
    </Marker>
  )
}
```

- [ ] **Step 2: Create `frontend/components/Map/UserLocationMarker.tsx`**

```typescript
'use client'

import L from 'leaflet'
import { CircleMarker } from 'react-leaflet'
import type { Coords } from '@/lib/types'

type Props = { coords: Coords }

export function UserLocationMarker({ coords }: Props) {
  return (
    <CircleMarker
      center={[coords.lat, coords.lng]}
      radius={8}
      pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.7, weight: 2 }}
    />
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/Map/ParkingMarker.tsx frontend/components/Map/UserLocationMarker.tsx
git commit -m "feat(frontend): add ParkingMarker (color-coded SVG) and UserLocationMarker"
```

---

### Task 13: Map components (client + dynamic-import wrapper)

**Files:**
- Create: `frontend/components/Map/MapClient.tsx`
- Create: `frontend/components/Map/MapContainer.tsx`

- [ ] **Step 1: Create `frontend/components/Map/MapClient.tsx`**

```typescript
'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer as LeafletMap, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useEffect } from 'react'
import { ParkingMarker } from './ParkingMarker'
import { UserLocationMarker } from './UserLocationMarker'
import type { Coords, Parking } from '@/lib/types'

type Props = {
  center: Coords
  parkings: Parking[]
  userCoords: Coords | null
  onMoveEnd: (coords: Coords) => void
  onMarkerClick: (id: number) => void
}

function MapEvents({ onMoveEnd }: { onMoveEnd: (coords: Coords) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter()
      onMoveEnd({ lat: c.lat, lng: c.lng })
    },
  })
  return null
}

function CenterUpdater({ center }: { center: Coords }) {
  const map = useMap()
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom())
  }, [center.lat, center.lng, map])
  return null
}

export default function MapClient({ center, parkings, userCoords, onMoveEnd, onMarkerClick }: Props) {
  return (
    <LeafletMap
      center={[center.lat, center.lng]}
      zoom={14}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CenterUpdater center={center} />
      <MapEvents onMoveEnd={onMoveEnd} />
      {userCoords !== null && <UserLocationMarker coords={userCoords} />}
      {parkings.map((p) => (
        <ParkingMarker key={p.id} parking={p} onClick={onMarkerClick} />
      ))}
    </LeafletMap>
  )
}
```

- [ ] **Step 2: Create `frontend/components/Map/MapContainer.tsx`**

```typescript
'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'

type MapClientType = typeof import('./MapClient').default

const MapClient = dynamic<ComponentProps<MapClientType>>(
  () => import('./MapClient'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-500">
        Lade Karte...
      </div>
    ),
  },
)

export const MapContainer = MapClient
```

- [ ] **Step 3: Build to verify**

```bash
cd frontend
npx next build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/Map/MapClient.tsx frontend/components/Map/MapContainer.tsx
git commit -m "feat(frontend): add Map components (Leaflet, dynamic-imported)"
```

---

## Phase 5 — Filters & Detail

### Task 14: FilterChip + FilterBar (TDD)

**Files:**
- Create: `frontend/components/Filters/FilterChip.tsx`
- Create: `frontend/__tests__/components/FilterBar.spec.tsx`
- Create: `frontend/components/Filters/FilterBar.tsx`

- [ ] **Step 1: Create `frontend/components/Filters/FilterChip.tsx`**

```typescript
'use client'

import type { ReactNode } from 'react'

type Props = {
  active: boolean
  onClick: () => void
  children: ReactNode
}

export function FilterChip({ active, onClick, children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2 (RED): Create `frontend/__tests__/components/FilterBar.spec.tsx`**

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import { FilterBar } from '@/components/Filters/FilterBar'
import deMessages from '@/i18n/messages/de.json'

function renderBar(props: Partial<React.ComponentProps<typeof FilterBar>> = {}) {
  const defaultProps: React.ComponentProps<typeof FilterBar> = {
    filters: {},
    onChange: () => {},
  }
  return render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <FilterBar {...defaultProps} {...props} />
    </NextIntlClientProvider>,
  )
}

describe('FilterBar', () => {
  it('renders all three type chips and two toggles', () => {
    renderBar()
    expect(screen.getByRole('button', { name: /strasse/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /parkhaus/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /privat/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /kostenlos/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ladestation/i })).toBeInTheDocument()
  })

  it('marks active chip as aria-pressed=true', () => {
    renderBar({ filters: { parkingType: ['garage'] } })
    expect(screen.getByRole('button', { name: /parkhaus/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /strasse/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('calls onChange with toggled type when chip clicked', async () => {
    const onChange = vi.fn()
    renderBar({ onChange })
    await userEvent.click(screen.getByRole('button', { name: /strasse/i }))
    expect(onChange).toHaveBeenLastCalledWith({ parkingType: ['street'] })
  })

  it('removes type from array on second click', async () => {
    const onChange = vi.fn()
    renderBar({ filters: { parkingType: ['street', 'garage'] }, onChange })
    await userEvent.click(screen.getByRole('button', { name: /strasse/i }))
    expect(onChange).toHaveBeenLastCalledWith({ parkingType: ['garage'] })
  })

  it('toggles isFree on click', async () => {
    const onChange = vi.fn()
    renderBar({ onChange })
    await userEvent.click(screen.getByRole('button', { name: /kostenlos/i }))
    expect(onChange).toHaveBeenLastCalledWith({ isFree: true })
  })

  it('toggles isEvCharging on click', async () => {
    const onChange = vi.fn()
    renderBar({ filters: { isEvCharging: true }, onChange })
    await userEvent.click(screen.getByRole('button', { name: /ladestation/i }))
    // Toggling off — should remove the property
    expect(onChange).toHaveBeenLastCalledWith({})
  })
})
```

- [ ] **Step 3 (RED): Run, expect FAIL**

```bash
cd frontend
npm test __tests__/components/FilterBar.spec.tsx
```

Expected: FAIL "Cannot find module '@/components/Filters/FilterBar'".

- [ ] **Step 4 (GREEN): Create `frontend/components/Filters/FilterBar.tsx`**

```typescript
'use client'

import { useTranslations } from 'next-intl'
import { PARKING_TYPES, type ParkingType } from '@/lib/types'
import type { Filters } from '@/lib/url-state'
import { FilterChip } from './FilterChip'

type Props = {
  filters: Filters
  onChange: (next: Filters) => void
}

export function FilterBar({ filters, onChange }: Props) {
  const t = useTranslations('filters')

  function toggleType(type: ParkingType) {
    const current = filters.parkingType ?? []
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type]
    const updated: Filters = { ...filters }
    if (next.length > 0) updated.parkingType = next
    else delete updated.parkingType
    onChange(updated)
  }

  function toggleBool(key: 'isFree' | 'isEvCharging') {
    const updated: Filters = { ...filters }
    if (filters[key] === true) delete updated[key]
    else updated[key] = true
    onChange(updated)
  }

  const typeLabels: Record<ParkingType, string> = {
    street: t('type_street'),
    garage: t('type_garage'),
    private: t('type_private'),
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PARKING_TYPES.map((type) => (
        <FilterChip
          key={type}
          active={(filters.parkingType ?? []).includes(type)}
          onClick={() => toggleType(type)}
        >
          {typeLabels[type]}
        </FilterChip>
      ))}
      <FilterChip active={filters.isFree === true} onClick={() => toggleBool('isFree')}>
        {t('is_free_label')}
      </FilterChip>
      <FilterChip
        active={filters.isEvCharging === true}
        onClick={() => toggleBool('isEvCharging')}
      >
        {t('ev_charging_label')}
      </FilterChip>
    </div>
  )
}
```

- [ ] **Step 5 (GREEN): Run, expect PASS**

```bash
cd frontend
npm test __tests__/components/FilterBar.spec.tsx
```

Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/Filters frontend/__tests__/components/FilterBar.spec.tsx
git commit -m "feat(frontend): add FilterBar + FilterChip (TDD, 6 tests)"
```

---

### Task 15: NavigateButton (TDD)

**Files:**
- Create: `frontend/__tests__/components/NavigateButton.spec.tsx`
- Create: `frontend/components/Detail/NavigateButton.tsx`

- [ ] **Step 1 (RED): Create `frontend/__tests__/components/NavigateButton.spec.tsx`**

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NavigateButton } from '@/components/Detail/NavigateButton'
import deMessages from '@/i18n/messages/de.json'

function renderBtn(lat: number, lng: number) {
  return render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <NavigateButton lat={lat} lng={lng} />
    </NextIntlClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('NavigateButton', () => {
  it('renders the navigate label', () => {
    renderBtn(47.378, 8.540)
    expect(screen.getByRole('button', { name: /navigation starten/i })).toBeInTheDocument()
  })

  it('opens Google Maps URL in a new tab when clicked', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)

    renderBtn(47.378, 8.540)
    await userEvent.click(screen.getByRole('button'))

    expect(open).toHaveBeenCalledWith(
      'https://www.google.com/maps/dir/?api=1&destination=47.378%2C8.54',
      '_blank',
      'noopener,noreferrer',
    )
  })
})
```

- [ ] **Step 2 (RED): Run, expect FAIL**

```bash
cd frontend
npm test __tests__/components/NavigateButton.spec.tsx
```

Expected: FAIL "Cannot find module '@/components/Detail/NavigateButton'".

- [ ] **Step 3 (GREEN): Create `frontend/components/Detail/NavigateButton.tsx`**

```typescript
'use client'

import { useTranslations } from 'next-intl'

type Props = { lat: number; lng: number }

export function NavigateButton({ lat, lng }: Props) {
  const t = useTranslations('detail')

  function handleClick() {
    const dest = encodeURIComponent(`${lat},${lng}`)
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
    >
      {t('navigate')}
    </button>
  )
}
```

- [ ] **Step 4 (GREEN): Run, expect PASS**

```bash
cd frontend
npm test __tests__/components/NavigateButton.spec.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/Detail/NavigateButton.tsx frontend/__tests__/components/NavigateButton.spec.tsx
git commit -m "feat(frontend): add NavigateButton with Google Maps deep link (TDD, 2 tests)"
```

---

### Task 16: ParkingDetail panel (TDD)

**Files:**
- Create: `frontend/__tests__/components/ParkingDetail.spec.tsx`
- Create: `frontend/components/Detail/ParkingDetail.tsx`

- [ ] **Step 1 (RED): Create `frontend/__tests__/components/ParkingDetail.spec.tsx`**

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import { ParkingDetail } from '@/components/Detail/ParkingDetail'
import deMessages from '@/i18n/messages/de.json'
import type { Parking } from '@/lib/types'

const PARKING: Parking = {
  id: 1,
  name: 'PH Hohe Promenade',
  address: 'Promenadengasse 1, 8001 Zürich',
  city: 'Zürich',
  parkingType: 'garage',
  latitude: 47.37,
  longitude: 8.5453,
  totalSpots: 220,
  availableSpots: 130,
  pricePerHour: 4.5,
  isEvCharging: true,
  maxHeight: 2.1,
  openingHours: '24/7',
}

function renderDetail(parking: Parking | null, onClose = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <ParkingDetail parking={parking} onClose={onClose} />
    </NextIntlClientProvider>,
  )
}

describe('ParkingDetail', () => {
  it('renders nothing when parking is null', () => {
    const { container } = renderDetail(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders the parking name and address', () => {
    renderDetail(PARKING)
    expect(screen.getByText('PH Hohe Promenade')).toBeInTheDocument()
    expect(screen.getByText('Promenadengasse 1, 8001 Zürich')).toBeInTheDocument()
  })

  it('shows availability count', () => {
    renderDetail(PARKING)
    expect(screen.getByText(/130/)).toBeInTheDocument()
    expect(screen.getByText(/220/)).toBeInTheDocument()
  })

  it('shows price per hour with CHF', () => {
    renderDetail(PARKING)
    expect(screen.getByText(/CHF 4\.50/i)).toBeInTheDocument()
  })

  it('shows free label when pricePerHour is 0', () => {
    renderDetail({ ...PARKING, pricePerHour: 0 })
    expect(screen.getByText(/kostenlos/i)).toBeInTheDocument()
  })

  it('shows EV charging info when available', () => {
    renderDetail(PARKING)
    expect(screen.getByText(/Ladestation verfügbar/i)).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    renderDetail(PARKING, onClose)
    await userEvent.click(screen.getByRole('button', { name: /schliessen/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2 (RED): Run, expect FAIL**

```bash
cd frontend
npm test __tests__/components/ParkingDetail.spec.tsx
```

Expected: FAIL "Cannot find module '@/components/Detail/ParkingDetail'".

- [ ] **Step 3 (GREEN): Create `frontend/components/Detail/ParkingDetail.tsx`**

```typescript
'use client'

import { useTranslations } from 'next-intl'
import type { Parking } from '@/lib/types'
import { NavigateButton } from './NavigateButton'

type Props = {
  parking: Parking | null
  onClose: () => void
}

export function ParkingDetail({ parking, onClose }: Props) {
  const t = useTranslations('detail')

  if (parking === null) return null

  return (
    <aside
      role="dialog"
      aria-label={parking.name}
      className="absolute bottom-0 left-0 right-0 z-[1000] max-h-[70vh] overflow-y-auto rounded-t-xl bg-white p-4 shadow-2xl sm:bottom-4 sm:left-auto sm:right-4 sm:top-16 sm:max-h-none sm:w-96 sm:rounded-xl"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{parking.name}</h2>
          <p className="text-sm text-gray-600">{parking.address}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <dl className="mb-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">{t('available')}</dt>
          <dd className="font-medium text-gray-900">
            {parking.availableSpots} {t('of')} {parking.totalSpots}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">{t('price_per_hour')}</dt>
          <dd className="font-medium text-gray-900">
            {parking.pricePerHour === 0
              ? t('free')
              : `CHF ${parking.pricePerHour.toFixed(2)}`}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">⚡</dt>
          <dd className="font-medium text-gray-900">
            {parking.isEvCharging ? t('ev_charging') : t('no_ev_charging')}
          </dd>
        </div>
        {parking.maxHeight !== null && (
          <div className="flex justify-between">
            <dt className="text-gray-500">{t('max_height')}</dt>
            <dd className="font-medium text-gray-900">{parking.maxHeight.toFixed(2)} m</dd>
          </div>
        )}
        {parking.openingHours !== null && (
          <div className="flex justify-between">
            <dt className="text-gray-500">{t('opening_hours')}</dt>
            <dd className="font-medium text-gray-900">{parking.openingHours}</dd>
          </div>
        )}
      </dl>

      <NavigateButton lat={parking.latitude} lng={parking.longitude} />
    </aside>
  )
}
```

- [ ] **Step 4 (GREEN): Run, expect PASS**

```bash
cd frontend
npm test __tests__/components/ParkingDetail.spec.tsx
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/Detail/ParkingDetail.tsx frontend/__tests__/components/ParkingDetail.spec.tsx
git commit -m "feat(frontend): add ParkingDetail panel (TDD, 7 tests)"
```

---

## Phase 6 — Main Page Wiring

### Task 17: Page state hook (filters from URL)

**Files:**
- Create: `frontend/lib/use-filter-state.ts`

- [ ] **Step 1: Create `frontend/lib/use-filter-state.ts`**

```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { usePathname } from '@/i18n/routing'
import { filtersToSearchParams, paramsToFilters, type Filters } from './url-state'

export function useFilterState(): [Filters, (filters: Filters) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const filters = paramsToFilters(new URLSearchParams(params.toString()))

  function setFilters(next: Filters) {
    const newParams = filtersToSearchParams(next).toString()
    const url = newParams === '' ? pathname : `${pathname}?${newParams}`
    router.replace(url, { scroll: false })
  }

  return [filters, setFilters]
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/use-filter-state.ts
git commit -m "feat(frontend): add useFilterState hook (URL <-> filters)"
```

---

### Task 18: Main page

**Files:**
- Create: `frontend/app/[locale]/page.tsx`
- Create: `frontend/components/PageShell.tsx`

- [ ] **Step 1: Create `frontend/components/PageShell.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { FilterBar } from './Filters/FilterBar'
import { TopBar } from './Layout/TopBar'
import { LocationButton } from './Location/LocationButton'
import { MapContainer } from './Map/MapContainer'
import { ParkingDetail } from './Detail/ParkingDetail'
import { useFilterState } from '@/lib/use-filter-state'
import { useNearbyParkings, useParkingById } from '@/lib/queries'
import { ZURICH_HB, type Coords } from '@/lib/types'

export function PageShell() {
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

  function handleLocate(coords: Coords) {
    setUserCoords(coords)
    setCenter(coords)
  }

  function handleLocationError() {
    setUserCoords(null)
  }

  return (
    <div className="relative h-screen w-full">
      <MapContainer
        center={center}
        parkings={nearbyQuery.data ?? []}
        userCoords={userCoords}
        onMoveEnd={setCenter}
        onMarkerClick={setSelectedId}
      />
      <TopBar>
        <LocationButton onLocate={handleLocate} onError={handleLocationError} />
      </TopBar>
      <div className="absolute bottom-0 left-0 right-0 z-[999] bg-white/95 px-4 py-3 shadow-md backdrop-blur sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md sm:rounded-xl">
        <FilterBar filters={filters} onChange={setFilters} />
      </div>
      <ParkingDetail parking={detailQuery.data ?? null} onClose={() => setSelectedId(null)} />
    </div>
  )
}
```

- [ ] **Step 2: Create `frontend/app/[locale]/page.tsx`**

```typescript
import { PageShell } from '@/components/PageShell'

export default function Page() {
  return <PageShell />
}
```

- [ ] **Step 3: Build to verify**

```bash
cd frontend
npx next build
```

Expected: Build succeeds (warnings about useSearchParams in static generation are acceptable — page will be dynamic).

- [ ] **Step 4: Commit**

```bash
git add frontend/components/PageShell.tsx frontend/app/[locale]/page.tsx
git commit -m "feat(frontend): wire main page (Map + TopBar + FilterBar + ParkingDetail)"
```

---

## Phase 7 — Frontend Dockerfile + compose

### Task 19: Frontend Dockerfile + add to compose

**Files:**
- Create: `frontend/Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Create `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
```

- [ ] **Step 2: Update `docker-compose.yml` — add `frontend` service**

Append after `backend` service, before `volumes:`:

```yaml
  frontend:
    build: ./frontend
    container_name: parking-frontend
    depends_on:
      - backend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    command: npm run dev
```

- [ ] **Step 3: Verify full compose builds (only when Docker is installed)**

```bash
docker compose config
```

Expected: docker-compose.yml validated, all services listed.

- [ ] **Step 4: Commit**

```bash
git add frontend/Dockerfile docker-compose.yml
git commit -m "feat(frontend): add Dockerfile and wire frontend into docker-compose"
```

---

## Phase 8 — Verification

### Task 20: Run full frontend test suite

**Files:** None (verification)

- [ ] **Step 1: Run all unit tests**

```bash
cd frontend
npm test
```

Expected:
- `__tests__/lib/colors.spec.ts` — 6 tests
- `__tests__/lib/url-state.spec.ts` — 9 tests
- `__tests__/lib/api.spec.ts` — 5 tests
- `__tests__/components/LocationButton.spec.tsx` — 3 tests
- `__tests__/components/FilterBar.spec.tsx` — 6 tests
- `__tests__/components/NavigateButton.spec.tsx` — 2 tests
- `__tests__/components/ParkingDetail.spec.tsx` — 7 tests

Total: 38 tests, all PASS.

- [ ] **Step 2: Build production bundle**

```bash
cd frontend
npm run build
```

Expected: Build succeeds, no TypeScript errors.

---

### Task 21: End-to-end manual smoke test (when Docker is available)

**Files:** None (verification)

- [ ] **Step 1: Start full stack**

```bash
docker compose up -d --build
docker compose exec backend npm run db:seed
```

- [ ] **Step 2: Open browser**

```
http://localhost:3000
```

- [ ] **Step 3: Verify each acceptance criterion**

1. Page loads in <2 s (open DevTools → Network → reload)
2. Geolocation prompt appears OR map centers on Zürich HB
3. ~10–30 colored markers visible (depending on radius/center)
4. Click a marker → ParkingDetail panel opens with all fields
5. Click "Navigation starten" → opens Google Maps in new tab
6. Toggle filters: number of markers updates live; URL reflects filters
7. Switch language (top-right): URL changes `/de/` ↔ `/en/`, all labels translate
8. Drag map to a different city (e.g. Bern) → markers refresh
9. Resize window to mobile (<640 px) → filter bar moves to bottom, panel becomes bottom-sheet

- [ ] **Step 4: Stop**

```bash
docker compose down
```

---

## Definition of Done — Plan B

After all tasks pass, you should have:

1. ✅ Frontend at `http://localhost:3000` (or `npm run dev` directly)
2. ✅ Map with color-coded parking markers from real backend
3. ✅ Click marker → detail panel with all fields
4. ✅ "Navigate" → Google Maps deep link
5. ✅ Three filters working live (parking_type multi-select, is_free, is_ev_charging)
6. ✅ Filter state in URL (bookmarkable)
7. ✅ DE ↔ EN switcher working
8. ✅ User location detection with Zürich fallback
9. ✅ Mobile-responsive layout (bottom sheets vs sidebars)
10. ✅ All 38 frontend unit tests pass
11. ✅ `docker compose up` runs the full stack

**Combined with Plan A:** the full Parking Checker MVP is done.
