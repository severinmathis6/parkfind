import type { ParkingRow, ParkingType } from '../parking.types'

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
  pricePerHour!: number
  isEvCharging!: boolean
  maxHeight!: number | null
  openingHours!: string | null
  distanceM?: number

  static fromRow(row: ParkingRow): ParkingResponseDto {
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
