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

const ZRH_HB = { lat: 47.3779, lng: 8.5403 }

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
    await seed([{ name: 'Near', latitude: 47.3780, longitude: 8.5410 }])
    const result = await repo.findNearby({ lat: ZRH_HB.lat, lng: ZRH_HB.lng, radius: 200 })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Near')
    expect(result[0].distance_m).toBeLessThan(200)
  })

  it('excludes parking outside the radius', async () => {
    await seed([{ name: 'Far', latitude: 47.5000, longitude: 8.7000 }])
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
