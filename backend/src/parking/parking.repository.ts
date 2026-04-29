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
