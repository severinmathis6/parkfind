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
