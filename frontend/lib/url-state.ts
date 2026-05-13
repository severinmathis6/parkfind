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
