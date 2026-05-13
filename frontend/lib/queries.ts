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
