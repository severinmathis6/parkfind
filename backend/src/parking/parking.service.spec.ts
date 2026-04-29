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

async function build() {
  const repoMock = {
    findNearby: vi.fn(),
    findById: vi.fn(),
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
    ;(repo.findNearby as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeRow({ name: 'A' }),
      makeRow({ id: 2, name: 'B' }),
    ])

    const result = await service.findNearby({ lat: 47.378, lng: 8.540, radius: 2000 })

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('A')
    expect(result[0].pricePerHour).toBe(3.5)
    expect(result[0].distanceM).toBe(50)
  })

  it('forwards filters to the repository', async () => {
    const { service, repo } = await build()
    ;(repo.findNearby as ReturnType<typeof vi.fn>).mockResolvedValue([])

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
    ;(repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeRow({ id: 42, name: 'Hohe Promenade' }),
    )

    const result = await service.findById(42)

    expect(result.id).toBe(42)
    expect(result.name).toBe('Hohe Promenade')
  })

  it('throws NotFoundException when parking missing', async () => {
    const { service, repo } = await build()
    ;(repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(service.findById(999)).rejects.toThrow(NotFoundException)
  })
})
