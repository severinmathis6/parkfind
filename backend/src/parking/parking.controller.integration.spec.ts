import { ValidationPipe } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
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
