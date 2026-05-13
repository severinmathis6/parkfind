'use client'

import { useState } from 'react'
import { FilterBar } from './Filters/FilterBar'
import { TopBar } from './Layout/TopBar'
import { LocationButton } from './Location/LocationButton'
import { MapContainer } from './Map/MapContainer'
import { ParkingDetail } from './Detail/ParkingDetail'
import { useFilterState } from '@/lib/use-filter-state'
import { useNearbyParkings, useParkingById } from '@/lib/queries'
import { ZURICH_HB, type Coords } from '@/lib/types'

export function PageShell() {
  const [center, setCenter] = useState<Coords>(ZURICH_HB)
  const [userCoords, setUserCoords] = useState<Coords | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filters, setFilters] = useFilterState()

  const nearbyQuery = useNearbyParkings({
    lat: center.lat,
    lng: center.lng,
    radius: 2000,
    parkingType: filters.parkingType,
    isEvCharging: filters.isEvCharging,
    isFree: filters.isFree,
  })

  const detailQuery = useParkingById(selectedId)

  function handleLocate(coords: Coords) {
    setUserCoords(coords)
    setCenter(coords)
  }

  function handleLocationError() {
    setUserCoords(null)
  }

  return (
    <div className="relative h-screen w-full">
      <MapContainer
        center={center}
        parkings={nearbyQuery.data ?? []}
        userCoords={userCoords}
        onMoveEnd={setCenter}
        onMarkerClick={setSelectedId}
      />
      <TopBar>
        <LocationButton onLocate={handleLocate} onError={handleLocationError} />
      </TopBar>
      <div className="absolute bottom-0 left-0 right-0 z-[999] bg-white/95 px-4 py-3 shadow-md backdrop-blur sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md sm:rounded-xl">
        <FilterBar filters={filters} onChange={setFilters} />
      </div>
      <ParkingDetail parking={detailQuery.data ?? null} onClose={() => setSelectedId(null)} />
    </div>
  )
}
