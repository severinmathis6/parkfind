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
