export const PARKING_TYPES = ['street', 'garage', 'private'] as const
export type ParkingType = (typeof PARKING_TYPES)[number]

export type ParkingRow = {
  id: number
  name: string
  address: string
  city: string
  parking_type: ParkingType
  latitude: number
  longitude: number
  total_spots: number
  available_spots: number
  price_per_hour: string
  is_ev_charging: boolean
  max_height: number | null
  opening_hours: string | null
  distance_m?: number
}
